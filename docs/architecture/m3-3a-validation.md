# M3.3A implementation and validation

## Scope and starting point

Work began at `763f69e62d9f4cec713af0f07faf59285f2a2a50`. Checkpoints A, B and C were validated and committed sequentially as `ecdead7`, `df6f72e` and `af84709`; checkpoint D completes deletion, localization and regression. The pre-existing editor configuration was left untouched. This milestone does not implement M3.3B, accounts, public hosting, AI or marketplace features.

The assignment describes user screenshots, but original screenshot files were not attached to this milestone. Their described defects were treated as acceptance requirements. Browser screenshots use independently created synthetic data only; no private records or media are committed.

## UX defects and changes

The collection-create form inherited a two-column layout with an oversized emoji palette, making mandatory name entry hard to reach. It now uses a clear single-column form, normal-sized responsive emoji buttons, initial name focus and horizontal Create/Cancel actions. Selecting the final emoji is covered at desktop and 360px.

Conditional Clear Filters insertion changed search geometry. The shared filter now reserves its action slot and restores search focus. Shared control tokens normalize height, radius, text, padding, icons, focus and disabled states across native inputs/selects and buttons. Category selection has a normal-height trigger, removable chips, ordinary checkboxes, bounded scrolling, custom values, outside dismissal and Escape/focus restoration. Its opened content participates in form layout so required fields stay accessible.

Item editing removes repeated brand/model/category/total summaries above the editable controls. The title and small immutable number lead to a compact photo, fields, stock, additional details, memberships and explicit deletion. Equivalent removable rows use trailing cherry trash controls. Private metadata uses parentheses and a quiet lock, meaning unpublished local planning rather than account secrecy.

Crop dialog sizing follows content within viewport bounds; expanded keyboard tools can increase its height, while the image area can shrink and short screens can scroll. Crop handles and zoom use coherent accent styling while retaining pointer hit targets. Close controls use centered SVG icons. Collection covers open a complete contain-fitted image, restore focus on close and expose contextual Change Cover. Missing covers offer explicit Add Cover. Existing saved images remain unchanged on replacement failure.

## Data and route boundaries

One SQLite database retains the `workspaces` model. All item, stock, location, category, collection, media, export/import and cleanup operations take an explicit validated `InventoryContext`. Canonical paths start `/inventories/<inventory UUID>`. Mutation forms carry that route context; another tab changing the preference cookie cannot retarget a stale editor. Legacy item/media routes deliberately target the original inventory. Invalid or foreign resource identifiers are rejected by scoped queries, not hidden UI alone.

Migration `0008_inventory_boundaries.sql` adds ownership and immutable identity/number guards, cross-inventory stock/cover constraints and a one-time original-workspace seed. Migration `0009_inventory_import_operations.sql` adds transaction commit markers for import recovery. Neither migration renumbers or rewrites original records. Display numbers are immutable and unique within each inventory. Deletion leaves permanent gaps; a separate inventory may independently contain `INV-000001`.

## Portability and failure recovery

Revision 4 exports arbitrary inventory UUIDs. Revision 2/3 adapters preserve their original single-inventory contract; revision 1 and unknown revisions are rejected. Export snapshots only the explicit inventory, validates generated media identities and referenced files, and runs the read-only verifier. CSV remains a separate lossy spreadsheet export.

Import previews and revalidates the archive, accepts an editable new-inventory name, allocates fresh UUIDs for every entity namespace and rewrites all references. Display numbers, next sequence, timestamps, categories, private metadata, stock, crop information and normalized media bytes survive. Repeating an import creates independent spaces. Existing inventories are never merged or replaced.

Bounded validation precedes private staging. Generated destinations, link rejection, exclusive file creation, checksums, a process-aware operation lock, durable journal and SQLite transaction coordinate activation. The inventory and commit marker persist together. Before-commit failure removes only operation-owned unreferenced promotions; after-commit recovery preserves the complete inventory. Failed/interrupted source archives, mappings and journals remain private for recovery. Corrupt journals stop recovery rather than guessing. SQLite and filesystem durability are not one atomic transaction; retain original archives.

Deletion checks the exact target and real counts, requires its name when populated, creates a verified SQLite/media backup and compares scoped rows and media hashes again inside a write transaction. Child/parent deletion and foreign-key validation commit together. A durable private journal lists generated media paths before deletion. Cleanup refuses live references across all inventories and resumes at startup after interruption. Transaction failure preserves rows/files; backup failure prevents deletion. The final deletion leads to Create Inventory and does not rerun the one-time seed. Backups are retained without automatic expiry.

## Localization and draft behavior

Server feedback and local photo errors store semantic dictionary keys, with parameters separate. Rendering uses the current locale in all five complete dictionaries. User text remains unchanged. Manual form dispatch preserves uncontrolled options and actual File inputs on recoverable errors. Add Item retains text/File state only for the current application session; full reload/crash recovery remains M3.3B.

## Verification record

Checkpoint A passed typecheck, lint, build, 38 unit tests and 15 Edge scenarios. B passed the required checks, 42 unit tests and focused inventory/control browser scenarios. C passed the required checks, 48 unit tests and an isolated two-server export/import scenario, including duplicate import and unchanged source/target data.

Final validation on Windows with Node.js 24.20.0:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm test` | 50 tests passed across 10 files; disk-heavy fixtures run sequentially |
| `npm run build` | Passed; existing documented Next.js ESLint-plugin notice remains |
| `npm run test:e2e` | Complete Microsoft Edge suite: 17 scenarios passed |
| `npx playwright test --config playwright.import.config.ts` | Separate two-installation archive round trip: 1 scenario passed |
| `npx playwright test --config playwright.restart.config.ts` | Production process restart, scoped media/deletion and final empty landing: 1 scenario passed |
| SQLite checks | Isolated fixtures and configured database: integrity OK, no foreign-key errors |

The production scenario also renames an inventory in another tab while deletion confirmation is open. The outdated confirmation is rejected; refreshed target information and the typed draft remain available before explicit retry. Media checks include image, thumbnail, editable source and uploaded cover responses in both inventories, with private headers and foreign-context 404s.

An intermediate development-server run was invalidated by Fast Refresh during source edits; the complete stable rerun passed. A production test initially used a build predating its last handler change, and a new test had an overly strict label locator; both were corrected before the successful complete production scenario. These intermediate runs are not counted as passed acceptance runs.

Tests use isolated temporary databases and generated synthetic photos. Build and test commands never migrate the configured user database. After isolated validation, the configured application was confirmed stopped and `npm run db:migrate` was explicitly run. It created another verified private pre-migration snapshot and applied migrations 0008/0009. A read-only comparison with the original pre-work snapshot confirmed every original row unchanged, including workspace/item UUIDs, numbers, sequence, categories, stock, memberships and timestamps. Every original private media SHA-256 matched; SQLite integrity was OK and foreign-key errors were zero. No synthetic records were introduced. Exact local backup paths are reported privately to the owner, not embedded in this public document.

The full browser set covers crop zoom/drag/resize/rotation/aspects, readiness and encoding failure, replacement preservation, filters/history, collection identity/membership/covers/deletion, five-language navigation, media placeholders, unified stock/category editing, scoped switching/stale tabs, desktop/360px control geometry and contextual full-cover viewing. Separate scenarios cover complete archive round trips and real production process restarts, scoped media HTTP responses/deletion and the final empty landing. Direct SQL attacks and import/deletion fault injection verify domain boundaries and recovery independently of the UI.

## Operational limits and next work

The installation remains single-owner and unauthenticated on loopback. Inventory IDs/cookies are preferences and identifiers, never future account authorization. Physical touch-device behavior is not claimed as tested. The existing Next.js ESLint-plugin notice is documented in dependency maintenance; standalone ESLint is required. No public download endpoints, remote backup services or private screenshots are added.

M3.3B - Recovery & Preferences is the next milestone and is not started. Scheduled/encrypted backups, explicit replacement recovery, crash/reload drafts, galleries, annotations, Ollama/OpenAI, MCP, Telegram, sharing, marketplace, gamification and accounts remain future proposals.

Reproduce the additional browser checks with Microsoft Edge installed:

```powershell
npm run test:e2e
npx playwright test --config playwright.import.config.ts
npm run build
npx playwright test --config playwright.restart.config.ts
```

The restart scenario starts and stops only its own loopback process on port 3104 with a new temporary data directory. The import scenario uses separate temporary installations on ports 3102/3103. Next.js may regenerate its route-type references for these test dist directories; inspect and restore only those generated `next-env.d.ts`/`tsconfig.json` changes afterward.

Start locally in PowerShell:

```powershell
Set-Location C:\projects\ALLitems
npm ci
npm run dev
# Or, after stopping the development server:
npm run build
npm start
```

Open `http://127.0.0.1:3000`. Startup applies pending migrations with a verified private backup; builds do not migrate configured data.
