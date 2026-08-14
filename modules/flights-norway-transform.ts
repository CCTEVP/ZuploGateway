import { ZuploContext, ZuploRequest } from "@zuplo/runtime";
import {
  AVINOR_DEFAULTS,
  fetchAvinorFlights,
  filterFlightsByGate,
  isValidDirectionParam,
  normalizeDirectionParam,
} from "./avinor-xml";
import {
  gatesFilterFromParam,
  getGatesParam,
  getIataParam,
} from "./flights-query-params";
import { norwayPlayers } from "./players/norway";
import type { PlayerSourceRecord } from "./players/types";
import { getPlayerLookupValue } from "./player-query-params";
import {
  buildFormattedResponse,
  buildStandardErrorResponse,
} from "./response-format";

export default async function (request: ZuploRequest, context: ZuploContext) {
  const url = new URL(request.url);
  const format = url.searchParams.get("format");
  const filter = url.searchParams.get("filter");
  const debug = url.searchParams.get("debug");
  const showDebug = debug === "true";

  const gatesParam = getGatesParam(url.searchParams);
  const playerLookupValue = getPlayerLookupValue(url.searchParams);
  const directionParam = normalizeDirectionParam(
    url.searchParams.get("direction"),
  );
  const iataOverride = getIataParam(url.searchParams);

  if (gatesParam && playerLookupValue) {
    return buildStandardErrorResponse({
      format,
      error: "gate_and_player_conflict",
      message:
        "Direct iata/gates lookup and player/resource_id lookup are mutually exclusive. Provide either iata+gates or player/resource_id, not both.",
    });
  }

  if (!gatesParam && !playerLookupValue) {
    return buildStandardErrorResponse({
      format,
      error: "missing_required_parameter",
      message:
        "Missing required query parameter: provide player/resource_id, or gates (with optional iata; defaults to OSL). Example: ?gates=D9&iata=OSL",
    });
  }

  if (gatesParam && !gatesFilterFromParam(gatesParam)) {
    return buildStandardErrorResponse({
      format,
      error: "invalid_gate",
      message:
        "Invalid gates query parameter. Provide a gate code, comma-separated gate list, or * for all gates.",
    });
  }

  if (!isValidDirectionParam(url.searchParams.get("direction"))) {
    return buildStandardErrorResponse({
      format,
      error: "invalid_direction",
      message:
        "Invalid direction query parameter. Supported values are A, D, or AD.",
    });
  }

  let gate: string | string[] | undefined = gatesFilterFromParam(gatesParam);
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

    if (!match.allGates && !match.gates?.length) {
      return buildStandardErrorResponse({
        format,
        error: "player_has_no_gate",
        message: `Player ${playerLookupValue} does not have gate information configured.`,
      });
    }

    gate = match.allGates ? "*" : match.gates;
    iata = match.iata || iataOverride || AVINOR_DEFAULTS.airport;
  }

  const direction = directionParam;

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

  const flights = filterFlightsByGate(feed.flights, gate);
  const timestamp = upstreamHeaders.get("date");

  const payload: Record<string, unknown> = {
    iata,
    airportCode: iata,
    direction,
    gates: Array.isArray(gate) && gate.length === 1 ? gate[0] : gate,
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
