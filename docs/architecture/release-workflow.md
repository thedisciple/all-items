# Preview and synthetic-beta release workflow

ROADMAP.md is the canonical milestone status. A **push** publishes a feature branch; a **merge** changes main; a **deployment** switches a running installation. Completed checkpoints are pushed to one draft PR with actual CI evidence. No merge, service change, exposure or invitations are implied by a green CI check.

## Local preview

From the selected checkout: `npm run preview`. On the first installation only, explicitly create its account with `npm run preview -- --owner`, then run the normal command. No default credentials or HTTP registration are added. Use a separate browser profile because cookies are host scoped, not port scoped.

The launcher resolves committed HEAD (or `--revision SHA`), prints the SHA/URL/data path, and builds an isolated detached release outside the source repository. `npm ci` and production build run only when the exact SHA/lockfile/Node-major receipt is missing. Required Node/npm and network dependency downloads must be available. Uncommitted source edits are never included. Each release has its own dependencies/build; it cannot alter an active development checkout. Generated receipts identify a locally trusted build, not a cryptographic remote attestation.

Default port is 3200; choose `--port 3201` when occupied. Optional `--checkout`, `--data` and `--root` accept explicit paths outside Git. Defaults use private application-data storage, separate from the personal AllItems directory. Existing unmarked directories are refused, not adopted or migrated. The launcher creates a synthetic identity marker only in a new directory. `--check-only` reports configuration without starting, building or migrating. Preview startup scrubs inherited All Items proxy/Telegram settings and NODE_OPTIONS, validates loopback configuration, and migrates only the marked preview installation. Ctrl+C stops that preview. A phone cannot use the PC's loopback URL.

## Beta status and preparation

Copy `deploy/beta.example.json` **outside Git**, replace its generic paths/origin, assign a fresh installation UUID, and protect the private directory with owner/service-account ACLs. Retain the existing exact HTTPS origin and Caddy shared assertion in the existing private runtime.env. Do not paste secrets into JSON examples, arguments, issues or logs. Git contains no machine-specific launchers, live hostname, runtime configuration or acceptance credentials.

- Status: `npm run beta -- status --config C:\private\beta.json`
- Exact non-mutating assessment: `npm run beta -- dry-run --config C:\private\beta.json --sha FULL_SHA`
- Prepare: `npm run beta -- prepare --config C:\private\beta.json --sha FULL_SHA`

Prerequisites are deliberately fail closed: synthetic-only config and matching `synthetic-installation.json` marker; canonical non-linked paths outside repository/personal data; verified deployed release receipt/state; pushed feature-branch HEAD with an open draft PR and successful checks; matching HTTPS runtime configuration; already running app/Caddy and Funnel pinned to the loopback Caddy adapter. Preparation never turns on sharing. A checkout HEAD is **not proof of the deployed build SHA**. Status reports unknown when the installation predates receipts.

Prepare builds the candidate in a separate release directory, creates and fully verifies a pinned installation backup, restores a new isolated copy, runs candidate migrations there, and checks integrity/foreign keys/media. It creates a private plan valid for 30 minutes. It does not stop services or mutate live database rows. Immutable referenced media are verified by the existing backup service; changing/missing media aborts. The completed initial backup/drill is checked again through a fresh stopped-writer snapshot during actual deployment.

## First adoption of an older installation

An older service pointing at a mutable checkout must not be silently labelled as a verified release. If state/marker/receipt is absent, deployment refuses. After explicit owner approval, an operator must: attest that the selected installation contains only synthetic records; stop all writers in a maintenance window; preserve original service XML/runtime configuration/code/build/data privately; verify a full backup and restore drill; build and review a receipt-bearing baseline in the release root; switch to that baseline under the existing P2 gate; verify its `/api/health` revision and synthetic access checks; then record `state.json` with `current: {sha, release, data, runtime}` matching the actual running baseline. Preserve the old configuration and snapshot for manual recovery during adoption. Do not invent an old build SHA or copy an unverified receipt onto an existing build.

This one-time transition is intentionally operator approved, not an automatic command. All subsequent prepare/deploy/rollback operations use the recorded managed releases. The current milestone tests that managed workflow against mocked services and real synthetic backups, and provides a read-only dry-run for an older installation; it does not perform initial adoption or claim an unverified legacy rollback is ready.

## Approved update and rollback

- Deploy a reviewed plan: `npm run beta -- deploy --config C:\private\beta.json --plan C:\private\releases\plans\PLAN.json --approve INSTALLATION_UUID`
- Roll back: `npm run beta -- rollback --config C:\private\beta.json --approve INSTALLATION_UUID`
- Stop this application's sharing adapter: `npm run beta -- stop-sharing --config C:\private\beta.json --approve INSTALLATION_UUID`

The approval UUID is a deliberate installation confirmation, not an authorization secret. Execute only in an approved maintenance window after stopping unrelated CLI/backup writers. Administrative Windows service permissions are still required; the tool cannot elevate itself. The supported adapter is WinSW + PowerShell. It preserves service identity/account/environment, switches only the app's working directory/launcher/runtime path, and never restarts Caddy or unrelated services. Backend stays 127.0.0.1:3000, Caddy 127.0.0.1:8787; Funnel topology/origin/secret remain unchanged. No public dev server or extra deployment is created.

After stopping the app, deploy creates a **fresh** verified backup, restores into a new durable installation directory, migrates only that copy, and generates a private runtime file pointing to it. The previous installation is never overwritten or migrated. Only after switching/startup, version and two-user access probes does the tool save release state. Failures restore the previous service pointer; if recovery cannot be verified, the private recovery latch blocks subsequent operations. Operation locking refuses concurrent release commands. Crash/stale lock or recovery latch requires journal/service inspection before explicit manual clearance; never delete it blindly and retry. No automatic file retention deletes releases/backups.

Rollback preserves the current test installation in another verified backup and restores the **matching previous snapshot and code** into a fresh directory; it never reverses SQL or overlays an existing database/media tree. Newer test edits are retained in the preservation backup, not silently merged. Installation backups exclude session-key material, so restored browser tokens become invalid; users log in again with preserved account credentials. Private runtime secrets stay outside backup manifests/Git and require separate protected operational recovery.

`releaseRoot/private/acceptance.json` must contain exactly two independent synthetic users with username/password and their known inventory/item/media UUIDs (`users: [{username,password,inventory,item,media}, ...]`). Create these explicitly through ordinary authenticated workflows; never use personal accounts. The post-switch probe verifies the HTTPS certificate, expected SHA, both logins, owned item/media/archive access and foreign-resource denial. It records no credentials/media/response bodies. Telegram configuration is not equivalent to live provider acceptance; use the device checklist when enabled.

Stopping sharing stops only the configured Caddy adapter; it does not reset the node's entire Funnel configuration or stop the backend. DNS/Funnel registration may remain, but the app route should be unreachable; verify externally. Do not assume autostart: inspect service start modes and rehearse restart/reboot separately. Follow [P2 security and exposure gates](p2-first-beta-runbook.md) and [device/multi-user acceptance](../product/m4c-device-acceptance.md). Observed aborted-connection server-log messages remain a runtime-diagnostics follow-up, not suppressed exceptions.
