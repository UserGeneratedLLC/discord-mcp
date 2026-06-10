import { test } from "node:test";
import assert from "node:assert/strict";
import { selectModules, hasTool } from "../src/tools/index.js";
import { assertAllowedGuild, isGuildAllowed } from "../src/client.js";

test("selectModules exposes everything when unset or `all`", () => {
  delete process.env.DISCORD_MCP_TOOLSETS;
  const all = selectModules().length;
  process.env.DISCORD_MCP_TOOLSETS = "all";
  assert.equal(selectModules().length, all);
  delete process.env.DISCORD_MCP_TOOLSETS;
});

test("selectModules picks listed toolsets, case-insensitive", () => {
  process.env.DISCORD_MCP_TOOLSETS = "Discovery, MESSAGES";
  try {
    assert.equal(selectModules().length, 2);
  } finally {
    delete process.env.DISCORD_MCP_TOOLSETS;
  }
});

test("selectModules fails fast on unknown or empty selections", () => {
  for (const value of ["messsages", "discovery messages", ",,"]) {
    process.env.DISCORD_MCP_TOOLSETS = value;
    try {
      assert.throws(() => selectModules(), /Invalid DISCORD_MCP_TOOLSETS/, value);
    } finally {
      delete process.env.DISCORD_MCP_TOOLSETS;
    }
  }
});

test("hasTool reflects the registry", () => {
  assert.ok(hasTool("discord_list_guilds"));
  assert.ok(!hasTool("discord_nonexistent"));
});

test("assertAllowedGuild enforces the allow-list lazily and ignores null", () => {
  process.env.DISCORD_ALLOWED_GUILDS = "111111111111111111";
  try {
    assert.ok(isGuildAllowed("111111111111111111"));
    assert.throws(() => assertAllowedGuild("222222222222222222"), /allow-list/);
    assertAllowedGuild(null);
    assertAllowedGuild(undefined);
  } finally {
    delete process.env.DISCORD_ALLOWED_GUILDS;
  }
  assertAllowedGuild("222222222222222222");
});
