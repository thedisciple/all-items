# All Items

All Items is a local-first, self-hosted inventory for the physical things people own: from electronics and workshop tools to books, cameras, and household belongings. It is designed to make a private inventory useful before any optional future sharing or AI features exist.

## Current status

M1 provides local item creation, detail and edit, confirmed deletion, sequential inventory numbers, stock quantities and locations, search, category and identification filters, and private sale intent. Sale details stay in the local database and are not published.

Planned work is tracked in [ROADMAP.md](ROADMAP.md). Images, collections, import/export, and AI remain future work. AI assists development; product decisions, code review, and validation remain human-directed.

## Run on Windows 11

Install Node.js 20.9 or later, then in PowerShell:

```powershell
git clone https://github.com/thedisciple/all-items.git
cd all-items
npm ci
npm run dev
```

Open <http://127.0.0.1:3000>. The first start applies SQLite migrations. The app binds to loopback and stores the database at `%LOCALAPPDATA%\AllItems\all-items.db`. To use a different private data directory for the current PowerShell session, set `$env:ALL_ITEMS_DATA_DIR` before starting the app; it must be outside the repository. On other systems the fallback is `~/.all-items`.

For a production build, run `npm run build`, then `npm start`. The build does not open or migrate the inventory database; `npm start` applies pending migrations before serving. Before upgrading an existing installation, stop the app and make a consistent SQLite backup. Keep the backup outside the repository. No Docker, hosted database, account, or runtime internet connection is required after dependencies are installed and the app is built. This is server-side local operation; it does not provide independent offline mobile access or synchronization.

## Privacy and limitations

The default server is unauthenticated and intended only for the same computer via loopback. Do not change the bind address or expose this instance to a LAN or public network. Item data is stored on disk in the configured application data directory. M1 has no image handling, built-in backup UI, authentication, sync, public inventory endpoint, or AI integration. Sale intent is private planning metadata and does not create a listing.

## Development

```powershell
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

See [docs/architecture.md](docs/architecture.md), [docs/decisions/0001-local-first.md](docs/decisions/0001-local-first.md), and [docs/decisions/0002-data-model.md](docs/decisions/0002-data-model.md). Contributions are welcome under [CONTRIBUTING.md](CONTRIBUTING.md). This application is licensed under GNU GPLv3 only; see [LICENSE](LICENSE).
