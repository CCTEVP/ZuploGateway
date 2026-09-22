import { TestHelper } from "@zuplo/test";
import assert from "node:assert/strict";

/** Known fixtures from country + shared test player datasets. */
export const FIXTURES = {
  swedenPlayer: "582607705",
  swedenLatLon: "59.339,18.067",
  norwayPlayer: "187737315",
  polandPlayer: "963988113",
  polandLatLon: "52.237,20.979",
  /** Shared demo players (merged into every country lookup). */
  testPlayerD9: "759244535",
  testPlayerD1: "582309742",
  oslGate: "D9",
  bgoGates: "C34,C35",
} as const;

export function baseUrl(): string {
  return TestHelper.TEST_URL.replace(/\/$/, "");
}

export function url(path: string, params?: Record<string, string>): string {
  const target = new URL(path.replace(/^\//, ""), `${baseUrl()}/`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      target.searchParams.set(key, value);
    }
  }
  return target.toString();
}

export async function get(
  path: string,
  params?: Record<string, string>,
): Promise<Response> {
  return fetch(url(path, params));
}

export async function post(path: string): Promise<Response> {
  return fetch(url(path), { method: "POST" });
}

/** Parse default JS body (`data = {...};`) or JSON. */
export async function parseBody(
  response: Response,
): Promise<Record<string, unknown>> {
  const text = await response.text();
  const trimmed = text.trim();

  if (trimmed.startsWith("data =")) {
    const json = trimmed.replace(/^data\s*=\s*/, "").replace(/;\s*$/, "");
    return JSON.parse(json) as Record<string, unknown>;
  }

  return JSON.parse(trimmed) as Record<string, unknown>;
}

export async function expectStatus(
  response: Response,
  status: number,
): Promise<void> {
  if (response.status !== status) {
    const body = await response.clone().text();
    assert.equal(
      response.status,
      status,
      `Expected ${status}, got ${response.status}. Body: ${body.slice(0, 500)}`,
    );
  }
}

export function assertWeatherFiltered(body: Record<string, unknown>) {
  assert.ok(body.coord, "expected coord");
  assert.ok(body.main && typeof body.main === "object", "expected main");
  assert.ok(
    (body.main as Record<string, unknown>).temp !== undefined,
    "expected main.temp",
  );
  assert.ok(Array.isArray(body.weather), "expected weather[]");
  assert.ok(body.wind && typeof body.wind === "object", "expected wind");
  assert.ok(body.sys && typeof body.sys === "object", "expected sys");
  const sys = body.sys as Record<string, unknown>;
  assert.ok(sys.sunrise !== undefined, "expected sys.sunrise");
  assert.ok(sys.sunset !== undefined, "expected sys.sunset");
  assert.ok(body.timestamp, "expected timestamp");
}

export function assertFlightsSuccess(body: Record<string, unknown>) {
  assert.ok(body.iata || body.airportCode, "expected iata/airportCode");
  assert.ok(body.direction, "expected direction");
  assert.ok(body.gates !== undefined, "expected gates");
  assert.ok(Array.isArray(body.flights), "expected flights[]");
  assert.ok(body.attribution, "expected attribution");
  assert.ok(body.timestamp, "expected timestamp");
}
