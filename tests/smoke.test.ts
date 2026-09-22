import { describe, it } from "@zuplo/test";
import {
  FIXTURES,
  assertFlightsSuccess,
  assertWeatherFiltered,
  expectStatus,
  get,
  parseBody,
} from "./helpers";

/**
 * Read-only smoke checks safe for production.
 * Run with: npx zuplo test --endpoint <url> --filter "smoke:"
 */
describe("smoke: weather", () => {
  it("sweden player returns weather", async () => {
    const response = await get("/weather/sweden", {
      player: FIXTURES.swedenPlayer,
      format: "json",
    });
    await expectStatus(response, 200);
    assertWeatherFiltered(await parseBody(response));
  });

  it("norway player returns weather", async () => {
    const response = await get("/weather/norway", {
      player: FIXTURES.norwayPlayer,
      format: "json",
    });
    await expectStatus(response, 200);
    assertWeatherFiltered(await parseBody(response));
  });

  it("poland player returns weather", async () => {
    const response = await get("/weather/poland", {
      player: FIXTURES.polandPlayer,
      format: "json",
    });
    await expectStatus(response, 200);
    assertWeatherFiltered(await parseBody(response));
  });

  it("poland source=city returns weather", async () => {
    const response = await get("/weather/poland", {
      player: FIXTURES.polandPlayer,
      source: "city",
      format: "json",
    });
    await expectStatus(response, 200);
    assertWeatherFiltered(await parseBody(response));
  });
});

describe("smoke: flights", () => {
  it("player lookup returns flights", async () => {
    const response = await get("/flights/norway", {
      player: FIXTURES.testPlayerD9,
      format: "json",
    });
    await expectStatus(response, 200);
    assertFlightsSuccess(await parseBody(response));
  });

  it("direct gates+iata returns flights", async () => {
    const response = await get("/flights/norway", {
      gates: FIXTURES.oslGate,
      iata: "OSL",
      format: "json",
    });
    await expectStatus(response, 200);
    assertFlightsSuccess(await parseBody(response));
  });

  it("iata alone returns all gates", async () => {
    const response = await get("/flights/norway", {
      iata: "OSL",
      format: "json",
    });
    await expectStatus(response, 200);
    assertFlightsSuccess(await parseBody(response));
  });
});
