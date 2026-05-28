import { WebhookClient, EmbedBuilder, ColorResolvable } from "discord.js";
import { discord, validateId } from "../client.js";
import type { ToolModule, ToolResult } from "./types.js";

/** Embed input-schema fragment for webhook messages (shared by send/edit webhook-message tools). */
const WEBHOOK_EMBED_PROPS = {
  type: "array",
  description: "Up to 10 embed objects to attach to the webhook message.",
  items: {
    type: "object",
    properties: {
      title: { type: "string", description: "Embed title shown in bold at the top." },
      url: { type: "string", description: "URL that makes the title clickable." },
      description: { type: "string", description: "Main body text of the embed (supports Markdown)." },
      color: { type: "string", description: "Side-bar color as a hex string, e.g. '#5865F2'." },
      fields: {
        type: "array",
        description: "Up to 25 name/value field blocks.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Field heading." },
            value: { type: "string", description: "Field body text." },
            inline: { type: "boolean", description: "If true, render side-by-side with adjacent inline fields." },
          },
          required: ["name", "value"],
        },
      },
      footer: { type: "string", description: "Footer text shown at the bottom of the embed." },
      image_url: { type: "string", description: "Large image shown below the embed body." },
      thumbnail_url: { type: "string", description: "Small image shown in the top-right corner." },
      timestamp: { type: "boolean", description: "If true, stamp the embed with the current time." },
    },
  },
} as const;

/** Tool definitions for creating, sending via, editing, deleting, and listing webhooks. */
export const definitions = [
  {
    name: "discord_create_webhook",
    description:
      "Create a webhook on a channel and return its ID and token. SECURITY: the returned token grants anyone the ability to post as this webhook without authentication — treat it as a secret. Requires the Manage Webhooks permission. Use the returned id+token with discord_send_webhook_message.",
    annotations: { title: "Create webhook", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "ID (snowflake) of the channel to attach the webhook to." },
        name: { type: "string", description: "Display name for the webhook (max 80 characters)." },
        avatar: { type: "string", description: "Optional avatar image URL for the webhook." },
      },
      required: ["channel_id", "name"],
    },
  },
  {
    name: "discord_send_webhook_message",
    description:
      "Send a message through a webhook using its ID and token (no bot permissions needed — the token authorizes the send). Supports per-message username/avatar overrides and up to 10 embeds. At least one of content or embeds is required. Returns the new message ID.",
    annotations: { title: "Send webhook message", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        webhook_id: { type: "string", description: "ID (snowflake) of the webhook to send through." },
        webhook_token: { type: "string", description: "Secret token of the webhook (from discord_create_webhook or discord_list_webhooks)." },
        content: { type: "string", description: "Plain-text body of the message (max 2000 characters). Optional if embeds are provided." },
        username: { type: "string", description: "Override the webhook's default display name for this message." },
        avatar_url: { type: "string", description: "Override the webhook's default avatar for this message." },
        embeds: WEBHOOK_EMBED_PROPS,
      },
      required: ["webhook_id", "webhook_token"],
    },
  },
  {
    name: "discord_edit_webhook",
    description:
      "Update a webhook's name, avatar, or the channel it posts to. Only provided fields change. Requires the Manage Webhooks permission. Returns a confirmation.",
    annotations: { title: "Edit webhook", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        webhook_id: { type: "string", description: "ID (snowflake) of the webhook to edit." },
        name: { type: "string", description: "New display name for the webhook (max 80 characters)." },
        avatar: { type: "string", description: "New avatar image URL for the webhook." },
        channel_id: { type: "string", description: "ID (snowflake) of a channel to move the webhook to." },
      },
      required: ["webhook_id"],
    },
  },
  {
    name: "discord_delete_webhook",
    description:
      "Permanently delete a webhook by its ID, invalidating its token. IRREVERSIBLE — any integrations using the old token will stop working. Requires the Manage Webhooks permission.",
    annotations: { title: "Delete webhook", readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        webhook_id: { type: "string", description: "ID (snowflake) of the webhook to delete." },
      },
      required: ["webhook_id"],
    },
  },
  {
    name: "discord_list_webhooks",
    description:
      "List the webhooks in a single channel or across a whole server (id, name, channel, token when visible, creator). Provide exactly one of channel_id or guild_id. Requires the Manage Webhooks permission. Read-only.",
    annotations: { title: "List webhooks", readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        channel_id: { type: "string", description: "ID (snowflake) of a channel to list webhooks for. Mutually exclusive with guild_id." },
        guild_id: { type: "string", description: "Discord server (guild) ID (snowflake) to list all webhooks for. Mutually exclusive with channel_id." },
      },
    },
  },
  {
    name: "discord_edit_webhook_message",
    description:
      "Edit a message previously sent through a webhook, using the webhook's ID and token. Replaces the provided fields. Requires the original webhook token. Returns a confirmation.",
    annotations: { title: "Edit webhook message", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        webhook_id: { type: "string", description: "ID (snowflake) of the webhook that sent the message." },
        webhook_token: { type: "string", description: "Secret token of the webhook." },
        message_id: { type: "string", description: "ID of the webhook message to edit." },
        content: { type: "string", description: "New plain-text content for the message (max 2000 characters)." },
        embeds: WEBHOOK_EMBED_PROPS,
      },
      required: ["webhook_id", "webhook_token", "message_id"],
    },
  },
  {
    name: "discord_delete_webhook_message",
    description:
      "Permanently delete a message that was sent through a webhook, using the webhook's ID and token. IRREVERSIBLE. Requires the original webhook token.",
    annotations: { title: "Delete webhook message", readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        webhook_id: { type: "string", description: "ID (snowflake) of the webhook that sent the message." },
        webhook_token: { type: "string", description: "Secret token of the webhook." },
        message_id: { type: "string", description: "ID of the webhook message to delete." },
      },
      required: ["webhook_id", "webhook_token", "message_id"],
    },
  },
  {
    name: "discord_fetch_webhook_message",
    description:
      "Fetch a single message sent through a webhook (id, content, embed count, timestamp), using the webhook's ID and token. Read-only. Requires the original webhook token.",
    annotations: { title: "Fetch webhook message", readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        webhook_id: { type: "string", description: "ID (snowflake) of the webhook that sent the message." },
        webhook_token: { type: "string", description: "Secret token of the webhook." },
        message_id: { type: "string", description: "ID of the webhook message to fetch." },
      },
      required: ["webhook_id", "webhook_token", "message_id"],
    },
  },
];

/** Builds an EmbedBuilder from a webhook embed arg object. */
function buildWebhookEmbed(args: Record<string, unknown>): EmbedBuilder {
  const embed = new EmbedBuilder();
  if (args.title) embed.setTitle(args.title as string);
  if (args.url) embed.setURL(args.url as string);
  if (args.description) embed.setDescription(args.description as string);
  if (args.color) embed.setColor(args.color as ColorResolvable);
  if (args.footer) embed.setFooter({ text: args.footer as string });
  if (args.image_url) embed.setImage(args.image_url as string);
  if (args.thumbnail_url) embed.setThumbnail(args.thumbnail_url as string);
  if (args.timestamp) embed.setTimestamp();
  if (args.fields) {
    const fields = args.fields as { name: string; value: string; inline?: boolean }[];
    embed.addFields(fields.map((f) => ({ name: f.name, value: f.value, inline: f.inline ?? false })));
  }
  return embed;
}

/**
 * Handles webhook tools: create, send message via webhook,
 * edit, delete, and list webhooks.
 */
export async function handle(name: string, args: Record<string, unknown>): Promise<ToolResult | null> {
  switch (name) {
    case "discord_create_webhook": {
      const channel = await discord.channels.fetch(validateId(args.channel_id, "channel_id"));
      if (!channel || !("createWebhook" in channel)) throw new Error("Channel does not support webhooks.");
      const webhook = await (channel as any).createWebhook({
        name: args.name as string,
        avatar: (args.avatar as string | undefined) ?? undefined,
      });
      return {
        content: [{
          type: "text",
          text: `✅ Webhook "${webhook.name}" created (id: ${webhook.id}, token: ${webhook.token}).`,
        }],
      };
    }

    case "discord_send_webhook_message": {
      const webhookId = validateId(args.webhook_id, "webhook_id");
      const token = args.webhook_token as string;
      if (!token) throw new Error("webhook_token is required.");
      const client = new WebhookClient({ id: webhookId, token });
      try {
        const sendOptions: Record<string, unknown> = {};
        if (args.content) sendOptions.content = args.content as string;
        if (args.username) sendOptions.username = args.username as string;
        if (args.avatar_url) sendOptions.avatarURL = args.avatar_url as string;
        if (args.embeds) {
          const embedArgs = args.embeds as Record<string, unknown>[];
          if (embedArgs.length > 10) throw new Error("Discord allows a maximum of 10 embeds per message.");
          sendOptions.embeds = embedArgs.map((e) => buildWebhookEmbed(e));
        }
        if (!sendOptions.content && !sendOptions.embeds) {
          throw new Error("At least one of content or embeds is required.");
        }
        const sent = await client.send(sendOptions);
        return { content: [{ type: "text", text: `✅ Webhook message sent (id: ${sent.id}).` }] };
      } finally {
        client.destroy();
      }
    }

    case "discord_edit_webhook": {
      const webhookId = validateId(args.webhook_id, "webhook_id");
      const webhook = await discord.fetchWebhook(webhookId);
      const editOptions: Record<string, unknown> = {};
      if (args.name !== undefined) editOptions.name = args.name as string;
      if (args.avatar !== undefined) editOptions.avatar = args.avatar as string;
      if (args.channel_id !== undefined) editOptions.channel = validateId(args.channel_id, "channel_id");
      await webhook.edit(editOptions);
      return { content: [{ type: "text", text: `✅ Webhook "${webhook.name}" (id: ${webhook.id}) updated.` }] };
    }

    case "discord_delete_webhook": {
      const webhookId = validateId(args.webhook_id, "webhook_id");
      const webhook = await discord.fetchWebhook(webhookId);
      const webhookName = webhook.name;
      await webhook.delete();
      return { content: [{ type: "text", text: `✅ Webhook "${webhookName}" (id: ${webhookId}) deleted.` }] };
    }

    case "discord_list_webhooks": {
      if (args.channel_id) {
        const channel = await discord.channels.fetch(validateId(args.channel_id, "channel_id"));
        if (!channel || !("fetchWebhooks" in channel)) throw new Error("Channel does not support webhooks.");
        const webhooks = await (channel as any).fetchWebhooks();
        const result = [...webhooks.values()].map((w: any) => ({
          id: w.id,
          name: w.name,
          channel_id: w.channelId,
          token: w.token ?? null,
          creator: w.owner?.tag ?? null,
        }));
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } else if (args.guild_id) {
        const guild = await discord.guilds.fetch(validateId(args.guild_id, "guild_id"));
        const webhooks = await guild.fetchWebhooks();
        const result = [...webhooks.values()].map((w) => ({
          id: w.id,
          name: w.name,
          channel_id: w.channelId,
          token: w.token ?? null,
          creator: w.owner && "tag" in w.owner ? w.owner.tag : (w.owner?.username ?? null),
        }));
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } else {
        throw new Error("Either channel_id or guild_id is required.");
      }
    }

    case "discord_edit_webhook_message": {
      const webhookId = validateId(args.webhook_id, "webhook_id");
      const token = args.webhook_token as string;
      if (!token) throw new Error("webhook_token is required.");
      const client = new WebhookClient({ id: webhookId, token });
      try {
        const editOptions: Record<string, unknown> = {};
        if (args.content !== undefined) editOptions.content = args.content as string;
        if (args.embeds) {
          const embedArgs = args.embeds as Record<string, unknown>[];
          editOptions.embeds = embedArgs.map((e) => buildWebhookEmbed(e));
        }
        await client.editMessage(args.message_id as string, editOptions);
        return { content: [{ type: "text", text: `✅ Webhook message ${args.message_id} edited.` }] };
      } finally {
        client.destroy();
      }
    }

    case "discord_delete_webhook_message": {
      const webhookId = validateId(args.webhook_id, "webhook_id");
      const token = args.webhook_token as string;
      if (!token) throw new Error("webhook_token is required.");
      const client = new WebhookClient({ id: webhookId, token });
      try {
        await client.deleteMessage(args.message_id as string);
        return { content: [{ type: "text", text: `✅ Webhook message ${args.message_id} deleted.` }] };
      } finally {
        client.destroy();
      }
    }

    case "discord_fetch_webhook_message": {
      const webhookId = validateId(args.webhook_id, "webhook_id");
      const token = args.webhook_token as string;
      if (!token) throw new Error("webhook_token is required.");
      const client = new WebhookClient({ id: webhookId, token });
      try {
        const msg = await client.fetchMessage(args.message_id as string);
        return { content: [{ type: "text", text: JSON.stringify({
          id: msg.id, content: msg.content, embeds: msg.embeds.length,
          timestamp: msg.timestamp,
        }, null, 2) }] };
      } finally {
        client.destroy();
      }
    }

    default:
      return null;
  }
}

export default { definitions, handle } satisfies ToolModule;
