/**
 * MCP tool behavioral hints (advisory, not guarantees). See the MCP spec
 * "tool annotations": readOnlyHint (only reads, never mutates), destructiveHint
 * (may perform irreversible updates — delete/ban/prune), idempotentHint (repeat
 * calls with same args add no effect), openWorldHint (talks to an external API —
 * always true here). title is a human-readable display name.
 */
export interface ToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

/**
 * Schema definition for a single MCP tool: its name, purpose, and expected input.
 * `outputSchema` is the JSON Schema (object root) of the tool's `structuredContent`,
 * present only on tools that return structured output.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  annotations?: ToolAnnotations;
}

/**
 * Standard response returned by every tool handler. `structuredContent` is an
 * optional machine-readable mirror of the text block, conforming to the tool's
 * `outputSchema` when one is declared.
 */
export interface ToolResult {
  [key: string]: unknown;
  content: { type: string; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

/**
 * Contract every tool module must satisfy.
 * - `definitions`: the tools this module exposes to the MCP client.
 * - `handle()`: attempts to execute a tool by name; returns `null` if the name doesn't belong to this module.
 */
export interface ToolModule {
  definitions: ToolDefinition[];
  handle(name: string, args: Record<string, unknown>): Promise<ToolResult | null>;
}
