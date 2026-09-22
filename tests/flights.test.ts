import { describe, it } from "@zuplo/test";
import assert from "node:assert/strict";
import {
  FIXTURES,
  assertFlightsSuccess,
  expectStatus,
  get,
  parseBody,
} from "./helpers";

const PATH = "/flights/norway";

describe("flights /flights/norway", () => {
  it("returns 400 when gates, iata, and player are missing", async () => {
    const response = await get(PATH, { format: "json" });
    await expectStatus(response, 400);
    const body = await parseBody(response);
    assert.equal(body.error, "missing_required_parameter");
  });

  it("returns conflict when gates and player are both set", async () => {
    const response = await get(PATH, {
      gates: FIXTURES.oslGate,
      player: FIXTURES.testPlayerD9,
      format: "json",
    });
    await expectStatus(response, 400);
    const body = await parseBody(response);
    assert.equal(body.error, "gate_and_player_conflict");
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

  it("returns 400 for invalid direction", async () => {
    const response = await get(PATH, {
      player: FIXTURES.testPlayerD9,
      direction: "X",
      format: "json",
    });
    await expectStatus(response, 400);
    const body = await parseBody(response);
    assert.equal(body.error, "invalid_direction");
  });

  it("returns 400 for invalid gates", async () => {
    const response = await get(PATH, {
      gates: "   ",
      format: "json",
    });
    // empty/whitespace gates are treated as missing
    await expectStatus(response, 400);
  });

  it("accepts player lookup (default format javascript)", async () => {
    const response = await get(PATH, {
      player: FIXTURES.testPlayerD9,
    });
    await expectStatus(response, 200);
    const text = await response.text();
    assert.match(text, /^data\s*=/);
  });

  it("accepts player lookup with format=json", async () => {
    const response = await get(PATH, {
      player: FIXTURES.testPlayerD9,
      format: "json",
    });
    await expectStatus(response, 200);
    const body = await parseBody(response);
    assertFlightsSuccess(body);
    assert.equal(body.direction, "AD");
  });

  it("accepts resource_id alias", async () => {
    const response = await get(PATH, {
      resource_id: FIXTURES.testPlayerD1,
      format: "json",
    });
    await expectStatus(response, 200);
    const body = await parseBody(response);
    assertFlightsSuccess(body);
  });

  it("accepts legacy com.broadsign.suite.bsp.resource_id", async () => {
    const response = await get(PATH, {
      "com.broadsign.suite.bsp.resource_id": FIXTURES.testPlayerD9,
      format: "json",
    });
    await expectStatus(response, 200);
    const body = await parseBody(response);
    assertFlightsSuccess(body);
  });

  it("accepts direction=A", async () => {
    const response = await get(PATH, {
      player: FIXTURES.testPlayerD9,
      direction: "A",
      format: "json",
    });
    await expectStatus(response, 200);
    const body = await parseBody(response);
    assert.equal(body.direction, "A");
  });

  it("accepts direction=D", async () => {
    const response = await get(PATH, {
      player: FIXTURES.testPlayerD9,
      direction: "D",
      format: "json",
    });
    await expectStatus(response, 200);
    const body = await parseBody(response);
    assert.equal(body.direction, "D");
  });

  it("accepts direction=AD", async () => {
    const response = await get(PATH, {
      player: FIXTURES.testPlayerD9,
      direction: "AD",
      format: "json",
    });
    await expectStatus(response, 200);
    const body = await parseBody(response);
    assert.equal(body.direction, "AD");
  });

  it("accepts direct gates lookup (defaults iata to OSL)", async () => {
    const response = await get(PATH, {
      gates: FIXTURES.oslGate,
      format: "json",
    });
    await expectStatus(response, 200);
    const body = await parseBody(response);
    assertFlightsSuccess(body);
    assert.equal(body.iata, "OSL");
  });

  it("accepts gates + iata", async () => {
    const response = await get(PATH, {
      gates: FIXTURES.oslGate,
      iata: "OSL",
      format: "json",
    });
    await expectStatus(response, 200);
    const body = await parseBody(response);
    assertFlightsSuccess(body);
    assert.equal(body.iata, "OSL");
  });

  it("accepts airport alias for iata", async () => {
    const response = await get(PATH, {
      gates: FIXTURES.oslGate,
      airport: "OSL",
      format: "json",
    });
    await expectStatus(response, 200);
    const body = await parseBody(response);
    assert.equal(body.iata, "OSL");
  });

  it("accepts legacy gate alias", async () => {
    const response = await get(PATH, {
      gate: FIXTURES.oslGate,
      iata: "OSL",
      format: "json",
    });
    await expectStatus(response, 200);
    const body = await parseBody(response);
    assertFlightsSuccess(body);
  });

  it("accepts comma-separated gates", async () => {
    const response = await get(PATH, {
      gates: FIXTURES.bgoGates,
      iata: "BGO",
      format: "json",
    });
    await expectStatus(response, 200);
    const body = await parseBody(response);
    assertFlightsSuccess(body);
    assert.equal(body.iata, "BGO");
  });

  it("accepts gates=* for all gates", async () => {
    const response = await get(PATH, {
      gates: "*",
      iata: "OSL",
      format: "json",
    });
    await expectStatus(response, 200);
    const body = await parseBody(response);
    assertFlightsSuccess(body);
    assert.equal(body.gates, "*");
  });

  it("accepts iata alone (all gates at airport)", async () => {
    const response = await get(PATH, {
      iata: "BGO",
      format: "json",
    });
    await expectStatus(response, 200);
    const body = await parseBody(response);
    assertFlightsSuccess(body);
    assert.equal(body.iata, "BGO");
    assert.equal(body.gates, "*");
  });

  it("includes debug metadata when debug=true", async () => {
    const response = await get(PATH, {
      player: FIXTURES.testPlayerD9,
      format: "json",
      debug: "true",
    });
    await expectStatus(response, 200);
    const body = await parseBody(response);
    assert.ok(body.debug);
    const debug = body.debug as Record<string, unknown>;
    assert.ok(typeof debug.original === "string");
  });

  it("returns fuller payload when filter=false", async () => {
    const response = await get(PATH, {
      player: FIXTURES.testPlayerD9,
      format: "json",
      filter: "false",
    });
    await expectStatus(response, 200);
    const body = await parseBody(response);
    assert.ok(Array.isArray(body.flights));
  });
});
