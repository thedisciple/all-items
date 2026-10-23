# Portable inventory archive format

All Items M3.1 exports a local ZIP file using format identifier `all-items-portable-inventory`, currently version `1`. The archive is an interchange representation, not a SQLite database copy. Paths are UTF-8, relative ZIP paths; no configured directory, database filename, or absolute machine path is included.

## Entries

- `manifest.json` declares the format identifier, version, UTC export timestamp, application version, and a manifest entry for each payload file except `manifest.json` and `checksums.sha256`. Each manifest entry contains its relative `path`, uncompressed byte `size`, and lowercase SHA-256 digest.
- `inventory.json` contains workspace metadata, locations, items, stock rows, collection records, memberships, category values, private sale intent, prices, timestamps, and media metadata. It records `preferences` only when the application has supported preferences; version 1 has none and omits that field.
- `media/items/<item UUID>/<media UUID>.webp`, the corresponding `-thumb.webp`, and optional `-source.webp` preserve each supported item media asset. Each item's `mediaAssets` is an array with stable media ID, `isPrimary`, nullable `displayOrder`, crop metadata, dimensions, filename, and relative image, thumbnail, and optional source paths. A legacy asset with no editable source keeps `sourcePath: null`.
- `media/collections/<collection UUID>/<cover UUID>.webp` and its `-thumb.webp` preserve uploaded collection covers. The collection record separately retains the selected cover type, emoji/item/media identifiers, membership list, and nullable `uploadCover` metadata (`id`, dimensions, creation time, path, thumbnail path).
- `checksums.sha256` uses one UTF-8 line per manifest entry: `<lowercase SHA-256><two spaces><relative path>`, terminated by LF. It intentionally does not checksum itself.

No user's display name, absolute filesystem location, private data-directory path, or raw SQLite file is required to interpret the archive. Unknown/custom category values remain verbatim. Collection membership and cover selection are distinct from item records. Multi-photo fields are arrays now even though the current UI exposes one primary image.

## Integrity and verification

The read-only `verifyInventoryArchive` service first bounds the ZIP directory and expansion sizes, rejects encrypted or unsupported entries and unsafe paths, then checks the required structure, version, manifest sizes, SHA-256 values, checksum-list completeness, and media references. It does not connect to or change the live database. A verifier success means the package is structurally and cryptographically consistent; it does not prove that an archive came from a trusted sender or that a future importer can restore it.

Version 1 limits the compressed archive and total expanded payload to 128 MiB, individual entries to 32 MiB, entry count to 20,000, path length to 240 characters, and ZIP expansion ratio to 100:1. The export uses stored ZIP entries (no compression), so expansion-ratio risk is effectively absent in generated files. If a referenced private file is missing, exceeds limits, or includes a symbolic link, export fails rather than emitting a valid-looking incomplete archive.

## Snapshot and filesystem consistency

Export reads workspace, inventory, stock, locations, collections, memberships, and media metadata in one short SQLite read transaction, then commits before reading files. Media paths are recomputed from stored UUID identifiers and compared with their expected generated layout; symlinks are rejected. If an asset is concurrently removed after the database snapshot, reading it fails and the archive is not returned. Asset identifiers are unique and replacement writes new media IDs, so a successfully read old asset cannot silently become a newer image at the same path. SQLite and the filesystem are separate resources and do not form one atomic transaction; the implementation fails closed on missing or invalid referenced media rather than claiming cross-resource atomicity.

The export route returns a private, non-cacheable attachment. Preparation and browser Blob creation are bounded by the archive-size limit; an unusual inventory larger than the limit must be reduced before export. Temporary media and archive data is not written under the repository or public directory. No automatic external upload occurs.

## CSV

CSV is a separate spreadsheet-oriented view containing inventory number, name, model, brand, category, quantity, locations, identification status, private sale intent, asking price/currency, description, and notes. It is UTF-8 with BOM, RFC-style quoted cells, doubled embedded quotes, and CRLF row endings. Text starting with spreadsheet formula operators (including after leading whitespace/control characters) is prefixed with an apostrophe. CSV does not contain photographs, collection membership, complete metadata, or restoration information.

## Future changes

Any incompatible structure change requires a new archive version and a verifier test fixture for each supported version decision. This document describes export and verification only. M3.2 import, migration, conflict resolution, restore, and database replacement are not implemented by M3.1.
