import {
  ChannelType,
  TextChannel,
  PublicThreadChannel,
  PrivateThreadChannel,
  Message,
  MessageReaction,
} from "discord.js";
import { discord, getTextChannel, clampInt } from "../client.js";
import { MAX_FETCH_LIMIT, DEFAULTS } from "../constants.js";
import { buildEmbed, EMBED_FIELD_PROPS } from "../embeds.js";
import type { ToolModule, ToolResult } from "./types.js";

/** Tool definitions for reading, sending, replying, editing, reacting, threading, embedding, deleting, pinning, and searching messages. */
export const definitions = [
  {
    name: "discord_read_messages",
    description:
      "Read the most recent messages from a text channel or thread, oldest-to-newest. Returns a JSON array of messages (id, author, content, timestamp, attachment count, pinned flag). Use discord_search_messages to filter by keyword, or discord_fetch_pinned_messages for pinned messages only.",
    annotations: { title: "Read messages", readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "ID (snowflake) of the channel or thread to read from." },
        limit: { type: "number", description: "How many recent messages to fetch (1–100). Default 20." },
      },
      required: ["channel_id"],
    },
  },
  {
    name: "discord_send_message",
    description:
      "Send a plain-text message to a channel or thread. For rich content (title, color, fields, images) use discord_send_embed; to attach a reply reference to an existing message use discord_reply_message. Requires the bot to have the Send Messages permission. Returns the new message ID.",
    annotations: { title: "Send message", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "ID (snowflake) of the target channel or thread." },
        content: { type: "string", description: "Plain-text body of the message (max 2000 characters)." },
      },
      required: ["channel_id", "content"],
    },
  },
  {
    name: "discord_reply_message",
    description:
      "Reply to a specific message, attaching a reply reference so clients show it as a threaded reply. Use discord_send_message for a standalone message with no reference. Requires the Send Messages permission. Returns the new reply's message ID.",
    annotations: { title: "Reply to message", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "ID (snowflake) of the channel or thread containing the message." },
        message_id: { type: "string", description: "ID of the message to reply to." },
        content: { type: "string", description: "Plain-text body of the reply (max 2000 characters)." },
      },
      required: ["channel_id", "message_id", "content"],
    },
  },
  {
    name: "discord_edit_message",
    description:
      "Edit the text content of a message previously sent by this bot. Discord forbids editing other users' messages, so this fails for non-bot messages. Use discord_edit_embed for embed messages. Works in text channels and threads. Returns the edited message ID.",
    annotations: { title: "Edit message", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "ID (snowflake) of the channel or thread containing the message." },
        message_id: { type: "string", description: "ID of the message to edit. Must be a message authored by this bot." },
        content: { type: "string", description: "New plain-text content that fully replaces the existing content (max 2000 characters)." },
      },
      required: ["channel_id", "message_id", "content"],
    },
  },
  {
    name: "discord_add_reaction",
    description:
      "Add a single emoji reaction to a message as the bot. Requires the Add Reactions and Read Message History permissions. Use discord_remove_reactions to undo. Idempotent: re-adding the bot's existing reaction has no effect.",
    annotations: { title: "Add reaction", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "ID (snowflake) of the channel or thread containing the message." },
        message_id: { type: "string", description: "ID of the message to react to." },
        emoji: { type: "string", description: "Unicode emoji (e.g. '👍') or a custom emoji in 'name:id' format." },
      },
      required: ["channel_id", "message_id", "emoji"],
    },
  },
  {
    name: "discord_create_thread",
    description:
      "Create a thread, either branching from an existing message (pass message_id) or as a standalone thread in a text channel (omit message_id). Standalone creation requires a parent text channel and fails if channel_id is itself a thread. Requires the Create Public Threads permission. Returns the new thread's ID.",
    annotations: { title: "Create thread", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "ID (snowflake) of the parent text channel. For a message-based thread, the channel containing message_id." },
        name: { type: "string", description: "Name of the thread to create (max 100 characters)." },
        message_id: { type: "string", description: "Optional. Message to branch the thread from. If omitted, a standalone thread is created in the channel." },
        auto_archive_duration: { type: "number", description: "Minutes of inactivity before auto-archiving: 60, 1440, 4320, or 10080. Default 1440 (24h)." },
      },
      required: ["channel_id", "name"],
    },
  },
  {
    name: "discord_bulk_delete_messages",
    description:
      "Permanently delete multiple recent messages in one call. IRREVERSIBLE. Discord only allows bulk-deleting messages younger than 14 days; older ones are skipped. Requires the Manage Messages permission. Use discord_delete_message to remove a single specific message. Returns the number actually deleted.",
    annotations: { title: "Bulk delete messages", readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "ID (snowflake) of the channel or thread to delete messages from." },
        count: { type: "number", description: "Number of recent messages to delete (2–100)." },
      },
      required: ["channel_id", "count"],
    },
  },
  {
    name: "discord_send_embed",
    description:
      "Send a single rich embed (title, description, color, fields, author, footer, images, timestamp). Use discord_send_message for plain text, or discord_send_multiple_embeds to send several embeds at once. Requires the Send Messages and Embed Links permissions. Returns the new message ID.",
    annotations: { title: "Send embed", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "ID (snowflake) of the target channel or thread." },
        ...EMBED_FIELD_PROPS,
      },
      required: ["channel_id"],
    },
  },
  {
    name: "discord_edit_embed",
    description:
      "Replace the embed on a message previously sent by this bot. Only this bot's messages can be edited. This is a full replace, not a merge: provided fields are applied and omitted fields are dropped from the embed. Returns a confirmation.",
    annotations: { title: "Edit embed", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "ID (snowflake) of the channel or thread containing the message." },
        message_id: { type: "string", description: "ID of the message to edit. Must be a bot message that already contains an embed." },
        ...EMBED_FIELD_PROPS,
      },
      required: ["channel_id", "message_id"],
    },
  },
  {
    name: "discord_send_multiple_embeds",
    description:
      "Send up to 10 embeds in a single message, with optional text above them. Use discord_send_embed for a single embed. Requires the Send Messages and Embed Links permissions. Returns the new message ID.",
    annotations: { title: "Send multiple embeds", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "ID (snowflake) of the target channel or thread." },
        content: { type: "string", description: "Optional plain text shown above the embeds." },
        embeds: {
          type: "array",
          description: "Array of embed objects to send (max 10).",
          items: {
            type: "object",
            properties: { ...EMBED_FIELD_PROPS },
          },
        },
      },
      required: ["channel_id", "embeds"],
    },
  },
  {
    name: "discord_delete_message",
    description:
      "Permanently delete one specific message. IRREVERSIBLE. The bot can always delete its own messages; deleting another user's message requires the Manage Messages permission. Use discord_bulk_delete_messages to remove many at once. An optional reason is recorded in the audit log.",
    annotations: { title: "Delete message", readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "ID (snowflake) of the channel or thread containing the message." },
        message_id: { type: "string", description: "ID of the message to delete." },
        reason: { type: "string", description: "Optional reason recorded in the server audit log." },
      },
      required: ["channel_id", "message_id"],
    },
  },
  {
    name: "discord_pin_message",
    description:
      "Pin or unpin a message in a channel, controlled by the pin flag. Requires the Pin Messages permission (a dedicated permission since early 2026, separate from Manage Messages). A channel holds at most 50 pins. Idempotent: pinning an already-pinned message (or unpinning an unpinned one) has no additional effect.",
    annotations: { title: "Pin or unpin message", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "ID (snowflake) of the channel or thread containing the message." },
        message_id: { type: "string", description: "ID of the message to pin or unpin." },
        pin: { type: "boolean", description: "true to pin the message, false to unpin it." },
      },
      required: ["channel_id", "message_id", "pin"],
    },
  },
  {
    name: "discord_search_messages",
    description:
      "Keyword search over a channel's recent messages using case-insensitive substring matching. Scans only up to the last 100 messages — it does not search full history. Returns matching messages as a JSON array. Use discord_read_messages to fetch recent messages without filtering.",
    annotations: { title: "Search messages", readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "ID (snowflake) of the channel or thread to search." },
        keyword: { type: "string", description: "Case-insensitive substring to match within message content." },
        limit: { type: "number", description: "Max number of recent messages to scan (1–100). Default 100." },
      },
      required: ["channel_id", "keyword"],
    },
  },
  {
    name: "discord_crosspost_message",
    description:
      "Publish (crosspost) a message from an Announcement channel to every server that follows it. Only works in announcement channels on a message that has not already been published. Requires the Send Messages permission (and Manage Messages for messages authored by others). Returns a confirmation.",
    annotations: { title: "Crosspost message", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "ID (snowflake) of the announcement channel containing the message." },
        message_id: { type: "string", description: "ID of the message to publish to followers." },
      },
      required: ["channel_id", "message_id"],
    },
  },
  {
    name: "discord_remove_reactions",
    description:
      "Remove reactions from a message. With no emoji: removes ALL reactions. With emoji only: removes every reaction of that emoji. With emoji and user_id: removes that one user's reaction. Removing all reactions or another user's reaction requires the Manage Messages permission. Use discord_add_reaction to add.",
    annotations: { title: "Remove reactions", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "ID (snowflake) of the channel or thread containing the message." },
        message_id: { type: "string", description: "ID of the message to remove reactions from." },
        emoji: { type: "string", description: "Unicode emoji or custom emoji 'name:id'. Omit to remove ALL reactions on the message." },
        user_id: { type: "string", description: "Remove only this user's reaction for the given emoji. Requires emoji to be set." },
      },
      required: ["channel_id", "message_id"],
    },
  },
  {
    name: "discord_get_reactions",
    description:
      "List the users who reacted to a message with a specific emoji. Returns a JSON array of users (id, username, bot flag). Read-only.",
    annotations: { title: "Get reactions", readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "ID (snowflake) of the channel or thread containing the message." },
        message_id: { type: "string", description: "ID of the message to inspect." },
        emoji: { type: "string", description: "Unicode emoji or custom emoji 'name:id' to list reactors for." },
        limit: { type: "number", description: "Max users to return (1–100). Default 25." },
      },
      required: ["channel_id", "message_id", "emoji"],
    },
  },
  {
    name: "discord_fetch_pinned_messages",
    description:
      "List all pinned messages in a channel as a JSON array (id, author, content, timestamp). Read-only. Use discord_pin_message to change which messages are pinned.",
    annotations: { title: "Fetch pinned messages", readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "ID (snowflake) of the channel or thread to list pins from." },
      },
      required: ["channel_id"],
    },
  },
  {
    name: "discord_forward_message",
    description:
      "Forward an existing message to another channel using Discord's native forward, which preserves the original attribution. Works across text channels and threads. Use discord_send_message to compose new content instead. Requires the Send Messages permission in the target channel. Returns a confirmation.",
    annotations: { title: "Forward message", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "ID (snowflake) of the channel or thread containing the source message." },
        message_id: { type: "string", description: "ID of the message to forward." },
        target_channel_id: { type: "string", description: "ID (snowflake) of the destination channel or thread." },
      },
      required: ["channel_id", "message_id", "target_channel_id"],
    },
  },
];

/**
 * Looks up a reaction on a message by emoji argument.
 * The reaction cache is keyed by the emoji id (snowflake) for custom emoji and
 * by the raw unicode char for standard emoji — NOT by the "name:id" / "<:name:id>"
 * form the tool schema accepts — so a custom emoji is normalized to its id first.
 */
function findReaction(msg: Message, emoji: string): MessageReaction | undefined {
  const customId = emoji.match(/^<a?:[^:]+:(\d{17,20})>$|^[^:]+:(\d{17,20})$/);
  const key = customId ? (customId[1] ?? customId[2]) : emoji;
  return msg.reactions.cache.get(key);
}

/**
 * Handles all message-related tools: read, send, reply, edit, react,
 * thread, bulk delete, embed, delete, pin/unpin, and keyword search.
 */
export async function handle(name: string, args: Record<string, unknown>): Promise<ToolResult | null> {
  switch (name) {
    case "discord_read_messages": {
      const channel = await getTextChannel(args.channel_id as string);
      const limit = clampInt(args.limit, 1, MAX_FETCH_LIMIT, DEFAULTS.MESSAGES);
      const messages = await channel.messages.fetch({ limit, cache: false });
      const result = [...messages.values()]
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
        .map((m) => ({
          id: m.id, author: m.author.tag, content: m.content,
          timestamp: m.createdAt.toISOString(), attachments: m.attachments.size, pinned: m.pinned,
        }));
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    case "discord_send_message": {
      const channel = await getTextChannel(args.channel_id as string);
      const sent = await channel.send(args.content as string);
      return { content: [{ type: "text", text: `✅ Message sent (id: ${sent.id}) in #${channel.name}.` }] };
    }

    case "discord_reply_message": {
      const channel = await getTextChannel(args.channel_id as string);
      const target = await channel.messages.fetch(args.message_id as string);
      const sent = await target.reply(args.content as string);
      return { content: [{ type: "text", text: `✅ Reply sent (id: ${sent.id}) to message ${args.message_id} in #${channel.name}.` }] };
    }

    case "discord_edit_message": {
      const channel = await getTextChannel(args.channel_id as string);
      const msg = await channel.messages.fetch(args.message_id as string);
      if (msg.author.id !== discord.user?.id) throw new Error("Can only edit messages sent by the bot.");
      const edited = await msg.edit(args.content as string);
      return { content: [{ type: "text", text: `✅ Message ${edited.id} edited in #${channel.name}.` }] };
    }

    case "discord_add_reaction": {
      const channel = await getTextChannel(args.channel_id as string);
      const msg = await channel.messages.fetch(args.message_id as string);
      await msg.react(args.emoji as string);
      return { content: [{ type: "text", text: `✅ Reacted with ${args.emoji} to message ${msg.id} in #${channel.name}.` }] };
    }

    case "discord_create_thread": {
      const channel = await getTextChannel(args.channel_id as string);
      const duration = (args.auto_archive_duration as number) ?? 1440;
      if (args.message_id) {
        const msg = await channel.messages.fetch(args.message_id as string);
        const thread = await msg.startThread({
          name: args.name as string,
          autoArchiveDuration: duration as 60 | 1440 | 4320 | 10080,
        });
        return { content: [{ type: "text", text: `✅ Thread "${thread.name}" created from message (id: ${thread.id}).` }] };
      } else {
        if (!(channel instanceof TextChannel)) {
          throw new Error(`Standalone thread creation requires a parent TextChannel; ${args.channel_id} is itself a thread. Pass a message_id to start a thread from a message instead.`);
        }
        const thread = await channel.threads.create({
          name: args.name as string,
          autoArchiveDuration: duration as 60 | 1440 | 4320 | 10080,
          type: ChannelType.PublicThread,
        });
        return { content: [{ type: "text", text: `✅ Thread "${thread.name}" created (id: ${thread.id}).` }] };
      }
    }

    case "discord_bulk_delete_messages": {
      const channel = await getTextChannel(args.channel_id as string);
      const count = clampInt(args.count, 2, 100, 2);
      const deleted = await channel.bulkDelete(count, true);
      return { content: [{ type: "text", text: `✅ Deleted ${deleted.size} messages in #${channel.name}.` }] };
    }

    case "discord_send_embed": {
      const channel = await getTextChannel(args.channel_id as string);
      const embed = buildEmbed(args);
      const sent = await channel.send({ embeds: [embed] });
      return { content: [{ type: "text", text: `✅ Embed sent (id: ${sent.id}) in #${channel.name}.` }] };
    }

    case "discord_edit_embed": {
      const channel = await getTextChannel(args.channel_id as string);
      const msg = await channel.messages.fetch(args.message_id as string);
      if (msg.author.id !== discord.user?.id) throw new Error("Can only edit embeds sent by the bot.");
      const embed = buildEmbed(args);
      await msg.edit({ embeds: [embed] });
      return { content: [{ type: "text", text: `✅ Embed edited on message ${args.message_id} in #${channel.name}.` }] };
    }

    case "discord_send_multiple_embeds": {
      const channel = await getTextChannel(args.channel_id as string);
      const embedArgs = args.embeds as Record<string, unknown>[];
      if (embedArgs.length > 10) throw new Error("Discord allows a maximum of 10 embeds per message.");
      const embeds = embedArgs.map((e) => buildEmbed(e));
      const sent = await channel.send({
        content: (args.content as string) || undefined,
        embeds,
      });
      return { content: [{ type: "text", text: `✅ ${embeds.length} embeds sent (id: ${sent.id}) in #${channel.name}.` }] };
    }

    case "discord_delete_message": {
      const channel = await getTextChannel(args.channel_id as string);
      const msg = await channel.messages.fetch(args.message_id as string);
      await msg.delete();
      return { content: [{ type: "text", text: `✅ Message ${args.message_id} deleted.` }] };
    }

    case "discord_pin_message": {
      const channel = await getTextChannel(args.channel_id as string);
      const msg = await channel.messages.fetch(args.message_id as string);
      if (args.pin) { await msg.pin(); } else { await msg.unpin(); }
      return { content: [{ type: "text", text: `✅ Message ${args.pin ? "pinned" : "unpinned"}.` }] };
    }

    case "discord_search_messages": {
      const channel = await getTextChannel(args.channel_id as string);
      const limit = clampInt(args.limit, 1, MAX_FETCH_LIMIT, MAX_FETCH_LIMIT);
      const messages = await channel.messages.fetch({ limit, cache: false });
      const keyword = (args.keyword as string).toLowerCase();
      const matches = [...messages.values()]
        .filter((m) => m.content.toLowerCase().includes(keyword))
        .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
        .map((m) => ({ id: m.id, author: m.author.tag, content: m.content, timestamp: m.createdAt.toISOString() }));
      return { content: [{ type: "text", text: matches.length > 0 ? JSON.stringify(matches, null, 2) : `No messages found containing "${args.keyword}" in the last ${limit} messages.` }] };
    }

    case "discord_crosspost_message": {
      const channel = await getTextChannel(args.channel_id as string);
      const msg = await channel.messages.fetch(args.message_id as string);
      await msg.crosspost();
      return { content: [{ type: "text", text: `✅ Message ${msg.id} published to all followers of #${channel.name}.` }] };
    }

    case "discord_remove_reactions": {
      const channel = await getTextChannel(args.channel_id as string);
      const msg = await channel.messages.fetch(args.message_id as string);
      if (!args.emoji) {
        await msg.reactions.removeAll();
        return { content: [{ type: "text", text: `✅ All reactions removed from message ${msg.id}.` }] };
      }
      const reaction = findReaction(msg, args.emoji as string);
      if (!reaction) throw new Error(`No reaction found for emoji "${args.emoji}" on message ${msg.id}.`);
      if (args.user_id) {
        await reaction.users.remove(args.user_id as string);
        return { content: [{ type: "text", text: `✅ Removed ${args.emoji} reaction from user ${args.user_id} on message ${msg.id}.` }] };
      }
      await reaction.remove();
      return { content: [{ type: "text", text: `✅ All ${args.emoji} reactions removed from message ${msg.id}.` }] };
    }

    case "discord_get_reactions": {
      const channel = await getTextChannel(args.channel_id as string);
      const msg = await channel.messages.fetch(args.message_id as string);
      const reaction = findReaction(msg, args.emoji as string);
      if (!reaction) throw new Error(`No reaction found for emoji "${args.emoji}" on message ${msg.id}.`);
      const limit = clampInt(args.limit, 1, MAX_FETCH_LIMIT, DEFAULTS.LIMIT);
      const users = await reaction.users.fetch({ limit });
      const result = [...users.values()].map((u) => ({ id: u.id, username: u.username, bot: u.bot }));
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    case "discord_fetch_pinned_messages": {
      const channel = await getTextChannel(args.channel_id as string);
      const pinned = await channel.messages.fetchPins();
      const result = pinned.items.map(({ message: m, pinnedAt }) => ({
        id: m.id, author: m.author.tag, content: m.content,
        timestamp: m.createdAt.toISOString(), pinnedAt: pinnedAt.toISOString(),
      }));
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    case "discord_forward_message": {
      const channel = await getTextChannel(args.channel_id as string);
      const msg = await channel.messages.fetch(args.message_id as string);
      const targetChannel = await getTextChannel(args.target_channel_id as string);
      // ThreadChannel<boolean> is the abstract base for PublicThreadChannel / PrivateThreadChannel;
      // any runtime instance is one of them, but the type narrowing can't be expressed without a cast.
      await msg.forward(targetChannel as TextChannel | PublicThreadChannel<boolean> | PrivateThreadChannel);
      return { content: [{ type: "text", text: `✅ Message ${msg.id} forwarded to #${targetChannel.name}.` }] };
    }

    default:
      return null;
  }
}

export default { definitions, handle } satisfies ToolModule;
