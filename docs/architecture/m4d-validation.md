# M4D delivery and validation

2026-11-13. Starting main: `dcbdcbbcdca007e5b0da91a04e1019cbf4c5a0e9`; starting sanitized mobile branch: `2bcf570090ad36fe75699c630fc4b39ecee36355`. Delivery continues on `feat/m4c-mobile` in [Draft PR #1](https://github.com/thedisciple/all-items/pull/1). Main is not merged and live deployment is not changed. Latest commit/CI are available on that PR; this report is engineering evidence, not a deployment approval.

## Implemented

- Published M4C and synchronization rules (`105a7c6`, CI success), then preview/release operations (`d253033`) and readiness/recovery corrections (`dab523c`, CI success). The first operations CI found a TypeScript narrowing defect in the new test configuration; it was corrected and pushed, not hidden or bypassed. Subsequent receipt/TLS gates received focused verification and are included in the final PR checks.
- Public hygiene review excluded personal tool setup, continuation journals, live configuration, screenshots/media, databases/backups, generated builds and secrets. Previously removed personal instructions are absent from the new branch history. Owner-specific configuration/dry-run notes remain outside Git. Generic deployment templates, technical research and historical engineering evidence are retained.
- AGENTS requires meaningful checkpoint commits, push, one draft PR, actual SHA/CI reporting and explicit separation of push/merge/deploy. No completed checkpoint is silently local-only.
- ROADMAP is canonical: M0–M4C implementation complete, M4D release/beta workflow current, human-reviewed AI identification next, other opportunities future. Duplicate M3 status, obsolete archive revisions, already implemented account/backup claims and P2 CI/exposure wording were reconciled. Historical P1/P2 reports are labelled and preserved.
- `npm run preview`: committed SHA, independent production release/build/dependencies/data/port, scrubbed proxy/Telegram environment, explicit first-owner setup, safe build reuse and no rebuild of incompatible completed releases. `/api/health` exposes only version/validated revision, subject to exact-origin middleware; it is not a database-integrity or authorization health claim.
- `npm run beta`: status/dry-run, prepared backup/restore/migration drill, explicitly approved stopped-writer switch, matching snapshot/code rollback, and scoped stop-sharing. Private plans expire; operations are locked and journalled; unresolved interrupted switches remain latched. Code switches migrate new restored directories, never the original installation. No SQL reversal, silent merge or automatic retention is added.

## Local evidence

Node 24.20.0 and current Edge on Windows. Clean dependency installation/build in the isolated release used pinned Next 15.5.28. The active source checkout's different installed dependency tree was not reinstalled or replaced.

| Gate | Result |
|---|---|
| Typecheck/lint | Passed after focused fixes; the fresh isolated production build also checked types/lint |
| Full unit report | 149/149 tests, 34 files, JSON `success: true`; the Windows npm wrapper nevertheless returned exit 1 after writing the successful JSON. This discrepancy is retained as a runner limitation, not represented as a clean command exit. No complete local suite was repeated; Linux GitHub CI passed its normal test command |
| Focused operations | Real synthetic database/photo backup verification and durable restoration passed; mocked service deployment, approval/stale-plan refusals, migration failure, switch failure, rollback, origin environment, path/junction and lock checks passed |
| Later hardening | TLS/SNI/forward-target gate tests and immutable receipt reuse/refusal tests passed. The additional receipt case brings distinct unit coverage to 150; final GitHub CI runs the complete resulting tree |
| Production preview | Clean install/build and isolated migrations started the selected committed `dab523c` on an independent loopback port; login 200, expected SHA/version, spoofed forwarded Host 403. Exact receipt reuse completed in 215 ms without rebuilding |
| Production Edge/security | 9/9 passed on the isolated built release: minimal health response/origin, real two-user sessions/IDOR/forged-action and origin/CSRF boundaries, five-language empty accounts, and real isolated Caddy/TLS transport/media/archive checks |
| Real installation assessment | Read-only service/configuration/tunnel inspection and dry-run completed. Existing app remained running, Caddy remained stopped. Runtime configuration preflight passed; no service/XML/Funnel/runtime data was changed |

The initial preview attempt targeted the checkpoint whose CI had found the configuration typing error; it was stopped before serving. The corrected checkpoint was built and tested instead. Dependency preparation disables npm audit/fund network work and prefers the existing cache; CI/security alerts remain a separate repository responsibility. This is not a dependency-validation bypass.

## Real activation remains blocked, deliberately

The existing synthetic-beta installation predates managed release receipts and its observed build SHA cannot be proven from checkout HEAD. It also lacks the new verified synthetic identity marker, has a stopped Caddy adapter, and does not currently report the required pinned Funnel topology. A ready candidate/green CI does not repair those conditions. No marker/state was invented and no exposure was enabled. The private exact dry-run records these blockers.

Use the one-time **approved baseline-adoption gate** in [release workflow](release-workflow.md) before using the managed deployment command. It preserves the prior service configuration/code/build/data, verifies a complete backup and restore, and establishes a genuinely running receipt-bearing baseline. The subsequent prepared plan and `--approve INSTALLATION_UUID` are explicit operator actions, not permission granted by this report. Private runtime secrets/ACLs need separate operational recovery; they are intentionally outside backup manifests/Git. Restoring installation data invalidates browser tokens when session-key material is regenerated.

Actual Android/iPhone, different networks, OS camera/permissions/touch/zoom/Back, live Telegram invitation/callback, service reboot/autostart, external certificate reachability and independent security acceptance remain manual. Follow [the single device/multi-user checklist](../product/m4c-device-acceptance.md). Mocked service transitions and local TLS are not evidence of a live deployment. The earlier aborted-connection server-log observation remains an isolated diagnostics follow-up.

Next: review/approve the PR and baseline-adoption procedure, complete beta acceptance, then scope initial AI identification and human-reviewed enrichment. No AI, WebMCP, autoresearch, marketplace or shared-inventory implementation was started in M4D.
