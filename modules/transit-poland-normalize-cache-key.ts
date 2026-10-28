import { ZuploContext, ZuploRequest } from "@zuplo/runtime";
import { getCacheVersion } from "./cache-version";
import {
  clearPlayerLookupParams,
  getPlayerLookupValue,
} from "./player-query-params";
import { polandPlayers } from "./players/poland";
import {
  getStopsParam,
  INCLUDE_QUERY_PARAM,
  normalizeStopsForCache,
  parseIncludeParam,
  parseLimitParam,
  parseWindowParam,
  STOPS_QUERY_PARAM,
} from "./transit-query-params";

export const TRANSIT_POLAND_CACHE_NAMESPACE = "transit-poland-cache";

export default async function (request: ZuploRequest, context: ZuploContext) {
  const url = new URL(request.url);
  const directStops = getStopsParam(url.searchParams);
  const playerLookupValue = getPlayerLookupValue(url.searchParams);
  const limit = parseLimitParam(url.searchParams.get("limit"));
  const window = parseWindowParam(url.searchParams.get("window"));
  const include = parseIncludeParam(url.searchParams.get(INCLUDE_QUERY_PARAM));

  // Leave conflicting, incomplete or invalid requests untouched so the
  // handler returns the standard error responses.
  if (
    (directStops.length && playerLookupValue) ||
    limit === undefined ||
    window === undefined ||
    include === undefined
  ) {
    return request;
  }

  let stops = directStops;

  if (playerLookupValue) {
    const match = polandPlayers.findPlayer(playerLookupValue);
    if (!match?.stops?.length) {
      return request;
    }
    context.custom.transitMatchedSourceRecord =
      polandPlayers.findSourceRecord(playerLookupValue);
    stops = match.stops;
  }

  if (!stops.length) {
    return request;
  }

  // Players sharing the same stops share one cache entry.
  url.searchParams.set(STOPS_QUERY_PARAM, normalizeStopsForCache(stops));
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("window", String(window));
  if (include.length) {
    url.searchParams.set(INCLUDE_QUERY_PARAM, include.join(","));
  } else {
    url.searchParams.delete(INCLUDE_QUERY_PARAM);
  }
  url.searchParams.set(
    "cacheVersion",
    await getCacheVersion(TRANSIT_POLAND_CACHE_NAMESPACE, context),
  );
  clearPlayerLookupParams(url.searchParams);

  return new ZuploRequest(url, request);
}
