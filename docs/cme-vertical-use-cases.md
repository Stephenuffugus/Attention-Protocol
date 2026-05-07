# CME Vertical Use Cases

**Audience:** Stephen (founder), discovery-call prep, investor / pilot conversations
**Version:** 1.0 — 2026-05-07

How seven different CME-ecosystem buyer types would actually use the SWS Attention Protocol, what they'd pay for, what they'd say to their own customers and auditors, and how the protocol creates value at each layer.

---

## The CME ecosystem in 60 seconds

Money flows top-to-bottom; receipts flow bottom-to-top.

```
Pharma grantors                    (Otsuka, AbbVie, Pfizer, Lundbeck, Janssen)
        ↓ fund                     $700M–$1B/year US IME spend
Medical Education Companies (MECs) (PPP, Prova, Medscape, DKBmed, CEC, Vindico)
        ↓ design + deliver         accredited educational activities
Accreditation Council (ACCME)      sets standards, audits, can revoke accreditation
        ↓ accredits
Specialty Boards (ABPN, ABMS, ABIM) own Maintenance of Certification (MOC) credit
        ↓ award credit
Practicing physicians              ~$50/year × 1M+ US physicians = compliance market
```

**The single question that unlocks every conversation:** *"How does your MEC / pharma team / accrediting body currently produce evidence that the credits awarded were earned by real engagement and not click-through, ChatGPT-assisted, or proxy completion?"*

**The answer everyone gives:** procedural — a passing post-test score, an attestation checkbox, a completion timestamp. None of which holds up under cryptographic audit.

The SWS Attention Protocol replaces "procedural evidence" with an **Ed25519-signed receipt that any auditor can verify offline against a published JWK.** That replacement creates value at every layer above. This document maps the value-add buyer-by-buyer.

---

## Buyer 1 — Small specialty MEC (PPP-shape)

**Examples:** Physicians Postgraduate Press (psychiatry), Vindico Medical Education (multi-specialty), Carden Jennings (rheumatology), American Health Communications.

**Size:** 20–150 employees. Owner-operator or founder-era leadership. 1–3 specialty focus. ACCME-accredited. Annual IME revenue $5M–$50M.

**Decision-makers in the room:** Director of Accreditation, Director of CME, Managing Editor of flagship journal, sometimes the founder/President directly. Buying committee 1–3 people, decision in 4–8 weeks.

### Pain

1. **ACCME audit risk.** Lose accreditation = business stops. The December 2025 ACCME AI guidance is freshly relevant pressure they have no current answer for.
2. **Grantor RFP "measurement of learner progression" sections** are scored harder by Otsuka/AbbVie/Pfizer than they were two years ago. Losing proposals to bigger MECs that have better answers.
3. **Tiny team, no engineering bandwidth.** Procurement of a "new vendor" is a meaningful cost. Anything that requires backend changes is a non-starter for the pilot.

### How they'd use the protocol

**Activity-by-activity attention-integrity receipts.** One script tag pasted into the activity template HTML. No backend changes. Each completion produces a signed JWT they can hand to their auditor, embed in their grantor reports, and reference in their next RFP response.

### Integration shape (60-day pilot scope)

- 1 accredited activity (e.g., a single ADHD-focused IME module)
- ≤5,000 learner-sessions
- One `<script>` tag in the activity HTML
- No backend changes during pilot
- Receipts go to their existing Firestore-or-equivalent storage; SWS infra is just verifier + JWKS endpoint
- Their compliance team self-verifies a sample of 10 receipts using `scripts/verify-receipt.js`

### Value-add narrative they'd say to *their* buyers

> *"In our 2026 IME proposals we cite per-activity attention-integrity receipts — Ed25519-signed, independently auditor-verifiable, with no PII collected. We don't ship a vendor score. We ship cryptographic evidence."*

That sentence in the grantor RFP differentiates them from every other MEC writing "post-test delta and NPS." Wins one extra grant per year = ~$200k–$2M revenue impact at small-MEC scale.

### What they'd say to ACCME surveyors

> *"Every credit we award since [pilot start date] has a cryptographic attestation backing it. Here's the methodology document, here's a sample receipt, here's the public verifier — your surveyor can re-verify any receipt without our involvement."*

That moves the audit from "trust the MEC's QA process" to "verify the math." ACCME has no formal position yet, so PPP-shape MECs that adopt early shape the standard.

### Pricing they'd accept

- Free during pilot in exchange for co-authored case study
- $5–15k/year flat fee post-pilot per accredited activity (2026 numbers)
- Volume discount at 10+ activities

### Pilot success criteria

- Receipt-failure rate < 2% across all completed sessions
- Auditor self-verification works on ≥95% of sampled receipts without vendor support
- Compliance team produces a 2-page methodology memo after pilot
- One named ACCME surveyor (or peer MEC compliance officer) confirms the receipt would survive their audit

---

## Buyer 2 — Mid-size multi-specialty MEC (Prova-shape)

**Examples:** Prova Education, CEC (Continuing Education Company), DKBmed, Annenberg Center for Health Sciences, MJH Life Sciences.

**Size:** 150–800 employees. Multiple specialty groups (cardiology, oncology, psychiatry, primary care). VP-level leadership in education + outcomes. ACCME-accredited. Annual IME revenue $50M–$300M.

**Decision-makers in the room:** VP Education, VP Outcomes, CTO/Head of Engineering, sometimes Compliance Officer or General Counsel. Buying committee 4–6 people, decision in 3–6 months.

### Pain

1. **Outcomes proof becoming a competitive moat.** They're already running expensive third-party measurement (Cinapsis, Outcomes Inc., internal teams). Need to differentiate from peers.
2. **Multi-specialty operations means multi-vertical thresholds.** Cardiology learners behave differently from psychiatry learners. They'd benefit from per-specialty calibration (which the methodology doc supports).
3. **ChatGPT post-test contamination is a known issue.** Privately, their VPs admit the post-test is no longer a useful integrity signal.
4. **Procurement is heavier.** SOC 2 will come up. SIG questionnaire will come up. DPIA will come up.

### How they'd use the protocol

**Per-specialty calibrated thresholds + outcomes-grade reporting.** Run the 4-step calibration on 100 known-real cardiologists, 100 psychiatrists, 100 primary-care docs, etc. Different thresholds per population. Bundled outcomes report cites the cryptographic receipt + behavioral integrity stats per specialty.

### Integration shape (90-day pilot scope)

- 3–5 accredited activities across 2 specialties
- ≤25,000 learner-sessions total
- Script tag + a small backend integration: their Outcomes team pulls the JWT alongside the activity-completion record into their reporting pipeline
- SIG Lite questionnaire pre-fill provided by SWS
- DPIA: trivial (zero PII)
- Sub-processor disclosure: Google Firebase only

### Value-add narrative they'd say to *their* buyers

> *"Outcomes reporting from [Prova/CEC] now cites behavioral attention integrity at the receipt level — cryptographically signed, per-specialty calibrated, auditor-verifiable offline. Granular insight at activity-level, not just program-level."*

That tier of reporting is what distinguishes a $1M grant proposal from a $5M one. Wins competitive grants against bigger MECs that don't have it.

### What they'd say internally to leadership

> *"We're the first mid-tier MEC to ship attestation-grade engagement evidence. This becomes the scaffolding for everything from grantor reporting to ABMS MOC integration."*

### Pricing they'd accept

- $25–75k pilot fee (covers their procurement + integration time)
- $50–250k/year post-pilot, tiered by activity volume
- Per-specialty calibration as add-on (~$15k/specialty/year)

### Pilot success criteria

- Per-specialty thresholds derived for ≥2 specialties with documented FP/FN rates
- Outcomes report includes 1+ named pharma grantor that cited the integrity data in their renewal decision
- Compliance team produces a "How we use SWS receipts" memo for their grantor RFP library
- Receipt-failure rate <1% (mid-tier expects higher reliability than small MEC)

---

## Buyer 3 — Large multi-specialty MEC (Medscape-shape)

**Examples:** Medscape Education (WebMD/Medscape, owned by Internet Brands), MedLearning, Healthstream's CE portfolio, ReachMD, Practicing Clinicians Exchange.

**Size:** 800+ employees. Enterprise-scale activity volume. Public-company-owned or PE-backed. ACCME-accredited. Annual IME revenue $300M+.

**Decision-makers in the room:** SVP Education, Chief Medical Officer or Chief Learning Officer, CTO, Chief Information Security Officer, General Counsel. Buying committee 8–15 people, decision in 6–12 months.

### Pain

1. **Volume of completions is a target.** Bots and proxy-completion fraud at scale costs them grantor trust.
2. **Adversarial sophistication is real.** They've seen automation attacks. ChatGPT-assisted completion is happening in measurable volume.
3. **Compliance / legal exposure** if a grantor's audit finds widespread fraud — could trigger a multi-million-dollar grant clawback.
4. **Existing in-house outcomes infrastructure** they don't want to rip out. Need to integrate, not replace.

### How they'd use the protocol

**Enterprise-grade fraud-rate measurement + grantor-reporting integrity.** At their scale, even a 1% improvement in detected-fraud-rate translates to millions in retained grant revenue. They use the protocol as the cryptographic substrate underneath their existing scoring infrastructure.

### Integration shape (multi-quarter rollout)

- Phase 1: 1 specialty, 1 activity, deep adversarial validation (their red team + ours)
- Phase 2: Roll across all activities in that specialty
- Phase 3: Roll across the whole catalog
- Backend integration with their data lake (Snowflake / BigQuery)
- SOC 2 Type 2 required before Phase 2
- Cryptographic audit (Trail of Bits / NCC Group) report shared during procurement
- DPIA, sub-processor list, SIG full questionnaire (not Lite), insurance certificate, MSA negotiation

### Value-add narrative they'd say to *their* buyers

> *"Medscape Education is the first enterprise MEC with cryptographic attention attestation across our full catalog. Our grantors receive offline-verifiable receipts for every learner-session, with adversarial-bot detection layered above the signature. This is auditor-grade integrity at enterprise scale."*

### What they'd say internally + to investors

> *"This shifts our outcomes story from 'we measure engagement' to 'we cryptographically prove engagement.' That's a one-tier moat over every other MEC in the market and material to renewal rates on $50M+ in grants."*

### Pricing they'd accept

- $100–500k pilot for phase 1
- $500k–$5M/year post-pilot, scaled by activity volume
- Custom MSA with audit-rights, insurance, indemnification
- Cryptographic audit report referenced in the SOW

### Pilot success criteria

- Demonstrable improvement in detected-fraud rate vs. their baseline (their numbers, their methodology)
- SOC 2 Type 1 or Type 2 in hand before Phase 2 expansion
- Cryptographic audit report from a Tier-1 firm
- Two grantors confirm the receipts add value to their renewal decision
- Receipt-failure rate <0.5% at enterprise volume

---

## Buyer 4 — Pharma IME team (Otsuka / AbbVie / Pfizer-shape)

**Examples:** Otsuka America CME team, AbbVie Independent Medical Education, Pfizer IME, Lundbeck, Janssen, Sumitomo Pharma.

**Size:** 5–25 person team within a pharma company's medical-affairs function. Annual IME budget $20M–$200M+. Disburses grants to MECs.

**Decision-makers in the room:** Director of IME, Medical Affairs lead, sometimes Compliance / Legal. Buying committee 3–5 people. Decision cycle 2–4 months for a tooling adoption.

### Pain

1. **Compliance with Sunshine Act, FDA promotion firewalls, and ACCME firewalls.** The IME budget is held under strict firewall — pharma can't influence the educational content. But pharma DOES want to see "did the activity produce real engagement, not click-through."
2. **Grant-renewal decisions need defensible evidence.** Currently they get post-test deltas and NPS scores from MECs. They want something that survives an ACCME or FDA audit.
3. **Anti-fraud reputation.** A grant ending up in a click-through-fraud scandal is catastrophic for the pharma's legal/PR posture.

### How they'd use the protocol

**As a grant-renewal decision input + audit-defense artifact.** They don't directly integrate the protocol; they require their MEC vendors to integrate it and pass the receipts up in renewal reports. Pharma reviews the receipts (or samples them) to make funding decisions.

### Integration shape (no direct integration — vendor specification)

- Pharma writes "must produce SWS-Attention-Protocol-style receipts" into their RFP "measurement of learner progression" section
- MECs that comply win the grant; MECs that don't lose it
- Pharma's compliance team verifies a sample of receipts annually
- SWS provides a 2-page "for pharma grantors" briefing that gets included in the RFP cover letter

### Value-add narrative they'd say to *their* buyers (their leadership, FDA, PhRMA Code reviewers)

> *"Our 2026 IME grants require recipient MECs to produce cryptographic attention-integrity receipts that we can independently audit. This is a stronger compliance posture than the industry standard 'post-test attestation' and aligns with the December 2025 ACCME AI guidance."*

### What they'd say internally

> *"Adopting this in our RFP language is the cheapest defensive move available — zero engineering work on our side, raises the integrity bar across all our grants, gives us a defensible answer when an FDA medical-officer asks 'what evidence do you have that the credits you funded were earned.'"*

### Pricing they'd accept

- $0 direct cost — they don't pay; their MEC vendors pay
- Adoption cost: a 1-page RFP-language addendum
- Indirect benefit: ~5–15% reduction in grant fraud risk, hard-to-quantify but real

### Adoption success criteria

- Top 2 specialty MECs in their portfolio adopt the protocol within 12 months of RFP language being added
- One named compliance officer at the pharma confirms the receipts add audit defensibility
- Zero increase in MEC complaints about the requirement

**This is the most leveraged buyer in the ecosystem.** One pharma adopting protocol-language in their RFPs forces 5–15 MECs to integrate. Not directly billable, but strategically the highest-ROI cold-email target after small MECs.

---

## Buyer 5 — ACCME (the accreditor)

**Background:** ACCME is the body that accredits MECs to award CME credit. Non-profit. ~50–80 staff. Sets the standards every accredited MEC must meet. December 2025 AI guidance is the relevant artifact.

**Decision-makers:** ACCME staff (CEO, Chief Medical Officer, Director of Accreditation Services). Plus the ACCME Board of Directors. Plus the Standards Committee that writes the rules.

### Pain

1. **AI-assisted completion erodes the credibility of CME credit.** If physicians can ChatGPT-pass post-tests, the entire system loses public trust.
2. **Their December 2025 AI guidance has no enforcement mechanism yet.** They've named the problem; they need vendors and MECs to converge on solutions they can audit.
3. **They don't build technology themselves.** They set standards and audit compliance.

### How they'd use the protocol

**Not as a customer — as a standard-setter.** ACCME doesn't pay for the protocol. ACCME *blesses* the protocol as one valid form of attention-integrity attestation in a future revision of their guidance. That blessing 10x's adoption across every accredited MEC.

### Integration shape (no integration — public comment + standards engagement)

- SWS files a public comment on the December 2025 AI guidance proposing cryptographic attestation as one valid form of evidence
- SWS publishes the threshold-derivation methodology doc as a reference implementation
- SWS engages with ACCME Standards Committee meetings (annual, public)
- Over 12–24 months, the methodology informs an updated guidance revision

### Value-add narrative they'd say to *their* community*

> *"Following the December 2025 AI guidance, ACCME-accredited providers may use cryptographic attention-integrity attestation as one valid form of engagement evidence, including but not limited to the SWS Attention Protocol or equivalent independently-verifiable schemes. Methodology references include..."*

That sentence in an updated guidance document **forces every ACCME-accredited MEC to adopt some form of cryptographic attestation.** SWS doesn't have to be the named vendor — but being the methodology citation makes us the default.

### What they'd say to their Board

> *"By blessing a cryptographic attestation methodology, we move attention-integrity from 'procedural compliance' to 'mathematically auditable.' This is the strongest audit posture available to a non-technology accreditor."*

### Pricing they'd accept

- $0. Not a buyer.
- Adoption cost: approximately one staff-year of engagement work, which they're doing anyway as part of the AI-guidance follow-through

### Adoption success criteria for SWS

- Methodology cited in a future ACCME guidance revision
- One named ACCME staffer says SWS publicly at a conference (PCMA, AMA, ACCME Annual)
- One peer-reviewed paper co-authored with an ACCME-affiliated researcher

**This is the slowest but most permanent move on the board.** Not for fast revenue. For ecosystem positioning.

---

## Buyer 6 — Specialty boards (ABPN, ABMS, ABIM-shape)

**Examples:** American Board of Psychiatry and Neurology, American Board of Internal Medicine, American Board of Family Medicine, American Board of Surgery — and the ABMS umbrella.

**Size:** 50–500 staff per board. Non-profit. Set MOC requirements that physicians must meet to maintain board certification.

**Decision-makers:** CEO, Chief Examination Officer, Director of Continuing Certification (varies by board). Plus member boards committee for ABMS.

### Pain

1. **MOC has been politically controversial for a decade.** Physicians complain it's expensive, time-consuming, and not clearly correlated with quality of care.
2. **AI-assisted MOC activities undermine the political defense of MOC.** "Why am I paying for and doing this if my colleagues just ChatGPT it" is the existential question.
3. **They don't accredit activities — that's ACCME's job.** But they certify that activities counted toward MOC are legitimately completed.

### How they'd use the protocol

**As a verification layer in MOC credit awarding.** When a physician submits MOC activity for credit, the board can require (or accept) a SWS-signed receipt as evidence that the activity was completed by the certified physician, not by ChatGPT or a proxy.

### Integration shape

- Board updates MOC submission requirements to accept SWS receipts as evidence of completion
- Board's QA team verifies a sample of submitted receipts annually
- No direct payment — boards push the cost to the MEC providers, who push it to grantors, who fund it from IME budgets

### Value-add narrative they'd say to *their certificants*

> *"Effective [date], ABPN MOC submissions may include cryptographic completion receipts from accredited providers using the SWS Attention Protocol or equivalent. This strengthens the public's trust in board certification and protects the integrity of MOC credit."*

### What they'd say internally

> *"Adopting this verification layer is the strongest defense available against the 'MOC is meaningless' political critique. Receipts are mathematical, not procedural — that distinction matters in legislative testimony and physician-survey data."*

### Pricing they'd accept

- $0 direct from SWS
- Their adoption is via standards updates, not procurement
- They benefit from market adoption forced by other adopters

### Adoption success criteria

- One named board updates MOC submission documentation to reference SWS receipts
- One legislative or regulatory testimony cites cryptographic attestation as a quality signal
- Co-authored paper with a board-affiliated researcher

---

## Buyer 7 — LMS / CME platform integration (Healthstream-shape)

**Examples:** Healthstream, BlueSpark Innovation, EthosCE, Cornerstone OnDemand, Litmos Healthcare, Schoox.

**Size:** 200–5,000 employees. SaaS platform companies. Their customers are hospitals, MECs, healthcare networks.

**Decision-makers:** VP Product, VP Engineering, sometimes Chief Compliance Officer. Buying committee 4–8 people, decision in 6–12 months.

### Pain

1. **Their customers (MECs and hospitals) are starting to ask for attention-integrity features.** They don't want to build it in-house.
2. **AI integrity is a board-level conversation at every healthcare LMS in 2026.**
3. **Adding cryptographic features without expert in-house cryptographers is expensive and risky.**

### How they'd use the protocol

**As a third-party integration / partnership.** SWS becomes a "ship-with" SDK that LMS providers offer to their MEC customers. SWS handles the cryptographic substrate; the LMS handles the workflow.

### Integration shape

- LMS partner integrates the SDK as an optional module
- LMS customers (MECs) can enable it per-activity
- LMS handles billing on top
- SWS gets a per-receipt or per-seat licensing fee from the LMS

### Value-add narrative the LMS would say to *their customers*

> *"[Healthstream/EthosCE/etc.] now offers cryptographic attention-integrity attestation via the integrated SWS Attention Protocol. Enable per-activity, ship signed receipts to your auditors, no in-house cryptography expertise required."*

### What they'd say to investors

> *"We're the first healthcare LMS to ship cryptographic attestation as a first-class feature. This is a ~3-year moat over peer LMS providers and material to enterprise-customer renewal rates."*

### Pricing they'd accept

- $25–100k integration partnership fee
- $0.001–$0.10 per signed receipt royalty (volume-tiered)
- Co-marketing rights (joint case studies, conference appearances)

### Adoption success criteria

- One named LMS ships SWS integration as a feature
- One MEC customer of that LMS uses the integration in production
- One enterprise hospital customer adopts as part of their compliance posture

---

## Cross-buyer summary table

| Buyer type | Direct revenue | Strategic ROI | Pilot length | Decision speed | Engineering bar |
|---|---|---|---|---|---|
| Small MEC (PPP) | $5–15k/year | Low | 60 days | 4–8 weeks | Low (one script tag) |
| Mid MEC (Prova) | $50–250k/year | Medium | 90 days | 3–6 months | Medium (SIG Lite + DPIA) |
| Large MEC (Medscape) | $500k–5M/year | High | 6–12 months | 6–12 months | High (SOC 2 + crypto audit + MSA) |
| Pharma IME team | $0 (forces MEC adoption) | Very high | RFP language only | 2–4 months | Zero (no integration) |
| ACCME (accreditor) | $0 (standards blessing) | Highest, longest | 12–24 months | Years | Zero (standards path) |
| Specialty board (ABPN) | $0 (MOC verification layer) | High | 12–24 months | Years | Zero (standards path) |
| LMS partner (Healthstream) | $25k–$100k integration + royalties | High | 6–12 months | 6–12 months | Medium (SDK partnership) |

**Bold takeaway:** the highest-leverage moves are the ones that don't directly bill — pharma RFP language, ACCME standards blessing, ABPN MOC verification layer. Each one of those forces 5–50 MECs to adopt, generating direct revenue downstream without SWS having to sell each MEC individually.

The right sequencing: **start with small MECs to prove the methodology, win one pharma to lock in RFP-language adoption across many MECs, then engage ACCME / boards to ratify the methodology as a standard.**

---

## The expansion path: from PPP → ecosystem

Concrete sequencing assuming the PPP cold-discovery email lands:

**Month 1–2:** PPP discovery → free pilot agreement → 1 accredited activity instrumented. Practice round + first real receipts in production.

**Month 2–4:** PPP pilot completes, case study co-authored. Stephen uses the case study to open conversations with Prova, CEC, DKBmed, Vindico — peer specialty/mid-size MECs.

**Month 3–6:** Second pilot lands at a mid-size MEC. Now have receipts at two scales of MEC. Methodology doc cited in two operational deployments.

**Month 5–8:** Cold-outreach to 2–3 pharma IME teams (Otsuka, AbbVie, Lundbeck — the psychiatry grantors PPP already names in proposals). Pitch is "your top specialty MECs are already producing these receipts; here's how you'd reference them in your RFP language." Goal: one pharma adds protocol-language to their 2027 RFP cycle.

**Month 6–12:** ACCME public-comment filed (free, on the public record, shapes the standards conversation). Begin engaging specialty-board researchers as paper co-authors.

**Month 12–18:** First Tier-1 cryptographic audit (Trail of Bits / NCC Group) commissioned. Audit report becomes the procurement document for the first large MEC pilot.

**Month 18–24:** First large-MEC pilot lands. SOC 2 Type 1 in hand. ACCME standards revision references the methodology. First specialty board updates MOC submission documentation.

**Month 24+:** SWS is the substrate; revenue scales with ecosystem adoption.

---

## What this document does and does not claim

**Claims:**
- Each buyer type described corresponds to real companies in the real CME ecosystem in 2026
- The pain points listed are recurring themes across published CME industry analysis and 17 vertical research outputs in this repository
- The integration shapes described are achievable with the current SDK + signing function + verifier stack (post 2026-05-07 fix)
- The pricing ranges are based on standard B2B SaaS comparables and CME-industry pricing norms, not signed contracts

**Does not claim:**
- Any of these companies is a current SWS customer. As of 2026-05-07, SWS has zero paid customers and one cold-discovery email outstanding (PPP, sent today).
- The pricing ranges are guaranteed market-clearing prices. They're informed estimates that need real pilots to validate.
- The expansion path is the only path. It's the most-likely path given current ecosystem structure; ACCME could move faster than expected, a single large-MEC pilot could leapfrog the small-MEC sequencing, etc.

---

**Status:** Version 1.0, released 2026-05-07. Use for discovery-call prep, investor pitches, vertical-strategy sessions. Update as real pilot conversations refine the assumptions.
