# M4C mobile decisions and evidence

Task: an invited phone user needs to find, photograph and edit items without clipped controls, redundant pickers or losing inventory context; narrow 320px and short landscape screens are the awkward cases.

Owner observations: brand clipping/overlap, mismatched header controls, Android crop scrolling, native picker inconsistency, redundant iPhone acquisition choices and a detached language menu. These physical observations motivate changes; browser emulation cannot certify their resolution on the owner's devices.

## A: shell choice

Use two immediately accessible Inventory/Collections tabs, without a hamburger. Retain desktop collapse. On mobile, place the complete brand and two compact tabs in one deliberate grid row, then the inventory/gear/account controls on one 44px control row. Hide only visual mobile counts; accessible names retain counts. Move Data into the explicit inventory settings, keeping existing authorized URLs. Bottom navigation would need extra keyboard/safe-area coordination and is not necessary for two destinations that fit the compact row.

Root evidence: accumulated mobile flex direction/wrapping rules compete with desktop collapse; brand text has overflow:hidden and the brand has min-width:0. Mobile navigation has three destinations and the gear retains a separate 40px override. Replace those competing layout contracts in one scoped mobile rule, rather than hiding page overflow.

Acceptance: full brand text and tab bounds at 320/360/375/390/412/430/768px and desktop; no document overflow; consistent 44px controls, keyboard focus and safe-area padding. Synthetic screenshots live outside Git. No external mockup is needed for these concrete sizing defects.

## B: photo geometry and acquisition

The crop body previously combined fixed minimum grid columns with a canvas/handle layer that can extend beyond its calculated container. Give each grid track minmax(0,1fr), bound range inputs, wrap the toolbar, and size a dedicated crop viewport independently of the controls. A symmetric 14px inset preserves 24px touch handles without letting the canvas/handles enlarge the scrolling body. Clip only the image viewport; the document is not globally clipped. ResizeObserver asks the existing responsive Cropper handler to recompute on actual viewport changes, preserving its restore behavior. The output/source processing contract is unchanged.

Replace only aspect and currency native sheets with feature-detected native Popover API listboxes: top-layer bounded placement, keyboard navigation/typeahead, native outside dismissal, Escape and focus return. Older browsers keep the native select. Other selects remain native. Phone coarse-pointer intake opens one native multiple file chooser without capture forcing; desktop still has a distinct webcam workflow. Physical OS camera/Back acceptance remains open.

Production CSS revealed an additional cascade defect: Cropper's desktop corner-handle rule overrode the older equally specific 24px rule and shrank the southeast target to 5px. Scope the explicit size through the new viewport so its specificity wins independently of CSS chunk order. The production drag/resize test checks the actual hit target rather than only a screenshot.

## C/D: contextual Data and bounded lists

Login and 404 reuse AppBrand. The 404 never names a missing private entity. Legacy item/collection bookmarks resolve the actual inventory through the verified owner's relation; the selected inventory cookie is not authorization. Data actions use equal quiet controls with compact format notes. Footer public links identify the development package version, contribution guide, license and changelog; no author profile is inferred.

List pages query COUNT and LIMIT/OFFSET in one authorized read transaction. Sorting retains the existing explicit UUID tie-breaker. Filters reset page one; page size and return routes preserve list context with an allowlisted internal query. Removal clamps to the last existing page. Collection member lists and on-demand candidate/cover pickers are bounded database reads; closed dialogs no longer serialize the full inventory/gallery. Read errors preserve selections and use localized feedback.

The [Universe recap](https://github.com/events/universe/recap) is structural inspiration for a compact footer and reviewable work, not a product specification. [Bounded experiments](../architecture/m4c-experiments.md) and [physical acceptance](m4c-device-acceptance.md) distinguish verified facts, implementation choices and future work.
