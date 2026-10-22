# ADR 0006: Portable archives and private beta boundaries

- Status: planned; not implemented
- Date: 2026-10-22

## Context

All Items stores private inventory records and media in local SQLite and filesystem storage. Portability and a small multi-user pilot are future goals, but raw database copying, machine-specific media paths, and unauthenticated network exposure would create fragile restore and privacy boundaries.

## Decision

Plan a versioned ZIP archive with a JSON manifest and payloads, checksums, and relative paths. Include stable item identifiers and inventory numbers, item fields, quantities/locations, collections/memberships, categories/custom attributes, private sale intentions/prices, normalized editable photo sources, display images/thumbnails, crop metadata, collection covers/icons, and portable user settings. CSV export is a separate spreadsheet interchange. Validate archive/schema/resource limits and paths, guard against ZIP-slip and ZIP bombs, define duplicate-ID behavior, support dry-run preview and empty-workspace restore, stage writes, require a verified backup before replacement, and verify recovery/integrity. Optional archive encryption is future work. Do not use raw SQLite dumps or absolute machine paths as the portable format.

Keep future archive, blob storage, backup destination, AI provider, external authentication provider, and MCP/API integrations behind distinct interfaces. Local storage remains the default. S3-compatible and WebDAV/Nextcloud destinations and Ollama/OpenAI providers are possibilities, not commitments. Telegram may support optional Login/OIDC identity mapping, Mini App interaction, or explicit share actions; it is not the database or media backend. Never request MTProto session credentials. The [Telegram Bot Developer Terms](https://telegram.org/tos/bot-developers) restrict standalone cloud-storage use and disclaim guarantees for Bot Platform cloud storage availability/integrity. Telegram Login must map identity only and must not confer chat/file access.

A future M3.5 private pilot is limited to 5–10 invited testers and is contingent on production-mode HTTPS, secure sessions, invite-only onboarding, workspace-scoped authorization on all services and media routes, CSRF/origin protections, rate limits, upload limits, security headers, backup/recovery, safe migration of the owner's workspace, and private development endpoints. Keep local authentication as a fallback if Telegram OIDC is added. Do not expose today's loopback-only unauthenticated application.

## Consequences

- Archive scope, validation, conflict handling, and recovery must be specified before implementation.
- Workspace authorization has to be enforced in services and media routes, not only in the UI.
- External identities, providers, and storage systems remain optional adapters.
- None of these features is implemented by M2D-R1.

## References

- [Roadmap: M3 and M3.5](../../ROADMAP.md)
- [Product opportunity register](../product/opportunity-register.md)
- [Telegram Login documentation](https://core.telegram.org/bots/telegram-login)
