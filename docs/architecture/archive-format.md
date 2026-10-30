# Portable inventory archive format

All Items exports a local ZIP with format identifier `all-items-portable-inventory` and experimental revision `6`. Revision 6 adds ordered photo arrays, explicit primary-media identity and locale-neutral empty automatic names. Revision 5 adds a versioned allowlist of inventory preferences and workspace-local custom-category emoji. Revision 4 adds an arbitrary inventory UUID, with every owned row required to match it; category arrays and readable asset mapping continue from revision 3. Revision 5 remains importable with its inventory presentation; revisions 2–5 adapt legacy media array order to contiguous gallery positions. Revision 4 remains importable with default presentation; revision 3 remains importable with its original fixed-inventory identity contract. Revision 2 remains importable through a tested transition adapter: its single `category` is mapped to a stable system key or preserved as a custom value. Revision 1 and unknown revisions are unsupported. Existing archive files are never deleted automatically. Before external beta, a stable format contract and compatibility policy will be defined; after public distribution, older format support must be a deliberate product decision.

## Layout

```text
README.txt
manifest.json
inventory.json
checksums.sha256
Items/INV-000001 - FT232RL module/main.webp
Items/INV-000001 - FT232RL module/thumbnail.webp
Items/INV-000001 - FT232RL module/editable.webp
Collections/DIY - 9876abcd/cover.webp
Collections/DIY - 9876abcd/thumbnail.webp
```

Readable names are presentation only. `inventory.json` retains item, collection and media UUIDs, inventory numbers, stock, locations, memberships, crop data, cover selection, private sale metadata and timestamps. Each revision 6 item has `primaryMediaId: <media UUID> | null`. Its `mediaAssets` array is in display order, with mandatory integer `displayOrder` values 0 through N−1 and exactly one `isPrimary: true` when non-empty. The primary UUID must match that flag; an empty gallery has a null primary. The verifier rejects duplicate/gapped/reversed ordering and mismatched primary identity. Each media record explicitly references its archive-relative files. Legacy item photos without editable sources have `sourcePath: null`. Each item also includes `asking_price_exponent` (integer 0–3), fixing the meaning of `asking_price_minor` independently of runtime formatter data. Revision 2–5 adapters use exponent 2, matching their historical storage behavior. No price or currency is converted during restoration. No identity is parsed from a folder name. The archive does not contain the SQLite database, absolute data paths or raw uploaded originals.

Category arrays contain stable system keys or exact custom labels; order has no meaning and duplicates are invalid. The retained single `category` field is an inert snapshot of the old column for preservation, never the source of current assignments. Revisions 5/6 include `preferences: { version: 1, sort: "date" | "name" | "quantity" }` and `customCategories`, an array of exact custom labels and emoji presentation metadata. Importing revisions 2–4 uses default sort and no category emoji. Browser language, selected inventory, local drafts, permissions, credentials, cookies and filesystem paths are excluded.

Filenames use NFC Unicode, preserving readable Cyrillic, Latin, Chinese and emoji. Unsafe Windows characters and control characters are replaced, trailing spaces and periods removed, device names replaced, and names shortened by UTF-8 byte length without splitting code points. Item folders include the inventory number. A single photo uses main/thumbnail/editable filenames; an archive with several assets uses `photo-01.webp`, `photo-01-thumbnail.webp`, `photo-01-editable.webp`, then photo-02, and so on in exported media order. Filenames follow the ordered gallery array, independently of which image is primary. Collection folders include a stable collection-ID prefix. JSON explicitly maps every asset ID to its files. The exporter rejects any residual case-insensitive or Unicode-normalized collision and any path above 240 UTF-8 bytes. Private live media filenames are unchanged. Revision 2 imports retain their original longer paths during validation and use identifier-derived live destinations.

`manifest.json` declares the format identifier, revision, UTC export time, application version and every payload entry except the manifest and checksum file. Each entry has a relative path, uncompressed size and SHA-256 digest. `checksums.sha256` repeats each entry as `<digest><two spaces><path>` with LF endings. `README.txt` is included in the manifest and checksum list.

## Verification and limits

The read-only verifier checks the ZIP central directory before expansion, file types, encryption, paths, normalized collisions, entry count, compressed and expanded sizes, expansion ratios, required entries, manifest and checksum agreement, JSON shape and every media reference. It rejects unsupported revisions with a regeneration message. It does not establish provenance or authenticity: a party able to rewrite an archive can also rewrite its checksums.

The primary import UI always creates a new inventory. Preview validates structure, revision, bounds, checksums, typed fields, relationships, and decoded metadata-free WebP images without changing live data. The user edits the proposed inventory name and explicitly confirms. Confirmation revalidates the selected archive, allocates fresh UUID mappings for the inventory, items, locations, stock, collections, memberships, media and cover assets, and rewrites every reference. Human inventory numbers, the next sequence, supported metadata, timestamps, crop data and media bytes are preserved. Source identity never comes from readable filenames. The tested internal empty-target restoration path remains available for existing recovery fixtures; the UI does not offer merge or replacement.

Import stages files under a generated private `.import-<operation UUID>` directory, retaining `source.zip`, the mapping and an interruption journal before promotion. It checks generated live destinations, rejects filesystem links, validates staged hashes, uses exclusive file creation, and persists the new inventory plus its `inventory_import_operations` marker in one SQLite write transaction. Foreign keys must pass before commit. Only then may navigation and the local preference select the new inventory. A process-aware filesystem lock serializes inventory operations and can recover a lock left by an exited process.

Failure rolls back the new inventory and removes only that operation's promoted, unreferenced files. Failed-operation source archives and journals remain under the private `recovery/` directory. Startup and the next serialized import inspect unfinished journals: an uncommitted operation loses its unreferenced promoted files; a committed operation preserves its complete inventory and media. Recovered source archives/journals are retained for diagnosis and recovery. Legacy array journals are cleaned only after checking live references. Corrupt journals stop recovery rather than guessing which files to delete. SQLite and files cannot form a single atomic transaction; power loss or storage damage can still require the user's original archive. Keep the original archive until the restored inventory has been inspected.

Limits are 128 MiB compressed and expanded, 32 MiB per entry, 20,000 entries, 240 UTF-8 bytes per path and a 100:1 expansion ratio. Generated ZIP entries are stored without compression. Exports snapshot database rows in a short read transaction, then read identifier-derived private files, rejecting missing files and symbolic links. SQLite and filesystem snapshots are not jointly atomic; concurrent media deletion aborts export. The download is private, non-cacheable and local only.

## CSV

CSV remains a separate UTF-8 spreadsheet view with BOM, quoted fields, comma delimiters, CRLF row endings and formula-injection protection. Its Categories cell contains a JSON string array, with normal CSV quoting, so semicolons, commas and quotes in custom labels remain unambiguous. It excludes photographs and complete restoration relationships. CSV cannot contain visual cell styling; a styled XLSX export is a future opportunity.

## Inventory deletion boundary

Deleting an inventory is separate from import and export. It keeps a verified private full-installation database/media snapshot, confirms the explicit target, deletes only scoped rows transactionally and journals generated media cleanup. The portable archive is never a replacement shortcut. Existing ZIP files are not removed. Backup restoration and explicit replace-inventory orchestration remain future recovery work.
