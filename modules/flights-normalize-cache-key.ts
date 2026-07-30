import { ZuploContext, ZuploRequest } from "@zuplo/runtime";
import { AVINOR_DEFAULTS } from "./avinor-xml";
import { getCacheVersion } from "./cache-version";
import { norwayPlayers } from "./players/norway";

const FLIGHTS_CACHE_NAMESPACE = "flights-norway-cache";

function getIataOverride(url: URL) {
  return (
    url.searchParams.get("iata")?.trim().toUpperCase() ||
    url.searchParams.get("airport")?.trim().toUpperCase() ||
    undefined
  );
}

export default async function (request: ZuploRequest, context: ZuploContext) {
  const url = new URL(request.url);
  const player = url.searchParams.get("player")?.trim();
  const resourceId = url.searchParams
    .get("com.broadsign.suite.bsp.resource_id")
    ?.trim();
  const gate = url.searchParams.get("gate")?.trim();
  const playerLookupValue = player || resourceId;
  const cacheVersion = await getCacheVersion(FLIGHTS_CACHE_NAMESPACE, context);

  // Leave conflicting or incomplete requests untouched so the handler returns
  // the standard error responses (and so we do not cache error paths).
  if (gate && playerLookupValue) {
    return request;
  }

  if (playerLookupValue) {
    const match = norwayPlayers.findPlayer(playerLookupValue);
    const sourceRecord = norwayPlayers.findSourceRecord(playerLookupValue);

    if (!match || !match.gate) {
      return request;
    }

    context.custom.flightsMatchedSourceRecord = sourceRecord;

    const iata =
      match.iata || getIataOverride(url) || AVINOR_DEFAULTS.airport;
    const direction =
      url.searchParams.get("direction")?.trim().toUpperCase() ||
      AVINOR_DEFAULTS.direction;

    url.searchParams.set("gate", match.gate);
    url.searchParams.set("iata", iata);
    url.searchParams.delete("airport");
    url.searchParams.set("direction", direction);
    url.searchParams.set("cacheVersion", cacheVersion);
    url.searchParams.delete("player");
    url.searchParams.delete("com.broadsign.suite.bsp.resource_id");

    return new ZuploRequest(url, request);
  }

  if (!gate) {
    return request;
  }

  const iata = getIataOverride(url) || AVINOR_DEFAULTS.airport;
  const direction =
    url.searchParams.get("direction")?.trim().toUpperCase() ||
    AVINOR_DEFAULTS.direction;

  url.searchParams.set("gate", gate);
  url.searchParams.set("iata", iata);
  url.searchParams.delete("airport");
  url.searchParams.set("direction", direction);
  url.searchParams.set("cacheVersion", cacheVersion);
  url.searchParams.delete("player");
  url.searchParams.delete("com.broadsign.suite.bsp.resource_id");

  return new ZuploRequest(url, request);
}
