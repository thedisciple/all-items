# Architecture

All Items is a single Next.js App Router application. Server-rendered UI and server actions call the item service in `src/items`; that service validates inputs with Zod and uses the local libSQL SQLite client. Ordered SQL migration files live in `src/db/migrations`. The runner applies each migration and records it in the same write transaction. App startup may apply pending migrations; `npm run build` and tests do not open the configured user database.

The schema contains one local workspace, UUID item identities, deterministic per-workspace inventory numbers, item details, locations, and stock entries. The M1 migration backfills numbers by creation timestamp and UUID, retaining existing UUIDs, names, models, and timestamps. Existing items start with quantity one and unique tracking mode. New unique items also start at one; bulk and consumable items start at zero. A unique item must have a total quantity of exactly one. Stock quantities are nonnegative.

The database lives under `%LOCALAPPDATA%\AllItems` on Windows and `~/.all-items` elsewhere by default (or `ALL_ITEMS_DATA_DIR`), outside the repository. Builds and tests use no user database. The web process binds to `127.0.0.1` by default. Sale intent and price are local private metadata only.

Keep domain behavior outside React components and evolve schema through additive migrations. Future authentication and workspace ownership can build on the stable UUIDs. M1 does not implement media, sync, AI, multi-user support, or public endpoints.
