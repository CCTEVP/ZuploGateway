import { environment, ZuploContext, ZuploRequest } from "@zuplo/runtime";
import {
  buildTransitDepartures,
  fetchOdtDepartures,
  ODT_DEFAULTS,
  OdtUpstreamError,
  toCompactDeparture,
} from "./odt-planner";
import { getPlayerLookupValue } from "./player-query-params";
import { polandPlayers } from "./players/poland";
import type { PlayerSourceRecord } from "./players/types";
import {
  buildFormattedResponse,
  buildStandardErrorResponse,
} from "./response-format";
import {
  getStopsParam,
  INCLUDE_QUERY_PARAM,
  parseIncludeParam,
  parseLimitParam,
  parseWindowParam,
} from "./transit-query-params";

export default async function (request: ZuploRequest, context: ZuploContext) {
  const url = new URL(request.url);
  const format = url.searchParams.get("format");
  const filter = url.searchParams.get("filter");
  const showDebug = url.searchParams.get("debug") === "true";

  const directStops = getStopsParam(url.searchParams);
  const playerLookupValue = getPlayerLookupValue(url.searchParams);
  const limit = parseLimitParam(url.searchParams.get("limit"));
  const window = parseWindowParam(url.searchParams.get("window"));
  const include = parseIncludeParam(url.searchParams.get(INCLUDE_QUERY_PARAM));
  const compact = filter?.toLowerCase() !== "false";

  if (directStops.length && playerLookupValue) {
    return buildStandardErrorResponse({
      format,
      error: "stops_and_player_conflict",
      message:
        "Direct stops lookup and player/resource_id lookup are mutually exclusive. Provide either stops or player/resource_id, not both.",
    });
  }

  if (!directStops.length && !playerLookupValue) {
    return buildStandardErrorResponse({
      format,
      error: "missing_required_parameter",
      message:
        "Missing required query parameter: provide player/resource_id or stops. Example: ?player=963988113 or ?stops=plk:80416_RAIL_3_2.",
    });
  }

  if (limit === undefined) {
    return buildStandardErrorResponse({
      format,
      error: "invalid_limit",
      message: `Invalid limit query parameter. Provide an integer from 1 to ${ODT_DEFAULTS.maxLimit}.`,
    });
  }

  if (window === undefined) {
    return buildStandardErrorResponse({
      format,
      error: "invalid_window",
      message: `Invalid window query parameter. Provide minutes from 1 to ${ODT_DEFAULTS.maxWindow}.`,
    });
  }

  if (include === undefined) {
    return buildStandardErrorResponse({
      format,
      error: "invalid_include",
      message:
        "Invalid include query parameter. The only supported value is include=terminating.",
    });
  }

  let stops = directStops;
  let matchedSourceRecord = context.custom.transitMatchedSourceRecord as
    | PlayerSourceRecord
    | undefined;

  if (playerLookupValue) {
    matchedSourceRecord =
      matchedSourceRecord ?? polandPlayers.findSourceRecord(playerLookupValue);
    const match = polandPlayers.findPlayer(playerLookupValue);

    if (!match) {
      return buildStandardErrorResponse({
        format,
        error: "unknown_player",
        message: `Unknown player query parameter: ${playerLookupValue}`,
        status: 404,
      });
    }

    if (!match.stops?.length) {
      return buildStandardErrorResponse({
        format,
        error: "player_has_no_stops",
        message: `Player ${playerLookupValue} does not have transit stops configured.`,
      });
    }

    stops = match.stops;
  }

  const apiKey = environment.ODT_API_KEY || undefined;
  const now = Date.now();

  let upstreamUrl: URL;
  let departures;
  try {
    const result = await fetchOdtDepartures(stops, { limit, window, apiKey });
    upstreamUrl = result.url;
    departures = await buildTransitDepartures(result.body.departures ?? [], {
      limit,
      now,
      includeTerminating: include.includes("terminating"),
      apiKey,
    });
  } catch (error) {
    if (!(error instanceof OdtUpstreamError)) {
      throw error;
    }
    const response = buildStandardErrorResponse({
      format,
      error:
        error.status === 400
          ? "invalid_stop"
          : error.status === 503
            ? "upstream_rate_limited"
            : "upstream_error",
      message:
        error.status === 400
          ? `The ODT planner rejected the stop ID(s): ${stops.join(", ")}`
          : error.message,
      status: error.status,
    });
    if (error.retryAfter) {
      response.headers.set("retry-after", error.retryAfter);
    }
    return response;
  }

  const payload: Record<string, unknown> = {
    stops,
    // Default (filtered) responses carry only what a countdown needs;
    // filter=false returns every field.
    next: departures[0] ?? null,
    departures: compact ? departures.map(toCompactDeparture) : departures,
    attribution: ODT_DEFAULTS.attribution,
    timestamp: new Date(now).toISOString(),
    ...(showDebug
      ? {
          debug: {
            original: upstreamUrl.toString(),
            limit,
            window,
            include,
            apiKey: Boolean(apiKey),
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
  });
}
