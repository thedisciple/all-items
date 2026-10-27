# Interaction patterns

This document distinguishes shipped behavior from current behavior and future proposals. Update it when a workflow changes.

## Reliability patterns for M2D-R2

- **Filters:** category, status, and sort changes navigate immediately; text search uses a short debounce. Preserve unrelated query parameters, restore state from browser history, and offer a clear action only while a filter is active.
- **Editing:** collection name and icon fields appear only in edit mode. Save/Cancel are contextual; validation errors retain the draft. Cover selection previews locally before submission, then refreshes the current detail and overview data after persistence.
- **Destruction:** a normal destructive button opens a single alert dialog naming the consequence. Cancel or Escape returns focus; the confirm action disables while pending.
- **Feedback:** immediate content updates are the visible confirmation. Use live regions for assistive technology; keep persistent visible feedback for errors, not successful saves.
- **Language:** show locally bundled RU and UK flag SVGs with localized text. The menu supports keyboard focus and does not depend on OS emoji fonts.

## Item and photo acquisition

| State | User-visible behavior | Current transition |
|---|---|---|
| Empty / current photo | Show a compact photo or placeholder and one clear acquisition control. | User opens photo choices. |
| Choosing source | Offer camera when the browser exposes it and a normal file picker in all cases. | User explicitly chooses a source. |
| Camera starting | Show a short indeterminate status; never imply permission was granted. | Permission/device failure yields a localized explanation plus file-picker fallback. |
| Live preview | Show live video with capture, switch camera where supported, and cancel. | Only request video; never request microphone. |
| Selected | Show the still or file preview, change/retake and cancel controls. | New item waits for the Add Item action; existing item starts replacement. |
| Saving / processing | Disable duplicate submissions and show indeterminate progress. | Keep the old saved photo available until the replacement commits. |
| Saved | Show the new photo and brief confirmation. | Update the single detail photo in place; the new media ID prevents stale-cache reuse. |
| Failed | Keep the old saved image, keep the selected preview when possible, show an actionable error and retry. | Camera can be closed; file picker remains available. |

Object URLs are revoked when replaced, cancelled, or unmounted. Camera tracks stop after capture/cancel/close and on unmount. Browser camera access requires a secure context (HTTPS or a browser-recognized local origin such as loopback) and permission. A remote phone cannot use a PC's loopback origin; do not enable LAN access to work around that. Device/browser testing must be reported precisely.

## Stock editing

Inventory type is an essential field shared by Add Item and Edit Item. Single item shows one optional location and fixes quantity at one; Multiple units and Consumable expose integer quantity/location rows. A type change updates the draft immediately. An incompatible single-item conversion displays a validation error and retains stock for correction after switching back. Add Location creates a temporary row; whitespace-only zero rows are omitted on Save, while positive quantities without locations remain valid. One Save persists metadata, type, categories, locations and stock in a transaction. Pending state blocks duplicates; errors preserve the entire draft. The item summary carries the total, so the editor avoids a repeated total.

Category selection opens a compact disclosure, supports several system choices and custom labels, and presents removable selected chips. Categories describe items; collection membership remains a separate personal grouping. The current URL category filter selects one category and matches any item with that assignment; search, status and collection scope combine with it using AND.

## Collections

- Creation is optional and never blocks item creation.
- Collection names and counts are visible in the collection list. Opening one shows its members and collection-scoped search/filter state.
- Adding/removing an item changes only membership. An item may appear in several collections and always remains in All Items.
- Rename changes the collection label only. Confirmed collection deletion removes membership rows and the collection; it never deletes items or photos.
- Create starts from one primary button and a focused name/icon dialog. A validation failure preserves entered values; success opens the new collection.
- An empty collection shows one short empty state and Add Items. Search/filter controls appear only when there are members. Result counts appear only after an active search/filter.
- Add Items searches existing inventory, excludes current members, supports multi-selection, and adds in one transaction. Removing membership leaves the item and photos intact.
- Covers are optional explicit selections: an existing member photo, normalized private upload, emoji, or default placeholder. No first member is automatically chosen. A stale photo reference resolves to the default placeholder.

## Item details

Lead with item name, inventory number, compact contained photo, total quantity, and location summary. Open a larger photo in one lightbox image with a clear close control and Escape support; do not render a duplicate image. Keep UUID and technical metadata out of the ordinary detail flow; retain useful user-facing values and keep deletion actions explicit and confirmed. Editing forms preserve their drafts on validation errors.

## M2D item creation and photo editing

The Add Item dialog stays mounted while closed, so text fields, category/advanced values, a selected File, and cropped preview survive same-session close/reopen. The backdrop does not dismiss it. Close preserves work; Discard Draft confirms only when work exists. A save error keeps its fields and File available for retry. Full reload/crash recovery is not implemented.

One Add submission creates the item and returns to inventory with confirmation and highlight. An edit returns to inventory or the validated collection it came from; cancel uses the same internal route. Model is the identified designation; Marking on device is the literal visible text and remains optional in Advanced Details.

Cropper.js manipulation waits for its `ready` event and validated image metrics. The resizable crop rectangle supports direct mouse/finger drag, edge/corner handles, freeform and Original/1:1/4:3/3:2/16:9 presets, image panning, wheel/touch/slider zoom, clockwise and counterclockwise 90-degree rotation, and reset. Rotation controls are grouped separately from the undo-style reset; short accessible labels explain icon-only controls. Keyboard move/resize controls are available in a disclosure rather than displayed permanently. The modal flexes with viewport height so the image yields space to controls; Done and Cancel remain visible, with scrollable controls on unusually short screens. Invalid dimensions, crop coordinates, zoom values, canvas output, or destroyed instances produce a recoverable error; the selected File and draft remain available, and an explicit action continues with the original image. Sharp normalizes the display derivative and thumbnail. New/replaced photos also keep a separate metadata-stripped editable source and crop operation data under private storage. Legacy photos have no source path and re-edit from their saved derivative, so pixels discarded before M2D remain unavailable. Failed replacement keeps the previous media record and files.

The item summary is the canonical display for total quantity. One item editor contains metadata and location/quantity rows, exposes Add Location as a button, and only enables Save when valid meaningful changes exist. Validation errors keep the draft. Collection membership uses linked chips with contextual remove controls or a focused add selector; an empty state does not repeat explanatory prose.

Future annotation operations should refer to normalized source coordinates and remain editable/reversible: pencil/brush, shapes, arrows, labels, redaction, highlights, and undo/redo. These are not implemented in M2D. A future AI flow may receive the clean source, current crop, highlighted area, and explicit instruction after a separate privacy review.

## Future only

Local drafts, recently used items, favorites, saved searches, tags, batch upload queue, listing conversion, local achievements, and sharing are proposals, not current interactions. Shared-element card-to-detail transitions may be explored after task-based mobile testing; they must respect reduced-motion preferences and preserve a clear fallback. Do not add complex view-transition infrastructure without reliable browser support and accessibility behavior.

Storage status must distinguish local storage, synchronized storage, offline availability, synchronization state, and backup state. Until those capabilities exist, avoid a status light or text that implies sync, offline guarantees, or backup protection.

## Local data export

The Data view offers one primary ZIP download and one separate CSV option. Both start from explicit user activation, display pending state while the response is prepared, and report failure in an accessible status region. No automatic upload or permanent public URL is used. ZIP is the full-fidelity portable representation; CSV is a spreadsheet view without photos and collection membership details. A completed browser download is not described as verified external backup storage.

The short CSV note sits directly under its own action. Collection covers reserve the same height while loading and after filtering; a stable scrollbar gutter avoids width changes. Filter navigation preserves the scroll offset when the new document supports it. When a shorter result set makes that impossible, the offset clamps predictably with the filters in view. Back/Forward continues to use browser history.

## M3.2 archive restoration

The Data view accepts a local revision 2 or 3 ZIP and shows a validated preview of item, collection, and media counts. Preview leaves the current workspace untouched. The user explicitly confirms restoration; the action is disabled or refused when the inventory is populated. A pending state, concise localized error, and retained selected file make recoverable failure clear. Successful restoration refreshes the visible inventory. Keep the source archive until items, memberships, and photos have been checked. Revision 2 single-category archives use a tested transition adapter. Revision 1 and unknown revisions receive an unsupported-format message; there is no silent conversion. The ZIP remains a complete archive; CSV and a future styled XLSX are spreadsheet views rather than restore formats.

## M3.3A control consistency

Shared control tokens define height, radius, padding, font, gap, border and focus. Category selection uses a compact trigger and a bounded transient panel within the form flow so it does not obscure required inputs; outside activation and Escape dismiss it without losing selections. Emoji palettes stay in a single-column collection form. Filter layouts reserve the clear-action slot and clearing returns focus to search. Item editing shows values in their fields without a duplicate summary. Full collection-photo viewing contains the saved image, restores trigger focus, and exposes Change Cover inside the viewer; a collection without a cover offers Add Cover. Crop dialogs follow content within viewport limits and retain a scrollable body and visible footer.

## Inventory management and archive recovery

Use the header inventory menu with its separate Create action and adjacent Settings control. Canonical links include the inventory UUID; mutation forms carry their route context and never retarget from the preference cookie. Rename preserves identities. Delete uses the shared alert-dialog geometry, actual counts and exact-name confirmation when populated. Disable repeated submission and keep errors in the dialog. Successful deletion selects another valid inventory or the Create Inventory landing.

Data exports the explicit current inventory. Import previews a validated ZIP, proposes an editable new inventory name and confirms Import as new inventory. The selected File remains available for retry. Navigate only after the transaction commits; never offer destructive replacement. Feedback stores dictionary keys with parameters, and language changes re-render existing messages. Forms dispatch without automatic DOM reset so recoverable failures preserve selected options and File state. Private labels use parentheses and a quiet lock icon without implying account-level secrecy.


## M3.3B header and inventory rows

The header inventory menu uses a button, explicit selection entries and a distinct Create action, plus a nearby Settings control. Arrow keys and Escape support menu navigation; duplicate existing names show short identifiers rather than being silently renamed. The settings page offers a link back to the selected inventory and no misleading active Inventory state. The common shell provides scoped counts to every navigation view. Item rows expose one stretched item link and separate category filter links, without nested interactive elements; category activation retains the current search/status/sort and remains within the current collection when applicable.


## M3.3B category tokens and crop preview

The category control contains selected removable tokens and one trigger. Its transient panel is positioned against the field and flips/clamps to the viewport; it does not participate in form layout. Outside clicks and Escape dismiss it, keyboard arrows navigate options, Space/Enter toggle, and Backspace removes the last token from the trigger. Input and selections remain a draft until the item form is saved. Custom-category emoji are workspace-local presentation metadata, independent of category identity and included in portable archives.

The selected crop uses a bounded grid with zero minimum track sizes and `contain`; the image must not exceed the preview frame. The former automatic grid minimum could expand a portrait beyond the fixed-height frame and clip it. A synthetic marker test reproduces the former geometry and checks both preview pixels and normalized saved pixels at portrait, landscape, tall, and 20:1 ratios. Choosing a replacement opens the crop editor without discarding the existing selected file; cancelling restores the existing selection. Camera/photo source dialogs close with X, Escape or backdrop and always stop camera tracks. Crop Cancel remains explicit because it discards the pending crop. Rotation controls have native accessible labels and the Reset control is visibly named; crop undo/redo and annotation tools are future work.

Collection selection is staged: closing discards unchecked changes, while Add commits the selected memberships together. Collection icon and cover are independent. Default is neutral; emoji, member photo and uploaded image are explicit cover choices. A cover viewer must keep its Change cover action and any nested dialog within the viewport. Inventory creation, rename and import reject newly conflicting names; pre-existing duplicates keep their identities and are distinguished in the menu.

After a reload, show an explicit choice to restore or discard a meaningful Add Item draft before showing the empty form. An inaccessible, full or conflicting local store must not erase the current form: explain the problem and preserve the entered data in memory. Saving the item clears its own committed draft; do not remove another tab's newer revision.
