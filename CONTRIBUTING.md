# Contributing

Thanks for your interest in contributing to Discord MCP Server!

## Adding a New Tool

1. Create a new file in `src/tools/` (e.g. `myfeature.ts`)
2. Export `definitions` (tool schemas) and `handle()` (tool logic)
3. Import and add it to the `modules` array in `src/tools/index.ts`
4. Update `README.md` with the new tool(s)

### Tool Module Structure

Every tool module must satisfy the `ToolModule` interface:

```typescript
import { discord, validateId } from "../client.js";
import type { ToolModule, ToolResult } from "./types.js";

export const definitions = [
  {
    name: "discord_my_tool",
    description:
      "One clear action sentence. Then: when to use it vs. similar tools, required Discord permissions, any side effects or destructive/irreversible behavior, and what it returns.",
    annotations: {
      title: "My tool",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    inputSchema: {
      type: "object",
      properties: {
        guild_id: { type: "string", description: "Discord server (guild) ID (snowflake)." },
      },
      required: ["guild_id"],
    },
  },
];

export async function handle(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult | null> {
  switch (name) {
    case "discord_my_tool": {
      const guildId = validateId(args.guild_id, "guild_id");
      // ... tool logic
      return { content: [{ type: "text", text: "result" }] };
    }
    default:
      return null;
  }
}

export default { definitions, handle } satisfies ToolModule;
```

### Conventions

- Use `validateId()` for all Discord snowflake IDs
- Return `null` from `handle()` if the tool name doesn't match (routing)
- Success messages start with `✅`
- Use `JSON.stringify(data, null, 2)` for list responses
- Tool names are prefixed with `discord_`

### Tool definition quality

Every tool definition must carry its weight — directory scanners (e.g. Glama) score the
_lowest_-quality tool heavily, so one thin definition drags the whole server's grade down.

- **Description**: action statement + when to use it vs. similar tools + required Discord
  permissions + side effects / destructive behavior + what it returns.
- **`annotations`**: set the MCP hints — `readOnlyHint` (true for pure reads), `destructiveHint`
  (true for delete/ban/prune/irreversible writes), `idempotentHint` (true if repeating the call
  changes nothing further), and `openWorldHint: true` (every tool calls the Discord API). Add a
  short `title`.
- **Parameters**: give every `inputSchema` property a `description` with its format and constraints
  (e.g. snowflake, value range, defaults). When the same schema block repeats across tools, extract
  it into a shared `const` and spread it (see `EMBED_FIELD_PROPS` in `messages.ts`).

## Development

```bash
npm install
npm run build
npm run dev       # build + run
```

## Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Build and test your changes
4. Commit with a descriptive message (e.g. `feat: add my-tool`)
5. Open a pull request against `main`

## Releasing (maintainers)

Versions live in three files — `package.json`, `package-lock.json` and `server.json` (the MCP Registry manifest) — and must always agree. Never edit them by hand; from an up-to-date `main`, run:

```bash
npm version patch   # or minor / major
```

This bumps all three files (`server.json` via the `version` lifecycle script in `scripts/sync-version.js`), commits, and creates the `vX.Y.Z` tag. Add a `CHANGELOG.md` entry for the new version before or as part of that commit, then push:

```bash
git push origin main --follow-tags
```

The tag triggers `.github/workflows/release.yml`, which does everything else automatically:

1. Fails fast if the tag does not match `package.json` / `server.json`
2. Lints, builds, tests, then publishes to npm (`NPM_TOKEN` secret)
3. Publishes to the official MCP Registry via GitHub OIDC (no secret needed) — the [GitHub MCP Registry](https://github.com/mcp) picks it up automatically
4. Pushes the Docker images and creates the GitHub Release

No manual `npm publish` — local publishes are blocked by npm's 2FA policy anyway.
