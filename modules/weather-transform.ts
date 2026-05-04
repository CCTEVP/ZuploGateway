import {
  ConfigurationError,
  environment,
  ZuploContext,
  ZuploRequest,
} from "@zuplo/runtime";
import {
  findPlayerLocation,
  findPlayerLocationSourceRecord,
} from "./player-location-data";

function maskValue(value: string) {
  return "*".repeat(value.length);
}

export default async function (request: ZuploRequest, context: ZuploContext) {
  const openWeatherApiKey = environment.OPENWEATHER_API_KEY;

  if (!openWeatherApiKey) {
    throw new ConfigurationError(
      "OPENWEATHER_API_KEY environment variable isn't configured",
    );
  }

  const url = new URL(request.url);
  let latlon = url.searchParams.get("latlon");
  const debug = url.searchParams.get("debug");
  const format = url.searchParams.get("format")?.toLowerCase();
  const player = url.searchParams.get("player")?.trim();
  const resourceId = url.searchParams
    .get("com.broadsign.suite.bsp.resource_id")
    ?.trim();
  const locationLookupValue = player || resourceId;
  const showDebug = debug === "true";
  const returnJson = format === "json";

  if (format && !returnJson) {
    return new Response(
      "Invalid format query parameter. The only supported value is format=json.",
      {
        status: 400,
      },
    );
  }

  const matchedSourceRecord = (context.custom.weatherMatchedSourceRecord ??
    (locationLookupValue
      ? findPlayerLocationSourceRecord(locationLookupValue)
      : undefined)) as ReturnType<typeof findPlayerLocationSourceRecord>;

  if (!latlon && locationLookupValue) {
    const match = matchedSourceRecord
      ? findPlayerLocation(locationLookupValue)
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
      "Missing required query parameter: latlon, player, or com.broadsign.suite.bsp.resource_id",
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

  const responseBody = returnJson
    ? JSON.stringify(payload)
    : `data = ${JSON.stringify(payload)};`;

  headers.set(
    "content-type",
    returnJson
      ? "application/json; charset=utf-8"
      : "application/javascript; charset=utf-8",
  );
  headers.delete("content-length");

  return new Response(responseBody, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers,
  });
}
