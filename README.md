# All Items

All Items is a local-first, self-hosted inventory for the physical things people own: from electronics and workshop tools to books, cameras, and household belongings. It is designed to make a private inventory useful before any optional future sharing or AI features exist.

## Current status

M0 is the first working vertical slice. The Russian-language web page lets you add an item with a name and optional model or marking, then shows items read from a local SQLite database. Restarting the app preserves the inventory.

Planned work is tracked in [ROADMAP.md](ROADMAP.md). Images, editing, stock, collections, import/export, and AI are not implemented in M0. AI assists development; product decisions, code review, and validation remain human-directed.

## Run on Windows 11

Install Node.js 20.9 or later, then in PowerShell:

```powershell
git clone https://github.com/thedisciple/all-items.git
cd all-items
npm ci
npm run dev
```

Open <http://127.0.0.1:3000>. The first start applies the SQLite migration. The app binds to loopback and stores the database at `%LOCALAPPDATA%\AllItems\all-items.db`. To use a different private data directory for the current PowerShell session, set `$env:ALL_ITEMS_DATA_DIR` before starting the app.

For a production build, run `npm run build`, then `npm start`. Both modes run migrations before starting. No Docker, hosted database, account, or runtime internet connection is required after dependencies are installed and the app is built. This is server-side local operation; it does not provide independent offline mobile access or synchronization.

## Privacy and limitations

The default server is unauthenticated and intended only for the same computer via loopback. Do not change the bind address or expose this instance to a LAN or public network. Item data is stored on disk in the configured application data directory. M0 has no image handling, backup tool, authentication, sync, public inventory endpoint, or AI integration.

## Development

```powershell
npm ci
npm run db:migrate
npm run typecheck
npm run lint
npm test
npm run build
```

See [docs/architecture.md](docs/architecture.md), [docs/decisions/0001-local-first.md](docs/decisions/0001-local-first.md), and [docs/decisions/0002-data-model.md](docs/decisions/0002-data-model.md). Contributions are welcome under [CONTRIBUTING.md](CONTRIBUTING.md). This application is licensed under GNU GPLv3 only; see [LICENSE](LICENSE).
