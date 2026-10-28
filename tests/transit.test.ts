import { describe, it } from "@zuplo/test";
import assert from "node:assert/strict";
import {
  FIXTURES,
  assertTransitSuccess,
  expectStatus,
  get,
  parseBody,
} from "./helpers";

const PATH = "/transit/poland";

describe("transit /transit/poland", () => {
  it("returns 400 when stops and player are missing", async () => {
    const response = await get(PATH, { format: "json" });
    await expectStatus(response, 400);
    const body = await parseBody(response);
    assert.equal(body.error, "missing_required_parameter");
  });

  it("returns conflict when stops and player are both set", async () => {
    const response = await get(PATH, {
      stops: FIXTURES.krakowStops,
      player: FIXTURES.testPlayerD9,
      format: "json",
    });
    await expectStatus(response, 400);
    const body = await parseBody(response);
    assert.equal(body.error, "stops_and_player_conflict");
  });

  it("returns 404 for unknown player", async () => {
    const response = await get(PATH, {
      player: "999999999999",
      format: "json",
    });
    await expectStatus(response, 404);
    const body = await parseBody(response);
    assert.equal(body.error, "unknown_player");
  });

  it("returns player_has_no_stops for a player without stops", async () => {
    const response = await get(PATH, {
      player: FIXTURES.polandPlayer,
      format: "json",
    });
    await expectStatus(response, 400);
    const body = await parseBody(response);
    assert.equal(body.error, "player_has_no_stops");
  });

  it("returns 400 for invalid limit", async () => {
    const response = await get(PATH, {
      stops: FIXTURES.krakowStops,
      limit: "0",
      format: "json",
    });
    await expectStatus(response, 400);
    const body = await parseBody(response);
    assert.equal(body.error, "invalid_limit");
  });

  it("returns 400 for invalid window", async () => {
    const response = await get(PATH, {
      stops: FIXTURES.krakowStops,
      window: "abc",
      format: "json",
    });
    await expectStatus(response, 400);
    const body = await parseBody(response);
    assert.equal(body.error, "invalid_window");
  });

  it("returns invalid_stop for an unknown stop ID", async () => {
    const response = await get(PATH, {
      stops: "not-a-stop",
      format: "json",
    });
    await expectStatus(response, 400);
    const body = await parseBody(response);
    assert.equal(body.error, "invalid_stop");
  });

  it("returns 400 for invalid include", async () => {
    const response = await get(PATH, {
      stops: FIXTURES.krakowStops,
      include: "everything",
      format: "json",
    });
    await expectStatus(response, 400);
    const body = await parseBody(response);
    assert.equal(body.error, "invalid_include");
  });

  it("returns departures for direct stops", async () => {
    const response = await get(PATH, {
      stops: FIXTURES.krakowStops,
      format: "json",
    });
    await expectStatus(response, 200);
    assertTransitSuccess(await parseBody(response));
  });

  it("returns every field and skips terminating trips with filter=false", async () => {
    const response = await get(PATH, {
      player: FIXTURES.testPlayerD9,
      limit: "10",
      filter: "false",
      format: "json",
    });
    await expectStatus(response, 200);
    const body = await parseBody(response);
    assert.ok(Array.isArray(body.stops), "expected stops[]");
    assert.ok("next" in body, "expected next");
    const departures = body.departures as Record<string, unknown>[];
    for (const departure of departures) {
      assert.ok("scheduledDeparture" in departure);
      assert.ok("tripId" in departure);
      assert.notEqual(departure.terminatesHere, true);
    }
  });

  it("accepts include=terminating", async () => {
    const response = await get(PATH, {
      player: FIXTURES.testPlayerD9,
      include: "terminating",
      format: "json",
    });
    await expectStatus(response, 200);
    assertTransitSuccess(await parseBody(response));
  });

  it("returns departures for a player with stops", async () => {
    const response = await get(PATH, {
      player: FIXTURES.testPlayerD9,
      limit: "5",
      format: "json",
    });
    await expectStatus(response, 200);
    const body = await parseBody(response);
    assertTransitSuccess(body);
    assert.ok((body.departures as unknown[]).length <= 5);
  });

  it("accepts resource_id alias", async () => {
    const response = await get(PATH, {
      resource_id: FIXTURES.testPlayerD9,
      format: "json",
    });
    await expectStatus(response, 200);
    assertTransitSuccess(await parseBody(response));
  });

  it("returns JavaScript by default", async () => {
    const response = await get(PATH, { player: FIXTURES.testPlayerD9 });
    await expectStatus(response, 200);
    const text = await response.text();
    assert.ok(text.startsWith("data = "), "expected data = ... body");
  });

  it("includes debug info with debug=true", async () => {
    const response = await get(PATH, {
      player: FIXTURES.testPlayerD9,
      debug: "true",
      format: "json",
    });
    await expectStatus(response, 200);
    const body = await parseBody(response);
    const debug = body.debug as Record<string, unknown>;
    assert.ok(debug, "expected debug");
    assert.ok(String(debug.original).includes("/stop/departures/"));
    assert.ok(debug.player, "expected matched player");
  });
});
