import { test } from "node:test";
import assert from "node:assert/strict";
import { PermissionsBitField } from "discord.js";
import {
  validateId,
  clampInt,
  validateInt,
  serializePermissions,
  deserializePermissions,
} from "../src/client.js";

test("validateId accepts a valid snowflake", () => {
  assert.equal(validateId("123456789012345678", "id"), "123456789012345678");
});

test("validateId rejects non-snowflakes", () => {
  assert.throws(() => validateId("abc", "id"));
  assert.throws(() => validateId("", "id"));
  assert.throws(() => validateId("123", "id"));
  assert.throws(() => validateId(undefined, "id"));
});

test("clampInt clamps, truncates, and falls back on non-numbers", () => {
  assert.equal(clampInt("abc", 1, 100, 20), 20);
  assert.equal(clampInt(undefined, 1, 100, 20), 20);
  assert.equal(clampInt(9999, 1, 100, 20), 100);
  assert.equal(clampInt(0, 1, 100, 20), 1);
  assert.equal(clampInt(5.7, 1, 100, 20), 5);
});

test("validateInt enforces an integer range", () => {
  assert.equal(validateInt(30, 0, 40320, "duration"), 30);
  assert.equal(validateInt(0, 0, 40320, "duration"), 0);
  assert.throws(() => validateInt("abc", 0, 40320, "duration"));
  assert.throws(() => validateInt(50000, 0, 40320, "duration"));
  assert.throws(() => validateInt(-1, 0, 40320, "duration"));
});

test("serialize/deserialize permissions round-trips", () => {
  const names = ["SendMessages", "ViewChannel"];
  const bits = deserializePermissions(names);
  assert.ok(bits instanceof PermissionsBitField);
  const back = serializePermissions(bits);
  for (const n of names) assert.ok(back.includes(n), `${n} missing from round-trip`);
});
