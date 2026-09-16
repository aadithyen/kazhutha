import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeTelemetryPayload } from "./sanitize.js";

describe("sanitizeTelemetryPayload", () => {
  it("removes secret fields", () => {
    const result = sanitizeTelemetryPayload({
      message: "ok",
      password: "secret",
      authorization: "Bearer x",
      nested: { api_key: "k", keep: true },
    });
    assert.equal(result.message, "ok");
    assert.equal("password" in result, false);
    assert.equal("authorization" in result, false);
    assert.deepEqual(result.nested, { keep: true });
  });

  it("removes sdp and candidate fields", () => {
    const result = sanitizeTelemetryPayload({ sdp: "v=0...", candidate: { ip: "1.2.3.4" } });
    assert.equal(Object.keys(result).length, 0);
  });
});
