# All Items

All Items is a local-first, self-hosted inventory for the physical things people own: from electronics and workshop tools to books, cameras, and household belongings. It is designed to make a private inventory useful before any optional future sharing or AI features exist.

## Current status

M0–M4C implementation is complete with documented synthetic validation; physical-device and independent security acceptance remain open. M4D adds GitHub synchronization and isolated preview/release operations. [ROADMAP.md](ROADMAP.md) is the canonical status; older milestone reports retain historical evidence.

For a separate local preview use `npm run preview` (first account setup: `npm run preview -- --owner`). The command identifies the selected committed SHA, prepares an isolated release/build and data directory, and starts loopback port 3200. It refuses occupied ports and unmarked existing data; no credentials are installed automatically. Use `--port 3201` if another preview is already running. See [preview and approved beta operations](docs/architecture/release-workflow.md) for options, backup and rollback gates.

M4A completes photo-first creation: select up to ten files together or capture photos sequentially, crop each independently, browse, choose one primary and reorder before one Save Item. The shared gallery uses separate thumbnail viewing and primary-star controls, hold/drag sorting (mouse 200ms, touch 350ms), keyboard sorting and compact navigation. Existing/imported galleries above ten remain intact; replacement, order, export and import are not capped.

Creation prepares private metadata-stripped assets sequentially, then commits item fields, stock, categories, ordered photos and a retry receipt together. A failed preparation leaves no partial item; retrying after a lost acknowledgement recovers the same result. Browser-local inventory-scoped drafts retain all source/selected/pending Blobs, crops, order and primary with explicit Restore/Discard, revision checks and legacy single-photo recovery. A browser write interrupted before IndexedDB commit can still be lost.

The responsive header/toolbar, dialog insets, ISO-only currency labels and safe detail exit are covered by a reusable synthetic Edge acceptance gate. Exact price units, five complete local dictionaries and experimental ZIP revision 6 with tested revision 2–5 import recovery remain unchanged. See [M4A validation](docs/architecture/m4a-validation.md), [creation and retry architecture](docs/architecture/m4a-creation-plan.md), [gallery interactions](docs/architecture/m4a-gallery.md) and [ROADMAP.md](ROADMAP.md).

M4A and M4B.1–M4B.2 provide local creation, usability and verified installation-backup groundwork. M4B.3 adds device-readiness and inventory presentation options. P1 adds local accounts. P2 prepares an opt-in, strictly configured HTTPS reverse-proxy mode and optional invite-only Telegram OIDC; the owner reports subsequent ts.net access, while live Telegram verification and physical-device/independent security acceptance remain open. See the [P2 threat checklist](docs/architecture/p2-threat-model.md), [deployment guide](docs/architecture/p2-deployment.md), [Telegram setup](docs/architecture/p2-telegram.md), [operator checklist](docs/architecture/p2-operator-checklist.md) and [compatibility policy](docs/architecture/v0-1-compatibility.md).

## Run on Windows 11

M4C adds mobile direct navigation, contextual Data access, a bounded photo editor and database-backed 25/50/100 item pages. See [mobile decisions](docs/product/m4c-mobile-design.md), [physical-device acceptance](docs/product/m4c-device-acceptance.md) and [optional experiment/WebMCP plans](docs/architecture/m4c-experiments.md). Real-device and independent security acceptance remain required before beta deployment.

Use Node.js 24 (the local validation runtime) or a compatible Node.js version from package.json. CI uses Node.js 22, with a minimum of 22.13 required by ESLint 10. Then in PowerShell:

```powershell
git clone https://github.com/thedisciple/all-items.git
cd all-items
npm ci
npm run db:migrate
npm run auth -- owner
npm run dev
```

Account usernames deliberately accept 3–64 ASCII letters, digits, `.`, `_`, `-`, beginning with a letter or digit; surrounding whitespace is trimmed and case is normalized. Cyrillic/other Unicode usernames are rejected by policy. This is separate from PowerShell encoding. Item names and other user content support Unicode. Keep existing account identifiers unchanged.

Open <http://127.0.0.1:3000>. The first start applies SQLite migrations. The app binds to loopback and stores the database and private media under `%LOCALAPPDATA%\AllItems`. To use a different private data directory for the current PowerShell session, set `$env:ALL_ITEMS_DATA_DIR` before starting the app; it must be outside the repository. On other systems the fallback is `~/.all-items`.

For a production build, run `npm run build`, then `npm start`. The build does not open or migrate the inventory database; `npm start` applies pending migrations before serving. Before upgrading an existing installation, stop the app and make a consistent SQLite backup. Keep the backup outside the repository. Before applying pending migrations to an existing database, the startup/migration command also creates and verifies a SQLite/media snapshot under the private data directory's backups folder. A failed backup aborts migration; keep the app stopped during an explicit migration. This is a migration safeguard, not scheduled backup. Local owner credentials are now required. No Docker, hosted database, external identity account, or runtime internet connection is required after dependencies are installed and the app is built. This is server-side local operation; it does not provide independent offline mobile access or synchronization.

The interface supports Русский, English, Українська, Srpski, and 简体中文. The first visit follows a supported browser language and otherwise uses Russian. Choose a language on login/invitation or in **Account Settings** after signing in. It remains a validated browser cookie across routes, reload and login, rather than an account-synchronized preference; no identity migration is needed. All dictionaries are bundled locally. Items support several categories through a normalized assignment relation. Categories use stable internal keys, localized labels, and a restrained local emoji mapping; category identity does not depend on emoji. Existing category text is preserved and only exact, unambiguous legacy labels are mapped for display/filtering.

Use the inventory selector to create or switch spaces. Settings allows rename and deletion of the explicit selected inventory, with actual counts and typed-name confirmation for populated inventories. Deletion first creates a verified private SQLite/media backup; it never clears other inventories. Removing the final inventory shows Create Inventory, including after restart. Display numbers are immutable within their inventory and deleted numbers are never automatically reused.

Open **Data** to download that inventory's portable ZIP, import an archive as a separate inventory, or download CSV. Revision 6 preserves ordered photos, explicit primary identity, stored price precision, default sorting and custom-category emoji. Tested revision 2–5 recovery adapters remain supported. Revision 1 and unknown revisions are unsupported. Preview validates the selected archive; confirmation revalidates it, assigns fresh UUIDs to every identity/reference, preserves display numbers, the next sequence, metadata and media, and switches only after commit. Importing the same ZIP twice creates independent spaces. No merge or replacement shortcut is provided.

ZIPs contain readable paths, stable versioned JSON, private photos and sources, cover uploads and SHA-256 checksums. Creation inputs have separate bounds: 10 MiB per source/display file, 12,000 pixels per side, 40 MP and 64 MiB distinct browser input bytes per item. Sequential staging keeps the existing 22 MiB action-body bound; normalized staging is limited to 64 MiB per operation, 256 MiB total, 64 pending operations and 24-hour expiry. These are independent from archive limits. Archives are capped at 128 MiB; limits and failure states are explicit. Import stages private files and records interruption recovery; keep the original ZIP until restoration is checked. Failed-operation archives/journals remain in private recovery storage. See [the archive format](docs/architecture/archive-format.md). CSV is a separate lossy spreadsheet export with formula protection; it cannot restore an inventory and contains no photographs. Downloads stay on this device.

## Privacy and limitations

P1 adds local invite-only accounts and server-verified inventory ownership. The backend stays loopback-bound. Approved remote synthetic beta access uses the exact-origin authenticated Caddy/Funnel route; never expose the Next port directly. Browser camera access requires HTTPS or a browser-recognized secure local context and explicit user permission; ordinary file selection remains available. A phone cannot access a PC's loopback address, and this project does not enable LAN access as a workaround. Item data and normalized photos are stored under the configured application data directory, outside the repository and Next.js public directory. Uploads accept JPEG, PNG, or WebP up to 10 MiB, 12,000 pixels per side, and 40 megapixels. The app strips metadata and stores a normalized editable source for newly added/replaced item photos, plus a display derivative and thumbnail. An unsaved browser-local draft can temporarily contain the original selected file and its metadata; drafts are not included in exports. Existing cropped photos have no recoverable pixels beyond their saved crop and remain unchanged by migration. Collection cover uploads use private normalized WebP files and identifier-checked, no-store media routes. Export is local-only and does not change the inventory; it is not automatic backup. Import creates a new inventory; SQLite and files cannot form one atomic transaction, so retain the original archive for recovery from a sudden power loss. This local version supports separately owned inventories after local account provisioning; it has no shared roles, sync, public inventory endpoint, or AI integration. Sale intent remains private planning metadata and does not create a listing.

Inventory UUIDs and the selection cookie are routing/preferences, not account authorization. Language and last-selected inventory are device-local; default sorting is inventory-local and included in its ZIP. Dependency decisions and remaining development notices are recorded in [maintenance notes](docs/architecture/dependency-maintenance.md).

## Development

```powershell
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

See [docs/architecture.md](docs/architecture.md), [docs/product/category-research.md](docs/product/category-research.md), and the architecture decisions. Contributions are welcome under [CONTRIBUTING.md](CONTRIBUTING.md). This application is licensed under GNU GPLv3 only; see [LICENSE](LICENSE).

Microsoft Edge browser checks use isolated temporary inventories and media: `npx playwright test`. Production import/restart checks require `npm run build`, then `npx playwright test --config playwright.import.config.ts` and `npx playwright test --config playwright.restart.config.ts`. These fixtures do not migrate configured owner data. Physical camera/touch-device acceptance remains separate.

## Synthetic UX acceptance

Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`. With the completed build, `npx playwright test --config playwright.acceptance.config.ts` runs the ordinary Edge suite in production mode on loopback port 3100 with a fresh temporary inventory. `npx playwright test` retains the development-mode gate. The separate production archive and restart checks use `playwright.import.config.ts` and `playwright.restart.config.ts`. All fixtures use synthetic records/media and isolated directories; these commands never migrate configured owner data. The production acceptance command requires a build first.

Reuse `e2e/helpers/layout-gate.ts` for geometry and `browser-reliability.ts` for unexpected browser errors. Keep screenshots/traces synthetic and outside version control; avoid font/OS-specific pixel snapshots. Camera streams and CDP touch are simulations; physical camera, touch, browser zoom and screen-reader task testing remain M4B acceptance work.

## Installation backup and recovery

Use `npm run backup -- create`, `list`, `verify UUID` and `drill UUID` for verified local installation copies and isolated restoration tests. The Data page offers manual creation and verification. These copies include all inventories and committed private media; portable ZIP export covers one inventory and browser drafts are separate. See [local backup commands, Windows scheduling, retention and offline recovery](docs/architecture/local-backups.md).

Inventory list View options are stored locally in this browser, separately for each inventory. **Restore default view** keeps item name/number, categories, quantities and date added visible; model/brand, locations and identification status remain optional. Existing saved settings are retained until explicitly changed/restored. They are not included in portable ZIP backups. The Data page lists recorded backup metadata without rehashing media; use **Verify backup** for a fresh integrity check.

## Local accounts and upgrades

See [the P1 account/upgrade runbook](docs/architecture/p1-local-accounts.md) before upgrading. Stop the app, create and verify an installation backup and rehearse restore before applying migration 0014. Initialize the original owner with `npm run auth -- owner` in an interactive local terminal; there is no default password. Provision invitees with `npm run auth -- invite`; reset credentials with `npm run auth -- reset`, revoke sessions with `npm run auth -- revoke` or `revoke-all`, and disable an invitee with `disable`. Passwords are entered twice without echo and never passed as arguments. New accounts begin with no inventories. Only the original installation administrator can view installation-wide backups.

`ALL_ITEMS_ORIGIN` defaults to `http://127.0.0.1:3000`. For an alternate local port, explicitly set the matching loopback origin before starting. An explicit HTTPS proxy mode is prepared in [the P2 runbook](docs/architecture/p2-deployment.md); the app itself still binds to loopback. Do not expose it until the separate security, device and owner-approval gates. Optional Telegram sign-in remains hidden without a registered trusted HTTPS origin and private Client ID/Secret. For an existing installation, stop writers and verify an installation backup and isolated restore drill before migration 0015; tests/builds must never migrate the configured owner database.

The selected first remote-beta path is [Windows + Tailscale Funnel through a loopback Caddy adapter](docs/architecture/p2-first-beta-runbook.md), subject to owner setup/approval and external acceptance. Testers will use one HTTPS URL without installing Tailscale. Never point Funnel directly at port 3000. [The Sites feasibility decision](docs/architecture/p2-hosting-decision.md) records why hosting this repository unchanged on Sites was rejected; that historical assessment did not itself deploy a Site or enable a tunnel.
