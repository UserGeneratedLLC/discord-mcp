import { ColorResolvable, Role, Guild } from "discord.js";
import { discord, serializePermissions, deserializePermissions, validateId } from "../client.js";
import type { ToolModule, ToolResult } from "./types.js";

/** Tool definitions for creating, editing, deleting, and assigning roles. */
export const definitions = [
  {
    name: "discord_list_roles",
    description:
      "List all roles in a server (excluding @everyone), highest-first, with color, position, member count, and permissions. Read-only. Returns a JSON array. Use discord_get_role_members to see who holds a given role.",
    annotations: { title: "List roles", readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: { guild_id: { type: "string", description: "Discord server (guild) ID (snowflake)." } },
      required: ["guild_id"],
    },
  },
  {
    name: "discord_create_role",
    description:
      "Create a new role in a server. Requires the Manage Roles permission; the new role is placed below the bot's highest role. Use discord_add_role to then assign it to members. Returns the new role's name and ID.",
    annotations: { title: "Create role", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        guild_id: { type: "string", description: "Discord server (guild) ID (snowflake)." },
        name: { type: "string", description: "Name of the new role (max 100 characters)." },
        color: { type: "string", description: "Role color as a hex string, e.g. '#FF5733'." },
        hoist: { type: "boolean", description: "If true, display members with this role separately in the member list." },
        mentionable: { type: "boolean", description: "If true, anyone can @mention this role." },
        permissions: { type: "array", items: { type: "string" }, description: "Server-wide permission flag names to grant, e.g. ['SendMessages','ViewChannel']. Uses Discord PermissionsBitField flag names." },
      },
      required: ["guild_id", "name"],
    },
  },
  {
    name: "discord_edit_role",
    description:
      "Update an existing role's name, color, permissions, hoist, or mentionable flag. Only provided fields change; passing permissions REPLACES the role's full permission set. Requires the Manage Roles permission, and the role must be below the bot's highest role.",
    annotations: { title: "Edit role", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        guild_id: { type: "string", description: "Discord server (guild) ID (snowflake)." },
        role_id: { type: "string", description: "ID (snowflake) of the role to edit." },
        name: { type: "string", description: "New role name (max 100 characters)." },
        color: { type: "string", description: "New role color as a hex string, e.g. '#FF5733'." },
        hoist: { type: "boolean", description: "If true, display members with this role separately in the member list." },
        mentionable: { type: "boolean", description: "If true, anyone can @mention this role." },
        permissions: { type: "array", items: { type: "string" }, description: "Permission flag names. Providing this REPLACES the role's entire permission set. Uses Discord PermissionsBitField flag names." },
      },
      required: ["guild_id", "role_id"],
    },
  },
  {
    name: "discord_delete_role",
    description:
      "Permanently delete a role from the server; it is automatically removed from every member who held it. IRREVERSIBLE. Requires the Manage Roles permission, and the role must be below the bot's highest role.",
    annotations: { title: "Delete role", readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        guild_id: { type: "string", description: "Discord server (guild) ID (snowflake)." },
        role_id: { type: "string", description: "ID (snowflake) of the role to delete." },
        reason: { type: "string", description: "Optional reason recorded in the server audit log." },
      },
      required: ["guild_id", "role_id"],
    },
  },
  {
    name: "discord_add_role",
    description:
      "Assign an existing role to a member. Requires the Manage Roles permission, and the role must be below the bot's highest role. Idempotent: assigning a role the member already has has no effect. Use discord_remove_role to undo.",
    annotations: { title: "Add role to member", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        guild_id: { type: "string", description: "Discord server (guild) ID (snowflake)." },
        user_id: { type: "string", description: "Discord user ID (snowflake) of the member to give the role to." },
        role_id: { type: "string", description: "ID (snowflake) of the role to assign." },
        reason: { type: "string", description: "Optional reason recorded in the server audit log." },
      },
      required: ["guild_id", "user_id", "role_id"],
    },
  },
  {
    name: "discord_remove_role",
    description:
      "Remove a role from a member. Requires the Manage Roles permission, and the role must be below the bot's highest role. Idempotent: removing a role the member doesn't have has no effect. Reverses discord_add_role.",
    annotations: { title: "Remove role from member", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        guild_id: { type: "string", description: "Discord server (guild) ID (snowflake)." },
        user_id: { type: "string", description: "Discord user ID (snowflake) of the member to remove the role from." },
        role_id: { type: "string", description: "ID (snowflake) of the role to remove." },
        reason: { type: "string", description: "Optional reason recorded in the server audit log." },
      },
      required: ["guild_id", "user_id", "role_id"],
    },
  },
  {
    name: "discord_get_role_members",
    description:
      "List every member who currently holds a specific role. Returns a JSON array (id, username, nickname). Read-only. Use discord_list_roles to discover role IDs first.",
    annotations: { title: "Get role members", readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        guild_id: { type: "string", description: "Discord server (guild) ID (snowflake)." },
        role_id: { type: "string", description: "ID (snowflake) of the role to list holders of." },
      },
      required: ["guild_id", "role_id"],
    },
  },
  {
    name: "discord_set_role_position",
    description:
      "Move a role up or down in the server's role hierarchy, which determines permission precedence and member-list ordering. Higher position = higher in the list. Requires the Manage Roles permission, and the target position must be below the bot's highest role.",
    annotations: { title: "Set role position", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        guild_id: { type: "string", description: "Discord server (guild) ID (snowflake)." },
        role_id: { type: "string", description: "ID (snowflake) of the role to reposition." },
        position: { type: "number", description: "New hierarchy position (0 = lowest, just above @everyone). Higher numbers rank higher." },
      },
      required: ["guild_id", "role_id", "position"],
    },
  },
  {
    name: "discord_set_role_icon",
    description:
      "Set or clear a role's icon — either a custom image or a unicode emoji. Requires the server to be Boost Level 2+ (the ROLE_ICONS feature) and the Manage Roles permission. Pass null to either field to remove that icon. Returns a confirmation.",
    annotations: { title: "Set role icon", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        guild_id: { type: "string", description: "Discord server (guild) ID (snowflake)." },
        role_id: { type: "string", description: "ID (snowflake) of the role to set the icon on." },
        icon: { type: "string", description: "Image URL for the role icon, or null to remove it." },
        unicode_emoji: { type: "string", description: "Unicode emoji to use as the role icon, or null to remove it." },
      },
      required: ["guild_id", "role_id"],
    },
  },
];

/**
 * Parses a permission array from tool arguments.
 * Accepts an array, a JSON string, or returns undefined if absent.
 */
function parsePerms(raw: unknown): string[] | undefined {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") return JSON.parse(raw);
  return undefined;
}

/**
 * Validates a role_id argument, fetches the role, and guarantees it exists.
 * @throws {Error} If the id is not a valid snowflake or the role is not found.
 */
async function fetchRole(guild: Guild, rawId: unknown): Promise<Role> {
  const id = validateId(rawId, "role_id");
  const role = await guild.roles.fetch(id);
  if (!role) throw new Error(`Role ${id} not found in this server.`);
  return role;
}

/**
 * Handles role tools: list all roles, CRUD operations,
 * assign/remove from members, and list members by role.
 */
export async function handle(name: string, args: Record<string, unknown>): Promise<ToolResult | null> {
  switch (name) {
    case "discord_list_roles": {
      const guild = await discord.guilds.fetch(validateId(args.guild_id, "guild_id"));
      const roles = await guild.roles.fetch();
      const result = [...roles.values()]
        .filter((r) => r.name !== "@everyone")
        .sort((a, b) => b.position - a.position)
        .map((r) => ({
          id: r.id, name: r.name, color: r.hexColor, position: r.position,
          memberCount: r.members.size, permissions: serializePermissions(r.permissions),
          hoist: r.hoist, mentionable: r.mentionable,
        }));
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    case "discord_create_role": {
      const guild = await discord.guilds.fetch(validateId(args.guild_id, "guild_id"));
      const perms = parsePerms(args.permissions);
      const role = await guild.roles.create({
        name: args.name as string,
        color: args.color as ColorResolvable | undefined,
        hoist: args.hoist as boolean | undefined,
        mentionable: args.mentionable as boolean | undefined,
        permissions: perms ? deserializePermissions(perms) : undefined,
      });
      return { content: [{ type: "text", text: `✅ Role "${role.name}" created (id: ${role.id}).` }] };
    }

    case "discord_edit_role": {
      const guild = await discord.guilds.fetch(validateId(args.guild_id, "guild_id"));
      const role = await fetchRole(guild, args.role_id);
      const perms = parsePerms(args.permissions);
      await role.edit({
        name: args.name as string | undefined,
        color: args.color as ColorResolvable | undefined,
        hoist: args.hoist as boolean | undefined,
        mentionable: args.mentionable as boolean | undefined,
        permissions: perms ? deserializePermissions(perms) : undefined,
      });
      return { content: [{ type: "text", text: `✅ Role "${role.name}" updated.` }] };
    }

    case "discord_delete_role": {
      const guild = await discord.guilds.fetch(validateId(args.guild_id, "guild_id"));
      const role = await fetchRole(guild, args.role_id);
      await role.delete(args.reason as string | undefined);
      return { content: [{ type: "text", text: `✅ Role "${role.name}" deleted.` }] };
    }

    case "discord_add_role": {
      const guild = await discord.guilds.fetch(validateId(args.guild_id, "guild_id"));
      const member = await guild.members.fetch(validateId(args.user_id, "user_id"));
      await member.roles.add(validateId(args.role_id, "role_id"), args.reason as string | undefined);
      return { content: [{ type: "text", text: `✅ Role added to ${member.user.tag}.` }] };
    }

    case "discord_remove_role": {
      const guild = await discord.guilds.fetch(validateId(args.guild_id, "guild_id"));
      const member = await guild.members.fetch(validateId(args.user_id, "user_id"));
      await member.roles.remove(validateId(args.role_id, "role_id"), args.reason as string | undefined);
      return { content: [{ type: "text", text: `✅ Role removed from ${member.user.tag}.` }] };
    }

    case "discord_get_role_members": {
      const guild = await discord.guilds.fetch(validateId(args.guild_id, "guild_id"));
      const role = await fetchRole(guild, args.role_id);
      // No "members of a role" endpoint exists, so populate the cache then filter (1000/page max).
      const MAX_PAGES = 20;
      let after: string | undefined;
      let truncated = true;
      for (let i = 0; i < MAX_PAGES; i++) {
        const page = await guild.members.list({ limit: 1000, after });
        if (page.size < 1000) { truncated = false; break; }
        after = page.lastKey();
      }
      const members = role.members.map((m) => ({ id: m.id, username: m.user.tag, nickname: m.nickname }));
      return { content: [{ type: "text", text: JSON.stringify({
        members,
        truncated,
        note: truncated ? `Only the first ${MAX_PAGES * 1000} members were scanned; results may be incomplete on very large servers.` : undefined,
      }, null, 2) }] };
    }

    case "discord_set_role_position": {
      const guild = await discord.guilds.fetch(validateId(args.guild_id, "guild_id"));
      const role = await fetchRole(guild, args.role_id);
      await role.setPosition(args.position as number);
      return { content: [{ type: "text", text: `✅ Role "${role.name}" moved to position ${args.position}.` }] };
    }

    case "discord_set_role_icon": {
      const guild = await discord.guilds.fetch(validateId(args.guild_id, "guild_id"));
      const role = await fetchRole(guild, args.role_id);
      if (args.icon !== undefined) {
        await role.setIcon(args.icon === "null" || args.icon === null ? null : args.icon as string);
      }
      if (args.unicode_emoji !== undefined) {
        await role.setUnicodeEmoji(args.unicode_emoji === "null" || args.unicode_emoji === null ? null : args.unicode_emoji as string);
      }
      return { content: [{ type: "text", text: `✅ Role "${role.name}" icon updated.` }] };
    }

    default:
      return null;
  }
}

export default { definitions, handle } satisfies ToolModule;
