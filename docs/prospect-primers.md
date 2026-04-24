# SWS Attention Protocol — Prospect Business-Model Primers
## Top-5 companies, at the level of "how do they actually make money?"

**Who this is for:** Stephen. Different from the tactical dossiers in `docs/prospect-dossiers/`. Those told you *who to email and what to say.* These tell you *what their business actually looks like from the CFO's seat* — revenue streams, cost structure, strategic pressure, where SWS fits on their 2026 roadmap. When a VP asks you the "why should we do this now?" question, you need to answer in their P&L terms, not yours.

**How to use it:** One company per sitting. After each, you should be able to explain their business model in 60 seconds: how they make money, their #1 2026 pain, who in their org owns that pain, and the single P&L line SWS moves.

**Freeze rule:** Standard. Once you start studying, updates stage in `prospect-primers.next.md`.

**Verification note:** I've marked claims `[VERIFY]` when they're directional — based on public filings, press, or standard industry structure — but not independently confirmed. Do not use `[VERIFY]` numbers in a pitch without checking them yourself. The *shape* of each business model is right; specific figures need cross-check.

**Last updated:** 2026-04-24.

---

## Table of contents

1. Pfizer Inc. — the pharmaceutical giant buying compliance assurance
2. Medscape Education (owned by WebMD / Internet Brands) — the accredited CME publisher
3. PlatformQ Health — the tech-forward MEC platform
4. DKBmed — the oncology-specialist mid-size MEC
5. Credly (a Pearson company) — the credentialing network
6. The cross-cutting pattern — what you'll notice by the end

---

## 1. Pfizer Inc.

### Orientation

Pfizer is a $50–60B/year-revenue [VERIFY] global pharmaceutical manufacturer. NYSE: PFE. ~80,000 employees worldwide. For SWS purposes, you are not selling to Pfizer the drugmaker — you are selling to Pfizer the *regulated enterprise*, which has tens of thousands of seats in GxP-regulated roles, an enormous internal training burden, and an external grant-making function (IME) that funds continuing medical education.

### How they make money

Pfizer's revenue is drug sales — prescription pharmaceuticals, vaccines (Comirnaty), and specialty oncology. Every dollar of that revenue depends on maintaining FDA/EMA market authorization for its products. Market authorization depends on GxP compliance — Good Clinical Practice, Good Manufacturing Practice, Good Laboratory Practice, pharmacovigilance. A single serious Part 11 finding doesn't just trigger a fine; it can delay a product launch, force a product recall, or trigger a consent decree that costs hundreds of millions.

**The P&L line SWS is adjacent to is not "training spend."** It is *"risk of regulatory action on a $2B–$20B product franchise"* — which makes training compliance a very expensive insurance policy that nobody wants to under-invest in.

Separately, Pfizer's IME grants (~$50–100M/year [VERIFY] across their Independent Medical Education portfolio) fund MECs to create physician-facing CME. That's how Medscape and DKBmed get paid.

### Strategic pressure in 2026

- **H2 2025 FDA enforcement spike on 21 CFR Part 11.** 327 warning letters [VERIFY — cold-email-template B citation, cross-check]. Corporate counsel is nervous.
- **AI-augmented cheating on internal training.** LLMs can pass most click-through e-learning. Compliance leadership knows it. Nobody has a clean answer yet.
- **2025 IME RFP language scoring "measurement of learner progression."** Pfizer is the one *demanding* this from MECs. That's your Medscape lever — but also a signal that Pfizer's own compliance team will want the same evidence shape internally.

### Who cares about SWS (and who doesn't)

**Cares:** VP Compliance; Director of GxP Training / QA Systems; any role with 483-observation accountability. They have career-ending exposure to Part 11 findings.

**Doesn't care:** Commercial ops, marketing, R&D. Do not pitch there.

### Where SWS lands in their 2026 roadmap

A Director-discretionary 60-day pilot on *one* named regulated training module (e.g., SOP: Clinical Trial Data Integrity Refresher). Pilot budget likely <$50K, small enough to avoid full RFP procurement. If the pilot produces a clean audit artifact and survives their QA team's security review, the natural expansion is a multi-module enterprise deal — gated on SOC 2 or an equivalent risk-acceptance memo.

### The P&L line SWS moves for Pfizer

> *Per-module training compliance risk is attested via independently verifiable cryptographic receipts retained across the full 7-year electronic-records retention window, materially reducing the probability that a Part 11 inspection finding impacts product franchise revenue.*

That sentence is legible to their general counsel in the language they already speak.

---

## 2. Medscape Education (WebMD / Internet Brands)

### Orientation

Medscape is the largest physician-facing CME publisher in the United States. Owned by WebMD, which in turn is owned by Internet Brands (private, KKR-backed). Physician learner base in the millions; hundreds of accredited activities per year. The accreditation arm — Medscape Education — is ACCME-accredited with commendation.

### How they make money

Medscape's *Education* revenue comes substantially from pharma IME grants — companies like Pfizer, Merck, Novartis, Gilead fund specific educational activities, and Medscape produces and delivers them to their physician audience. The grantor sees outcomes data in exchange for the funding. Other revenue streams (clinical reference content, physician advertising, pharma marketing services on the consumer/HCP side of WebMD) are larger but sit outside the Education business unit you'd pitch.

**The P&L line SWS is adjacent to is "IME grant win rate."** Every proposal they submit is competing against two to five other MECs. A differentiator in the "outcomes" section of the proposal — the part the grant reviewer actually reads — is directly correlated to next-cycle grant dollars.

### Strategic pressure in 2026

- **Pfizer's 2025 IME RFPs scored outcomes rigor explicitly.** Medscape won, but the competitive margin narrowed. They need an answer that puts distance between them and the chasing MECs.
- **ACCME's December 2025 AI guidance** opened the category for "integrity of engagement" evidence in accreditation renewals. Nobody has a standard technical answer yet. First mover sets the template.
- **Continuing erosion of the pharma IME budget** — pharma keeps tightening. MECs that can defend a higher unit grant amount survive; those who can't consolidate or exit.

### Who cares about SWS

**Cares:** VP Accreditation / Director of Outcomes; Chief Learning Officer; Head of Grants. They own the narrative that goes into proposals.

**Doesn't care:** Editorial, commercial sales, technology ops unrelated to accreditation.

### Where SWS lands in their 2026 roadmap

Pilot on *one* accredited activity over the next grant-proposal cycle. Budget is director-discretionary. Deliverable is a joint case study that becomes boilerplate language in the next 5–10 proposals. Post-pilot expansion is activity-by-activity, tied to grant-proposal cadence.

### The P&L line SWS moves for Medscape

> *Per-activity attention-integrity receipts produce the defensible "measurement of learner progression" evidence that directly increases next-cycle IME proposal win rate and defends per-grant unit economics against the chasing MEC field.*

---

## 3. PlatformQ Health

### Orientation

PlatformQ is a technology-forward CME platform / MEC hybrid. Unlike a traditional MEC that lives on a third-party LMS, PlatformQ builds and operates their own delivery stack. Smaller than Medscape but more technically capable; their product roadmap moves faster because they own their stack.

### How they make money

Two revenue streams, roughly: (a) direct MEC revenue — they produce their own accredited activities under pharma IME grants, just like Medscape; (b) platform / SaaS revenue — other MECs or medical societies license PlatformQ's platform to run their own activities. The platform-side revenue is the strategic bet. [VERIFY exact revenue mix — PlatformQ is private, so the split is not publicly disclosed.]

**The P&L line SWS is adjacent to depends on the wedge:**
- Direct MEC side: same as Medscape — IME grant win rate.
- Platform side: *platform feature differentiation that attracts MEC and society clients away from incumbents.*

### Strategic pressure in 2026

- Same Pfizer IME RFP pressure as Medscape (direct MEC side).
- Same ACCME AI-guidance pressure (both sides).
- **Platform-side competitive pressure:** they need differentiated features to win platform-license deals against incumbents. "Verified engagement receipts as a platform feature" is a clean differentiator no incumbent currently ships.

### Who cares about SWS

**Cares:** VP Product / Head of Platform (the single highest-leverage role — this person can productize SWS as a platform feature); CTO / Head of Engineering; Director of Accreditation / Outcomes.

**Doesn't care:** Marketing, direct sales (except to brief them after the platform feature ships).

### Where SWS lands in their 2026 roadmap

**This is a two-door pitch.** Door A: standard 60-day pilot on one of their own-produced activities (MEC-side wedge). Door B: platform-integration scoping conversation that ends in SWS becoming a shipped platform feature their MEC / society clients buy. Door B is strategically bigger but requires a tougher technical conversation.

### The P&L line SWS moves for PlatformQ

> *SWS integration becomes a platform-feature differentiator that simultaneously (a) strengthens PlatformQ's own IME proposals and (b) attracts MEC/society platform-license customers to PlatformQ over incumbents who cannot ship verified-engagement receipts.*

PlatformQ is the only name on this list where a single partnership compounds across their client base instead of ending at one buyer.

---

## 4. DKBmed

### Orientation

DKBmed is a specialist oncology MEC — deep faculty relationships in hematology-oncology, steady pharma IME grant revenue. Smaller than Medscape, less technology-forward than PlatformQ. Respected in the oncology teaching community. Traditional MEC operating model.

### How they make money

Near-100% of revenue is pharma IME grants, concentrated in oncology. Grantors are primarily the big oncology sponsors — Merck, BMS, Gilead, AstraZeneca. [VERIFY exact grantor mix.] Revenue concentration in one therapeutic area is both their strength (reputation, faculty) and their risk (any change in oncology grant spend directly hits their top line).

**The P&L line SWS is adjacent to is the same as Medscape's** — IME grant win rate — but the competitive field is narrower (specialist MECs competing on oncology expertise) and reputational, so the marginal value of a proposal-differentiator is high.

### Strategic pressure in 2026

- Pfizer's IME RFP pressure applies to oncology grants from every major sponsor. The "measurement of learner progression" language is not Pfizer-only.
- Oncology is pharma's most strategic category; the grant competition is sharp.
- DKBmed's smaller team means less bandwidth for vendor evaluation — pilot scope must be narrow, integration must be near-zero effort.

### Who cares about SWS

**Cares:** VP / Director of Accreditation and Outcomes; Director of Grants / Scientific Affairs (the person drafting proposal language); Chief Learning Officer / President (budget).

**Doesn't care:** Faculty, editorial (except for a privacy briefing — oncologists are privacy-sensitive).

### Where SWS lands in their 2026 roadmap

Single-activity pilot. Director-discretionary budget. Short MSA. Data-flow diagram required before signature. Deliverable is pilot data + co-written proposal language DKBmed can use across their whole oncology portfolio.

### The P&L line SWS moves for DKBmed

> *A proposal-differentiator that DKBmed can deploy across every oncology IME proposal in the next cycle, defending their unit grant economics against larger MECs chasing the same sponsors.*

---

## 5. Credly (a Pearson company)

### Orientation

Credly is the largest Open Badges issuer in the world. Owned by Pearson plc (LSE: PSON). The product issues digital credentials (skill badges, course-completion certificates, certifications) on top of hundreds of LMS and training platforms. Enterprise customers use Credly to issue credentials to employees, customers, and third-party learners.

### How they make money

Credly charges issuers — the training platforms, employers, universities, and professional certification bodies — on a per-credential-issued basis and through platform/enterprise subscriptions. Their competitive moat is network effect: Credly is where employers go to look up a candidate's digital credentials, so issuers go to Credly to have their credentials seen. [VERIFY Credly's exact revenue model and Pearson segment reporting — it sits inside Pearson's "Virtual Learning" segment but is not broken out separately in public filings.]

**The P&L line SWS is adjacent to is "enterprise-tier credential rigor premium."** Enterprise customers pay more for differentiated credential offerings. A credential that is verifiable all the way down — badge → attention behavior → Bitcoin block — unlocks a pricing tier that competitors (Accredible, Sertifier, direct 1EdTech implementations) cannot currently match.

### Strategic pressure in 2026

- **Enterprise rigor objection.** Enterprise L&D buyers increasingly ask, *"How do we know the learner actually did the work that earned the badge?"* Credly's current answer loses deals.
- **OpenBadges 3.0 adoption.** The spec allows richer evidence payloads. Whoever first productizes a meaningful use of the evidence field sets the market expectation.
- **Pearson parent-company pressure** to defend credentialing-segment growth against competition from LinkedIn Learning, Coursera, and direct 1EdTech implementations.

### Who cares about SWS

**Cares:** VP Product / Head of Platform (roadmap); Senior PM (Standards) — the person who owns 1EdTech conformance; Head of Partnerships / Business Development; CTO / Head of Engineering.

**Doesn't care:** Sales reps in the SMB tier; educational-institution reps on low-rigor use cases.

### Where SWS lands in their 2026 roadmap

Two-step path. Step 1: narrow pilot with one enterprise customer who issues credentials through Credly — demonstrate the verified-attention evidence field end-to-end. Step 2: productize as a "Verified Attention" enterprise tier — per-credential uplift pricing split between Credly and SWS. Pearson-level partnership terms are a Step 3, not a blocker to Step 1.

### The P&L line SWS moves for Credly

> *A new enterprise-tier pricing lever — "Verified Attention" credentials — defended by SWS's patent-pending attestation stack, unlocking rigor-sensitive enterprise deals Credly is currently losing on the "how do we know the learner did the work?" objection.*

---

## 6. The cross-cutting pattern — what you'll notice by the end

When you zoom out across these five companies, the same structure repeats:

- **They all have an expensive P&L line that depends on a claim nobody can currently verify.** Pfizer: regulatory risk on billion-dollar product franchises. Medscape / PlatformQ / DKBmed: grant win rate on a rigor claim. Credly: enterprise-tier pricing on a credential-rigor claim.
- **They all already have partial answers.** Cornerstone, Relias, post-tests, NPS, Accredible's own badge infrastructure. None of these answers are *audit artifacts verifiable by a third party without vendor involvement.*
- **SWS is the evidence layer, not the product layer.** You're not replacing Cornerstone, you're not replacing Credly, you're not replacing Medscape's content. You sit *underneath* their existing product and produce the audit artifact their existing product cannot produce. That framing wins every one of these conversations.
- **The buying role is always one level below the C-suite.** VP Compliance, VP Accreditation, VP Product / Senior PM Standards. Not the CEO, not the CFO, not the General Counsel. Aim there.
- **The pilot is always narrow, Director-discretionary, 45–75 days.** Below procurement pain. Above "free trial" dismissal. Built to produce an artifact you can both point at afterward.

The single framing that holds across all five:

> *"You have a P&L line that depends on a claim your current stack cannot independently prove. We are the evidence layer underneath your existing product that makes the claim independently provable, offline, forever, with no vendor involvement at verification time."*

If you can deliver that sentence in the voice of the specific role in front of you, you will survive the first thirty minutes of any call.

---

**End of prospect-primers.** If any claim marked `[VERIFY]` turns out wrong on due diligence, I will fix it the same day.
