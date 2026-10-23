# All Items

All Items is a local-first, self-hosted inventory for the physical things people own: from electronics and workshop tools to books, cameras, and household belongings. It is designed to make a private inventory useful before any optional future sharing or AI features exist.

## Current status

M2D builds on M2C with session-stable item drafts, one-step add/edit return flows, a crop editor with freeform and aspect presets, normalized private edit sources, category and collection icons, batch collection membership, and explicit private collection covers. The complete interface is bundled locally in Russian, English, Ukrainian, Serbian Latin, and Simplified Chinese. Collection memberships reference existing item records; media is stored locally and never sent to an external service. M3.2 provides a readable revision 2 ZIP export and a validated restore into an empty installation, alongside a separate spreadsheet CSV download from Data.

Planned work is tracked in [ROADMAP.md](ROADMAP.md). Revision 2 archive export and empty-workspace import are implemented. Populated-workspace merge or replacement, automated backup, crash/reload draft recovery, flexible attributes, and AI are future work. AI assists development; product decisions, code review, and validation remain human-directed.

M2D-R2 focuses on reliable crop behavior, immediate filter and photo state updates, contextual collection editing, accessible destructive confirmations, and consistent controls. M3.1 has refined collection cover consistency, item/category presentation, stock and membership editors, and photo editing. The product's minimalist design rules are documented in [the design manifesto](docs/product/design-manifesto.md). A multi-photo gallery is planned and is not part of this release.

## Run on Windows 11

Install Node.js 20.9 or later, then in PowerShell:

```powershell
git clone https://github.com/thedisciple/all-items.git
cd all-items
npm ci
npm run dev
```

Open <http://127.0.0.1:3000>. The first start applies SQLite migrations. The app binds to loopback and stores the database and private media under `%LOCALAPPDATA%\AllItems`. To use a different private data directory for the current PowerShell session, set `$env:ALL_ITEMS_DATA_DIR` before starting the app; it must be outside the repository. On other systems the fallback is `~/.all-items`.

For a production build, run `npm run build`, then `npm start`. The build does not open or migrate the inventory database; `npm start` applies pending migrations before serving. Before upgrading an existing installation, stop the app and make a consistent SQLite backup. Keep the backup outside the repository. No Docker, hosted database, account, or runtime internet connection is required after dependencies are installed and the app is built. This is server-side local operation; it does not provide independent offline mobile access or synchronization.

The interface supports Русский, English, Українська, Srpski, and 简体中文. The first visit follows a supported browser language and otherwise uses Russian; the language selector stores an explicit first-party cookie and keeps the current route. All dictionaries are bundled locally. Categories use stable internal keys, localized labels, and a restrained local emoji mapping; category identity does not depend on emoji. Existing category text is preserved and only exact, unambiguous legacy labels are mapped for display/filtering.

Open **Data** in the sidebar to download a portable ZIP, restore one into an empty installation, or download a separate CSV file. The revision 2 ZIP uses readable item and collection paths, versioned JSON with stable identifiers, private image derivatives and thumbnails, available editable sources, collection cover uploads, and SHA-256 checksums. Preview validates its contents before confirmation; restoration refuses a populated inventory. Earlier experimental revision 1 archives are unsupported: regenerate them from the source installation. ZIP size is capped at 128 MiB; unusually large inventories fail with a localized message. Keep the original archive until the restored data and photos have been checked. See [the archive format](docs/architecture/archive-format.md). CSV is for spreadsheets and does not include photographs or full collection relationships; it cannot restore an inventory. Styled XLSX is planned. Downloads stay on this device and are never sent to an external service.

## Privacy and limitations

The default server is unauthenticated and intended only for the same computer via loopback. Do not change the bind address or expose this instance to a LAN or public network. Browser camera access requires HTTPS or a browser-recognized secure local context and explicit user permission; ordinary file selection remains available. A phone cannot access a PC's loopback address, and this project does not enable LAN access as a workaround. Item data and normalized photos are stored under the configured application data directory, outside the repository and Next.js public directory. Uploads accept JPEG, PNG, or WebP up to 10 MiB, 12,000 pixels per side, and 40 megapixels. The app strips metadata and stores a normalized editable source for newly added/replaced item photos, plus a display derivative and thumbnail; raw uploaded files are not retained. Existing cropped photos have no recoverable pixels beyond their saved crop and remain unchanged by migration. Collection cover uploads use private normalized WebP files and identifier-checked, no-store media routes. Export is local-only and does not change the inventory; it is not automatic backup or crash recovery. Import requires an empty inventory; SQLite and files cannot form one atomic transaction, so retain the original archive for recovery from a sudden power loss. This local version has no multi-user access control, crash/reload draft recovery, sync, public inventory endpoint, or AI integration. Sale intent remains private planning metadata and does not create a listing.

## Development

```powershell
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

See [docs/architecture.md](docs/architecture.md), [docs/product/category-research.md](docs/product/category-research.md), and the architecture decisions. Contributions are welcome under [CONTRIBUTING.md](CONTRIBUTING.md). This application is licensed under GNU GPLv3 only; see [LICENSE](LICENSE).
