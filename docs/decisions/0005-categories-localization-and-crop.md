# Decision 0005: Stable categories, local language preference, and crop derivatives

Status: historical M2C decision, partly superseded. Current UI has five languages; M2D introduced stripped editable sources and M3.4 ordered galleries. The historical derivative-only restriction below is not the current media contract. See [current architecture](../architecture.md).

## Context

All Items needs recognizable categories without turning private organization into a marketplace taxonomy. Russian-only UI copy was also becoming harder to maintain. Users need practical crop control while keeping private media metadata-free and preserving a saved photo when replacement fails.

## Decisions

- Store new system category selections as stable keys. Keep Russian and English labels in local dictionaries. Keep unknown free-text values as custom categories and map only exact known legacy labels for presentation and filtering. Do not rewrite existing category rows or add a migration for labels.
- Use local typed RU/EN dictionaries in the App Router. An explicit first-party language cookie wins; browser preference applies only when there is no valid explicit choice. Keep current route and user-entered content when changing language.
- Crop in the browser Canvas, then pass the result through the existing Sharp normalization and metadata-stripping service. Do not retain raw originals. Editing an existing photo starts from its current normalized derivative; preserving a separate uncropped source is future work.
- Keep the previous media reference/file until a replacement has been persisted. Render one saved/preview photo source on item detail.

## Consequences

- There is no schema migration or change to existing inventory rows for categories/localization.
- Existing mapped labels may display in the selected locale; custom labels remain unchanged.
- A later crop of an already-cropped image cannot restore discarded pixels. A future metadata-free normalized source derivative would be required for that capability.
- Browser/device camera and visual crop acceptance still require supported browser hardware; this implementation's automated tests cover crop geometry and media normalization.
