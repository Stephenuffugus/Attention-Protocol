# PPP Call Cheat Sheet — Jane Eckstein

**Use during the call.** Phone-scrollable. ~1 minute end-to-end.

Read `BRIEFING_PPP_v2.md` once *before* the call (the long version). This file is for live use.

---

## Top-of-call (first 60 seconds)

- "Thanks for the time, Jane. Quick framing: I'm here to learn, not to sell. If at any point this isn't useful for you, tell me and we cut early."
- **Mind-if-I-record line:** *"Mind if I record this so I can give you my full attention instead of typing notes?"*
- The privacy anchor (drop it unprompted if she doesn't ask first):
  > *"Zero PII collected. Zero content stored. Zero URLs logged. The receipt is behavioral metrics plus a signature."*

## The 10 questions (in order)

1. *"Walk me through how you currently fill the 'measurement of learner progression' section in an Otsuka or AbbVie psychiatry IME proposal."*
2. *"What's changed in grantor expectations on that section in the last 12–18 months?"*
3. *"Last losing proposal — what did the 'measurement' section look like, and what would the winning version have needed?"*
4. *"How is your team thinking about AI-assisted post-test completion — physicians using ChatGPT to answer questions?"*
5. *"When ACCME comes for the next audit, what evidence do you produce that credits were earned by real engagement, not click-through?"*
6. *"In a typical activity, what % of completers does your QA flag as suspicious — and what happens to them?"*
7. *"Have you evaluated BioCatch, Roundtable, or any 'human verification' vendor? What killed it or kept it alive?"*
8. *"Hypothetically — if every accredited activity emitted a signed cryptographic receipt your auditor could verify offline, what's the first thing your compliance officer would ask?"*
9. *"Where does this conversation go inside PPP if it goes anywhere — who else is in the room before a measurement pilot is approved?"*
10. *"What would you need to see in the first two weeks of a pilot to know it was worth the next two?"*

## "How is it implemented?" — locked 30-sec answer

> *"One script tag on your activity page. The SDK records behavioral signals — pacing, scroll, keystroke timing, focus events. No PII, no content, no URLs. At end of activity, my server signs a JWT with an Ed25519 key and timestamps it to Bitcoin via OpenTimestamps. Your auditor verifies it offline against my published JWKS — no vendor call, no subpoena. It says a real human paid attention. It doesn't proctor and it doesn't capture what they typed."*

If she pushes: name the primitives — **Ed25519, JWT, JWKS, OpenTimestamps**. Vague = sounds made-up. Concrete = sounds real.

## "How does this look to ABPN / our auditor?"

> *"One paragraph. Ed25519-signed, Bitcoin-anchored via OpenTimestamps, verifiable offline against our published JWK. Your auditor pastes the JWT into our verifier or runs `scripts/verify-receipt.js` locally. No vendor call, no subpoena. I have a 21 CFR Part 11 clause-by-clause matrix I'll send you. ABPN has no position on cryptographic attestation yet, but the integrity story you can tell their surveyors is stronger than 'click-through completion.'"*

Bridge back: *"Has ABPN said anything yet about learner integrity in AI-augmented post-tests?"*

## "What's a good score?" / "How do we know what to credit?" — THE LOCKED ANSWER

This is the most important answer in the whole call. **A 0.55 doesn't mean anything as an absolute number.** Don't let her pin you to one. The threshold is *hers*, calibrated to *her* population.

> *"You run the protocol on a sample of 100 of your own activities — known-real psychiatrists doing real CME. You see the score distribution. You set the threshold at, say, the 5th percentile of that distribution — which means 95% of your real completions clear it. Then you run a known bot against the same activity and confirm it scores below that threshold. The threshold is yours, calibrated to your population. ACCME doesn't have to accept a number I picked; they have to accept a methodology applied to your data."*

The frame: **calibration protocols are what regulated industries actually buy. Absolute scores are what marketing decks sell.** Same way Pfizer can't say "this drug works" — they run Phase III on a defined population and show the effect there. CME measurement is the same.

The doc that backs this up: **`docs/threshold-derivation-methodology.md`**. Offer to send it. It contains the 4-step calibration protocol, sample-size statistics, FP/FN tradeoffs, recalibration cadence, edge cases (mobile, accessibility, ESL), and a reference implementation of how PPP would actually run it.

## "How do we know your stuff works?" — three-layer answer

> *"Three independent layers. Cryptographic correctness — the receipts verify offline against my published key, anyone can run the verifier, no vendor in the loop. Methodology correctness — every behavioral signal is from peer-reviewed cognitive science and unit-tested against published thresholds; I can hand you the citation list. Population correctness — for your specific deployment, you calibrate the threshold to your own user distribution; my methodology document tells you exactly how. The first two are checkable today. The third is what a 60-day pilot would produce. None of it requires you to trust me — every claim is independently verifiable."*

That answer **flips the burden** from "Stephen has to be famous" to "here are the three independently checkable things."

## "Why aren't you certified / recognized / why should we trust an unknown vendor?"

> *"Honest answer — nobody in this lane is certified yet because the lane is new. ACCME's December 2025 AI guidance explicitly says they don't have a position on cryptographic attestation. Recognition can't come before the first credible vendor exists. What I can offer instead is a stack: patent filed, 980+ tests, 7 rounds of hostile adversarial review, open verifier code, and a published threshold-derivation methodology any of your auditors can validate. None of that is 'certification' alone. Stacked, they're a multi-source legitimacy story no incumbent in this lane has either. I'd rather be transparent about where I am than fake a stamp."*

Pathways to formal certification, if she pushes for "what's the path":
- **Cryptographic audit** by Trail of Bits / NCC Group / Cure53 ($25–75k, 2–6 weeks) — Stripe and Coinbase use this same pathway
- **Academic peer review** at USENIX Security or a CME methodology journal (4–6 months)
- **Granted patent** (provisional → utility, 18–36 months, currently provisional)
- **ACCME public-comment** on the December 2025 AI guidance (1 week, free, on the public record)

> *"I'm sequencing those for the next 6–12 months. If a pilot at PPP works, the case study from it accelerates the academic publication. If you want my opinion: nobody waits for full certification before adopting in an emerging field. The early adopters shape what 'certified' eventually means."*

## "What if you go out of business?"

> *"Receipts are mathematical objects, not vendor-locked. JWKS is public. Verifier code is open. JWT format is documented. Cache the public key once and every receipt you've ever issued stays verifiable forever."*

## "Where does our data live?"

> *"Behavioral signals are computed client-side. Only the final JWT — signature + scores, not raw data — hits the server. Your environment can host the whole pipeline; the only required public dependency is my JWKS endpoint, and even that's cacheable."*

## "How do I know you're not making this up?"

> *"The receipt verifies offline. Inputs are the public key and the JWT — if it verifies, the math says it's authentic. Patent filed. Verifier live. Whole codebase open to anyone who pilots."*

---

## Never-say

- "We're 99% accurate"
- "Our team can have that on your desk Monday" (use *I*, not *we*)
- "We're already working with several enterprises"
- "Don't worry about SOC 2"
- "Most of your competitors..."
- "AI is the threat" (specific: *AI-assisted post-tests*)

## Always-say (end-of-call line)

> *"What would you need to see in the first two weeks of a 60-day pilot to know it was worth the next two weeks?"*

## Free-pilot ask (only if warm)

- 1 accredited activity, ≤5,000 sessions, 60 days
- Free; you get a co-authored case study + frank post-mortem
- One script tag, no backend changes
- Their QA self-verifies every receipt

---

## The frame (silently repeat to yourself if you start sweating)

> *"I built something I think solves a problem this person has. I haven't earned the right to assume that yet. I'm here to learn whether the problem I'm targeting matches their reality."*

Listening earns the next conversation. Selling does not.
