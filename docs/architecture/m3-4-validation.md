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
