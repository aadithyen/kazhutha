import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { openObserveIngestUrl, toOpenObserveRecords } from "./openobserve.js";

const baseConfig = {
  enabled: true,
  serviceName: "test",
  environment: "test",
  version: "0",
  logLevel: "info" as const,
  otlpEndpoint: "https://o2.example.com/api/default",
  otlpHeaders: { Authorization: "Basic abc" },
  ipHashSalt: "x",
  openObserveOrg: "default",
};

describe("openObserveIngestUrl", () => {
  it("builds ingest URL from OTLP base (org already in path)", () => {
    const url = openObserveIngestUrl(baseConfig, "application_logs");
    assert.equal(url, "https://o2.example.com/api/default/application_logs/_json");
  });

  it("returns null when endpoint unset", () => {
    assert.equal(openObserveIngestUrl({ ...baseConfig, otlpEndpoint: null }, "application_logs"), null);
  });
});

describe("toOpenObserveRecords", () => {
  it("copies timestamp to _timestamp for OpenObserve", () => {
    const rows = toOpenObserveRecords([
      {
        timestamp: "2026-09-16T13:00:00.000Z",
        level: "info",
        message: "hello",
        stream: "application_logs",
        service: "test",
        environment: "test",
        version: "1",
      },
    ]);
    assert.equal(rows[0]._timestamp, "2026-09-16T13:00:00.000Z");
    assert.equal(rows[0].stream, "application_logs");
  });
});
