import assert from "node:assert/strict";
import test from "node:test";
import { isClientVersionSupported } from "./version.js";

test("isClientVersionSupported accepts matching or newer semver", () => {
  assert.equal(isClientVersionSupported("0.2.0+abc", "0.2.0"), true);
  assert.equal(isClientVersionSupported("0.3.0", "0.2.0"), true);
  assert.equal(isClientVersionSupported("0.1.9", "0.2.0"), false);
});

test("isClientVersionSupported ignores empty minimum", () => {
  assert.equal(isClientVersionSupported("0.0.1", ""), true);
});
