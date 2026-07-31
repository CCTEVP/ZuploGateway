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
const DEFAULT_DIRECTION = "D";
const DEFAULT_TIME_FROM = "1";
const DEFAULT_TIME_TO = "7";

let airportNameCache: Record<string, string> | undefined;
let airportNameCacheLoadedAt = 0;
const AIRPORT_NAME_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type AvinorFeedOptions = {
  airport?: string;
  direction?: string;
  timeFrom?: string;
  timeTo?: string;
};

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
  gate: string,
): AvinorFlight[] {
  const normalizedGate = gate.trim().toUpperCase();
  return flights.filter(
    (flight) => flight.gate?.trim().toUpperCase() === normalizedGate,
  );
}

export function buildAvinorFeedUrl(options: AvinorFeedOptions = {}): URL {
  const url = new URL(AVINOR_XML_FEED_BASE);
  url.searchParams.set("airport", (options.airport ?? DEFAULT_AIRPORT).toUpperCase());
  url.searchParams.set(
    "direction",
    (options.direction ?? DEFAULT_DIRECTION).toUpperCase(),
  );
  url.searchParams.set("TimeFrom", options.timeFrom ?? DEFAULT_TIME_FROM);
  url.searchParams.set("TimeTo", options.timeTo ?? DEFAULT_TIME_TO);
  return url;
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
  const url = buildAvinorFeedUrl(options);
  const [response, airportNames] = await Promise.all([
    fetch(url.toString()),
    getAvinorAirportNames(),
  ]);
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

export const AVINOR_DEFAULTS = {
  airport: DEFAULT_AIRPORT,
  direction: DEFAULT_DIRECTION,
  attribution: {
    text: "Flight data from Avinor",
    url: "https://www.avinor.no",
  },
} as const;
