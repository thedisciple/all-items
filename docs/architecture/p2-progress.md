# P2 continuation checkpoint

Status: **in progress; no public/private-beta deployment is approved or live**. Starting Git commit: `f2df18c1a3c94065a4532f64fdf40bca67d1c7ef`. The user-supplied specification is the P2 private beta, Telegram OIDC and UX consolidation prompt attached in the conversation. Continue from the current checkout rather than assuming this document is the latest commit.

The owner requested short, coherent checkpoints because the session usage window was nearly exhausted. Use one primary agent. Preserve the pre-existing unrelated working-tree changes in `package-lock.json` and `.vscode/`. Builds and tests must use isolated installations; do not modify the owner's configured database through testing. Do not configure public DNS, router, firewall, tunnel, Telegram credentials or a non-loopback listener without the separate approval and safety gate.

## Completed checkpoint: UX

- `/` for an account with no inventories now uses the existing shell, brand, navigation geometry, account menu and language switcher. Unavailable routes are disabled labels, not navigable links. The empty state has one heading and one create action. All five local dictionaries are updated.
- Add Item's inherited `dialog-actions` top margin was the measured 16 px scroll-to-footer gap. The footer is flush with the body; normal body bottom inset remains for complete scrolling.
- Focused Edge: `npx playwright test e2e/p1_modal.spec.ts e2e/p2_empty_account.spec.ts --max-failures=1` passed 10/10. Earlier diagnostic runs failed on the newly added gap assertion and an incorrect test locator for the account summary; both causes were corrected before the successful run.
- `npm run typecheck`, `npm run lint`, `npm test -- --pool forks --maxWorkers=1` (25 files, 123 tests), and `npm run build` passed after the UX edits. The isolated production restart test also passed (1/1). Final P2 CI and security/device gates remain pending.
- Design evidence and limitations are in [p2-ux.md](../product/p2-ux.md). Synthetic screenshots: `%TEMP%\all-items-p2-empty-account-synthetic.png` and `%TEMP%\all-items-p1-modal-synthetic.png` (overwritten by the successful run).

## Remaining integrated milestone

1. Review P1 entry points and produce a concrete threat checklist; fix verified vulnerabilities. Audit current Next.js patch/security notices and lockfile using primary sources.
2. Design and implement exact, explicitly configured HTTPS proxy trust while preserving loopback mode. Add hostile-header/origin and legitimate proxied HTTPS tests. Build safe Windows/Caddy operation and network-choice runbook without exposing the owner installation.
3. Implement optional Telegram OIDC authorization-code/PKCE login with a maintained client, validated issuer/audience/signature/nonce, one-time flow state, invite-only account creation, explicit reauthenticated linking and safe unlink. Gate behind server-side credentials and a trusted HTTPS origin. Test with synthetic issuer/provider; no live Telegram success claim without owner configuration.
4. Add additive identity migration only after a verified owner backup and isolated rehearsal; compare old row/media fingerprints and integrity checks. Run complete unit, build, Edge and production restart gates, then GitHub CI.
5. Update operator, security, deployment, roadmap, changelog and user-facing instructions. Conditional home/SBB topology only after read-only facts; independent security and real-device gates remain before any public pilot.

At the next continuation, first inspect `git status`, the P2 prompt and this file; finish any uncommitted checkpoint and resume the next unchecked item. Never treat this progress note as a final P2 acceptance record.
