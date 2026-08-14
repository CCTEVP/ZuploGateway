export type AvinorFlightStatus = {
  code?: string;
  time?: string;
};

export type AvinorFlight = {
  uniqueId?: string;
  flightId?: string;
  airline?: string;
  domInt?: string;
  scheduleTime?: string;
  arrDep?: string;
  /** Counterpart airport IATA (origin for arrivals, destination for departures). */
  airport?: string;
  /** City/airport display name for `airport`, from Avinor airportNames. */
  airportName?: string;
  viaAirport?: string;
  checkIn?: string;
  gate?: string;
  beltNumber?: string;
  delayed?: string;
  status?: AvinorFlightStatus;
};

export type AvinorFeedResult = {
  airportName?: string;
  lastUpdate?: string;
  flights: AvinorFlight[];
};

const AVINOR_XML_FEED_BASE = "https://asrv.avinor.no/XmlFeed/v1.0";
const AVINOR_AIRPORT_NAMES_URL = "https://asrv.avinor.no/airportNames/v1.0";
const DEFAULT_AIRPORT = "OSL";
const DEFAULT_DIRECTION = "AD";
const DEFAULT_TIME_FROM = "1";
const DEFAULT_TIME_TO = "7";

let airportNameCache: Record<string, string> | undefined;
let airportNameCacheLoadedAt = 0;
const AIRPORT_NAME_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type AvinorFeedOptions = {
  airport?: string;
  /** A = arrivals, D = departures, AD = both (fetches and merges A + D). */
  direction?: string;
  timeFrom?: string;
  timeTo?: string;
};

export function normalizeDirectionParam(
  value: string | null | undefined,
): string {
  const normalized = (value?.trim() || DEFAULT_DIRECTION).toUpperCase();
  if (normalized === "A" || normalized === "D" || normalized === "AD") {
    return normalized;
  }
  return normalized;
}

export function isValidDirectionParam(value: string | null | undefined): boolean {
  if (value == null || value.trim() === "") {
    return true;
  }
  const normalized = value.trim().toUpperCase();
  return normalized === "A" || normalized === "D" || normalized === "AD";
}

function getElementText(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, "i"));
  return match?.[1]?.trim() || undefined;
}

function getAttribute(xml: string, attr: string): string | undefined {
  const match = xml.match(new RegExp(`\\b${attr}="([^"]*)"`, "i"));
  return match?.[1]?.trim() || undefined;
}

/**
 * Avinor XML is declared/served as ISO-8859-1. `response.text()` would decode
 * as UTF-8 and corrupt Norwegian characters (æ/ø/å).
 */
export async function readAvinorXml(response: Response): Promise<string> {
  const buffer = await response.arrayBuffer();
  return new TextDecoder("iso-8859-1").decode(buffer);
}

function parseFlightElement(flightXml: string): AvinorFlight {
  const statusMatch = flightXml.match(/<status\b[^/]*\/?>/i)?.[0];

  return {
    uniqueId: getAttribute(flightXml, "uniqueID"),
    airline: getElementText(flightXml, "airline"),
    flightId: getElementText(flightXml, "flight_id"),
    domInt: getElementText(flightXml, "dom_int"),
    scheduleTime: getElementText(flightXml, "schedule_time"),
    arrDep: getElementText(flightXml, "arr_dep"),
    airport: getElementText(flightXml, "airport"),
    viaAirport: getElementText(flightXml, "via_airport"),
    checkIn: getElementText(flightXml, "check_in"),
    gate: getElementText(flightXml, "gate"),
    beltNumber:
      getElementText(flightXml, "belt") ||
      getElementText(flightXml, "belt_number"),
    delayed: getElementText(flightXml, "delayed"),
    status: statusMatch
      ? {
          code: getAttribute(statusMatch, "code"),
          time: getAttribute(statusMatch, "time"),
        }
      : undefined,
  };
}

export function parseAvinorXmlFeed(xml: string): AvinorFeedResult {
  const airportName = getAttribute(xml, "name");
  const flightsBlock = xml.match(/<flights\b[^>]*>([\s\S]*?)<\/flights>/i);
  const lastUpdate = flightsBlock?.[0]
    ? getAttribute(flightsBlock[0], "lastUpdate")
    : undefined;
  const flightsXml = flightsBlock?.[1] ?? "";
  const flightMatches = flightsXml.match(/<flight\b[\s\S]*?<\/flight>/gi) ?? [];

  return {
    airportName,
    lastUpdate,
    flights: flightMatches.map(parseFlightElement),
  };
}

export function filterFlightsByGate(
  flights: AvinorFlight[],
  gate: string | string[] | undefined,
): AvinorFlight[] {
  if (gate == null) {
    return flights;
  }

  const gates = (Array.isArray(gate) ? gate : [gate])
    .flatMap((value) => String(value).split(","))
    .map((value) => value.trim().toUpperCase())
    .filter((value) => value && value !== "*");

  if (gates.length === 0) {
    return flights;
  }

  const allowed = new Set(gates);
  return flights.filter((flight) => {
    const flightGate = flight.gate?.trim().toUpperCase();
    return flightGate ? allowed.has(flightGate) : false;
  });
}

export function buildAvinorFeedUrl(options: AvinorFeedOptions = {}): URL {
  const url = new URL(AVINOR_XML_FEED_BASE);
  url.searchParams.set("airport", (options.airport ?? DEFAULT_AIRPORT).toUpperCase());
  const direction = normalizeDirectionParam(options.direction);
  url.searchParams.set(
    "direction",
    direction === "AD" ? "D" : direction,
  );
  url.searchParams.set("TimeFrom", options.timeFrom ?? DEFAULT_TIME_FROM);
  url.searchParams.set("TimeTo", options.timeTo ?? DEFAULT_TIME_TO);
  return url;
}

async function fetchAvinorFeedSingle(
  options: AvinorFeedOptions,
  airportNames: Record<string, string>,
): Promise<{
  url: URL;
  status: number;
  statusText: string;
  headers: Headers;
  feed: AvinorFeedResult;
}> {
  const url = buildAvinorFeedUrl(options);
  const response = await fetch(url.toString());
  const xml = await readAvinorXml(response);
  const feed = parseAvinorXmlFeed(xml);
  feed.flights = enrichFlightsWithAirportNames(feed.flights, airportNames);

  return {
    url,
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    feed,
  };
}

function mergeAvinorFeeds(
  arrivals: AvinorFeedResult,
  departures: AvinorFeedResult,
): AvinorFeedResult {
  const byId = new Map<string, AvinorFlight>();
  for (const flight of [...arrivals.flights, ...departures.flights]) {
    const key =
      flight.uniqueId ??
      `${flight.flightId ?? ""}:${flight.scheduleTime ?? ""}:${flight.arrDep ?? ""}`;
    if (!byId.has(key)) {
      byId.set(key, flight);
    }
  }

  const flights = [...byId.values()].sort((a, b) => {
    const aTime = a.scheduleTime ? Date.parse(a.scheduleTime) : 0;
    const bTime = b.scheduleTime ? Date.parse(b.scheduleTime) : 0;
    return aTime - bTime;
  });

  return {
    airportName: departures.airportName ?? arrivals.airportName,
    lastUpdate: departures.lastUpdate ?? arrivals.lastUpdate,
    flights,
  };
}

function parseAirportNamesXml(xml: string): Record<string, string> {
  const names: Record<string, string> = {};
  const matches = xml.match(/<airportName\b[^/]*\/?>/gi) ?? [];

  for (const tag of matches) {
    const code = getAttribute(tag, "code")?.toUpperCase();
    const name =
      getAttribute(tag, "shortname8") ||
      getAttribute(tag, "name") ||
      getAttribute(tag, "shortname15");
    if (code && name) {
      names[code] = name;
    }
  }

  return names;
}

export async function getAvinorAirportNames(): Promise<Record<string, string>> {
  const now = Date.now();
  if (
    airportNameCache &&
    now - airportNameCacheLoadedAt < AIRPORT_NAME_CACHE_TTL_MS
  ) {
    return airportNameCache;
  }

  const response = await fetch(AVINOR_AIRPORT_NAMES_URL);
  if (!response.ok) {
    return airportNameCache ?? {};
  }

  const xml = await readAvinorXml(response);
  airportNameCache = parseAirportNamesXml(xml);
  airportNameCacheLoadedAt = now;
  return airportNameCache;
}

export function enrichFlightsWithAirportNames(
  flights: AvinorFlight[],
  airportNames: Record<string, string>,
): AvinorFlight[] {
  return flights.map((flight) => {
    const code = flight.airport?.toUpperCase();
    const airportName = code ? airportNames[code] : undefined;
    return airportName ? { ...flight, airportName } : flight;
  });
}

export async function fetchAvinorFlights(
  options: AvinorFeedOptions = {},
): Promise<{
  url: URL;
  status: number;
  statusText: string;
  headers: Headers;
  feed: AvinorFeedResult;
}> {
  const direction = normalizeDirectionParam(options.direction);
  const airportNames = await getAvinorAirportNames();

  if (direction === "AD") {
    const [arrivals, departures] = await Promise.all([
      fetchAvinorFeedSingle({ ...options, direction: "A" }, airportNames),
      fetchAvinorFeedSingle({ ...options, direction: "D" }, airportNames),
    ]);

    return {
      url: departures.url,
      status: departures.status,
      statusText: departures.statusText,
      headers: departures.headers,
      feed: mergeAvinorFeeds(arrivals.feed, departures.feed),
    };
  }

  return fetchAvinorFeedSingle(options, airportNames);
}

export const AVINOR_DEFAULTS = {
  airport: DEFAULT_AIRPORT,
  direction: DEFAULT_DIRECTION,
  attribution: {
    text: "Flight data from Avinor",
    url: "https://www.avinor.no",
  },
} as const;
