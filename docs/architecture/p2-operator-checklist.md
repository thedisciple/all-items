# First 5–10 testers: operator checklist

Status: **no-go for public or LAN access until separate owner approval and independent review**.

## Local same-PC rehearsal now

Use a separate installation so testers cannot affect the owner's inventory. In a fresh PowerShell window, from the repository:

```powershell
$env:ALL_ITEMS_DATA_DIR = Join-Path $env:LOCALAPPDATA 'AllItems-P2-Test'
npm run db:migrate
npm run auth -- owner
npm run auth -- invite
npm run dev
```

Choose an unused directory outside the repository; `owner` and `invite` prompt for usernames and hidden passwords. Give each tester only their own username/password through a private channel. Each tester opens `http://127.0.0.1:3000/login` **on that PC** in a separate browser/OS profile, signs in and creates their own inventory. The app binds to loopback; another device cannot use this address. Close the test server with Ctrl+C. For an account that should lose access, use `npm run auth -- revoke` or `npm run auth -- disable` in the same configured installation. These commands do not set up remote access.

## Remote private-beta gate

1. Read [P2 threat model](p2-threat-model.md), [deployment preparation](p2-deployment.md) and [Telegram setup](p2-telegram.md). Resolve open findings; document the actual SBB WAN/CGNAT, ISP policy, DNS, TLS renewal, PC uptime and chosen route without copying addresses or credentials into Git.
2. Stop writers; create and verify a private installation backup, then drill it in a new isolated directory. Preserve the pre-upgrade copy and compare old row/media fingerprints, SQLite integrity and foreign keys after migration 0015. Never trial the migration against the owner's installation from a test command.
3. Validate the private config, build the production version, test the exact proxy header/host/origin behavior and Secure cookies from a synthetic external browser. Confirm backup schedule, encrypted off-machine copy, health notifications, process restart/reboot and a recovery/rollback window.
4. Run physical Windows, Android and iOS tests on trusted HTTPS: camera permission/denial, file fallback, crop, multi-photo, touch/reorder, 360px/zoom, drafts after browser restart, keyboard/focus and private media. Record device/browser/version and result, without private item content.
5. If Telegram is enabled, register BotFather origin and callback privately and verify one live login only after the previous gates. Keep local password recovery ready. Create each invitation locally; deliver tokens/credentials via an owner-chosen private channel. Never use open signup or send secrets in group chat.
6. For a departing tester, revoke sessions with `npm run auth -- revoke` or disable with `npm run auth -- disable`; revoke an unused Telegram invitation separately. Verify their old session and Telegram login no longer access inventories. Rehearse a synthetic restore after outage before serving again.
7. Collect feedback without photos, addresses, item lists, account credentials or archive files. Ask for task, device/browser, approximate time, visible error key and steps; request private data only through a separately agreed secure process.

Only after a separately reviewed security/device result and explicit owner approval should networking be changed and invitations sent. A successful CI run alone does not open the gate.
