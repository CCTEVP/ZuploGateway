import { ZuploContext, ZuploRequest } from "@zuplo/runtime";
import { bumpCacheVersion } from "./cache-version";

const FLIGHTS_CACHE_NAMESPACE = "flights-norway-cache";

export default async function (_request: ZuploRequest, context: ZuploContext) {
  const version = await bumpCacheVersion(FLIGHTS_CACHE_NAMESPACE, context);

  return Response.json({
    cache: "flights-norway",
    reset: true,
    version,
  });
}
