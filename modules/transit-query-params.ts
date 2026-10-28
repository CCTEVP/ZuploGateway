import { ODT_DEFAULTS } from "./odt-planner";
import { parseStops } from "./players/types";

/** Direct stop lookup query parameter (ODT stop IDs, comma-separated). */
export const STOPS_QUERY_PARAM = "stops";

export function getStopsParam(searchParams: URLSearchParams): string[] {
  return parseStops(searchParams.get(STOPS_QUERY_PARAM) ?? undefined);
}

function parseBoundedInt(
  value: string | null,
  fallback: number,
  max: number,
): number | undefined {
  if (value == null || value.trim() === "") {
    return fallback;
  }
  if (!/^\d+$/.test(value.trim())) {
    return undefined;
  }
  const parsed = Number(value);
  return parsed >= 1 && parsed <= max ? parsed : undefined;
}

/** Number of departures to return; undefined when invalid. */
export function parseLimitParam(value: string | null) {
  return parseBoundedInt(value, ODT_DEFAULTS.limit, ODT_DEFAULTS.maxLimit);
}

/** Look-ahead window in minutes; undefined when invalid. */
export function parseWindowParam(value: string | null) {
  return parseBoundedInt(value, ODT_DEFAULTS.window, ODT_DEFAULTS.maxWindow);
}

/** `include` query parameter: extra departure kinds normally skipped. */
export const INCLUDE_QUERY_PARAM = "include";

const INCLUDE_VALUES = ["terminating"] as const;
export type IncludeValue = (typeof INCLUDE_VALUES)[number];

/** Parsed `include` values (sorted, deduped); undefined when invalid. */
export function parseIncludeParam(
  value: string | null,
): IncludeValue[] | undefined {
  const values = [
    ...new Set(
      (value ?? "")
        .split(",")
        .map((part) => part.trim().toLowerCase())
        .filter(Boolean),
    ),
  ].sort();
  return values.every((part) =>
    (INCLUDE_VALUES as readonly string[]).includes(part),
  )
    ? (values as IncludeValue[])
    : undefined;
}

/** Canonical stop list for cache keys. */
export function normalizeStopsForCache(stops: string[]): string {
  return [...stops].sort().join(",");
}
