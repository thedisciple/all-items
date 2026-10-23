# Changelog

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
