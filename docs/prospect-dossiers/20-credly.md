# Credly (Pearson) — Prospect Dossier
## Wedge: OpenBadges 3.0 credentialing / channel partnership (Template C)

## Why now

Credly is the largest Open Badges issuer globally, owned by Pearson. Their product issues digital credentials on top of a very wide array of LMS and training platforms — but Credly itself does not measure behavioral attention during the learning activity. That's a structural gap SWS fills natively, because every SWS receipt emits as a clean OpenBadges 3.0 AchievementCredential.

1. **Credly's enterprise tier competes on credential rigor.** A Credly badge backed by a cryptographic attention receipt is the first credential in their catalog that is verifiable *all the way down* — badge → behavior → Bitcoin block. No other badging platform has this.
2. **OEM or API-partnership model.** This is a channel play, not a direct-sell wedge. Credly brings distribution across hundreds of enterprise LMS integrations; SWS brings the attention-attestation evidence underneath.

## Who to talk to

- **VP Product / Head of Platform, Credly** — owns roadmap. [VERIFY name on LinkedIn: `site:linkedin.com/in Credly VP Product OR Platform`]
- **Head of Standards / OpenBadges** — owns 1EdTech spec alignment. [VERIFY]
- **VP Partnerships / Business Development** — partnership owner. [VERIFY]
- **CTO / Head of Engineering, Credly** — technical integration decision. [VERIFY]

## Pitch hook

> "Credly issues the badge. You don't measure the learner's behavioral engagement during the activity — that's the LMS's job, and most LMSs don't do it. SWS issues the layer underneath: a signed W3C Verifiable Credential bundling a 15-signal behavioral composite, environmental check, composition integrity signal, Ed25519 signature, and OpenTimestamps Bitcoin anchor, cleanly emitting as an OpenBadges 3.0 AchievementCredential. A Credly badge backed by a SWS attention receipt is the first credential in your catalog cryptographically verifiable all the way down. Receipt, not classifier."

## Procurement cycle

[VERIFY] Pearson parent-company partnership cycles can be long (3–6 months for formal partnership agreements). A narrower API-integration pilot with Credly's product team may move faster — 45–75 days — before escalating to Pearson-level commercial terms.

## Likely objections + rebuttals

1. **"Why would we bundle another vendor's receipt into our stack?"**
   Rebuttal: Two options — API-level (Credly consumes SWS receipts per-credential, co-marketed as "verified attention credentials") or OEM (Credly white-labels into enterprise tier, per-credential pricing). Both preserve Credly as the credential of record. SWS is the evidence layer, not a competing badge.

2. **"We could build this ourselves."**
   Rebuttal (honest): You could build the behavioral composite. Harder pieces: the patent-pending receipt structure (SWS-PROV-001), published JWK infrastructure for third-party offline verification, and OpenTimestamps Bitcoin-anchor pipeline. Build-from-scratch is 12–18 months to parity; partnership is weeks.

3. **"How does this interact with our existing 1EdTech OpenBadges 3.0 issuance?"**
   Rebuttal: Every SWS receipt emits as a conformant OpenBadges 3.0 AchievementCredential. No schema divergence; it slots into the existing issuance pipeline. Evidence kit includes sample payloads.

## Risk flags

- Pearson parent-company procurement is the main friction. Start at Credly product layer, escalate only when terms matter.
- Partnership framing can blur into free integration work. Keep terms written.

## Priority: A+

Highest-leverage channel partner on the list. One deal here compounds across hundreds of Credly enterprise customers.
