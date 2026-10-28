import { ZuploContext, ZuploRequest } from "@zuplo/runtime";
import { bumpCacheVersion } from "./cache-version";
import { TRANSIT_POLAND_CACHE_NAMESPACE } from "./transit-poland-normalize-cache-key";

export default async function (_request: ZuploRequest, context: ZuploContext) {
  const version = await bumpCacheVersion(TRANSIT_POLAND_CACHE_NAMESPACE, context);

  return Response.json({
    cache: "transit-poland",
    reset: true,
    version,
  });
}
