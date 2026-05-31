import { test } from "node:test";
import assert from "node:assert/strict";
import { ZodError } from "zod";
import { snowflake } from "../src/tools/define.js";
import messages from "../src/tools/messages.js";

const VALID_ID = "123456789012345678";

test("snowflake accepts a valid ID and rejects malformed ones", () => {
  assert.equal(snowflake.parse(VALID_ID), VALID_ID);
  assert.throws(() => snowflake.parse("123"), ZodError);
  assert.throws(() => snowflake.parse("not-an-id"), ZodError);
  assert.throws(() => snowflake.parse(42), ZodError);
});

test("derived inputSchema is a bare object schema with no $schema key", () => {
  const read = messages.definitions.find((d) => d.name === "discord_read_messages");
  assert.ok(read, "discord_read_messages should be defined");
  const schema = read.inputSchema as Record<string, unknown>;
  assert.equal(schema.type, "object");
  assert.ok(!("$schema" in schema), "$schema must be stripped from inputSchema");
  const props = schema.properties as Record<string, unknown>;
  assert.ok(props.channel_id && props.limit, "properties should be derived from the zod schema");
  assert.deepEqual(schema.required, ["channel_id"]);
});

test("field descriptions propagate from .describe() into the inputSchema", () => {
  const send = messages.definitions.find((d) => d.name === "discord_send_message");
  const props = (send!.inputSchema as { properties: Record<string, { description?: string }> }).properties;
  assert.match(props.content.description ?? "", /Plain-text body/);
});

test("handle rejects invalid args before reaching the Discord API", async () => {
  // A malformed channel_id fails zod validation synchronously, with no network call.
  await assert.rejects(() => messages.handle("discord_read_messages", { channel_id: "bad" }), ZodError);
});

test("handle returns null for a tool it does not own", async () => {
  assert.equal(await messages.handle("discord_not_a_messages_tool", {}), null);
});
