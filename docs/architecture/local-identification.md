# Optional local photo identification (M5A)

On an existing saved item, Identify offers editable suggestions against current values; Apply selected is the only write. This is an experimental visual hypothesis, never source verification. Ordinary inventory/photo/archive/backup workflows have no AI dependency. No migration, proposal database, cloud provider, model pull, background analysis or inventory-wide upload is added.

## Local setup and demo

Configure Ollama separately on `127.0.0.1:11434`, with an already installed local vision model. The app accepts no provider URL from configuration or clients; `/api/tags` and `/api/show` are checked before sending photos. Remote/non-vision models are refused. No downloads are initiated.

For development, set server environment `ALL_ITEMS_AI_PROVIDER=ollama` and `ALL_ITEMS_AI_MODEL=qwen3.5:4b` in an ignored private environment file or the current shell. Missing/invalid configuration hides Identify; provider failure leaves normal functions intact. HTTPS proxy mode disables this first slice, including its inference/apply routes. Do not expose Ollama to LAN or change beta runtime configuration.

For an isolated committed preview, use the same explicit isolated data selection in both commands and a separate browser profile:

```powershell
$m5aData = Join-Path $env:LOCALAPPDATA 'AllItems-M5A-Preview'
npm run preview -- --data $m5aData --port 3202 --ai-model qwen3.5:4b --owner
npm run preview -- --data $m5aData --port 3202 --ai-model qwen3.5:4b
```

The owner command is only for a new marked preview installation. Preview scrubs inherited AI/proxy/Telegram settings; only the explicit model option enables local inference. Open an item with saved photos, choose Identify, optionally select up to three photos/include saved brand/model/marking, review/edit fields, then Apply selected. Existing nonempty fields are unchecked by default. Accepted categories are **additions**, retaining existing/custom assignments. Visible marking is informational, never an automatic overwrite. Save/cancel unrelated normal item edits before applying.

## Security, resource and save boundaries

- Both POST inference and PATCH application require existing session, exact mutation Origin/Host and inventory ownership. Media must belong to that item/inventory; paths, URLs, uncommitted Blobs and client provider destinations are rejected.
- Input JSON: 8 KiB. At most three saved display derivatives, hard read cap 10 MiB/file, metadata-free JPEG re-encoding to 1024px/512 KiB each. No source originals, notes, stock/sale data or other items are sent. Context is optional.
- One private exclusive inference lock, no queue. Persistent existing SQLite throttle storage reserves six attempts/user and twelve/installation per fifteen minutes before file decoding. Failures consume attempts. A stranded `.ai-inference.lock` requires PID/inference inspection before manual removal, never automatic stealing.
- `/api/chat`: base64 images, `stream:false`, `think:false`, temperature zero, context 4096, at most 700 generated tokens and Zod-generated JSON schema. Request cap 2.2 MB, metadata/result bounds and ninety-second deadline/browser abort. No tools or arbitrary destinations. Provider cancellation is best effort; closing a request cannot prove immediate GPU termination. Ollama may retain the model for thirty seconds; actual resource use depends on its scheduler/other workloads.
- Strict versioned output allows unknown/uncertainty. Server provenance records model, photo IDs, generation time and optional-context use. Photos/prompts/model responses/private content are not logged. Provenance is ephemeral and is not an independently checked source.

Apply accepts only selected name/brand/model/description and additive canonical categories. It reuses `updateItem`, preserving marking, identification status, stock/type, exact historical price units, sale fields, gallery and memberships. A SHA-256 snapshot of item/categories/stock/media is compared **inside** the write transaction; concurrent edits and duplicate old-revision applications fail for review/retry. Client digests never grant authorization. The model never changes `source_verified`/`user_confirmed`. React escapes untrusted text, including labels printed in photographs.

The review preserves inputs and normal unsaved edits on failure, aborts inference on close/navigation, blocks concurrent normal form submission during apply and refreshes saved content after success. Gallery refresh does not remount the normal editor. Cancel has no item write. Lost responses after commit are ambiguous: stale-revision retry requires reload/inspection rather than assuming failure.

## Validation and remaining gates

Provider/domain tests cover missing/remote/non-vision models, malformed/oversized output, cancellation/deadline, hostile text, lock/budgets, selected authorized media, two users/Origin/CSRF, selective saves, stale revisions and unrelated-data preservation. The focused provider/domain plus affected item-service group passed 34 tests. `playwright.ai.config.ts` uses a **test-only preload** in new OS-temp data to emulate the fixed Ollama endpoint and exercise real UI/routes without Ollama. Its two production Edge scenarios passed, including all five 360px locale shells, reviewed application, stale/CSRF denial, reload and retained unsaved input. Native focus/dialog geometry and a synthetic 360px screenshot were inspected; physical devices remain untested. There is no production fake-provider flag. Run from one checkout/dependency tree; do not mix Playwright installations. `--headed` demonstrates the synthetic workflow. Generated reports/screenshots stay outside Git.

The explicit optional real check sets `ALL_ITEMS_OLLAMA_SMOKE=1` then runs `npx vitest run src/ai/vision-smoke.test.ts`. Ordinary tests/CI skip it. It sends one original synthetic equipment drawing to already installed 4B, never personal media. Measured local result: 78,260 ms including metadata/load/inference, valid structured vision response; Ollama reported 3,140,495,604 resident VRAM bytes on RTX A4000 (16,376 MiB total). Installed 9B was inspected but not inferred/benchmarked. This is not an accuracy or latency guarantee.

M4E beta blockers remain OPEN: unexplained isolated Playwright-server loss and observed incoming-cancellation ECONNRESET, independent security, physical Android/iPhone/networks, Telegram and reboot acceptance. No exception suppression, live promotion or merge occurs. This stacked PR targets unmerged M4E; after PR #1 merges, fetch/review current main and retarget to main without force-pushing published history. Resolve base differences through reviewed ordinary commits.

Future separate milestones: destination-specific consent for cloud/BYOK, durable provenance policy if justified, independently sourced datasheets, curation, projects, jobs and MCP. None is implemented here.

Transport references: official [chat API](https://docs.ollama.com/api/chat), [vision input](https://docs.ollama.com/capabilities/vision), [structured outputs/Zod](https://docs.ollama.com/capabilities/structured-outputs). These establish transport/schema behavior, not recognition quality.
