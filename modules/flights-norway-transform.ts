import { ZuploContext, ZuploRequest } from "@zuplo/runtime";
import {
  AVINOR_DEFAULTS,
  fetchAvinorFlights,
  filterFlightsByGate,
} from "./avinor-xml";
import { norwayPlayers } from "./players/norway";
import type { PlayerSourceRecord } from "./players/types";
import {
  buildFormattedResponse,
  buildStandardErrorResponse,
} from "./response-format";

function getPlayerLookupValue(url: URL) {
  const player = url.searchParams.get("player")?.trim();
  const resourceId = url.searchParams
    .get("com.broadsign.suite.bsp.resource_id")
    ?.trim();
  return player || resourceId || undefined;
}

function getIataOverride(url: URL) {
  return (
    url.searchParams.get("iata")?.trim().toUpperCase() ||
    url.searchParams.get("airport")?.trim().toUpperCase() ||
    undefined
  );
}

export default async function (request: ZuploRequest, context: ZuploContext) {
  const url = new URL(request.url);
  const format = url.searchParams.get("format");
  const filter = url.searchParams.get("filter");
  const debug = url.searchParams.get("debug");
  const showDebug = debug === "true";

  const gateParam = url.searchParams.get("gate")?.trim();
  const playerLookupValue = getPlayerLookupValue(url);
  const directionParam = url.searchParams.get("direction")?.trim().toUpperCase();
  const iataOverride = getIataOverride(url);

  if (gateParam && playerLookupValue) {
    return buildStandardErrorResponse({
      format,
      error: "gate_and_player_conflict",
      message:
        "The gate and player parameters are mutually exclusive. Provide either gate or player, not both.",
    });
  }

  if (!gateParam && !playerLookupValue) {
    return buildStandardErrorResponse({
      format,
      error: "missing_required_parameter",
      message:
        "Missing required query parameter: gate, player, or com.broadsign.suite.bsp.resource_id",
    });
  }

  if (directionParam && directionParam !== "A" && directionParam !== "D") {
    return buildStandardErrorResponse({
      format,
      error: "invalid_direction",
      message: "Invalid direction query parameter. Supported values are A or D.",
    });
  }

  let gate = gateParam;
  let iata = iataOverride || AVINOR_DEFAULTS.airport;
  let matchedSourceRecord = context.custom.flightsMatchedSourceRecord as
    | PlayerSourceRecord
    | undefined;

  if (playerLookupValue) {
    matchedSourceRecord =
      matchedSourceRecord ?? norwayPlayers.findSourceRecord(playerLookupValue);
    const match = norwayPlayers.findPlayer(playerLookupValue);

    if (!match) {
      return buildStandardErrorResponse({
        format,
        error: "unknown_player",
        message: `Unknown player query parameter: ${playerLookupValue}`,
        status: 404,
      });
    }

    if (!match.gate) {
      return buildStandardErrorResponse({
        format,
        error: "player_has_no_gate",
        message: `Player ${playerLookupValue} does not have gate information configured.`,
      });
    }

    gate = match.gate;
    iata = match.iata || iataOverride || AVINOR_DEFAULTS.airport;
  }

  const direction = directionParam || AVINOR_DEFAULTS.direction;

  const {
    url: upstreamUrl,
    status,
    statusText,
    headers: upstreamHeaders,
    feed,
  } = await fetchAvinorFlights({
    airport: iata,
    direction,
  });

  const flights = filterFlightsByGate(feed.flights, gate!);
  const timestamp = upstreamHeaders.get("date");

  const payload: Record<string, unknown> = {
    iata,
    airportCode: iata,
    direction,
    gate,
    flights,
    attribution: AVINOR_DEFAULTS.attribution,
    timestamp: timestamp
      ? new Date(timestamp).toISOString()
      : new Date().toISOString(),
    ...(showDebug
      ? {
          debug: {
            original: upstreamUrl.toString(),
            lastUpdate: feed.lastUpdate,
            airportName: feed.airportName,
            totalFlights: feed.flights.length,
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
    status,
    statusText,
    headers: new Headers(upstreamHeaders),
  });
}
