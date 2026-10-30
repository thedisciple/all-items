# M4A gallery interactions

Checkpoint B uses the same `GalleryRail` for persisted photos and, in checkpoint C, local draft photos. The creation integration is not complete until checkpoint C is verified.

## Separate identities and actions

The visible photo, primary media UUID and stored order are independent. A thumbnail selects a view (`aria-current`); its sibling star explicitly sets primary (`aria-pressed`). The main image/lightbox supplies previous/next buttons, a numeric counter, arrow-key navigation and horizontal swipe. None of these browsing operations writes the gallery. Stars remain visible and keyboard accessible, without nested buttons or hover-only actions.

The rail is horizontally scrollable rather than a wrapping grid or ten pagination dots. Selection scrolls into view. Every thumbnail and star has a separate target of at least 44px. Individual deletion uses the shared destructive confirmation and a named red trash button; item/collection deletion keeps text.

## Sorting implementation

The adopted MIT packages are `@dnd-kit/react` and `@dnd-kit/dom`, pinned to 0.5.1. This is the current sensor API, not the older `@dnd-kit/core` API. Seven packages were added without upgrading existing dependencies. The rail is dynamically loaded only when needed. The final B build lists two lazy rail chunks totaling 124,112 bytes (39,723 bytes with gzip); this measures those emitted chunks, not a claimed incremental route-size comparison. Primary sources: [sensor guide](https://dndkit.com/react/guides/sensors/) and installed package declarations/source.

Pointer activation requires a hold: 200ms for mouse and 350ms for touch, with a 6px movement tolerance. A short press selects; movement before activation permits native horizontal rail scrolling. After activation the framework manages dragging, selection suppression, insertion feedback and horizontal edge auto-scroll. A drop commits once through the existing inventory-scoped transaction. Escape, pointer cancellation, blur or hidden document cancels. The primary UUID and collection-cover references do not change with order.

Keyboard activation uses Space or Enter; arrows move, Space/Enter commits, Escape/Tab cancels. Instructions and position announcements exist in all five dictionaries. The Accessibility plugin owns drag-handle `aria-pressed`, so view selection deliberately uses `aria-current`. Reduced motion disables decorative transitions while retaining position feedback.

Conflicting media operations lock the rail. A rejected or interrupted persisted reorder restores the confirmed array and recreates only the drag manager, because restoring React state alone was insufficient to reverse the framework's optimistic DOM placement. Focus returns to the moved thumbnail after controls unlock. The media editor stays mounted, preserving selected File/source/preview state. Existing-gallery add/replace acknowledgement idempotency is a separate checkpoint C audit addition.

## Addition policy

`NEW_ITEM_PHOTO_LIMIT` is 10. It counts photos, not source/display/thumbnail files. New additions preflight the item owner/count before decoding and recheck inside the write transaction, including concurrent writers. A saved gallery at or above ten cannot receive another photo until below ten. Replacement, primary choice, deletion, reorder, reads and ZIP import/export remain available. There is no ten-row database constraint and no archive-format change.

Telegram's [album design](https://telegram.org/blog/albums-saved-messages) and [media-group limit](https://core.telegram.org/bots/api#sendmediagroup) are interaction references, not requirements copied into the product. Reconsider the initial cap and long-rail performance after usability evidence. File, pixel, aggregate processing and draft-storage budgets are independent.

## Leaving details

The permanent Done link returns to the current inventory or a server-validated owned collection. Direct links and foreign collection IDs fall back to the inventory. Details, media and membership editors register meaningful dirtiness and actual pending writes. A clean Details form remains disabled after an independently saved photo. Save/Discard/Stay protects unsaved edits; a pending write offers Stay and waits for completion before an already-requested exit.

Current Edge's cancelable Navigation API traversal event guards Back before Next.js changes routes. Internal links and programmatic inventory switching share the guard; native unload and popstate handlers provide additional protection. The guard lives in the persistent root so route changes cannot unmount its listener before traversal is handled. The registry updates synchronously. A separate Edge run disables the Navigation API and verifies Back/Stay/Back/Discard; this checks the fallback path without claiming testing of other browser engines. See [validation](m4a-validation.md) for executed evidence and limitations.
