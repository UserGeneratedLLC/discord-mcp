import { z } from "zod";
import type { ToolModule, ToolDefinition, ToolResult, ToolAnnotations } from "./types.js";

/** A Discord snowflake ID: a 17–20 digit string. Reused by every tool that takes an ID. */
export const snowflake = z
  .string()
  .regex(/^\d{17,20}$/, "Must be a Discord snowflake ID (17-20 digits).");

/** The `guild_id` field, identical across nearly every guild-scoped tool. */
export const guildId = snowflake.describe("Discord server (guild) ID (snowflake).");

/**
 * Converts a zod schema into the JSON Schema shape MCP sends over the wire.
 * `io: "input"` emits the input view (so `.default()`s stay optional); the `$schema`
 * key zod adds is stripped because MCP `inputSchema` is a bare object schema.
 */
function toInputSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { io: "input" }) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

/**
 * A registered tool: its public metadata plus a `run` that validates raw args
 * with its zod schema before handing typed values to the handler.
 */
interface RegisteredTool {
  name: string;
  description: string;
  annotations?: ToolAnnotations;
  inputSchema: Record<string, unknown>;
  run(args: Record<string, unknown>): Promise<ToolResult>;
}

/**
 * Declares one tool from a single source of truth: the zod `schema` derives the
 * client-facing `inputSchema` and validates incoming args, so `handle` receives
 * values already typed and checked — no `as` casts, no schema/handler drift.
 */
export function defineTool<S extends z.ZodType>(tool: {
  name: string;
  description: string;
  annotations?: ToolAnnotations;
  schema: S;
  handle(args: z.infer<S>): Promise<ToolResult>;
}): RegisteredTool {
  return {
    name: tool.name,
    description: tool.description,
    annotations: tool.annotations,
    inputSchema: toInputSchema(tool.schema),
    run: (args) => tool.handle(tool.schema.parse(args)),
  };
}

/**
 * Assembles a list of {@link defineTool} tools into a {@link ToolModule}, exposing
 * their definitions and routing a call to the matching tool (or `null` if none owns
 * the name, per the module contract). Validation runs inside each tool's `run`.
 */
export function defineModule(tools: RegisteredTool[]): ToolModule {
  const byName = new Map(tools.map((t) => [t.name, t]));
  const definitions: ToolDefinition[] = tools.map((t) => ({
    name: t.name,
    description: t.description,
    annotations: t.annotations,
    inputSchema: t.inputSchema,
  }));

  async function handle(name: string, args: Record<string, unknown>): Promise<ToolResult | null> {
    const tool = byName.get(name);
    return tool ? tool.run(args) : null;
  }

  return { definitions, handle };
}
