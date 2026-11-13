# P2 continuation checkpoint

> Historical engineering snapshot. Pending CI/exposure statements below describe the recorded milestone, not current installation state. See [ROADMAP](../../ROADMAP.md) and [release workflow](release-workflow.md) for current status. External phone access has subsequently been reported; full physical/security/Telegram acceptance remains separate. The sanitized M4C checkpoint passed GitHub CI in [PR #1](https://github.com/thedisciple/all-items/pull/1).


Historical checkpoint. The newer [P2 release handoff](p2-release-progress.md) and [validation ledger](p2-release-validation.md) supersede its continuation list.

Status: **candidate implementation complete; CI verification pending; no public/private-beta deployment is approved or live**. Starting Git commit: `f2df18c1a3c94065a4532f64fdf40bca67d1c7ef`. The user-supplied specification is the P2 private beta, Telegram OIDC and UX consolidation prompt attached in the conversation. Continue from the current checkout rather than assuming this document is the latest commit.

The owner requested short, coherent checkpoints because the session usage window was nearly exhausted. Use one primary agent. Preserve the pre-existing unrelated working-tree changes in `package-lock.json` and `.vscode/`. Builds and tests must use isolated installations; do not modify the owner's configured database through testing. Do not configure public DNS, router, firewall, tunnel, Telegram credentials or a non-loopback listener without the separate approval and safety gate.

## Completed checkpoint: UX

- `/` for an account with no inventories now uses the existing shell, brand, navigation geometry, account menu and language switcher. Unavailable routes are disabled labels, not navigable links. The empty state has one heading and one create action. All five local dictionaries are updated.
- Add Item's inherited `dialog-actions` top margin was the measured 16 px scroll-to-footer gap. The footer is flush with the body; normal body bottom inset remains for complete scrolling.
- Focused Edge: `npx playwright test e2e/p1_modal.spec.ts e2e/p2_empty_account.spec.ts --max-failures=1` passed 10/10. Earlier diagnostic runs failed on the newly added gap assertion and an incorrect test locator for the account summary; both causes were corrected before the successful run.
- `npm run typecheck`, `npm run lint`, `npm test -- --pool forks --maxWorkers=1` (25 files, 123 tests), and `npm run build` passed after the UX edits. The isolated production restart test also passed (1/1). Final P2 CI and security/device gates remain pending.
- Design evidence and limitations are in [p2-ux.md](../product/p2-ux.md). Synthetic screenshots: `%TEMP%\all-items-p2-empty-account-synthetic.png` and `%TEMP%\all-items-p1-modal-synthetic.png` (overwritten by the successful run).

## In-progress checkpoint: strict HTTPS proxy preparation

- Added explicit `https-proxy` mode requiring exact HTTPS origin, a 32-byte private proxy secret, pinned Host and forwarded scheme/port. Local mode remains loopback HTTP. Startup preflight rejects bad configuration before migration.
- Added security headers and disabled the shared Next image optimizer. A synthetic production HTTPS proxy test passed (1/1): authenticated login and Secure cookie, host/origin/forwarded-header rejection, direct-backend denial and optimizer denial. Caddy 2.11.9 validated the example configuration offline; no public listener or real certificate was installed.
- Added an outside-repository Windows runtime config template, production launcher with no-migration `-ValidateOnly`, [security checklist](p2-threat-model.md) and [deployment preparation](p2-deployment.md). The launcher passed a synthetic temporary config preflight on Windows PowerShell.
- `npm run typecheck`, `npm run lint`, `npm run build`, and the full one-fork unit suite (26 files, 126 tests) passed. Final device/security and OIDC gates remain.

## In-progress checkpoint: optional Telegram OIDC

- Added migration 0015 for indexed identity associations, invitation tokens and expiring one-use authorization flows. Only synthetic installations have applied it; the owner's configured database has not been migrated.
- Config-gated Authorization Code + PKCE/nonce with `openid-client` 6.8.9, exact Telegram issuer/endpoints, RS256/JWKS signature verification and validated subject. Unlinked identities cannot sign in. A single-use invite creates one non-admin account and identity together. Existing password users may reauthenticate, verify the Telegram subject, explicitly confirm/cancel in the same session, then password-confirm unlink. The strict session-cookie continuation page avoids relying on cross-site redirect delivery.
- Focused synthetic tests (7/7) cover config gating, invite replay/expiry/collision, link/unlink, signed token attack variants and additive migration preservation. The new tables initially failed the installation-backup allowlist; after updating it, backup/restore passed 10/10. The final full unit suite passed 133/133 across 29 files; typecheck, lint and production build passed. The synthetic Edge HTTPS proxy test passed (1/1); P1 authentication and five-locale empty-account tests passed together (7/7), Add Item modal localization passed (5/5), and the isolated production restart passed (1/1). CI remains pending; live BotFather login is untested and requires owner domain/credentials.
- See [Telegram runbook](p2-telegram.md) and [operator checklist](p2-operator-checklist.md). No public service or Telegram credentials have been configured.

## Remaining gates

1. Inspect staged files and preserve the owner's existing unrelated lockfile/.vscode changes. Commit/push the OIDC checkpoint and verify GitHub CI.
2. Before migrating the **owner's** installation, stop writers, verify a private backup and isolated restore, then compare pre/post rows, media hashes, SQLite integrity and foreign keys. Only synthetic installations have been migrated so far.
3. Independent security/deployment review, actual SBB/network facts, trusted domain/TLS, BotFather registration and live Telegram callback remain open. Physical Windows/Android/iOS camera, crop, draft, touch, zoom and media acceptance also remain open. No LAN/public endpoint or real testers may be invited until those gates and explicit owner approval.

At any continuation, inspect `git status`, this file and the P2 prompt before assuming the checkpoint is complete. Never treat local synthetic tests as a final public exposure approval.
