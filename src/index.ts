#!/usr/bin/env node
/**
 * Discord MCP Server — Entry point.
 *
 * Sets up the MCP server over stdio, registers tool definitions from
 * the modular `tools/` directory, and routes incoming tool calls.
 * The Discord client is initialized in `client.ts`.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

import { DiscordAPIError } from "discord.js";
import { ZodError } from "zod";
import { readFileSync } from "fs";
import { join } from "path";
import { ensureConnected, discord } from "./client.js";
import { getAllDefinitions, handleTool, hasTool } from "./tools/index.js";

/** Plain-language hints for the Discord API error codes most likely to surface through these tools. */
const DISCORD_ERROR_HINTS: Record<number, string> = {
  10003: "Unknown channel — check channel_id.",
  10004: "Unknown guild — the bot is not in that server or guild_id is wrong.",
  10008: "Unknown message — wrong message_id, or it was already deleted.",
  10011: "Unknown role — check role_id.",
  10013: "Unknown user — check user_id.",
  10026: "Unknown ban — the user is not banned.",
  50001: "Missing access — the bot is not in the guild or cannot see this channel.",
  50013: "Missing permissions — the bot lacks the permission this action requires.",
  50035: "Invalid form body — one or more arguments are invalid.",
};

/** Formats an error for the MCP client, surfacing DiscordAPIError code/status and an actionable hint. */
function formatToolError(err: unknown): string {
  if (err instanceof ZodError) {
    const detail = err.issues
      .map((i) => {
        const path = i.path.join(".");
        return path ? `${path}: ${i.message}` : i.message;
      })
      .join("; ");
    return `Invalid arguments — ${detail}`;
  }
  if (err instanceof DiscordAPIError) {
    const code = Number(err.code);
    const hint = DISCORD_ERROR_HINTS[code];
    const base = `Discord API error ${err.code} (HTTP ${err.status}): ${err.message}`;
    return hint ? `${base} — ${hint}` : base;
  }
  return err instanceof Error ? err.message : String(err);
}

const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));
const version: string = pkg.version;

// ─── MCP Server ────────────────────────────────────────────────────────────────

const server = new Server({ name: "discord-mcp", version }, { capabilities: { tools: {} } });

// ─── Tool Definitions ──────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async (req) => {
  if (req.params?.cursor !== undefined)
    throw new McpError(ErrorCode.InvalidParams, "Invalid cursor: tools/list is not paginated.");
  return { tools: getAllDefinitions() };
});

// ─── Tool Handler ───────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  if (!hasTool(name)) throw new McpError(ErrorCode.InvalidParams, `Unknown tool: ${name}`);

  try {
    await ensureConnected();
    return await handleTool(name, args);
  } catch (err: unknown) {
    return {
      content: [{ type: "text", text: `❌ Error: ${formatToolError(err)}` }],
      isError: true,
    };
  }
});

// ─── Start ─────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Discord MCP Server v${version} running on stdio.`);
}

function shutdown() {
  console.error("Shutting down Discord MCP Server...");
  discord.destroy();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("unhandledRejection", (reason) => console.error("Unhandled rejection:", reason));
process.on("uncaughtException", (err) => console.error("Uncaught exception:", err));

main().catch((err) => {
  console.error("Fatal:", err);
  discord.destroy();
  process.exit(1);
});
