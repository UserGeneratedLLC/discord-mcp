import { GuildMember } from "discord.js";
import { discord, serializePermissions, validateId } from "../client.js";
import { MAX_FETCH_LIMIT, DEFAULTS } from "../constants.js";
import type { ToolModule, ToolResult } from "./types.js";

/** Tool definitions for listing, inspecting, and moderating guild members. */
export const definitions = [
  {
    name: "discord_list_members",
    description:
      "List members of a server with their roles, in join order. Returns a JSON array (id, username, nickname, roles, join date). Use discord_search_members to find specific members by name, or discord_get_member_info for one member's full details. Read-only.",
    annotations: { title: "List members", readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        guild_id: { type: "string", description: "Discord server (guild) ID (snowflake)." },
        limit: { type: "number", description: "How many members to return (1–1000). Default 50." },
      },
      required: ["guild_id"],
    },
  },
  {
    name: "discord_get_member_info",
    description:
      "Get full details for one server member: roles, effective permissions, account/join dates, bot flag, and current timeout status. Read-only. Returns a JSON object.",
    annotations: { title: "Get member info", readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        guild_id: { type: "string", description: "Discord server (guild) ID (snowflake)." },
        user_id: { type: "string", description: "Discord user ID (snowflake) of the member." },
      },
      required: ["guild_id", "user_id"],
    },
  },
  {
    name: "discord_kick_member",
    description:
      "Remove a member from the server. They can rejoin with a new invite (unlike a ban). Requires the Kick Members permission, and the bot's top role must be higher than the target's. Use discord_ban_member to block re-entry. The reason is recorded in the audit log.",
    annotations: { title: "Kick member", readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        guild_id: { type: "string", description: "Discord server (guild) ID (snowflake)." },
        user_id: { type: "string", description: "Discord user ID (snowflake) of the member to kick." },
        reason: { type: "string", description: "Optional reason recorded in the server audit log." },
      },
      required: ["guild_id", "user_id"],
    },
  },
  {
    name: "discord_ban_member",
    description:
      "Ban a user from the server, blocking re-entry until unbanned. Optionally bulk-deletes their recent messages. Requires the Ban Members permission, and the bot's top role must outrank the target's. Use discord_unban_member to reverse, or discord_kick_member for a non-permanent removal. The reason is recorded in the audit log.",
    annotations: { title: "Ban member", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        guild_id: { type: "string", description: "Discord server (guild) ID (snowflake)." },
        user_id: { type: "string", description: "Discord user ID (snowflake) of the user to ban." },
        reason: { type: "string", description: "Optional reason recorded in the server audit log." },
        delete_message_days: { type: "number", description: "Also delete the user's messages from the last N days (0–7). Default 0 (delete nothing)." },
      },
      required: ["guild_id", "user_id"],
    },
  },
  {
    name: "discord_unban_member",
    description:
      "Lift a ban so the user may rejoin via a new invite. Requires the Ban Members permission. Reverses discord_ban_member. The reason is recorded in the audit log.",
    annotations: { title: "Unban member", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        guild_id: { type: "string", description: "Discord server (guild) ID (snowflake)." },
        user_id: { type: "string", description: "Discord user ID (snowflake) of the banned user to unban." },
        reason: { type: "string", description: "Optional reason recorded in the server audit log." },
      },
      required: ["guild_id", "user_id"],
    },
  },
  {
    name: "discord_timeout_member",
    description:
      "Mute a member for a set duration (Discord 'timeout'): they cannot send messages, react, or speak until it expires. Pass duration_minutes = 0 to remove an active timeout early. Max 28 days (40320 minutes). Requires the Moderate Members permission.",
    annotations: { title: "Timeout member", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        guild_id: { type: "string", description: "Discord server (guild) ID (snowflake)." },
        user_id: { type: "string", description: "Discord user ID (snowflake) of the member to time out." },
        duration_minutes: { type: "number", description: "Timeout length in minutes (1–40320, i.e. up to 28 days). Use 0 to clear an existing timeout." },
        reason: { type: "string", description: "Optional reason recorded in the server audit log." },
      },
      required: ["guild_id", "user_id", "duration_minutes"],
    },
  },
  {
    name: "discord_search_members",
    description:
      "Find server members whose username or nickname starts with a query string (prefix match). Returns a JSON array (id, username, nickname, roles). Use discord_list_members to page through everyone. Read-only.",
    annotations: { title: "Search members", readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        guild_id: { type: "string", description: "Discord server (guild) ID (snowflake)." },
        query: { type: "string", description: "Prefix to match against usernames and nicknames." },
        limit: { type: "number", description: "Max members to return (1–100). Default 25." },
      },
      required: ["guild_id", "query"],
    },
  },
  {
    name: "discord_set_nickname",
    description:
      "Set or clear a member's server nickname. Pass null (or the string 'null') to clear it. Requires the Manage Nicknames permission (or Change Nickname for the bot itself). The reason is recorded in the audit log.",
    annotations: { title: "Set nickname", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        guild_id: { type: "string", description: "Discord server (guild) ID (snowflake)." },
        user_id: { type: "string", description: "Discord user ID (snowflake) of the member." },
        nickname: { type: "string", description: "New nickname (max 32 characters), or null to clear it." },
        reason: { type: "string", description: "Optional reason recorded in the server audit log." },
      },
      required: ["guild_id", "user_id", "nickname"],
    },
  },
  {
    name: "discord_list_bans",
    description:
      "List the users currently banned from the server, with their ban reasons. Returns a JSON array (user_id, username, reason). Requires the Ban Members permission. Read-only.",
    annotations: { title: "List bans", readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        guild_id: { type: "string", description: "Discord server (guild) ID (snowflake)." },
        limit: { type: "number", description: "Optional max number of bans to fetch. Omit to fetch all." },
      },
      required: ["guild_id"],
    },
  },
  {
    name: "discord_bulk_ban",
    description:
      "Ban many users in a single call, intended for raid mitigation. Requires the Ban Members permission. Returns counts of banned vs failed users. Use discord_ban_member for a single ban with finer control.",
    annotations: { title: "Bulk ban", readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        guild_id: { type: "string", description: "Discord server (guild) ID (snowflake)." },
        user_ids: { type: "array", items: { type: "string" }, description: "Array of user IDs (snowflakes) to ban." },
        delete_message_seconds: { type: "number", description: "Also delete each user's messages from the last N seconds (0–604800, i.e. up to 7 days). Default 0." },
        reason: { type: "string", description: "Optional reason recorded in the server audit log." },
      },
      required: ["guild_id", "user_ids"],
    },
  },
  {
    name: "discord_prune_members",
    description:
      "Remove members who have been inactive (no roles, not seen) for a number of days. SAFE BY DEFAULT: dry_run is true unless explicitly set to false, so call it first to preview the count, then re-call with dry_run:false to actually remove them. Removal is irreversible (members must rejoin). Requires the Kick Members permission.",
    annotations: { title: "Prune inactive members", readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        guild_id: { type: "string", description: "Discord server (guild) ID (snowflake)." },
        days: { type: "number", description: "Inactivity threshold in days (1–30)." },
        roles: { type: "array", items: { type: "string" }, description: "Optional role IDs (snowflakes) to include; by default only members with no roles are counted." },
        dry_run: { type: "boolean", description: "If true (default), only returns the count that would be pruned without removing anyone. Set false to actually prune." },
        reason: { type: "string", description: "Optional reason recorded in the server audit log." },
      },
      required: ["guild_id", "days"],
    },
  },
];

/**
 * Handles member tools: list with roles, detailed info,
 * kick, ban, unban, and timeout management.
 */
export async function handle(name: string, args: Record<string, unknown>): Promise<ToolResult | null> {
  switch (name) {
    case "discord_list_members": {
      const guild = await discord.guilds.fetch(validateId(args.guild_id, "guild_id"));
      const limit = Math.min(Number(args.limit ?? DEFAULTS.MEMBERS), DEFAULTS.MEMBERS_MAX);
      const members = await guild.members.list({ limit });
      const result = [...members.values()].map((m: GuildMember) => ({
        id: m.id, username: m.user.tag, nickname: m.nickname,
        roles: m.roles.cache.filter((r) => r.name !== "@everyone").map((r) => ({ id: r.id, name: r.name })),
        joinedAt: m.joinedAt?.toISOString(),
      }));
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    case "discord_get_member_info": {
      const guild = await discord.guilds.fetch(validateId(args.guild_id, "guild_id"));
      const member = await guild.members.fetch(args.user_id as string);
      return {
        content: [{
          type: "text", text: JSON.stringify({
            id: member.id, username: member.user.tag, nickname: member.nickname,
            roles: member.roles.cache.filter((r) => r.name !== "@everyone").map((r) => ({ id: r.id, name: r.name })),
            permissions: serializePermissions(member.permissions),
            joinedAt: member.joinedAt?.toISOString(), createdAt: member.user.createdAt.toISOString(),
            bot: member.user.bot, timedOutUntil: member.communicationDisabledUntil?.toISOString() ?? null,
          }, null, 2),
        }],
      };
    }

    case "discord_kick_member": {
      const guild = await discord.guilds.fetch(validateId(args.guild_id, "guild_id"));
      const member = await guild.members.fetch(args.user_id as string);
      await member.kick(args.reason as string | undefined);
      return { content: [{ type: "text", text: `✅ ${member.user.tag} has been kicked.` }] };
    }

    case "discord_ban_member": {
      const guild = await discord.guilds.fetch(validateId(args.guild_id, "guild_id"));
      const deleteDays = Math.min(Math.max(Number(args.delete_message_days ?? 0), 0), 7);
      await guild.members.ban(args.user_id as string, {
        reason: args.reason as string | undefined,
        deleteMessageSeconds: deleteDays * 86400,
      });
      return { content: [{ type: "text", text: `✅ User ${args.user_id} has been banned.` }] };
    }

    case "discord_unban_member": {
      const guild = await discord.guilds.fetch(validateId(args.guild_id, "guild_id"));
      await guild.members.unban(args.user_id as string, args.reason as string | undefined);
      return { content: [{ type: "text", text: `✅ User ${args.user_id} has been unbanned.` }] };
    }

    case "discord_timeout_member": {
      const guild = await discord.guilds.fetch(validateId(args.guild_id, "guild_id"));
      const member = await guild.members.fetch(args.user_id as string);
      const duration = args.duration_minutes as number;
      const until = duration > 0 ? new Date(Date.now() + duration * 60 * 1000) : null;
      await member.disableCommunicationUntil(until, args.reason as string | undefined);
      return {
        content: [{
          type: "text",
          text: duration > 0 ? `✅ ${member.user.tag} is in timeout for ${duration} minutes.` : `✅ Timeout removed from ${member.user.tag}.`,
        }],
      };
    }

    case "discord_search_members": {
      const guild = await discord.guilds.fetch(validateId(args.guild_id, "guild_id"));
      const limit = Math.min(Number(args.limit ?? DEFAULTS.LIMIT), MAX_FETCH_LIMIT);
      const members = await guild.members.search({ query: args.query as string, limit });
      const result = [...members.values()].map((m: GuildMember) => ({
        id: m.id, username: m.user.tag, nickname: m.nickname,
        roles: m.roles.cache.filter((r) => r.name !== "@everyone").map((r) => ({ id: r.id, name: r.name })),
      }));
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    case "discord_set_nickname": {
      const guild = await discord.guilds.fetch(validateId(args.guild_id, "guild_id"));
      const member = await guild.members.fetch(args.user_id as string);
      const nick = args.nickname === null || args.nickname === "null" ? null : String(args.nickname);
      await member.setNickname(nick, args.reason as string | undefined);
      return { content: [{ type: "text", text: nick ? `✅ Nickname for ${member.user.tag} set to "${nick}".` : `✅ Nickname cleared for ${member.user.tag}.` }] };
    }

    case "discord_list_bans": {
      const guild = await discord.guilds.fetch(validateId(args.guild_id, "guild_id"));
      const limit = args.limit ? Number(args.limit) : undefined;
      const bans = await guild.bans.fetch({ limit, cache: false });
      const result = [...bans.values()].map((ban) => ({
        user_id: ban.user.id, username: ban.user.tag, reason: ban.reason ?? null,
      }));
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    case "discord_bulk_ban": {
      const guild = await discord.guilds.fetch(validateId(args.guild_id, "guild_id"));
      const userIds = args.user_ids as string[];
      if (!Array.isArray(userIds) || userIds.length === 0) throw new Error("user_ids must be a non-empty array.");
      const result = await guild.members.bulkBan(userIds, {
        deleteMessageSeconds: Number(args.delete_message_seconds ?? 0),
        reason: args.reason as string | undefined,
      });
      return { content: [{ type: "text", text: `✅ Bulk ban complete: ${result.bannedUsers.length} banned, ${result.failedUsers.length} failed.` }] };
    }

    case "discord_prune_members": {
      const guild = await discord.guilds.fetch(validateId(args.guild_id, "guild_id"));
      const days = Number(args.days);
      const dryRun = args.dry_run !== false;
      const roles = args.roles as string[] | undefined;
      const pruned = await guild.members.prune({
        days,
        dry: dryRun,
        roles: roles ?? undefined,
        reason: args.reason as string | undefined,
      });
      return { content: [{ type: "text", text: dryRun ? `🔍 Dry run: ${pruned} members would be pruned (${days} days inactive).` : `✅ ${pruned} members pruned (${days} days inactive).` }] };
    }

    default:
      return null;
  }
}

export default { definitions, handle } satisfies ToolModule;
