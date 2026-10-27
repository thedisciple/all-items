# All Items

All Items is a local-first, self-hosted inventory for the physical things people own: from electronics and workshop tools to books, cameras, and household belongings. It is designed to make a private inventory useful before any optional future sharing or AI features exist.

## Current status

M3.3A adds independent inventories in one local SQLite installation, explicit inventory-scoped navigation, create/rename/confirmed delete, and non-destructive archive import as a new inventory. Each inventory owns its items, stock, locations, categories, collections, covers and numbering sequence. Existing original identities and data are preserved. The complete local interface supports Russian, English, Ukrainian, Serbian Latin and Simplified Chinese, including errors translated at render time.

Shared controls, stable filters, compact category selection, unobscured collection creation, focused item editing, content-sized photo editing and full collection-cover viewing follow [the design manifesto](docs/product/design-manifesto.md). Add Item keeps meaningful drafts locally in the browser, scoped to the inventory. After a reload, choose Restore or Discard. Text, category choices, stock and selected photo/source Blobs are included; storage can be denied or full, and a write interrupted by a sudden crash may not have committed. Multi-photo galleries remain future work.

See [ROADMAP.md](ROADMAP.md), [the inventory ADR](docs/architecture/adr-multiple-inventories.md) and [M3.3A validation](docs/architecture/m3-3a-validation.md). AI assists development; no AI integration is present in the application.

## Run on Windows 11

Use Node.js 24 (the local validation runtime) or a compatible Node.js version from package.json. CI uses Node.js 22, with a minimum of 22.13 required by ESLint 10. Then in PowerShell:

```powershell
git clone https://github.com/thedisciple/all-items.git
cd all-items
npm ci
npm run dev
```

Open <http://127.0.0.1:3000>. The first start applies SQLite migrations. The app binds to loopback and stores the database and private media under `%LOCALAPPDATA%\AllItems`. To use a different private data directory for the current PowerShell session, set `$env:ALL_ITEMS_DATA_DIR` before starting the app; it must be outside the repository. On other systems the fallback is `~/.all-items`.

For a production build, run `npm run build`, then `npm start`. The build does not open or migrate the inventory database; `npm start` applies pending migrations before serving. Before upgrading an existing installation, stop the app and make a consistent SQLite backup. Keep the backup outside the repository. Before applying pending migrations to an existing database, the startup/migration command also creates and verifies a SQLite/media snapshot under the private data directory's backups folder. A failed backup aborts migration; keep the app stopped during an explicit migration. This is a migration safeguard, not scheduled backup. No Docker, hosted database, account, or runtime internet connection is required after dependencies are installed and the app is built. This is server-side local operation; it does not provide independent offline mobile access or synchronization.

The interface supports Русский, English, Українська, Srpski, and 简体中文. The first visit follows a supported browser language and otherwise uses Russian; the language selector stores an explicit first-party cookie and keeps the current route. All dictionaries are bundled locally. Items support several categories through a normalized assignment relation. Categories use stable internal keys, localized labels, and a restrained local emoji mapping; category identity does not depend on emoji. Existing category text is preserved and only exact, unambiguous legacy labels are mapped for display/filtering.

Use the inventory selector to create or switch spaces. Settings allows rename and deletion of the explicit selected inventory, with actual counts and typed-name confirmation for populated inventories. Deletion first creates a verified private SQLite/media backup; it never clears other inventories. Removing the final inventory shows Create Inventory, including after restart. Display numbers are immutable within their inventory and deleted numbers are never automatically reused.

Open **Data** to download that inventory's portable ZIP, import an archive as a separate inventory, or download CSV. Revision 5 adds the inventory's default sorting preference and custom-category emoji; revision 4 and tested revision 2/3 recovery adapters remain supported. Revision 1 and unknown revisions are unsupported. Preview validates the selected archive; confirmation revalidates it, assigns fresh UUIDs to every identity/reference, preserves display numbers, the next sequence, metadata and media, and switches only after commit. Importing the same ZIP twice creates independent spaces. No merge or replacement shortcut is provided.

ZIPs contain readable paths, stable versioned JSON, private photos and sources, cover uploads and SHA-256 checksums. Archives are capped at 128 MiB; limits and failure states are explicit. Import stages private files and records interruption recovery; keep the original ZIP until restoration is checked. Failed-operation archives/journals remain in private recovery storage. See [the archive format](docs/architecture/archive-format.md). CSV is a separate lossy spreadsheet export with formula protection; it cannot restore an inventory and contains no photographs. Downloads stay on this device.

## Privacy and limitations

The default server is unauthenticated and intended only for the same computer via loopback. Do not change the bind address or expose this instance to a LAN or public network. Browser camera access requires HTTPS or a browser-recognized secure local context and explicit user permission; ordinary file selection remains available. A phone cannot access a PC's loopback address, and this project does not enable LAN access as a workaround. Item data and normalized photos are stored under the configured application data directory, outside the repository and Next.js public directory. Uploads accept JPEG, PNG, or WebP up to 10 MiB, 12,000 pixels per side, and 40 megapixels. The app strips metadata and stores a normalized editable source for newly added/replaced item photos, plus a display derivative and thumbnail. An unsaved browser-local draft can temporarily contain the original selected file and its metadata; drafts are not included in exports. Existing cropped photos have no recoverable pixels beyond their saved crop and remain unchanged by migration. Collection cover uploads use private normalized WebP files and identifier-checked, no-store media routes. Export is local-only and does not change the inventory; it is not automatic backup. Import creates a new inventory; SQLite and files cannot form one atomic transaction, so retain the original archive for recovery from a sudden power loss. This local version has no multi-user access control, sync, public inventory endpoint, or AI integration. Sale intent remains private planning metadata and does not create a listing.

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
