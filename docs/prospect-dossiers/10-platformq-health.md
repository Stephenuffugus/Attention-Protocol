# PlatformQ Health — Prospect Dossier
## Wedge: CME outcomes rigor (Template B) + platform OEM (Template C, secondary)

## Why now

PlatformQ Health is a tech-forward CME platform / MEC hybrid — they build their own delivery infrastructure rather than living on a third-party LMS. That posture means two wedges apply simultaneously:

1. **Pfizer 2025 IME RFPs** score "measurement of learner progression." PlatformQ competes on both grant outcomes and platform differentiation.
2. **ACCME December 2025 AI guidance** opened the learner-integrity evidence category. A tech-forward platform can productize this faster than traditional MECs can adopt it — turning SWS integration into a platform-level feature they offer to their own MEC clients.

## Who to talk to

- **VP Product / Head of Platform** — owns platform roadmap. [VERIFY name on LinkedIn: `site:linkedin.com/in PlatformQ Health VP Product OR Platform`]
- **Director of Accreditation / Outcomes** — CME-side owner. [VERIFY]
- **CTO / Head of Engineering** — technical integration decision. [VERIFY]

## Pitch hook

> "PlatformQ's edge is that you own the stack. That means you can ship learner-integrity receipts as a platform feature your MEC clients sell inside their IME proposals — before standalone MECs can even RFP a vendor for it. A signed, Bitcoin-anchored engagement receipt, Ed25519-verifiable offline against our public JWK, becomes PlatformQ's differentiator at the platform layer. Receipt, not classifier."

## Procurement cycle

[VERIFY] Tech-forward platform procurement often moves faster than traditional MEC procurement — direct engineering review rather than vendor questionnaire cycles. Expect a technical evaluation call, then a narrow pilot on one platform feature or one MEC client activity. ~45–75 day pilot realistic.

## Likely objections + rebuttals

1. **"We could build this ourselves."**
   Rebuttal (honest): You could build the behavioral composite. The harder pieces are the patent-pending receipt structure (SWS-PROV-001), the published JWK infrastructure for third-party offline verification, and the OpenTimestamps Bitcoin-anchor pipeline. Build-vs-partner math favors partner; build-from-scratch is 12–18 months to parity.

2. **"What's the partnership model?"**
   Rebuttal: Two options — API-level (PlatformQ consumes SWS receipts per-activity) or OEM (PlatformQ white-labels into its enterprise tier). Both are on the table. Per-credential pricing under OEM.

3. **"How does this interact with our xAPI pipeline?"**
   Rebuttal: Every SWS receipt emits a clean xAPI statement + an OpenBadges 3.0 AchievementCredential. Drops into existing pipelines. Evidence kit includes the sample payloads.

## Risk flags

- Tech-forward buyers ask harder technical questions earlier. Have `SEVEN_LAYER_DEEP_DIVE.md` and the security architecture ready.
- Partnership framing can blur into "free integration work." Keep partnership terms written down.

## Priority: A+

Highest strategic value on the MEC list — partnership here compounds across their clients.
