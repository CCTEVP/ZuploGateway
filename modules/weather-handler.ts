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
import type { PlayerLookup } from "./players/types";
import {
  buildFormattedResponse,
  parseFormatParam,
} from "./response-format";

function maskValue(value: string) {
  return "*".repeat(value.length);
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
    const debug = url.searchParams.get("debug");
    const filter = url.searchParams.get("filter");
    const format = url.searchParams.get("format");
    const locationLookupValue = getPlayerLookupValue(url.searchParams);
    const showDebug = debug === "true";

    const formatCheck = parseFormatParam(format);
    if (formatCheck.error) {
      return formatCheck.error;
    }

    const matchedSourceRecord =
      (context.custom.weatherMatchedSourceRecord as
        | ReturnType<PlayerLookup["findSourceRecord"]>
        | undefined) ??
      (locationLookupValue
        ? players.findSourceRecord(locationLookupValue)
        : undefined);

    if (!latlon && locationLookupValue) {
      const match = matchedSourceRecord
        ? players.findPlayer(locationLookupValue)
        : undefined;

      if (!match) {
        return new Response(
          `Unknown player query parameter: ${locationLookupValue}`,
          {
            status: 404,
          },
        );
      }

      latlon = `${match.latitude},${match.longitude}`;
    }

    if (!latlon) {
      return new Response(
        "Missing required query parameter: latlon, player, or resource_id",
        {
          status: 400,
        },
      );
    }

    const cleanCoords = latlon.trim();
    const [rawLat, rawLon] = cleanCoords.split(",");

    if (
      !rawLat ||
      !rawLon ||
      Number.isNaN(Number(rawLat)) ||
      Number.isNaN(Number(rawLon))
    ) {
      return new Response(
        "Invalid latlon query parameter. Expected format: latlon=32.46564,12.8737874",
        {
          status: 400,
        },
      );
    }

    const lat = parseFloat(rawLat).toFixed(3);
    const lon = parseFloat(rawLon).toFixed(3);

    const newUrl = new URL(
      `https://api.openweathermap.org/data/2.5/weather?appid=${openWeatherApiKey}&units=metric`,
    );
    newUrl.searchParams.set("lat", lat);
    newUrl.searchParams.set("lon", lon);

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
    const cacheVersion = await getCacheVersion(cacheNamespace, context);

    if (locationLookupValue) {
      const match = players.findPlayer(locationLookupValue);
      const sourceRecord = players.findSourceRecord(locationLookupValue);

      if (!match) {
        return request;
      }

      context.custom.weatherMatchedSourceRecord = sourceRecord;

      url.searchParams.set(
        "latlon",
        `${match.latitude.toFixed(3)},${match.longitude.toFixed(3)}`,
      );
      url.searchParams.set("cacheVersion", cacheVersion);
      clearPlayerLookupParams(url.searchParams);

      return new ZuploRequest(url, request);
    }

    if (!latlon) {
      return request;
    }

    const [rawLat, rawLon] = latlon.trim().split(",");

    if (
      !rawLat ||
      !rawLon ||
      Number.isNaN(Number(rawLat)) ||
      Number.isNaN(Number(rawLon))
    ) {
      return request;
    }

    url.searchParams.set(
      "latlon",
      `${parseFloat(rawLat).toFixed(3)},${parseFloat(rawLon).toFixed(3)}`,
    );
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
