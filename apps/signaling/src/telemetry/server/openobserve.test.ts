import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { openObserveIngestUrl } from "./openobserve.js";

describe("openObserveIngestUrl", () => {
  it("builds ingest URL from OTLP base (org already in path)", () => {
    const url = openObserveIngestUrl(
      {
        enabled: true,
        serviceName: "test",
        environment: "test",
        version: "0",
        logLevel: "info",
        otlpEndpoint: "https://o2.example.com/api/default",
        otlpHeaders: {},
        ipHashSalt: "x",
        openObserveOrg: "default",
      },
      "application_logs",
    );
    assert.equal(url, "https://o2.example.com/api/default/application_logs/_json");
  });

  it("returns null when endpoint unset", () => {
    assert.equal(
      openObserveIngestUrl(
        {
          enabled: true,
          serviceName: "test",
          environment: "test",
          version: "0",
          logLevel: "info",
          otlpEndpoint: null,
          otlpHeaders: {},
          ipHashSalt: "x",
          openObserveOrg: "default",
        },
        "application_logs",
      ),
      null,
    );
  });
});
