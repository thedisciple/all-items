# M4A implementation and validation

Status: M4A implementation and local acceptance are complete. The final pushed SHA and CI link are recorded in the delivery message. Validation date: 2026-11-01. This is local quality groundwork, not a public release.

## Scope, history and interruption

Starting HEAD: 34f26b0f984039b02aef187d8f02f428577202d1. The earlier generation reached its usage limit with A/B committed and C partly implemented locally. Resumption verified HEAD, CI, every local change and the private preservation baseline before continuing. Existing unrelated package-lock.json deletions and .vscode/ remain untouched and unstaged. The interruption itself is neither a passing nor a failed acceptance run.

| Checkpoint | Commit / delivery |
|---|---|
| A: header, toolbar, dialogs, currency labels and planning audit | 98d2759 |
| B: gallery browsing/sorting, addition cap and safe detail exit | c06db02a3ce92c0fd35427a933fbd0952f1f8b10 |
| C: complete multi-photo creation, draft graph and write receipts | 2ab5f3dff8185ccc9386025c20d585d5533889f1 |
| D/E: final quality corrections, acceptance and documentation | Final quality/documentation commit containing this report |

Starting CI was successful. A/B CI run 41125000267 and C [CI run 41235327213](https://github.com/thedisciple/all-items/actions/runs/41235327213) are successful. The final published-SHA CI is checked after push and linked in the delivery message.

## Supplied brief versus audit additions

The original supplied M4A prompt remains intact; its separately marked audit addendum was appended to the local document. [Planning audit](../product/m4a-planning-audit.md) records the full-horizon review, including historical ADR supersession and future dependency order.

Original brief work: stable header-owned sidebar toggle; one wrapping Add/Search/filter toolbar; shared safe dialog insets; ISO-only visible currency options; separate browsing/primary/order; hold/drag and keyboard sorting; confirmed single-photo deletion; safe Done/Back; ten-photo intake; multi-file and sequential-camera creation before one Save; per-photo sources/crops; complete local draft restoration; unchanged ZIP6 with legacy recovery; reusable synthetic UX gate; and current implementation/future-roadmap documentation.

Substantive audit additions: durable inventory-scoped creation receipts for lost commit acknowledgements, extended to saved-gallery add/replace; independent request/file/pixel/draft/staging budgets; explicit legacy revision/CAS preservation; transactional concurrent addition caps; and roadmap reconciliation across recovery, AI, authenticated sharing and optional long-term proposals. These additions do not authorize later milestones.

## Delivered behavior and root causes

A moved the toggle out of a sidebar heading whose geometry changed with collapse. One 44px header target precedes inventory selection; mobile retains labelled navigation. Add Item and filters previously occupied separate sibling regions; one intrinsic wrapping toolbar now keeps them together. The dialog remains mounted in a portal, preserving entered text/Files while closed. Shared footer tokens use 20px desktop/16px narrow insets plus safe-area padding. A compact narrow language trigger preserves room for the inventory name. Currency storage and historical exponents did not change.

B replaced reorder-looking carousel arrows with real viewing controls. Thumbnail selection uses aria-current; the separate visible star uses aria-pressed for primary. The sortable library owns the drag handle's aria-pressed, which cannot also represent viewing selection. One shared lazy rail serves saved and unsaved photos: mouse hold 200ms, touch hold 350ms, tolerance 6px, horizontal edge auto-scroll, Space/Enter pickup/commit, arrows to move and Escape/Tab to cancel. Short gestures browse/scroll without writing. Reduced motion, localized instructions and position announcements remain available. A rejected reorder recreates only the drag manager with confirmed order and restores focus after unlocking; file editors stay mounted. See [gallery architecture](m4a-gallery.md) for dependencies and measured lazy chunk cost.

Done resolves an owned collection/inventory destination on the server. A persistent root exit coordinator protects dirty editors and pending operations; a page-scoped coordinator could disappear before Back handling. Same-document traversal and full-document native beforeunload are tested separately, including Navigation-API-unavailable fallback. A saved photo does not enable an unchanged Details Save.

C privately prepares normalized assets without creating a hidden item. Generated destinations, checksums and a promotion journal precede one transaction containing item fields, stock, categories, ordered media, primary and receipt. A failed second photo/transaction leaves no complete-looking partial item or consumed number. A lost acknowledgement recovers the same result. Changed completed payloads retain their draft and require Open saved item or explicit Use draft for a new item. Deleted-result tombstones prevent resurrection. Startup/next-operation cleanup handles interrupted/expired stages; unknown journals fail closed. SQLite and files are not one atomic storage device. See [creation architecture](m4a-creation-plan.md).

Draft shape 2 preserves ordered selected/source/pending Blobs, accepted/pending crop geometry, primary/view selection and operation identity. Shape 1 upgrades in memory without rewriting the read revision. IndexedDB writes compare revisions in one transaction, retain unknown/corrupt records, handle denied/quota storage and clear only the saving tab's own revision. Closing a dialog retains the entire graph; a crash before an IndexedDB commit can still lose the last write. Drafts and write receipts never enter portable archives.

Quality checks exposed and corrected three additional mechanisms: automatic photo submission could precede React's hidden crop-field update; a debounced geometry callback could revive pending input after accepting a crop; and the shared viewer retained a 300px media wrapper inside a 260px draft preview. Crop fields now update synchronously, geometry emission stops at session completion, and inner viewer tracks fit the actual frame. Marked-pixel tests retain all four source/aspect fixtures. A deliberate partial-disk-write test also found an untracked new thumbnail on failed replacement. Files are now recorded immediately after exclusive open, synced/closed before database completion and cleaned only when owned; old source/row bytes survive and retry acknowledges one new result.


The next production run exposed intermittent React hydration #418 together with an automatic favicon.ico 404. Its response trace placed localized title/description/icon in the streamed body rather than the initial head; direct normal-browser-UA requests reproduced missing initial-head title/icon in all five locales. M4A therefore uses Next 15's documented blocking-metadata option (htmlLimitedBots matching all agents) for this inexpensive local metadata. This is a targeted delivery-stability choice, not suppression of hydration warnings. A new five-locale head assertion plus 30 real full navigations checks the resulting markup and browser errors. Read-only archive fixture GETs allow one transport retry for an observed stale-connection ECONNRESET; mutation/failure assertions are unchanged.

The metadata/head and layout stress cases pass twice (60 full navigations without hydration/icon errors). Both crop-recovery cases also pass twice after awaiting the specific committed cancellation revision and identifying repeated fixtures by their own item identity. The complete final 64-scenario run includes and passes these checks.

## Independent limits and compatibility

- Ten counts newly admitted photos per item, not source/display/thumbnail files. UI/preflight and the saved-add transaction enforce it. At/above ten, further additions are refused until below ten. Legacy/imported 11/12-photo fixtures remain readable, reorderable, replaceable, exportable and importable without truncation or a database ten-row constraint.
- Upload source/display files: 10 MiB each; 12,000 pixels per side and 40 MP. One pair fits the unchanged 22 MiB action-body limit. Browser preflight assists resource checks; it is not a full decoder validator.
- Creation/browser input graph: 64 MiB; browser drafts: 128 MiB total and 30-day lifetime. Blob aliases count once. Small thumbnails decode sequentially; native decoder memory remains implementation-dependent.
- Normalized staging: 64 MiB per operation, 256 MiB total, 64 pending operations, 24-hour expiry and 32 MiB per normalized asset. Actual orphaned cache files count toward budgets. Expired preparations can be rebuilt from retained browser inputs.
- Server normalization: one active job, at most four accepted active/queued jobs per process, with recoverable busy feedback.
- ZIP stays at experimental revision 6. No revision 7 was introduced. Revision 2–5 recovery adapters remain tested; revision 1 and unknown revisions are unsupported. Sources, display/thumbnail bytes, order, primary and references retain their portable semantics. Count caps do not redefine the archive contract.

## Owner-data preservation

A verified private SQLite/media snapshot and row/column/hash baseline existed before writing migration 0013. On resumption, all 13 original tables and 41 media files matched it, with migrations still at 0012, integrity ok and no foreign-key errors. Before explicit owner migration, no owner server was listening; a fresh verified 42-file snapshot was created, and the normal migration command independently created its own verified pre-migration snapshot.

0013 adds installation-local item_write_receipts and its ownership/immutability guards. It changes no old item/media/stock/category/collection/price columns. After migration, every original row/column and all 41 media hashes match the baseline, allowing only the intended new migration-log row. The receipt table is empty, migration count 13, integrity ok and foreign-key errors zero. Repeating migration is a no-op and preservation passes again. Backup paths, database/manifest hashes and private comparison evidence remain outside Git and are included in the user delivery report.

## Verification record

Local runtime: Node.js 24.20.0, Microsoft Edge 157.0.4341.30 on Windows. CI uses Node.js 22 on Linux. Builds, domain tests and browser fixtures use isolated synthetic databases/media; only the explicitly recorded migration command touched configured app data.

| Check | Final-source result |
|---|---|
| npm run typecheck | Pass |
| npm run lint | Pass |
| npm test | 97 tests, 20 files, pass |
| npm run build | Pass |
| Production Edge acceptance, 64 scenarios | 64/64 pass in one complete production run (8.9m) |
| Production ZIP import-as-new / two independent copies | Pass: ordered gallery, primary, per-variant hashes and populated-target preservation |
| Production restart / ownership / deletion / final empty landing | Pass, including scoped media/cover ownership and final deletion after restart |
| Final owner preservation comparison | Pass again after all tests: 13 original tables, 41 media files, integrity ok, no foreign-key errors |
| Final pushed-SHA CI | Post-push result linked in the delivery message |

Development-mode focused runs also verify three distinct crops, ten-photo intake, mouse/touch/keyboard order, real profile restart, legacy CAS, denied/quota storage, simulated camera capture/failure and pre/postcommit transport faults. The first comprehensive production run was 61/63. Both older synchronization assumptions were corrected without dropping result assertions: wait for the actual second created item rather than an already-matching added= URL, and wait for crop closure/accepted File rather than an unfinished encode/restore. The targeted two-test rerun passes. The subsequent production run also exposed the metadata issue described above and an old reload test accepting an earlier committed revision. These were corrected; the complete final 64-scenario production run passes 64/64 (8.9m). The separate production archive and restart checks both pass.

Earlier failed runs are not counted as passes. Host I/O contention required serialized SQLite fixtures with bounded setup/cleanup budgets. Test locators were corrected for the source dialog changing its title when video starts and for the Next.js route announcer matching an unscoped alert query. The first production-gate configuration merged two servers and stopped before tests; it now explicitly overrides one isolated server. The existing Next.js ESLint-plugin detection warning remains; explicit lint and build pass.

Reuse [layout-gate.ts](../../e2e/helpers/layout-gate.ts) for rendered bounds/insets and browser-reliability.ts for unexpected browser errors. The gate covers seven widths (1440/1100/900/760/560/390/360), five locales, keyboard/focus/ARIA, reduced motion, 1/2/3/10/12-photo rails, cancellation/rollback, file retention, mock camera tracks, real profile restart and legacy draft CAS. Screenshots/traces use synthetic media, stay outside version control and are not font-specific pixel snapshots.

## Limits and next milestone

Camera streams and touch events are simulated; physical camera/touch, physical 125/150% browser zoom, other browser engines, real screen-reader tasks, storage-device failure and comparative usability are not claimed. Effective CSS zoom viewports are tested separately. Existing legacy photos without a clean source cannot recover already-lost original pixels. Filesystem/SQLite power-loss atomicity is not promised.

M4B remains next: verified automatic local backups, retention, actual isolated restore drills and usability/device checks, followed by separately scoped reviewable AI identification. Hosting/sharing requires its own authentication/authorization/origin/security gates. Themes, organization, projects, marketplace and integrations remain proposals. Stop after M4A.
