import { discord, validateId, clampInt } from "../client.js";
import type { ToolModule, ToolResult } from "./types.js";

/** Tool definitions for server moderation (audit log). */
export const definitions = [
  {
    name: "discord_get_audit_log",
    description:
      "Fetch the server's audit log — a record of administrative actions (bans, kicks, role/channel changes, etc.) with who performed them and when. Requires the View Audit Log permission. Returns a JSON array (id, action, executor, target, reason, timestamp). Read-only.",
    annotations: { title: "Get audit log", readOnlyHint: true, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        guild_id: { type: "string", description: "Discord server (guild) ID (snowflake)." },
        limit: { type: "number", description: "How many recent entries to fetch (1–100). Default 25." },
        action_type: { type: "number", description: "Optional Discord AuditLogEvent numeric ID to filter by (e.g. 22 = MemberBanAdd). Omit for all action types." },
      },
      required: ["guild_id"],
    },
  },
];

/**
 * Handles moderation tools: fetches the guild audit log
 * with optional filtering by action type.
 */
export async function handle(name: string, args: Record<string, unknown>): Promise<ToolResult | null> {
  switch (name) {
    case "discord_get_audit_log": {
      const guild = await discord.guilds.fetch(validateId(args.guild_id, "guild_id"));
      const logs = await guild.fetchAuditLogs({
        limit: clampInt(args.limit, 1, 100, 25),
        type: args.action_type as number | undefined,
      });
      const result = logs.entries.map((entry) => ({
        id: entry.id, action: entry.action,
        executor: entry.executor?.tag, target: entry.targetId,
        reason: entry.reason, createdAt: entry.createdAt.toISOString(),
      }));
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    default:
      return null;
  }
}

export default { definitions, handle } satisfies ToolModule;
