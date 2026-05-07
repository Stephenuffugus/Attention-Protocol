# Public Comment — ACCME December 2025 Guidance on AI-Augmented Assessments

**To:** Accreditation Council for Continuing Medical Education
**Re:** Guidance on AI-Augmented Assessments in Continuing Medical Education (December 2025)
**From:** Stephen Furpahs, Founder, SWS Strategic Media LLC
**Date:** [DRAFT — to be filed 2026-05-XX]
**Contact:** stephenfurpahs@gmail.com

---

## Summary recommendation

The December 2025 guidance correctly names AI-augmented assessment integrity as a live problem facing accredited continuing medical education. The guidance does not yet take a position on the technical mechanisms by which a provider could demonstrate that credit was awarded for genuine engagement rather than AI-assisted completion.

**This comment proposes that a future revision of the guidance recognize cryptographic attention-integrity attestation — including the SWS Attention Protocol or any methodology meeting equivalent independence and verifiability criteria — as one valid form of evidence under the existing standards.**

The proposal is methodology-agnostic by design. It does not require ACCME to bless any single vendor or technology. It establishes the criteria a methodology must meet to be cited by an accredited provider as evidence of learner engagement. Any vendor — including SWS — must meet the criteria to be cited.

---

## Statement of interest

I am the solo founder and inventor of the SWS Attention Protocol (USPTO Provisional SWS-PROV-001, filed 2026-03-17). The protocol produces cryptographically-signed, offline-verifiable receipts attesting that a real human paid attention to a designated screen for a designated duration with measurable behavioral signals consistent with peer-reviewed cognitive-science thresholds.

The protocol is deployed at sws-attention-proofs.web.app, with full source available for independent inspection, 270+ automated tests across 45 suites, and seven rounds of hostile adversarial review documented in version-controlled commits. The threshold-derivation methodology that any deploying organization would use to calibrate the protocol to its own population is published as a separate methodology document.

I am applying to Y Combinator Summer 2026 with this protocol as the central technical contribution. My commercial interest in this comment is therefore real and should be weighed accordingly. My professional interest, however, is broader: an AI-resilient CME ecosystem benefits every participant, including providers I may never sell to.

---

## The problem the guidance correctly names

The December 2025 guidance identifies a category of failure: a learner using an AI assistant (such as ChatGPT, Claude, or any large language model) to answer post-test questions, complete reflective text fields, or otherwise satisfy assessment requirements without genuine engagement. Existing assessment integrity tools — passing post-test scores, completion timestamps, IP-based session checks, attestation checkboxes — do not detect this failure mode because the assistant produces correct, plausible answers in the learner's identifiable session.

This is an integrity gap independent of accreditation policy. The procedural evidence accredited providers currently produce (a passing score, a completion record) cannot, by its nature, distinguish between an engaged human and a human-with-AI-assistant. Any audit that depends on procedural evidence inherits the same gap.

---

## The class of evidence the guidance does not yet address

A complete defense against AI-augmented completion requires evidence that:

1. **The activity was completed by a real human** — not a bot, not a script, not a recorded-and-replayed session.
2. **The human's behavioral pattern during completion is consistent with genuine engagement** — pacing, dwell, motor signatures, focus patterns within published bounds for the cognitive task.
3. **The evidence is independently verifiable** — by the accredited provider, by ACCME surveyors, by a grantor's compliance team, without requiring a vendor to be available, online, or in business.
4. **The evidence is tamper-resistant** — cryptographically bound to the specific session, with a published verification path.

No procedural mechanism — score, attestation, completion timestamp — meets these four criteria. Cryptographic attention-integrity attestation does.

---

## The recommended addition to the guidance

We propose ACCME consider adding to a future guidance revision a paragraph in the form of:

> *"An accredited provider may cite, as evidence of learner engagement supporting credit award, a cryptographically-signed attention-integrity receipt produced by a methodology meeting the following criteria: (a) the receipt is signed by an asymmetric key whose public verification material is published by the issuer at a stable URL; (b) the receipt verifies offline against the published verification material without requiring the issuer's infrastructure to be available or in operation at the time of verification; (c) the receipt is cryptographically bound to the specific session it attests; (d) the methodology used to derive any thresholds applied to the receipt's behavioral signals is published as a reference document; and (e) the methodology and signing implementation are open to independent third-party adversarial review.*
>
> *Receipts meeting these criteria — including but not limited to those produced by the SWS Attention Protocol or equivalent independently-verifiable schemes — may be cited in audit responses, grantor reports, and accredited-activity completion records as one valid form of engagement evidence supporting the credit award."*

The criteria are deliberately methodology-agnostic. They establish what valid evidence must look like, not which vendor must produce it. Any provider, accreditor, or auditor can independently verify whether a particular receipt meets the criteria. No single vendor — including SWS — can capture the lane.

---

## Why this matters now

Three factors converge in 2026:

1. **The pressure is real and growing.** Pharma grantors are scoring "measurement of learner progression" sections of IME proposals more strictly than they did two years ago. The 2025 Pfizer IME RFP cycle is a documented inflection point.
2. **No incumbent vendor has shipped a complete solution.** Existing behavioral-fraud-detection tools (BioCatch, Roundtable, Cloudflare Privacy Pass, World ID) ship scores, identity-tokens, or rate-limited APIs — but not signed, offline-verifiable, cryptographically-bound receipts that an ACCME surveyor could accept as audit-grade evidence.
3. **The market is making vendor-by-vendor decisions in the absence of guidance.** Without a recognized methodology, accredited providers are at risk of either ignoring the problem (and accumulating audit liability) or adopting incompatible vendor-specific solutions (and creating fragmentation).

ACCME taking a position — even a methodology-agnostic one — gives every accredited provider a compass. The cost of guidance is low; the cost of accumulated procedural debt across the ecosystem is high.

---

## What we are NOT asking

- **We are not asking ACCME to endorse the SWS Attention Protocol specifically.** The criteria proposed apply equally to any future vendor or open-source methodology meeting the same bar.
- **We are not asking ACCME to mandate cryptographic attestation.** The proposal is permissive — accredited providers *may* cite such evidence; nothing requires them to.
- **We are not asking ACCME to set absolute behavioral thresholds.** The methodology each deployer uses to set thresholds against its own population is the deployer's responsibility, per the threshold-derivation reference document.
- **We are not asking ACCME to perform vendor evaluation.** Independent adversarial review of any vendor's methodology is the vendor's responsibility, with public documentation.

---

## Proposed sequence

1. **Public-comment phase (now → Q3 2026):** ACCME accepts comments on the December 2025 guidance.
2. **Working-group phase (Q3 → Q4 2026):** ACCME convenes an AI Integrity working group, including providers, vendors, and academic researchers.
3. **Methodology-criteria phase (Q4 2026 → Q1 2027):** Working group iterates on criteria language and reference methodologies.
4. **Pilot deployments (2026–2027):** Accredited providers (small specialty MECs, mid-size multi-specialty MECs, eventually large enterprise MECs) pilot the methodology against their actual learner populations, producing the empirical data to validate or refine the criteria.
5. **Guidance revision (2027):** ACCME publishes a revised guidance citing the criteria and referencing methodologies that meet them.

This is a multi-year arc. The first move is the public-comment phase, which is open now.

---

## Ancillary materials available on request

- **Threshold-derivation methodology document:** describes how a deploying organization calibrates the receipt's composite threshold against its own user population using a 4-step protocol (capture → choose threshold → adversarial validate → document). References Hahn & Meeker (1991), Hyndman & Fan (1996), and primary cognitive-science literature (Hick 1952, Fitts 1954, Lacquaniti 1983, Gilden 2001).
- **Adversary analysis:** maps six measured bot classes (Naive, Jittered, Selenium, Click Farm, Replay Attack, Slow Mimic) and seven unmeasured-but-known classes (LLM-in-the-loop, recorded-replay, generative synthesis, browser-extension injection, proxy completion, etc.) with measured composite scores and the defense layer responsible for catching each.
- **CME vertical use cases:** describes how seven different CME-ecosystem buyer types — small specialty MECs, mid-size multi-specialty MECs, large enterprise MECs, pharma IME teams, ACCME itself, specialty boards (ABPN), and LMS partners — would integrate, deploy, and benefit from the methodology.

All available at github.com/Stephenuffugus/Attention-Protocol or by direct request to stephenfurpahs@gmail.com.

---

## Closing

The integrity question facing CME in 2026 is not whether AI-augmented completion is happening — it is — but whether the accreditation infrastructure can produce evidence robust enough to survive auditor scrutiny. Procedural evidence cannot. Cryptographic evidence can.

ACCME's December 2025 guidance correctly named the problem. We respectfully propose that a future revision name a class of solution, with criteria methodology-agnostic enough that no single vendor captures the lane and rigorous enough that the resulting evidence is indistinguishable from independent mathematical proof.

Thank you for the opportunity to comment.

Stephen Furpahs
Founder, SWS Strategic Media LLC
stephenfurpahs@gmail.com
USPTO Provisional Patent SWS-PROV-001
github.com/Stephenuffugus/Attention-Protocol

---

**Status:** Draft v1.0 — 2026-05-07. To be reviewed by Stephen, polished, and filed via the ACCME public-comment portal once Stephen confirms the proposal language, the public sequencing, and the disclosed commercial interest section.
