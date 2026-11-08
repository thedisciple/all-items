# P2 release UX decisions

The owner supplied explicit bounded corrections, so no visual reference search or generated concept was needed. The implementation follows the existing manifesto and interaction patterns.

- Empty account: retain brand/sidebar/account geometry, remove the redundant topbar Inventory label; one Create Inventory action remains.
- Language: keep direct selection before authentication; place it inside Account Settings after authentication. Retain the validated, HttpOnly browser cookie so login, routes and reload use the same locale. It is not a per-user synchronized setting. This avoids an identity schema change and preserves existing browser behavior. Finish ordinary unsaved edits before leaving their page; Add Item retains its existing browser-local recovery.
- Default view: item identity/number remain fixed, categories/quantity/date added are on, model/brand/location/identification status are off. Existing stored booleans are still respected per inventory; Restore default view is an explicit opt-in. No inventory data or stored status enums change.
- Data: normal navigation reads completion metadata instead of rehashing every backup. Display the recorded date/size with an explicit not-rechecked state. Creation and Verify still report success only after full verification; unreadable metadata stays visible as an error. No artificial loading animation was added for the removed backend work.
- Sale/identification: distinguish considering sale from ready to sell, and cross-checking against a reliable source from personal confirmation. These are user-selected claims, not a new automatic verification service.

Synthetic measurements and changed-flow acceptance are recorded in [the release validation](../architecture/p2-release-validation.md). Physical mobile, touch/zoom, camera and assistive-technology acceptance remain separate.
