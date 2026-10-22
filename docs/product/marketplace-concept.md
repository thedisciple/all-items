# Marketplace and resource-network concept

**Status: future product concept; no marketplace functionality in M2B.** monobazar is a reference for possible product paths, not an implementation or trust template.

## Core boundary

A private inventory item is never a public listing. A future user-initiated "Предложить к продаже" action may create a separate draft populated from approved fields. The owner reviews every field, photo, price, quantity, condition, and delivery option before publication. AI may propose a draft only from approved, verified facts; it must flag uncertainty, never invent specifications/provenance/condition, and never publish. A private `willing_to_sell` intent is not consent to publish.

Never expose by default: exact storage location, serial number, purchase history, internal notes, private photos, contact/address, full owned quantity, or private identity. Public seller identity must be separate from account identity and personal contact details.

## Opportunity set

| Opportunity | User value and proposed interaction | Dependencies and risks | Complexity / horizon |
|---|---|---|---|
| Convert inventory item to listing draft | Reuse reviewed title, description, selected photos, condition, category, quantity, price. | Accounts, distinct public schema, explicit consent, moderation, publication controls, data minimization. | High; after sharing foundations |
| AI listing-draft assistance | Offer editable copy and category suggestions, cite source item facts, mark unknowns. | Provider choice/BYOK or local model, consent, human review, factuality, cost, photo rights. | High; future AI |
| Listing quantity and reservation | Track owned, available, listed, reserved, sold, loaned, rented independently. | Transactional stock reservation, concurrent updates, cancellation/expiry and reconciliation. Never retrofit commerce quantities into owned stock. | High; marketplace |
| Fixed-price offers | Buyer submits structured offer; seller accepts, declines, or counters; optional messaging for context. | Auth, offer state machine, expiry, notifications, reservation semantics, abuse handling. Structured negotiation is a proposal; monobazar coverage confirms negotiation support for its tested seller scenario, not exact universal mechanics. | High; marketplace |
| Seller storefront and following | Public profile, shareable shop link, listed collections, optional follows and updates. | Public identity separation, moderation, privacy controls, spam prevention, notification settings. | High; marketplace |
| Auctions | Seller sets starting/minimum price and duration; valid bids resolve to a transaction under clear rules. | Atomic bid ordering, race/concurrency, fraud, anti-shill controls, deadline integrity, payment commitment, cancellation, disputes, identity. Three-day duration is a reported monobazar rule, not a requirement for All Items. | Very high; only after transaction base |
| Transaction trust and buyer protection | Explicit transaction states, authorization, fulfillment, receipt, release/refund, dispute and fraud report. | Verified identities, specialist legal/regulatory review, payment partner, customer support, operational reserves. Never build homemade escrow or imply bank-grade guarantees. | Very high; partner-dependent |
| Delivery and returns | Provider-neutral delivery options, pickup, label, tracking, notifications, returns. | Country coverage, carrier integrations, addresses/PII minimization, status reconciliation, support. | High; partner-dependent |
| Installment payments | Optional partner financing at checkout. | Licensed financial partner, local regulation, responsible disclosure. Not lending infrastructure in All Items. | Very high; partner-only |
| Professional makers and teams | Business storefront, sellable stock, catalog, roles, reservations, repeat customers, invoice integrations. | Business identity/legal checks, separate personal and professional inventory, role model, audit history, tax and invoicing considerations. | Very high; later business product |
| Charity listing/auction | Seller designates a verified recipient and tracks proceeds transparently. | Recipient verification, money flow, receipts, fraud review, legal obligations. | High; partner-dependent |
| Notifications and monetization | Transaction status, offers, optional listing updates; optional managed hosting/services. | Consent, quiet controls, privacy, support and anti-spam. The self-hosted personal inventory core remains useful and free; preserve GPLv3 and review license obligations for integrations. | High; only with marketplace |

## Design and rollout lessons

Launch reporting says monobazar beta scope was deliberately reduced to get a usable product to customers and collect feedback. For All Items, prioritize one narrow task-based slice at a time and validate it before expansion. Payment, delivery, identity, auctions, storefronts, and legal protections do not follow from copying marketplace screens.

## Open questions before any marketplace milestone

Who is the marketplace operator and in which jurisdictions? Which party handles payments, refunds, disputes, fraud, delivery, and user support? How are public listing photos selected and stripped of private metadata? How do reservations interact with local owned stock? What identity information is actually public? What does GPLv3 require for a given hosted or proprietary integration? These require legal, security, operational, and user research before architecture is committed.
