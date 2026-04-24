# SWS Attention Protocol — Pilot Success Criteria
## Five metrics a 60-day pilot must hit. What each means. What the buyer sees.

**Who this is for:** Stephen. Every pilot MSA should have these five criteria written into it, verbatim or close to it. If a buyer wants to strike one, ask why — they are all load-bearing. If a buyer wants to add a sixth, that's usually fine, as long as the original five stay.

**Why this matters:** The single fastest way to lose a buyer is to run a pilot without named success criteria. Without criteria, "pilot" drifts into "free consulting" and "production" never happens. With criteria, the pilot closes cleanly, a joint case study ships, and the production conversation begins from a shared factual foundation.

**How to use it:** Paste §2 (the five criteria) directly into pilot MSAs. Use §3 for the buyer-facing explanation when they ask *"what does a successful pilot look like?"* Use §4 when the pilot is winding down and you're preparing the case study.

**Freeze rule:** Same as the study guide. Staged updates go in `pilot-success-criteria.next.md`.

**Last updated:** 2026-04-24.

---

## Table of contents

1. The shape of a SWS pilot
2. The five success criteria (paste-ready)
3. Buyer-facing rationale per criterion
4. What "done" looks like — the exit report
5. What can go wrong — and how to handle it
6. Failure modes that should void the pilot entirely

---

## 1. The shape of a SWS pilot

Every SWS pilot has the same four-part shape regardless of buyer vertical:

1. **Scope:** one named training module, one named accredited activity, or one named credential type. Never more than one. The discipline of a single scope is what makes the criteria measurable.
2. **Duration:** 60 calendar days from the first live receipt issued. Not from MSA signature — from the first production-shaped receipt.
3. **Population:** agreed with the buyer in advance. Typical ranges: Pfizer-class pilot 200–500 seats on one module; MEC pilot 500–5,000 physician sessions on one activity; credentialing pilot 100–500 issued credentials.
4. **Artifact:** exit report delivered within 5 business days of the pilot window closing. Format matches §4 below.

Anything outside this shape is not a pilot — it is either a proof-of-concept (shorter, looser) or a pre-production deployment (longer, contractually different). Do not let a buyer call a 14-day demo a "pilot," and do not let them call a 6-month engagement a "pilot" either. Both ruin the case study.

---

## 2. The five success criteria (paste-ready)

The following language can be pasted into the pilot MSA under a heading like "Pilot Success Criteria." Numbers inside square brackets are filled in during scoping. The thresholds below are defensible defaults.

> **Pilot Success Criteria**
>
> This pilot is considered successful if all five of the following criteria are met during the pilot window. Partial success (four of five) may be accepted at the Buyer's discretion.
>
> **1. Receipt issuance rate.** ≥ 99.0% of sessions that reach the defined completion state emit a well-formed, Ed25519-signed receipt. Rate measured across all sessions for the named [module / activity / credential]. Failures are logged and investigated within 2 business days.
>
> **2. Independent verification rate.** ≥ 99.5% of issued receipts pass independent verification against the SWS public JWK using only the `verify.html` browser utility or an equivalent offline verifier. Verification includes signature validity, attestation-layer completeness, and timestamp integrity.
>
> **3. Attestation-layer attack-surface coverage.** At least 3 of the 4 core attestation-layer flags (environmental gate, composition integrity, honeypot canary, gated composite) fire at least once during the pilot on non-compliant sessions, demonstrating that the layered evidence model works end-to-end on this buyer's real-world traffic.
>
> **4. Integration time.** Initial integration (script tag deployed + first receipt issued) completes within 5 business days of pilot-kickoff call. Full pilot deployment (all named [seats / activities / credentials] covered) completes within 15 business days.
>
> **5. Joint case study artifact.** A co-authored case study, anonymized per Buyer's specification, delivered and mutually approved within 5 business days of the pilot window closing. Case study includes: pilot scope, population, aggregate receipt statistics, attestation-layer outcomes, verification demonstration, and Buyer's go/no-go production decision.

These five criteria are the minimum. Adding criteria is fine. Removing criteria should be rare and documented.

---

## 3. Buyer-facing rationale per criterion

When the buyer asks *"why these five?"*, here is the answer for each.

### Criterion 1 — Receipt issuance rate (≥99.0%)

**What it measures:** Does the system actually work at your volume? Every session that completes should produce a signed receipt. If sessions complete but receipts don't issue, there's an integration bug or an SDK bug, and we need to find it before production.

**Why this threshold:** 99.0% is strict enough that silent failures are visible, loose enough that one-off network hiccups or browser-extension conflicts don't tank the pilot. The 1.0% tolerance is your operational slack.

**What Buyer sees:** A dashboard line item: *"376 of 378 completed sessions emitted a valid receipt. 2 failures logged and investigated."*

### Criterion 2 — Independent verification rate (≥99.5%)

**What it measures:** Can the Buyer's own team verify the receipts without our help? This is the existential feature of SWS. If the Buyer's QA team cannot verify a receipt offline using only the public JWK, SWS has failed the only thing it uniquely does.

**Why this threshold:** Should be 100%, but 0.5% tolerance accounts for file-corruption edge cases during ZIP export/import in the Buyer's workflow. Any real verification failure is a bug we fix immediately.

**What Buyer sees:** *"Our QA analyst verified a random sample of 50 receipts using only the SWS public JWK and `verify.html`. All 50 passed."* That sentence is the case study's headline fact.

### Criterion 3 — Attestation-layer coverage (≥3 of 4 flags fire)

**What it measures:** Do the layers actually do anything in production? A receipt that always says "all green" on every layer proves nothing. In real traffic, at least 3 of the 4 core flags (environmental gate, composition integrity, honeypot, gated composite) should fire on at least *some* sessions, demonstrating the layered model's differentiating power.

**Why this threshold:** 3-of-4 is the minimum bar for "the layered story holds in your environment." If fewer fire, either (a) the buyer's traffic is genuinely pristine (good news, but then the pilot doesn't prove the model works under attack) or (b) the layers are misconfigured and we need to fix that.

**What Buyer sees:** *"In 34 of 2,100 sessions (1.6%), the honeypot canary fired, indicating LLM-assisted answering. In 112 of 2,100 sessions (5.3%), the gated composite scored ≤0.30, indicating bot-like or unattended behavior. These are precisely the sessions SWS is designed to surface."*

### Criterion 4 — Integration time (5 days initial, 15 days full)

**What it measures:** Is SWS actually the low-friction integration we claim it is? If integration takes more than 5 business days for a single buyer-side engineer to drop the script tag and see a receipt, the *"one script tag"* pitch is wrong and we have a positioning problem.

**Why this threshold:** 5 days is long enough to absorb one round of security review and a DNS/firewall allow-list. 15 days is the full pilot-population rollout. Anything longer and SOC 2 / architecture review is the real blocker — valid, but not an SDK problem.

**What Buyer sees:** *"Initial receipt issued on day 3; full 400-seat deployment complete on day 11."*

### Criterion 5 — Joint case study (delivered within 5 business days)

**What it measures:** Did the pilot produce the asset that makes the production conversation happen? Without the case study, the pilot was a free demo. With it, you have the concrete language the buyer's procurement team needs to approve expansion — and the marketing asset you need to close the next five deals.

**Why this threshold:** 5 business days keeps the narrative fresh. Waiting 3 weeks for a case study means it gets deprioritized and never ships.

**What Buyer sees:** A 2–4 page co-authored document, anonymized to Buyer's specification, with the five criteria above filled in with the pilot's actual numbers.

---

## 4. What "done" looks like — the exit report

The exit report is a single document, 2–4 pages, delivered within 5 business days of the pilot window closing. Template below. Paste actual numbers into the bracketed fields.

> **Pilot Exit Report — [Buyer Name] × SWS Attention Protocol**
> **Pilot window:** [YYYY-MM-DD] to [YYYY-MM-DD]
> **Scope:** [One named module / activity / credential type]
> **Population:** [N sessions / seats / credentials]
>
> **1. Receipt issuance rate.** [N / N_completed = XX.X%]. Target ≥99.0%. [Met / Not met].
> **2. Independent verification rate.** [N / N_sampled = XX.X%] verified offline against SWS JWK. Target ≥99.5%. [Met / Not met].
> **3. Attestation-layer coverage.** [X of 4] layers fired during the pilot. Specific flag statistics: environmental gate [N fires], composition integrity [min / median], honeypot canary [N fires], gated composite [distribution]. Target ≥3 of 4. [Met / Not met].
> **4. Integration time.** Initial receipt: day [N]. Full rollout: day [N]. Targets: 5 and 15 business days. [Met / Not met].
> **5. Joint case study.** [Delivered on YYYY-MM-DD / In progress / Opted out].
>
> **Go / no-go on production expansion.** [Buyer's decision, in Buyer's own words.]
> **Open technical items.** [Any bugs, integration gaps, or architecture concerns surfaced during the pilot.]
> **Commercial next step.** [Pricing tier, MSA draft timeline, SOC 2 posture, signing-key rotation schedule.]

If the buyer's go/no-go is "no-go," the exit report still gets written — including the specific reason — because that's the information you need to fix the product, and because the buyer will respect you more for closing cleanly than for trying to keep the pilot alive past its scope.

---

## 5. What can go wrong — and how to handle it

### Criterion 1 fails (issuance rate <99%)

Most likely cause: buyer's page lifecycle calls `SWSAttention.init()` at the wrong time, or the completion handler is bypassed by the buyer's LMS. Fix: re-examine the integration hooks (`src/sdk/integration-examples.js`), add logging, and re-deploy. Extend the pilot 7 days to recapture the failure window if needed.

### Criterion 2 fails (verification rate <99.5%)

This is a bug we own. Common causes: receipt-field drift between SDK and verifier, JWK kid mismatch (especially during the signing-key rotation window), timestamp-anchor race conditions. Fix immediately and re-issue the affected receipts from the signing authority if possible. Document in the exit report regardless.

### Criterion 3 fails (only 1–2 layers fire)

Possible that the buyer's traffic is too clean to stress all four layers. Possible that the gated-composite threshold is too loose for their environment. Possible that the honeypot wasn't activated (it's opt-in per activity). Diagnose; explain in the exit report. This is rarely a "fail the pilot" result — usually a tuning conversation.

### Criterion 4 fails (integration drags past 15 days)

Almost always caused by a security review or allow-list conversation outside the SDK's scope. Not a product problem. Document the real blocker in the exit report (e.g., "security review required 9 additional days") so the production MSA can plan for it.

### Criterion 5 fails (case study not delivered)

Usually because you got pulled into the next thing. Don't. The case study is the pilot's output — skipping it means the pilot didn't happen.

---

## 6. Failure modes that should void the pilot entirely

Rare, but named here so nobody is surprised:

- **PII leak.** If any SWS receipt is found to contain a learner's email, name, phone, or other personally identifying field, the pilot terminates immediately. Root cause analysis within 48 hours. Privacy is the one claim we cannot afford to violate.
- **Signing key exposure.** If the Ed25519 signing key is exposed during the pilot, execute `rotation-staging/ROTATION_PLAN.md` within the 7-day grace window, re-issue affected receipts, document in the exit report.
- **Material misrepresentation.** If SWS makes a claim during the pilot that turns out to be false on inspection — a layer that doesn't fire as advertised, a Bitcoin anchor that doesn't resolve, a standards claim that doesn't conform — the pilot terminates and we issue a correction in writing.

These are the three ways a pilot ends badly. None have happened. Naming them here is a prerequisite for the next one going well.

---

**End of pilot-success-criteria.** If a buyer asks for criteria not covered above, tell me and I'll fold them into the template.
