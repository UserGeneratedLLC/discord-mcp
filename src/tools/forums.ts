import { ChannelType, ForumChannel, ThreadChannel } from "discord.js";
import { discord, validateId, clampInt } from "../client.js";
import type { ToolModule, ToolResult } from "./types.js";

/** Tool definitions for managing forum channels, posts, tags, and threads. */
export const definitions = [
  {
    name: "discord_get_forum_channels",
    description:
      "List the forum channels in a server (id, name, topic, parent category). Read-only. Use discord_get_forum_tags to see a forum's available tags, or discord_list_forum_threads for its posts.",
    annotations: { title: "List forum channels", readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        guild_id: { type: "string", description: "Discord server (guild) ID (snowflake)." },
      },
      required: ["guild_id"],
    },
  },
  {
    name: "discord_create_forum_channel",
    description:
      "Create a new forum channel in a server. A forum holds posts (threads) rather than a linear message feed. Requires the Manage Channels permission. Use discord_create_channel for text/voice channels instead. Returns the new channel's name and ID.",
    annotations: { title: "Create forum channel", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        guild_id: { type: "string", description: "Discord server (guild) ID (snowflake)." },
        name: { type: "string", description: "Name of the new forum channel (max 100 characters)." },
        topic: { type: "string", description: "Guidelines/topic text shown at the top of the forum." },
        category_id: { type: "string", description: "Optional category (snowflake) to nest the forum under." },
      },
      required: ["guild_id", "name"],
    },
  },
  {
    name: "discord_create_forum_post",
    description:
      "Create a new post (a thread with a starter message) in a forum channel. Requires the Send Messages and Create Public Threads permissions. Use discord_reply_to_forum to add follow-up messages. Returns the new post's name and thread ID.",
    annotations: { title: "Create forum post", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        forum_channel_id: { type: "string", description: "ID (snowflake) of the forum channel to post in." },
        title: { type: "string", description: "Title of the post, used as the thread name (max 100 characters)." },
        content: { type: "string", description: "Body of the post's starter message (max 2000 characters)." },
        applied_tags: {
          type: "array",
          items: { type: "string" },
          description: "Optional tag IDs to apply. Get valid IDs from discord_get_forum_tags.",
        },
      },
      required: ["forum_channel_id", "title", "content"],
    },
  },
  {
    name: "discord_get_forum_post",
    description:
      "Get a forum post's details (title, archived/locked state, applied tags, message count) plus its recent messages, oldest-to-newest. Read-only. Pass the post's thread_id. Returns a JSON object.",
    annotations: { title: "Get forum post", readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        thread_id: { type: "string", description: "ID (snowflake) of the forum post (thread)." },
        limit: { type: "number", description: "How many recent messages to include (1–100). Default 20." },
      },
      required: ["thread_id"],
    },
  },
  {
    name: "discord_list_forum_threads",
    description:
      "List posts in a forum channel. Returns { threads: [...], hasMore, nextBefore }. The first call (no `before`) includes all active posts plus the first page of archived posts; archived posts are paginated, so if hasMore is true pass nextBefore back as `before` to fetch older archived posts. Read-only. Use discord_get_forum_post to read one post's messages.",
    annotations: { title: "List forum threads", readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        forum_channel_id: { type: "string", description: "ID (snowflake) of the forum channel to list posts from." },
        limit: { type: "number", description: "Max archived posts per page (1–100). Default 100." },
        before: { type: "string", description: "Pagination cursor: an ISO timestamp. Pass the previous response's nextBefore to fetch older archived posts. When set, active posts are omitted." },
      },
      required: ["forum_channel_id"],
    },
  },
  {
    name: "discord_reply_to_forum",
    description:
      "Post a follow-up message inside an existing forum post (thread). Requires the Send Messages permission. Use discord_create_forum_post to start a new post instead. Returns the new message ID.",
    annotations: { title: "Reply to forum post", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        thread_id: { type: "string", description: "ID (snowflake) of the forum post (thread) to reply in." },
        content: { type: "string", description: "Plain-text body of the reply (max 2000 characters)." },
      },
      required: ["thread_id", "content"],
    },
  },
  {
    name: "discord_delete_forum_post",
    description:
      "Permanently delete a forum post (thread) and all its messages. IRREVERSIBLE. To merely close it without deleting, use discord_update_forum_post with archived:true. Requires the Manage Threads permission (or thread ownership).",
    annotations: { title: "Delete forum post", readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        thread_id: { type: "string", description: "ID (snowflake) of the forum post (thread) to delete." },
      },
      required: ["thread_id"],
    },
  },
  {
    name: "discord_get_forum_tags",
    description:
      "List the tags available on a forum channel (id, name, emoji, moderated flag). Read-only. Use these IDs with discord_create_forum_post or discord_update_forum_post; manage the tag set with discord_set_forum_tags.",
    annotations: { title: "Get forum tags", readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        forum_channel_id: { type: "string", description: "ID (snowflake) of the forum channel to read tags from." },
      },
      required: ["forum_channel_id"],
    },
  },
  {
    name: "discord_set_forum_tags",
    description:
      "Replace the full set of available tags on a forum channel with the provided list. This overwrites existing tags, so include every tag you want to keep. Requires the Manage Channels permission. Returns a confirmation.",
    annotations: { title: "Set forum tags", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        forum_channel_id: { type: "string", description: "ID (snowflake) of the forum channel to set tags on." },
        tags: {
          type: "array",
          description: "Complete list of tags to set (replaces all existing tags).",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Tag label (max 20 characters)." },
              emoji_name: { type: "string", description: "Optional unicode emoji shown on the tag." },
              moderated: { type: "boolean", description: "If true, only members with Manage Threads can apply this tag. Default false." },
            },
            required: ["name"],
          },
        },
      },
      required: ["forum_channel_id", "tags"],
    },
  },
  {
    name: "discord_update_forum_post",
    description:
      "Update a forum post's title, archived/locked state, or applied tags. Only provided fields change; passing applied_tags replaces the post's tags. Set archived:true to close a post without deleting it. Requires the Manage Threads permission (or thread ownership).",
    annotations: { title: "Update forum post", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        thread_id: { type: "string", description: "ID (snowflake) of the forum post (thread) to update." },
        title: { type: "string", description: "New title/thread name (max 100 characters)." },
        archived: { type: "boolean", description: "true to archive (close) the post, false to reopen it." },
        locked: { type: "boolean", description: "true to lock the post so only moderators can reply." },
        applied_tags: {
          type: "array",
          items: { type: "string" },
          description: "Tag IDs to apply; replaces the post's current tags. Get valid IDs from discord_get_forum_tags.",
        },
      },
      required: ["thread_id"],
    },
  },
];

/**
 * Fetches a channel by ID and guarantees it is a forum channel.
 */
async function getForumChannel(channelId: string): Promise<ForumChannel> {
  const channel = await discord.channels.fetch(validateId(channelId, "forum_channel_id"));
  if (!channel || channel.type !== ChannelType.GuildForum)
    throw new Error(`Channel ${channelId} is not a forum channel or doesn't exist.`);
  return channel as ForumChannel;
}

/**
 * Fetches a channel by ID and guarantees it is a thread channel.
 */
async function getThreadChannel(threadId: string): Promise<ThreadChannel> {
  const channel = await discord.channels.fetch(validateId(threadId, "thread_id"));
  if (!channel || !channel.isThread())
    throw new Error(`Channel ${threadId} is not a thread or doesn't exist.`);
  return channel as ThreadChannel;
}

/**
 * Handles all forum-related tools: list forums, create forum channels,
 * create/get/list/reply/delete/update forum posts, and manage forum tags.
 */
export async function handle(name: string, args: Record<string, unknown>): Promise<ToolResult | null> {
  switch (name) {
    case "discord_get_forum_channels": {
      const guild = await discord.guilds.fetch(validateId(args.guild_id, "guild_id"));
      const channels = await guild.channels.fetch();
      const forums = [...channels.values()]
        .filter((c) => c && c.type === ChannelType.GuildForum)
        .map((c) => ({
          id: c!.id,
          name: c!.name,
          topic: (c as ForumChannel).topic,
          parentId: c!.parentId,
        }));
      return { content: [{ type: "text", text: JSON.stringify(forums, null, 2) }] };
    }

    case "discord_create_forum_channel": {
      const guild = await discord.guilds.fetch(validateId(args.guild_id, "guild_id"));
      const created = await guild.channels.create({
        name: args.name as string,
        type: ChannelType.GuildForum,
        topic: args.topic as string | undefined,
        parent: args.category_id as string | undefined,
      });
      return { content: [{ type: "text", text: `✅ Forum channel #${created.name} created (id: ${created.id}).` }] };
    }

    case "discord_create_forum_post": {
      const forum = await getForumChannel(args.forum_channel_id as string);
      const thread = await forum.threads.create({
        name: args.title as string,
        message: { content: args.content as string },
        appliedTags: (args.applied_tags as string[] | undefined) ?? [],
      });
      return { content: [{ type: "text", text: `✅ Forum post "${thread.name}" created (id: ${thread.id}) in #${forum.name}.` }] };
    }

    case "discord_get_forum_post": {
      const thread = await getThreadChannel(args.thread_id as string);
      const limit = clampInt(args.limit, 1, 100, 20);
      const messages = await thread.messages.fetch({ limit });
      const result = {
        id: thread.id,
        name: thread.name,
        archived: thread.archived,
        locked: thread.locked,
        messageCount: thread.messageCount,
        appliedTags: thread.appliedTags,
        createdAt: thread.createdAt?.toISOString(),
        messages: [...messages.values()]
          .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
          .map((m) => ({
            id: m.id,
            author: m.author.tag,
            content: m.content,
            timestamp: m.createdAt.toISOString(),
          })),
      };
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    case "discord_list_forum_threads": {
      const forum = await getForumChannel(args.forum_channel_id as string);
      const limit = clampInt(args.limit, 1, 100, 100);
      const before = args.before !== undefined ? new Date(String(args.before)) : undefined;
      const collected: ThreadChannel[] = [];
      if (before === undefined) {
        const active = await forum.threads.fetchActive();
        collected.push(...active.threads.values());
      }
      const archived = await forum.threads.fetchArchived({ limit, before });
      collected.push(...archived.threads.values());
      const threads = collected.map((t) => ({
        id: t.id,
        name: t.name,
        archived: t.archived,
        locked: t.locked,
        messageCount: t.messageCount,
        appliedTags: t.appliedTags,
        createdAt: t.createdAt?.toISOString(),
      }));
      const lastArchived = archived.threads.last();
      const nextBefore = archived.hasMore ? lastArchived?.archivedAt?.toISOString() ?? null : null;
      return { content: [{ type: "text", text: JSON.stringify({ threads, hasMore: archived.hasMore, nextBefore }, null, 2) }] };
    }

    case "discord_reply_to_forum": {
      const thread = await getThreadChannel(args.thread_id as string);
      const sent = await thread.send(args.content as string);
      return { content: [{ type: "text", text: `✅ Reply sent (id: ${sent.id}) in thread "${thread.name}".` }] };
    }

    case "discord_delete_forum_post": {
      const thread = await getThreadChannel(args.thread_id as string);
      const threadName = thread.name;
      await thread.delete();
      return { content: [{ type: "text", text: `✅ Forum post "${threadName}" deleted.` }] };
    }

    case "discord_get_forum_tags": {
      const forum = await getForumChannel(args.forum_channel_id as string);
      const tags = forum.availableTags.map((t) => ({
        id: t.id,
        name: t.name,
        emoji: t.emoji?.name ?? null,
        moderated: t.moderated,
      }));
      return { content: [{ type: "text", text: JSON.stringify(tags, null, 2) }] };
    }

    case "discord_set_forum_tags": {
      const forum = await getForumChannel(args.forum_channel_id as string);
      const tags = (args.tags as { name: string; emoji_name?: string; moderated?: boolean }[]).map((t) => ({
        name: t.name,
        emoji: t.emoji_name ? { name: t.emoji_name, id: null } : undefined,
        moderated: t.moderated ?? false,
      }));
      await forum.setAvailableTags(tags);
      return { content: [{ type: "text", text: `✅ Forum tags updated on #${forum.name} (${tags.length} tags set).` }] };
    }

    case "discord_update_forum_post": {
      const thread = await getThreadChannel(args.thread_id as string);
      const editOptions: Record<string, unknown> = {};
      if (args.title !== undefined) editOptions.name = args.title as string;
      if (args.archived !== undefined) editOptions.archived = args.archived as boolean;
      if (args.locked !== undefined) editOptions.locked = args.locked as boolean;
      if (args.applied_tags !== undefined) editOptions.appliedTags = args.applied_tags as string[];
      await thread.edit(editOptions);
      return { content: [{ type: "text", text: `✅ Forum post "${thread.name}" updated.` }] };
    }

    default:
      return null;
  }
}

export default { definitions, handle } satisfies ToolModule;
