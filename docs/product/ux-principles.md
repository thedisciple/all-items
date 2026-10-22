# UX principles

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

## Practical acceptance questions

- Can a user identify the primary action without reading implementation details?
- Does selecting or saving data give immediate, honest feedback?
- If validation or network/device capability fails, is entered information preserved and the next step clear?
- Can the task be completed by keyboard and at a 360px viewport?
- Does the change preserve existing inventory, quantities, locations, photos, and privacy boundaries?
- Is complexity supported by an actual user need?

See [interaction patterns](interaction-patterns.md) for current and proposed state transitions.
