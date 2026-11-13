# Preview and synthetic-beta release workflow

ROADMAP.md is the canonical milestone status. A **push** publishes a feature branch; a **merge** changes main; a **deployment** switches a running installation. Completed checkpoints are pushed to one draft PR with actual CI evidence. No merge, service change, exposure or invitations are implied by a green CI check.

## Local preview

From the selected checkout: `npm run preview`. On the first installation only, explicitly create its account with `npm run preview -- --owner`, then run the normal command. No default credentials or HTTP registration are added. Use a separate browser profile because cookies are host scoped, not port scoped.

The launcher resolves committed HEAD (or `--revision SHA`), prints the SHA/URL/data path, and builds an isolated detached release outside the source repository. `npm ci` and production build run in a fresh release directory; an exact SHA/lockfile/Node-major receipt reuses the completed build. An incompatible or unreceipted completed build is refused: select a new `--root` instead of rebuilding a potentially running release in place. Required Node/npm and network dependency downloads must be available. Uncommitted source edits are never included. Each release has its own dependencies/build; it cannot alter an active development checkout. Generated receipts identify a locally trusted build, not a cryptographic remote attestation.

Default port is 3200; choose `--port 3201` when occupied. Optional `--checkout`, `--data` and `--root` accept explicit paths outside Git. Defaults use private application-data storage, separate from the personal AllItems directory. Existing unmarked directories are refused, not adopted or migrated. The launcher creates a synthetic identity marker only in a new directory. `--check-only` reports configuration without starting, building or migrating. Preview startup scrubs inherited All Items proxy/Telegram settings and NODE_OPTIONS, validates loopback configuration, and migrates only the marked preview installation. Ctrl+C stops that preview. A phone cannot use the PC's loopback URL.

## Beta status and preparation

Copy `deploy/beta.example.json` **outside Git**, replace its generic paths/origin, assign a fresh installation UUID, and protect the private directory with owner/service-account ACLs. Retain the existing exact HTTPS origin and Caddy shared assertion in the existing private runtime.env. Do not paste secrets into JSON examples, arguments, issues or logs. Git contains no machine-specific launchers, live hostname, runtime configuration or acceptance credentials.

- Status: `npm run beta -- status --config C:\private\beta.json`
- Exact non-mutating assessment: `npm run beta -- dry-run --config C:\private\beta.json --sha FULL_SHA`
- Prepare: `npm run beta -- prepare --config C:\private\beta.json --sha FULL_SHA`

Prerequisites are deliberately fail closed: synthetic-only config and matching `synthetic-installation.json` marker; canonical non-linked paths outside repository/personal data; verified deployed release receipt/state; pushed feature-branch HEAD with an open draft PR and successful checks; matching HTTPS runtime configuration; already running app/Caddy and Funnel pinned to the loopback Caddy adapter. Preparation never turns on sharing. A checkout HEAD is **not proof of the deployed build SHA**. Status reports unknown when the installation predates receipts.

The Funnel gate checks port 443, the exact allowed hostname, TCPForward to 127.0.0.1:8787, matching TLS termination/SNI, and absence of a PROXY protocol header. These are defined in the [official Tailscale serve configuration](https://github.com/tailscale/tailscale/blob/main/ipn/serve.go); unfamiliar layouts fail closed rather than being rewritten automatically.

Prepare builds the candidate in a separate release directory, creates and fully verifies a pinned installation backup, restores a new isolated copy, runs candidate migrations there, and checks integrity/foreign keys/media. It creates a private plan valid for 30 minutes. It does not stop services or mutate live database rows. Immutable referenced media are verified by the existing backup service; changing/missing media aborts. The completed initial backup/drill is checked again through a fresh stopped-writer snapshot during actual deployment.

## First managed installation: prefer a separate clean beta

For an unidentified legacy installation with no tester data requiring transfer, choose **Option B**. Do not mark or migrate its data, copy a fabricated SHA or write managed state on its behalf. These commands operate on fresh generated directories; existing services/runtime and personal data are untouched during preparation:

```powershell
npm run beta -- prepare-new --config C:\private\beta.json --sha FULL_SHA
npm run beta -- accounts-new --config C:\private\beta.json --plan GENERATED_PLAN --account owner
npm run beta -- accounts-new --config C:\private\beta.json --plan GENERATED_PLAN --account invite
npm run beta -- preview-new --config C:\private\beta.json --plan GENERATED_PLAN
```

Prepare requires the pushed green-CI draft-PR candidate, builds an immutable release, migrates **new empty marked data only**, writes a separate private runtime, and performs a verified pinned backup and isolated restore drill. It does not require an already working Caddy/Funnel or an old baseline. The returned plan expires after seven days. Account commands are interactive with hidden passwords; no default account, real invitation or shared admin is installed. Create two ordinary synthetic accounts, then populate their separate inventories/photos in the staged loopback preview (3201, separate browser profile). Stop the preview before release operations; it holds the operation lock. Save their acceptance fixture privately in the existing format below. No Telegram is enabled in local preview.

After independent review and **specific owner approval** of installation/service/exposure actions, verify the exact existing hostname, Caddy and pinned Funnel configuration through the P2 gate. This tool does not start Caddy or enable Funnel. Only then:

```powershell
npm run beta -- activate-new --config C:\private\beta.json --plan GENERATED_PLAN --approve INSTALLATION_UUID
```

Activation requires no existing managed state, a matching synthetic marker, pushed green candidate and already running correctly configured Caddy/Funnel. It privately preserves the original service XML/runtime (legacy SHA stays unknown), journals/latches before stopping writers, snapshots staged edits, restores **another new durable data copy**, then switches the app. Only successful HTTPS/version/two-user acceptance permits the first managed state. The old data/runtime remain unchanged and no old SHA is inferred. There is **no previous managed release** immediately after this transition; normal matching-code/data rollback becomes available after the next managed update.

On failed activation, the exact checksummed service XML is restored and the previously running legacy app is restarted. Its unknown identity prevents automatic acceptance: the recovery latch stays set for explicit inspection. On interruption/reboot, inspect the private `clean-stopping`/`clean-switching` journal, service XML and actual health before resuming. Preserved `private/legacy-UUID/recovery.json`, `service.xml` and `runtime.env` provide manual legacy recovery, never a fabricated managed receipt. In an approved recovery window, stop the app, invoke the existing service adapter's `restore-configuration` with the captured XML and hash, restore its previous Running/Stopped state, and inspect it. Preserve new staged/restored data and backup copies for investigation. Do not blindly clear stale locks/latches or overwrite state. Local administrator/service permissions are still required.

Status independently probes backend, loopback adapter and external HTTPS, and compares observed SHA and service XML binding with recorded state. It reports actual `deployedSha`, `recordedSha` and `checkoutSha` separately; unavailable/unknown/mismatch/proxy/remote/failure/recovery states cannot become generic success. Health is a version/transport check, not full database integrity or physical acceptance. The acceptance record is explicitly cached. Emergency `stop-sharing` bypasses state/data/operation-lock reads so corrupt state or a stranded lock cannot prevent closing Caddy; journal failure is reported. It does not clear recovery state or reconfigure Funnel.

## Alternative: verified adoption of an older installation

An older service pointing at a mutable checkout must not be silently labelled as a verified release. If state/marker/receipt is absent, deployment refuses. After explicit owner approval, an operator must: attest that the selected installation contains only synthetic records; stop all writers in a maintenance window; preserve original service XML/runtime configuration/code/build/data privately; verify a full backup and restore drill; build and review a receipt-bearing baseline in the release root; switch to that baseline under the existing P2 gate; verify its `/api/health` revision and synthetic access checks; then record `state.json` with `current: {sha, release, data, runtime}` matching the actual running baseline. Preserve the old configuration and snapshot for manual recovery during adoption. Do not invent an old build SHA or copy an unverified receipt onto an existing build.

This alternative adoption procedure remains manual and operator approved. Prefer the clean commands above when preserving an old tester database is unnecessary. Subsequent prepare/deploy/rollback operations use genuinely recorded managed releases. Mocked service transitions and real isolated backups do not establish live activation or legacy rollback acceptance.

## Approved update and rollback

- Deploy a reviewed plan: `npm run beta -- deploy --config C:\private\beta.json --plan C:\private\releases\plans\PLAN.json --approve INSTALLATION_UUID`
- Roll back: `npm run beta -- rollback --config C:\private\beta.json --approve INSTALLATION_UUID`
- Stop this application's sharing adapter: `npm run beta -- stop-sharing --config C:\private\beta.json --approve INSTALLATION_UUID`

The approval UUID is a deliberate installation confirmation, not an authorization secret. Execute only in an approved maintenance window after stopping unrelated CLI/backup writers. Administrative Windows service permissions are still required; the tool cannot elevate itself. The supported adapter is WinSW + PowerShell. It preserves service identity/account/environment, switches only the app's working directory/launcher/runtime path, and never restarts Caddy or unrelated services. Backend stays 127.0.0.1:3000, Caddy 127.0.0.1:8787; Funnel topology/origin/secret remain unchanged. No public dev server or extra deployment is created.

After stopping the app, deploy creates a **fresh** verified backup, restores into a new durable installation directory, migrates only that copy, and generates a private runtime file pointing to it. The previous installation is never overwritten or migrated. Only after switching/startup, version and two-user access probes does the tool save release state. Failures restore the previous service pointer; if recovery cannot be verified, the private recovery latch blocks subsequent operations. Operation locking refuses concurrent release commands. Crash/stale lock or recovery latch requires journal/service inspection before explicit manual clearance; never delete it blindly and retry. No automatic file retention deletes releases/backups.

Rollback preserves the current test installation in another verified backup and restores the **matching previous snapshot and code** into a fresh directory; it never reverses SQL or overlays an existing database/media tree. Newer test edits are retained in the preservation backup, not silently merged. Installation backups exclude session-key material, so restored browser tokens become invalid; users log in again with preserved account credentials. Private runtime secrets stay outside backup manifests/Git and require separate protected operational recovery.

`releaseRoot/private/acceptance.json` must contain exactly two independent synthetic users with username/password and their known inventory/item/media UUIDs (`users: [{username,password,inventory,item,media}, ...]`). Create these explicitly through ordinary authenticated workflows; never use personal accounts. The post-switch probe verifies the HTTPS certificate, expected SHA, both logins, owned item/media/archive access and foreign-resource denial. It records no credentials/media/response bodies. Telegram configuration is not equivalent to live provider acceptance; use the device checklist when enabled.

Stopping sharing stops only the configured Caddy adapter; it does not reset the node's entire Funnel configuration or stop the backend. DNS/Funnel registration may remain, but the app route should be unreachable; verify externally. Do not assume autostart: inspect service start modes and rehearse restart/reboot separately. Follow [P2 security and exposure gates](p2-first-beta-runbook.md) and [device/multi-user acceptance](../product/m4c-device-acceptance.md).

For bounded isolated production diagnostics, set `ALL_ITEMS_E2E_CHECKOUT` to the immutable built release, `ALL_ITEMS_E2E_SHA` to its full SHA, and optionally `ALL_ITEMS_RUNTIME_DIAGNOSTICS` to an `all-items-*.jsonl` file in OS temporary storage; run `npx playwright test --config playwright.operations.config.ts`. The test-only monitor observes aborted requests and uncaught exceptions without consuming/replacing error handlers. One scenario separates settled requests, deliberate disconnects, rapid navigation and settled recovery. Expected browser cancellation is caught immediately; settled failures and page errors remain failures. Do not classify arbitrary ECONNRESET as benign: correlate phase/timestamps/server frames and verify subsequent requests. A short successful run cannot establish absence of leaks or explain every historical error. Keep raw logs/reports private, and report any unreproduced case explicitly.
