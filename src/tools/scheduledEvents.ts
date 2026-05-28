import { GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel, GuildScheduledEventStatus, type GuildScheduledEventCreateOptions, type GuildScheduledEventEditOptions } from "discord.js";
import { discord, validateId } from "../client.js";
import { MAX_FETCH_LIMIT, DEFAULTS } from "../constants.js";
import type { ToolModule, ToolResult } from "./types.js";

/** Tool definitions for managing guild scheduled events. */
export const definitions = [
  {
    name: "discord_list_scheduled_events",
    description:
      "List all scheduled events in a server (id, name, status, type, time, location, interested count). Read-only. Use discord_get_scheduled_event for one event's full details.",
    annotations: { title: "List scheduled events", readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        guild_id: { type: "string", description: "Discord server (guild) ID (snowflake)." },
      },
      required: ["guild_id"],
    },
  },
  {
    name: "discord_get_scheduled_event",
    description:
      "Get full details for one scheduled event: name, description, status, type, channel/location, start/end times, creator, and interested-user count. Read-only. Returns a JSON object.",
    annotations: { title: "Get scheduled event", readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        guild_id: { type: "string", description: "Discord server (guild) ID (snowflake)." },
        event_id: { type: "string", description: "ID (snowflake) of the scheduled event." },
      },
      required: ["guild_id", "event_id"],
    },
  },
  {
    name: "discord_create_scheduled_event",
    description:
      "Create a scheduled event. For 'VOICE'/'STAGE_INSTANCE' events provide channel_id; for 'EXTERNAL' events provide location AND scheduled_end_time. Requires the Manage Events permission. Returns the new event's name and ID.",
    annotations: { title: "Create scheduled event", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        guild_id: { type: "string", description: "Discord server (guild) ID (snowflake)." },
        name: { type: "string", description: "Event name (max 100 characters)." },
        description: { type: "string", description: "Optional event description (max 1000 characters)." },
        entity_type: {
          type: "string",
          enum: ["VOICE", "STAGE_INSTANCE", "EXTERNAL"],
          description: "Where the event happens: 'VOICE' or 'STAGE_INSTANCE' (needs channel_id), or 'EXTERNAL' (needs location + scheduled_end_time).",
        },
        scheduled_start_time: {
          type: "string",
          description: "Event start as an ISO 8601 datetime, e.g. '2026-06-01T20:00:00Z'. Must be in the future.",
        },
        scheduled_end_time: {
          type: "string",
          description: "Event end as an ISO 8601 datetime. Required for EXTERNAL events.",
        },
        channel_id: {
          type: "string",
          description: "Voice or stage channel ID (snowflake). Required for VOICE/STAGE_INSTANCE events.",
        },
        location: {
          type: "string",
          description: "Free-text location (e.g. a URL or place). Required for EXTERNAL events.",
        },
        image: { type: "string", description: "Optional cover image URL." },
      },
      required: ["guild_id", "name", "entity_type", "scheduled_start_time"],
    },
  },
  {
    name: "discord_edit_scheduled_event",
    description:
      "Update a scheduled event; only provided fields change. Use the status field to start ('ACTIVE'), end ('COMPLETED'), or cancel ('CANCELED') an event — note Discord only allows certain status transitions. Requires the Manage Events permission.",
    annotations: { title: "Edit scheduled event", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        guild_id: { type: "string", description: "Discord server (guild) ID (snowflake)." },
        event_id: { type: "string", description: "ID (snowflake) of the event to edit." },
        name: { type: "string", description: "New event name (max 100 characters)." },
        description: { type: "string", description: "New event description (max 1000 characters)." },
        scheduled_start_time: { type: "string", description: "New start time as an ISO 8601 datetime." },
        scheduled_end_time: { type: "string", description: "New end time as an ISO 8601 datetime." },
        channel_id: { type: "string", description: "New voice/stage channel ID (snowflake) for VOICE/STAGE_INSTANCE events." },
        location: { type: "string", description: "New free-text location for EXTERNAL events." },
        image: { type: "string", description: "New cover image URL." },
        status: {
          type: "string",
          enum: ["SCHEDULED", "ACTIVE", "COMPLETED", "CANCELED"],
          description: "Change event status. Allowed transitions only: SCHEDULED→ACTIVE→COMPLETED, or SCHEDULED→CANCELED.",
        },
      },
      required: ["guild_id", "event_id"],
    },
  },
  {
    name: "discord_delete_scheduled_event",
    description:
      "Permanently delete a scheduled event. IRREVERSIBLE. To cancel an event while keeping a record, use discord_edit_scheduled_event with status:'CANCELED' instead. Requires the Manage Events permission.",
    annotations: { title: "Delete scheduled event", readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        guild_id: { type: "string", description: "Discord server (guild) ID (snowflake)." },
        event_id: { type: "string", description: "ID (snowflake) of the event to delete." },
      },
      required: ["guild_id", "event_id"],
    },
  },
  {
    name: "discord_get_event_subscribers",
    description:
      "List the users who marked themselves 'Interested' in a scheduled event (user_id, username, avatar). Read-only. Returns a JSON array.",
    annotations: { title: "Get event subscribers", readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        guild_id: { type: "string", description: "Discord server (guild) ID (snowflake)." },
        event_id: { type: "string", description: "ID (snowflake) of the scheduled event." },
        limit: { type: "number", description: "Max subscribers to return (1–100). Default 25." },
      },
      required: ["guild_id", "event_id"],
    },
  },
  {
    name: "discord_create_event_invite",
    description:
      "Create a shareable invite URL that points to a scheduled event, so recipients land on the event when joining. Requires the Create Instant Invite permission. Returns the invite URL.",
    annotations: { title: "Create event invite", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        guild_id: { type: "string", description: "Discord server (guild) ID (snowflake)." },
        event_id: { type: "string", description: "ID (snowflake) of the scheduled event to link the invite to." },
        channel_id: { type: "string", description: "Channel (snowflake) the invite points to. Defaults to the server's first text channel if omitted." },
        max_age: { type: "number", description: "Invite lifetime in seconds; 0 means it never expires. Default 86400 (24h)." },
        max_uses: { type: "number", description: "Maximum number of uses; 0 means unlimited. Default 0." },
      },
      required: ["guild_id", "event_id"],
    },
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────────

const ENTITY_TYPE_MAP: Record<string, GuildScheduledEventEntityType> = {
  STAGE_INSTANCE: GuildScheduledEventEntityType.StageInstance,
  VOICE: GuildScheduledEventEntityType.Voice,
  EXTERNAL: GuildScheduledEventEntityType.External,
};

const STATUS_MAP: Record<string, GuildScheduledEventStatus> = {
  SCHEDULED: GuildScheduledEventStatus.Scheduled,
  ACTIVE: GuildScheduledEventStatus.Active,
  COMPLETED: GuildScheduledEventStatus.Completed,
  CANCELED: GuildScheduledEventStatus.Canceled,
};

const ENTITY_TYPE_NAMES: Record<number, string> = {
  [GuildScheduledEventEntityType.StageInstance]: "STAGE_INSTANCE",
  [GuildScheduledEventEntityType.Voice]: "VOICE",
  [GuildScheduledEventEntityType.External]: "EXTERNAL",
};

const STATUS_NAMES: Record<number, string> = {
  [GuildScheduledEventStatus.Scheduled]: "SCHEDULED",
  [GuildScheduledEventStatus.Active]: "ACTIVE",
  [GuildScheduledEventStatus.Completed]: "COMPLETED",
  [GuildScheduledEventStatus.Canceled]: "CANCELED",
};

function serializeEvent(event: import("discord.js").GuildScheduledEvent) {
  return {
    id: event.id,
    name: event.name,
    description: event.description ?? null,
    status: STATUS_NAMES[event.status] ?? event.status,
    entity_type: ENTITY_TYPE_NAMES[event.entityType] ?? event.entityType,
    channel_id: event.channelId ?? null,
    location: event.entityMetadata?.location ?? null,
    scheduled_start_time: event.scheduledStartAt?.toISOString() ?? null,
    scheduled_end_time: event.scheduledEndAt?.toISOString() ?? null,
    creator_id: event.creatorId ?? null,
    user_count: event.userCount ?? null,
    image: event.coverImageURL() ?? null,
  };
}

// ─── Handler ────────────────────────────────────────────────────────────────────

export async function handle(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult | null> {
  switch (name) {
    case "discord_list_scheduled_events": {
      const guildId = validateId(args.guild_id, "guild_id");
      const guild = await discord.guilds.fetch(guildId);
      const events = await guild.scheduledEvents.fetch();
      const list = [...events.values()].map(serializeEvent);
      return { content: [{ type: "text", text: JSON.stringify(list, null, 2) }] };
    }

    case "discord_get_scheduled_event": {
      const guildId = validateId(args.guild_id, "guild_id");
      const eventId = validateId(args.event_id, "event_id");
      const guild = await discord.guilds.fetch(guildId);
      const event = await guild.scheduledEvents.fetch(eventId);
      return { content: [{ type: "text", text: JSON.stringify(serializeEvent(event), null, 2) }] };
    }

    case "discord_create_scheduled_event": {
      const guildId = validateId(args.guild_id, "guild_id");
      const guild = await discord.guilds.fetch(guildId);

      const entityTypeStr = String(args.entity_type).toUpperCase();
      const entityType = ENTITY_TYPE_MAP[entityTypeStr];
      if (!entityType) throw new Error(`Invalid entity_type: "${args.entity_type}". Must be VOICE, STAGE_INSTANCE, or EXTERNAL.`);

      if ((entityType === GuildScheduledEventEntityType.Voice || entityType === GuildScheduledEventEntityType.StageInstance) && !args.channel_id) {
        throw new Error("channel_id is required for VOICE or STAGE_INSTANCE events.");
      }
      if (entityType === GuildScheduledEventEntityType.External && !args.location) {
        throw new Error("location is required for EXTERNAL events.");
      }
      if (entityType === GuildScheduledEventEntityType.External && !args.scheduled_end_time) {
        throw new Error("scheduled_end_time is required for EXTERNAL events.");
      }

      const options: Record<string, unknown> = {
        name: String(args.name),
        scheduledStartTime: String(args.scheduled_start_time),
        entityType,
        privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
      };
      if (args.description) options.description = String(args.description);
      if (args.scheduled_end_time) options.scheduledEndTime = String(args.scheduled_end_time);
      if (args.channel_id) options.channel = validateId(args.channel_id, "channel_id");
      if (args.location) options.entityMetadata = { location: String(args.location) };
      if (args.image) options.image = String(args.image);

      const event = await guild.scheduledEvents.create(options as unknown as GuildScheduledEventCreateOptions);
      return {
        content: [{ type: "text", text: `✅ Scheduled event "${event.name}" created (id: ${event.id}).` }],
      };
    }

    case "discord_edit_scheduled_event": {
      const guildId = validateId(args.guild_id, "guild_id");
      const eventId = validateId(args.event_id, "event_id");
      const guild = await discord.guilds.fetch(guildId);
      const event = await guild.scheduledEvents.fetch(eventId);

      const options: Record<string, unknown> = {};
      if (args.name) options.name = String(args.name);
      if (args.description !== undefined) options.description = String(args.description);
      if (args.scheduled_start_time) options.scheduledStartTime = String(args.scheduled_start_time);
      if (args.scheduled_end_time) options.scheduledEndTime = String(args.scheduled_end_time);
      if (args.channel_id) options.channel = validateId(args.channel_id, "channel_id");
      if (args.location) options.entityMetadata = { location: String(args.location) };
      if (args.image) options.image = String(args.image);
      if (args.status) {
        const statusStr = String(args.status).toUpperCase();
        const status = STATUS_MAP[statusStr];
        if (!status) throw new Error(`Invalid status: "${args.status}". Must be SCHEDULED, ACTIVE, COMPLETED, or CANCELED.`);
        options.status = status;
      }

      const updated = await event.edit(options as unknown as GuildScheduledEventEditOptions<any, any>);
      return {
        content: [{ type: "text", text: `✅ Scheduled event "${updated.name}" updated (id: ${updated.id}).` }],
      };
    }

    case "discord_delete_scheduled_event": {
      const guildId = validateId(args.guild_id, "guild_id");
      const eventId = validateId(args.event_id, "event_id");
      const guild = await discord.guilds.fetch(guildId);
      const event = await guild.scheduledEvents.fetch(eventId);
      await event.delete();
      return {
        content: [{ type: "text", text: `✅ Scheduled event "${event.name}" deleted (id: ${eventId}).` }],
      };
    }

    case "discord_get_event_subscribers": {
      const guildId = validateId(args.guild_id, "guild_id");
      const eventId = validateId(args.event_id, "event_id");
      const guild = await discord.guilds.fetch(guildId);
      const event = await guild.scheduledEvents.fetch(eventId);
      const limit = Math.min(Number(args.limit ?? DEFAULTS.LIMIT), MAX_FETCH_LIMIT);
      const subscribers = await event.fetchSubscribers({ limit });
      const list = [...subscribers.values()].map((sub) => ({
        user_id: sub.user.id,
        username: sub.user.username,
        avatar: sub.user.displayAvatarURL(),
      }));
      return { content: [{ type: "text", text: JSON.stringify(list, null, 2) }] };
    }

    case "discord_create_event_invite": {
      const guildId = validateId(args.guild_id, "guild_id");
      const eventId = validateId(args.event_id, "event_id");
      const guild = await discord.guilds.fetch(guildId);
      const event = await guild.scheduledEvents.fetch(eventId);
      const url = await event.createInviteURL({
        channel: args.channel_id ? validateId(args.channel_id, "channel_id") : undefined,
        maxAge: Number(args.max_age ?? 86400),
        maxUses: Number(args.max_uses ?? 0),
      });
      return { content: [{ type: "text", text: `✅ Event invite created: ${url}` }] };
    }

    default:
      return null;
  }
}

export default { definitions, handle } satisfies ToolModule;
