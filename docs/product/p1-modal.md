# P1 Add Item scroll boundary

Task: keep photo intake and the final field fully reachable in a short 360px dialog while preserving draft work and one Save action. The previous form owned the scrollbar and applied sticky styling to every descendant action row, making content/footer boundaries ambiguous.

The title and X occupy a stable separated header; the form contains one scrolling body and one stable footer. A restrained hairline and surface distinguish the footer, including safe-area bottom padding. Recovery/error/pending content belongs in the body, and nested photo/crop dialogs retain their own geometry. No generated concept or external product reference was needed for this concrete layout correction.

Synthetic current-Edge checks cover five dictionaries, 360/390/760px and desktop, short effective 125/150% viewports, header/footer positions during scrolling, fully exposed final field and Add photo button, keyboard focus and Close/reopen field retention. Existing crop footer geometry is also tested. A synthetic screenshot is generated under the OS temporary directory. Actual device touch, camera, screen readers and physical browser zoom remain manual acceptance, not claimed by viewport emulation.

Regression follow-up: category popovers are bounded by the Add Item body so they cannot cover fixed actions. A delayed search navigation could restore a category after Reset; only genuine user search edits now schedule the debounce, while Reset and history navigation synchronize without starting a stale request. Existing category/close and Back/Forward/reset scenarios verify these corrections. Older scrolling assertions now target the body rather than the form.
