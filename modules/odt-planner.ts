/**
 * Client for the Open Transport Data (ODT) journey planner API.
 * The planner merges GTFS timetables with the GTFS-RT feeds ODT collects, so
 * departures already carry realtime estimates.
 * Docs: https://api.odt.org.pl/api/planner/v1/docs/
 */

const ODT_PLANNER_BASE = "https://api.odt.org.pl/api/planner/v1";
const UPSTREAM_TIMEOUT_MS = 8000;

export const ODT_DEFAULTS = {
  limit: 3,
  maxLimit: 10,
  window: 120,
  maxWindow: 720,
  attribution: {
    text: "Transit data from Open Transport Data (ODT)",
    url: "https://odt.org.pl",
  },
} as const;

type OdtTime = {
  scheduled: string | null;
  estimated: string | null;
  delay_s: number | null;
};

export type OdtDeparture = {
  stop_id: string;
  platform: string | null;
  route: {
    id: string;
    short_name: string | null;
    long_name: string | null;
    mode: string;
    color: string | null;
    text_color: string | null;
    agency: { id: string; name: string };
  };
  trip_id: string;
  service_date: string;
  headsign: string | null;
  scheduled: string;
  estimated: string | null;
  delay_s: number | null;
  realtime: boolean;
  status: string;
};

type OdtTrip = {
  id: string;
  calls?: {
    stop: { id: string; name?: string; platform?: string | null };
    arrival?: OdtTime | null;
    departure?: OdtTime | null;
  }[];
};

/** Upstream failure with the HTTP status to report to the client. */
export class OdtUpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfter?: string,
  ) {
    super(message);
  }
}

async function odtGet<T>(
  path: string,
  params: [string, string][],
  apiKey: string | undefined,
): Promise<{ url: URL; body: T }> {
  const url = new URL(`${ODT_PLANNER_BASE}${path}`);
  for (const [key, value] of params) {
    url.searchParams.append(key, value);
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        accept: "application/json",
        ...(apiKey ? { "X-API-Key": apiKey } : {}),
      },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    throw new OdtUpstreamError(
      `ODT planner request failed: ${(error as Error).message}`,
      504,
    );
  }

  if (response.status === 429) {
    throw new OdtUpstreamError(
      "ODT planner rate limit reached",
      503,
      response.headers.get("retry-after") ?? undefined,
    );
  }

  if (!response.ok) {
    throw new OdtUpstreamError(
      `ODT planner returned ${response.status} for ${path}`,
      // Invalid stop IDs come back as 400 from the planner.
      response.status === 400 ? 400 : 502,
    );
  }

  return { url, body: (await response.json()) as T };
}

export function fetchOdtDepartures(
  stops: string[],
  options: { limit: number; window: number; apiKey?: string },
) {
  return odtGet<{ departures?: OdtDeparture[] }>(
    "/stop/departures/",
    [
      ...stops.map((stop): [string, string] => ["id", stop]),
      // Over-fetch: departed, canceled and terminating trips are dropped below.
      ["limit", String(Math.min(options.limit * 3 + 5, 50))],
      ["window", String(options.window)],
    ],
    options.apiKey,
  );
}

export function fetchOdtTrip(
  tripId: string,
  serviceDate: string,
  apiKey?: string,
) {
  return odtGet<OdtTrip>(
    "/trip/",
    [
      ["id", tripId],
      ["date", serviceDate],
    ],
    apiKey,
  );
}

function toMs(value: string | null | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? undefined : ms;
}

/**
 * Find this departure's call in the trip (a trip can pass a stop twice) and
 * whether it is the trip's first or last call.
 */
function findCall(trip: OdtTrip, departure: OdtDeparture) {
  const calls = trip.calls ?? [];
  const matches = calls
    .map((call, index) => ({ call, index }))
    .filter(({ call }) => call.stop.id === departure.stop_id);
  const match =
    matches.find(
      ({ call }) => call.departure?.scheduled === departure.scheduled,
    ) ?? matches[0];

  return match
    ? {
        call: match.call,
        startsHere: match.index === 0,
        terminatesHere: match.index === calls.length - 1,
      }
    : undefined;
}

export type TransitDeparture = {
  line: string | null;
  mode: string;
  operator: string;
  headsign: string | null;
  stopId: string;
  platform: string | null;
  color: string | null;
  textColor: string | null;
  /** Arrival used for the countdown: estimated, else scheduled, else departure. */
  arrival: string;
  /** Departure used for the countdown: estimated, else scheduled. */
  departure: string;
  scheduledArrival: string | null;
  estimatedArrival: string | null;
  scheduledDeparture: string;
  estimatedDeparture: string | null;
  delaySeconds: number | null;
  realtime: boolean;
  status: string;
  /**
   * Trip starts at this stop (an already-parked train is only detected when
   * the realtime feed gives an arrival). Null when the trip could not be loaded.
   */
  startsHere: boolean | null;
  /** Trip ends at this stop (an arrival only; passengers cannot board). */
  terminatesHere: boolean | null;
  /** True when the vehicle has arrived and not yet departed. */
  atPlatform: boolean;
  /** Seconds until arrival at the platform; 0 when already at the platform. */
  remainingSeconds: number;
  /** Seconds until departure from the platform. */
  departsInSeconds: number;
  tripId: string;
};

/** Fields kept in the default (filtered) response: enough for a countdown. */
export type CompactTransitDeparture = Pick<
  TransitDeparture,
  | "line"
  | "headsign"
  | "platform"
  | "arrival"
  | "departure"
  | "realtime"
  | "atPlatform"
  | "remainingSeconds"
>;

export function toCompactDeparture(
  departure: TransitDeparture,
): CompactTransitDeparture {
  return {
    line: departure.line,
    headsign: departure.headsign,
    platform: departure.platform,
    arrival: departure.arrival,
    departure: departure.departure,
    realtime: departure.realtime,
    atPlatform: departure.atPlatform,
    remainingSeconds: departure.remainingSeconds,
  };
}

function toTransitDeparture(
  departure: OdtDeparture,
  departureMs: number,
  trip: OdtTrip | undefined,
  now: number,
): TransitDeparture {
  const found = trip ? findCall(trip, departure) : undefined;
  const arrival = found?.call.arrival;
  const arrivalMs =
    toMs(arrival?.estimated) ?? toMs(arrival?.scheduled) ?? departureMs;
  const atPlatform = arrivalMs <= now && now < departureMs;

  return {
    line: departure.route.short_name ?? departure.route.long_name,
    mode: departure.route.mode,
    operator: departure.route.agency.name,
    headsign: departure.headsign,
    stopId: departure.stop_id,
    platform: departure.platform,
    color: departure.route.color,
    textColor: departure.route.text_color,
    arrival: new Date(arrivalMs).toISOString(),
    departure: new Date(departureMs).toISOString(),
    scheduledArrival: arrival?.scheduled ?? null,
    estimatedArrival: arrival?.estimated ?? null,
    scheduledDeparture: departure.scheduled,
    estimatedDeparture: departure.estimated,
    delaySeconds: departure.delay_s,
    realtime: departure.realtime,
    status: departure.status,
    startsHere: found?.startsHere ?? null,
    terminatesHere: found?.terminatesHere ?? null,
    atPlatform,
    remainingSeconds: atPlatform
      ? 0
      : Math.max(0, Math.round((arrivalMs - now) / 1000)),
    departsInSeconds: Math.max(0, Math.round((departureMs - now) / 1000)),
    tripId: departure.trip_id,
  };
}

/**
 * Turn planner departures into countdowns. Arrival times come from the trip
 * call at this stop; "at platform" is inferred from realtime (or scheduled)
 * arrival <= now < departure, since ODT has no rail vehicle positions.
 * Trips that end at the stop are skipped unless `includeTerminating` is set;
 * trips are loaded in batches until `limit` departures are kept.
 */
export async function buildTransitDepartures(
  departures: OdtDeparture[],
  options: {
    limit: number;
    now: number;
    includeTerminating: boolean;
    apiKey?: string;
  },
): Promise<TransitDeparture[]> {
  const upcoming = departures
    .filter((departure) => departure.status !== "canceled")
    .map((departure) => ({
      departure,
      departureMs:
        toMs(departure.estimated) ?? toMs(departure.scheduled) ?? Infinity,
    }))
    .filter(({ departureMs }) => departureMs > options.now)
    .sort((a, b) => a.departureMs - b.departureMs);

  const result: TransitDeparture[] = [];

  for (
    let start = 0;
    start < upcoming.length && result.length < options.limit;
    start += options.limit
  ) {
    const batch = upcoming.slice(start, start + options.limit);
    const trips = await Promise.all(
      batch.map(({ departure }) =>
        fetchOdtTrip(departure.trip_id, departure.service_date, options.apiKey)
          .then(({ body }) => body)
          // Without the trip we still have the departure time; skip arrival.
          .catch(() => undefined),
      ),
    );

    batch.forEach(({ departure, departureMs }, i) => {
      const item = toTransitDeparture(
        departure,
        departureMs,
        trips[i],
        options.now,
      );
      if (options.includeTerminating || item.terminatesHere !== true) {
        result.push(item);
      }
    });
  }

  return result.slice(0, options.limit);
}
