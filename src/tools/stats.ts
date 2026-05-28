import { ChannelType } from "discord.js";
import { discord, validateId } from "../client.js";
import type { ToolModule, ToolResult } from "./types.js";

/** Tool definitions for server statistics (members, channels, boosts). */
export const definitions = [
  {
    name: "discord_get_server_stats",
    description:
      "Get a snapshot of server metrics: total members (humans vs cached bots), channel breakdown (text/voice/category), role count, boost tier and count, and creation date. Read-only. Returns a JSON object. Note: the bot count reflects only members currently in cache.",
    annotations: { title: "Get server stats", readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: { guild_id: { type: "string", description: "Discord server (guild) ID (snowflake)." } },
      required: ["guild_id"],
    },
  },
];

/**
 * Handles stats tools: returns a snapshot of server metrics
 * including member counts, channel breakdown, and boost info.
 */
export async function handle(name: string, args: Record<string, unknown>): Promise<ToolResult | null> {
  switch (name) {
    case "discord_get_server_stats": {
      const guild = await (await discord.guilds.fetch(validateId(args.guild_id, "guild_id"))).fetch();
      await guild.channels.fetch();
      const cachedBots = guild.members.cache.filter((m) => m.user.bot).size;
      return {
        content: [{
          type: "text", text: JSON.stringify({
            name: guild.name, totalMembers: guild.memberCount,
            humans: guild.memberCount - cachedBots, botsInCache: cachedBots,
            channels: {
              total: guild.channels.cache.size,
              text: guild.channels.cache.filter((c) => c.type === ChannelType.GuildText).size,
              voice: guild.channels.cache.filter((c) => c.type === ChannelType.GuildVoice).size,
              categories: guild.channels.cache.filter((c) => c.type === ChannelType.GuildCategory).size,
            },
            roles: guild.roles.cache.size - 1,
            boostLevel: guild.premiumTier, boostCount: guild.premiumSubscriptionCount ?? 0,
            createdAt: guild.createdAt.toISOString(),
          }, null, 2),
        }],
      };
    }

    default:
      return null;
  }
}

export default { definitions, handle } satisfies ToolModule;
