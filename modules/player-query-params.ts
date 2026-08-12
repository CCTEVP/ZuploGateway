/** Short player id query parameter. */
export const PLAYER_QUERY_PARAM = "player";

/** Short resource id alias for player lookup. */
export const RESOURCE_ID_ALIAS_QUERY_PARAM = "resource_id";

/** CMS resource id parameter (external contract). */
export const RESOURCE_ID_QUERY_PARAM =
  "com.broadsign.suite.bsp.resource_id";

export function getPlayerLookupValue(
  searchParams: URLSearchParams,
): string | undefined {
  const player = searchParams.get(PLAYER_QUERY_PARAM)?.trim();
  const resourceIdAlias = searchParams
    .get(RESOURCE_ID_ALIAS_QUERY_PARAM)
    ?.trim();
  const resourceId = searchParams.get(RESOURCE_ID_QUERY_PARAM)?.trim();
  return player || resourceIdAlias || resourceId || undefined;
}

export function clearPlayerLookupParams(searchParams: URLSearchParams) {
  searchParams.delete(PLAYER_QUERY_PARAM);
  searchParams.delete(RESOURCE_ID_ALIAS_QUERY_PARAM);
  searchParams.delete(RESOURCE_ID_QUERY_PARAM);
}
