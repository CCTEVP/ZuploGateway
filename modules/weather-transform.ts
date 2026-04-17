import {
  ConfigurationError,
  environment,
  ZuploContext,
  ZuploRequest,
} from "@zuplo/runtime";

const openWeatherApiKey = environment.OPENWEATHER_API_KEY;

if (!openWeatherApiKey) {
  throw new ConfigurationError(
    "OPENWEATHER_API_KEY environment variable isn't configured",
  );
}

export default async function (request: ZuploRequest, context: ZuploContext) {
  const url = new URL(request.url);

  const latlon = url.searchParams.get("latlon");

  if (!latlon) {
    return new Response("Missing required query parameter: latlon", {
      status: 400,
    });
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
  const payload = {
    ...(weather as Record<string, unknown>),
    timestamp: timestamp
      ? new Date(timestamp).toISOString()
      : new Date().toISOString(),
  };

  headers.set("content-type", "application/json; charset=utf-8");
  headers.delete("content-length");

  return Response.json(payload, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers,
  });
}
