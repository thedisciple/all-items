# Portable inventory archive format

All Items exports a local ZIP with format identifier `all-items-portable-inventory` and experimental revision `2`. Revision 2 is the only supported format for export and import. Earlier pre-release revision 1 archives should be regenerated from the original local inventory. Existing archive files are never deleted automatically. Before external beta, a stable format contract and compatibility policy will be defined; after public distribution, older format support must be a deliberate product decision.

## Layout

```text
README.txt
manifest.json
inventory.json
checksums.sha256
Items/INV-000001 - FT232RL module/FT232RL module - 1234abcd - main.webp
Items/INV-000001 - FT232RL module/FT232RL module - 1234abcd - thumbnail.webp
Items/INV-000001 - FT232RL module/FT232RL module - 1234abcd - editable.webp
Collections/DIY - 9876abcd/DIY - cover.webp
Collections/DIY - 9876abcd/DIY - thumbnail.webp
```

Readable names are presentation only. `inventory.json` retains item, collection and media UUIDs, inventory numbers, stock, locations, memberships, crop data, cover selection, private sale metadata and timestamps. Each media record explicitly references its archive-relative files. Legacy item photos without editable sources have `sourcePath: null`. No identity is parsed from a folder name. The archive does not contain the SQLite database, absolute data paths or raw uploaded originals.

Filenames use NFC Unicode, preserving readable Cyrillic, Latin, Chinese and emoji. Unsafe Windows characters and control characters are replaced, trailing spaces and periods removed, device names replaced, and names shortened by UTF-8 byte length. Item folders include the inventory number. Item photo names include a stable media-ID prefix. Collection folders include a stable collection-ID prefix. The exporter rejects any residual case-insensitive or Unicode-normalized collision and any path above 240 UTF-8 bytes. Private live media filenames are unchanged.

`manifest.json` declares the format identifier, revision, UTC export time, application version and every payload entry except the manifest and checksum file. Each entry has a relative path, uncompressed size and SHA-256 digest. `checksums.sha256` repeats each entry as `<digest><two spaces><path>` with LF endings. `README.txt` is included in the manifest and checksum list.

## Verification and limits

The read-only verifier checks the ZIP central directory before expansion, file types, encryption, paths, normalized collisions, entry count, compressed and expanded sizes, expansion ratios, required entries, manifest and checksum agreement, JSON shape and every media reference. It rejects unsupported revisions with a regeneration message. It does not establish provenance or authenticity: a party able to rewrite an archive can also rewrite its checksums.

Import applies the same verifier, then validates typed inventory fields, IDs, number sequence, stock and collection relationships, primary-photo rules, crop records, and actual WebP dimensions and metadata. Preview performs these checks without changing the installation. Confirmation repeats validation, stages media under a private `.import-<UUID>` directory, verifies staged byte hashes, and opens a SQLite write transaction. It accepts an initialized workspace row but requires all inventory tables to be empty. It promotes files to identifier-derived private paths while the transaction hides new rows, inserts all records, checks foreign keys, and commits. No ZIP path is used as a live filesystem destination.

If staging, promotion or database preparation fails, the transaction rolls back and promoted files are removed. A journal in the staging directory lists generated destinations; the next import attempt removes interrupted, unreferenced files when the inventory remains empty. A completed import with an interrupted staging cleanup stays visible and intact; the next attempt removes the leftover staging directory. SQLite and files are not jointly atomic, and sudden power loss or disk corruption can require manual recovery from the original archive. Import never merges or replaces a populated inventory. Keep the original archive until restoration has been checked.

Limits are 128 MiB compressed and expanded, 32 MiB per entry, 20,000 entries, 240 UTF-8 bytes per path and a 100:1 expansion ratio. Generated ZIP entries are stored without compression. Exports snapshot database rows in a short read transaction, then read identifier-derived private files, rejecting missing files and symbolic links. SQLite and filesystem snapshots are not jointly atomic; concurrent media deletion aborts export. The download is private, non-cacheable and local only.

## CSV

CSV remains a separate UTF-8 spreadsheet view with BOM, quoted fields, CRLF row endings and formula-injection protection. It excludes photographs and complete restoration relationships. CSV cannot contain visual cell styling; a styled XLSX export is a future opportunity.
