# CEC Call Cheat Sheet — Joni Fowler

**Use during the call.** Phone-scrollable. ~1 minute end-to-end.

Read `BRIEFING_CEC_v2.md` once *before* the call. This file is for live use. Glossary terms reference `outreach-drafts/PPP_GLOSSARY.md` (most apply identically) plus the CEC-specific terms in section 7 below.

---

## Top-of-call (first 60 seconds)

- "Thanks for the time, Joni. Quick framing: I'm here to learn, not to sell. If at any point this isn't useful for you, tell me and we cut early."
- **Mind-if-I-record line:** *"Mind if I record this so I can give you my full attention instead of typing notes?"*
- **The chart-note anchor** (the cardiology version became the "lab result vs chart note" line — for oncology + PharmD audience use the equivalent):
  > *"Cryptographically signed receipt — auditable artifact your auditor verifies offline. The closest analogy in your world is the difference between a PROC report you'd attach to a study record vs. a vendor-summary slide. We ship the PROC report."*

## The hook (memorize)

> *"Oncology IME is the most rigorously-scored category in pharma-funded CME — every Lilly or Genentech or AstraZeneca proposal scores measurement evidence harder than it did two years ago. CE Concepts already operates at Joint Accreditation with Commendation, which is the highest bar ACCME issues. The pressure isn't your accreditation — it's the rubric inside winning grant proposals. That's where I think we add a paragraph no other MEC can write yet."*

## The 10 questions (in order)

1. *"Walk me through how you currently fill the 'measurement of learner progression' section in a Lilly or Genentech oncology IME proposal — what does that look like today?"*
2. *"What's changed in oncology grantor expectations on that section in the last 12–18 months?"*
3. *"Last losing oncology proposal — what did the 'measurement' section look like, and what would the winning version have needed?"*
4. *"How is your team thinking about AI-assisted post-test completion — physicians using ChatGPT to answer questions?"*
5. *"When ACCME comes for the next Joint-Accreditation re-review, what evidence do you produce that credits were earned by real engagement, not click-through?"*
6. *"In a typical accredited activity, what % of completers does your QA flag as suspicious — and what happens to them?"*
7. *"Have you evaluated BioCatch, Roundtable, or any 'human verification' vendor? What killed it or kept it alive?"*
8. *"Hypothetically — if every accredited activity emitted a signed cryptographic receipt your auditor could verify offline, what's the first thing your compliance team would ask?"*
9. *"Where does this conversation go inside CEC if it goes anywhere — and how does the KnowFully relationship factor in for a pilot vs. a paid contract?"*
10. *"What would you need to see in the first two weeks of a pilot to know it was worth the next two?"*

## "How is it implemented?" — locked 30-sec answer

> *"One script tag on your activity page. The SDK records behavioral signals — pacing, scroll, keystroke timing, focus events. No PII, no content, no URLs. At end of activity, my server signs a JWT with an Ed25519 key and timestamps it to Bitcoin via OpenTimestamps. Your auditor verifies it offline against my published JWKS — no vendor call, no subpoena. It says a real human paid attention. It doesn't proctor and it doesn't capture what they typed."*

If she pushes: name the primitives — **Ed25519, JWT, JWKS, OpenTimestamps**. Vague = sounds made-up. Concrete = sounds real.

## "How is this different from BioCatch / Roundtable?"

The hardest question for the CEC audience. Locked answer:

> *"BioCatch is the leading behavioral fraud detector. They classify, they output a score. Roundtable is the YC-backed proof-of-humanness lane. We don't compete on classifier accuracy. We ship a signed audit artifact your grantor can verify offline six months later without calling us. Different artifact entirely. The closest analogy in your world is the difference between a vendor-summary slide and the actual signed PROC document — we're the signed document."*

Bridge back: *"Has CEC ever evaluated BioCatch or Roundtable specifically? What killed it or kept it alive?"*

## "What's a good score?" / "How do we know what to credit?" — THE LOCKED ANSWER

> *"A 0.55 doesn't mean anything as an absolute number. The threshold is yours, calibrated to your population. You run the protocol on a sample of 100 of your own activities — known-real oncologists doing real CME. You see the score distribution. You set the threshold at, say, the 5th percentile of that distribution. ACCME doesn't have to accept a number I picked; they have to accept a methodology applied to your data."*

Doc that backs this: `docs/threshold-derivation-methodology.md`. Offer to send it. For an auditor's perspective: `docs/auditor-walkthrough.md` — step-by-step verification with copy-pasteable commands.

## "How do we know your stuff works?" — three-layer answer

> *"Three independent layers. Cryptographic correctness — the receipts verify offline against my published key, anyone can run the verifier, no vendor in the loop. Methodology correctness — every behavioral signal is from peer-reviewed cognitive science and unit-tested against published thresholds. Population correctness — for your specific deployment, you calibrate the threshold to your own user distribution; the methodology document tells you exactly how. The first two are checkable today. The third is what a 60-day pilot would produce. None of it requires you to trust me — every claim is independently verifiable."*

## "Why aren't you certified / recognized?"

> *"Honest answer — nobody in this lane is certified yet because the lane is new. ACCME's December 2025 AI guidance explicitly says they don't have a position on cryptographic attestation. Recognition can't come before the first credible vendor exists. What I can offer instead is a stack: patent filed, 980+ tests, 7 rounds of hostile adversarial review plus the 2026-05-07 production-tightening pass, open verifier code, and a published threshold-derivation methodology any of your auditors can validate. None of that is 'certification' alone. Stacked, they're a multi-source legitimacy story no incumbent in this lane has either. I'd rather be transparent about where I am than fake a stamp."*

---

## Never-say with this audience

- "BioCatch sucks" (they don't, you'd lose credibility)
- Behavioral-science jargon in the first 5 minutes (Fitts, Hick, microsaccades, fractal scaling, two-thirds power law). Hold these until she asks for the depth.
- "We're going to revolutionize CME" (boutique founders hear this constantly and it's a tell)
- "We work with Pfizer / J&J / etc." (you don't yet)
- "We're 99% accurate" (you don't know yet on a real population)

## Always-say with this audience

- "Cryptographically signed receipt" (lands clean — pharmacists sign attestations daily, the artifact mental model is right)
- "Joint Accreditation with Commendation is rare — that's a real signal" (acknowledges her actual achievement, lands genuinely)
- "I'd rather your team validate the claim than take it from me" (the offer-the-pilot framing)
- "What would you need to see in the first two weeks of a 60-day pilot to know it was worth the next two weeks?" (end-of-call conversion question)

## The 60-day pilot ask (only if she's warm at end of call)

- 1 accredited activity (oncology preferred)
- ≤5,000 learner-sessions
- 60 days
- **Free** for them; you get a co-authored case study and a frank post-mortem
- One script tag, no backend changes
- Their QA team self-verifies every receipt
- **KnowFully consideration:** if the pilot scope stays inside Joni's signing authority (free + no contract), KnowFully procurement does not need to be involved. A paid follow-on contract would.

---

## 7. CEC-specific terms (delta from PPP_GLOSSARY)

| Term | What it means | Why it matters here |
|---|---|---|
| **Joint Accreditation (JA)** | Single accreditation covering ACCME (physician CME) + ACPE (pharmacy CE) + ANCC (nursing CE). Hardest accreditation to earn. | CE Concepts holds JA with Commendation — the highest-tier signal ACCME issues. They already operate at the integrity bar most MECs aspire to. |
| **JA with Commendation** | Top recognition tier within Joint Accreditation. Awarded December 2022 to CEC. | Acknowledges their real achievement. Don't lecture them on compliance; they've earned the badge you're talking about. |
| **KnowFully Learning Group** | Parent company since May 2021. Eric Cantor, CEO. Owns CME Outfitters, CE Concepts, and other CME brands. | A free pilot stays inside Joni's authority. A paid contract crosses into KnowFully procurement. Don't accidentally invoke procurement in the discovery call. |
| **CME Outfitters** | Sister brand under KnowFully — another CME provider. | Don't mention as competitor; could be a future cross-reference within the family. |
| **Oncology IME** | Pharma-funded oncology CME — the highest-stakes category. Lilly, Genentech, AstraZeneca, Bristol-Myers Squibb, Merck Oncology, Pfizer Oncology are the major grantors. | Lead the conversation here, not cardiology. Their About page literally says "preponderance of oncologic disease states." |
| **PharmD / BCPP** | Doctor of Pharmacy / Board Certified Psychiatric Pharmacist. Joni's credentials. | She's a pharmacist by training, not a physician or business-school grad. Pharmacy + interprofessional education is her vocabulary. |
| **PROC document** | Pharmacy / clinical study procedural document. Pharmacists sign these. | The right analogy when explaining "we ship a signed audit artifact." Cardiology used "chart note"; oncology / pharmacy uses "PROC document" or "signed study record." |

---

## The frame (silently repeat to yourself if you start sweating)

> *"I built something I think solves a problem this person has. I haven't earned the right to assume that yet. I'm here to learn whether the problem I'm targeting matches their reality."*

Listening earns the next conversation. Selling does not.
