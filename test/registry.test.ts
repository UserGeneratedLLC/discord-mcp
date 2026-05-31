import { test } from "node:test";
import assert from "node:assert/strict";
import { getAllDefinitions, handleTool } from "../src/tools/index.js";

test("tool definitions are non-empty and uniquely named", () => {
  const defs = getAllDefinitions();
  assert.ok(defs.length > 0, "expected at least one tool definition");
  const names = defs.map((d) => d.name);
  assert.equal(new Set(names).size, names.length, "duplicate tool names found");
  for (const n of names) assert.match(n, /^discord_/, `tool name should start with discord_: ${n}`);
});

test("every definition has a description and inputSchema", () => {
  for (const d of getAllDefinitions()) {
    assert.ok(d.description && d.description.length > 0, `${d.name} missing description`);
    assert.equal(typeof d.inputSchema, "object", `${d.name} missing inputSchema`);
  }
});

test("an unknown tool name is rejected", async () => {
  await assert.rejects(() => handleTool("discord_nonexistent_tool", {}));
});
