import { describe, it } from "@zuplo/test";
import assert from "node:assert/strict";
import {
  FIXTURES,
  assertWeatherFiltered,
  expectStatus,
  get,
  parseBody,
} from "./helpers";

const WEATHER_COUNTRIES = [
  {
    path: "/weather/sweden",
    player: FIXTURES.swedenPlayer,
    latlon: FIXTURES.swedenLatLon,
  },
  {
    path: "/weather/norway",
    player: FIXTURES.norwayPlayer,
    latlon: "60.289,5.227",
  },
  {
    path: "/weather/poland",
    player: FIXTURES.polandPlayer,
    latlon: FIXTURES.polandLatLon,
  },
] as const;

for (const country of WEATHER_COUNTRIES) {
  describe(`weather ${country.path}`, () => {
    it("returns 400 when latlon and player are missing", async () => {
      const response = await get(country.path, { format: "json" });
      await expectStatus(response, 400);
    });

    it("returns 404 for unknown player", async () => {
      const response = await get(country.path, {
        player: "999999999999",
        format: "json",
      });
      await expectStatus(response, 404);
    });

    it("returns 400 for invalid format", async () => {
      const response = await get(country.path, {
        player: country.player,
        format: "xml",
      });
      await expectStatus(response, 400);
    });

    it("returns 400 for invalid source", async () => {
      const response = await get(country.path, {
        player: country.player,
        source: "postal",
        format: "json",
      });
      await expectStatus(response, 400);
      const text = await response.text();
      assert.match(text, /source/i);
    });

    it("accepts player lookup with default format (javascript)", async () => {
      const response = await get(country.path, {
        player: country.player,
      });
      await expectStatus(response, 200);
      const contentType = response.headers.get("content-type") ?? "";
      assert.match(contentType, /javascript|ecmascript/i);
      const text = await response.text();
      assert.match(text, /^data\s*=/);
    });

    it("accepts player lookup with format=json", async () => {
      const response = await get(country.path, {
        player: country.player,
        format: "json",
      });
      await expectStatus(response, 200);
      const body = await parseBody(response);
      assertWeatherFiltered(body);
    });

    it("accepts resource_id alias", async () => {
      const response = await get(country.path, {
        resource_id: country.player,
        format: "json",
      });
      await expectStatus(response, 200);
      const body = await parseBody(response);
      assertWeatherFiltered(body);
    });

    it("accepts legacy com.broadsign.suite.bsp.resource_id", async () => {
      const response = await get(country.path, {
        "com.broadsign.suite.bsp.resource_id": country.player,
        format: "json",
      });
      await expectStatus(response, 200);
      const body = await parseBody(response);
      assertWeatherFiltered(body);
    });

    it("accepts latlon lookup", async () => {
      const response = await get(country.path, {
        latlon: country.latlon,
        format: "json",
      });
      await expectStatus(response, 200);
      const body = await parseBody(response);
      assertWeatherFiltered(body);
    });

    it("accepts source=latlon explicitly", async () => {
      const response = await get(country.path, {
        player: country.player,
        source: "latlon",
        format: "json",
      });
      await expectStatus(response, 200);
      const body = await parseBody(response);
      assertWeatherFiltered(body);
    });

    it("accepts source=city with player (city or latlon fallback)", async () => {
      const response = await get(country.path, {
        player: country.player,
        source: "city",
        format: "json",
        debug: "true",
      });
      await expectStatus(response, 200);
      const body = await parseBody(response);
      assertWeatherFiltered(body);
      assert.ok(body.debug && typeof body.debug === "object");
      const debug = body.debug as Record<string, unknown>;
      assert.equal(debug.source, "city");
      assert.ok(
        debug.resolvedBy === "city" || debug.resolvedBy === "latlon",
        "resolvedBy should be city or latlon fallback",
      );
    });

    it("source=city overrides latlon when player has City", async () => {
      // Shared test players and Poland/Sweden players have City.
      const response = await get(country.path, {
        player: FIXTURES.testPlayerD9,
        latlon: "0,0",
        source: "city",
        format: "json",
        debug: "true",
      });
      await expectStatus(response, 200);
      const body = await parseBody(response);
      const debug = body.debug as Record<string, unknown>;
      assert.equal(debug.source, "city");
      assert.equal(debug.resolvedBy, "city");
      const original = String(debug.original ?? "");
      assert.match(original, /[?&]q=/);
      assert.doesNotMatch(original, /[?&]lat=/);
    });

    it("includes debug metadata when debug=true", async () => {
      const response = await get(country.path, {
        player: country.player,
        format: "json",
        debug: "true",
      });
      await expectStatus(response, 200);
      const body = await parseBody(response);
      assert.ok(body.debug);
      const debug = body.debug as Record<string, unknown>;
      assert.ok(typeof debug.original === "string");
      assert.match(String(debug.original), /\*+/);
    });

    it("returns fuller payload when filter=false", async () => {
      const response = await get(country.path, {
        player: country.player,
        format: "json",
        filter: "false",
      });
      await expectStatus(response, 200);
      const body = await parseBody(response);
      assert.ok(body.main);
      // Unfiltered OpenWeather payloads typically include name/base/visibility.
      assert.ok(
        body.name !== undefined ||
          body.base !== undefined ||
          body.visibility !== undefined,
        "expected unfiltered OpenWeather fields",
      );
    });
  });
}
