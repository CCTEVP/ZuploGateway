import {
  ConfigurationError,
  environment,
  ZuploContext,
  ZuploRequest,
} from "@zuplo/runtime";
import { bumpCacheVersion, getCacheVersion } from "./cache-version";
import {
  getPlayerLookupValue,
  clearPlayerLookupParams,
} from "./player-query-params";
import type { PlayerLookup, PlayerRecord } from "./players/types";
import {
  buildFormattedResponse,
  parseFormatParam,
} from "./response-format";
import {
  buildOpenWeatherCityQuery,
  isValidWeatherSource,
  normalizeWeatherSource,
  WEATHER_SOURCE_QUERY_PARAM,
} from "./weather-query-params";

function maskValue(value: string) {
  return "*".repeat(value.length);
}

function hasValidCoordinates(match: PlayerRecord | undefined): boolean {
  return (
    match != null &&
    Number.isFinite(match.latitude) &&
    Number.isFinite(match.longitude)
  );
}

function parseLatLon(latlon: string | null | undefined): {
  lat: string;
  lon: string;
} | null {
  if (!latlon) {
    return null;
  }

  const [rawLat, rawLon] = latlon.trim().split(",");
  if (
    !rawLat ||
    !rawLon ||
    Number.isNaN(Number(rawLat)) ||
    Number.isNaN(Number(rawLon))
  ) {
    return null;
  }

  return {
    lat: parseFloat(rawLat).toFixed(3),
    lon: parseFloat(rawLon).toFixed(3),
  };
}

export function createWeatherTransform(players: PlayerLookup) {
  return async function weatherTransform(
    request: ZuploRequest,
    context: ZuploContext,
  ) {
    const openWeatherApiKey = environment.OPENWEATHER_API_KEY;

    if (!openWeatherApiKey) {
      throw new ConfigurationError(
        "OPENWEATHER_API_KEY environment variable isn't configured",
      );
    }

    const url = new URL(request.url);
    let latlon = url.searchParams.get("latlon");
    const cityQuery = url.searchParams.get("q")?.trim();
    const debug = url.searchParams.get("debug");
    const filter = url.searchParams.get("filter");
    const format = url.searchParams.get("format");
    const sourceParam = url.searchParams.get(WEATHER_SOURCE_QUERY_PARAM);
    const locationLookupValue = getPlayerLookupValue(url.searchParams);
    const showDebug = debug === "true";

    const formatCheck = parseFormatParam(format);
    if (formatCheck.error) {
      return formatCheck.error;
    }

    if (!isValidWeatherSource(sourceParam)) {
      return new Response(
        "Invalid source query parameter. Supported values are latlon (default) or city.",
        {
          status: 400,
        },
      );
    }

    const source = normalizeWeatherSource(sourceParam)!;

    const matchedSourceRecord =
      (context.custom.weatherMatchedSourceRecord as
        | ReturnType<PlayerLookup["findSourceRecord"]>
        | undefined) ??
      (locationLookupValue
        ? players.findSourceRecord(locationLookupValue)
        : undefined);

    let match: PlayerRecord | undefined;
    if (locationLookupValue) {
      match = players.findPlayer(locationLookupValue);

      if (!match) {
        return new Response(
          `Unknown player query parameter: ${locationLookupValue}`,
          {
            status: 404,
          },
        );
      }

      if (!latlon) {
        latlon = `${match.latitude},${match.longitude}`;
      }
    } else if (matchedSourceRecord) {
      match = players.findPlayer(String(matchedSourceRecord.PlayerID));
    }

    const newUrl = new URL(
      `https://api.openweathermap.org/data/2.5/weather?appid=${openWeatherApiKey}&units=metric`,
    );

    let resolvedBy: "city" | "latlon" = "latlon";

    if (source === "city") {
      // Prefer cache-normalized q, then player City (overrides latlon).
      const city = match?.city?.trim();
      const q =
        cityQuery ||
        (city ? buildOpenWeatherCityQuery(city, match?.country) : undefined);

      if (q) {
        newUrl.searchParams.set("q", q);
        resolvedBy = "city";
      } else {
        const coords =
          parseLatLon(latlon) ??
          (hasValidCoordinates(match)
            ? {
                lat: match!.latitude.toFixed(3),
                lon: match!.longitude.toFixed(3),
              }
            : null);

        if (!coords) {
          return new Response(
            locationLookupValue || matchedSourceRecord
              ? `Player ${locationLookupValue || matchedSourceRecord?.PlayerID} has no City and no Latitude/Longitude for weather lookup.`
              : "source=city requires a player with City (or Latitude/Longitude fallback), or provide latlon.",
            {
              status: 400,
            },
          );
        }

        newUrl.searchParams.set("lat", coords.lat);
        newUrl.searchParams.set("lon", coords.lon);
        resolvedBy = "latlon";
      }
    } else {
      if (!latlon && !locationLookupValue && !match) {
        return new Response(
          "Missing required query parameter: latlon, player, or resource_id",
          {
            status: 400,
          },
        );
      }

      const coords =
        parseLatLon(latlon) ??
        (hasValidCoordinates(match)
          ? {
              lat: match!.latitude.toFixed(3),
              lon: match!.longitude.toFixed(3),
            }
          : null);

      if (!coords) {
        return new Response(
          "Invalid latlon query parameter. Expected format: latlon=32.46564,12.8737874",
          {
            status: 400,
          },
        );
      }

      newUrl.searchParams.set("lat", coords.lat);
      newUrl.searchParams.set("lon", coords.lon);
    }

    const upstreamResponse = await fetch(new ZuploRequest(newUrl, request));
    const weather = await upstreamResponse.json();
    const timestamp = upstreamResponse.headers.get("date");
    const headers = new Headers(upstreamResponse.headers);
    const originalUrl = new URL(newUrl);

    if (showDebug) {
      originalUrl.searchParams.set("appid", maskValue(openWeatherApiKey));
    }

    const payload = {
      ...(weather as Record<string, unknown>),
      timestamp: timestamp
        ? new Date(timestamp).toISOString()
        : new Date().toISOString(),
      ...(showDebug
        ? {
            debug: {
              original: originalUrl.toString(),
              source,
              resolvedBy,
              ...(matchedSourceRecord ? { player: matchedSourceRecord } : {}),
            },
          }
        : {}),
    };

    return buildFormattedResponse({
      pathname: url.pathname,
      format,
      filter,
      showDebug,
      payload,
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers,
    });
  };
}

export function createWeatherNormalizeCacheKey(
  players: PlayerLookup,
  cacheNamespace: string,
) {
  return async function weatherNormalizeCacheKey(
    request: ZuploRequest,
    context: ZuploContext,
  ) {
    const url = new URL(request.url);
    const locationLookupValue = getPlayerLookupValue(url.searchParams);
    const latlon = url.searchParams.get("latlon");
    const sourceParam = url.searchParams.get(WEATHER_SOURCE_QUERY_PARAM);
    const cacheVersion = await getCacheVersion(cacheNamespace, context);

    if (!isValidWeatherSource(sourceParam)) {
      return request;
    }

    const source = normalizeWeatherSource(sourceParam)!;
    url.searchParams.set(WEATHER_SOURCE_QUERY_PARAM, source);

    if (locationLookupValue) {
      const match = players.findPlayer(locationLookupValue);
      const sourceRecord = players.findSourceRecord(locationLookupValue);

      if (!match) {
        return request;
      }

      context.custom.weatherMatchedSourceRecord = sourceRecord;

      // source=city with City wins over latlon (including an explicit latlon param).
      if (source === "city" && match.city) {
        url.searchParams.set(
          "q",
          buildOpenWeatherCityQuery(match.city, match.country),
        );
        url.searchParams.delete("latlon");
        url.searchParams.set("cacheVersion", cacheVersion);
        clearPlayerLookupParams(url.searchParams);
        return new ZuploRequest(url, request);
      }

      // source=latlon, or source=city falling back to coordinates
      url.searchParams.set(
        "latlon",
        `${match.latitude.toFixed(3)},${match.longitude.toFixed(3)}`,
      );
      url.searchParams.delete("q");
      url.searchParams.set("cacheVersion", cacheVersion);
      clearPlayerLookupParams(url.searchParams);

      return new ZuploRequest(url, request);
    }

    if (source === "city" && latlon) {
      // No player City available; fall back to latlon for cache key.
      const coords = parseLatLon(latlon);
      if (!coords) {
        return request;
      }
      url.searchParams.set("latlon", `${coords.lat},${coords.lon}`);
      url.searchParams.delete("q");
      url.searchParams.set("cacheVersion", cacheVersion);
      clearPlayerLookupParams(url.searchParams);
      return new ZuploRequest(url, request);
    }

    if (!latlon) {
      return request;
    }

    const coords = parseLatLon(latlon);
    if (!coords) {
      return request;
    }

    url.searchParams.set("latlon", `${coords.lat},${coords.lon}`);
    url.searchParams.delete("q");
    url.searchParams.set("cacheVersion", cacheVersion);
    clearPlayerLookupParams(url.searchParams);

    return new ZuploRequest(url, request);
  };
}

export function createWeatherReset(cacheNamespace: string, cacheLabel: string) {
  return async function weatherReset(
    _request: ZuploRequest,
    context: ZuploContext,
  ) {
    const version = await bumpCacheVersion(cacheNamespace, context);

    return Response.json({
      cache: cacheLabel,
      reset: true,
      version,
    });
  };
}
