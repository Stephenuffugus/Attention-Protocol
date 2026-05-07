# Threshold-Derivation Methodology

**For:** SWS Attention Protocol — partners, auditors, and accreditation reviewers
**Author:** Stephen Furpahs, SWS Strategic Media LLC
**Version:** 1.0 — 2026-05-07
**Status:** Reference document, call-quotable, intended to form the methodology section of a future peer-reviewed paper

---

## What this document is

This document specifies how a deploying organization (an accredited CME provider, a market-research platform, an ad-verification customer, etc.) sets the human-confidence threshold above which a SWS Attention Protocol receipt is treated as a valid completion in their environment.

## What this document is not

This document does **not** set a single absolute "passing score." That decision is made by the deploying organization, calibrated to their user population, using the protocol described below. SWS Strategic Media LLC publishes the methodology and the verifier; the deploying organization owns the threshold.

This is the same posture FDA and ACCME take toward novel measurements: vendors specify methodology, deployers specify thresholds against their own data.

---

## Why scores are population-relative

The composite score returned by the SWS Attention Protocol (a value between 0.0 and 1.0) is a normalized human-confidence value derived from 23 behavioral signals, each rooted in peer-reviewed cognitive science.

The score is **not** a probability calibrated against an absolute "real human" prior. It is a position within a distribution. A score of 0.55 means *"this session's behavioral signature places it at this point in the empirical distribution of all observed sessions on this device class for this activity"* — nothing more.

This is intentional. Setting an absolute passing threshold would require:

1. A single canonical "real human" reference distribution that holds across all activities, all devices, all populations, all moments in time. **No such distribution exists** for behavioral attention. Reading speed varies by content density, scroll patterns vary by device, focus patterns vary by time of day.
2. The vendor (SWS) absorbing the calibration burden for every deployer. **This is the wrong burden to absorb.** It makes the vendor a bottleneck, makes the system brittle to population drift, and produces exactly the false sense of authority that regulated industries have learned to distrust in AI/ML systems.

Population-relative thresholds are how every regulated measurement system actually works:

- **Pharmaceuticals:** A drug's effect is established by Phase III trials on a defined population. The drug is approved for that population, with that effect size, at that dose. There is no absolute "this drug works."
- **Educational testing:** Cut-scores for licensing exams (USMLE, ABPN, Bar exam) are set by standard-setting committees against panel-derived performance distributions, not by the test publisher.
- **Clinical chemistry:** Reference ranges for blood markers are set per-laboratory against the lab's own measured population — they vary by region, age distribution, and equipment.

The SWS Attention Protocol follows the same pattern.

---

## The calibration protocol (4 steps)

### Step 1 — Capture a reference distribution

The deployer instruments a representative accredited activity with the SWS SDK. The activity is run by **N ≥ 100** known-real users from the deployer's actual population. For a CME provider, this means actual board-certified physicians completing the activity under normal conditions.

Required:
- N ≥ 100 sessions minimum (rationale below)
- Coverage of all device classes the deployer expects in production: at minimum, desktop and mobile; ideally also tablet
- Sessions run under normal usage conditions (no instructions to "behave a certain way" — population validity requires natural behavior)
- All sessions must produce a verifiable signed receipt (filter out infra failures before analysis)

**Output:** an empirical distribution of composite scores for known-real users on this activity, broken down by device class.

### Step 2 — Choose an operating point

Given the empirical distribution, the deployer chooses a percentile-based threshold. The recommended starting point:

> **Threshold T = 5th percentile of legitimate-completion distribution.**

This means **95% of legitimate completions clear the threshold**. The remaining 5% — legitimate users whose behavior happens to fall below T — go to a manual review queue or appeal process, the same way they do under any current "suspicious completion" QA workflow.

The deployer can choose a more conservative threshold (e.g., 2nd or 1st percentile) at the cost of a higher false-positive rate, or a more permissive threshold (e.g., 10th percentile) at the cost of a higher false-negative rate. The choice is a policy decision specific to the deployer's risk posture, **not a vendor parameter**.

### Step 3 — Adversarial validation

The deployer runs known-bot sessions against the same activity. At minimum:

- A naive headless-browser bot (Puppeteer / Playwright / Selenium with no behavioral mimicry)
- A jittered headless bot (randomized timing, scroll, click cadence)
- A sophisticated behavioral mimic (paste-attack with simulated reading dwell)
- Optionally: an LLM-in-the-loop bot (Claude, GPT-4 driving the browser)

**Acceptance criterion:** 0% of bot sessions clear threshold T. If any bot clears T, the deployer must choose: lower T, add a vertical-specific gate, or escalate to manual review for the affected score band.

The SWS Attention Protocol's environmental gate and composition-integrity layer are intended to catch all four bot classes before T is even consulted. Validation here confirms those gates are working in the deployer's environment.

### Step 4 — Document and lock

The deployer publishes (internally or externally):

- The reference-distribution composition (N, device-class breakdown, time window)
- The chosen percentile and resulting threshold T
- The adversarial-validation results
- The recalibration cadence (see below)

This document is what the deployer hands to their auditor (ACCME, IAB MRC, FDA, etc.) as the methodology underlying any "passed / did not pass" determination.

---

## Sample size and statistical confidence

Why N ≥ 100?

For non-parametric percentile estimation (no distributional assumptions), the 5th percentile estimate from N=100 has approximately a **±3–5 percentage-point** confidence interval at the 95% confidence level. This is sufficient operational precision for a CME-grade deployment.

For tighter intervals:

| N | Approximate 95% CI for 5th percentile estimate |
|---|---|
| 50 | ±5–8 pp |
| 100 | ±3–5 pp |
| 200 | ±2–3 pp |
| 500 | ±1–2 pp |
| 1000 | ±1 pp |

A deployer running N=100 captures the credibility win at acceptable cost. Larger samples are recommended for high-stakes deployments (large pharma grants, regulator-facing claims) but are not required for the methodology to be sound.

References: Hahn & Meeker (1991), *Statistical Intervals*, ch. 5; Hyndman & Fan (1996), "Sample Quantiles in Statistical Packages."

---

## False-positive / false-negative tradeoffs

Define:

- **FP** (false positive) — a session is below threshold but represents a legitimate user. Cost: a real human is flagged, sent to appeal, possibly delayed in earning credit. Operational, recoverable.
- **FN** (false negative) — a session is above threshold but represents a bot or AI-assisted completion. Cost: an audit finds the deployer awarded credit to a non-engaged learner. Reputational, potentially accreditation-threatening.

For most accredited-CME deployers, **FN cost greatly exceeds FP cost.** This argues for a conservative threshold (5th percentile or lower) and a clear appeal path for the small population of flagged legitimate users.

The SWS Attention Protocol's design — environmental gate + composition-integrity layer + composite score — is structured so that the layered defense catches bots at any one of three levels. The threshold T governs only the composite-score layer; the gates above it operate independently and capture all currently-tested bot classes regardless of T.

---

## Recalibration cadence

The reference distribution is not eternal. Recalibrate when:

- **Time:** every 12 months as a default cadence
- **Device-class drift:** mobile share of completions shifts by >20 percentage points relative to the original calibration window
- **Activity-type change:** a new accredited-activity format is introduced (e.g., interactive case-simulation vs. traditional read-and-test)
- **Adversarial drift:** a new bot class is observed in the wild that was not part of step-3 validation
- **Major SDK version change:** a new release of the protocol that changes signal weights or adds new signals

Recalibration is the same 4-step protocol, run again. The deployer keeps a versioned record of all past calibrations.

---

## Edge cases

**Mobile vs. desktop.** Mobile devices structurally cannot return values for the four mouse-only signals (cursor curvature, jerk, velocity profile, two-thirds power law). These signals correctly read N/A on mobile, and the composite score auto-reweights across the remaining 19 signals. The deployer must calibrate **separate thresholds per device class**, or accept a single threshold derived from the desktop distribution and apply it conservatively to mobile.

**Accessibility users.** Users with assistive technology (screen readers, alternative input devices) may produce behavioral signatures that fall below threshold. Deployers should treat the appeal queue as the primary accessibility accommodation: a flagged completion is reviewed manually, with assistive-technology context honored.

**Language and reading speed.** Non-native English speakers reading English-language CME content may read more slowly, which the protocol's reading-speed coherence signal handles via plausibility bands (150–700 WPM normal range). Outliers below 150 WPM trigger appeal-queue review rather than automatic rejection.

**Time-of-day effects.** A reference distribution captured during business hours may not represent off-hour completions. Deployers serving 24/7 audiences should ensure the calibration sample spans the same temporal distribution as production traffic.

---

## Reference implementation: how PPP would actually run this

This section illustrates the protocol concretely for a hypothetical PPP deployment. It is not a contract; it is the kind of operational plan a buyer-side compliance lead can show their auditor.

**Calibration window:** 30 days following pilot start.

**Reference activity:** one accredited psychiatry IME activity (e.g., "Hypertension in MDD: An Update").

**Population:** N = 100 board-certified psychiatrists from PPP's existing JCP / PCC subscriber base. Recruitment via standard PPP CME outreach. No incentive beyond CME credit.

**Capture:** all 100 sessions instrumented with the SWS SDK. Receipts collected and verified. Sessions where the receipt failed to verify (infra error, browser incompatibility) are excluded from the calibration set. **Receipt-failure-rate target: <2%, to be measured against the deployer's actual production sample during pilot setup.** SWS does not currently publish a production receipt-failure rate independent of a deployer's environment; the rate is sensitive to browser mix, network conditions, and concurrency, and is more honestly reported per-deployment than as a vendor-wide claim.

**Distribution analysis:** desktop and mobile distributions analyzed separately. Each yields an empirical 5th percentile.

**Threshold selection:** T_desktop and T_mobile selected at the 5th percentile of each respective distribution. PPP's compliance lead approves and locks the values.

**Adversarial validation:** SWS-provided test-bot harness run against the same activity. Four bot classes tested (naive, jittered, sophisticated mimic, LLM-in-the-loop). Acceptance: 0 of 4 clear T_desktop or T_mobile.

**Documentation:** PPP's compliance team produces a 2-page methodology memo containing the above, signed by the compliance lead, dated, version-controlled. This memo is the document an ACCME surveyor would request during an audit.

**Recalibration:** annual, or on triggers above. PPP's compliance team owns the cadence; SWS provides the SDK and verifier; the threshold is PPP's.

**Cost to PPP:** SDK integration is one script tag plus one server-side signing endpoint. Calibration is an analysis of receipts PPP is already collecting. Adversarial validation is run via SWS's published test-bot harness. Total marginal compliance load: estimated 4–8 hours of compliance-lead time over a 30-day calibration window.

---

## What this methodology does and does not claim

**Claims:**

- The composite score is a position within a population distribution, not an absolute probability
- A 5th-percentile threshold on a representative sample of legitimate completions yields 95% sensitivity
- Layered defenses (environmental gate, composition integrity) capture all currently-tested bot classes regardless of threshold setting
- The methodology is reproducible by any deployer with N ≥ 100 representative users and the published SDK + verifier
- All claims are independently verifiable: receipts verify offline, signals are unit-tested, adversarial harness is published

**Does not claim:**

- That the protocol detects all possible bots. Adversarial capability evolves; recalibration and disclosed-attack-surface practice (round-by-round hostile review) is the response.
- That the threshold is the same across deployers. It isn't, and shouldn't be.
- That the protocol replaces human-in-the-loop QA. It doesn't; it informs the QA queue.
- That the protocol issues a regulatory determination. It doesn't; it produces verifiable evidence the deployer's compliance team uses to make that determination.

---

## Independent verification of every claim above

Every claim in this document is independently checkable:

- **Cryptographic primitives** — Ed25519 signatures, JWT format, JWKS publication: verifiable via `scripts/verify-receipt.js` against any receipt SWS issues. No SWS infrastructure required after the public key is cached.
- **Behavioral signal validity** — each of the 23 signals is unit-tested in `tests/signals-7-20.test.js` and others, with citations to the underlying peer-reviewed literature in source comments.
- **Adversarial robustness** — the bot harness at `tests/bot-harness.test.js` is published; deployers can run it against their own deployment.
- **Hardening discipline** — 7 rounds of hostile adversarial review plus a 2026-05-07 production-tightening pass (R8); ~90 findings closed, fully version-controlled in the public repository.
- **Calibration methodology** — this document.

The deployer does not have to trust SWS Strategic Media. The deployer has to verify the math, run the harness, and calibrate to their population. The math, the harness, and the methodology are all public.

---

## References

- Hahn, G.J. and Meeker, W.Q. (1991), *Statistical Intervals: A Guide for Practitioners*, Wiley.
- Hyndman, R.J. and Fan, Y. (1996), "Sample Quantiles in Statistical Packages," *The American Statistician*, 50(4), 361–365.
- Hick, W.E. (1952), "On the rate of gain of information," *Quarterly Journal of Experimental Psychology*, 4(1), 11–26.
- Fitts, P.M. (1954), "The information capacity of the human motor system in controlling the amplitude of movement," *Journal of Experimental Psychology*, 47(6), 381–391.
- Lacquaniti, F., Terzuolo, C., and Viviani, P. (1983), "The law relating the kinematic and figural aspects of drawing movements," *Acta Psychologica*, 54(1-3), 115–130.
- Gilden, D.L. (2001), "Cognitive emissions of 1/f noise," *Psychological Review*, 108(1), 33–56.
- ACCME (2025), "Guidance on AI-Augmented Assessments in Continuing Medical Education," December 2025.

---

**Status:** Version 1.0, released 2026-05-07. Comments to stephenfurpahs@gmail.com. This document is intended for incorporation into a peer-reviewed methodology paper; preliminary citations welcome.
