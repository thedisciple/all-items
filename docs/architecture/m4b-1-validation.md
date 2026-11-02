# M4B.1 validation

Scope: isolated synthetic inventory data, no migration of the owner's configured database. No schema or archive contract changes. The existing uncommitted package lock and editor settings were kept outside this change.

The root cause of portrait thumbnail clipping was CSS specificity: the generic private-image frame rule overrode the gallery's containment rule. Bounded zero-minimum tracks and a specific centered contain rule fix both draft and saved presentation without changing media bytes. A synthetic Edge test inspects actual visible red/green/blue edge and center markers at 1:10, 1:20, 10:1, 20:1, 4:3, 3:4 and 1:1 before and after persistence.

The gallery scenario checks auto-selection of newly added photos independently from the primary, reorder, crop, removal and primary promotion. Existing failure-injection scenarios cover lost/rejected uploads, preserved file state, retry, pending writes and guarded exits. The collection scenario exercises the shared cover manager from editing and the lightbox, draft preservation, focus restoration, thumbnail choice, inventory-number search, selection retention and cover variants; server tests reject removed membership. Filter clear and focus are checked at desktop and 360px; the shared toolbar gate covers seven widths and five locales. Synthetic emulation does not prove physical camera, touch or browser zoom behavior.

The implementation was interrupted and resumed across usage-limit turns. Final checks and delivery status are reported with the milestone delivery; M4B.2 backup and restore work remains separate.
