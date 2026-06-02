/**
 * Tool registry — aggregates all tool modules and provides a unified interface
 * for listing definitions and routing tool calls to the correct handler.
 *
 * To add a new tool module:
 * 1. Create a new file in this folder (e.g. `onboarding.ts`)
 * 2. Build it with `defineModule([...])` and default-export the result
 * 3. Import and add it to `allToolsets` below (the key is its `DISCORD_MCP_TOOLSETS` name)
 */

import type { ToolModule, ToolDefinition, ToolHandler, ToolResult } from "./types.js";

import discovery from "./discovery.js";
import messages from "./messages.js";
import channels from "./channels.js";
import permissions from "./permissions.js";
import members from "./members.js";
import roles from "./roles.js";
import moderation from "./moderation.js";
import screening from "./screening.js";
import stats from "./stats.js";
import forums from "./forums.js";
import webhooks from "./webhooks.js";
import scheduledEvents from "./scheduledEvents.js";
import invites from "./invites.js";
import dm from "./dm.js";

/** Every toolset, keyed by the name used in the `DISCORD_MCP_TOOLSETS` env var. */
const allToolsets: Record<string, ToolModule> = {
  discovery,
  messages,
  channels,
  permissions,
  members,
  roles,
  moderation,
  screening,
  stats,
  forums,
  webhooks,
  events: scheduledEvents,
  invites,
  dm,
};

/**
 * Selects which toolsets to expose from `DISCORD_MCP_TOOLSETS` (comma-separated
 * names). Unset or empty exposes all 97 tools; unknown names are warned and skipped;
 * if nothing valid is selected it falls back to all so the server is never toolless.
 */
function selectModules(): ToolModule[] {
  const raw = process.env.DISCORD_MCP_TOOLSETS?.trim();
  if (!raw) return Object.values(allToolsets);
  const selected = raw
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => {
      const mod = allToolsets[name];
      if (!mod) console.error(`Unknown toolset in DISCORD_MCP_TOOLSETS: "${name}" (known: ${Object.keys(allToolsets).join(", ")}).`);
      return mod;
    })
    .filter((mod): mod is ToolModule => mod !== undefined);
  return selected.length > 0 ? selected : Object.values(allToolsets);
}

const modules: ToolModule[] = selectModules();

/** One O(1) name→handler table merged from every module, built once at load. */
const registry: Map<string, ToolHandler> = (() => {
  const map = new Map<string, ToolHandler>();
  for (const mod of modules) {
    for (const [name, handler] of mod.handlers) {
      if (map.has(name)) throw new Error(`Duplicate tool name across modules: ${name}`);
      map.set(name, handler);
    }
  }
  return map;
})();

/**
 * Returns every tool definition across all modules.
 * Called once when the MCP client requests the tool list.
 */
export function getAllDefinitions(): ToolDefinition[] {
  return modules.flatMap((m) => m.definitions);
}

/**
 * Routes a tool call to its handler via the merged registry.
 * @throws {Error} If no tool owns the given name.
 */
export async function handleTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const handler = registry.get(name);
  if (!handler) throw new Error(`Unknown tool: ${name}`);
  return handler(args);
}
