# UX principles

Follow the [design manifesto](design-manifesto.md) for every interface change. Show Save and Cancel only while editing; show success through changed content or a screen-reader announcement, not a persistent banner. Keep visible errors actionable. Search should debounce and filters should apply immediately while preserving URL and Back/Forward state. Destructive operations use the same explicit confirmation pattern, with one final action. A control's icon and styling must match its behavior.

Collection identity and cover are separate values. Reuse one renderer so overview and detail views show the same selected cover. A category describes the item; a collection groups items; an emoji is a recognition cue and not a stable identifier. Use category chips as non-interactive metadata. Keep photo rotate controls grouped separately from reset/undo controls and all crop actions reachable on short screens. Stock editors use mode-appropriate fields, stable typed quantity drafts, and actionable validation without repeating the summary total. Optional missing values may use an accessible neutral dash.

These principles apply to product decisions and code review. They summarize the research in [design references](design-references.md) for All Items rather than copying another product.

1. **Reduce effort.** Make frequent tasks direct: find an item, see its quantity and place, add a photo, or organize it.
2. **Keep the system legible.** Equivalent controls behave consistently. State changes receive visible feedback, and errors explain what the user can do next.
3. **Protect entered data.** Do not clear a user's work on recoverable errors. Preserve existing inventory and media unless the user explicitly changes or deletes them.
4. **Use the right control.** Use file inputs for files, numeric fields for quantities, and clear buttons for actions. Never expose database serialization syntax.
5. **Progressive disclosure.** Show the essential item summary first. Keep less common metadata and destructive actions available without crowding the primary task.
6. **Simplicity with enough detail.** Remove duplicated or confusing controls, but retain safeguards and information that prevent mistakes.
7. **Private by default.** Inventory, photos, exact locations, and sale intent remain local. A future public listing must be a separate, explicitly approved representation.
8. **Respect time and attention.** No artificial urgency, mandatory streaks, guilt messages, or engagement loops. Positive feedback confirms useful work without demanding more time.
9. **Accessible interaction.** Visible focus, keyboard operation, clear labels, meaningful status announcements, comfortable touch targets, responsive layouts from 360px, and reduced-motion support are acceptance criteria.
10. **Ship a complete slice.** A workflow includes loading, success, validation, failure, retry or recovery, and a clear route back. Do not call planned functionality implemented.
11. **Keep concepts distinct.** Categories describe what an item is; collections group items for a purpose; locations describe where an item is stored. Local storage, offline availability, synchronization, and backup are separate capabilities and must not be implied by one indicator.
12. **Localize interface, not user data.** System labels, status, dates, and numbers follow the selected language. Item names, custom categories, collection names, and storage locations remain exactly as entered.
13. **Preserve ordinary-session drafts.** Closing a form dialog preserves every entered value and selected File. Discard is a visible, deliberate action with confirmation only when work exists. A recoverable submission error keeps the draft and offers retry. IndexedDB reload/crash recovery is a separate future capability.
14. **One save completes one task.** Successful item creation returns to inventory with confirmation; successful edits return to their validated calling context. Do not follow a successful save with another required save.
15. **Edit photos without losing the clean source.** Newly processed photos retain a normalized, metadata-stripped source plus the current display derivative and thumbnail. Keep operations such as crop/rotation as editable metadata where practical; never claim old cropped pixels can be restored.
16. **Make collections useful from their own page.** Create through one focused dialog; search and batch-add existing items, and remove memberships without deleting items. Covers are explicit optional choices with a safe default.
17. **Use symbols as visual anchors.** Map system-category emoji from stable category keys; keep text labels, accessible names, and consistent control geometry. Emoji help recognition but never carry meaning alone or appear beside a duplicate icon.
18. **Keep media editing recoverable.** Do not call cropper operations until the decoded image is ready; validate dimensions, zoom, crop bounds, and encoded output. When processing fails, retain the selected file and offer the original image as an explicit path to finish item creation. Keep common crop actions compact, with keyboard adjustments disclosed rather than permanently displayed.
19. **Keep the photo secondary to the item.** Show a compact, contained image beside useful item data; offer a larger viewer on demand. Deletion must be visually distinct from replace/edit controls and require clear confirmation.
20. **Treat export as a local user action.** Make the complete archive the primary choice and CSV a separate spreadsheet option. A pending state lasts only while the server is preparing the file; errors preserve the page and entered UI state. CSV never claims to include photos or all relationships.
21. **Localize every application surface.** Keep all five dictionaries key-complete, use Intl for locale-sensitive counts, dates, and numbers, and never translate user content. Language changes keep the route and stored records intact.
22. **Restore deliberately.** Preview only a verified current archive; require explicit confirmation and an empty target. Keep the original archive for recovery, and explain unsupported experimental revisions without guessing how to convert them.
23. **Edit one logical item once.** Inventory type is essential, updates stock fields immediately, and saves with metadata and categories. Failed saves preserve the full controlled draft, including selected options; avoid native form resets after rejected actions. Empty zero location placeholders create no additional persistent data. An incompatible switch to Single item requires correction and never silently drops meaningful stock.
24. **Keep filtering spatially stable.** Reserve cover/image geometry, retain URL/history state and preserve scroll while results change. If the shorter document cannot retain the previous offset, keep the filters visible with a predictable adjustment.

## Practical acceptance questions

- Can a user identify the primary action without reading implementation details?
- Does selecting or saving data give immediate, honest feedback?
- If validation or network/device capability fails, is entered information preserved and the next step clear?
- Can the task be completed by keyboard and at a 360px viewport?
- Does the change preserve existing inventory, quantities, locations, photos, and privacy boundaries?
- Is complexity supported by an actual user need?

See [interaction patterns](interaction-patterns.md) for current and proposed state transitions.

Equivalent native fields, selection triggers and actions share control geometry. Keep ordinary Save/Cancel rows horizontal when they fit, reserve filter reset space, avoid duplicate editable metadata, and keep required inputs clear of palettes. Use full-image collection cover viewing with contextual editing and an explicit Add Cover state.
