# ADR: future cross-inventory projects

Status: proposed for a later milestone. No project model, cross-inventory collection membership, sharing, or authorization is implemented by M3.3B.

## Problem and decision

A person may assemble a film-production project from equipment owned in Home and Work inventories. Ordinary collections remain inventory-owned, and their membership continues to enforce the same-inventory boundary. A future project is a separate, installation-level selection of references to items in explicitly chosen inventories. It does not copy an item, its photograph, quantities, location or private fields. Each entry displays its current source inventory, and its item link opens that inventory's canonical route.

Categories describe what an item is, collections group items inside one inventory, and saved searches compute a dynamic result. A project records an intentional, stable cross-inventory selection with optional project-specific ordering or notes. Saved searches and categories remain useful inputs to build a selection, but neither reliably represents a curated project. A project may later have its own collections of references, subject to a separate model and authorization review.

## Illustrative schema and lifecycle

One possible future model is `projects(id, owner_id, name, created_at, updated_at)` and `project_item_references(id, project_id, inventory_id, item_id, created_at, state)`, with a unique `(project_id, inventory_id, item_id)` while a reference is live. A composite inventory/item relationship needs an explicit uniqueness constraint on the parent pair. Preserve stable reference identifiers for a missing item without cascading away the project entry: a tombstone or separate live-reference record can distinguish deletion from a temporarily unavailable inventory. Do not retain old item names, notes, media or other private snapshots without a deliberate retention decision. A missing entry shows a neutral unavailable state and can be removed by the project owner.

Inventory rename should update the displayed origin naturally. Deleting an inventory or item must not delete the project or other entries. Adding an item does not transfer ownership, duplicate stock, change collection membership, or reserve quantity. The UI should explain origin and let a person open each item in its inventory; filtered or inaccessible entries must not reveal a private inventory name or item details.

## Authentication, portability and implementation gates

The local installation currently has no account authorization. Future account/team designs must authorize every project and every referenced inventory/item server-side at read and mutation time, including after permissions change; a UUID or a remembered selection cookie grants no permission. Decide separately whether project membership can outlive access, how to signal revoked access without leaking information, and whether project notes have stricter visibility than an item.

An inventory ZIP today contains only one inventory and must not silently disclose project references to other inventories. A future portable project or full-installation archive needs an explicit scope, identity remapping for both inventory and item references, unresolved-reference handling, versioning, bounded validation and tests. Cross-inventory linking, shared projects and public links require their own migration, threat model and recovery design; this ADR grants no permission to implement them now.
