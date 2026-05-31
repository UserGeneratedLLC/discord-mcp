import { z } from "zod";
import { discord, clampInt } from "../client.js";
import { defineTool, defineModule, guildId } from "./define.js";

/** Tool definitions for server moderation (audit log). */
const tools = [
  defineTool({
    name: "discord_get_audit_log",
    description:
      "Fetch the server's audit log — a record of administrative actions (bans, kicks, role/channel changes, etc.) with who performed them and when. Requires the View Audit Log permission. Returns a JSON array (id, action, executor, target, reason, timestamp). Read-only.",
    annotations: { title: "Get audit log", readOnlyHint: true, openWorldHint: true },
    schema: z.object({
      guild_id: guildId,
      limit: z.number().optional().describe("How many recent entries to fetch (1–100). Default 25."),
      action_type: z.number().optional().describe("Optional Discord AuditLogEvent numeric ID to filter by (e.g. 22 = MemberBanAdd). Omit for all action types."),
    }),
    handle: async ({ guild_id, limit, action_type }) => {
      const guild = await discord.guilds.fetch(guild_id);
      const logs = await guild.fetchAuditLogs({
        limit: clampInt(limit, 1, 100, 25),
        type: action_type as number | undefined,
      });
      const result = logs.entries.map((entry) => ({
        id: entry.id, action: entry.action,
        executor: entry.executor?.tag, target: entry.targetId,
        reason: entry.reason, createdAt: entry.createdAt.toISOString(),
      }));
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  }),
];

export default defineModule(tools);
