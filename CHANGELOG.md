# Changelog

## Unreleased — M4D

- Published the sanitized mobile milestone through a draft PR and established explicit checkpoint push/CI reporting rules; merge and deployment remain separate approvals.
- Added immutable committed local preview builds, isolated marked data, explicit first-account setup and a minimal exact-origin health/version response.
- Added guarded synthetic-beta status, preparation, approved switch/rollback and stop-sharing commands. Verified backups and restored migration copies preserve matching prior code/data; unknown legacy build identities refuse automatic adoption.
- Consolidated current roadmap status and labelled historical P1/P2 evidence. Personal configuration, release state, credentials and journals remain outside Git. No live service, Funnel configuration or invitations were changed.

## Unreleased — M4C

- Kept the full brand and two direct mobile tabs, equalized header controls, and moved inventory Data access into inventory settings while preserving secured URLs.
- Bounded the crop viewport and touch handles, made controls fit narrow/short screens, added themed aspect/currency popovers with native fallback, simplified phone acquisition and attached the language menu to its trigger.
- Reused branding on login/404, corrected owned legacy entity redirects, aligned Data actions and added a compact localized public-project footer.
- Added authorized SQL pagination with stable ordering, filtered counts, 25/50/100 sizes, history and validated edit-return context. Collection member/candidate/cover lists use bounded queries instead of eager full-inventory payloads. No schema migration or new dependency.
- Added focused UX issue/PR templates. Prepared bounded autoresearch/WebMCP tasks without runtime AI features or live deployment changes. Physical Android/iPhone acceptance remains required.

## Unreleased — P2 release preparation

- Kept the existing Windows backend after the Sites compatibility gate; prepared a loopback Caddy adapter and a first-beta Funnel runbook with explicit publication, stop and recovery gates. No external service was enabled.
- Moved authenticated language selection to Account Settings, removed the redundant empty-account header label, and made Restore default view select categories, quantity and date added while retaining stored preferences.
- Replaced per-navigation backup payload hashing/SQLite inspection with bounded completion metadata. Explicit verification, creation, restore and retention remain fully checked and admin controls remain private.
- Clarified sale readiness and source-based identification labels in all five dictionaries without changing stored enums.

## Unreleased — Pilot P2 candidate

- Aligned the empty-account shell and removed the Add Item footer gutter; verified five languages and Edge layouts.
- Added explicit HTTPS proxy trust, fail-closed startup preflight, security headers, a validated Caddy example and private Windows production configuration. No public deployment was made.
- Added migration 0015 for optional Telegram OIDC identities, one-use invitation and flow state. Authorization Code/PKCE, signed ID-token verification, same-session link confirmation, password-confirmed unlink and local fallback are config-gated. Live Telegram login is untested.
- Added synthetic HTTPS, identity, migration-preservation and signed-provider checks, with deployment, threat and operator runbooks. Physical-device and independent security gates remain open.

## Unreleased — Pilot P1

- Separated Add Item into a stable header, one scrolling body and a safe-area footer.
- Added local CLI account provisioning, scrypt credentials, revocable database sessions, login/logout and five-language account UI.
- Added migration 0014 and server-verified inventory ownership across private resources; installation backup administration is restricted.
- Added synthetic adversarial/browser/production-restart checks and an SBB/P2 decision runbook. Public/LAN deployment remains gated.

## Unreleased — M4B.3

- Added secure browser UUID and SHA-256 fallbacks for contexts lacking newer Web Crypto APIs; the app remains loopback-only by default.
- Display local item timestamps and configurable browser-local inventory list details.
- Documented a security-gated private pilot, compatibility policy and synthetic device diagnostics.

## M4B.2 - Verified local backup and recovery

- Added format-1 installation snapshots with identifier-checked immutable media, bounded streaming copies, SHA-256 manifests and verified completion markers. Short-lived SQLite workers avoid retained native Windows file handles.
- Added create/list/verify CLI commands, explicit optional daily/weekly retention protecting pinned and migration backups, and manually configured Windows scheduling instructions.
- Added real isolated restore drills with database/media checks and domain-service reads, plus private Data-page backup controls in all five languages. Documented offline recovery and remaining release gates.
- Kept photo deletion visible and confirmation available while changing the primary; silent field-operation pending no longer introduces photo-upload status or vertical layout jumps.

## M4B.1 - Media, item and collection UX

- Fixed centered contained gallery thumbnails for extreme aspect ratios and made newly added photos the viewing selection without changing the primary. Photo edit and confirmed deletion share a compact action row.
- Made item-field actions contextual and return navigation explicit; documented a future unified edit session without changing the immediate persistence of photos.
- Added a grouped, searchable and paginated thumbnail chooser for collection covers, with a preview and access from the collection editor. Preserved membership checks and distinct cover and primary identities.
- Removed inactive filter dead space, preserved search focus on clear, and documented the design decisions and remaining M4B.2 recovery scope. Tests use isolated synthetic data; physical device acceptance remains separate.

## M4A - Photo-first creation parity and UX quality gate

- Completed multi-file and sequential-camera Add Item with individual source-preserving crops, compact navigation, one primary star, local hold/drag and keyboard order, confirmed removal and one final Save. Ten is a new-addition cap; legacy galleries remain uncapped for reading/editing/recovery.
- Added bounded sequential private preparation and atomic item/stock/category/media completion. Migration 0013 adds local create/add/replace receipts; lost acknowledgements retry the same result, while changed completed commands require deliberate recovery. ZIP stays at revision 6.
- Upgraded browser drafts to ordered photo graphs with source/selected/pending Blobs and crop geometry, preserving legacy revision identity, cross-tab CAS, quotas and explicit restore/discard.
- Fixed the header toggle, shared toolbar, dialog insets and concise currency labels; separated browsing from sorting and protected Done/Back, dirty editors and pending writes.
- Hardened crop-session completion, partial-file cleanup and initial-head localized metadata delivery without suppressing hydration errors.
- Added synthetic Edge layout/keyboard/mouse/touch/camera/failure/restart checks and independent resource tests. Reconciled the complete roadmap and historical architecture; M4B, AI and hosting remain future work. See [validation](docs/architecture/m4a-validation.md), including the usage-limit interruption and resumed verification.

## M3.4 - Private photo galleries and continuous UX reliability

- Added ordered per-item photo galleries, independent crop/replacement, explicit primary selection, deterministic promotion after deletion and safe collection-cover reference transitions. Migration 0011 preserves existing media IDs, paths and bytes.
- Fixed recoverable crop validation/output failures and accepted-photo re-editing from the original source, including browser draft recovery. New unnamed photo items use a localized render/search fallback without persisting a translation; old literal names stay unchanged.
- Added experimental ZIP revision 6 with ordered media, primary identity and stored price exponent; retained tested revision 2–5 import adapters, full source/display/thumbnail fidelity and non-destructive import-as-new.
- Reworked intrinsic filters, one-line categories, neutral photo fallbacks, keyboard-accessible sidebar preference, restrained feedback, dialog scrolling and centered bounded collection covers.
- Centralized 13 currency choices and exact decimal parsing. Migration 0012 pins historical prices to hundredths; new amounts carry explicit ISO minor-unit precision, including HUF 2, JPY 0 and KWD 3. No exchange-rate conversion or last-used/AI currency ranking is implemented.
- Extended synthetic unit/Edge coverage, production import/restart checks and preservation verification. See [validation](docs/architecture/m3-4-validation.md). Physical camera/touch testing remains separate.
- Shared/family/team access, category management, favorites, release-note UI, themes, AI and external integrations remain documented proposals.

## M3.3B - Local draft recovery and UX reliability

- Moved inventory switching and scoped counts into the shared navigation; separated item navigation from category filtering and kept long filter values legible.
- Corrected portrait crop preview clipping, retained the prior selection during replacement, and consolidated category tokens and collection editing.
- Made collection icons independent of default, emoji, member-photo and uploaded covers; kept Change cover available inside the full-image viewer. New inventory names are checked transactionally; existing duplicates remain intact.
- Added browser-local, inventory-scoped Add Item draft recovery with selected/source/pending photo Blobs, explicit restore/discard, bounded storage, revision checks across tabs and visible storage failures.
- Added inventory-local default sorting and custom-category emoji. Experimental ZIP revision 5 carries these presentation values; revisions 2–4 remain supported and restore defaults.
- Added migration `0010_inventory_presentation.sql`; photo-first item creation now commits the item, category presentation, stock and media reference together after private media staging.
- Cross-inventory projects remain an architecture proposal only. AI, accounts, hosting, public access and marketplace features remain future work.

## M3.3A - Multiple inventories and non-destructive import

- Unified controls, stable filters, compact dismissible categories, visible collection-name entry and aligned emoji/actions; focused item editor and quieter private labels.
- Content-sized crop dialog and coherent handles/zoom; complete collection-cover viewer with contextual editing and explicit Add Cover.
- Explicit validated inventory context across routes, services, stock, collections, media, cleanup and exports; independent immutable number sequences and additive SQLite ownership guards.
- Create, rename, switch and confirmed scoped deletion with a verified private SQLite/media backup, transactional checks and cleanup recovery. Final deletion remains empty after restart.
- Revision 4 ZIP export and new-inventory import with complete UUID/reference remapping; tested revision 2/3 recovery adapters, bounded validation, exclusive promotion, retained journals/source archives and transaction commit markers.
- Semantic five-language feedback translated at render time; recoverable form failures retain fields and files. Accounts, public access, AI and M3.3B remain out of scope.
- Migrations: `0008_inventory_boundaries.sql`, `0009_inventory_import_operations.sql`. See [validation report](docs/architecture/m3-3a-validation.md) for checks and limitations.


## M3.3A — checkpoints A, B and C

- Added non-destructive archive import with fresh identity mapping, private staged media, transaction markers, interruption recovery and retained source archives.
- Added explicit inventory contexts and routes, create/rename/switching, independent numbering, scoped exports and database ownership constraints.
- ZIP revision 4 supports arbitrary inventory UUIDs; revisions 2/3 retain their original import contracts.
- Unified control geometry, stable filter slots, compact dismissible category selection, and consistent dialog action rows.
- Fixed collection creation grid inheritance and emoji palette containment; centered close icons.
- Removed repeated item-edit summaries, refined crop dialog sizing/handles, and added full collection cover viewing with contextual editing.


## Unreleased - M3.2-R1 editing, categories and media reliability

- Added reusable private-image loading/error placeholders, stable geometry, appropriate decorative/informative alt semantics and one reconnect retry. Fast pre-hydration failures are handled; the original reported RSC incident remains unconfirmed.
- Unified inventory type, metadata, categories and stock in one transactional Save with immediate type-specific controls and full draft retention after errors. Single-item conversions reject incompatible stock; blank zero rows are omitted and unchanged stock identities survive.
- Added migration 0007 and canonical item_categories assignments, preserving legacy rows and custom values. Migration/startup creates a verified SQLite/media backup before pending migrations on an existing installation.
- Exported revision 3 category arrays with short readable photo names and retained a tested revision 2 recovery adapter. CSV categories use an unambiguous JSON array cell; the short CSV note sits under its own action.
- Stabilized collection covers and filter scroll behavior, retained URL/history navigation, and upgraded ESLint to 10.13.0. Optional Next lint plugin and database-client changes were evaluated separately; maintenance notes explain retained notices.
- Documented M3.3A multiple inventories and import-as-new, preserving draft recovery/preferences as M3.3B. Neither next stage is implemented.

## Unreleased — M3.2 readable archive and safe import

- Kept photo editor controls reachable on short screens, aligned crop and zoom focus treatment, removed duplicate focus rings, and simplified cover selection and collection emoji editing.
- Fixed stock quantity draft handling across unique, bulk, and consumable modes while keeping invalid edits recoverable.
- Replaced the experimental ZIP layout with revision 2 readable item and collection paths, stable identifiers in JSON, a human README, strict path rules, and SHA-256 verification. Revision 1 remains unsupported for import.
- Added localized archive preview and confirmed empty-workspace restore with bounded validation, private media staging, transactional records, failure cleanup, and interrupted-import recovery on the next attempt.
- Verified a synthetic complete archive round trip, injected staging/promotion/database failures, and an isolated Edge UI export/import flow. CSV remains a separate lossy spreadsheet download.

## Unreleased — M3.1 UX, localization, and portability

- Unified collection cover rendering across overview and detail pages while keeping identity emoji independent; aligned management controls and preserved uploaded covers while editing identity.
- Added restrained category chips, neutral missing-value marks, simplified stock and collection membership editors, and a viewport-aware photo editor with separate clockwise/counterclockwise rotation and reset actions.
- Added complete bundled Russian, English, Ukrainian, Serbian Latin, and Simplified Chinese dictionaries, regional browser fallback, native language names, and locale-aware count/number/date formatting.
- Verified existing inventory data is unchanged when switching languages in isolated Edge Playwright fixtures.
- Added the local Data page, bounded version 1 ZIP export, portable JSON/media payload, manifest and SHA-256 checksums, read-only verifier, and a separate UTF-8 formula-safe CSV export.
- Verified ZIP and CSV downloads in Edge against an isolated database, including a real photo's display image, thumbnail, and editable source; the verifier also checks paths, collection membership, cover references, limits, and checksums.

M3.1 revision 1 ZIP export was an experimental predecessor; M3.2 now exports revision 2.

## Unreleased — M2D-R2

- Corrected Cropper image error handling and added regression coverage for full-image Original mode, presets, rotation, zoom, and saved-photo deletion/re-upload.
- Made search and filters apply automatically, preserved URL navigation state, normalized legacy category filters, and clarified sort direction.
- Replaced persistent save notices with accessible announcements; added one keyboard-operable confirmation dialog for photo, item, and collection deletion.
- Added contextual collection name/icon editing, immediate cover preview, detail-page cover display, and local SVG language flags.
- Added the permanent minimalist design manifesto and documented a staged multi-photo schema and archive plan; multi-photo support remains future work.

## Unreleased — M2D

- Kept item text and photo drafts mounted across dialog close/reopen; added explicit discard confirmation and retry-safe, single-submit add behavior.
- Made add-item success return to inventory with the new item highlighted, and made edits return to the validated inventory or collection route.
- Clarified Model versus physical marking, moved the latter into advanced details, placed RU/EN language controls in the top-right header, and added restrained category emoji.
- Replaced custom crop geometry with a Cropper.js editor supporting resizable freeform rectangles, aspect presets, smooth zoom, pan, rotation, preview, and keyboard-operated adjustment controls.
- Added normalized, metadata-free editable photo sources with crop data while preserving legacy photos and replacement rollback; uploaded collection covers stay private.
- Added focused collection creation, batch add/remove of existing items, explicit photo/icon/default covers, simpler empty states, and Notion-inspired visual organization guidance.

## M2C

- Fixed item-detail Server Component serialization with explicit plain-object DTOs and verified a real item route against an isolated copy of the private database.
- Added freeform photo cropping, zoom/reposition controls, keyboard support, and in-place replacement preview/save feedback without duplicate saved photos.
- Moved photo-first item creation into an accessible dialog and simplified inventory navigation, counts, card metadata, and search behavior.
- Added stable localized category keys with legacy/custom preservation, and complete Russian/English interface dictionaries with persistent language choice.
- Expanded search to inventory numbers, storage locations, descriptions, categories, and collection names; documented category research and future interaction/storage-status ideas.

## M2B

- Added reusable camera/file photo acquisition with previews, retry, pending feedback, and replacement-safe media state.
- Replaced the pipe-delimited stock editor with labeled location and numeric quantity rows and a live total.
- Improved item summary and progressive disclosure for advanced/private details.
- Added workspace-owned collections, many-to-many item membership, navigation, and collection search/filter/sort.
- Added product design references, UX principles, interaction patterns, gamification concept, marketplace concept, and an opportunity register.

## M2A — Private photos and photo-first inventory

- Added a private media table and ordered migration without rewriting existing inventory rows.
- Added photo-only creation, identifier-checked media delivery, thumbnails, replacement, removal, and item-delete cleanup.
- Added server-side JPEG, PNG, and WebP validation and metadata-stripped WebP output.
- Added photo-first inventory creation, thumbnails in inventory rows, and full-size item photos.
- Kept photos, thumbnails, and the database under the configured data directory, outside Git and the public directory.
- Removed the decorative plus beside the add form heading; the add button is the only plus action.
