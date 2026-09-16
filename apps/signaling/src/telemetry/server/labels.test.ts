import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { httpStatusClass } from "./labels.js";

describe("httpStatusClass", () => {
  it("maps status codes to alert buckets", () => {
    assert.equal(httpStatusClass(200), "2xx");
    assert.equal(httpStatusClass(204), "2xx");
    assert.equal(httpStatusClass(301), "3xx");
    assert.equal(httpStatusClass(404), "4xx");
    assert.equal(httpStatusClass(500), "5xx");
    assert.equal(httpStatusClass(503), "5xx");
  });
});
