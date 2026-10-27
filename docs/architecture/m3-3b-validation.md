# M3.3B implementation and validation

Starting revision: `c70fa13`. This milestone builds on the existing installation; it does not add accounts, AI, hosted access, marketplace features or cross-inventory projects. The latter remain an [architecture proposal](adr-cross-inventory-projects.md).

## Data and compatibility

Migration `0010_inventory_presentation.sql` adds two inventory-owned tables and does not rewrite existing item, category, stock, membership, media or collection rows. Migration startup verifies a private SQLite/media backup before applying pending migrations. Revision 5 exports carry a versioned default sort and custom-category emoji; revision 2, 3 and 4 archives remain importable and get the default presentation. No drafts, browser cookies, credentials or absolute paths are exported. Future public distribution requires a deliberate format compatibility policy.

Meaningful Add Item drafts are stored only in the browser's IndexedDB, keyed by inventory and workflow. A revision comparison prevents overwriting or deleting a newer draft from another tab. A reload offers Restore or Discard before editing. The store bounds individual images to 10 MiB, aggregate photo Blobs to 128 MiB, drafts to 20 and their lifetime to 30 days. Denial, quota exhaustion or revision conflict displays an error while leaving in-memory data intact. A browser can interrupt a write before it commits, and browser data eviction or clearing can remove a draft. Selected original files may temporarily retain metadata in a draft; processed server media is metadata-stripped. Drafts are not backups or portable archives.

## Interface and test evidence

The prior portrait preview problem came from the automatic minimum size of a grid track: a portrait expanded past a fixed-height frame and was clipped. The preview now uses zero-minimum grid tracks and a contained image. Synthetic colored edge markers compare the crop output, rendered preview and saved image across portrait, landscape, tall and 20:1 crops. The full collection-cover viewer retains an in-viewport Change cover dialog; collection icon and cover are independent.

Validation used isolated databases and generated photographs: typecheck and lint passed, 56 unit tests passed, the production build passed, 29 real Edge scenarios passed and five affected scenarios passed again after the final category clarification. An additional persistent-profile Edge test closed and reopened the browser before restoring a committed photo draft. Separate production import and application restart scenarios passed. The build retains the existing Next.js warning about its ESLint plugin. A private pre-migration backup and subsequent database/media comparison verified preservation during the local upgrade. Physical touchscreen and camera hardware were not simulated by headless browser tests.
