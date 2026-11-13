# P2 release preparation: evidence and handoff

> Historical engineering snapshot. Pending CI/exposure statements below describe the recorded milestone, not current installation state. See [ROADMAP](../../ROADMAP.md) and [release workflow](release-workflow.md) for current status. External phone access has subsequently been reported; full physical/security/Telegram acceptance remains separate. The sanitized M4C checkpoint passed GitHub CI in [PR #1](https://github.com/thedisciple/all-items/pull/1).


Date: 2026-11-08. Starting HEAD: `6e75361bdb9d30501e42ad26a7f2b617652655fe`. No internet pilot is live. The delivered commit/CI links are in the release handoff; this record describes the bounded local gate.

Logical checkpoints: `7d92ec4` records the hosting decision; `b59482d` implements UX/performance. The commit containing this validation adds the adapter, acceptance fixture and deployment handoff. Inspect CI for the delivered HEAD; do not restart local green suites merely to refresh this record.

## Delivered versus pending

| Area | Result |
| --- | --- |
| Sites | Source/runtime assessment: invasive storage/runtime port, rejected for this beta; no Site created or data uploaded |
| First URL strategy | Retained Windows node + Funnel TLS-terminated TCP + real Caddy loopback adapter + existing Next backend; runnable private-config/stop/rollback instructions prepared |
| UX | Empty header label removed; language in Account Settings after login and directly available before login; compact explicit default view; stored preferences and all five dictionaries preserved |
| Data latency | Lightweight recorded-completion metadata, truthful not-rechecked state and visible metadata failures; creation/Verify/restore/retention retain full verification |
| Authentication/privacy | Existing password/Telegram invitation system preserved; two non-admin users isolated through proxied HTTPS; admin-only backup UI and forged action denial verified |
| External Funnel | **NOT TESTED**; CLI/account setup and exposure permission unavailable; no public URL configured |
| Live Telegram | **NOT TESTED**; owner BotFather registration/private credentials and controlled external approval required |
| Physical devices/services | **NOT TESTED**: actual phone camera/touch/zoom, Windows service installation/cold reboot, real certificate renewal and uptime |

No new migration or dependency upgrade was introduced. Node.js 24, Next.js 15.5.29, existing openid-client 6.8.9, Caddy 2.11.9 and Edge 158.0.4370.7 were used locally. The owner's configured DB/media were never opened or migrated. All data fixtures and backup/restore directories were isolated under OS temporary storage. The unrelated 56 lockfile deletions and `.vscode/` were preserved outside the commits.

## Measured Data navigation

Same synthetic Windows installation: 8 photo items, 3 immutable installation copies, 25 files and 4,622,736 bytes per copy. Before: old production build at starting HEAD. After: release production build. No owner data or external requests.

| Measurement | Before | After |
| --- | ---: | ---: |
| `listBackups` source benchmark | 1,920.98 ms | 23.97 ms |
| Authenticated Data HTTP request, first sample | 1,805.91 ms | 65.77 ms |
| Authenticated Data HTTP request, warm sample | 1,773.56 ms | 55.38 ms |

The HTTP measurement includes complete server response retrieval, not visual browser rendering. It is one small synthetic workload, not an SLA. `scripts/benchmark-backup-list.ts` creates a new guarded temporary fixture; passing its returned directory reuses that synthetic fixture, and `--page` measures the completed production build on loopback 3118. Normal listing now reads only manifest/COMPLETE evidence; it does not inspect SQLite or hash media. Full verification remains essential before recovery. Data creation/verification still revalidates the route, and ordinary users never list installation backups.

## Check ledger and retry discipline

| Check | Runs and result |
| --- | --- |
| Explicit local typecheck | 2 attempts: initial test-fixture env annotation error corrected; retry passed. Production build also checked types; CI checks the final commit |
| Explicit local lint | 1, passed |
| Complete local unit suite | 1, 29 files / 133 tests passed |
| Changed localization subset | 1 additional run, 3/3 passed after adding encoding-loss detection; no second complete unit run |
| Production build | 2, both passed; the second was necessary after fixing new strings damaged by the Windows shell pipe |
| Changed-flow production Edge gate | One 13-case run: 11 passed, 2 failed. Only failed subsets retried: 2, 2, 1 and 1 cases. All 13 distinct cases ultimately passed; no second full Edge gate |
| Production restart | 1, passed; authenticated ownership, private media, deletion and final empty landing survived restart |
| Caddy | Initial offline config parse passed; functional Host test then found and corrected a real configuration defect. Final real-adapter HTTPS test passed |

Initial Edge failures included stale default-view expectations/ambiguous locators and an invalid attempt to reconstruct hydrated Server Action transport from DOM inputs. The final test captures and blocks the actual synthetic admin action request, then replays it with the ordinary user's session; denial and unchanged backup storage are asserted. The Host failure was real: a site address containing `127.0.0.1` also installed a Host matcher. The final adapter uses an explicit loopback `bind` and a separate exact canonical Host check.

Covered: five-language account/empty screens and locale persistence; existing item data under language changes; collection error fields; committed Add Item draft and literal currency after visiting Account Settings; per-inventory view persistence/reset/360px bounds; backup create/verify/refresh; two-user direct item/media/source/cover/ZIP/CSV denial; forbidden backup action; exact proxy assertion, Host/origin/forwarding and direct-backend checks; Secure/HttpOnly/SameSite cookies; real HTTPS file upload/crop/save; login throttling. Camera permission denial was explicitly mocked. Existing signed-provider invitation expiry/replay/collision/link/unlink checks were included in the full unit suite, not repeated as a live Telegram test. The complete historical Edge battery was intentionally not rerun.

Observed diagnostic: rapid synthetic navigation/browser closure produced Next `aborted` / `ECONNRESET` server messages, including its `uncaughtException` log label. The production process continued serving and restart acceptance passed; this is not a claim of a clean server log or independent abort/DoS review. Build also reports the existing missing Next ESLint plugin warning. Neither warning was hidden or used to claim external readiness.

## Remaining go/no-go and exact owner actions

1. Owner installs/signs in to Tailscale, retains the node name/tailnet and confirms plan eligibility; sets exact private runtime/adapter config. In BotFather, register the origin and exact `/auth/telegram/callback`, storing Client ID/Secret only locally. Follow [the runbook](p2-first-beta-runbook.md); no secrets belong in chat.
2. After a separate security review, owner explicitly approves the controlled synthetic external test. Start app/adapter, enable Funnel with the documented command, test from another network and physical devices, then perform one real Telegram invite acceptance and two-user check. Invite private records only after recording success, verifying backups/off-device recovery and supervised restart.

Open risks: public attack/DoS surface despite app invitation gating; installation-wide rather than distributed abuse controls; trusted local OS/config/secret boundary; CSP inline-script/style limitations retained from P2; actual Funnel account/policy/bandwidth/provider dependency; actual BotFather callback acceptance; device/storage/reboot/renewal behavior and independent review. The Tailscale Personal plan may be $0 only if this usage is eligible non-commercial use; power, connectivity and off-device backups remain additional costs. No domain/VPS purchase is needed for the selected first route.

Stop: Ctrl+C for foreground sharing, or `tailscale funnel --bg --tls-terminated-tcp=443 off` for the documented persistent setup, then stop Caddy/Next and confirm the URL is unreachable externally. Disable a tester to block future logins; session revoke alone still permits a new login. Rollback uses a verified backup drilled into a new directory with its matching app version, after stopping sharing/writers; never overwrite the live DB or reverse migrations. Full commands and troubleshooting are in [the first-beta runbook](p2-first-beta-runbook.md).
