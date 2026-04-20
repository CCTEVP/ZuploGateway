import { ZuploContext, ZuploRequest } from "@zuplo/runtime";
import {
  findPlayerLocation,
  findPlayerLocationSourceRecord,
} from "./player-location-data";

export default async function (request: ZuploRequest, context: ZuploContext) {
  const url = new URL(request.url);
  const player = url.searchParams.get("player")?.trim();
  const resourceId = url.searchParams
    .get("com.broadsign.suite.bsp.resource_id")
    ?.trim();
  const latlon = url.searchParams.get("latlon");
  const locationLookupValue = player || resourceId;

  if (locationLookupValue) {
    const match = findPlayerLocation(locationLookupValue);
    const sourceRecord = findPlayerLocationSourceRecord(locationLookupValue);

    if (!match) {
      return request;
    }

    context.custom.weatherMatchedSourceRecord = sourceRecord;

    url.searchParams.set(
      "latlon",
      `${match.latitude.toFixed(3)},${match.longitude.toFixed(3)}`,
    );
    url.searchParams.delete("player");
    url.searchParams.delete("com.broadsign.suite.bsp.resource_id");

    return new ZuploRequest(url, request);
  }

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
  url.searchParams.delete("player");
  url.searchParams.delete("com.broadsign.suite.bsp.resource_id");

  return new ZuploRequest(url, request);
}
