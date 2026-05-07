# SWS Attention Protocol — Pricing
## Three price points. What each means. How to defend each on a call.

**Who this is for:** Stephen. When a buyer asks *"so what does this cost?"* — which they will, usually in the first twenty minutes — you need a specific number and a defensible reason for it. Not "it depends." Not "we'll send a quote." A number, an anchor, and a ramp.

**How to use it:** Read §1 to understand the three pricing axes. Memorize the three headline numbers in §2. Read §3 when you need to explain what's included at each tier. Read §4 when the buyer pushes on price; read §5 when they ask *"can we start smaller?"* Read §6 before a call where the buyer's procurement team will be on the line.

**Freeze rule:** Same as the study guide.

**Working assumption:** All numbers below are *draft price points we'll stand behind in conversation,* not a published price list. You have latitude to move within the ranges below based on strategic value. Do not move outside them without writing down the reason.

**Last updated:** 2026-04-24. Cross-checked against `YC_S26_APPLICATION_DRAFT.md:150` and `docs/technical-faq.md:209`.

---

## Table of contents

1. The three pricing axes (why there are three, not one)
2. The headline numbers (memorize these)
3. What's included at each tier
4. Anchor comparables — what the buyer's existing stack costs
5. The pilot-to-production ramp
6. Objection handling
7. Where the floor is (do not cross without a reason)

---

## 1. The three pricing axes — why there are three, not one

Different buyers see receipts as different economic objects. A single pricing model confuses everyone. Three clean models, each matched to a buyer shape:

| Axis | Who it's for | What the buyer is buying | Unit of measure |
|---|---|---|---|
| **Per-credential** | Credentialing networks (Credly, Accredible, OpenBadges issuers) | A verified-attention receipt attached to each credential they issue | One signed receipt = one unit |
| **Per-seat / per-month** | Regulated enterprises (Pfizer, Merck, compliance-heavy orgs) | Ongoing compliance coverage across a trained population | One active learner seat × one month |
| **Platform flat fee** | Platforms & MECs (PlatformQ, Medscape, EthosCE, Cadmium) | The SWS integration as a platform feature they re-sell to their own customers | One annual contract, tiered by activity volume |

Pick the axis that matches what the buyer wants to defend in their own P&L. A pharma compliance lead wants per-seat because that's how their training budget works. A credentialing PM wants per-credential because that's their product's unit economics. A platform owner wants flat because they need predictable COGS to price their own product around it.

You do not pick randomly. You pick the axis that matches the buyer's mental model. If you pick wrong, the price number will sound wrong even when it's right.

---

## 2. The headline numbers (memorize these)

These are defaults. Move within the range based on strategic value; do not move outside without a reason.

### Per-credential

- **Pilot:** $0–$5,000 one-time integration fee. Receipts free during pilot. Joint case study is the non-cash consideration.
- **Production:** **$0.50–$2.00 per issued credential**, tiered by annual volume.
  - 0–10,000/year: $2.00 / credential
  - 10,001–100,000/year: $1.00 / credential
  - 100,001–1,000,000/year: $0.50 / credential
  - >1,000,000/year: custom, floor $0.25

### Per-seat / per-month

- **Pilot:** $5,000–$25,000 flat for a 60-day pilot on a single named module, capped at ~500 seats.
- **Production:** **$3–$8 / active seat / month**, tiered by total seats.
  - <1,000 seats: $8 / seat / month
  - 1,000–10,000 seats: $5 / seat / month
  - >10,000 seats: $3 / seat / month, floor $2 at >100,000 seats

### Platform flat fee

- **Pilot:** $0–$10,000 for a technical-integration pilot on one activity or feature, co-marketing allowed.
- **Production:** **$30,000–$250,000 / year** platform license, tiered by total activities × throughput.
  - Starter (up to 50 activities/year, up to 100,000 receipts/year): $30,000 / year
  - Growth (up to 500 activities, up to 1M receipts): $100,000 / year
  - Enterprise (unlimited activities, up to 10M receipts): $250,000 / year
  - Above enterprise: custom

These ladder into roughly the same ARR shape on any one buyer, so the axis is about buyer comfort, not revenue optimization.

---

## 3. What's included at each tier

Same stack, different commercial shape. The product doesn't change.

**Every tier includes:**
- SWS SDK (`src/sdk/attention-protocol.js`, `src/sdk/receipt-composite.js`, `src/sdk/attention-signer.js`, `src/sdk/verifiable-credentials.js`, `src/sdk/xapi-adapter.js`, `src/sdk/open-badge.js`)
- Published JWK (`/.well-known/attention-pubkey.json`) and signing-authority DID
- Ed25519-signed receipts with seven-layer attestation bundle (env gate, 23-signal behavioral composite, composition integrity, honeypot, consent, signature, OpenTimestamps + RFC 3161 timestamp)
- xAPI 1.0.3 adapter, OpenBadges 3.0 AchievementCredential emission, W3C VC Data Model 2.0
- Evidence kit (`dist/evidence-kit.zip`) with sample receipts, verification walkthroughs, compliance matrix, security architecture doc
- Offline verification via `verify.html` browser utility — no vendor involvement at verification time

**Pilot tier adds:**
- Direct integration support from Stephen (email + ≤2 scoping calls)
- Joint case study at pilot completion (unless buyer explicitly opts out)
- Named-module or named-activity scope with agreed success criteria (see `docs/pilot-success-criteria.md`)

**Production tier adds:**
- SLA: 99.5% verification-endpoint availability. Receipt generation is 100% client-side so the endpoint SLA is on JWK retrieval only, not receipt issuance.
- Signing-key rotation kit with 7-day grace window on the old key (`scripts/rotate-signing-key.js`, `rotation-staging/ROTATION_PLAN.md`)
- Quarterly receipt-format compatibility test against the buyer's ingestion pipeline
- Dedicated Slack/email channel during business hours

**Enterprise-specific (per-seat and Platform tiers):**
- SOC 2 Type II gate — production expansion contingent on completion or on an explicit risk-acceptance memo signed by the buyer's security team
- Self-hosted signing-authority option: $5–15K one-time integration engineering to stand up inside the buyer's infrastructure (`docs/technical-faq.md:209`)

---

## 4. Anchor comparables — what the buyer's existing stack already costs

When a buyer flinches at your number, the next sentence should locate your price next to something they're already paying. Memorize these:

- **Proctorio / ProctorU / Respondus LockDown:** remote-proctoring platforms priced at **$10–25 per proctored session** for enterprise deployment. [VERIFY — proctoring vendors don't publish list pricing; this is triangulated from RFP responses and academic procurement records.]
- **BioCatch enterprise behavioral biometrics:** deployment pricing is per-MAU and runs **low-single-digit dollars per monthly active user** at bank scale, five-figure monthly minimums. [VERIFY]
- **DocuSign enterprise:** **$40+ per user per month** at enterprise tier, plus per-envelope fees at the high end. [VERIFY]
- **Accredible / Sertifier (credentialing):** **$1–3 per credential** at enterprise tier depending on volume. [VERIFY — competitor public pricing is thin; triangulated from published case studies.]
- **Cornerstone / SAP SuccessFactors (LMS):** **$5–15 per user per month** at enterprise tier for the LMS, with compliance modules as add-ons. [VERIFY]

The one-sentence frame that lands on every anchor: *"We price at or below the vendors they're already buying to answer a question we answer better."*

---

## 5. The pilot-to-production ramp

Three phases. Named success gates between each. Do not let a buyer skip from pilot to enterprise without the scoping call in the middle — the scoping call is where SOC 2 and security review get resolved, and skipping it will kill the deal in procurement.

| Phase | Duration | Price | What exits this phase |
|---|---|---|---|
| **Scoping** | 2–4 weeks | $0 | Signed pilot MSA, agreed success criteria (`docs/pilot-success-criteria.md`), named technical owner on buyer side |
| **Pilot** | 60 days | $0–$25K (tier-dependent) | Joint case study draft; receipts verified by buyer's own auditor/QA team; pilot success-criteria report |
| **Production** | 12-month initial term, auto-renew | Full tier pricing | Production MSA; SOC 2 posture settled (completed or risk-accepted in writing); signing-key rotation window scheduled |

The pilot fee is deliberately small because a joint case study closes the next five deals. Do not overprice a pilot — the asset you're building is the case study, not the pilot revenue.

---

## 6. Objection handling — when the buyer pushes on price

### "That's a lot for an unknown vendor."

- Reframe to TCO. If a single Part 11 warning letter costs Pfizer $2–20M in delayed revenue, a $50K/year compliance-attestation budget line is 0.25–2.5% of one bad outcome.
- Anchor to proctoring or DocuSign (see §4). SWS is priced at or below the vendors they're already buying.

### "Can we just pay per-session, not per-seat?"

- Yes — that's exactly what per-credential pricing is. Move the buyer to that axis. Most regulated enterprises prefer per-seat, but if they want per-event, you lose no revenue by switching; you gain buyer comfort.

### "We'd need to see SOC 2 before we can discuss enterprise pricing."

- Agreed. Production expansion is gated on SOC 2 or on a documented risk-acceptance memo. Pilot runs under the existing MSA without SOC 2, because pilot is a measurement exercise, not a production system.
- Offer the self-hosted option (`docs/technical-faq.md:209`) for buyers whose security team cannot risk-accept a non-certified vendor; this shifts the SOC 2 burden onto the buyer's own environment.

### "We'd want to build this in-house."

- Acknowledge they could build the behavioral composite in 6–12 months. The harder components — patent-pending receipt structure (SWS-PROV-001), published JWK infrastructure for third-party offline verification, OpenTimestamps Bitcoin-anchor pipeline, RFC 3161 TSA integration — are 12–18 months to parity. Compare the build cost honestly; most buyers choose partner.

### "Can we get a discount for a multi-year commitment?"

- Year-1 pricing as listed. Year 2–3 at 15% discount for a 3-year commitment paid annually. Do not go below the floor (§7).

### "Your competitor quoted us half."

- Ask who. If they're comparing SWS to a classifier (BioCatch, Perimeter X), reframe: *"That's a risk score. We issue an audit artifact. Those are different P&L lines."* If they're comparing to a credentialing platform (Accredible), reframe: *"That's the badge layer. We're the attestation layer under the badge. Not substitutable."*

---

## 7. Where the floor is — do not cross without a reason

Below these numbers, SWS is not a business. Moving below them requires a written reason in the deal file.

| Axis | Floor |
|---|---|
| Per-credential | $0.25 / credential at >1M/year |
| Per-seat / month | $2 / seat / month at >100,000 seats |
| Platform flat | $30,000 / year (Starter tier) |
| Pilot fee | $0 — but only if the joint case study is in the MSA |

A signed deal at the floor with a marquee logo is better than a dead deal at list price. A signed deal below the floor without a strategic reason is worse than no deal, because the next buyer will find out and anchor there.

---

**End of pricing.** If a buyer quotes a number you cannot explain using §1–§6, stop the call, write down the question, and come back to me. Do not ad-lib a new price point on the fly.
