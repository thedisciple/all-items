# All Items contributor instructions

- Keep M0 scoped to the local inventory vertical slice; do not add later milestone features without direction.
- Keep UI text in Russian and code, comments, and public documentation in English.
- Bind the app to loopback by default. Do not add public or LAN inventory access without server-side authentication and origin protections.
- Keep the SQLite database and private user data outside the repository. Never commit real inventory records, personal media, secrets, or local backups.
- Extend the database through additive SQL migrations. Keep domain logic in `src/items`, separate from React components.
- Validate all server inputs with Zod. Keep UI behavior real and avoid placeholder controls or AI claims.
- Before a coherent commit, run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`; report any unavailable check accurately.
- Use concise conventional commit messages and preserve existing history.
