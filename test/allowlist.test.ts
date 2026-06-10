import { test, mock, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { discord, fetchChannelChecked } from "../src/client.js";
import webhooks from "../src/tools/webhooks.js";

const ALLOWED = "111111111111111111";
const FOREIGN = "222222222222222222";

afterEach(() => {
  mock.restoreAll();
  delete process.env.DISCORD_ALLOWED_GUILDS;
});

test("fetchChannelChecked rejects a channel whose guild is outside the allow-list", async () => {
  process.env.DISCORD_ALLOWED_GUILDS = ALLOWED;
  mock.method(discord.channels, "fetch", async () => ({ guildId: FOREIGN }) as never);
  await assert.rejects(() => fetchChannelChecked("333333333333333333"), /allow-list/);
});

test("fetchChannelChecked passes an allowed channel and guild-less objects through", async () => {
  process.env.DISCORD_ALLOWED_GUILDS = ALLOWED;
  mock.method(discord.channels, "fetch", async () => ({ guildId: ALLOWED }) as never);
  assert.ok(await fetchChannelChecked("333333333333333333"));
  mock.method(discord.channels, "fetch", async () => ({}) as never);
  assert.ok(await fetchChannelChecked("333333333333333333"));
});

test("token-webhook flows are gated when the allow-list is active", async () => {
  process.env.DISCORD_ALLOWED_GUILDS = ALLOWED;
  mock.method(discord, "fetchWebhook", async () => ({ guildId: FOREIGN }) as never);
  await assert.rejects(
    () =>
      webhooks.handlers.get("discord_send_webhook_message")!({
        webhook_id: "333333333333333333",
        webhook_token: "tok",
        content: "x",
      }),
    /allow-list/,
  );
});

test("no tool module bypasses the checked channel fetch", () => {
  const dir = join(__dirname, "..", "src", "tools");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
    const src = readFileSync(join(dir, file), "utf-8");
    assert.ok(
      !/discord\.channels\.fetch/.test(src),
      `${file} calls discord.channels.fetch directly — use fetchChannelChecked/getTextChannel/getGuildChannel`,
    );
  }
});
