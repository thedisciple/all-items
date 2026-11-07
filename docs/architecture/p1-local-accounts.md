# P1 local accounts, upgrade and recovery

P1 is a local foundation, not an internet pilot or independent security audit. Keep the app bound to loopback. The [identity ADR](adr-p1-local-identity.md) maps resource boundaries and the [P2 gate](m4b-3-device-pilot.md) controls deployment.

## Fresh installation

Run `npm ci`, then the explicit `npm run db:migrate`. In a local interactive terminal run `npm run auth -- owner`: choose a unique username (3–64 ASCII letters/digits/dot/underscore/hyphen) and a password of 12–256 characters, entered twice without echo. Nothing creates a default password. Start with `npm run dev`, or build then `npm start`, and sign in at `http://127.0.0.1:3000`. If the installation is uninitialized or interrupted during bootstrap, login fails closed; repeat owner bootstrap only if no credential was committed. An initialized owner uses `reset`, not a second bootstrap.

## Existing installation

1. Stop app processes and other writers to this installation; loopback alone is not a writer lock. Keep the data directory outside Git.
2. With the matching pre-upgrade application version, run `npm run backup -- create`, verify the returned ID and run `npm run backup -- drill UUID`. Retain the pinned verified copy and isolated restore report. If backup, media verification, quiescence or restoration fails, do not migrate.
3. Apply `npm run db:migrate`. Startup also uses a verified pre-migration SQLite/media backup. Migration 0014 and its log entry commit together; a failed transaction rolls back. Compare old rows/counts and referenced-media hashes and check SQLite integrity/foreign keys. IDs, inventory numbers and historical dates are not rewritten.
4. Run `npm run auth -- owner`. All previously existing inventories belong to that original owner. There is no automatic ownership transfer based on a cookie or future account. Sign in and check representative items, sources, collections and exports before issuing accounts.

## Local administration

`npm run auth -- invite` creates a non-admin account without inventories. `reset` changes a credential and revokes that account's sessions; `revoke` revokes sessions without changing the password; `disable` disables an invitee and revokes sessions; `revoke-all` revokes every session. These commands require trusted local OS access and an interactive terminal; no email service, public registration/reset or admin HTTP provisioning endpoint exists. Do not share a terminal or capture password input. Accounts cannot browse each other's inventories; installation-admin status permits installation backups, not ordinary foreign inventory access. Inventory names need only be unique for their owner.

Sessions are opaque random bearer tokens, stored only as HMAC digests, with eight-hour absolute and 30-minute idle expiry. Page loads refresh activity; domain authorization remains read-only inside SQLite transactions. Pure non-page API traffic does not extend inactivity. Login creates a new token and caps concurrent sessions. Logout revokes the server token and clears selection/session cookies. Generic failures and SQLite-backed account/installation login budgets are local, not distributed rate limiting. A credential reset does not bypass an active login budget; wait for its window. If a session expires with an open editor, sign in as the same account in another tab before retrying; keep the original editor and its files open. Use strong unique credentials; MFA and recovery identity verification require separate work before broader use.

`ALL_ITEMS_ORIGIN` defaults to the exact loopback origin above. For port 3001, explicitly set it to `http://127.0.0.1:3001`. Plain HTTP is accepted only for loopback. Cookies are HttpOnly/SameSite Strict and Secure for an explicitly trusted HTTPS origin. Forwarding headers do not choose identity, client-address throttle buckets or transport; mismatching host/protocol/port and Forwarded are refused. This is not a reviewed reverse-proxy configuration. Private media uses controlled identifier routes; the shared Next image optimizer is unavailable. Private pages/archives/media use no-store responses.

## Restore, rollback and local secrets

Installation copies include private credential hashes and session records and must be protected as sensitive backups. ZIP revision 6 and older adapters contain no accounts, ownership, sessions, staging receipts or browser drafts. The 32-byte `auth-session-key` stays in the private installation directory and is deliberately excluded from installation/portable archives; a new isolated restore generates a new key and old browser tokens fail. Restrict the data directory's NTFS permissions to the owner/service identity; Unix key creation requests mode 0600. Local OS/browser-profile compromise is outside P1's account isolation boundary.

Rollback restores the verified pre-upgrade backup into a separate directory using its matching application version; never reverse SQL against live data. Current format-1 verification accepts the known migration-13 prefix and current migration-14 contract, retaining older recovery copies. No live-replacement restore command is provided. If deliberately reusing an installation key during a later manual restoration, revoke all sessions before serving. Password resets remain local and require no old browser session. Preserve source archives, migration backups, partial and pinned copies.

Browser drafts and View options remain inventory-scoped browser-local data. Close preserves work; intentional Discard removes that draft. A different account cannot navigate to or commit another owner's inventory, but a person with the same OS/browser profile can inspect browser storage outside the app. Use separate trusted browser profiles on shared computers. Physical camera/touch/zoom, assistive technology, real HTTPS and network deployment remain manual P2 acceptance.
