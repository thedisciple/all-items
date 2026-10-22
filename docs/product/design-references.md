# Product design references

Research reviewed 22 October 2026. These references inform interaction principles; All Items does not copy protected interfaces, branding, illustrations, or code. Reference-product functionality is separated from design interpretation and proposed All Items behavior.

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

## Research limits

Observed screens and public announcements do not reveal private source code, internal systems, accessibility conformance, or causal product metrics. Treat all All Items recommendations above as design inferences and proposals, not claims about reference-product internals.
