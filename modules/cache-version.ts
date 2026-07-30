import { ZuploContext, ZoneCache } from "@zuplo/runtime";

const CACHE_VERSION_KEY = "version";
const CACHE_VERSION_TTL_SECONDS = 60 * 60 * 24 * 365;

export async function getCacheVersion(
  namespace: string,
  context: ZuploContext,
): Promise<string> {
  const cache = new ZoneCache<string>(namespace, context);
  return (await cache.get(CACHE_VERSION_KEY)) ?? "0";
}

export async function bumpCacheVersion(
  namespace: string,
  context: ZuploContext,
): Promise<string> {
  const cache = new ZoneCache<string>(namespace, context);
  const version = Date.now().toString();

  await cache.put(CACHE_VERSION_KEY, version, CACHE_VERSION_TTL_SECONDS);

  return version;
}
