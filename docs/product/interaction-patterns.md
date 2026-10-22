# Interaction patterns

This document distinguishes shipped behavior from M2B behavior and future proposals. Update it when a workflow changes.

## Item and photo acquisition

| State | User-visible behavior | Current M2B transition |
|---|---|---|
| Empty / current photo | Show a compact photo or placeholder and one clear acquisition control. | User opens photo choices. |
| Choosing source | Offer camera when the browser exposes it and a normal file picker in all cases. | User explicitly chooses a source. |
| Camera starting | Show a short indeterminate status; never imply permission was granted. | Permission/device failure yields a Russian explanation plus file-picker fallback. |
| Live preview | Show live video with capture, switch camera where supported, and cancel. | Only request video; never request microphone. |
| Selected | Show the still or file preview, change/retake and cancel controls. | New item waits for the Add Item action; existing item starts replacement. |
| Saving / processing | Disable duplicate submissions and show indeterminate progress. | Keep the old saved photo available until the replacement commits. |
| Saved | Show the new photo and brief confirmation. | Refresh item/list data and use a media URL that cannot reuse the prior media ID. |
| Failed | Keep the old saved image, keep the selected preview when possible, show an actionable error and retry. | Camera can be closed; file picker remains available. |

Object URLs are revoked when replaced, cancelled, or unmounted. Camera tracks stop after capture/cancel/close and on unmount. Browser camera access requires a secure context (HTTPS or a browser-recognized local origin such as loopback) and permission. A remote phone cannot use a PC's loopback origin; do not enable LAN access to work around that. Device/browser testing must be reported precisely.

## Stock editing

Each row has a labeled location field, numeric quantity field, and remove-row button. One unlabeled location with a quantity is valid. Add row adds one blank row; remove row affects only the draft until save. Show a calculated total before save. Save gives pending, success, or validation feedback. Duplicate nonempty locations and invalid counts are rejected without replacing saved stock.

## Collections

- Creation is optional and never blocks item creation.
- Collection names and counts are visible in the collection list. Opening one shows its members and collection-scoped search/filter state.
- Adding/removing an item changes only membership. An item may appear in several collections and always remains in All Items.
- Rename changes the collection label only. Confirmed collection deletion removes membership rows and the collection; it never deletes items or photos.
- Empty state explains how to create a collection or add an item. Duplicate names produce a field-level message and preserve input.

## Item details

Lead with item name, inventory number, photo, total quantity, and location summary. Keep UUID, timestamps, sale intent, and long metadata below the primary summary or in advanced sections. Editing forms preserve their drafts on validation errors. Delete actions state what is deleted and require confirmation.

## Future only

Local drafts, recently used items, favorites, saved searches, tags, batch upload queue, listing conversion, local achievements, and sharing are proposals, not current interactions. No M2B action depends on them.
