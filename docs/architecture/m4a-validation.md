# M4A implementation and validation

Starting HEAD: 34f26b0f984039b02aef187d8f02f428577202d1. Starting CI is successful. Existing package-lock.json edits and .vscode/ are unrelated and must remain unstaged. No configured-data migration has been run for checkpoint A.

The supplied M4A brief and the explicitly appended [planning audit](../product/m4a-planning-audit.md) are separate sources of work. Audit additions: durable retry identity for ambiguous create responses, independent resource budgets, legacy draft CAS preservation, transactional addition caps and full-horizon status/dependency reconciliation. These additions do not authorize AI, network hosting or later milestones. A pristine copy of the supplied prompt is retained outside Git.

## Checkpoint A — implementation

The old toggle belonged to the sidebar's heading, whose layout changed between expanded and compact states. It now belongs to AppHeader immediately before the inventory selector and reuses the existing cookie-seeded state; there is one toggle and a stable 44px target. Mobile navigation retains labels regardless of the remembered desktop state. Below 561px the desktop toggle is hidden, keeping navigation available and avoiding an apparent control with no mobile effect.

AddItemForm and ItemFilters were rendered as separate siblings. ItemFilters now accepts the Add Item launcher as its first action, keeping one flex-wrap region and persistent intrinsic controls. The Add Item dialog remains mounted in a portal: closing it preserves values and File state, while its hidden controls cannot enter toolbar geometry/focus queries. Clearing filters targets Search explicitly.

The final crop-dialog CSS set padding-bottom to zero and supplied a smaller independent footer inset. Dialog action rows now share frame inset tokens (20px desktop, 16px narrow), with bottom safe-area padding and an inner scroll region. Currency option text is ISO-only; localized longer names remain title/accessible context, without changing order or exact price semantics.

Checkpoint A verification: typecheck, lint, 71 unit tests across 13 files and the final production build pass. Two new Edge shell/footer scenarios pass on the final A source; four existing M3.4 UI/price/archive/cover regressions also passed during this checkpoint. The seven-width/five-locale geometry matrix passed. Footer checks model 125/150% effective CSS viewports; physical browser zoom, camera and touch hardware have not been tested. The existing Next.js ESLint-plugin detection warning remains. npm audit reports zero vulnerabilities. B/C/D/E remain pending.

The first concurrent local unit/browser run exhausted old fixture/startup budgets on a slow disk (a synthetic fsync measured about 179ms). This run is a failure, not a pass: expired async tests also interfered with following fixture state. Subsequent verification is serialized by suite, with explicit bounded SQLite fixture budgets (120s setup/cleanup and 30s ordinary tests). Assertion semantics and app durability settings are unchanged.

Visual inspection of the synthetic 360px shell caught an additional issue beyond box overflow: the old 166px language trigger reduced the inventory name to a few letters after adding the toggle. Narrow layouts now use a 60px flag/menu trigger with the localized language retained as accessible description/title; the inventory selector keeps useful width. This is an A1 acceptance correction, not a new product feature.
