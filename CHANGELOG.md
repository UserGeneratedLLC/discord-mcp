# Changelog

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
