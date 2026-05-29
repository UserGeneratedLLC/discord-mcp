import "dotenv/config";
import {
  Client,
  GatewayIntentBits,
  TextChannel,
  ThreadChannel,
  GuildChannel,
  PermissionsBitField,
} from "discord.js";

// ─── Discord Client ────────────────────────────────────────────────────────────
// Initializes the Discord.js client with the required gateway intents
// and exposes shared helper functions used across all tool modules.
// ────────────────────────────────────────────────────────────────────────────────

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

export const discord = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildScheduledEvents,
  ],
});

let discordReady = false;
let loginPromise: Promise<void> | null = null;

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Lazily connects to Discord on first tool call.
 * Allows the MCP server to start and respond to ListTools without a connection.
 */
export async function ensureConnected(): Promise<void> {
  if (discordReady) return;

  if (!DISCORD_TOKEN) {
    throw new Error(
      "DISCORD_TOKEN is required. Set it in your MCP client config or a .env file."
    );
  }

  if (!loginPromise) {
    loginPromise = new Promise<void>((resolve, reject) => {
      discord.once("ready", () => {
        discordReady = true;
        console.error(`✅  Discord bot connected as ${discord.user?.tag}`);
        resolve();
      });
      discord.login(DISCORD_TOKEN).catch((err) => {
        loginPromise = null;
        reject(new Error(`Discord login failed: ${err.message}`));
      });
    });
  }

  await loginPromise;
}

/**
 * Fetches a channel by ID and guarantees it is a text-capable guild channel
 * (a TextChannel or any thread inside one — announcement / public / private / forum).
 * Both class hierarchies expose the message-send / edit / fetch surface used by
 * the message tools, so the wrapper accepts either.
 * @param channelId - Discord snowflake ID of the channel.
 * @returns The resolved TextChannel or ThreadChannel instance.
 * @throws {Error} If the channel does not exist or is neither a text channel nor a thread.
 */
export async function getTextChannel(channelId: string): Promise<TextChannel | ThreadChannel> {
  const channel = await discord.channels.fetch(channelId);
  if (!channel || (!(channel instanceof TextChannel) && !(channel instanceof ThreadChannel)))
    throw new Error(`Channel ${channelId} is not a text or thread channel or doesn't exist.`);
  return channel;
}

/**
 * Fetches a channel by ID and guarantees it is a guild channel (text, voice, or category).
 * @param channelId - Discord snowflake ID of the channel.
 * @returns The resolved GuildChannel instance.
 * @throws {Error} If the channel does not exist or is not a guild channel.
 */
export async function getGuildChannel(channelId: string): Promise<GuildChannel> {
  const channel = await discord.channels.fetch(channelId);
  if (!channel || !(channel instanceof GuildChannel))
    throw new Error(`Channel ${channelId} is not a guild channel or doesn't exist.`);
  return channel;
}

/**
 * Validates that a value is a proper Discord snowflake ID (17-20 digit number).
 * @param value - The raw value to validate.
 * @param label - A human-readable label used in the error message (e.g. "guild_id").
 * @returns The validated ID as a string.
 * @throws {Error} If the value is not a valid snowflake.
 */
export function validateId(value: unknown, label: string): string {
  const id = String(value ?? "");
  if (!/^\d{17,20}$/.test(id)) throw new Error(`Invalid ${label}: "${id}". Must be a Discord snowflake ID (17-20 digits).`);
  return id;
}

/**
 * Converts a PermissionsBitField into a human-readable array of permission names.
 * @param perms - The bitfield to serialize.
 * @returns Array of permission flag names (e.g. ["SendMessages", "ViewChannel"]).
 */
export function serializePermissions(perms: Readonly<PermissionsBitField>): string[] {
  return Object.keys(PermissionsBitField.Flags).filter((flag) =>
    perms.has(flag as keyof typeof PermissionsBitField.Flags)
  );
}

/**
 * Builds a PermissionsBitField from an array of permission flag names.
 * Inverse of {@link serializePermissions}.
 * @param names - Permission flag names (e.g. ["SendMessages", "ViewChannel"]).
 * @returns A PermissionsBitField with those flags set.
 */
export function deserializePermissions(names: string[]): PermissionsBitField {
  return new PermissionsBitField(
    names.map((p) => PermissionsBitField.Flags[p as keyof typeof PermissionsBitField.Flags])
  );
}
