# P2 release continuation

> Historical engineering snapshot. Pending CI/exposure statements below describe the recorded milestone, not current installation state. See [ROADMAP](../../ROADMAP.md) and [release workflow](release-workflow.md) for current status. External phone access has subsequently been reported; full physical/security/Telegram acceptance remains separate. The sanitized M4C checkpoint passed GitHub CI in [PR #1](https://github.com/thedisciple/all-items/pull/1).


Starting HEAD: `6e75361bdb9d30501e42ad26a7f2b617652655fe` (2026-11-08). Preserve the pre-existing unstaged package-lock deletions and untracked `.vscode/`.

Scope: hosting compatibility decision, specified UX/copy, lightweight backup listing, loopback Funnel adapter/runbook, one final integration gate. No public exposure or real database migration is authorized by this prompt.

- Sites source/runtime assessment complete: invasive port; retain self-hosting.
- Implementation and synthetic benchmark complete: warm authenticated Data response 1,773.56 ms → 55.38 ms on the same 3-copy synthetic installation.
- Local final gate complete; [validation and exact run counts](p2-release-validation.md) record results and failed-subset-only retries. Do not rerun unchanged green suites. Commit/push and final CI remain to be recorded in the delivery report.
- On continuation, read the delivered HEAD's GitHub CI result rather than restarting local validation. Hosting decision checkpoint: `7d92ec4`; UX/performance checkpoint: `b59482d`.
- External Funnel connectivity, live Telegram and physical mobile acceptance remain NOT TESTED until owner setup and separate exposure approval.
