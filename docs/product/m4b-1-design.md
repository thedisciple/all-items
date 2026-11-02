# M4B.1 design decisions

The owner reported an extreme portrait thumbnail showing only an edge, competing item-detail actions and a textual collection-cover list that did not scale. The task is to browse a gallery and choose a recognizable collection cover, including many similarly named items and very narrow images.

The gallery uses centered containment inside bounded square tracks for both browser drafts and persisted derivatives. The source remains unchanged. Newly added media becomes the viewing selection only; the primary indicator remains independent. Edit and confirmed delete share the photo action row. Item fields remain directly editable; Save and Cancel appear when the field draft changes, while the Back control identifies the originating inventory or collection. Photo writes remain immediate. The future unified commit design is separate in [the architecture note](../architecture/m4b-unified-editing.md).

The cover chooser groups thumbnail choices by item, includes the inventory number, filters by name/model/number, renders up to 24 thumbnail choices per page, and previews only the selected full-size image. Selecting a cover does not change the item's primary. The collection editor returns to the same draft after opening the shared cover workflow; the cover has its own explicit save. Filters show Clear only while active. These are design decisions, not claims of measured usability gains.

Verification uses synthetic images and isolated inventories. Browser emulation and keyboard tests do not establish physical camera, touch, browser zoom or real-user usability acceptance. Existing design references remain research context, not specifications to copy.
