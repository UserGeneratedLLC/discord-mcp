# Changelog

## [1.7.2] - 2026-06-10

### Fixed

- MCP Registry namespace case: GitHub OIDC grants publish rights on `io.github.PaSympa/*` (exact GitHub account casing), but `mcpName` / `server.json` used lowercase `io.github.pasympa`, so the registry publish of 1.7.1 was rejected with a 403. Both now use `io.github.PaSympa/discord-mcp`

## [1.7.1] - 2026-06-10

### Added

- Published to the official MCP Registry (registry.modelcontextprotocol.io), surfaced on the GitHub MCP Registry (github.com/mcp): `mcpName` ownership marker in `package.json` and a `server.json` registry manifest
- Release workflow now publishes to the MCP Registry automatically (GitHub OIDC, no extra secrets) after the npm publish, and guards that the pushed tag matches `package.json`
- `npm version` now syncs `server.json` automatically, so a single `npm version patch|minor|major` keeps every version location aligned

## [1.7.0] - 2026-05-29

### Fixed

- `discord_get_role_members` no longer silently truncates at 1000 members. Discord has no "members of a role" endpoint, so it now paginates the full roster (1000/page, capped at 20 pages) before filtering, and returns a `truncated` flag when the cap is hit on very large servers
- `discord_list_bans` is now paginated. A single fetch only ever returned the first page (≤1000) while the description claimed it fetched all; it now returns `{ bans, nextCursor }` and accepts an `after` cursor
- `discord_fetch_pinned_messages` migrated from the deprecated `MessageManager#fetchPinned()` (removed in discord.js v15) to `fetchPins()`, and now also returns `pinnedAt`
- `discord_timeout_member` and `discord_prune_members` validate their numeric inputs (`duration_minutes`, `days`) instead of casting blindly, rejecting NaN / out-of-range values with a clear error

### Changed

- Renamed the `ready` gateway listener to `clientReady` — forward-compatible with discord.js v15 (where `ready` no longer fires) and silences the v14 deprecation warning
- Connection robustness: login now races a 30s READY timeout (no more indefinite hangs), resets its in-flight state on failure so the next call retries, and registers `error` / `shardError` / `invalidated` listeners (an unhandled client error could previously crash the process). REST retries/timeout configured; process-level `unhandledRejection` / `uncaughtException` handlers added
- Tool errors now surface the underlying `DiscordAPIError` code + HTTP status with a plain-language hint (e.g. 50013 → missing permission, 10008 → unknown message) instead of a bare message
- Cursor pagination on large lists: `discord_list_members`, `discord_get_event_subscribers`, and `discord_list_forum_threads` now return a cursor (`nextCursor` / `nextBefore` + `hasMore`) and accept `after` / `before` to page, instead of silently returning only the first page. These tools now return an object (`{ items, nextCursor }`) rather than a bare array
- Uniform snowflake validation: `getTextChannel` / `getGuildChannel` validate `channel_id` internally, and `user_id` / `role_id` are validated in the member and role tools (and `discord_delete_channel`), so malformed IDs give a clear error instead of an opaque API failure
- Numeric inputs (`limit`, `count`, `delete_message_days`, audit-log/forum/DM limits, …) are coerced and clamped via shared `clampInt` / `validateInt` helpers, preventing NaN from reaching the Discord API
- Read-only message fetches (`discord_read_messages`, `discord_search_messages`) pass `{ cache: false }` to avoid unbounded message-cache growth
- `discord_bulk_ban` is now safe-by-default with a `dry_run` flag (previews the resolved user IDs; set `dry_run:false` to actually ban), mirroring `discord_prune_members`, and validates each user ID

## [1.6.2] - 2026-05-29

### Fixed

- `discord_get_reactions` / `discord_remove_reactions` now resolve custom emoji passed as `name:id`. The reaction cache is keyed by the emoji id (custom) or the unicode char (standard) — not the `name:id` form the tool schema accepts — so custom-emoji lookups previously failed with "No reaction found" even when the reaction existed. A new `findReaction()` helper normalizes the emoji to the cache key (handles `name:id`, `<:name:id>`, `<a:name:id>`, raw id, and unicode) (#25)
- The role tools (`discord_edit_role`, `discord_delete_role`, `discord_get_role_members`, `discord_set_role_position`, `discord_set_role_icon`) now return a clear "Role not found" error for an unknown `role_id` instead of crashing on a null dereference — removed the misleading `as Role` cast that hid the `| null` return of `guild.roles.fetch()` (#25)

### Changed

- Dropped the unused `GuildModeration` and `GuildInvites` gateway intents. All ban/invite operations are REST-only and no code subscribes to their gateway events, so requesting them only widened the gateway footprint. `MessageContent`, `GuildMembers`, and `GuildScheduledEvents` are kept (actually consumed) (#25)
- Extracted a shared `buildEmbed()` + `EMBED_FIELD_PROPS` into `src/embeds.ts`, removing three drifting copies across the message, DM, and webhook tools (#25)
- Added a `deserializePermissions()` helper (inverse of `serializePermissions`), reused by `discord_create_role` and `discord_edit_role` instead of an inline `PermissionsBitField` expression duplicated twice (#25)

## [1.6.1] - 2026-05-29

### Fixed

- `discord_pin_message` description no longer claims "Requires the Manage Messages permission". Discord introduced a dedicated **Pin Messages** permission in early 2026 (separate from Manage Messages), and discord.js dropped the Manage Messages check from `Message#pinnable`. The tool now points at the correct permission so the model expects the right one (#21)

## [1.6.0] - 2026-05-28

### Added

- MCP tool `annotations` on all 97 tools (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`, `title`) so clients can apply safety policies and parallelize read-only calls
- `ToolAnnotations` type and optional `annotations` field on `ToolDefinition`

### Changed

- Enriched every tool description with usage guidance, required Discord permissions, side effects / destructive behavior, and return value — improving agent reliability and directory tool-definition-quality scores
- Documented every input-schema parameter (100% coverage), including nested embed/field properties, with formats and constraints
- Extracted shared embed schema fragments (`EMBED_FIELD_PROPS`, `WEBHOOK_EMBED_PROPS`) to keep repeated definitions in sync
- CONTRIBUTING: documented the tool-definition quality bar (description, annotations, parameter docs)

## [1.5.1] - 2026-05-27

### Fixed

- `getTextChannel` now accepts `ThreadChannel` (forum / public / private / announcement threads) in addition to `TextChannel`, unblocking all message tools on threads: `discord_edit_message`, `discord_delete_message`, `discord_add_reaction`, `discord_read_messages`, `discord_pin_message`, `discord_fetch_pinned_messages`, `discord_bulk_delete_messages`, `discord_search_messages`, `discord_send_embed`, `discord_edit_embed`, `discord_send_multiple_embeds`, `discord_forward_message` (#17, #18)
- `discord_create_thread` now throws a clear error if the parent `channel_id` is itself a thread (standalone thread creation requires a `TextChannel`; use `message_id` to start a thread from a message instead)

## [1.5.0] - 2026-05-04

### Added

- Full DM toolset (6 new tools, 97 total): `discord_send_dm_embed`, `discord_edit_dm`, `discord_edit_dm_embed`, `discord_delete_dm`, `discord_read_dms`, `discord_reply_dm`
- All DM tools take `user_id` directly and are self-contained in `dm.ts`

## [1.4.1] - 2026-04-06

### Added

- `discord_send_dm` tool for sending direct messages by user ID (auto-creates DM channel)
- Input validation (`validateId`) on DM tool

### Changed

- README: DM tool section, tool count bumped to 91, project structure updated

### Fixed

- Removed `dist/` from git tracking (now in `.gitignore`)

## [1.4.0] - 2025-03-25

### Added

- 20 new tools enhancing existing categories (90 total)
- Messages: crosspost, remove/get reactions, fetch pinned, forward
- Members: search, set nickname, list bans, bulk ban, prune
- Webhooks: edit/delete/fetch webhook messages
- Channels: set position, follow announcement, lock permissions, NSFW flag
- Roles: set position, set icon
- Invites: list channel-specific invites
- Scheduled Events: create event invite

### Fixed

- `discord_list_bans` now handles empty ban lists gracefully

## [1.3.0] - 2025-03-24

### Added

- 10 new tools (70 total)
- Scheduled Events: list, get, create, edit, delete, get subscribers (6 tools)
- Invites: list, get, create, delete (4 tools)
- `GuildScheduledEvents` and `GuildInvites` gateway intents

## [1.2.0] - 2025-03-20

### Added

- Forum tools: 10 tools for forum channels, posts, tags, threads
- Webhook tools: 5 tools for webhook management
- Docker support with multi-stage build
- Glama badge for MCP server listing

## [1.1.0] - 2025-03-18

### Added

- Initial release with 60 tools
- Messages, channels, roles, permissions, moderation, screening, stats
