import { ZuploContext, ZuploRequest, ZoneCache } from "@zuplo/runtime";

const WEATHER_CACHE_NAMESPACE = "weather-cache";
const WEATHER_CACHE_VERSION_KEY = "version";
const WEATHER_CACHE_VERSION_TTL_SECONDS = 60 * 60 * 24 * 365;

export default async function (request: ZuploRequest, context: ZuploContext) {
  const cache = new ZoneCache<string>(WEATHER_CACHE_NAMESPACE, context);
  const version = Date.now().toString();

  await cache.put(
    WEATHER_CACHE_VERSION_KEY,
    version,
    WEATHER_CACHE_VERSION_TTL_SECONDS,
  );

  return Response.json({
    cache: "weather",
    reset: true,
    version,
  });
}
