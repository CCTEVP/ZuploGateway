import { parseGates } from "./players/types";

/** Direct gate filter query parameter (comma-separated values allowed). */
export const GATES_QUERY_PARAM = "gates";

/** Legacy alias kept for backward compatibility. */
export const GATE_QUERY_PARAM_ALIAS = "gate";

export function getIataParam(
  searchParams: URLSearchParams,
): string | undefined {
  return (
    searchParams.get("iata")?.trim().toUpperCase() ||
    searchParams.get("airport")?.trim().toUpperCase() ||
    undefined
  );
}

export function getGatesParam(
  searchParams: URLSearchParams,
): string | undefined {
  return (
    searchParams.get(GATES_QUERY_PARAM)?.trim() ||
    searchParams.get(GATE_QUERY_PARAM_ALIAS)?.trim() ||
    undefined
  );
}

export function gatesFilterFromParam(
  gatesParam: string | undefined,
): string | string[] | undefined {
  if (!gatesParam) {
    return undefined;
  }

  const parsed = parseGates(gatesParam);
  if (parsed.allGates) {
    return "*";
  }

  if (!parsed.gates?.length) {
    return undefined;
  }

  return parsed.gates.length === 1 ? parsed.gates[0] : parsed.gates;
}

export function normalizeGatesForCache(gatesParam: string): string {
  const parsed = parseGates(gatesParam);
  if (parsed.allGates) {
    return "*";
  }

  if (parsed.gates?.length) {
    return [...parsed.gates].sort().join(",");
  }

  return gatesParam;
}

export function setNormalizedGatesParam(
  searchParams: URLSearchParams,
  gatesParam: string,
) {
  searchParams.set(GATES_QUERY_PARAM, normalizeGatesForCache(gatesParam));
  searchParams.delete(GATE_QUERY_PARAM_ALIAS);
}
