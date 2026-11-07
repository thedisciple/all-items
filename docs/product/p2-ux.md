# P2 empty account and Add Item boundary

## Task and evidence

A newly invited person with zero inventories needs to recognize the same application and create one inventory without encountering inaccessible inventory routes. At 360 px, the account and language controls must still work. The former `/` page rendered a bare brand word and repeated the Create inventory heading and button without the populated app shell.

The Add Item dialog already had fixed header and footer regions, but a general `.dialog-actions { margin-top: 16px; }` also applied to its footer. Edge geometry measured exactly 16 px between the scroll viewport and footer border. The body additionally used eight pixels of bottom padding beyond its normal dialog inset. A synthetic screenshot showed the resulting dark strip. This is a verified box-model cause; the existing design system supplies the chosen layout, so no external visual reference was needed.

## Implemented behavior

- The empty account uses the existing app shell geometry, shared A brand, header account and language controls, and recognizable navigation labels. The three inventory routes are visibly unavailable and are not links. One heading states the empty state; one button opens the existing creation dialog.
- The Add Item footer removes the inherited margin. The body ends at the footer separator, with one normal inset of internal bottom padding so fields and photo controls can scroll fully into view. Header and footer remain fixed, and the footer shares the dialog background.

## Observed validation and limits

The focused current-Edge run passed 10 scenarios: five locales for the Add Item geometry/draft flow and five for the empty account shell, at desktop and 360–390 px. The Add Item test also covers short effective viewports, scroll containment, final field/photo button visibility, footer focus and reopen state. Synthetic screenshots were visually inspected and remain in the OS temporary directory. This supports the rendered geometry and interaction result, not physical touch, camera, browser zoom or user-task success.
