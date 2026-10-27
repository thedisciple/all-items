# ADR: multiple inventories and non-destructive archive import

Status: accepted; inventory context, integrity constraints, scoped services/routes and create/rename/switching implemented in M3.3A checkpoint B. Checkpoint C implements import-as-new with complete ID mapping, private staging, a transaction commit marker, serialized operations and startup recovery. Checkpoint D completes scoped deletion, verified backups, cleanup recovery and semantic localization.

## Decision and concepts

Keep multiple inventories in the existing private SQLite database, represented by workspaces. An inventory has a stable UUID, a user-entered display name, a creation timestamp and its own next inventory number. The existing fixed workspace and all its item IDs/numbers remain unchanged. A future account identifies a person and authorizes access; it is not an inventory. Owner/account relationships remain absent in the local milestone and can later use a membership table with server-checked roles.

| Concept | Meaning and boundary |
| --- | --- |
| Account | Future authenticated identity; may own or access several inventories |
| Inventory/workspace | Independent item, collection, location, numbering and archive context |
| Category | Stable global system key or custom label assigned through item_categories; no duplicate system taxonomy per inventory |
| Collection | Inventory-owned personal grouping; membership never copies an item |
| Location | Inventory-owned physical storage name; stock must join an item in the same inventory |
| Item | Stable UUID within one inventory; human inventory number unique only inside that inventory |
| Media asset | Owned through its item, private generated paths; cover assets owned through collections |
| Portable archive | One inventory snapshot with explicit identity/reference mapping; never an account database or authentication token |

## Database alternatives

| Choice | Benefits | Costs |
| --- | --- | --- |
| One SQLite database with scoped workspaces (chosen) | Reuses schema and migrations; one transaction can create an imported inventory; per-workspace sequence already exists; future account membership can join workspaces | Every query and cleanup needs scope; database backups contain all inventories; a DB failure affects the installation |
| Separate SQLite file per inventory | File-level backup and recovery are more independent; opening one DB naturally limits many reads | Requires a catalog, per-file connection/migration lifecycle, failure coordination across files, media routing across DBs and later account authorization across the catalog; importing/deleting an inventory spans several storage objects |

Use portable ZIPs for per-inventory backups and a consistent database/media snapshot for installation recovery. A second database system is unnecessary. Media stays outside the repository. New media can use media/workspaces/<workspace UUID>/... after a versioned migration; existing generated paths must remain readable. Deletion and cleanup follow metadata references, never a user-supplied filesystem path.

## Active inventory and navigation

Use canonical `/inventories/<UUID>/...` routes for inventory, collections, details and Data. Resolve and validate an InventoryContext once on the server, then pass it explicitly to domain operations. A simple inventory switcher shows names and a Create Inventory action; switching returns to that inventory's list, not to a collection or search from another inventory. Search/filter URLs stay within their inventory route; Back/Forward restores that context. Preserve an optional last-selected inventory in a first-party local cookie as a preference only. Validate that it exists; otherwise use the existing default, then the oldest available inventory. An unknown route gets a safe not-found response. Do not silently retarget an edit because a cookie changed in another tab. Existing routes can redirect to the default inventory during transition.

If no inventories remain after an explicit deletion, show the Create Inventory landing state; do not silently recreate deleted data or interpret the situation as permission to import into another inventory.

## Historical boundary audit before M3.3A switching

| Boundary | Before M3.3A | Required M3.3A work |
| --- | --- | --- |
| Workspace initialization | initializeWorkspace() uses one constant UUID | Separate installation initialization from context resolution; never create a workspace as a side effect of reading an arbitrary ID |
| Items/counts/search/categories | service.ts scopes parent reads and writes to the constant; child rows are reached through item IDs | Require context in every operation, including count/category suggestions and search subqueries; preserve EXISTS filtering without duplicate items |
| Stock/locations | Combined editor checks item ownership before child changes; locations resolve inside current workspace | Validate item/location workspace equality in the transaction and with additive constraints/triggers; allocation uses that context's sequence |
| Collections/membership/covers | Parent services check the constant workspace and existing membership triggers prevent cross-workspace links | Pass context through every operation and cover option query; test cross-inventory item and cover substitution |
| Item media | readPrimaryPhoto/getPrimaryPhoto join owning item to current workspace; replacement validates owner | Resolve the route context before any read, normalization or cleanup; keep UUID checks, private/no-store headers and legacy source fallback |
| Cover media | readCollectionCover joins owning collection to current workspace | Require matching inventory in the route and owning metadata; keep uploads private |
| Delete/cleanup | UI deleteItemWithMedia checks the parent first; low-level deleteItem deletes child stock before its scoped parent deletion | Fix every low-level delete to verify parent scope before touching children, even where the current caller already checks it; cleanup jobs must carry immutable context |
| ZIP/CSV export | Constant workspace; ZIP stock/media/membership snapshot queries currently read all rows before filtering payload | Scope every snapshot query through parent joins; never load another inventory's child rows; CSV uses the same context |
| Import | Literal default UUID, installation-wide empty guard and interruption cleanup | Introduce a new-inventory target with an explicit ID-remapping plan; keep the current populated-target guard until that new workflow is complete |
| Future jobs/API/MCP | No background jobs or external API integration implemented | Jobs carry inventory UUID plus authorization context and recheck access before acting; never depend on a browser's current selection |

Add database constraints for cross-inventory stock and cover relationships. Unit tests must deliberately submit an item, location, collection or media UUID from another inventory to every read/write boundary. Local switching is organization, not an access-control boundary. Before multi-user hosting, every server operation must verify authenticated membership/ownership. A UUID from a cookie or URL is never authorization. Authentication, HTTPS and origin protections remain prerequisites for network access.

## Import as a new inventory

1. Data accepts an archive, validates structure, bounds, checksums, typed relationships and decoded media, then previews its counts.
2. The user chooses Create New Inventory and may edit its name. Existing inventories remain visible and unchanged.
3. Allocate a fresh target workspace UUID. Remap item, location, stock, collection, membership, media and cover UUIDs to avoid primary-key collisions when the same archive is imported twice. Preserve inventory numbers and next-number sequence inside the new workspace. Rewrite every foreign key and cover reference from one validated mapping; record source IDs only as explicit provenance if later needed.
4. Stage media under a private import journal keyed by target inventory and operation UUID. Generate live destinations from remapped IDs, recheck staged hashes, then insert the new workspace and all records in a write transaction. Foreign-key and workspace checks must pass before commit.
5. Commit makes the inventory visible; only then update the preference and navigate to it. Failure rolls back the new workspace and removes only that operation's promoted files. Interruption recovery must inspect the journal's target and committed status, never an installation-wide empty flag.

Define a new archive revision for arbitrary inventory identity. Retain a tested 2/3 adapter for existing personal recovery archives during the transition; do not silently reinterpret those revisions. Never delete historical ZIPs. Test duplicate archive import, concurrent imports, identical human inventory numbers in different inventories, failure after partial promotion, and unchanged hashes/rows in pre-existing inventories.

## Rename, delete, replace and rollout

Rename changes only a display name. Export is scoped to the chosen inventory. Delete requires an explicit confirmation naming the inventory and its item count; it affects only owned metadata/media and chooses a safe remaining inventory afterward. Do not add a global Clear All control. Replacement remains a separate future workflow requiring a verified pre-replacement database/media backup, an explicit target, staged activation and a tested recovery path.

M3.3A checkpoints: context and additive integrity migrations; scoped services/routes with isolation tests; switcher/create/rename; import-as-new with remapping and interruption tests; scoped deletion and full preservation/browser checks. Keep authentication and cloud work out of this local milestone. M3.3B retains the previously planned crash/reload draft recovery and local preferences work. Neither stage is implemented by M3.2-R1.

## M3.3A deletion and localization completion

Deletion validates the explicit context, checks real counts and requires the exact name for a populated inventory. A verified SQLite/media backup precedes mutation. A write transaction compares scoped rows and media hashes with the backup snapshot, aborts on changes, deletes only target-owned rows and checks foreign keys. A private durable deletion journal records generated media paths before commit. Post-commit cleanup checks live references across inventories; interrupted cleanup resumes at startup. Backups remain private and are not automatically expired. A transaction failure leaves the target intact. The final inventory may be deleted; the one-time migration seed never silently recreates it.

Application feedback carries dictionary keys and separate parameters. Existing errors re-render with the current locale without translating user-entered names. Selection preference survives process restart and is never authorization. Legacy detail/media routes deliberately resolve the original inventory rather than a mutable cookie. See [validation](m3-3a-validation.md).

M3.3B adds one versioned portable preference (default item sorting) and custom-category emoji scoped to the owning inventory. An imported archive receives fresh inventory and item identities while carrying these presentation values. Browser-local Add Item drafts are keyed by the inventory UUID and workflow and never become archive content. Cross-inventory projects remain a separate proposal in [the projects ADR](adr-cross-inventory-projects.md).
