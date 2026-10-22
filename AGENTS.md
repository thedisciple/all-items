# All Items contributor instructions

- Keep UI text in Russian and code, comments, and public documentation in English.
- Bind the app to loopback by default. Do not add public or LAN inventory access without server-side authentication and origin protections.
- Keep SQLite data, backups, generated storage, and private user data outside the repository. Never commit real inventory records, personal media, secrets, or local backups.
- Store uploaded images only under the configured All Items data directory; never put them in `public/` or serve files by accepting user-supplied paths.
- The default database lives in `%LOCALAPPDATA%\AllItems\all-items.db` on Windows or `~/.all-items/all-items.db` elsewhere. `ALL_ITEMS_DATA_DIR` must point outside the repository.
- Extend the database only through ordered, additive SQL migrations. Keep migrations repeatable and run each with its migration log entry in one transaction.
- Builds and tests must use isolated databases and must never migrate the user's configured database. Only the explicit `npm run db:migrate` and application startup scripts may migrate configured app data.
- Validate all server inputs with Zod. Keep domain logic in `src/items`, separate from React components. Keep private sale intent local and unpublished.
- Before a coherent commit, run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`; report any unavailable check accurately.
- Inspect staged file names and diffs for local data, generated files, and secrets before committing. Use concise conventional commit messages and preserve existing history.
