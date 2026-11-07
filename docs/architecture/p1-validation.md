# Pilot P1 validation

Starting main: `152ce3704656beba14a8600d325ac1aae306b3ec`. Checkpoint A was committed first as `bd96d38` (`fix: separate add-item dialog scroll and actions`). P1 remains local foundation; no public/LAN listener, proxy, tunnel, DNS change or real invitation was enabled.

## Automated evidence

- `npm run typecheck`, `npm run lint` and `npm run build` passed. The build did not open or migrate configured owner data.
- `npm test -- --pool forks --maxWorkers=1`: 25 files, 123 tests passed on Windows. Final focused credential/authority tests: 9 passed. Initial interrupted/timed-out diagnostic runs are not counted as successes; the final complete run used a suitable disk-work timeout and serialized files.
- Current Edge: all 76 distinct scenarios passed across recorded batches with synthetic users, isolated databases/media and real authentication. A JSON test-list continuation retained earlier successful scenarios rather than rerunning the whole suite after each old fixture correction. Every scenario has a successful result; none remains unexecuted. Reports, persistent profiles and screenshots stay outside Git. An aggregate `all-items-p1-edge-coverage.json` is written under the OS temporary directory.
- `npx playwright test --config playwright.restart.config.ts`: one production restart scenario passed. Explicit synthetic owner/tester setup, ordinary login, session persistence, foreign-media denial, scoped deletion, retained media and the final empty landing were checked on loopback with a new temporary installation.
- Interactive Windows CLI bootstrap was exercised against a separate synthetic installation. Both password prompts suppressed input echo. There is no production default password or environment/argument password bypass.

The authority matrix covers a migrated original owner plus two independent users; owned reads/writes and substituted workspace/item/collection/media/source/thumbnail identifiers; metadata/stock/categories, staging/receipts, ZIP/CSV/import, installation-admin controls, direct handlers and Server Actions. It also checks unowned-inventory denial, generic failures, session expiry/revocation/reset/disable, idle limits, persistent login budgets, wrong/missing origins and spoofed host/protocol forwarding, upload bounds, restored-key token invalidation and import ownership. Ordinary inventory access is isolated even from the installation admin.

Modal/browser coverage includes fixed header/footer with body-only scroll, final-field and Add photo visibility, 360/390/760px and desktop, five locales, reduced motion, keyboard focus, effective 125/150% viewports, safe Close/Discard, denied/quota browser storage, cross-tab revisions, actual headless browser-process restart with committed photo Blobs, pending crops, multi-photo order/primary and retry after lost acknowledgements. Simulated media streams, CDP touch and effective viewports are not physical camera/touch/zoom acceptance. A synthetic modal screenshot is retained as `all-items-p1-modal-synthetic.png` in the OS temporary directory.

## Upgrade and recovery evidence

Before changing configured owner data, the app listener was absent, a pinned private format-1 database/media copy was created and verified, and restore was rehearsed in a new directory. Migration 0014 was applied to that restored copy first, then the configured installation through the explicit migration command. Both retained byte-identical hashes of original table rows and referenced media, with SQLite integrity `ok` and no foreign-key violations. Private manifests, original-row hash comparisons and the after-upgrade verification report remain under the owner's data directory, not in this repository. The pre-P1 migration-13 copy was verified and restored again by current recovery code. No existing backup/archive was deleted.

Existing inventories are attached to the disabled original-owner identity. The owner must activate credentials interactively using `npm run auth -- owner`; no personal password was invented or recorded. The [account runbook](p1-local-accounts.md) explains installation, login, alternate local origins, invitation/reset/revocation, browser-profile trust and restoration.

## Remaining gate

No independent security audit, public HTTPS/proxy trust configuration, actual SBB/WAN/CGNAT/bandwidth measurement, Windows-service deployment or physical-device/screen-reader acceptance is claimed. The [P2 checklist](m4b-3-device-pilot.md) remains a no-go gate for exposure. GitHub CI must be checked for the final pushed SHA; the owner-facing report records its exact result and link.
