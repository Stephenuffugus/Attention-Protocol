# Prova Call Cheat Sheet — Rob McCarry

**Use during the call.** Phone-scrollable. ~1 minute end-to-end.

Read `BRIEFING_PROVA_v2.md` once *before* the call. This file is for live use. Glossary: `outreach-drafts/PPP_GLOSSARY.md` covers most CME terms; CEC's `CALL_CHEAT_SHEET_CEC.md` §7 has Joint-Accreditation context if it comes up.

---

## Top-of-call (first 60 seconds)

- "Thanks for the time, Rob. Quick framing: I'm here to learn, not to sell. If at any point this isn't useful for you, tell me and we cut early."
- **Mind-if-I-record line:** *"Mind if I record this so I can give you my full attention instead of typing notes?"*
- **The privacy anchor:**
  > *"Zero PII collected. Zero content stored. Zero URLs logged. The receipt is behavioral metrics plus a signature."*

## The hook (memorize)

> *"You've spent two decades building outcomes-based education programs across oncology, neurology, virology, and rheumatology. Outcomes used to mean post-test deltas and NPS. The 2026 grantor rubric is asking for something procedural attestation can't produce — cryptographic evidence the engagement was real and not AI-assisted. CE outcome data is your specialty; this is the next layer underneath it."*

That sentence is calibrated to Rob specifically. He's been building outcomes platforms since 2005-ish; the "next layer underneath" framing acknowledges his work without diminishing it.

## The 10 questions (in order)

1. *"Walk me through how Prova currently fills the 'measurement of learner progression' section in a Lilly or Pfizer or BMS proposal — what does that look like today?"*
2. *"What's changed in grantor expectations on that section since 2024?"*
3. *"Last losing proposal — what did the 'measurement' section look like, and what would the winning version have needed?"*
4. *"How is your team thinking about AI-assisted post-test completion?"*
5. *"When ACCME comes for the next audit, what evidence do you produce that credits were earned by real engagement, not click-through?"*
6. *"In a typical activity, what % of completers does your QA flag as suspicious — and what happens to them?"*
7. *"Have you evaluated BioCatch, Roundtable, or any 'human verification' vendor? What killed it or kept it alive?"*
8. *"Hypothetically — if every accredited activity emitted a signed cryptographic receipt your auditor could verify offline, what's the first thing your compliance team would ask?"*
9. *"Where does this conversation go inside Prova if it goes anywhere — Director discretionary for a free pilot, or does this go to a CEO/COO?"*
10. *"What would you need to see in the first two weeks of a pilot to know it was worth the next two?"*

## "How is it implemented?" — locked 30-sec answer

> *"One script tag on your activity page. The SDK records behavioral signals — pacing, scroll, keystroke timing, focus events. No PII, no content, no URLs. At end of activity, my server signs a JWT with an Ed25519 key and timestamps it to Bitcoin via OpenTimestamps. Your auditor verifies it offline against my published JWKS — no vendor call, no subpoena. It says a real human paid attention. It doesn't proctor and it doesn't capture what they typed."*

If pushed: name the primitives — **Ed25519, JWT, JWKS, OpenTimestamps**.

## "What's your false-positive rate?" — Rob's expected hardest question

This is THE question Rob will ask. He's built outcomes platforms; he'll evaluate the receipt as a measurement instrument first.

Locked answer (with measured 2026-05-07 numbers):

> *"On the gated composite against our six measured bot profiles, every bot caps below the lowest human floor. Behavioral-only gap is uncomfortable on its own — Slow Mimic lands at 0.404, lowest measured human at 0.431, that's a 0.027 margin. But the layered defenses close it. Environmental gate plus composition integrity caught 100% of the LLM-in-the-loop runs we did this evening (Claude Sonnet 4.6 driving Puppeteer against our live demo, n=9). Server-side recompute and trace-novelty fingerprint add two more layers. The bypass cost has shifted from $50/mo + 56h pre-Wall to $5-20k/mo + 200-400h post-Wall and post-empirical-validation. I haven't run it on a real outcomes-grade CME population. That's literally the pilot question."*

Bridge phrase: *"What FPR would your team treat as the line? What forces remediation manually vs. accept?"*

## "What's a good score?" / "How do we know what to credit?"

> *"A 0.55 doesn't mean anything as an absolute number. The threshold is yours, calibrated to your population. You run the protocol on a sample of 100 of your own activities. You see the score distribution. You set the threshold at, say, the 5th percentile. ACCME doesn't have to accept a number I picked; they have to accept a methodology applied to your data."*

Doc that backs this: `docs/threshold-derivation-methodology.md`. Companion for an auditor's perspective: `docs/auditor-walkthrough.md`. **For Rob specifically, send both — he'll read them before any follow-up call.**

## "How do we know your stuff works?" — three-layer answer

> *"Three independent layers. Cryptographic correctness — receipts verify offline, no vendor in the loop. Methodology correctness — every signal from peer-reviewed cognitive science, unit-tested. Population correctness — you calibrate the threshold to your own user distribution, methodology document tells you exactly how. The first two are checkable today. The third is what a 60-day pilot would produce. None requires you to trust me — every claim is independently verifiable."*

## "Why aren't you certified / recognized?"

> *"Honest answer — nobody in this lane is certified yet because the lane is new. ACCME's December 2025 AI guidance explicitly says they don't have a position on cryptographic attestation. Recognition can't come before the first credible vendor exists. What I can offer: patent filed, 980+ tests, 7 hostile-review rounds plus a 2026-05-07 production-tightening pass closing 6 same-pattern gaps, open verifier code, published methodology any auditor can validate. Stacked, that's a multi-source legitimacy story no incumbent has either."*

---

## Pre-empt the engineering objection

Mid-size MECs flag headcount cost as the #1 concern. If Rob raises it:

> *"One script tag. The evidence kit self-qualifies in 10 minutes. Your team writes init/render/decision/completion glue, about 30 lines, plus a template injection. I deliver the SDK, the xAPI adapter, the verifier, the JWKS, and 10 hours synchronous Slack support during the pilot. Production rollout is 2-4 engineer-weeks; the first receipt is 1-3 engineer-days. If you can spare 1 engineer-week of attention, I make sure that week is enough."*

## Pharma sophistication framing

Rob has worked Pfizer / Lilly / BMS / AstraZeneca grants for 20 years. He'll respect concrete framings of grantor expectations.

> *"When a Pfizer reviewer asks 'how do you know learners actually engaged with the activity, given that AI-assisted post-tests are a documented concern,' your current answer is post-test deltas plus NPS. Your competitor's answer is the same. The next reviewer cycle, the winning answer is 'here's the cryptographic receipt the learner generated, and here's how your team verifies it offline.' I'm betting the receipt flips a tied proposal."*

---

## Never-say with this audience

- *"BioCatch sucks"* — they're real, don't lose credibility
- Behavioral-science jargon in the first 5 minutes (Fitts, Hick, microsaccades, fractal scaling)
- *"Medscape / DKBmed are way ahead of you"* — true comparatively but condescending
- *"AI is the threat"* — be specific: *"AI-assisted post-tests"*
- *"We just need 10 minutes of your engineer's time"* — mid-size MECs hear this and roll their eyes
- *"We're 99% accurate"* — you're not, and Rob will know

## Always-say

- *"Cryptographically signed receipt"* — concrete artifact framing
- *"The rubric is harder. Your faculty depth and outcomes work are the same."* — validates his reality
- *"I'd rather your team validate the claim than take it from me."* — pilot framing
- *"I built this; I'm the founder, no team behind me yet — that's why I want a pilot before scaling claims."* — honest stage acknowledgment
- *"What would you need to see in the first two weeks of a 60-day pilot to know it was worth the next two weeks?"* — end-of-call conversion question

## The 60-day pilot ask (only if warm at end of call)

- 1 accredited activity (Rob's choice — his strongest specialty is the right pick)
- ≤5,000 learner-sessions
- 60 days
- **Free** for them; you co-author a case study they can put on the Prova website AND in the next Pfizer/Lilly/BMS proposal
- One script tag, no backend changes
- Their QA team self-verifies every receipt

The "case study Rob can use in next proposal" is the real value-trade. He gets rubric ammunition. You get a real-data datapoint from an outcomes-fluent operator.

---

## The frame (silently repeat to yourself if you start sweating)

> *"I built something I think solves a problem this person has. I haven't earned the right to assume that yet. I'm here to learn whether the problem I'm targeting matches their reality."*

Rob has thought about outcomes for 20 years. Listen. He'll teach you something useful in the first 10 minutes.
