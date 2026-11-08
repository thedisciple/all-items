# Installation backup and isolated recovery

M4B.2 format 1 is an installation backup, separate from experimental per-inventory ZIP revision 6. ZIP import revisions 2–5 remain recovery adapters. Installation backups retain all inventories, metadata, stock, categories, prices, preferences, collection associations, saved gallery order/primary/source/derivative bytes, and local operation receipts. Only the database and its identifier-checked committed media are included. Browser IndexedDB drafts, pending preparations/import source archives, environment files, API keys, credentials and unrelated local files are excluded. Unsaved browser drafts require their existing restore/discard workflow.

## Consistency and completion

The existing inventory operation lock serializes backups, retention, import and deletion, but does not cover all item/media writers. It is not the backup consistency guarantee. Audited committed photo/cover creation and replacement use fresh UUID paths with exclusive creation, finish files before committing references and never overwrite committed bytes in place. Backup captures a committed database with VACUUM INTO, derives exact generated media paths from that snapshot, then streams and hashes those immutable files. A concurrent addition is outside that snapshot; a concurrent deletion either leaves copied bytes valid or makes copying fail. Missing/changed/unsafe files abort the backup. There is no silent partial success or historical-media rewriting. An external tool that edits media in place violates this application invariant; stop such tools before backup.

[SQLite documents](https://www.sqlite.org/lang_vacuum.html) the transactional database snapshot and the possibility of corrupt output after an interrupted VACUUM INTO. Therefore a snapshot alone is not completion. Files are synced, manifests contain sizes/SHA-256, SQLite integrity/foreign keys and media identities are checked, and an explicit COMPLETE marker authenticates the manifest hash. A generated partial directory is promoted only after verification. Unknown versions, different migration sets, extra files and symbolic paths are refused. Short-lived SQLite workers guarantee native file handles are closed before rename/deletion on Windows; bounded retries handle transient file locks. A locked destination fails without marking the backup complete.

Format 1 requires this application's migration set and application version. It is not a general forward/backward-compatible database interchange format. The manifest records the app version and exact migrations. Keep the corresponding application source/release with disaster recovery instructions. There is no public-release compatibility promise yet.

Resource limits: 100,000 files, 1 GiB per file, 50 GiB total, 32 MiB manifest/worker output and one million rows per table. Files stream through bounded-memory copies/hashes. Row comparisons are processed in pages of 1,000. Timed worker operations abort after ten minutes. On interruption the generated partial directory is retained for diagnosis and excluded from listing/retention; it must never be treated as restorable. The COMPLETE marker is a crash-detection contract, not a guarantee against failing disks or malicious local software. Verification should be repeated after unexpected shutdown and before recovery.

## Commands

Run from the repository with dependencies installed and an already initialized data directory. ALL_ITEMS_DATA_DIR has the same meaning as normal startup. Do not point it inside the repository.

```powershell
npm run backup -- create
npm run backup -- list
npm run backup -- verify BACKUP_UUID
npm run backup -- drill BACKUP_UUID
```

Manual and UI copies are pinned. `create --scheduled` creates an unpinned retention candidate. Listing reads bounded manifest/completion metadata only: `recorded` means completion was recorded, not that current SQLite/media integrity has been checked; `unavailable` means the metadata cannot be read/validated. A damaged or missing payload may still have readable metadata. Run explicit `verify UUID` before relying on a copy. Creation, verification, restore drills and retention candidate checks retain full cryptographic/database checks. Paths cannot be selected from HTTP inputs. No backup download/static route exists. UI success appears only after complete verification, and creation revalidates the Data page.

The default optional retention keeps the newest snapshot for each of 14 recent days and eight weeks. `npm run backup -- retention` previews removals; `retention --daily=14 --weekly=8 --apply` explicitly applies them; daily and weekly counts can be configured within validated bounds. Only generated, verified, unpinned format-1 installation backups are eligible. Migration backups, portable archives, pinned copies, corrupted copies and partial directories remain untouched. Retention is not run by backup creation or page loading.

## Windows Task Scheduler

Create a task manually if wanted; this milestone does not register or enable OS tasks. Run under the same Windows account that owns the data. Set the working directory to `C:\projects\ALLitems`; program `C:\Windows\System32\cmd.exe`, arguments `/d /c npm run backup -- create --scheduled`. Select a daily trigger and prevent overlapping task instances. If a custom data directory is needed, use a local script setting ALL_ITEMS_DATA_DIR explicitly before that command, with quoted absolute paths. Review task history and nonzero exit status. Configure a separate reviewed retention task only after inspecting a dry run. No internet connection or cloud provider is required. The data directory must be on a local filesystem with reliable SQLite locking and rename behavior; network shares are not qualified.

## Restore drill and offline replacement

`drill UUID` verifies the source, creates a NEW OS temporary `all-items-restore-*` directory, copies the database and referenced media, compares every hash and canonical table contents, checks SQLite integrity/foreign keys/primary and cover relationships, and runs normal inventory/item/gallery/collection service reads in a separate process using that directory. The report records source identity, target path, semantic hash, size and elapsed time. It never switches the live app's data directory. A failed drill retains an explicit failure report and partial target. Repeated drills create different directories and do not mutate the backup. No cleanup occurs automatically: inspect the reported absolute target and delete only that generated temporary directory after confirming that it is no longer needed. Do not enumerate and recursively delete arbitrary matching owner directories.

Disaster replacement is a separately reviewed offline procedure: stop all app/CLI processes, preserve the current installation including sidecars and media, verify the selected backup, perform a successful drill and service reads using the matching app version, inspect inventory counts and media, then configure startup to use the NEW restored directory. Keep the old directory and source backup unchanged until explicit owner acceptance. Never copy a database over a running SQLite installation or mix its WAL with a restored database. This document does not authorize automatic replacement, live overwrite or deletion.

Before v0.1/private beta: secure server-side authentication and inventory authorization, HTTPS/origin protections, physical device usability acceptance, a release compatibility policy, and reviewed backup/disaster recovery documentation remain required. AI, hosting, sharing and marketplace are separate milestones.
