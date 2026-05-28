import { discord, validateId } from "../client.js";
import type { ToolModule, ToolResult } from "./types.js";

/** Tool definitions for managing guild invites. */
export const definitions = [
  {
    name: "discord_list_invites",
    description:
      "List all active invites across a server (code, url, channel, inviter, uses, expiry). Requires the Manage Server permission. Read-only. Use discord_list_channel_invites to scope to one channel.",
    annotations: { title: "List invites", readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        guild_id: { type: "string", description: "Discord server (guild) ID (snowflake)." },
      },
      required: ["guild_id"],
    },
  },
  {
    name: "discord_get_invite",
    description:
      "Look up details for a single invite by its code, including the target server/channel and usage stats. Works for any public invite, not just this server's. Read-only. Returns a JSON object.",
    annotations: { title: "Get invite", readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        invite_code: {
          type: "string",
          description: "The invite code, e.g. 'abc123'. A full discord.gg/abc123 URL is also accepted and stripped.",
        },
      },
      required: ["invite_code"],
    },
  },
  {
    name: "discord_create_invite",
    description:
      "Create an invite link for a channel, optionally limiting its lifetime, uses, and membership type. SECURITY: anyone with the returned link can join the server. Requires the Create Instant Invite permission. Returns the invite URL and code.",
    annotations: { title: "Create invite", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "ID (snowflake) of the channel the invite leads to." },
        max_age: {
          type: "number",
          description: "Invite lifetime in seconds; 0 means it never expires. Default 86400 (24h).",
        },
        max_uses: {
          type: "number",
          description: "Maximum number of uses; 0 means unlimited. Default 0.",
        },
        unique: {
          type: "boolean",
          description: "If true, always mint a fresh invite instead of reusing an equivalent existing one. Default false.",
        },
        temporary: {
          type: "boolean",
          description: "If true, members who join via this invite are removed when they disconnect (unless they get a role). Default false.",
        },
      },
      required: ["channel_id"],
    },
  },
  {
    name: "discord_delete_invite",
    description:
      "Revoke an invite by its code so it can no longer be used. IRREVERSIBLE (the code is freed). Requires the Manage Channels permission (or Manage Server). The reason is recorded in the audit log.",
    annotations: { title: "Delete invite", readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        invite_code: {
          type: "string",
          description: "The invite code to revoke. A full discord.gg/<code> URL is also accepted.",
        },
        reason: { type: "string", description: "Optional reason recorded in the server audit log." },
      },
      required: ["invite_code"],
    },
  },
  {
    name: "discord_list_channel_invites",
    description:
      "List the active invites that point to one specific channel. Unlike discord_list_invites (server-wide), this scopes results to a single channel. Requires the Manage Channels permission. Read-only.",
    annotations: { title: "List channel invites", readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "ID (snowflake) of the channel to list invites for." },
      },
      required: ["channel_id"],
    },
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────────

function serializeInvite(invite: import("discord.js").Invite) {
  return {
    code: invite.code,
    url: invite.url,
    channel_id: invite.channelId ?? null,
    channel_name: invite.channel?.name ?? null,
    inviter: invite.inviter
      ? { id: invite.inviter.id, username: invite.inviter.username }
      : null,
    uses: invite.uses ?? 0,
    max_uses: invite.maxUses ?? 0,
    max_age: invite.maxAge ?? 0,
    temporary: invite.temporary ?? false,
    created_at: invite.createdAt?.toISOString() ?? null,
    expires_at: invite.expiresAt?.toISOString() ?? null,
  };
}

// ─── Handler ────────────────────────────────────────────────────────────────────

export async function handle(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult | null> {
  switch (name) {
    case "discord_list_invites": {
      const guildId = validateId(args.guild_id, "guild_id");
      const guild = await discord.guilds.fetch(guildId);
      const invites = await guild.invites.fetch();
      const list = [...invites.values()].map(serializeInvite);
      return { content: [{ type: "text", text: JSON.stringify(list, null, 2) }] };
    }

    case "discord_get_invite": {
      const code = String(args.invite_code ?? "").replace(/^(https?:\/\/)?(discord\.gg\/)?/, "");
      if (!code) throw new Error("invite_code is required.");
      const invite = await discord.fetchInvite(code);
      return { content: [{ type: "text", text: JSON.stringify(serializeInvite(invite), null, 2) }] };
    }

    case "discord_create_invite": {
      const channelId = validateId(args.channel_id, "channel_id");
      const channel = await discord.channels.fetch(channelId);
      if (!channel || !("createInvite" in channel)) {
        throw new Error(`Channel ${channelId} does not support invites.`);
      }

      const invite = await (channel as any).createInvite({
        maxAge: Number(args.max_age ?? 86400),
        maxUses: Number(args.max_uses ?? 0),
        unique: Boolean(args.unique ?? false),
        temporary: Boolean(args.temporary ?? false),
      });
      return {
        content: [{ type: "text", text: `✅ Invite created: ${invite.url} (code: ${invite.code}, max_age: ${invite.maxAge}s, max_uses: ${invite.maxUses}).` }],
      };
    }

    case "discord_delete_invite": {
      const code = String(args.invite_code ?? "").replace(/^(https?:\/\/)?(discord\.gg\/)?/, "");
      if (!code) throw new Error("invite_code is required.");
      const invite = await discord.fetchInvite(code);
      await invite.delete(args.reason ? String(args.reason) : undefined);
      return {
        content: [{ type: "text", text: `✅ Invite "${code}" deleted.` }],
      };
    }

    case "discord_list_channel_invites": {
      const channelId = validateId(args.channel_id, "channel_id");
      const channel = await discord.channels.fetch(channelId);
      if (!channel || !("fetchInvites" in channel)) {
        throw new Error(`Channel ${channelId} does not support invites.`);
      }
      const invites = await (channel as any).fetchInvites();
      const list = [...invites.values()].map(serializeInvite);
      return { content: [{ type: "text", text: JSON.stringify(list, null, 2) }] };
    }

    default:
      return null;
  }
}

export default { definitions, handle } satisfies ToolModule;
