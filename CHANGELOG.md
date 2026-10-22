# Changelog

## Unreleased — M2A

- Added a private media table and ordered migration without rewriting existing inventory rows.
- Added photo-only creation, identifier-checked media delivery, thumbnails, replacement, removal, and item-delete cleanup.
- Added server-side JPEG, PNG, and WebP validation and metadata-stripped WebP output.
- Added photo-first inventory creation, thumbnails in inventory rows, and full-size item photos.
- Kept photos, thumbnails, and the database under the configured data directory, outside Git and the public directory.
- Removed the decorative plus beside the add form heading; the add button is the only plus action.
