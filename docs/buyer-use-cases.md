# SWS Attention Protocol — Buyer Use Cases
## Day-in-the-life workflows for the three primary buyer personas

**Who this is for:** Stephen. Study material so that when a Pfizer QA director, a Medscape accreditation lead, or a Credly product manager says *"walk me through how this actually works on my side,"* you can answer concretely — script tag placement, xAPI extension keys, what the auditor sees six months later — without hand-waving.

**How to use it:** Read one persona per sitting. The three personas are independent. After each one, you should be able to describe that buyer's Monday-morning reality in 60 seconds without notes.

**Freeze rule:** Same as the study guide. Once you open this doc to study, I don't edit it without you saying "swap." Updates stage in `buyer-use-cases.next.md`.

**Last updated:** 2026-04-24. Verify the integration mechanics against `src/sdk/xapi-adapter.js`, `src/sdk/integration-examples.js`, and `docs/API_SPECIFICATION.md`.

---

## Table of contents

1. Persona A — Priya, Director of GxP Training Systems at Pfizer
2. Persona B — Marcus, VP Accreditation & Outcomes at Medscape Education
3. Persona C — Jordan, Senior Product Manager (Standards) at Credly
4. What all three have in common (and what they don't)
5. The three one-liners they each need from you

---

## 1. Persona A — Priya, Director of GxP Training Systems at Pfizer

### Who she is

Priya sits inside Pfizer Global Quality. She owns the compliance training stack for the commercial and GxP-regulated workforce — roughly 30,000 seats worldwide cycling through 150+ named training modules annually (SOP refreshers, Good Clinical Practice, Good Manufacturing Practice, pharmacovigilance updates, data-integrity training for regulated systems). Her team has eight people.

Her KPIs:
- **Audit readiness.** Zero Part 11 findings on FDA or EMA inspection.
- **On-time completion.** ≥98% of assigned modules completed by due date across all regulated populations.
- **Time-to-remediate.** When a module has a content change, median days to 100% recertification ≤14.

What keeps her up at night: the H2 2025 spike in 21 CFR Part 11 warning letters. Her peer at a Tier-1 competitor got hit with a 483 observation in January for "inadequate controls to ensure electronic records accurately reflect the performance of the recorded activity" — roughly translated by counsel as *"your LMS says the trainee finished, but you can't prove a human did the work."* She does not want to be the next one.

### Day 1 — intake call (30 min)

You're on the phone. She's skeptical. Her opening: *"We already have Cornerstone. It tracks completions. What are you adding?"*

Your answer — not scripted, but in this shape:
- Cornerstone tracks that a user ID clicked through. It cannot answer *who was at the keyboard* or *whether they paid attention*.
- SWS sits inside the Cornerstone activity, runs during the learner session, and emits a signed receipt at completion. The receipt carries seven independent attestation layers, verifiable offline by her QA team using nothing but the SWS public key.
- No PII leaves her environment. No content leaves her environment. No URL strings. Just the behavioral composite, the environmental signal, the composition integrity signal, the honeypot canary, consent attestation, Ed25519 signature, Bitcoin + RFC 3161 timestamp.
- Her auditor doesn't call us. They verify the receipt against the JWK we publish. We can go dark and every receipt she ever issued still verifies.

She asks for a scoping doc. You send `docs/technical-faq.md` and the evidence kit (`dist/evidence-kit.zip`). Call ends with: *"I'll loop in my QA systems architect and our privacy lead."*

### Day 8 — scoping call with her architect (45 min)

Her architect — a seasoned IT engineer — runs you through the Cornerstone integration pattern. Pfizer publishes training activities as SCORM 1.2 or xAPI-CMI5 packages. They host them on their own Cornerstone tenant. Trainees launch from their home dashboard.

What you need him to do, concretely:

1. **Drop one script tag into the SCORM/xAPI package's root HTML.**
   ```html
   <script src="https://sws-attention-proofs.web.app/sdk/attention-protocol.min.js"></script>
   <script>
     SWSAttention.init({ gameId: 'pfizer_gxp_' + moduleId, debug: false });
   </script>
   ```
   That's it. No backend changes on Pfizer's side during the pilot.

2. **Wire the existing module lifecycle events.** When a section loads, call `SWSAttention.recordContentRender('complex'|'moderate'|'simple')`. When a knowledge-check question is answered, call `SWSAttention.recordDecision(optionCount, responseTime)`. When the module completes, call `SWSReceipts.generateCompletionReceipt({ ... })` with the module metadata. Code pattern lives in `src/sdk/integration-examples.js:80` (TrainingVerificationExample).

3. **Receive the xAPI statement.** The SDK already ships an xAPI 1.0.3 adapter (`src/sdk/xapi-adapter.js`). It produces a statement of the shape:
   ```json
   {
     "actor":   { "account": { "homePage": "https://sws-attention-proofs.web.app", "name": "<SWS DID>" } },
     "verb":    { "id": "http://adlnet.gov/expapi/verbs/completed" },
     "object":  { "id": "https://pfizer.com/gxp/modules/sop-clinical-v4", "definition": { "type": "http://adlnet.gov/expapi/activities/module" } },
     "result":  {
       "completion": true,
       "success":    true,
       "duration":   "PT22M14S",
       "score":      { "scaled": 0.87 },
       "extensions": {
         "https://sws-attention-proofs.web.app/xapi/ext/signed-receipt":  "<full Ed25519-signed VC-JWT>",
         "https://sws-attention-proofs.web.app/xapi/ext/attestation-layers": { "behavioral": 0.71, "environmental": "pass", "composition": 0.94, "honeypot": "pass", "gated_composite": 0.573 },
         "https://sws-attention-proofs.web.app/xapi/ext/receipt-hash":    "<sha256>",
         "https://sws-attention-proofs.web.app/xapi/ext/public-key-url":  "https://sws-attention-proofs.web.app/.well-known/attention-pubkey.json"
       }
     }
   }
   ```
   Cornerstone accepts this natively through its xAPI LRS endpoint. The signed JWT lives inside the `result.extensions` block; it is stored alongside the statement and is independently verifiable forever.

4. **One URL allow-listed through the corporate firewall.** Just `https://sws-attention-proofs.web.app/.well-known/attention-pubkey.json` so the verification browser-side utility can fetch the public key. That's the entire network surface during the pilot.

He nods. This is a weekend's work for one engineer. He asks about SOC 2. You answer honestly — not certified yet, pilot is a 60-day measurement exercise under a tight MSA, production rollout is predicated on completing SOC 2 or on an equivalent risk-acceptance memo that their security team signs. You offer to scope that in parallel with the pilot.

### Day 30 — pilot in motion

One module — SOP: Clinical Trial Data Integrity Refresher, ~20 min target duration — has been running for four weeks on a pilot cohort of 400 trainees. Priya's dashboard now shows:

- **Completion rate (same as before):** 94%.
- **Gated-composite distribution across the 376 completions:** 82% ≥ 0.50 (clear human engagement), 13% in 0.30–0.50 (marginal — her team triages), 5% at 0.30 (bot-like or unattended). The 5% gets re-assigned.
- **Median verified-attention duration:** 17 min 40 sec (vs. 20-min target). Tells her the content pacing is tight but passable.
- **Top attestation-layer flag pattern on flagged sessions:** honeypot canary + composition-integrity drop. That's the LLM-paste signature. Seven sessions flagged that pattern; she'd otherwise have certified them.

She exports the batch of 376 receipts as a signed ZIP. Her QA analyst runs `scripts/verify-receipt.js` locally against the public JWK. All 376 verify. The ZIP plus verification log goes into the audit binder for that quarter.

### Day 180 — FDA inspection

An inspector arrives for a routine GxP audit. At 2:30pm on day two, she says: *"Show me how you know the person who completed this module was actually paying attention, not clicking through."*

Priya opens the audit binder, pulls one receipt, opens `verify.html` in the browser (or a reviewer can use the hosted one at `https://sws-attention-proofs.web.app/verify.html`), pastes the JWT. Seven cards render: environmental pass, behavioral composite 0.71, composition integrity 0.94, honeypot pass, consent present, Ed25519 valid, Bitcoin block 870412 confirmed.

The inspector asks: *"Can you recreate this without SWS involvement?"* Priya says yes, walks through the verification using only the public key file. No vendor phone call. No vendor subpoena. The receipt is self-authenticating.

That single demonstration resolves the line item. It would have taken four hours of evidence production with the old Cornerstone-only stack.

### The one-liner Priya needs from you for her CAPA briefing

> *"All training completion records across pilot modules carry cryptographically-signed, layered attestation receipts independently verifiable against SWS's published Ed25519 JWK. Verification requires no vendor involvement and produces the same result at any point during the 7-year electronic-records retention window."*

---

## 2. Persona B — Marcus, VP Accreditation & Outcomes at Medscape Education

### Who he is

Marcus runs the accreditation engine at Medscape Education — the team that keeps their ACCME Accreditation with Commendation status current, handles the annual self-study, and owns the "outcomes" narrative that goes into every pharma IME grant proposal. Medscape runs millions of physician learner-sessions per year, and a material chunk of Medscape's revenue comes from pharma IME grants.

His KPIs:
- **ACCME commendation retention.** Zero adverse findings across accreditation review cycles.
- **IME win rate.** ≥60% of submitted proposals funded; ≥$X million pharma revenue/year.
- **Outcomes rigor narrative.** Each proposal includes a defensible answer to the grantor's "measurement of learner progression" question.

What keeps him up at night: Pfizer's 2025 IME RFPs scored "measurement of learner progression" explicitly. His team filled that section last cycle with post-test delta numbers and NPS. It won, but barely. His counterpart at a competing MEC has been hinting at some kind of "integrity of engagement" evidence going into their next proposal. He doesn't know what it is yet, but he doesn't want to be on the wrong side of it.

### Day 1 — intake call (30 min)

He's polite but busy. Opening: *"We already measure. Post-tests. NPS. Knowledge-retention follow-ups at 90 days. What are you adding that we don't have?"*

Your answer:
- Post-tests measure *what the learner retained.* They don't measure *what the learner did during the activity.* A grantor reading his proposal cannot distinguish between two learners who got 90% on the post-test: one who worked through the content for 22 minutes, and one who opened the tab and googled the answers.
- SWS issues an attestation receipt for *the activity itself.* It carries layered evidence — behavioral composite, environmental check, composition-integrity signal, honeypot canary, cryptographic signature, Bitcoin anchor. The receipt is an audit artifact, not a score.
- The single line this unlocks in his next Pfizer proposal: *"Learner engagement during each accredited activity is attested via Ed25519-signed, Bitcoin-anchored receipts issued by SWS Attention Protocol, independently verifiable against our published JWK. Per-activity receipts are retained for the full Part 11 / ACCME retention window and available to the grantor on request."*
- That is a line no competing MEC can currently credibly put in a proposal.

Marcus pauses. Asks: *"What does ACCME think?"* You answer honestly: no formal endorsement of any cryptographic attestation vendor. December 2025 guidance opened the category. First-mover is an advantage, not a compliance requirement.

Call ends with: *"Send me the evidence kit. Let me talk to my head of digital."*

### Day 8 — scoping with his head of digital product (45 min)

Medscape Education publishes activities through their own web platform (not an LMS). Each accredited activity is a page — text/video/branching-scenario — behind a sign-in. Learners complete, answer a post-test, receive a CE credit.

What his head of digital needs to change:

1. **Drop the SWS script tag in the activity template.** Same as Pfizer — one line in the global template that loads `SWSAttention`. Per-activity `init({ gameId: 'medscape_activity_' + activityId })`. Content-render and decision-point hooks go into the existing analytics wiring.

2. **Capture the receipt.** On activity complete, call `SWSReceipts.generateCompletionReceipt(...)` and store the returned signed JWT alongside the learner's credit record in the existing CE issuance pipeline. No new storage system. Receipt is a text blob.

3. **Add an optional share flow.** For credentialing partners (Credly, accrediting boards), emit the receipt as a W3C Verifiable Credential via `VC.fromReceipt(receipt)` (`src/sdk/verifiable-credentials.js`). OpenBadges 3.0-conformant. Can be ingested directly by Credly.

4. **Auditor view.** For the annual ACCME self-study, add a section: *engagement integrity evidence per activity, verified against SWS public JWK.* Point to the evidence-kit bundle and the in-browser verifier.

### Day 30 — pilot in motion

One accredited activity — a 45-minute CME on anticoagulation management — runs under SWS for four weeks. 2,100 physician sessions. Marcus's dashboard:

- **2,100 sessions completed; 2,100 receipts issued.** 100% receipt generation.
- **Gated-composite distribution:** 74% ≥ 0.55, 19% in 0.30–0.55, 7% at 0.30.
- **Honeypot canary:** fired on 34 sessions (1.6%). This is the *specific* evidence of attempted LLM-assisted answering. Thirty-four receipts are now layered with unambiguous non-human-composition signal.
- **Per-session verification:** Marcus's auditor sampled 20 at random. All 20 verified offline against the JWK with zero vendor interaction.

That 1.6% honeypot firing rate is, by itself, more specific evidence of engagement integrity than anything Medscape has ever had to show a grantor.

### Day 90 — Pfizer proposal submission

Marcus's team submits the next Pfizer IME RFP. Under "Measurement of Learner Progression," the proposal now includes:

- Post-test delta (same as before).
- NPS (same as before).
- **New:** per-activity attention-integrity receipts, signed and Bitcoin-anchored, retention 7 years, independently verifiable via published JWK, layered attestation including behavioral composite + composition integrity + honeypot canary. Sample receipt + verification walkthrough attached. SWS public key URL printed.

The reviewer comparing three bidders now sees one with an audit artifact the others can't match. Marcus wins the RFP at a materially higher funded amount than the previous cycle. The case study — co-written with you under the pilot agreement — becomes shorthand in his next five proposals.

### The one-liner Marcus needs from you for proposal boilerplate

> *"Each accredited activity emits an Ed25519-signed attention receipt bundling behavioral, environmental, composition-integrity, and honeypot-canary attestation, anchored to Bitcoin via OpenTimestamps and RFC 3161. Receipts are independently verifiable against SWS Attention Protocol's published JWK and retained for the 7-year accreditation window."*

---

## 3. Persona C — Jordan, Senior Product Manager (Standards) at Credly

### Who they are

Jordan owns the 1EdTech OpenBadges 3.0 spec alignment at Credly (now part of Pearson). Credly is the largest Open Badges issuer globally. Their product issues digital credentials on top of hundreds of LMS and training platforms. Credly itself doesn't measure behavioral engagement during the learning activity — that's always been the LMS's job, and most LMSs don't do it.

Jordan's KPIs:
- **Spec conformance.** OpenBadges 3.0 every issued credential, no divergence.
- **Enterprise-tier growth.** Land larger enterprise accounts by differentiating on credential rigor.
- **Partner integrations.** Meaningful throughput from at least three net-new partner integrations per year that strengthen the catalog.

What keeps them up at night: enterprise buyers have started asking, *"How do we know the learner actually did the work that earned the badge?"* Credly's honest answer today is, *"We issue the badge; the LMS verifies the work."* That answer is losing deals.

### Day 1 — intake call (30 min)

Opening: *"Why would we add another vendor's receipt to our stack?"*

Your answer:
- You don't compete with Credly. Credly is the credential of record. SWS is the evidence layer *under* the credential.
- Every SWS receipt already emits as a W3C Verifiable Credential (VC Data Model 2.0) and as an OpenBadges 3.0 AchievementCredential — conformant to the spec, no divergence (`src/sdk/open-badge.js`, `src/sdk/verifiable-credentials.js`).
- A Credly badge backed by a SWS attention receipt is the first credential in their catalog that is verifiable *all the way down*: badge issuer → attention attestation → Bitcoin block.
- Channel play. Two shapes: (a) API-level — Credly consumes SWS receipts per-credential, co-marketed as "verified attention credentials"; (b) OEM — Credly white-labels into the enterprise tier, per-credential pricing. Either way, Credly stays as the credential of record.

Jordan asks: *"How does this slot into our existing issuance pipeline?"*

### Day 8 — technical scoping with their engineering lead (45 min)

Their engineering lead runs through Credly's issuance API. Credly consumes credential data from issuers (training providers), enriches it, and issues the badge as an OpenBadges 3.0 AchievementCredential.

What changes when SWS is in the chain:

1. **Training provider adopts the SWS script tag** (same as Pfizer / Medscape, different `gameId`).
2. **On activity completion, the provider emits the SWS receipt as a signed VC-JWT.** This is done by a single call to `VC.fromReceipt(receipt)` in the existing completion handler.
3. **Credly's issuance endpoint ingests the VC-JWT as the `evidence` field of the OpenBadges 3.0 AchievementCredential.** Zero schema divergence. 1EdTech conformant. The resulting Credly badge carries the full SWS attestation inline or by URL reference.
4. **Verification page displays provenance.** Jordan's team adds a "Verified Attention" pill on the badge page when the credential's evidence field contains a valid SWS receipt. Clicking the pill renders the attestation cards.
5. **No new identity, no PII exchange.** SWS DIDs stay pseudonymous; Credly's learner profile is unchanged.

Jordan asks about schema stability. You show the stable extension namespaces in `src/sdk/xapi-adapter.js` constants block — they have not changed and won't without coordinated migration.

### Day 30 — pilot in motion

One enterprise customer — a Tier-1 consulting firm issuing internal certifications through Credly — runs a pilot. 180 credentials issued over the four-week window. Every credential now carries a SWS attention receipt in its evidence field.

The customer's L&D director, on her first verification walkthrough, sees:
- Issuer chain: training platform → SWS → Credly.
- Attestation layers: behavioral composite 0.61, environmental pass, composition integrity 0.89, honeypot pass.
- Bitcoin anchor: block 873141.
- All verifiable with two browser pastes and no vendor calls.

She tells Jordan: *"This is the first digital credential in our catalog I would personally trust on an external candidate's resume."*

### Day 90 — enterprise tier launch

Credly launches a "Verified Attention" enterprise tier. Pricing: per-credential uplift, split between Credly and SWS. Credly's sales team now has an answer to the *"how do we know the learner did the work?"* objection. Jordan's roadmap lands the most material differentiation move of the year.

### The one-liner Jordan needs from you for the launch brief

> *"Every credential in the Verified Attention tier is a conformant OpenBadges 3.0 AchievementCredential whose `evidence` field contains an Ed25519-signed, Bitcoin-anchored attention receipt issued by SWS Attention Protocol. Each credential is verifiable all the way down — issuer chain to behavioral composite to Bitcoin block — without vendor involvement."*

---

## 4. What all three personas have in common (and what they don't)

### Common

- **Script tag + SDK init.** One line of HTML plus one `init()` call. No backend changes during pilot.
- **Receipt on completion.** One function call — `SWSReceipts.generateCompletionReceipt({...})` — returns a signed VC-JWT.
- **Standards-native emission.** xAPI 1.0.3 for LMS ingestion (Pfizer, most Medscape integrations). OpenBadges 3.0 AchievementCredential for credentialing (Credly).
- **Offline verification.** Every receipt verifies with only the public JWK. The buyer can go dark, SWS can go dark — the receipt still verifies.
- **No PII.** No emails, names, URLs, or content ever leave the buyer environment through the SWS pipeline.
- **Retention window.** The signed JWT plus the public JWK is the complete verification package for the full 7-year window.

### Different

| Dimension | Priya (Pfizer) | Marcus (Medscape) | Jordan (Credly) |
|---|---|---|---|
| Buyer wedge | 21 CFR Part 11 compliance | IME grant outcomes rigor | OpenBadges 3.0 enterprise differentiation |
| Who verifies the receipt? | QA team during FDA inspection | ACCME reviewer + Pfizer grant reviewer | Enterprise L&D buyer / candidate / recruiter |
| Integration surface | Cornerstone xAPI-CMI5 | Proprietary web platform | Credly issuance API |
| Buying cycle | 60-day pilot → Director band (<$50K) → SOC 2 gate on expansion | 60-day pilot on one activity → proposal-cycle-driven expansion | 45–75 day pilot → channel partnership agreement at Pearson |
| Primary artifact | Audit binder with verified receipts | Proposal boilerplate + pilot case study | "Verified Attention" enterprise tier + per-credential evidence |
| Failure mode if we miss | Warning letter, 483 observation | Losing share in next IME cycle | Losing enterprise deals on rigor objection |

---

## 5. The three one-liners they each need from you

Keep these taped to your monitor. You will need to recite the right one in the right room.

**Priya (Pfizer / compliance):**
> *"Cryptographically-signed, layered attestation receipts, independently verifiable against our published Ed25519 JWK, satisfying 21 CFR Part 11 electronic-records requirements across the 7-year retention window with no vendor involvement required at verification time."*

**Marcus (Medscape / IME outcomes):**
> *"Per-activity attention-integrity receipts, Ed25519-signed and Bitcoin-anchored, bundling behavioral, composition-integrity, and honeypot-canary attestation, independently verifiable against SWS's published JWK — the audit artifact no competing MEC can currently put in their proposal."*

**Jordan (Credly / credentialing):**
> *"Every credential in the Verified Attention tier is a conformant OpenBadges 3.0 AchievementCredential whose evidence field contains a SWS attention receipt — a credential verifiable all the way down, from Credly issuance to behavioral composite to Bitcoin block."*

---

**End of buyer-use-cases.** If anything above disagrees with the shipped SDK or the API spec, trust the shipped SDK and tell me so I can fix this doc.
