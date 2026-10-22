# Architecture

M0 is a single Next.js App Router application. Server-rendered UI and a server action call the item service in `src/items`; that service validates inputs with Zod and reads/writes through Drizzle. SQLite is accessed with the local libSQL client. SQL migration files live in `src/db/migrations` and are applied before `dev` or `start` launches the web server.

The initial schema contains one explicit local workspace and a minimal item record with UUID identity, name, optional model/marking, and timestamps. The database lives under `%LOCALAPPDATA%\AllItems` by default (or `ALL_ITEMS_DATA_DIR`), outside the repository. The web process binds to `127.0.0.1` by default.

Keep domain behavior outside React components and evolve schema through additive migrations. Future authentication and workspace ownership can build on the stable UUIDs. M0 does not implement media, sync, AI, multi-user support, or public endpoints.
