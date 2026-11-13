# Roadmap

## Canonical delivery status

- **Completed implementation:** M0–M4C, including P1/P2 authentication and deployment foundations; milestone reports distinguish synthetic checks from uncompleted physical/security acceptance.
- **Current:** M4E — final private-beta engineering and release acceptance, following M4D synchronization/immutable releases. Clean synthetic preparation, observed service identity, persistent reauthentication budgets and interruption safeguards are implemented. Independent security review, approved first activation, physical/network/Telegram and reboot acceptance remain pending. See [release workflow](docs/architecture/release-workflow.md) and [security gate](docs/architecture/p2-threat-model.md). No merge, service change or invitations are implied.
- **Next:** M5A — initial AI object identification with human-reviewed suggestions, after the private-beta gate; no AI implementation is started here.
- **Future:** DIY recommendations, cross-inventory projects, shared inventories, marketplace, gamification, WebMCP and optional themes/integrations. Historical progress files are evidence snapshots, not the task queue.

See [the opportunity register](docs/product/opportunity-register.md) for detailed concepts, dependencies, risk, complexity, and priority. Checkmarks describe implemented and verified work only.

## M4C — Mobile UX and private-beta quality gate

- [x] Responsive full brand, direct Inventory/Collections tabs, consistent header controls and contextual inventory Data navigation
- [x] Bounded crop viewport/controls, touch-handle margins, limited themed aspect/currency choices, native phone intake and attached language menu
- [x] Shared login/404 branding, ownership-aware legacy bookmarks, compact Data actions and localized public-project footer
- [x] Database-backed item/member pagination with stable ties, counts, filters, page sizes and bounded on-demand collection pickers
- [x] Focused issue/PR templates for reproducible synthetic UX reports
- [x] Implementation-ready bounded [experiment and WebMCP tasks](docs/architecture/m4c-experiments.md); no runtime experimental tools or GPU/cloud dependency
- [x] Final integration evidence: see [validation and limitations](docs/architecture/m4c-validation.md)
- [ ] Real Android/iPhone [acceptance](docs/product/m4c-device-acceptance.md), independent security review and approved deployment/invitations through the existing P2 gate

Retain local AI identification, DIY recommendations, sharing, marketplace, MCP and configurable themes below. M4C does not start those phases.

## M0 — Foundation and first working vertical slice

- [x] Next.js, TypeScript, Tailwind, SQLite, and Drizzle foundation
- [x] Local workspace and additive initial migration
- [x] Russian responsive inventory page and item creation
- [x] Persistence across application restarts
- [x] Focused validation tests and project documentation

## M1 — Inventory management

- [x] Full item CRUD and sequential inventory numbers
- [x] Stock entries, quantities, and multiple locations
- [x] Tracking modes, search, filters, sorting, and private sale intent

## M2A — Private photos and photo-first inventory

- [x] Validated local JPEG, PNG, and WebP input with server-side WebP normalization
- [x] Private image and thumbnail storage, controlled media routes, replace/remove lifecycle
- [x] Photo-first creation for unidentified objects and responsive photo rows/details

## M2B.1 — UX foundations, photo acquisition, and item workflows

- [x] Research documentation, UX principles, and reusable interaction patterns
- [x] Camera/file acquisition, preview, save feedback, retry, and replacement-safe media flow
- [x] Structured stock editor with computed totals and visible save/error states
- [x] Item summary, progressive detail, keyboard/focus, and 360px responsive improvements

## M2B.2 — Collections and navigation

- [x] Workspace-owned collections and many-to-many memberships
- [x] Collection create, rename, confirmed delete, counts, navigation, and scoped search/filter/sort
- [x] Add/remove membership without duplicating or deleting items and photographs

## M2C — Runtime stabilization, photo editing, and UX consolidation

- [x] Serialize item, stock, and collection data through explicit client-boundary DTOs; verify an existing item-detail route with photo, multiple stock rows, and memberships using an isolated data copy
- [x] Consolidate the detail view to one saved-photo viewer and add freeform crop, zoom, reposition, reset, cancel, and replacement-safe save behavior
- [x] Move item creation into a focused photo-first dialog and simplify inventory cards, counts, search, navigation, and metadata treatment
- [x] Add stable localized category keys while retaining legacy and custom category text
- [x] Add Russian and English dictionaries, explicit cookie preference, browser-language fallback, localized status/actions, and `html lang`
- [x] Expand search to inventory number, description, category, locations, and collection names; add regression coverage
- [x] Document category research and future crop-source, storage-status, and reduced-motion transition considerations

Visual camera/cropper acceptance on a physical device was unavailable in the development environment; server route, crop geometry, and automated regression coverage were verified.

## M2D — Seamless flows, photo editing, and collection UX

- [x] Preserve text, category, advanced values, and selected/cropped File state while the Add Item dialog is temporarily closed; confirm deliberate draft discard and keep retry data on save errors
- [x] Save an item once, return to inventory with confirmation, and return from edits to a validated inventory or collection route
- [x] Clarify Model and physical marking fields; move language selection to the top-right header and add restrained category emoji
- [x] Replace handwritten crop selection with Cropper.js freeform handles, pan, wheel/touch/slider zoom, aspect presets, 90-degree rotation, live output preview, and keyboard adjustment tools behind a disclosure
- [x] Store a metadata-stripped editable source, crop parameters, display image, and thumbnail for newly processed photos; legacy photo rows remain intact and use their display image as fallback
- [x] Create collections through a dialog; search and batch-add existing items; manage membership without copying or deleting inventory items
- [x] Support explicit collection item-photo, private upload, emoji, and default covers; never auto-select a member photo
- [x] Add Notion icon/cover organization research and update UX, interaction, privacy, and future annotation guidance

M2D-R1 hardens Cropper.js readiness, zoom bounds, crop output validation, and original-image recovery. Real-browser verification is reported for the hotfix; physical touch-device acceptance remains separate.

## M2D-R2 — Interaction reliability and minimal design

- [x] Verify Cropper props, full-image Original mode across portrait/landscape/rotation, preset bounds, and browser console cleanliness
- [x] Reconcile saved photo state immediately after deletion and support replacement without a reload
- [x] Apply search, categories, status, and sorting automatically while preserving URL and history state
- [x] Make collection name/icon edits contextual; preview covers before save and show saved covers on detail and overview
- [x] Use one keyboard-accessible confirmation pattern for destructive actions and local SVG language flags
- [x] Record minimal design rules and multi-photo migration/archive shape
- [x] Run isolated unit, lint, typecheck, build, and Edge Playwright verification before delivery

M2D-R2 passed the automated suite in Microsoft Edge on Windows: 25 unit tests and 7 Playwright scenarios, with no browser console warnings/errors or failed page responses in the cropper acceptance scenario. Physical touch-device acceptance remains untested.

## M3 — Portability foundation — COMPLETE

### M3.1 UX refinements — COMPLETE

- [x] Unify collection identity and cover display, align management actions, and refine category chips and missing-value presentation
- [x] Keep photo editor actions visible at representative desktop and 360px viewports; separate clockwise/counterclockwise rotation from reset
- [x] Simplify stock editing and collection membership controls without changing the underlying data model

### M3.1 Five-language support — COMPLETE

- [x] Bundle complete Russian, English, Ukrainian, Serbian Latin, and Simplified Chinese dictionaries
- [x] Preserve explicit language selection, map supported browser variants, and format counts, numbers, and dates with Intl
- [x] Verify dictionary completeness and language switching on inventory, item details, collections, and photo editing in Edge

### M3.1 Portable export — COMPLETE

- [x] Versioned ZIP export with complete JSON and private media, entry checksums, and a read-only verifier
- [x] Separate CSV spreadsheet export with formula-injection protection
- [x] Local download UI, isolated fixtures, archive documentation, and Edge download verification

### M3.2 Safe archive import — COMPLETE

- [x] Refine photo editor, stock, collection identity/cover, focus, and Data page interactions
- [x] Export revision 2 ZIP with readable, collision-safe names and stable JSON identities; retain checksums and bounded verification
- [x] Validate archive structure, revision, paths, resource limits, checksums, relationships, and actual media before preview
- [x] Restore into an empty inventory through private staging, a write transaction, integrity checks, rollback cleanup, and next-attempt interruption cleanup
- [x] Verify a synthetic full-fidelity round trip and isolated Edge export/import flow

Historical M3.2 contract: revision 3 export with revision 2 recovery. Current contract: revision 6 with tested revision 2–5 importers; revision 1/unknown revisions are unsupported. Import creates a separate inventory and never silently merges or replaces populated data. M4B.2 installation backups and restore drills are implemented; styled XLSX remains a separate future spreadsheet export.

### M3.2-R1 Consolidation and pre-workspace architecture — COMPLETE

- [x] Private image loading/error placeholders, alt semantics, bounded reconnect retry and synthetic Edge diagnostics
- [x] One mode-aware item/stock/category editor and transactional Save; retain meaningful drafts on errors
- [x] Additive item_categories migration with verified pre-migration SQLite/media backup and legacy preservation
- [x] Revision 3 category arrays, shorter photo paths and tested revision 2 recovery adapter
- [x] Stable collection cover geometry, predictable filter scrolling and corrected CSV note
- [x] ESLint 10 migration and documented dependency audit; implementation-ready multiple-inventory ADR

Validated with 38 unit tests, typecheck, lint, production build, the 13-scenario Edge suite, separate archive restoration and focused mobile/export checks. Physical touch-device testing remains separate. The original reported RSC/network incident was not conclusively reproduced; controlled media failures are covered.

### M3.3A Multiple Inventories & Non-destructive Import - COMPLETE

- [x] Explicit inventory context and additive cross-inventory integrity checks across every read/write/media boundary
- [x] Inventory switcher, create/rename, independent sequences, scoped search/collections and local selection preference
- [x] Validated import as a new inventory with full ID/reference remapping, private staging and interruption recovery
- [x] Scoped deletion with verified backup, explicit confirmation, cleanup recovery and preservation tests; no global Clear All or replacement shortcut
- [x] Shared control geometry, stable filters, collection creation repair, full-cover viewer and semantic five-language errors

Follow [the architecture decision](docs/architecture/adr-multiple-inventories.md). P1 accounts now provide the separate verified ownership boundary. The primary import workflow creates an independent inventory; existing inventories are never merged or replaced. See [validation](docs/architecture/m3-3a-validation.md).

### M3.3B Recovery and preferences

- [x] Header inventory switching, scoped navigation counts, independent category filters and responsive row layout
- [x] Browser-local Add Item draft recovery for committed text, stock and photo Blob writes, with restore/discard and cross-tab conflict handling
- [x] Portable default sorting and custom-category presentation; revision 5 archives retain revision 2–4 import support
- [x] Verify migration preservation, unit/build checks, Edge flows and production import/restart on isolated fixtures; GitHub CI verifies pushed commits

## M3.4 — Multi-photo inventory and UX reliability

- [x] Ordered private galleries with one primary, independent photo lifecycle, cover transitions and additive media preservation
- [x] Recoverable crop validation/output, repeated unsaved recropping and localized unnamed display/search
- [x] Revision 6 full-fidelity galleries/price precision and tested revision 2–5 adapters; import always creates a new inventory
- [x] Intrinsic filters, consistent unbroken category chips, local sidebar preference, restrained feedback and inner dialog scrolling
- [x] Shared currency choices, exact integer parsing, historical exponent preservation and centered contained covers
- [x] Synthetic unit/browser acceptance and explicit preservation safeguards; final delivery evidence is in [validation](docs/architecture/m3-4-validation.md)

## Future personal organization

- [ ] Optional encrypted archive export as a future security enhancement
- [x] M4B.2: verified local installation backups, opt-in retention and isolated restore drills; additional workflow recovery remains separate
- [ ] Populated-workspace merge/replacement only after a separate conflict and verified recovery design
- [ ] Styled XLSX spreadsheet export separate from the full-fidelity ZIP archive
- [ ] Flexible item attributes (readable portable image paths are implemented)
- [ ] Favorites, pinned collections, recently used items, preferred view, and quick actions
- [ ] Smart filters, tags, saved searches, and inventory completeness indicators
- [ ] Optional organization goals based on actual progress
- [ ] Image optimization refinements and advanced multi-photo/batch workflows

## M4 — Quality and release — IN PROGRESS

M4A is complete as a scoped UX/create-flow milestone; it is not a public release. M4B recovery groundwork is implemented; physical-device and security checks remain. See [planning audit](docs/product/m4a-planning-audit.md).

### M4A — Photo-first creation parity and UX gate — COMPLETE

- [x] Header-owned sidebar toggle, shared responsive toolbar, dialog insets and ISO-only currency labels
- [x] Separate photo browsing, primary selection and accessible hold/drag ordering; safe detail exit
- [x] Multi-photo creation, complete local draft recovery, bounded private staging and retry-safe final commit
- [x] Synthetic Edge/keyboard/touch-mock regression gate and documentation reconciliation

### M4B — Recovery/usability implementation — COMPLETE; device acceptance separate

- [x] M4B.1 UX refinement: contained gallery previews, contextual item actions and visual collection cover choice
- [x] M4B.2 verified installation backups, optional scheduled CLI/retention and isolated restore drills
- [x] M4B.3 secure-context fallback, item timestamps and browser-local per-inventory list options; see [device and pilot runbook](docs/architecture/m4b-3-device-pilot.md) and [v0.1 compatibility](docs/architecture/v0-1-compatibility.md). Physical-device acceptance remains open.

- [x] Local backup service, opt-in Windows scheduling instructions, retention preview and isolated restoration drills
- [ ] Physical camera/touch/zoom and task-based usability acceptance; release compatibility policy

### Release groundwork (gated; no release implied)

- [x] M4C mobile UX refinement and synthetic accessibility/layout checks
- [ ] Physical-device and independent security review
- [ ] Real task-based usability tests and interaction-count/form-completion measures
- [ ] Error-recovery, performance, responsive consistency, and microcopy reviews
- [x] CI for typecheck, lint, isolated unit tests and build
- [x] Reusable synthetic-data geometry and interaction acceptance gate (M4A)
- [ ] v0.1 release preparation after recovery/security/usability gates
- [ ] Optional authenticated LAN access only after server-side authentication and origin protections are complete

## Authenticated private pilot — P1 LOCAL FOUNDATION (historical M3.5 label)

The old number is not execution order. Recovery/usability groundwork and a separately approved security milestone precede any network pilot. Public HTTPS and server-side authorization must both pass the [pilot security gate](docs/architecture/m4b-3-device-pilot.md) before exposure. AI identification is a distinct optional local capability and does not require exposing this app.

- [ ] Plan a 5–10 person invite-only pilot on a production-mode host with authenticated HTTPS access
- [x] P1 local invite-only credentials, revocable server sessions, owned-inventory service/media boundaries and synthetic cross-user verification; see [P1 architecture](docs/architecture/adr-p1-local-identity.md)
- [ ] P2 independent security/deployment review and real-device HTTPS acceptance before any exposure; [strict proxy preparation](docs/architecture/p2-deployment.md) and synthetic tests are implemented
- [x] P1 exact-origin mutations, persistent local login budgets, retained upload limits, private cache/security headers and protected installation backup controls
- [ ] P2 review actual production proxy/TLS, abuse/credential handling, scheduled recovery and privacy-conscious feedback reporting; [operator checklist](docs/architecture/p2-operator-checklist.md) is prepared
- [x] P1 additive owner association with verified backup/isolated restoration and preservation checks; owner activates credentials locally
- [ ] Invite real testers only after P2 acceptance
- [x] P1 keeps the backend loopback-bound; optional P2 Funnel exposure uses the authenticated Caddy adapter, never a public Next listener
- [x] Implement config-gated optional Telegram OIDC with local password fallback, one-use invitations and explicit account linking; synthetic signed-provider tests only, live BotFather callback remains a P2 gate
- [x] Evaluate Sites without deployment: current app needs an invasive runtime/storage port; retain it as a future optional hosted edition
- [x] Prepare a first-beta Funnel route through a loopback Caddy adapter, with [explicit stop/recovery instructions](docs/architecture/p2-first-beta-runbook.md)
- [ ] Approve and verify the actual external Funnel URL, live Telegram callback and physical mobile acceptance before inviting private records

## M5A — AI identification and enrichment — NOT STARTED

First slice: an explicit Identify action on selected existing photos; a server-only provider interface returns validated name/model/category/description suggestions, provenance and an uncertainty/failure state. Prefer optional local Ollama where practical, behind time/concurrency/result-size limits; ordinary inventory functions require neither AI nor a running provider. A separately enabled cloud adapter must disclose the destination and obtain explicit consent before sending any photograph. Never include browser-draft originals, credentials or unrelated inventory metadata.

Show suggestions for field-by-field human approval through the existing validated save operation. Preserve user-entered fields and source photographs; never silently overwrite markings, publish, share or change categories. Provider timeout/unavailability leaves the existing item and edits intact. Test deterministic fake-provider cases (valid, invalid, timeout, refusal), ownership and consent boundaries before any real provider credentials. Datasheet research and project recommendations remain later work, not hidden network activity. No AI runtime, account, model download or cloud key is installed in M4E.

- [ ] Photo and multi-object identification with human-reviewed metadata proposals
- [ ] Preserve original markings; use cited, verified datasheet references
- [ ] Local Ollama, optional cloud providers, BYOK, and eligible ChatGPT integrations
- [ ] Inventory curator, DIY project discovery, compatibility analysis, missing-component identification, and MCP integrations

## Achievements & Guided Discovery — future concept only

- [ ] Optional local achievements, tiered progress, and an original achievement gallery
- [ ] User-defined goals, feature-discovery achievements, and useful data-quality measures
- [ ] Opt-out, privacy-first local calculation, and anti-manipulation rules
- [ ] Community comparisons only after multi-user support, with opt-in, transparent normalized metrics, adequate cohort sizes, and no raw-inventory disclosure

## Future advanced media and recovery

- [x] **M3.4 media foundation:** additive `display_order` migration preserving existing media IDs and primaries; multiple media assets per item; exactly one primary when any exist; transactional next-primary promotion on primary deletion; retain per-image private editable source, crop, derivatives, and collection-cover reference integrity
- [x] **M3.4 media UI:** primary photograph plus secondary thumbnail gallery, add/reorder/choose-primary/edit/delete individual images, and full-screen viewer with file/camera acquisition
- [x] M4A bounded multi-file and sequential-camera acquisition for one item
- [ ] Multiple-object extraction and separately scoped general batch workflows
- [ ] Upload queue with cancel/retry, client-side compression, large-image handling, and resumable uploads where justified
- [x] Sequential small browser draft thumbnails and full-fidelity portable image bundles
- [ ] Broader measured caching/performance refinements for very large galleries
- [ ] Non-destructive photo annotations: pencil/brush, arrows, rectangles, circles, text, blur/redaction, hardware highlights, undo/redo, and normalized coordinate operations
- [ ] Optional AI-guided annotation using a clean source, crop, highlighted region, text prompt, and human-reviewed result

## Future sharing and resource network

- [ ] Accounts, shared workspaces, family/team inventory, and explicit per-item visibility
- [ ] Shared-by-link items, resource requests, privacy-preserving matching, borrowing, lending, renting, and exchange
- [ ] Internal messaging and end-to-end-encrypted private synchronization, subject to security review

## Future marketplace — monobazar-inspired, not implemented

- [ ] Convert an inventory item into a separate listing draft; AI may suggest text but cannot invent facts or publish
- [ ] Strict public/private data boundary and quantity reservation separate from owned/available/reserved/listed/sold/loaned/rented stock
- [ ] Fixed-price listings, structured offers with accept/decline/counter, optional messaging, and transaction status
- [ ] Seller storefronts, shareable links, following, and optional notifications
- [ ] Auctions, competitive bids, settlement, cancellation, fraud and dispute handling
- [ ] Professional maker accounts, business storefronts, team-managed inventory, and seller verification
- [ ] Buyer protection, partner-based payments, delivery, tracking, returns, and optional installment partners
- [ ] Verified charity listings and transparent proceeds
- [ ] Optional managed hosting/marketplace monetization; keep the self-hosted personal core useful and free and preserve GPLv3
- [ ] Legal, regulatory, trust, privacy, identity, moderation, support, and payment-partner review before implementation

AI identification, marketplace, sharing, synchronization, achievements, rankings, analytics, payments, and transactions remain future directions after M4A, each with its own prerequisites.

## Retained follow-up decisions

- [ ] Re-evaluate the initial M4A ten-photo addition policy and long galleries with real task evidence; never truncate legacy/imported media
- [ ] Optional bundled light/dark/accent themes with readable contrast, local preference scope and reduced-motion behavior
- [ ] Human-reviewed AI photo identification after M4B, provider adapters and explicit local/cloud consent; never overwrite original markings automatically
- [ ] Preserve the independent project, marketplace, Telegram/MCP and optional organization proposals; implement only through separately scoped milestones
