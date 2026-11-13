# M4C physical-device acceptance

This is also the short M4D multi-user beta checklist; run it against the exact approved release SHA. Automated browser/mock-service evidence never substitutes for physical Windows/Android/iPhone acceptance.

- Use two independent synthetic users on Windows, Android and iPhone, on different home/mobile networks. Record pass/fail per device and SHA without recording credentials or personal media.
- Verify valid HTTPS/certificate and session persistence/re-login after restart. Review service autostart and rehearse a cold reboot during an approved window; do not silently change service startup modes.
- If Telegram is actually configured, verify signed-provider login, a single-use invitation (second use denied), password fallback and explicit linking/unlinking. Configuration presence alone is not acceptance; no real users are invited by automated checks.
- Confirm a verified full backup, isolated restored migration and matching code/data rollback before broader tests. Preserve test edits in a separate backup when rolling back. Collect only error class, time, route shape and sanitized synthetic screenshots privately.

Status: pending owner acceptance on actual Android and iPhone. Edge mobile emulation, synthetic camera results and local TLS/proxy simulation are separate evidence, not physical camera/touch/pinch/Back or external Funnel acceptance. The owner previously reached the ts.net site; M4C does not redeploy that site.

Use synthetic accounts, inventories and photos. Record device, OS, browser/version, locale, commit and viewport/orientation. Keep private screenshots outside the repository. Follow the existing [P2 first-beta security/publication gate](../architecture/p2-first-beta-runbook.md) and [threat checklist](../architecture/p2-threat-model.md); this checklist grants no permission to enable Funnel, change services or invite users.

- Login/logout, expired session, password fallback and return navigation.
- Full All Items brand; Inventory/Collections directly reachable; inventory/account/settings controls consistent. Check 320–430px, portrait/landscape, safe areas, browser text zoom and keyboard. No horizontal page/dialog scroll.
- Inventory Data accessible through its settings; account settings stay user-scoped; installation backups appear only for admin.
- One Add Photo action opens the native acquisition choices on phones. Test single/multiple library files, camera permission granted/denied, cancel and retry. Desktop retains its webcam option.
- Portrait/landscape/extreme photo ratios: centered crop, pan, touch handles, zoom, rotate, aspect choices, reset, Done/Cancel on short screens. Verify saved output and original source preservation, multi-photo ordering and primary photo behavior.
- Close/reopen/reload draft with text, photo Blobs and pending crop; restore/discard and storage failure retain recoverable input. Do not assume an uncommitted write survives an immediate crash.
- Aspect/currency menus use the theme where Popover API exists; native fallback still works. Test arrow keys, Enter, Escape, outside tap, device Back, screen reader and focus return. Open language menu beside its trigger.
- Russian, English, Ukrainian, Serbian Latin and Simplified Chinese labels, errors, footer and 404. Preserve user-entered language.
- Download ZIP, CSV without photos, preview/import into a new inventory; verify media and counts. Confirm admin backup actions remain private.
- Pagination at 25/50/100, search/category/status/sort reset to first page, Back/Forward, collection members and candidates, remove the last row on a final page, return from editing.
- Two users/inventories: foreign item/media/Data/archive URLs remain inaccessible; switching selected inventory never grants access. Follow origin/CSRF regression procedure without real data.
- Unknown/stale links show branded, generic localized 404 and safe return. Record the exact preceding action/path shape for the reported iPhone incident without sharing private route IDs publicly.

The specific historical iPhone 404 has not been reproduced. A demonstrable legacy-bookmark defect was fixed (entity links resolved only against the original inventory); physical confirmation is still required. ASCII usernames are an intentional account-identifier policy, not demonstrated PowerShell encoding corruption. User-entered item names remain Unicode. Run `npm run db:migrate` explicitly before account bootstrap; do not change existing usernames or recreate accounts to diagnose this policy.
