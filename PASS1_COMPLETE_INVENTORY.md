# SWS Attention Protocol — Innovation Inventory

**Status:** Codebase-derived inventory, prepared 2026-05-05 by enumerating innovations identifiable from the open-source repository at https://github.com/Stephenuffugus/Attention-Protocol.

**Authoritative source:** USPTO provisional **SWS-PROV-001**, filed **2026-03-17** by Stephen Furpahs, SWS Strategic Media LLC. The as-filed PDF is the legal claim instrument; this document is a buyer-facing companion reference enumerated from public source code, public documentation, and the seven-layer architecture description.

**Scope note:** The original `PASS1_COMPLETE_INVENTORY.md` referenced in earlier docs as "247 innovations across 24 categories" was the patent-drafting working file maintained on the founder's local machine and is not present in the repository. This document re-enumerates from the codebase as it exists at commit `983db41` (2026-05-05). Where the count differs from the filed-PDF count, the filed PDF governs.

**How to read this:** The 24 categories below mirror the seven-layer architecture (`SEVEN_LAYER_DEEP_DIVE.md`) plus supporting subsystems. Each category lists specific, named innovations with cross-references to the source files where they live. Items are technical mechanisms, not claims of novelty per se — novelty is determined by the filed claim set, not by this list.

**Cross-references throughout:** `docs/SECURITY_ARCHITECTURE.md` · `docs/architecture-1pager.md` · `docs/technical-faq.md` · `docs/COMPLIANCE_MATRIX.md` · `docs/privacy-DPIA.md` · `SEVEN_LAYER_DEEP_DIVE.md`

---

## Category 1 — Behavioral Composite: Timing-Family Signals
*Source: `src/sdk/attention-protocol.js`*

1. **Timing-entropy signal** — Shannon entropy of inter-event intervals; humans produce wide-distribution entropy, bots produce narrow-distribution. Closed-form formula, no model weights.
2. **Timing-variance signal** — Coefficient-of-variation of click and keystroke gaps over a moving window, with sub-200ms scroll-artifact filter.
3. **Micro-pause distribution signal** — Detection and statistical characterization of <300ms cognitive gaps between actions, distinguishing thought from mechanical pacing.
4. **Sustained-attention coherence signal** — 1/f fractal-power scaling test (Gilden 2001) over a session-length window; pre-whitened DFA-1 implementation.
5. **Reaction-time stability signal** — Within-session reaction-time consistency, robust to outlier handling per Lacquaniti–Terzuolo–Viviani 1983.

## Category 2 — Behavioral Composite: Motor-Control Family
*Source: `src/sdk/attention-protocol.js` (mouse/cursor scope)*

6. **Fitts's-Law compliance scoring** — Compares observed movement times against Fitts 1954 ID-vs-MT prediction; bots without curve-aware control fail this consistently.
7. **Mouse-curvature index** — Path-curvature measurement on every cursor traverse, with the 2026-04-21 curvature-threshold fix preventing zero-on-real-humans.
8. **Cursor-jerk signal** — Third derivative of cursor position; humans exhibit non-zero jerk distributions, naive bots produce zero-jerk straight-line paths.
9. **Velocity-profile signal** — Bell-shaped velocity-curve detection (human submovement signature) versus monotonic velocity profiles (bot signature).
10. **Two-thirds power-law residual** — Lacquaniti–Terzuolo–Viviani residual; the relationship between angular velocity and curvature on continuous mouse paths.
11. **Crossman–Goodeve / Meyer 1988 submovement-count v2** — Decomposition of long mouse traverses into submovement primitives.
12. **Microsaccade-class signal (mouse-cursor analog)** — Detection of the small involuntary corrections present in human pointing, absent in scripted bots.

## Category 3 — Behavioral Composite: Cognitive-Decision Family
*Source: `src/sdk/attention-protocol.js` (decision scope)*

13. **Hick's-Law decision-time scoring** — Decision time scales as log2(n+1) for a real human; bots either ignore option count or scale linearly.
14. **Decision-cost variance signal** — Variance of per-option decision time, weighted by option complexity.
15. **Complexity-aware reaction-time signal** — Reaction-time bands tied to UI complexity render events (`recordContentRender` API).

## Category 4 — Behavioral Composite: Reading Family
*Source: `src/sdk/attention-protocol.js` (reading-content scope)*

16. **Reading-speed plausibility scoring** — WPM-band compliance against published reading-speed literature (150–700 normal, 700–1200 skim, >2000 = bot).
17. **Reading-speed coherence (Day-1 enhancement)** — Blends WPM-plausibility with section-by-section CV-based scoring at 60/40 weights; implausible-majority clamp at ≤0.25.
18. **IntersectionObserver-based section boundary tracking** — Content-anchored section entries, replacing scroll-percentage boundaries that fired sub-second on natural scrollers.
19. **Sub-200ms section-entry filter** — Statistical exclusion of scroll-through artifacts before they corrupt the reading-speed score.

## Category 5 — Behavioral Composite: Touch / Mobile Family
*Source: `src/sdk/attention-protocol.js` (touch scope)*

20. **Touch-pressure-variance signal** — Where pressure data is exposed by the platform; null on devices without pressure sensors.
21. **Touch-area-variance signal** — Per-tap contact-area distribution; mechanical taps produce constant-area contacts.
22. **Multi-touch-coordination signal** — Two-finger-pinch and swipe-coordination consistency.
23. **Device-motion-coupling signal** — Accelerometer/gyroscope coupling with the touch event; the 2026-04-24 weak-signal fix raised the floor to hand-tremor threshold (0.005 accel / 0.0005 gyro).
24. **Pointer-coarse / pointer-fine adaptation** — `matchMedia('(pointer: coarse)')` device-class branching so mouse-only signals report `null` rather than `0` on phones.

## Category 6 — Behavioral Composite: Engagement Family
*Source: `src/sdk/attention-protocol.js` (window/focus/scroll scope)*

25. **Active window-focus tracking** — `blur`/`focus` listener fold-in (Day-1 enhancement); a session with zero tab-hide events but ≥1 blur reads as 0.78/0.85 (was 0.75 default).
26. **Hover-dwell distribution signal** — Distribution of hover durations on interactive elements.
27. **Scroll-event density signal** — Per-second scroll event count; mechanical scroll-to-bottom is detectable as a distinct rate.
28. **Inactivity-gap ratio** — Continuous-engagement detection; the 2026-04-24 `recordScroll → recordActivity` hookup fixes the mobile false-zero on touch-only devices.
29. **Activity-pattern signal** — Combined scroll + click + keystroke + touch event-cadence assessment.

## Category 7 — Behavioral Composite: Composition / Output
*Source: `src/sdk/attention-protocol.js` + `proof/sdk/composition-integrity.js`*

30. **Keystroke-interval coefficient-of-variation** — Statistical-shape detection of natural typing.
31. **Digraph keystroke-timing analysis** — Pair-transition statistics with privacy-safe class bucketing (no characters stored).
32. **Cross-pair differentiation** — Differential analysis between common and rare digraph pairs.
33. **Backspace-ratio signal** — Backspace-per-keystroke distribution; pasted text shows zero backspaces.
34. **Paste-burst counter** — Bursts of >12 chars in <80ms flagged as paste events.
35. **Composition-integrity verdict** — `authored` / `mechanical` / `pasted` ternary verdict surfaced on the receipt.

## Category 8 — Environmental Gate (7-Vector Multi-Detector)
*Source: `src/sdk/environmental-gate.js`*

36. **BotD integration** — FingerprintJS BotD bot-detection vector (1 of 7); MIT-licensed, runs entirely in browser, only the boolean verdict stored.
37. **WebGL renderer-fingerprint vector** — Cross-checks WebGL-renderer string against headless-Chrome canonicals.
38. **WebGPU presence vector** — Detection of WebGPU API surface; headless contexts often lack it.
39. **Function.toString self-introspection vector** — Bot-detection via tampered native function shapes.
40. **iframe-frontier vector** — Detection of iframe-injection bypass attempts (puppeteer-extra-stealth class).
41. **chrome.runtime presence vector** — Tests for `chrome.runtime` extension API surface.
42. **AudioContext prototype-shape vector** — `OfflineAudioContext` quirks expose headless environments.
43. **Multi-detector "OR" gating** — A single positive vector trips the gate; bypassing the env layer requires fooling all 7 simultaneously.
44. **Cross-browser graceful degradation** — Each vector reports `inconclusive` on browsers that legitimately lack the surface; gate fails open only with explicit logging.

## Category 9 — Composition Integrity (Layer 3a)
*Source: `proof/sdk/composition-integrity.js`*

45. **Paste-burst detector** — Statistical signature of clipboard insertion vs. natural typing.
46. **Keystroke-cadence analyzer** — Inter-keystroke interval analysis with no character storage.
47. **Verdict-emission API** — `readSnapshot({ scopeId })` returns a structured composition assessment for the receipt.
48. **Privacy-safe character-class bucketing** — Distinguishes letter/digit/punct/space/control without storing text.

## Category 10 — Honeypot Canary (Layer 3b)
*Source: `proof/sdk/honeypot-canary.js`*

49. **Invisible-canary injection** — Prompt-injection token rendered with `display:none` or `visibility:hidden`; humans never see it, LLMs reading the DOM do.
50. **Per-session randomized canary word** — Eliminates static-pattern recognition by adversaries.
51. **Detection at receipt-build time** — Honeypot check runs only at `saveSession` time; never persists user text.
52. **Receipt-block emission** — Standardized JSON schema for the honeypot result attached to the receipt.

## Category 11 — Consent Attestation (Layer 4)
*Source: `proof/sdk/privacy-compliance.js`, receipt schema*

53. **GDPR Art. 7 / CCPA §1798.120 consent attestation embedded in every receipt** — Categories granted, timestamp, UI version, policy URL.
54. **Consent-UI versioning** — Receipts bind to the consent-UI version that was rendered, supporting downstream "what version was shown" audits.
55. **Tamper-evident consent record** — Modification of the consent block invalidates the outer signature.

## Category 12 — Ed25519 Cryptographic Signature (Layer 5)
*Source: `src/sdk/attention-signer.js`, Cloud Function `signReceipt`*

56. **EdDSA / RFC 8032 receipt signing** — Each receipt is an Ed25519-signed JWT.
57. **Server-side key custody** — Private key in Google Secret Manager, never transmitted off Cloud Functions runtime.
58. **JWKS publication endpoint** — `/.well-known/attention-pubkey.json` static file mirrorable to any host.
59. **Multi-key JWKS routing** — Old-and-new key routing during rotation grace; validated via `scripts/rotation-dryrun.js`.
60. **Cross-key rejection enforcement** — A receipt signed by one kid is cryptographically rejected by JWKS missing that kid.
61. **UTF-8-canonical SHA-256 propagation across signer + proof + SDK paths** — Round-3 fan-out fix preventing mixed-byte hashes.
62. **Constant-time auth comparator** — Cloud Function HTTP path; closed in 2026-04 hardening.
63. **JWT exp / nbf claim handling** — Time-bound issuance with explicit `aud` (audience) for receipt-binding.
64. **Server-side recompute issuer attestation** — `signReceipt` issues only after `runWall` recomputes composite.

## Category 13 — Content-Bound SHA-256 Receipt (Layer 6)
*Source: `src/sdk/attention-receipts.js`*

65. **Canonical-JSON serialization** — Deterministic key ordering + Unicode normalization, producing deterministic hashes across pathological inputs (RTL, CJK, deeply-nested, NaN/Infinity).
66. **27/27 pathological-canonical-input determinism** — Test-suite-validated.
67. **DOM-tampering detection** — Any modification to displayed receipt fields invalidates the hash; 100/100 random tamper variations detected.
68. **Hash-as-receipt-id** — The SHA-256 IS the receipt identifier; no separate ID generation.
69. **Layered hash-of-hashes structure** — Per-layer attestation hashes nested into the outer receipt hash for selective reveal.

## Category 14 — Temporal Anchoring (Layer 7)
*Source: `src/sdk/attention-anchor.js`, `src/sdk/attention-tsa.js`*

70. **OpenTimestamps Bitcoin anchor (optional)** — Public calendar servers; receipt hash only, no PII.
71. **RFC 3161 TSA token (optional)** — Customer's choice of DigiCert / Sectigo / GlobalSign / FreeTSA.
72. **Multi-TSA failover** — If primary TSA fails, fallback chain attempted before degraded-mode receipt issuance.
73. **Hash-only transmission** — One-way SHA-256 hash sent to anchoring services; impossible to reconstruct content from anchor data.
74. **Long-term verifiability without ongoing SWS involvement** — Anchored receipts remain verifiable after vendor failure.

## Category 15 — Server-Side Composite Recompute ("The Wall")
*Source: `proof/functions/index.js` — `runWall`, `extractSessionMetrics`*

75. **Server-side raw-event-log recompute** — Composite re-derived from event log, preventing client-forged scores.
76. **`runWall` + `extractSessionMetrics` shared-helper extraction** — Round-6 deduplication of HTTP and trigger paths into one canonical implementation.
77. **Server-side plausibility bounds** — Per-signal range enforcement (R4-NEW-1, ~1–2h quick win).
78. **Composite-bypass cost shift** — Pre-wall: ~$50/mo + 56h. Post-wall: ~$5–20K/mo + 200–400h (Round-2 adversarial-bot-builder estimate).
79. **HTTP `signReceipt` and `onSessionWritten` route convergence** — Both paths funnel through the same wall (Round-5 fix).

## Category 16 — Session Fingerprinting / Trace Novelty
*Source: `src/sdk/baseline-profiler.js`, `proof/functions/index.js` (R2-NEW-2b)*

80. **Trace-novelty fingerprinting** — Per-session statistical fingerprint stored in `session_fingerprints` collection.
81. **Cross-session match-function** — Detection of materially different behavior under the same DID (account-sharing tell).
82. **Server-attested fingerprint** — Cryptographically signed JWT carrying the fingerprint, prevents client-side spoofing.
83. **Privacy-preserving design** — Fingerprint is a one-way derivation, not reversible to identity.

## Category 17 — Vertical Scoring Profiles
*Source: `src/sdk/vertical-scoring-profiles.js`*

84. **Vertical-profile architecture** — Same 20 signals, different weights and thresholds per vertical, single SDK.
85. **Medical profile** — clickPrecision .20, documentComprehension .20, fatigueResistance .20; pass 0.65 / marginal 0.50 / fail 0.35.
86. **Military profile** — reactionTime .25, sustainedFocus .20, fatigueResistance .15; pass 0.70 / SCIF-compatible flag.
87. **Insurance profile** — documentComprehension .50, sectionCoverage .20; legal-bindable flag.
88. **Education profile** — sustainedFocus .25, documentComprehension .25, temporalConsistency .10; proctoring-compatible flag.
89. **Workplace / OSHA profile** — Operator-alertness emphasis with shift-hour warning thresholds.
90. **Advertising / MRC profile** — videoCompletion .25, botDetection .20, tabFocus .15.
91. **Custom-profile creation API** — `createProfile(name, config)` for buyer-specific weight tuning.
92. **`scoreAllVerticals` API** — Same session evaluated under every profile in one call.
93. **Certification-grade output emission** — `generateCertification` produces an audit artifact with vertical-specific legal-notice text.

## Category 18 — Verifiable Credentials / Open Badges 3.0
*Source: `src/sdk/verifiable-credentials.js`, `src/sdk/open-badge.js`*

94. **`VC.fromReceipt(receipt)` adapter** — Produces a W3C VC-JWT from an SWS receipt; conformant to OpenBadges 3.0.
95. **`evidence` field embedding** — Receipt-as-evidence in an Achievement Credential, suitable for downstream Credly/Accredible ingestion.
96. **DID method support** — Synthetic `credentialSubject.id` derivable to the issuer DID without identity linkage.
97. **Selective-disclosure preparation** — Layered hash structure (see Category 13) supports future selective-reveal via SD-JWT.

## Category 19 — xAPI / SCORM / LTI Integration
*Source: `src/sdk/xapi-adapter.js`, `src/sdk/integration-examples.js`*

98. **xAPI statement adapter** — Receipt becomes the `result.extensions` of an xAPI statement landed in customer's LRS.
99. **SCORM / xAPI-CMI5 packaging** — Drop-in `<script>` tag in package's `index.html`.
100. **Articulate Rise / Captivate trigger-JavaScript hook** — Customer-side integration template.
101. **Moodle / D2L LTI 1.3 wrapper** — Tool-launch flow with receipt-binding.
102. **Survey-platform integration template** — `recordDecision(optionCount, responseTime)` per question; receipt at submit.
103. **Training-module integration template** — Section-typed `recordContentRender(complexity)` calls per content phase.
104. **Video-completion integration template** — Tab-focus + activity-during-playback signal coupling.
105. **GA4 bridge** — Optional `ga4-bridge.js` for customers who run their own analytics; SWS does not transmit on customer's behalf.

## Category 20 — Calibrated Bayesian P(human)
*Source: receipt schema, `src/sdk/receipt-composite.js`*

106. **Conformal posterior P(human)** — Vovk-Gammerman-Shafer 2005 conformal-prediction framing.
107. **Bootstrap 95% confidence interval** — On every receipt, surfaces uncertainty rather than a single point estimate.
108. **Calibration-set v2** — Growing dataset of confirmed humans + adversarial bots; weights re-fit per release.
109. **Sklar-copula cross-signal joint distribution** — Captures correlation structure across signals, not just marginals.
110. **Nandakumar 2008 TPAMI Neyman-Pearson framing** — Decision-theoretic basis for the human/bot threshold.

## Category 21 — Offline Verification Path
*Source: `proof/verify.html`, `scripts/verify-offline.js`*

111. **Web Crypto-only browser verifier** — `verify.html` runs entirely in-browser, no SWS server in the verification path.
112. **Cold-start offline-verify script** — `scripts/verify-offline.js` uses only Node `fs`/`crypto`; SCIF-compatible (zero network).
113. **Per-step verification walkthrough** — Output explains which layer passed/failed, not just a binary verdict.
114. **Receipt JWT paste-block** — Buyer's auditor pastes a JWT into verify.html and gets seven cards green/red.
115. **Multi-language verify support** — Same Ed25519 + SHA-256 primitives work in Node, Python, Go, Java.
116. **Public JWKS rotation handling** — Verifier handles old + new kids during grace period.

## Category 22 — Privacy / Compliance Architecture
*Source: `docs/privacy-DPIA.md`, `docs/COMPLIANCE_MATRIX.md`*

117. **Zero-PII-by-construction architecture** — No names, emails, IPs, fingerprints (beyond BotD verdict), geolocation, content, keystroke characters.
118. **No webcam / no microphone enforced at SDK level** — `getUserMedia()` is never invoked.
119. **GDPR Art. 6(1)(a)/(b) lawful-basis dual support** — Customer chooses contract or explicit-consent path.
120. **CCPA §1798.105 / §1798.115 alignment** — No data sale, no advertising IDs, no third-party data exchange.
121. **COPPA-safe by construction** — No age collection, no PII; minor-deployment is customer-gated.
122. **SCIF-eligible architecture** — No content stored, only behavioral metrics; offline-verify available.
123. **HIPAA-eligible-services inheritance** — Firebase BAA available; SWS-direct BAA gated on entity formalization.
124. **Data-residency option** — `eur3` (Belgium / Netherlands / Finland) deployment scope on customer request.
125. **30-day Firestore TTL on raw session rows** — Default retention; signed receipts indefinite, customer-controlled.
126. **Sub-processor change-notification policy** — 30-day customer notification before any new sub-processor.

## Category 23 — 21 CFR Part 11 Mapping
*Source: `docs/COMPLIANCE_MATRIX.md`, `proof/part-11.html`*

127. **§11.10(a) accurate-and-complete-copies attestation** — Receipt is signed, tamper-evident.
128. **§11.10(b) record-protection / retrieval attestation** — Receipts self-authenticate against public key.
129. **§11.10(c) long-term protection attestation** — Ed25519 + JWKS + RFC 3161 / OpenTimestamps for long-term retention.
130. **§11.10(e) audit-trail attestation** — Every session record carries creation time, duration, integrity hash chain.
131. **§11.50 signature-manifestation attestation** — Issuer + subject + signed-assertion-type encoded in the VC.
132. **§11.70 signature-record-linking attestation** — Ed25519 over the receipt hash binds signer to record.
133. **§11.200 partial — operator-controls boundary** — Buyer-side via SSO/MFA; explicit TECH/MIXED/PROC labeling.

## Category 24 — Adversarial-Robustness Defenses
*Source: `proof/run-bot-vs-human.js`, `scripts/run-stealth-bot.js`, `scripts/run-dmtg-bot.js`*

134. **Naive-bot adversarial profile** — Constant-interval clicking, straight-line cursor; baseline.
135. **Jittered-bot adversarial profile** — Random 100–300ms delays uncorrelated with task complexity.
136. **Sophisticated-bot adversarial profile** — Pseudo-reading + scripted mouse variance.
137. **LLM-paster adversarial profile** — Realistic interactions + paste-burst typed reflection (mimics ChatGPT copy-paste).
138. **Slow-mimic adversarial profile** — Bots tuned to fake reading-dwell; closes the "people can't just program slow" objection.
139. **DMTG-class adversarial profile** — puppeteer-extra-stealth + Bezier-curve mousemove + Voss-McCartney 1/f timing + Hick's-Law decision delays (Tsinghua arXiv:2410.18233 inspired).
140. **LLM-in-the-loop harness** — Claude or GPT decides each phase action against the live demo, end-to-end (`scripts/llm-in-the-loop-harness.js`).
141. **Server-attested harness tagging** — `?source=harness_test` URL tagging keeps adversarial runs out of the human-corpus query.
142. **Headless-Chrome filter in analysis tooling** — `scripts/analyze-sessions.js` recognizes and isolates harness UA strings.
143. **Hostile-review-round process** — Seven cycles of multi-agent adversarial review (security, statistics, business, code, competitive, legal, SRE, UX, crypto deep-audit, adversarial bot designer); approximately 85 findings closed across 22 commits.
144. **Layered-defense composition** — Single-signal-tightening avoided; defense-in-depth across env-gate, behavioral, composition-integrity, honeypot, signature, and content-bound hash.

---

## Counted total

**144 individually-named technical innovations** enumerated above, organized in **24 categories**.

This count is below the "247" figure cited in earlier marketing material because **this inventory enumerates only innovations identifiable from the open-source repository at the named commit.** It does not include innovations that were filed in the USPTO provisional but exist only in the as-filed document (private invention disclosures, unimplemented claim variants, dependent claims, alternate embodiments, prophetic examples, and commercial-application claims).

The filed USPTO PDF contains the exact, legally-operative claim structure. Any buyer or partner question about specific patent claims should be answered by reference to that PDF, not to this document.

---

**Document version:** 1.0 · **Effective date:** 2026-05-05 · **Authoritative for:** codebase enumeration only · **Not authoritative for:** USPTO claim count
