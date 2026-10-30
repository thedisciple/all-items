# Product design references

Research reviewed 25 October 2026. These references inform interaction principles; All Items does not copy protected interfaces, branding, illustrations, or code. Reference-product functionality is separated from design interpretation and proposed All Items behavior.

## Mobbin MCP and AI-assisted design workflow

### Verified source findings

- Sweat AI's 25 October 2026 case study shows one design cycle from an underspecified dashboard request through Mobbin references, generated mockups, human revisions, and a native implementation. It shares prompts and an attachment map and says the concepts use illustrative/synthetic data. At publication, the native changes were under review and unreleased; the image-generation model/version was not recorded, and no comparative usability measurements are reported. This is a transparent worked example, not evidence of measured product improvement. [Case study and prompts](https://getsweat.ai/blog/from-mobbin-to-a-working-dashboard/)
- Mobbin's official MCP exposes search for screens, multi-step flows, and website sections; returned results include low-resolution previews and expiring high-resolution image URLs. [MCP features](https://docs.mobbin.com/mcp/features)
- Mobbin documents that MCP is available on paid Pro, Team, and Enterprise plans and uses OAuth. Its privacy page says request tool names, parameters (including query text), timestamps, and connected account/workspace identifiers are retained in product analytics; Standard/Deep Search queries are processed through listed AI providers. [MCP overview](https://docs.mobbin.com/mcp/introduction), [privacy and data](https://docs.mobbin.com/mcp/privacy-and-data), [AI credits](https://docs.mobbin.com/ai-credits)
- Apple's WWDC 2018 session explains direct manipulation, continuous feedback, interruptible gestures, and handing gesture velocity into following motion. [Designing Fluid Interfaces](https://developer.apple.com/videos/play/wwdc2018/803/)
- Emil Kowalski's repository publishes `apple-design` under MIT. The skill translates selected Apple interaction principles into web guidance, while also making specific choices about spring parameters, materials, typography, and interaction code. Those choices are the author's guidance, not universal Apple requirements. [Source skill](https://github.com/emilkowalski/skills/tree/main/skills/apple-design), [repository license](https://github.com/emilkowalski/skills/blob/main/LICENSE)

### All Items interpretation

Use the workflow in [evidence-led design workflow](design-workflow.md) for substantial UI changes. Its high-value contribution is the traceable sequence: define an actual user task, collect a few task-relevant references, state what to borrow and what remains unknown, review synthetic visual alternatives with a person, specify behavior and edge states, then inspect the implemented flow. Mobbin is optional and useful for visual decisions; search results are not proof that an interaction works or that it suits a private inventory. The `apple-design` skill is most relevant to the crop editor, draggable surfaces, and transitions; it does not supply the product's overall visual direction. Keep the established All Items design manifesto, five-language requirement, local-only data boundary, and accessibility checks authoritative.

## Artemy Lebedev's Kovodstvo

### Verified source findings

- Section 76 argues that equivalent controls should behave consistently and that changes should receive feedback across corresponding views. It applies the idea to both hardware and software interfaces. [§76: Two interface principles](https://www.artlebedev.ru/kovodstvo/sections/76/)
- Section 188 treats preservation of entered data as a central interface goal, including recovery after closing or reloading. [§188: Data preservation](https://www.artlebedev.ru/kovodstvo/sections/188/)
- Section 167 describes progressively refining a complete concept to the time available, instead of polishing details while the whole solution is still unclear. [§167: Progressive JPEG method](https://www.artlebedev.ru/kovodstvo/sections/167/)
- Sections 110, 111, and 147 discuss removing unnecessary parts, adding complexity when clarity or safety needs it, and distinguishing simplicity from primitiveness. [§110](https://www.artlebedev.ru/kovodstvo/sections/110/), [§111](https://www.artlebedev.ru/kovodstvo/sections/111/), [§147](https://www.artlebedev.ru/kovodstvo/sections/147/)
- The Studio's forms guide recommends controls that match the data, actionable validation, preserving form contents after errors, keyboard support, clear labels, and a clear submit action. [10 rules for good forms](https://www.artlebedev.ru/technogrette/etc/forms/)

### All Items interpretation

Use native controls for familiar tasks, keep labels visible, validate at sensible boundaries, and put errors beside the affected task. Preserve a coherent whole before fine polish. Add confirmation or a second step where it prevents meaningful loss, such as deleting a collection, while keeping ordinary edits direct. The Add Item heading previously displayed a decorative plus in addition to the Add button; the duplicate has been removed and must stay removed.

## monobank

### Verified source findings

- monobank's official history records a Rewards section in 2019, a savings "Banka" in 2020, a customizable cat avatar in 2023, and the launch of monobazar in 2025. [Official company history](https://monobank.ua/en/about)
- AIN reported the Rewards launch in September 2019. That is evidence of a product launch, not independent evidence that a particular mechanic caused retention or other business outcomes. [AIN launch coverage](https://ain.ua/ru/2019/09/25/v-monobank-dobavili-nagrady-teper-polzovateli-mogut-zarabatyvat-kotov-za-aktivnost/)
- In a 2023 redesign interview, the product team discussed a large redesign and staged release. The interview is a source for the team's described process and rationale, not proof of measured usability outcomes. [The Village interview](https://www.village.com.ua/village/business/business-interview/345425-monobank-redesign-interview-anatoloiy-rogalskiy-2023)
- The official product history documents the savings product; exact internal design mechanisms are not publicly established by the visual interface alone.

### All Items interpretation

Offer quick access to repeated tasks, make advanced item details optional, and give clear confirmation for changes. Consider local organization goals only when they help users finish useful work. Do not add a points economy, streaks, reminders, or public comparisons to M2B.

## monobazar

### Verified source findings

- monobank's official history says monobazar launched in 2025 for selling pre-owned items. [Official company history](https://monobank.ua/en/about)
- Launch coverage dated 8 December 2025 describes a beta release for customers and an initial scope deliberately cut to gather feedback. The latter is reported as a team statement, not a universal result. [Launch research: EU Information Service](https://euis.eu/mono-bazar-launch/), [AIN launch coverage](https://ain.ua/2025/12/08/monobazar/)
- Reports about the April 2026 feature describe three-day auctions with a minimum price and a highest-bid winner. These are reports about monobazar's implementation, not a recommendation that All Items use those exact rules. [AIN auction report, 28 April 2026](https://ain.ua/2026/04/28/na-monobazari-zapustili-aukcioni/)
- A May 2026 report describes testing a seller flow for Ukrainian individual entrepreneurs, including makers and small sellers, with legal work still in progress. [RetailersUA, 11 May 2026](https://retailers.ua/news/tehnologii/monobank-testuye-prodaji-dlya-fop-u-monobazari-scho-vidomo)
- Public launch reporting describes AI-assisted listing text. Public reports establish the advertised workflow, not its model, accuracy, or internal implementation. [OBOZ.UA launch report](https://www.obozrevatel.com/ekonomika-glavnaya/economy/monobank-zapustil-novyij-servis-dlya-prodazhi-veschej-s-ii-opisaniyami-i-zaschitoj-ot-moshennichestva.htm)
- monobazar operates with a bank's identity, payment, and delivery capabilities. Those trust guarantees cannot be inferred from a similar screen or assumed available to All Items.

### All Items interpretation

The user's private inventory should reduce repeated data entry only after an explicit, reviewable conversion to a separate listing draft. Keep exact locations, serials, private notes, ownership details, and full quantities out of public representations by default. Any future trade flow depends on authentication, consent, listing/stock reservation, transaction integrity, legal review, trusted payment and delivery partners, abuse handling, and support. M2B implements none of it.

## Telegram

### Verified source findings

- Telegram's official Saved Messages 2.0 announcement describes views grouped by source chat, a compact list, tags that filter search, and a Saved tab in shared media. [Saved Messages 2.0 announcement](https://telegram.org/blog/new-saved-messages-and-9-more)
- Telegram's API documentation describes chunked and streamed upload mechanisms, temporary parts, retryable missing parts, and separate file download operations. These are details of Telegram's distributed service and are not needed for local M2B media. [File upload and download API](https://core.telegram.org/api/files)
- Telegram's Saved Messages API confirms that saved items can be searched and tagged, and that tags are a filtering mechanism. [Saved Messages API](https://core.telegram.org/api/saved-messages)
- Telegram publishes platform-specific official clients. Equivalent user goals do not require identical device controls. [Telegram apps](https://telegram.org/apps/)

### All Items interpretation

Collections, categories, physical locations, and search are different views over the same item, never duplicate item records. Keep search available as the inventory grows. For current local image uploads, an immediate preview, indeterminate processing state, retryable failure, and local thumbnail are sufficient. Draft recovery, batch uploads, cancellable queues, and portable media belong to later milestones.

## Notion — lightweight icon and cover organization

### Verified source findings

- Notion's official guide says users can assign emoji/icons to pages and choose or upload a cover; it describes icons as a way to make pages easier to recognize and find. [Page icons & covers](https://www.notion.com/help/guides/page-icons-and-covers)
- Notion's database documentation describes views that let the same information appear through different layouts and filters. [Database views](https://www.notion.com/help/category/database-views)

### All Items interpretation

Use stable text/category identity with a restrained local emoji as a visual anchor. Let collections optionally carry an icon and an explicit cover; keep a clear default when no cover is selected. Keep labels and accessible names visible so emoji are not the only meaning. All Items uses a small local choice set and private cover storage. This is a design inference from Notion's documented page recognition and icon/cover options, not a claim about measured usability gains.

## Crop library evaluation

- `react-cropper` wraps Cropper.js and documents crop box options, methods, and MIT licensing. The wrapper accepts React 17+, compatible with this project's React 19 setup. [react-cropper](https://github.com/react-cropper/react-cropper), [Cropper.js](https://github.com/fengyuanchen/cropperjs)
- Cropper.js v1 exposes crop-box resize/move, aspect ratio, zoom, rotation, and canvas output. The library does not provide All Items' full keyboard control surface, so the app adds keyboard-operable move/resize buttons and keeps aspect, zoom, rotate, reset, cancel, and confirm controls focusable.
- One cropper owns selection, pan, zoom, and rotation. This avoids combining a rectangle library with a second image pan/zoom coordinate system.

## Research limits

Observed screens and public announcements do not reveal private source code, internal systems, accessibility conformance, or causal product metrics. Treat all All Items recommendations above as design inferences and proposals, not claims about reference-product internals.

## M3.1 user-reported interaction findings

The M3.1 brief reports inconsistent collection emoji/cover rendering, visually different collection actions, a misaligned language chevron, low-salience category metadata, hard-to-reach photo-editor actions, ambiguous rotate/reset icons, repeated stock totals, and verbose empty membership text. These are user-reported findings from the project brief, not independently observed usability-test measurements. The design inference is to share visual renderers, use one icon grammar, protect essential actions within short viewports, and remove repeated information while preserving validation and accessible labels.

## M3.2 user-reported interaction findings

The M3.2 brief reports cropped photo-editor controls on short screens, inconsistent crop and zoom focus cues, confusing stock quantity edits, a clipped collection-cover picker, double focus outlines, and redundant Data-page success feedback. These are user-reported observations rather than independent usability measurements. The design inference is to keep actions and keyboard adjustments reachable within a short viewport, preserve quantity text during editing, use one visible focus treatment, and let completed downloads speak for themselves while retaining actionable errors. The same brief asks for readable archive filenames; stable IDs remain in JSON because filenames are editable presentation text, not identity.

## M3.2-R1 media diagnostics

The reported simultaneous broken thumbnails and RSC `Failed to fetch` incident has no retained browser network log, so its original cause is unconfirmed. Identifier-derived media routes use private no-store responses; no invalid URL or stale identifier was reproduced. In isolated Edge scenarios, normal synthetic media returned 200. Injected 503 responses and interrupted image requests broke media independently of successful page/RSC navigation. Delaying thumbnails did not prevent opening an item. A fast image failure before hydration initially left the new fallback in loading state; checking the image's complete/naturalWidth state on mount fixes that reproducible event timing issue. This finding does not establish the cause of the earlier router error. No overlay or router error handling was suppressed. Failed decorative images retain empty alt and an independent placeholder; informative photos retain descriptive alt. A single reconnect retry and subsequent normal navigation/reload recovered images without request loops.

## M3.2-R1 editing and filtering findings

Code inspection confirmed that the old item and stock forms used separate actions and that stock received only the persisted type. A controlled Edge failure scenario also exposed a native form-action reset changing the type select while other draft fields remained; explicit action dispatch preserves the complete controlled draft. The old collection image height depended on intrinsic ratio and available width; shortening a document can also clamp browser scroll. These are identified mechanisms, not a captured trace of the original reported jump. Synthetic Edge checks now measure unchanged uploaded-cover width/height while filtering three mixed-category items to one and back at desktop and 360px widths, including history navigation. Multiple-inventory switching is a future design inference from Telegram's account-switching interaction; account authorization and inventory organization remain different concepts in the ADR.

## M3.3A interaction findings

The M3.3A brief describes user-observed regressions in collection creation, control alignment, category selection, filters, and crop sizing. No original screenshot files accompanied the execution attachment; the supplied descriptions are treated as acceptance requirements. Code inspection found a retained two-column grid on the collection creation form, broad field-input rules applying to category checkboxes, forced vertical dialog actions at mobile widths, conditional removal of the clear-filter grid cell, and a viewport-sized crop dialog. These explain the reported mechanisms without claiming independent observation of the original screenshots. Synthetic Edge scenarios cover geometry, required-name access after the last emoji selection, category dismissal/draft retention, full cover viewing, and crop controls at desktop and 360px. Browser results are recorded with the checkpoint validation.


## GitHub labels and filtering — M3.3B

Verified: [GitHub's label documentation](https://docs.github.com/en/issues/using-labels-and-milestones-to-track-work/managing-labels) describes selecting existing labels in a menu, and its [filtering documentation](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/filtering-and-searching-issues-and-pull-requests) describes selecting a label to filter a list. These sources do not establish usability or accessibility of every GitHub selector.

Design inference for All Items: keep chosen categories compact and make a category in a list an explicit filter action, while preserving a separate link to the item. The reference does not justify copying GitHub branding, visual assets, or unrelated workflows. Use synthetic content in implementation checks.

## M3.4 user-observed references and verified findings

The brief describes MoneyRS screenshots (sidebar toggle, quiet hover, currency selection, release notes and shared groups) and a VS Code concept as interaction references. Original screenshot files were not supplied in this execution; these are user-observed examples, not independent evidence of backend behavior, accessibility or measured usability. AliExpress product galleries/price hierarchy are retained as an idea for multiple views of one object, without copying assets, promotions or trade dress. No private inventory screenshot was uploaded externally.

Verified: [VS Code layout documentation](https://code.visualstudio.com/docs/configure/custom-layout) describes explicit sidebar visibility controls. The All Items inference is a user-controlled compact navigation mode, preserving named destinations and the brand mark, rather than copying an editor layout. Persistent intrinsic filters were chosen over a disclosure to keep frequent filtering direct; [task decisions](m3-4-design.md) record alternatives and limits.

Code inspection confirmed the final below-1100px one-column filter override, category overflow-wrap:anywhere, and a cover image whose inherited auto dimensions did not fill its wide frame. Synthetic Edge checks measure labels/chips within bounds and centered contained cover geometry across portrait, landscape, square and extreme ratios. Generated concepts were unnecessary for these concrete constraints. These are implementation checks, not comparative usability measurements.

Currency research exposed a real divergence: [SIX ISO List One](https://www.six-group.com/dam/download/financial-information/data-center/iso-currrency/lists/list-one.xml) assigns HUF minor unit 2, while the local Node Intl runtime and [CLDR currency data](https://github.com/unicode-org/cldr/blob/main/common/supplemental/supplementalData.xml) use 0 as a display default. The storage decision is a pinned ISO table plus a historical exponent column, never automatic reinterpretation or cash/FX conversion. Detailed retrieval date and values are in the task note.
