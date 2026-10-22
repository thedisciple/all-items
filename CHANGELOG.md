# Changelog

## Unreleased — M2C

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
