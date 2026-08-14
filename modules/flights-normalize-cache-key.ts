import { ZuploContext, ZuploRequest } from "@zuplo/runtime";
import { AVINOR_DEFAULTS, normalizeDirectionParam } from "./avinor-xml";
import { getCacheVersion } from "./cache-version";
import {
  getGatesParam,
  getIataParam,
  setNormalizedGatesParam,
} from "./flights-query-params";
import {
  getPlayerLookupValue,
  clearPlayerLookupParams,
} from "./player-query-params";
import { norwayPlayers } from "./players/norway";

const FLIGHTS_CACHE_NAMESPACE = "flights-norway-cache";

export default async function (request: ZuploRequest, context: ZuploContext) {
  const url = new URL(request.url);
  const gates = getGatesParam(url.searchParams);
  const playerLookupValue = getPlayerLookupValue(url.searchParams);
  const cacheVersion = await getCacheVersion(FLIGHTS_CACHE_NAMESPACE, context);

  // Leave conflicting or incomplete requests untouched so the handler returns
  // the standard error responses (and so we do not cache error paths).
  if (gates && playerLookupValue) {
    return request;
  }

  if (playerLookupValue) {
    const match = norwayPlayers.findPlayer(playerLookupValue);
    const sourceRecord = norwayPlayers.findSourceRecord(playerLookupValue);

    if (!match || (!match.allGates && !match.gates?.length)) {
      return request;
    }

    context.custom.flightsMatchedSourceRecord = sourceRecord;

    const iata =
      match.iata || getIataParam(url.searchParams) || AVINOR_DEFAULTS.airport;
    const direction = normalizeDirectionParam(url.searchParams.get("direction"));

    setNormalizedGatesParam(
      url.searchParams,
      match.allGates ? "*" : (match.gates ?? []).join(","),
    );
    url.searchParams.set("iata", iata);
    url.searchParams.delete("airport");
    url.searchParams.set("direction", direction);
    url.searchParams.set("cacheVersion", cacheVersion);
    clearPlayerLookupParams(url.searchParams);

    return new ZuploRequest(url, request);
  }

  if (!gates) {
    return request;
  }

  const iata = getIataParam(url.searchParams) || AVINOR_DEFAULTS.airport;
  const direction = normalizeDirectionParam(url.searchParams.get("direction"));

  setNormalizedGatesParam(url.searchParams, gates);
  url.searchParams.set("iata", iata);
  url.searchParams.delete("airport");
  url.searchParams.set("direction", direction);
  url.searchParams.set("cacheVersion", cacheVersion);
  clearPlayerLookupParams(url.searchParams);

  return new ZuploRequest(url, request);
}
