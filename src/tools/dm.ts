import { EmbedBuilder, ColorResolvable } from "discord.js";
import { discord, validateId } from "../client.js";
import type { ToolModule, ToolResult } from "./types.js";

/** Builds an EmbedBuilder from a flat args object. */
function buildEmbed(args: Record<string, unknown>): EmbedBuilder {
  const embed = new EmbedBuilder();
  if (args.title) embed.setTitle(args.title as string);
  if (args.url) embed.setURL(args.url as string);
  if (args.description) embed.setDescription(args.description as string);
  if (args.color) embed.setColor(args.color as ColorResolvable);
  if (args.footer) embed.setFooter({ text: args.footer as string });
  if (args.image_url) embed.setImage(args.image_url as string);
  if (args.thumbnail_url) embed.setThumbnail(args.thumbnail_url as string);
  if (args.timestamp) embed.setTimestamp();
  if (args.author) {
    const a = args.author as { name: string; icon_url?: string; url?: string };
    embed.setAuthor({ name: a.name, iconURL: a.icon_url, url: a.url });
  }
  if (args.fields) {
    const fields = args.fields as { name: string; value: string; inline?: boolean }[];
    embed.addFields(fields.map((f) => ({ name: f.name, value: f.value, inline: f.inline ?? false })));
  }
  return embed;
}

/** Embed input schema properties (shared across embed tools). */
const embedProperties = {
  title: { type: "string", description: "Embed title shown in bold at the top." },
  url: { type: "string", description: "URL that makes the title clickable." },
  description: { type: "string", description: "Main body text of the embed (supports Markdown)." },
  color: { type: "string", description: "Side-bar color as a hex string, e.g. '#5865F2'." },
  fields: {
    type: "array",
    description: "Up to 25 name/value field blocks. Set inline:true to render up to 3 side-by-side.",
    items: {
      type: "object",
      properties: {
        name: { type: "string", description: "Field heading." },
        value: { type: "string", description: "Field body text." },
        inline: { type: "boolean", description: "If true, render this field side-by-side with adjacent inline fields." },
      },
      required: ["name", "value"],
    },
  },
  author: {
    type: "object",
    description: "Author block shown at the top of the embed.",
    properties: {
      name: { type: "string", description: "Author display name." },
      icon_url: { type: "string", description: "Small icon shown next to the author name." },
      url: { type: "string", description: "URL the author name links to." },
    },
    required: ["name"],
  },
  thumbnail_url: { type: "string", description: "Small image shown in the top-right corner." },
  footer: { type: "string", description: "Footer text shown at the bottom of the embed." },
  image_url: { type: "string", description: "Large image shown below the embed body." },
  timestamp: { type: "boolean", description: "If true, stamp the embed with the current time." },
} as const;

const userIdProp = {
  user_id: { type: "string", description: "Discord user ID (snowflake) of the DM recipient." },
} as const;

const messageIdProp = {
  message_id: { type: "string", description: "ID of the target message within the DM conversation." },
} as const;

/** Tool definitions for direct messages. */
export const definitions = [
  {
    name: "discord_send_dm",
    description:
      "Send a private direct message to a user by their user ID. Use discord_send_message to post in a server channel instead. Requires the bot to share at least one server with the user, and the user must allow DMs from server members (otherwise Discord rejects the send). Returns the new message ID.",
    annotations: { title: "Send DM", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        ...userIdProp,
        content: { type: "string", description: "Plain-text body of the DM (max 2000 characters)." },
      },
      required: ["user_id", "content"],
    },
  },
  {
    name: "discord_send_dm_embed",
    description:
      "Send a rich embed as a private direct message to a user. Use discord_send_dm for plain text, or discord_send_embed to post an embed in a channel. Requires the bot to share a server with the user, and the user must allow DMs from server members. Returns the new message ID.",
    annotations: { title: "Send DM embed", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        ...userIdProp,
        content: { type: "string", description: "Optional plain text shown above the embed." },
        ...embedProperties,
      },
      required: ["user_id"],
    },
  },
  {
    name: "discord_edit_dm",
    description:
      "Edit the text content of a DM message previously sent by this bot. Only the bot's own DM messages can be edited. Use discord_edit_dm_embed for embed messages. Returns a confirmation.",
    annotations: { title: "Edit DM", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        ...userIdProp,
        ...messageIdProp,
        content: { type: "string", description: "New plain-text content that fully replaces the existing message (max 2000 characters)." },
      },
      required: ["user_id", "message_id", "content"],
    },
  },
  {
    name: "discord_edit_dm_embed",
    description:
      "Replace the embed on a DM message previously sent by this bot. Only the bot's own messages can be edited. Full replace, not merge: provided fields are applied and omitted fields are dropped. Returns a confirmation.",
    annotations: { title: "Edit DM embed", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        ...userIdProp,
        ...messageIdProp,
        content: { type: "string", description: "Optional new plain text shown above the embed." },
        ...embedProperties,
      },
      required: ["user_id", "message_id"],
    },
  },
  {
    name: "discord_delete_dm",
    description:
      "Permanently delete a DM message previously sent by this bot. IRREVERSIBLE. The bot can only delete its own DM messages, not the recipient's. Returns a confirmation.",
    annotations: { title: "Delete DM", readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        ...userIdProp,
        ...messageIdProp,
      },
      required: ["user_id", "message_id"],
    },
  },
  {
    name: "discord_read_dms",
    description:
      "Read the most recent messages from the bot's DM conversation with a user, oldest-to-newest. Returns a JSON array (id, author, content, embed count, timestamp). Read-only.",
    annotations: { title: "Read DMs", readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        ...userIdProp,
        limit: { type: "number", description: "How many recent messages to fetch (1–100). Default 20." },
      },
      required: ["user_id"],
    },
  },
  {
    name: "discord_reply_dm",
    description:
      "Reply to a specific message in a DM, attaching a quoted reply reference. Unlike the edit/delete DM tools, this works on any message in the conversation (the bot's or the user's). Use discord_send_dm for a standalone DM with no reference. Returns the new reply's message ID.",
    annotations: { title: "Reply to DM", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        ...userIdProp,
        ...messageIdProp,
        content: { type: "string", description: "Plain-text body of the reply (max 2000 characters)." },
      },
      required: ["user_id", "message_id", "content"],
    },
  },
];

/** Handles direct message tools. */
async function handle(
  name: string,
  args: Record<string, unknown>
): Promise<ToolResult | null> {
  switch (name) {
    case "discord_send_dm": {
      const user = await discord.users.fetch(validateId(args.user_id, "user_id"));
      const sent = await user.send(args.content as string);
      return { content: [{ type: "text", text: `✅ DM sent to ${user.username} (message id: ${sent.id}).` }] };
    }

    case "discord_send_dm_embed": {
      const user = await discord.users.fetch(validateId(args.user_id, "user_id"));
      const embed = buildEmbed(args);
      const sent = await user.send({
        content: (args.content as string) || undefined,
        embeds: [embed],
      });
      return { content: [{ type: "text", text: `✅ DM embed sent to ${user.username} (message id: ${sent.id}).` }] };
    }

    case "discord_edit_dm": {
      const user = await discord.users.fetch(validateId(args.user_id, "user_id"));
      const dm = await user.createDM();
      const msgId = validateId(args.message_id, "message_id");
      const msg = await dm.messages.fetch(msgId);
      if (msg.author.id !== discord.user?.id) throw new Error("Can only edit messages sent by the bot.");
      await msg.edit(args.content as string);
      return { content: [{ type: "text", text: `✅ DM message ${msgId} edited for ${user.username}.` }] };
    }

    case "discord_edit_dm_embed": {
      const user = await discord.users.fetch(validateId(args.user_id, "user_id"));
      const dm = await user.createDM();
      const msgId = validateId(args.message_id, "message_id");
      const msg = await dm.messages.fetch(msgId);
      if (msg.author.id !== discord.user?.id) throw new Error("Can only edit embeds sent by the bot.");
      const embed = buildEmbed(args);
      await msg.edit({
        content: (args.content as string) || undefined,
        embeds: [embed],
      });
      return { content: [{ type: "text", text: `✅ DM embed edited on message ${msgId} for ${user.username}.` }] };
    }

    case "discord_delete_dm": {
      const user = await discord.users.fetch(validateId(args.user_id, "user_id"));
      const dm = await user.createDM();
      const msgId = validateId(args.message_id, "message_id");
      const msg = await dm.messages.fetch(msgId);
      if (msg.author.id !== discord.user?.id) throw new Error("Can only delete messages sent by the bot.");
      await msg.delete();
      return { content: [{ type: "text", text: `✅ DM message ${msgId} deleted for ${user.username}.` }] };
    }

    case "discord_read_dms": {
      const user = await discord.users.fetch(validateId(args.user_id, "user_id"));
      const dm = await user.createDM();
      const limit = Math.min(Math.max(Number(args.limit ?? 20), 1), 100);
      const messages = await dm.messages.fetch({ limit });
      const result = [...messages.values()]
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
        .map((m) => ({
          id: m.id,
          author: m.author.username,
          content: m.content,
          embeds: m.embeds.length,
          timestamp: m.createdAt.toISOString(),
        }));
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    case "discord_reply_dm": {
      const user = await discord.users.fetch(validateId(args.user_id, "user_id"));
      const dm = await user.createDM();
      const msgId = validateId(args.message_id, "message_id");
      const target = await dm.messages.fetch(msgId);
      const sent = await target.reply(args.content as string);
      return { content: [{ type: "text", text: `✅ DM reply sent to ${user.username} (message id: ${sent.id}).` }] };
    }

    default:
      return null;
  }
}

export default { definitions, handle } satisfies ToolModule;
