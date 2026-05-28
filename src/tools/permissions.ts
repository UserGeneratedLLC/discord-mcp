import { PermissionOverwriteOptions, GuildChannel } from "discord.js";
import { discord, getGuildChannel, serializePermissions, validateId } from "../client.js";
import type { ToolModule, ToolResult } from "./types.js";

/** Tool definitions for viewing and managing per-channel permission overwrites. */
export const definitions = [
  {
    name: "discord_get_channel_permissions",
    description:
      "List every permission overwrite on a channel, per role and per member, with the allowed and denied permission flags for each. Read-only. Use discord_audit_permissions for a server-wide report across all channels.",
    annotations: { title: "Get channel permissions", readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: { channel_id: { type: "string", description: "ID (snowflake) of the channel to inspect." } },
      required: ["channel_id"],
    },
  },
  {
    name: "discord_set_role_permission",
    description:
      "Add or update a per-channel permission overwrite for a role, allowing and/or denying specific permissions. Merges with the role's existing overwrite (does not reset it). Requires the Manage Roles permission. Use discord_set_member_permission to target a single member instead.",
    annotations: { title: "Set role channel permission", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "ID (snowflake) of the channel to set the overwrite on." },
        role_id: { type: "string", description: "ID (snowflake) of the role to grant/deny permissions for." },
        allow: { type: "array", items: { type: "string" }, description: "Permission flag names to allow, e.g. ['SendMessages','ViewChannel']. Uses Discord PermissionsBitField flag names." },
        deny: { type: "array", items: { type: "string" }, description: "Permission flag names to deny, e.g. ['SendMessages']." },
        reason: { type: "string", description: "Optional reason recorded in the server audit log." },
      },
      required: ["channel_id", "role_id"],
    },
  },
  {
    name: "discord_set_member_permission",
    description:
      "Add or update a per-channel permission overwrite for a single member, allowing and/or denying specific permissions. Merges with the member's existing overwrite. Requires the Manage Roles permission. Use discord_set_role_permission to target a whole role instead.",
    annotations: { title: "Set member channel permission", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "ID (snowflake) of the channel to set the overwrite on." },
        user_id: { type: "string", description: "ID (snowflake) of the member to grant/deny permissions for." },
        allow: { type: "array", items: { type: "string" }, description: "Permission flag names to allow, e.g. ['ViewChannel']. Uses Discord PermissionsBitField flag names." },
        deny: { type: "array", items: { type: "string" }, description: "Permission flag names to deny." },
        reason: { type: "string", description: "Optional reason recorded in the server audit log." },
      },
      required: ["channel_id", "user_id"],
    },
  },
  {
    name: "discord_reset_channel_permissions",
    description:
      "Remove ALL permission overwrites on a channel, resetting it to inherit from its category/server defaults. IRREVERSIBLE — the cleared overwrites cannot be recovered. Requires the Manage Roles permission.",
    annotations: { title: "Reset channel permissions", readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "ID (snowflake) of the channel whose overwrites will be cleared." },
        reason: { type: "string", description: "Optional reason recorded in the server audit log." },
      },
      required: ["channel_id"],
    },
  },
  {
    name: "discord_copy_permissions",
    description:
      "Replace the target channel's permission overwrites with a copy of the source channel's. The target's existing overwrites are overwritten. Requires the Manage Roles permission. Returns a confirmation.",
    annotations: { title: "Copy channel permissions", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        source_channel_id: { type: "string", description: "ID (snowflake) of the channel to copy overwrites from." },
        target_channel_id: { type: "string", description: "ID (snowflake) of the channel whose overwrites will be replaced." },
        reason: { type: "string", description: "Optional reason recorded in the server audit log." },
      },
      required: ["source_channel_id", "target_channel_id"],
    },
  },
  {
    name: "discord_audit_permissions",
    description:
      "Generate a server-wide permission report: for every channel that has overwrites, lists each role/member and their allowed/denied permissions (entity names resolved). Read-only. Returns a JSON array. Use discord_get_channel_permissions for a single channel.",
    annotations: { title: "Audit permissions", readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: { guild_id: { type: "string", description: "Discord server (guild) ID (snowflake) to audit." } },
      required: ["guild_id"],
    },
  },
];

/**
 * Parses a permission array from tool arguments.
 * Accepts an array directly or a JSON-encoded string.
 */
function parsePermArray(value: unknown): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return JSON.parse(value);
  return [];
}

/**
 * Handles permission tools: view overwrites, set per-role/per-member permissions,
 * reset to inherited, copy between channels, and full guild audit.
 */
export async function handle(name: string, args: Record<string, unknown>): Promise<ToolResult | null> {
  switch (name) {
    case "discord_get_channel_permissions": {
      const channel = await getGuildChannel(args.channel_id as string);
      const overwrites = channel.permissionOverwrites.cache.map((ow) => ({
        id: ow.id,
        type: ow.type === 0 ? "role" : "member",
        allow: serializePermissions(ow.allow),
        deny: serializePermissions(ow.deny),
      }));
      return { content: [{ type: "text", text: JSON.stringify(overwrites, null, 2) }] };
    }

    case "discord_set_role_permission": {
      const channel = await getGuildChannel(args.channel_id as string);
      const options: PermissionOverwriteOptions = {};
      parsePermArray(args.allow).forEach((p) => { (options as Record<string, boolean>)[p] = true; });
      parsePermArray(args.deny).forEach((p) => { (options as Record<string, boolean>)[p] = false; });
      await channel.permissionOverwrites.edit(args.role_id as string, options, { reason: args.reason as string | undefined });
      return { content: [{ type: "text", text: `✅ Permissions updated for role ${args.role_id} on #${channel.name}.` }] };
    }

    case "discord_set_member_permission": {
      const channel = await getGuildChannel(args.channel_id as string);
      const options: PermissionOverwriteOptions = {};
      parsePermArray(args.allow).forEach((p) => { (options as Record<string, boolean>)[p] = true; });
      parsePermArray(args.deny).forEach((p) => { (options as Record<string, boolean>)[p] = false; });
      await channel.permissionOverwrites.edit(args.user_id as string, options, { reason: args.reason as string | undefined });
      return { content: [{ type: "text", text: `✅ Permissions updated for member ${args.user_id} on #${channel.name}.` }] };
    }

    case "discord_reset_channel_permissions": {
      const channel = await getGuildChannel(args.channel_id as string);
      await channel.permissionOverwrites.set([], args.reason as string | undefined);
      return { content: [{ type: "text", text: `✅ All permission overwrites cleared on #${channel.name}.` }] };
    }

    case "discord_copy_permissions": {
      const source = await getGuildChannel(args.source_channel_id as string);
      const target = await getGuildChannel(args.target_channel_id as string);
      const overwrites = source.permissionOverwrites.cache.map((ow) => ({
        id: ow.id, type: ow.type, allow: ow.allow, deny: ow.deny,
      }));
      await target.permissionOverwrites.set(overwrites, args.reason as string | undefined);
      return { content: [{ type: "text", text: `✅ Permissions copied from #${source.name} to #${target.name}.` }] };
    }

    case "discord_audit_permissions": {
      const guild = await discord.guilds.fetch(validateId(args.guild_id, "guild_id"));
      await guild.channels.fetch();
      await guild.roles.fetch();
      const memberIdsNeeded = new Set<string>();
      guild.channels.cache.forEach((ch) => {
        if (ch instanceof GuildChannel) {
          ch.permissionOverwrites.cache.forEach((ow) => {
            if (ow.type === 1) memberIdsNeeded.add(ow.id);
          });
        }
      });
      await Promise.all([...memberIdsNeeded].map((id) => guild.members.fetch(id).catch(() => null)));
      const report: Record<string, unknown>[] = [];
      guild.channels.cache
        .filter((c) => c instanceof GuildChannel)
        .forEach((ch) => {
          const gch = ch as GuildChannel;
          const overwrites = gch.permissionOverwrites.cache.map((ow) => {
            const isRole = ow.type === 0;
            const entity = isRole
              ? guild.roles.cache.get(ow.id)?.name ?? ow.id
              : guild.members.cache.get(ow.id)?.user.tag ?? ow.id;
            return { entity, type: isRole ? "role" : "member", allow: serializePermissions(ow.allow), deny: serializePermissions(ow.deny) };
          });
          if (overwrites.length > 0) report.push({ channel: gch.name, channelId: gch.id, overwrites });
        });
      return { content: [{ type: "text", text: JSON.stringify(report, null, 2) }] };
    }

    default:
      return null;
  }
}

export default { definitions, handle } satisfies ToolModule;
