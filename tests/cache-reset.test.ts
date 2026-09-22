import { describe, it } from "@zuplo/test";
import assert from "node:assert/strict";
import { expectStatus, parseBody, post } from "./helpers";

/**
 * Cache invalidation endpoints (side effects).
 * Prefer local/preview only — exclude from production smoke:
 *   npx zuplo test --endpoint <url> --filter "smoke:"
 */
describe("cache reset", () => {
  it("resets sweden weather cache", async () => {
    const response = await post("/weather/sweden/reset");
    await expectStatus(response, 200);
    const body = await parseBody(response);
    assert.equal(body.reset, true);
    assert.ok(body.version);
  });

  it("resets norway weather cache", async () => {
    const response = await post("/weather/norway/reset");
    await expectStatus(response, 200);
    const body = await parseBody(response);
    assert.equal(body.reset, true);
    assert.ok(body.version);
  });

  it("resets poland weather cache", async () => {
    const response = await post("/weather/poland/reset");
    await expectStatus(response, 200);
    const body = await parseBody(response);
    assert.equal(body.reset, true);
    assert.ok(body.version);
  });

  it("resets norway flights cache", async () => {
    const response = await post("/flights/norway/reset");
    await expectStatus(response, 200);
    const body = await parseBody(response);
    assert.equal(body.reset, true);
    assert.ok(body.version);
  });
});
