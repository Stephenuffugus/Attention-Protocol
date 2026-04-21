# Pfizer Inc. — Prospect Dossier
## Wedge: 21 CFR Part 11 / IME grant outcomes (both apply)

## Why now

Pfizer runs two buyer surfaces relevant to SWS:

1. **Internal compliance training (Part 11 side).** Every commercial and GxP-regulated role at Pfizer sits through periodic training whose completion records must satisfy 21 CFR Part 11 audit-trail and electronic-records requirements. FDA issued 327 Part 11 warning letters in H2 2025 per the cold-email-template B citation (cross-check before sending).
2. **Pfizer Independent Medical Education (IME) grants (outcomes side).** Pfizer's 2025 IME RFPs explicitly score "measurement of learner progression" — a criterion that rewards any MEC bringing stronger outcomes evidence, which in turn puts pressure on MECs to source better attestation upstream from vendors like SWS.

Either wedge lands; **lead with #1** because compliance pain is sharper and the buying process faster than grant-making.

## Who to talk to

- **VP Compliance / Head of Global Compliance** — budget authority for training audit exposure. [VERIFY name on LinkedIn: search `site:linkedin.com/in VP Compliance Pfizer 21 CFR Part 11`]
- **Director of GxP Training / QA Systems** — operational owner. [VERIFY]
- **Senior Director, Medical Affairs Grants** — IME-side only. [VERIFY]

Do not cold-email C-level (CEO, General Counsel). Start one level below.

## Pitch hook

> "Pfizer's 2025 IME RFPs score outcomes rigor. On the compliance side, FDA's H2 2025 enforcement actions on Part 11 tripled. Both problems converge on one missing artifact: a cryptographically verifiable receipt that a specific human — not a bot, not a clicker, not a GPT — completed the training. That's what SWS issues. A 20-minute demo shows the receipt round-trip. Your QA team can validate offline in 10 minutes."

## Procurement cycle

[VERIFY] Pfizer vendor onboarding typically includes: ISO-27001 questionnaire, data-flow diagram, security architecture review, privacy impact assessment, and master services agreement. Budget for a 60-day pilot on a single module: likely in Director discretionary band (<$50K) so procurement isn't painful.

## Likely objections + rebuttals

1. **"We already have an LMS with completion tracking."**
   Rebuttal: Completion tracking answers *did someone click through?*. It does not answer *did a human actually engage, versus a bot or shared login?*. Our receipt answers that — and does so in a way your auditor can verify offline without calling us. That's the new bar post-H2-2025 enforcement.

2. **"What's your SOC 2 / ISO 27001 posture?"**
   Rebuttal (honest): Not certified yet. Solo founder, patent-pending, pre-Series A. I can provide the compliance matrix (`docs/COMPLIANCE_MATRIX.md`), security architecture (`docs/SECURITY_ARCHITECTURE.md`), and pilot under a tight MSA with Pfizer's security team. This is a 60-day measurement pilot, not a production system deployment.

3. **"How do you detect bots? Our vendor [X] claims 99.8%."**
   Rebuttal: We don't pitch a single-number classifier. The receipt carries *layered evidence* — environmental gate (BotD), honeypot canary, composition integrity, behavioral composite. An auditor reviews the layers; no single number is the verdict. Read `SEVEN_LAYER_DEEP_DIVE.md` §10 for what we intentionally don't claim.

## Risk flags

- Pfizer RFPs can take 9–12 months end-to-end. Pilot-first is the right path.
- Avoid name-dropping other pharma; buyer anonymity is a professional norm.
- Never promise "detects AI" — the rigorous version is "LLM-assisted composition integrity signal" in the typed-response phase.

## Priority: A+

If only one target gets a personalized email this week, it's this one.
