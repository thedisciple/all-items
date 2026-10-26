# Design manifesto

This manifesto governs every user-facing change in All Items. The interface should explain itself through its structure and behavior. Minimalism is a product requirement: each visible element must help a real task, communicate necessary information, or make an interaction understandable.

## Product rules

- Equivalent fields and actions share control height, radius, padding, typography, centered icons, and one focus treatment. Color can communicate priority or danger; it does not justify unrelated geometry.
- Keep ordinary confirmation and cancellation in one horizontal row whenever they fit. Do not make secondary actions look like unstyled text.
- Reserve filter geometry before a clear action appears. Conditional state must not unexpectedly resize search or move keyboard focus.
- Keep required fields visible and unobscured. Compact selectors dismiss with Escape/outside activation while retaining the draft; palettes remain inside their form layout.
- Editing screens show each stored value once in its useful editable context. Keep human inventory numbers near the item name and secondary metadata progressively disclosed.
- Collection cover previews may crop for scanning; explicit full-image viewing uses contain and exposes a discoverable edit action for keyboard and touch users.

- Reduce cognitive load, clicks, repeated work, duplicate actions, and persistent noise.
- Prefer direct manipulation and immediate, truthful state changes.
- Make primary and secondary actions easy to distinguish; equivalent actions share a visual treatment.
- Use a control only when its behavior matches its appearance. Icons, disclosure controls, and labels must describe the action they perform.
- Show Save or Cancel only while a user is editing. Avoid redundant explanations and obvious repeated information.
- Keep technical storage details out of ordinary workflows. Keep errors visible, brief, and actionable.
- Preserve entered work after recoverable errors. Never require a manual refresh to see a saved change.
- Destructive actions use one consistent explicit confirmation with a clear consequence, Cancel, and one final action.
- Provide keyboard access, visible focus, accessible status and error announcements, and layouts that work at 360px.
- Use semantic icons consistently (edit, add, delete, rotate, reset); use a restrained tooltip for icon-only controls while keeping an independent accessible name.
- Present categories as quiet informational chips, and represent an unspecified optional value with a neutral dash when its context is clear.
- Keep collection identity (name and optional emoji) separate from its selected cover (emoji, photo, or default), and render the same cover choice in overview and detail views.
- In editing surfaces, keep essential actions reachable in the viewport. Let the working area flex before making controls require scrolling; allow controlled scrolling on short screens rather than clipping controls.
- Keep photo editor actions and its expanded keyboard controls reachable at 360px and short viewport heights. Crop handles, zoom, and focus cues should share one visual grammar.
- In stock editing, show mode-appropriate rows and one clear quantity input per row. Keep typed drafts stable, reject invalid quantities with an actionable message, and avoid repeating totals already present in the item summary.
- Categories describe items, collections group them, and emoji support recognition. A collection's single visible emoji identity must not compete with its explicit cover choice.
- Remove repeated brand, model, category and total summaries above their editable fields. Keep one small display number beside the title.
- Motion must clarify a state change, respect reduced-motion preferences, and never delay a task.
- Keep private inventory, photos, sale intent, and local-first storage private by default. Do not imply synchronization, backup, or availability that is not implemented.
- Give export one obvious full-archive action and a separate optional CSV action. Show a real pending state and truthful failures; do not invent progress or imply that a download is an automated backup. Explain CSV's photo limitation briefly and in context. Import preview states the new-inventory scope, proposes an editable name and never suggests that existing data will be merged or replaced.
- Keep language switching local and preserve the current route and entered user data. Native language names supplement, rather than rely on, locally bundled flags.
- Reserve image geometry during loading and failure, and show a neutral placeholder independently of alt text. Decorative thumbnails beside item names use empty alt; standalone informative photos have meaningful alt. A failed thumbnail must not block opening the item. Reconnection may retry once per source; repeated automatic retry loops are forbidden.
- Fields in one logical item edit share one Save. Inventory type changes the draft controls immediately; categories support multiple assignments independently of collections. Empty draft rows create no persistent clutter, and recoverable failures preserve text, selected options and stock together.
- Filtering changes results while header and cover geometry remain stable. Preserve the current scroll offset where possible; if the shorter document requires adjustment, keep filters visible. Avoid layout shifts caused by image decoding or scrollbar width changes.

## Review questions

For every visible element ask whether it supports a real action, gives necessary information, is immediately understood, can be removed without losing useful function, and behaves consistently with comparable controls. Remove elements that fail this review, while retaining necessary accessibility and recovery behavior.

## Design references

All Items applies the interaction principles researched in Kovodstvo, monobank, monobazar, Telegram, and Notion without copying their proprietary assets or implying a partnership. Notion informs lightweight emoji-based organization. Telegram informs direct media manipulation and responsive navigation. monobank and monobazar remain sources for future organization, goals, and marketplace hypotheses. These references do not override local-first privacy, honest states, or the current product scope.

AI, MCP integrations, achievements, marketplace flows, E2EE synchronization, optional providers, multi-user access, and private beta remain future proposals. They are not permissions to expose data, add network dependencies, or claim unimplemented capabilities. See the [opportunity register](opportunity-register.md) and [architecture](../architecture.md) for boundaries and staged plans.

## M3.3A inventory boundaries

Keep the All Items brand separate from the Inventory section and current inventory name. Switching changes routes explicitly; stale tabs keep their original target. Creation, renaming and deletion use ordinary consistent controls. Consequential deletion names the target, states actual counts and asks for its name when populated. Never offer an ambiguous global Clear All. An empty installation offers Create Inventory without secretly recreating a default space. Errors are semantic states translated in the current language, and recoverable errors retain meaningful drafts and selected files. A quiet lock beside private metadata means unpublished local planning, not authenticated-user secrecy.
