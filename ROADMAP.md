# Roadmap

See [the opportunity register](docs/product/opportunity-register.md) for detailed concepts, dependencies, risk, complexity, and priority. Checkmarks describe implemented and verified work only.

## M0 — Foundation and first working vertical slice

- [x] Next.js, TypeScript, Tailwind, SQLite, and Drizzle foundation
- [x] Local workspace and additive initial migration
- [x] Russian responsive inventory page and item creation
- [x] Persistence across application restarts
- [x] Focused validation tests and project documentation

## M1 — Inventory management

- [x] Full item CRUD and sequential inventory numbers
- [x] Stock entries, quantities, and multiple locations
- [x] Tracking modes, search, filters, sorting, and private sale intent

## M2A — Private photos and photo-first inventory

- [x] Validated local JPEG, PNG, and WebP input with server-side WebP normalization
- [x] Private image and thumbnail storage, controlled media routes, replace/remove lifecycle
- [x] Photo-first creation for unidentified objects and responsive photo rows/details

## M2B.1 — UX foundations, photo acquisition, and item workflows

- [x] Research documentation, UX principles, and reusable interaction patterns
- [x] Camera/file acquisition, preview, save feedback, retry, and replacement-safe media flow
- [x] Structured stock editor with computed totals and visible save/error states
- [x] Item summary, progressive detail, keyboard/focus, and 360px responsive improvements

## M2B.2 — Collections and navigation

- [x] Workspace-owned collections and many-to-many memberships
- [x] Collection create, rename, confirmed delete, counts, navigation, and scoped search/filter/sort
- [x] Add/remove membership without duplicating or deleting items and photographs

## M2C — Runtime stabilization, photo editing, and UX consolidation

- [x] Serialize item, stock, and collection data through explicit client-boundary DTOs; verify an existing item-detail route with photo, multiple stock rows, and memberships using an isolated data copy
- [x] Consolidate the detail view to one saved-photo viewer and add freeform crop, zoom, reposition, reset, cancel, and replacement-safe save behavior
- [x] Move item creation into a focused photo-first dialog and simplify inventory cards, counts, search, navigation, and metadata treatment
- [x] Add stable localized category keys while retaining legacy and custom category text
- [x] Add Russian and English dictionaries, explicit cookie preference, browser-language fallback, localized status/actions, and `html lang`
- [x] Expand search to inventory number, description, category, locations, and collection names; add regression coverage
- [x] Document category research and future crop-source, storage-status, and reduced-motion transition considerations

Visual camera/cropper acceptance on a physical device was unavailable in the development environment; server route, crop geometry, and automated regression coverage were verified.

## M3 — Portability and personal organization — NOT STARTED

- [ ] Structured import/export with image data, archive validation, and integrity checks
- [ ] Backup and restore workflow and guidance; draft recovery and unsaved-change behavior
- [ ] Flexible item attributes and portable image paths
- [ ] Favorites, pinned collections, recently used items, preferred view, and quick actions
- [ ] Smart filters, tags, saved searches, and inventory completeness indicators
- [ ] Optional organization goals based on actual progress
- [ ] Image optimization refinements and advanced multi-photo/batch workflows

## M4 — Quality and release — NOT STARTED

- [ ] Mobile UX refinement, accessibility, and security review
- [ ] Real task-based usability tests and interaction-count/form-completion measures
- [ ] Error-recovery, performance, responsive consistency, and microcopy reviews
- [ ] CI, synthetic-data screenshots, and v0.1 release preparation
- [ ] Optional authenticated LAN access only after server-side authentication and origin protections are complete

## Future AI — NOT STARTED

- [ ] Photo and multi-object identification with human-reviewed metadata proposals
- [ ] Preserve original markings; use cited, verified datasheet references
- [ ] Local Ollama, optional cloud providers, BYOK, and eligible ChatGPT integrations
- [ ] Inventory curator, DIY project discovery, compatibility analysis, missing-component identification, and MCP integrations

## Achievements & Guided Discovery — future concept only

- [ ] Optional local achievements, tiered progress, and an original achievement gallery
- [ ] User-defined goals, feature-discovery achievements, and useful data-quality measures
- [ ] Opt-out, privacy-first local calculation, and anti-manipulation rules
- [ ] Community comparisons only after multi-user support, with opt-in, transparent normalized metrics, adequate cohort sizes, and no raw-inventory disclosure

## Future advanced media and recovery

- [ ] Multiple photographs, reordering, batch acquisition, and multiple-object extraction
- [ ] Upload queue with cancel/retry, client-side compression, large-image handling, and resumable uploads where justified
- [ ] Efficient local thumbnails/caching and portable image bundles

## Future sharing and resource network

- [ ] Accounts, shared workspaces, family/team inventory, and explicit per-item visibility
- [ ] Shared-by-link items, resource requests, privacy-preserving matching, borrowing, lending, renting, and exchange
- [ ] Internal messaging and end-to-end-encrypted private synchronization, subject to security review

## Future marketplace — monobazar-inspired, not implemented

- [ ] Convert an inventory item into a separate listing draft; AI may suggest text but cannot invent facts or publish
- [ ] Strict public/private data boundary and quantity reservation separate from owned/available/reserved/listed/sold/loaned/rented stock
- [ ] Fixed-price listings, structured offers with accept/decline/counter, optional messaging, and transaction status
- [ ] Seller storefronts, shareable links, following, and optional notifications
- [ ] Auctions, competitive bids, settlement, cancellation, fraud and dispute handling
- [ ] Professional maker accounts, business storefronts, team-managed inventory, and seller verification
- [ ] Buyer protection, partner-based payments, delivery, tracking, returns, and optional installment partners
- [ ] Verified charity listings and transparent proceeds
- [ ] Optional managed hosting/marketplace monetization; keep the self-hosted personal core useful and free and preserve GPLv3
- [ ] Legal, regulatory, trust, privacy, identity, moderation, support, and payment-partner review before implementation

AI identification, marketplace, sharing, synchronization, achievements, rankings, analytics, payments, and transactions are future directions. M2B implements none of these.
