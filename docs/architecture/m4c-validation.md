# M4C validation and delivery

Date: 2026-11-13. Baseline: `dcbdcbbcdca007e5b0da91a04e1019cbf4c5a0e9`. Validation used an isolated worktree and synthetic installations. No schema migration, new index/dependency, live service change or external inventory-data upload was required.

## Delivered A–G

- A: full responsive brand, two direct mobile tabs, desktop collapse and matching 44px header controls; inventory Data is reached through inventory settings, with secured URLs retained.
- B: bounded centered crop viewport, intrinsic grid fixes, wrapping controls, safe handle margins and explicit 24px targets independent of production CSS order. Limited aspect/currency Popover API lists have keyboard/typeahead/Escape/outside dismissal and native fallback. Coarse-pointer phone intake opens the native picker directly; desktop webcam remains. Language menu is attached and viewport bounded.
- C: AppBrand on login/404; generic localized safe-return 404; legacy entity redirects resolve the actual owned inventory. Data actions use consistent controls and short format notes. Username restriction is intentional ASCII policy; no account format/credential changes.
- D: small localized footer with verified repository, CONTRIBUTING, GPLv3, development version/changelog links; no invented contacts. SQL COUNT + LIMIT/OFFSET, deterministic tie-breaks, 25/50/100 sizes, filters/history/clamping and allowlisted edit return queries. Members, candidates and cover photographs have bounded server queries rather than eager full-inventory props.
- E: focused UX issue and PR templates; existing CI retained. Personal development-tool setup instructions are excluded from the public repository.
- F/G: [implementation-ready bounded tasks](m4c-experiments.md), not runtime integrations. No autonomous research engine, WebMCP tools, testing flag, AI/GPU/cloud dependency or parallel MCP server added.

## Integration evidence

Runtime: Node 24.20.0, Next 15.5.29, Edge 158.0.4370.16 on Windows. Reused the installed dependencies through a worktree junction; no clean `npm ci` was performed against the committed lockfile. All fixtures/data/media/reports are synthetic and outside the repository. Production builds are local to the worktree.

| Check | Evidence |
|---|---|
| `npm run typecheck` | Passed; production build also checked types |
| `npm run lint` | Passed; no repeated standalone lint after test locator/CSS-only corrections |
| Unit gate | 136/137 initially passed in the persisted normal-pool report. The new security test compared an inventory-context DTO with a fuller fixture object; corrected its expected shape. Targeted `src/auth/security.test.ts`: all 8 passed. Combined coverage: all 137 tests across 30 files passed; unchanged green files were reused |
| Production build | Passed. Rebuilt only after the production crop test demonstrated a real 5px corner-target cascade defect; corrected build passed |
| Production Edge gate | All 30 distinct scenarios passed using the initial 26 green results and targeted retries. The corrected production crop build passed both mobile intake/geometry and desktop zoom/pan/handle resize/reset/output/viewer checks |
| Isolated production smoke/security | Production login/list/detail/Data/404 flows plus P1 auth/IDOR/origin/forged-action regressions and real local Caddy/TLS transport test passed; no Funnel was enabled |
| Mobile synthetic geometry | Five locales, widths 320/360/375/390/412/430/768/1440; three crop image shapes at 320x480, 390x760 and 768x430; source/draft/gallery recovery and currency keyboard dismissal checks |

Test corrections retained meaningful criteria: explicit combobox selectors replaced native-select assumptions, expected document 404s are distinguished from other resource failures, and currency navigation waits for its complete IndexedDB revision rather than an older name-only revision. The pagination test originally deleted directly through a second database client while app requests were still active and produced SQLITE_BUSY. It now exercises the actual confirmed UI deletion before checking page clamping; the subsequent production test passed. This is not a claim that arbitrary external concurrent SQLite writers are safe.

The first threads unit attempt exited without a usable summary and is not credited. A persisted JSON report was captured on the normal-pool retry; only its failed security file was rerun. The performance case was repeated alone with a verbose reporter because JSON reporting did not retain its console timings. No full unit or Edge suite was repeated after green results.

## Pagination measurement

10,000 synthetic items, deterministic equal timestamps, name sort and matching search; correctness compared ordered page IDs and total with the prior full-list query. Three warmups, 20 timed calls per variant, one local worker; timings include service authorization and result materialization. The reported median is the upper middle of 20 samples. Background validation and host load make these indicative local measurements, not an end-to-end mobile latency or service guarantee.

| Query | Upper median | p95 |
|---|---:|---:|
| Full list | 351.10 ms | 647.28 ms |
| Count + first 25 rows | 57.22 ms | 60.86 ms |

No speculative index was justified. Separate correctness fixtures cover 0, 1, 24, 25, 26, 51, 101 and 1,001 records, stable ties, categories/status/search, collection inclusion/exclusion, invalid parameters, final-page removal and foreign ownership.

## Remaining acceptance and safe handoff

Actual Android/iPhone camera permission, touch/pinch, OS Back, browser zoom/safe areas, external ts.net behavior and the specific historical iPhone 404 are **not verified by emulation**. Follow [the physical checklist](../product/m4c-device-acceptance.md). No live Telegram configuration was read or changed.

Production test logs contain aborted-connection ECONNRESET/uncaughtException messages during fast navigation. Client audits and subsequent requests pass and the server remains responsive, but this milestone does not establish their root cause or promise clean server logs. Retain an isolated runtime-diagnostics follow-up and review it with the P2 independent security/device gate before wider beta acceptance; do not hide it with a global exception handler.

Historical publication update: remote CI for the starting main commit is [successful](https://github.com/thedisciple/all-items/actions/runs/42483460850). M4D published the sanitized branch in [Draft PR #1](https://github.com/thedisciple/all-items/pull/1), whose initial checkpoint CI also passed. Consult that PR for the latest SHA/checks; local production evidence remains separate from CI and physical acceptance.

Next safe step: owner review of the committed worktree, then an explicitly approved maintenance/update window following the existing P2 runbook (stop writers, verified private backup/recovery readiness, promote the reviewed commit/build, restart deliberately). Then use synthetic invited accounts for the real Android/iPhone checklist and independent security review. Do not merge into the active checkout, restart services, enable/reconfigure Funnel or invite users automatically. AI/marketplace work remains deferred.
