import { ZuploContext, ZuploRequest } from "@zuplo/runtime";

export default async function (request: ZuploRequest, _context: ZuploContext) {
  const url = new URL(request.url);
  const latlon = url.searchParams.get("latlon");

  if (!latlon) {
    return request;
  }

  const [rawLat, rawLon] = latlon.trim().split(",");

  if (
    !rawLat ||
    !rawLon ||
    Number.isNaN(Number(rawLat)) ||
    Number.isNaN(Number(rawLon))
  ) {
    return request;
  }

  url.searchParams.set(
    "latlon",
    `${parseFloat(rawLat).toFixed(3)},${parseFloat(rawLon).toFixed(3)}`,
  );

  return new ZuploRequest(url, request);
}
