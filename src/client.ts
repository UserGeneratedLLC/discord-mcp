import "dotenv/config";
import {
  Client,
  Events,
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

/** Maximum time to wait for the gateway to reach READY before giving up. */
const LOGIN_TIMEOUT_MS = 30_000;

/**
 * Reads a boolean env flag, defaulting to `true`. Set to false/0/no/off to disable.
 * Used to opt out of the two privileged intents when they are not enabled in the
 * Discord Developer Portal (otherwise the gateway closes with code 4014 on connect).
 */
function envEnabled(name: string): boolean {
  const value = process.env[name];
  return value === undefined || !/^(false|0|no|off)$/i.test(value.trim());
}

const messageContentEnabled = envEnabled("DISCORD_MESSAGE_CONTENT");
const guildMembersEnabled = envEnabled("DISCORD_GUILD_MEMBERS");

export const discord = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildScheduledEvents,
    ...(messageContentEnabled ? [GatewayIntentBits.MessageContent] : []),
    ...(guildMembersEnabled ? [GatewayIntentBits.GuildMembers] : []),
  ],
  rest: { retries: 3, timeout: 15_000 },
});

let discordReady = false;
let loginPromise: Promise<void> | null = null;

// Without an 'error' listener, an emitted client error crashes the Node process.
discord.on(Events.Error, (err) => console.error("Discord client error:", err.message));
discord.on(Events.ShardError, (err) => console.error("Discord shard error:", err.message));
discord.on(Events.Invalidated, () => {
  console.error(
    "Discord session invalidated — connection is dead; the next tool call will re-login.",
  );
  discordReady = false;
  loginPromise = null;
});

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Lazily connects to Discord on first tool call.
 * Allows the MCP server to start and respond to ListTools without a connection.
 */
export async function ensureConnected(): Promise<void> {
  if (discordReady) return;

  if (!DISCORD_TOKEN) {
    throw new Error("DISCORD_TOKEN is required. Set it in your MCP client config or a .env file.");
  }

  if (!loginPromise) {
    loginPromise = new Promise<void>((resolve, reject) => {
      const onReady = () => {
        clearTimeout(timer);
        discordReady = true;
        console.error(`✅  Discord bot connected as ${discord.user?.tag}`);
        resolve();
      };
      const timer = setTimeout(() => {
        discord.off(Events.ClientReady, onReady);
        loginPromise = null;
        reject(
          new Error(
            `Discord did not reach READY within ${LOGIN_TIMEOUT_MS / 1000}s. Check the token and that the Server Members / Message Content privileged intents are enabled in the Developer Portal, or disable them via DISCORD_GUILD_MEMBERS=false / DISCORD_MESSAGE_CONTENT=false.`,
          ),
        );
      }, LOGIN_TIMEOUT_MS);
      discord.once(Events.ClientReady, onReady);
      discord.login(DISCORD_TOKEN).catch((err) => {
        clearTimeout(timer);
        discord.off(Events.ClientReady, onReady);
        loginPromise = null;
        reject(new Error(`Discord login failed: ${err.message}`));
      });
    });
  }

  await loginPromise;
}

/** Reads DISCORD_ALLOWED_GUILDS lazily so module import order cannot freeze an empty list. */
function allowedGuilds(): string[] {
  return (process.env.DISCORD_ALLOWED_GUILDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function allowListActive(): boolean {
  return allowedGuilds().length > 0;
}

export function isGuildAllowed(guildId: string): boolean {
  const list = allowedGuilds();
  return list.length === 0 || list.includes(guildId);
}

/**
 * Central allow-list gate for resources reached without a guild_id input
 * (channel/thread/webhook IDs resolve to a guild only after fetching).
 */
export function assertAllowedGuild(guildId: string | null | undefined): void {
  if (guildId && !isGuildAllowed(guildId))
    throw new Error(`Guild ${guildId} is not in the DISCORD_ALLOWED_GUILDS allow-list.`);
}

/** Fetches a channel and enforces the guild allow-list before returning it. */
export async function fetchChannelChecked(channelId: string) {
  const channel = await discord.channels.fetch(channelId);
  if (channel && "guildId" in channel) assertAllowedGuild(channel.guildId);
  return channel;
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
  const id = validateId(channelId, "channel_id");
  const channel = await fetchChannelChecked(id);
  if (!channel || (!(channel instanceof TextChannel) && !(channel instanceof ThreadChannel)))
    throw new Error(`Channel ${id} is not a text or thread channel or doesn't exist.`);
  return channel;
}

/**
 * Fetches a channel by ID and guarantees it is a guild channel (text, voice, or category).
 * @param channelId - Discord snowflake ID of the channel.
 * @returns The resolved GuildChannel instance.
 * @throws {Error} If the channel does not exist or is not a guild channel.
 */
export async function getGuildChannel(channelId: string): Promise<GuildChannel> {
  const id = validateId(channelId, "channel_id");
  const channel = await fetchChannelChecked(id);
  if (!channel || !(channel instanceof GuildChannel))
    throw new Error(`Channel ${id} is not a guild channel or doesn't exist.`);
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
  if (!/^\d{17,20}$/.test(id))
    throw new Error(`Invalid ${label}: "${id}". Must be a Discord snowflake ID (17-20 digits).`);
  return id;
}

/**
 * Converts a PermissionsBitField into a human-readable array of permission names.
 * @param perms - The bitfield to serialize.
 * @returns Array of permission flag names (e.g. ["SendMessages", "ViewChannel"]).
 */
export function serializePermissions(perms: Readonly<PermissionsBitField>): string[] {
  return Object.keys(PermissionsBitField.Flags).filter((flag) =>
    perms.has(flag as keyof typeof PermissionsBitField.Flags),
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
    names.map((p) => PermissionsBitField.Flags[p as keyof typeof PermissionsBitField.Flags]),
  );
}
