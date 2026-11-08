# First remote private beta: Windows + Funnel

Prepared 2026-11-08. **External connectivity and live Telegram are NOT TESTED. No endpoint has been published.** The local acceptance gate uses synthetic data, a simulated TLS terminator and the real Caddy adapter; it cannot prove Tailscale/account/ISP/device behavior. Complete the security review and obtain explicit owner approval before any Funnel enable command below.

## Chosen route and cost

`browser → HTTPS :443 on the retained Tailscale node → raw HTTP 127.0.0.1:8787 (Caddy) → 127.0.0.1:3000 (Next production)`.

[Funnel requirements](https://tailscale.com/docs/features/tailscale-funnel): supported Tailscale CLI, MagicDNS, HTTPS certificates and the Funnel node permission. Traffic has non-configurable bandwidth limits; this is a small pilot, not an availability/bandwidth SLA. Testers use a browser and are not added to the tailnet. A reachable public WAN IP, router port forwarding and a purchased domain are unnecessary for this topology. [Personal pricing](https://tailscale.com/pricing) currently starts at $0 for eligible non-commercial use; owner must confirm eligibility. PC power, Internet and off-device backup storage are additional costs. See [hosting decision and exit strategy](p2-hosting-decision.md).

Funnel exposes a public service: invitation gating belongs to All Items, not the tunnel. Keep passwords, OS access, Tailscale control and private runtime files restricted. Public DNS/certificates reveal the node hostname; choose a non-personal name. TLS terminates on the PC; database/media/backups remain there. Local administrators can inspect them. Tailscale DNS/control/relay outages, account restrictions and bandwidth caps can interrupt service.

## 1. Owner setup, without publishing

1. Install the official [Windows Tailscale client](https://tailscale.com/download/windows), sign in to the owner's intended account and retain this PC/node. Review its plan and policy. These are owner account/device actions; this milestone did not perform them.
2. In a local PowerShell window, inspect `tailscale version`, `tailscale status` and `(tailscale status --json | ConvertFrom-Json).Self.DNSName`. Copy the exact DNS name without the trailing dot. Retain the node name and tailnet; changing either requires a new app origin and Telegram callback. Do not paste account/network details into Git.
3. Obtain vetted Caddy 2.11.9 or a separately validated compatible release. Put it in a fixed local tools directory. Disable PC sleep while plugged in; verify Windows/Tailscale restart behavior. Do not open backend/adapter firewall ports or add a router forward.
4. Choose **new isolated** directories outside the checkout for the synthetic pilot data and access-restricted config, for example `%LOCALAPPDATA%\AllItems-P2-Synthetic` and `%LOCALAPPDATA%\AllItems-P2-Config`. Create them explicitly. Restrict config/data to the intended Windows identities. The pilot must not use the owner's original installation.

## 2. Private configuration and production preparation

Copy `deploy/runtime.env.example`, `deploy/funnel.env.example` and `deploy/Caddyfile.funnel.example` into the private config directory as `runtime.env`, `funnel.env`, `Caddyfile.funnel`. Edit privately:

- Both env files: `ALL_ITEMS_DOMAIN=<exact retained node DNS name>` and the **same** private `ALL_ITEMS_PROXY_SECRET` (32 cryptographically random bytes encoded base64url).
- App only: `ALL_ITEMS_ORIGIN=https://<exact name>`, `ALL_ITEMS_PROXY_MODE=https-proxy`, `ALL_ITEMS_DATA_DIR=<absolute synthetic directory>`.
- Optional Telegram Client ID/Secret: only `runtime.env`, after BotFather setup. Never give these to Caddy or paste values into chat, Git, screenshots or command arguments.

Generate the proxy secret locally, for example `node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))" | Set-Clipboard`; paste into the two private files, then clear the clipboard. Never commit those files. Keep the env templates' allowed keys; no wildcard origins or auth switches.

In the repository terminal, explicitly target the synthetic installation (replace the example directory if different):

```powershell
$env:ALL_ITEMS_DATA_DIR = Join-Path $env:LOCALAPPDATA 'AllItems-P2-Synthetic'
npm run db:migrate
npm run auth -- owner
npm run auth -- invite
npm run auth -- invite
```

Create one synthetic admin and two different ordinary password users. Passwords are entered hidden. New users receive no inventory. Keep a working admin password for recovery. The same explicit data directory must be used for all auth/backup CLI commands. For an **existing** installation, first stop writers, create/verify a backup and drill it in isolation before any pending migration; never test migration against the owner's original DB.

Use the verified release checkout/build. If source/dependencies changed, run `npm ci` and `npm run build` once with an isolated `ALL_ITEMS_DATA_DIR`; the build does not migrate configured app data. Do not deploy `npm run dev`. Paths below are examples: replace them with the actual private config/tools paths.

```powershell
powershell -NoProfile -File scripts/start-production.ps1 -ConfigPath C:\private\runtime.env -ValidateOnly
caddy validate --config C:\private\Caddyfile.funnel --adapter caddyfile --envfile C:\private\funnel.env
```

Confirm port 3000 is free first. If the owner's original local app is running there, deliberately stop that app before this synthetic rehearsal; do not kill unrelated Node processes or reuse its data directory. In separate terminals start the synthetic app, then the loopback adapter:

```powershell
powershell -NoProfile -File scripts/start-production.ps1 -ConfigPath C:\private\runtime.env
```

```powershell
caddy run --config C:\private\Caddyfile.funnel --adapter caddyfile --envfile C:\private\funnel.env
```

No public listener is created by these two commands. Caddy has no admin API or automatic HTTPS in this adapter config. It rejects an incorrect Host, replaces forwarding assertions and sends the secret only to loopback Next. Verify with `Get-NetTCPConnection -State Listen -LocalPort 3000,8787`: both listeners must be `127.0.0.1`. A direct browser request to Next in proxy mode must return 403. A request to the adapter with an incorrect Host must return 421. Do not weaken these checks to make a URL work.

## 3. Controlled external gate — requires approval

Only after local acceptance, separate security review and explicit owner approval, run from an Administrator console:

```powershell
tailscale funnel --tls-terminated-tcp=443 tcp://127.0.0.1:8787
```

This [documented TLS-terminated TCP mode](https://tailscale.com/docs/reference/tailscale-cli/funnel) forwards the original HTTP request to Caddy; it does not point Funnel at Next. Do not enable PROXY protocol; the HTTP adapter does not parse it. Complete any Tailscale enablement prompts deliberately; they may change tailnet permissions/certificates. Confirm the displayed HTTPS URL exactly matches `ALL_ITEMS_ORIGIN` before sending requests. Stop if it differs.

From a separate mobile/home network using synthetic accounts, check login, exact URL/no certificate warning, Secure/HttpOnly/SameSite session cookie, private-page authentication, upload/file fallback, camera permission/denial, crop, ZIP export/import and two-user denial of foreign items/media/source/cover/archive. Ordinary users must not see or invoke installation-backup administration. Check wrong-origin writes, host/header spoofing, throttling, invite expiry/replay and disable/revoke. Record only synthetic results. A local secure-context result is not physical camera acceptance.

After a successful controlled test, persistent sharing uses:

```powershell
tailscale funnel --bg --tls-terminated-tcp=443 tcp://127.0.0.1:8787
tailscale funnel status
```

`--bg` resumes sharing after node restart; keep the node/tailnet for URL stability. Supervise Next and Caddy with the existing WinSW templates: point the Caddy XML to `Caddyfile.funnel`/`funnel.env` and its private working directory. Keep Manual startup until approved; then verify one cold reboot with the dedicated non-admin service identities and persistent Tailscale service. The milestone did not install services or change startup policy.

## 4. Telegram and first friend

In the owner's @BotFather mini app: select bot → Login Widget → Allowed URLs. Register both `https://<stable-name>` and `https://<stable-name>/auth/telegram/callback`. Store the issued Client ID/Secret privately in `runtime.env`; restart the app. See [the existing Telegram runbook](p2-telegram.md) and [official instructions](https://core.telegram.org/bots/telegram-login). Actual acceptance of the selected `ts.net` URL by BotFather remains unverified until owner setup.

In the explicitly configured synthetic/pilot installation:

```powershell
npm run auth -- telegram-invite
```

Enter a new username. Privately send the friend the **one stable login URL** and the one-use code (valid one hour). They choose their language on login, open the invitation section, enter the code, authenticate with Telegram, click Continue, and must see an empty account. They create an independent inventory and upload synthetic photos first. A bare Telegram login must not create an account. Give each tester a separate invitation. Existing password users link Telegram from Account Settings with password reauthentication and explicit confirmation/cancel; password fallback remains available. For a Telegram-only user needing fallback, the owner can run `npm run auth -- reset` locally to add a password.

For two testers, copy one synthetic item's/media/cover/archive URL from A and try it while signed in as B; expect 404, with no inventory content or installation backups. Also test direct forged actions with the existing automated gate. Do not use actual private item links in reports.

## Stop, recovery, monitoring and troubleshooting

- **Stop sharing immediately:** Ctrl+C for a foreground Funnel, or `tailscale funnel --bg --tls-terminated-tcp=443 off` for persistent sharing; inspect `tailscale funnel status`. Stop Caddy and Next too. Verify the old URL is unreachable from the external device. Do not use `funnel reset` if this node has unrelated shared services.
- **Remove one tester:** `npm run auth -- disable` blocks future logins and revokes sessions. `npm run auth -- revoke` only invalidates existing sessions; an enabled user can sign in again. Cancel an unused code with `npm run auth -- telegram-invite-revoke`. Verify the old session and new login after disabling.
- **Backup before real data:** create a verified installation copy, run `npm run backup -- verify UUID` and `npm run backup -- drill UUID`, retain an encrypted off-device copy and a matching release checkout. Use [scheduled backup operations](local-backups.md); verify job failures and free disk space. `backup list`/Data metadata is not a fresh integrity check. Session keys remain installation-local; regenerating them invalidates sessions.
- **Rollback:** stop sharing and all writers; retain the failed directory as evidence; drill the verified pre-update copy into a new isolated directory with the matching application version, inspect hashes/integrity/foreign keys, then explicitly select it in private config. Never overwrite the running DB or reverse migrations. Reopen only after the acceptance gate.
- **Monitoring:** privately check service exits, disk space, backup job/result and the canonical `/login` response/certificate. Notify the operator on failure. Do not record passwords, tokens, requests containing item data, or response bodies. Keep process logs private/rotated; no access logging is enabled by the adapter.
- **403:** exact app origin/Host, private shared secret and forwarded port must match. **421:** wrong public Host. **502:** app/adapter stopped or wrong loopback port. **No external URL:** Tailscale account/permission/certificate, node online, policy or bandwidth issue. **Telegram error:** Allowed URLs, credentials, callback, time and fresh invitation; use the password fallback. **Camera missing:** trusted HTTPS, browser permission, supported physical device; file upload must still work.

Go/no-go: external HTTPS, live Telegram, physical mobile camera/touch/zoom, service reboot/renewal and independent security review remain open until recorded on the actual approved topology. Do not invite real private records on the strength of local tests alone.
