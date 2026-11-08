# P2 first-beta hosting decision

Reviewed 2026-11-08. Decision: **retain the existing Windows/Node backend; prepare Tailscale Funnel through a loopback Caddy adapter**. No Site, external endpoint, account or DNS configuration was created.

## Sites feasibility gate

Classification: **needs an invasive storage/runtime port; unsuitable for this beta**. This is a source/runtime compatibility assessment, not a successful deployment test.

Official [Sites guidance](https://learn.chatgpt.com/docs/sites?surface=web) requires a compatible runtime and describes plan allowances and future metering. [Storage guidance](https://learn.chatgpt.com/docs/sites/data-and-connections) uses D1 for records and R2 for uploads. The installed Sites workflow requires a Worker ES module with a fetch handler for server applications, rather than `next start`.

| Existing requirement | Port required |
| --- | --- |
| Local libSQL file, transactions and additive migrations | D1 access/migration/transaction compatibility |
| Node filesystem, immutable private media and staging receipts | R2 object lifecycle, authorization and recovery |
| sharp native processing and short-lived SQLite child processes | Compatible image processing and worker execution |
| Next server actions, HMAC sessions and strict proxy origin | Runtime/build and authentication acceptance |
| DB + media installation backups, journals, isolated restore | A new coordinated hosted recovery implementation |

No equivalent combined data/files restore was verified. Enterprise network integration is not assumed available to this account. Site audience access would not replace in-app Telegram identity or inventory ownership. Sites is not a DNS alias or tunnel to this PC. A future optional hosted edition would move data to managed infrastructure and require a separate privacy review and two-user/media/archive/recovery acceptance. Keep portable ZIP and a verified installation backup as exit assets; do not upload owner data for a feasibility test.

As documented on the review date, Sites hosting is free through 2026-12-31; metering is planned from 2027-01-01 above included plan allowances. Exact account entitlement and future bills were not verified. Do not base this beta on permanent free hosting.

## Selected first remote route

Use `browser → Funnel TLS on the Windows node → Caddy 127.0.0.1:8787 → Next 127.0.0.1:3000`. Caddy pins the public host/scheme/port and supplies the existing private proxy assertion. No app/storage rewrite or public backend listener is needed.

[Funnel](https://tailscale.com/docs/features/tailscale-funnel) provides a public tailnet-domain URL and managed TLS with non-configurable bandwidth limits. Application authentication remains mandatory; testers need only a browser. [Personal pricing](https://tailscale.com/pricing) is currently $0 for eligible non-commercial use; confirm this project's eligibility in the owner's account. App invitees are not tailnet members. Budget additionally for PC power, connectivity and protected off-device backups; no domain/VPS purchase is required for this route.

The URL depends on the retained node name/tailnet; renaming or removing either requires an origin/callback update. Dependence on Tailscale's control plane, DNS, relays and account policy is accepted only for the first pilot. TLS terminates on the PC; keep local identities and secrets restricted. Future exit: own domain and controlled public IP/Caddy, or a reviewed VPS/WireGuard relay under CGNAT. See [the executable first-beta runbook](p2-first-beta-runbook.md).
