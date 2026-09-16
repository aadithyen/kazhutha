import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SecurityTracker } from "./security";
import type { SecurityEvent } from "../types";

const config = {
  enabled: true,
  serviceName: "test",
  environment: "test",
  version: "0.0.0",
  logLevel: "info" as const,
  otlpEndpoint: null,
  otlpHeaders: {},
  ipHashSalt: "test-salt",
  openObserveOrg: "default",
};

describe("SecurityTracker", () => {
  it("emits security events", () => {
    const events: SecurityEvent[] = [];
    const tracker = new SecurityTracker(config);
    tracker.addSink((e) => events.push(e));
    tracker.record("rate_limit_exceeded", "too fast", { source: "1.2.3.4", route: "/ws" });
    assert.equal(events.length, 1);
    assert.equal(events[0].security_event_type, "rate_limit_exceeded");
    assert.ok(events[0].source_hash);
    assert.equal(events[0].source_hash?.includes("1.2.3.4"), false);
  });

  it("detects connection flood", () => {
    const events: SecurityEvent[] = [];
    const tracker = new SecurityTracker(config);
    tracker.addSink((e) => events.push(e));
    for (let i = 0; i < 30; i++) tracker.trackRequest("10.0.0.1", "/ws");
    assert.equal(events.some((e) => e.security_event_type === "connection_flood"), true);
  });
});
