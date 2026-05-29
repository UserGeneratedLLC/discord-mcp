import { ChannelType, NewsChannel } from "discord.js";
import { discord, getGuildChannel, validateId } from "../client.js";
import type { ToolModule, ToolResult } from "./types.js";

/** Tool definitions for creating, deleting, editing, moving, and cloning channels. */
export const definitions = [
  {
    name: "discord_create_channel",
    description:
      "Create a text channel, voice channel, or category in a server. Requires the Manage Channels permission. For forum channels use discord_create_forum_channel instead. Returns the new channel's name and ID.",
    annotations: { title: "Create channel", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        guild_id: { type: "string", description: "Discord server (guild) ID (snowflake) to create the channel in." },
        name: { type: "string", description: "Name of the new channel (max 100 characters)." },
        type: { type: "string", enum: ["text", "voice", "category"], description: "Channel type to create. Defaults to 'text'." },
        topic: { type: "string", description: "Optional channel topic/description. Applies to text channels only." },
        category_id: { type: "string", description: "Optional category (snowflake) to nest the new channel under." },
      },
      required: ["guild_id", "name"],
    },
  },
  {
    name: "discord_delete_channel",
    description:
      "Permanently delete a channel and all of its messages. IRREVERSIBLE. Requires the Manage Channels permission. An optional reason is recorded in the audit log. Returns a confirmation.",
    annotations: { title: "Delete channel", readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "ID (snowflake) of the channel to delete." },
        reason: { type: "string", description: "Optional reason recorded in the server audit log." },
      },
      required: ["channel_id"],
    },
  },
  {
    name: "discord_edit_channel",
    description:
      "Update a channel's name, topic, slowmode, or NSFW flag. Only provided fields change; topic and slowmode apply to text channels only. Requires the Manage Channels permission. Returns a confirmation.",
    annotations: { title: "Edit channel", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "ID (snowflake) of the channel to edit." },
        name: { type: "string", description: "New channel name (max 100 characters)." },
        topic: { type: "string", description: "New topic/description (text channels only)." },
        slowmode: { type: "number", description: "Per-user message cooldown in seconds, 0–21600. 0 disables slowmode." },
        nsfw: { type: "boolean", description: "Mark (true) or unmark (false) the channel as age-restricted (NSFW)." },
      },
      required: ["channel_id"],
    },
  },
  {
    name: "discord_move_channel",
    description:
      "Move a channel into a category, or remove it from its category when category_id is omitted. Requires the Manage Channels permission. Use discord_set_channel_position to reorder within a category. Returns a confirmation.",
    annotations: { title: "Move channel", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "ID (snowflake) of the channel to move." },
        category_id: { type: "string", description: "Target category (snowflake). Omit to move the channel out of any category." },
      },
      required: ["channel_id"],
    },
  },
  {
    name: "discord_clone_channel",
    description:
      "Create a copy of a channel, including its name, topic, and permission overwrites (but not its messages). Requires the Manage Channels permission. Returns the cloned channel's name and ID.",
    annotations: { title: "Clone channel", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "ID (snowflake) of the channel to clone." },
        new_name: { type: "string", description: "Optional name for the clone. Defaults to the source channel's name." },
      },
      required: ["channel_id"],
    },
  },
  {
    name: "discord_set_channel_position",
    description:
      "Set a channel's display order within its category. Use discord_move_channel to change which category it belongs to. Requires the Manage Channels permission. Returns a confirmation.",
    annotations: { title: "Set channel position", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "ID (snowflake) of the channel to reposition." },
        position: { type: "number", description: "Zero-based position within the category (0 = top)." },
      },
      required: ["channel_id", "position"],
    },
  },
  {
    name: "discord_follow_announcement_channel",
    description:
      "Subscribe a target channel to an announcement (news) channel, so the source's published messages are reposted into the target. The source must be an announcement channel. Requires the Manage Webhooks permission in the target. Returns a confirmation.",
    annotations: { title: "Follow announcement channel", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        source_channel_id: { type: "string", description: "ID (snowflake) of the announcement channel to follow." },
        target_channel_id: { type: "string", description: "ID (snowflake) of the channel that will receive published messages." },
      },
      required: ["source_channel_id", "target_channel_id"],
    },
  },
  {
    name: "discord_lock_channel_permissions",
    description:
      "Reset a channel's permission overwrites to exactly match its parent category (Discord's 'sync permissions'). The channel must be inside a category. Requires the Manage Roles permission. Returns a confirmation.",
    annotations: { title: "Sync channel permissions", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "ID (snowflake) of the channel to sync with its parent category." },
      },
      required: ["channel_id"],
    },
  },
];

/**
 * Handles channel management tools: create (text/voice/category),
 * delete, edit (name/topic/slowmode), move between categories, and clone.
 */
export async function handle(name: string, args: Record<string, unknown>): Promise<ToolResult | null> {
  switch (name) {
    case "discord_create_channel": {
      const guild = await discord.guilds.fetch(validateId(args.guild_id, "guild_id"));
      const typeMap: Record<string, ChannelType> = {
        text: ChannelType.GuildText, voice: ChannelType.GuildVoice, category: ChannelType.GuildCategory,
      };
      const channelType = typeMap[(args.type as string) ?? "text"] ?? ChannelType.GuildText;
      const created = await guild.channels.create({
        name: args.name as string, type: channelType as ChannelType.GuildText | ChannelType.GuildVoice | ChannelType.GuildCategory,
        topic: channelType === ChannelType.GuildText ? (args.topic as string | undefined) : undefined,
        parent: args.category_id as string | undefined,
      });
      return { content: [{ type: "text", text: `✅ Channel #${created.name} created (id: ${created.id}).` }] };
    }

    case "discord_delete_channel": {
      const channel = await discord.channels.fetch(validateId(args.channel_id, "channel_id"));
      if (!channel) throw new Error("Channel not found.");
      const channelName = "name" in channel ? channel.name : channel.id;
      await channel.delete(args.reason as string | undefined);
      return { content: [{ type: "text", text: `✅ Channel #${channelName} deleted.` }] };
    }

    case "discord_edit_channel": {
      const channel = await getGuildChannel(args.channel_id as string);
      const editOptions: Record<string, unknown> = {};
      if (args.name !== undefined) editOptions.name = args.name as string;
      if (args.topic !== undefined && channel.type === ChannelType.GuildText) editOptions.topic = args.topic as string;
      if (args.slowmode !== undefined && channel.type === ChannelType.GuildText) editOptions.rateLimitPerUser = args.slowmode as number;
      if (args.nsfw !== undefined) editOptions.nsfw = args.nsfw as boolean;
      await channel.edit(editOptions);
      return { content: [{ type: "text", text: `✅ Channel #${channel.name} updated.` }] };
    }

    case "discord_move_channel": {
      const channel = await getGuildChannel(args.channel_id as string);
      await channel.edit({ parent: (args.category_id as string | undefined) ?? null });
      return { content: [{ type: "text", text: `✅ Channel #${channel.name} moved.` }] };
    }

    case "discord_clone_channel": {
      const channel = await getGuildChannel(args.channel_id as string);
      const cloned = await channel.clone({ name: args.new_name as string | undefined });
      return { content: [{ type: "text", text: `✅ Channel cloned as #${cloned.name} (id: ${cloned.id}).` }] };
    }

    case "discord_set_channel_position": {
      const channel = await getGuildChannel(args.channel_id as string);
      await channel.setPosition(args.position as number);
      return { content: [{ type: "text", text: `✅ Channel #${channel.name} moved to position ${args.position}.` }] };
    }

    case "discord_follow_announcement_channel": {
      const source = await discord.channels.fetch(validateId(args.source_channel_id, "source_channel_id"));
      if (!source || !(source instanceof NewsChannel)) throw new Error("Source channel is not an announcement channel.");
      await source.addFollower(validateId(args.target_channel_id, "target_channel_id"));
      return { content: [{ type: "text", text: `✅ Now following announcement channel in target channel.` }] };
    }

    case "discord_lock_channel_permissions": {
      const channel = await getGuildChannel(args.channel_id as string);
      await channel.lockPermissions();
      return { content: [{ type: "text", text: `✅ Channel #${channel.name} permissions synced with parent category.` }] };
    }

    default:
      return null;
  }
}

export default { definitions, handle } satisfies ToolModule;
