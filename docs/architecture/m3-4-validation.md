# M3.4 implementation and validation

Starting HEAD: `807783eb00256b9c8e2da21846dd5ac529ad7a4d`. Existing local changes to `package-lock.json` and `.vscode/` are outside this milestone's commits.

## Checkpoint A

The cropper used one error variable for initialization, crop validation and output failure, then derived readiness as `isReady && !error`. A small crop therefore disabled its correction controls. Readiness now excludes only fatal initialization failure. Crop events revalidate a rejected selection; keyboard resizing stays available. Output failures retain a retryable Done action.

Selected photos can reopen the preserved source with the accepted crop. Cancel preserves the accepted derivative; confirmation replaces it after encoding succeeds. The existing scoped IndexedDB draft carries source, derivative, pending source and crop state. Ordinary acquisition no longer displays generated filenames or sizes.

New automatically unnamed photo items store an empty name. Render-time dictionaries supply the fallback in lists, detail, photo alt text and collection selection. Historical literal names are never rewritten. Photo-less creation and clearing a previously named item's name still require a meaningful name; an already unnamed item can edit other fields without a forced rename, even after its last photo is removed. Search continues to match actual stored metadata and inventory numbers; name sorting places empty values together with a stable UUID tie-break. Readable archive filenames already have a neutral `Item` fallback; import accepts empty stored names. Add Item has a distinct Save item action in all five dictionaries.

Initial validation: typecheck, lint and the existing 56 unit tests passed. Two synthetic Microsoft Edge scenarios passed: invalid crop correction, keyboard resizing, repeated source edit/cancel, IndexedDB reload recovery, saved dimensions, and five-language crop errors/unnamed display with literal-name preservation. Final checkpoint A checks: typecheck, lint, 57 unit tests and production build passed. All 11 affected Edge scenarios passed (including existing marker/pixel geometry and browser-restart draft tests, plus injected canvas-failure retry). The existing Next.js ESLint-plugin detection warning remains.

## Remaining checkpoints

- B: ordered multi-photo services, gallery and cover references, additive migration and verified owner-data preservation.
- C: a new ordered-gallery ZIP revision, retained revision 2–5 adapters and full-fidelity restore.
- D: responsive filtering/chips, sidebar preference, restrained interaction feedback, dialog scrolling, shared currency logic and bounded centered covers.
- E: full regression, documentation reconciliation, staged privacy audit, push and green CI.

No M3.4 migration has been applied to configured owner data at checkpoint A. No physical camera or touch device has been tested.

## Checkpoint B

Migration `0011_ordered_item_photos` adds a non-negative `display_order`, backfills each gallery by creation time/UUID and adds uniqueness on (item, order). It retains existing media UUIDs, paths, hashes and valid primary flags. A missing legacy primary is repaired deterministically. SQLite enforces at most one primary and distinct positions; every gallery service transaction verifies exactly one primary for a non-empty result. Reordering temporarily uses a disjoint order range, then writes contiguous positions. Primary deletion promotes the first surviving ordered photo.

Additional photos never replace siblings. A replacement creates a new media UUID and moves only the target position/primary state and explicit collection-cover references in one transaction; sibling UUIDs and bytes stay stable. Old files survive until commit. Deleting a referenced image deliberately resets that collection cover via the existing trigger; its confirmation explains this. All member photos are now eligible covers. Reads validate inventory/item/media ownership and generated private paths, including source routes. Cleanup refuses a live referenced asset, protecting ambiguous commit acknowledgements.

The detail UI retains one compact viewer and adds an ordered thumbnail strip, primary selection, accessible earlier/later buttons, per-image crop/replacement and confirmed deletion. A separate acquisition control adds one photo at a time with the existing camera/file/crop flow; there is no batch queue or duplicate item Save. Recoverable upload errors retain the selected File and prior persisted gallery. The multipart limit is 22 MiB to accommodate separately bounded 10 MiB derivative/source files plus form overhead.

Typecheck/lint and 61 unit tests passed, including synthetic pre-0011 backup/migration preservation, duplicate-order/primary constraints, foreign-inventory attempts, failed replacement rollback and non-primary cover transitions. The added concurrent-addition test also passes: 62 unit tests pass with the default `npm test` command and a clean exit. One Windows threaded-worker run emitted all successful assertions but exited with a native access violation; it is not counted as a successful process run. Typecheck, lint and production build pass. Four affected Edge scenarios pass across focused runs, including three-photo order/primary/crop/deletion and existing cover and five-language recovery workflows. Configured owner data remains unmigrated at this checkpoint until the complete milestone passes verification.
