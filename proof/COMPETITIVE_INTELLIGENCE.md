# SWS Attention Protocol — Competitive Intelligence Report
## Generated: April 8, 2026
## Classification: INTERNAL — Patent Strategy & Go-To-Market

---

## PATENT LANDSCAPE ANALYSIS

### WHERE SWS STANDS — HONEST ASSESSMENT

**Strongest novel claims (genuinely new — no one else has patented these):**

1. **Fitts' Law as bot detection signal** — Fitts' Law has been used for 70 years to DESIGN interfaces. SWS is the first to use Fitts' Law compliance as a human verification signal. Bots violate it because they teleport; humans physically cannot.

2. **Hick's Law as engagement verification** — Same story. Used in UX design for decades, never used to verify that a real human cognitively processed a decision. SWS measures whether response time scales with option count.

3. **The specific 6-signal weighted composite** — No one combines timing entropy + Fitts' + Hick's + scroll saccade + micro-pause + touch variance into a single attention quality score.

4. **Cryptographic SHA-256 receipts encoding attention quality** — Blockchain projects have "proof of attention" tokens but use trivial signals (was the tab open?). Behavioral biometrics companies have sophisticated signals but use them for identity, not attention proofs. Nobody does both.

5. **Portable attention hashes across platforms** — Hashes earned in one app can be verified and spent in another. No existing system does this.

### NEAREST PATENT THREATS — RANKED

**1. BioCatch (Behavioral Biometrics) — MEDIUM CONCERN**
- Patents on behavioral biometrics using touch dynamics, interaction timing, cognitive signals
- US Patent 9,665,703: "Detecting identity fraud based on changes in individual interaction patterns"
- **Their purpose:** Identity verification (is this the SAME person?)
- **Our purpose:** Attention verification (did A person pay genuine attention?)
- **The distinction:** Same raw signals, completely different application and output
- **Action needed:** Patent attorney must be ready to argue this distinction during prosecution

**2. Google reCAPTCHA — MEDIUM CONCERN**
- Broad patents on behavioral analysis for bot detection
- US Patent 9,268,958: "Systems for determining that a free-form input is anomalous"
- **Their method:** ML black box — no named behavioral science laws
- **Our method:** Named, principled criteria (Fitts', Hick's) with transparent scoring
- **The distinction:** Google does binary human/bot. We do quality spectrum + cryptographic receipt.
- **Risk:** Google's claims are written broadly. Could cite during our prosecution.

**3. Brave/BAT — LOW CONCERN**
- "Proof of attention" in crypto-ad context
- **Their signals:** Was the tab active? Was the ad in viewport? (trivial)
- **Our signals:** 6 behavioral science signals measuring cognitive engagement
- **Risk:** Trademark concern on phrase "proof of attention" only. Technical overlap is near zero.

**4. DoubleVerify / IAS / MOAT — LOW CONCERN**
- Ad viewability measurement patents
- **Their signals:** Viewport presence, exposure time, audibility
- **Our signals:** Motor control compliance, cognitive processing verification
- **No meaningful overlap.**

### GENUINELY SAFE TERRITORY

- Using scroll behavior as a PROXY for eye-tracking saccade patterns without hardware — no prior art found
- Attention quality tiers (deep/active/passive/background) from behavioral signals — novel classification
- Per-section document reading verification from behavioral signals — novel application
- Operator fatigue detection from interaction pattern drift — novel in non-hardware, non-wearable context

### MUST-DO ACTIONS

1. **Hire a patent search firm** for formal freedom-to-operate (FTO) search
   - Search USPTO classes 726 (Info Security), 709 (Digital Processing), CPC G06F21/316 (behavioral biometrics), H04L9/32 (crypto mechanisms)
2. **Specifically search BioCatch and Google reCAPTCHA patent families** — nearest neighbors
3. **Emphasize the COMBINATION in utility patent claims** — not "we use Fitts' Law" (known science) but the specific 6-signal composite → quality tier → SHA-256 receipt pipeline
4. **File utility patent before March 2027** — every month increases risk

---

## COMPETITOR ANALYSIS — REAL COMPANIES

### Tier 1: Direct Attention Measurement (Closest to SWS)

**Adelaide (AU Metric)**
- Type: Attention measurement for advertising
- Method: Probabilistic model from eye-tracking panel data + media quality signals
- Monetization: Media planning metric sold to agencies/brands
- **Limitation:** Predictive model, not real-time measurement. Based on panels, not individual users. No behavioral science signals. No cryptographic proof.
- **SWS advantage:** Real-time per-user measurement vs statistical predictions. Works on any content, not just ads.

**Lumen Research**
- Type: Attention measurement via eye tracking
- Method: Opt-in panel with eye-tracking cameras, measures actual gaze
- **Limitation:** Requires cameras. Panel-based. Cannot scale to every user. Massive privacy concerns.
- **SWS advantage:** No hardware. No cameras. Behavioral signals from normal interaction. Works on every device.

**RealEyes**
- Type: Emotion and attention AI via webcam
- Method: Computer vision analyzes facial expressions for attention/emotion
- **Limitation:** Requires camera permission. Users must opt in to face recording. GDPR nightmare.
- **SWS advantage:** Zero biometric data. Zero camera access. Privacy-safe by design.

**Playground XYZ**
- Type: Attention intelligence platform for advertising
- Method: Measures viewable time, attention time, contextual signals
- **Limitation:** Still fundamentally viewability metrics, not behavioral engagement proof
- **SWS advantage:** Behavioral science signals prove cognitive engagement, not just visual exposure

### Tier 2: Bot Detection / Fraud Prevention

**reCAPTCHA v3 (Google)**
- Method: ML model scoring interaction patterns
- **Limitation:** Binary human/bot. One-time check. No quality spectrum. No receipt.
- **SWS advantage:** Continuous monitoring. Quality tiers. Cryptographic receipts.

**Research Defender / Imperium**
- Method: Device fingerprinting, IP reputation, trap questions, speeder detection
- **Limitation:** Catches worst offenders only. Cannot detect inattentive humans.
- **SWS advantage:** Detects engagement quality, not just identity.

**BioCatch**
- Method: Behavioral biometrics (keystroke, mouse, touch dynamics)
- **Limitation:** Built for banking identity verification. Not attention scoring.
- **SWS advantage:** Different purpose (attention vs identity), different output (quality tier + receipt vs identity confidence)

### Tier 3: Content/Video Analytics

**Hotjar / FullStory**
- Method: Session replay, heatmaps
- **Limitation:** Requires human review. Cannot scale. Records everything (privacy risk).
- **SWS advantage:** Automated scoring. Privacy-safe. No content recording.

**Chartbeat**
- Method: Engaged time (requires mouse/scroll activity)
- **Limitation:** Just a timer with activity detection. No behavioral science. No per-section scoring.
- **SWS advantage:** Reading pace, scroll velocity, active signals, viewport coverage per section.

**SCORM/xAPI (LMS Standard)**
- Method: Completion tracking, quiz scores
- **Limitation:** Trivially cheatable. Speed-watch + guess = "completed."
- **SWS advantage:** Behavioral proof of genuine viewing engagement.

### Tier 4: Fatigue Detection

**Fatigue Science / CIRCADIAN**
- Method: Predict fatigue from work schedules + biomathematical models
- **Limitation:** Predictions, not measurements. Cannot detect unexpected fatigue.
- **SWS advantage:** Measures ACTUAL performance drift in real time.

**SmartCap / Optalert**
- Method: EEG headbands or glasses detecting drowsiness
- **Limitation:** $500+ per unit. Uncomfortable. Not scalable.
- **SWS advantage:** Runs on any device with a screen. Zero hardware.

---

## KEY FINDING: THE GAP WE OWN

Nobody combines all three of these:
1. **Behavioral science signal analysis** (Fitts', Hick's, timing entropy, etc.)
2. **Attention quality classification** (deep/active/passive/background spectrum)
3. **Cryptographic proof generation** (SHA-256 tamper-proof receipts)

Companies do ONE of these. Some do TWO. Nobody does all THREE. That's the moat.

---

---

## DETAILED COMPETITOR PROFILES — THE REAL LANDSCAPE

### Adelaide (adelaidemetrics.com) — Attention Measurement for Ads
- **Method:** Predictive model trained on eye-tracking panel data. Does NOT measure actual individual attention. Predicts probability an ad placement will receive attention based on position, size, clutter, device type.
- **Clients:** Havas, GroupM. Real agency adoption. Published third-party validation studies.
- **Limitation:** Statistical prediction, not per-user measurement. No behavioral biometrics. No cryptographic receipts. Advertising-only.
- **Where they're ahead:** Market adoption. Agency relationships. Brand lift correlation studies.
- **Where SWS is ahead:** Real-time per-user behavioral measurement. Works across verticals. Cryptographic proof output.

### Lumen Research (lumen-research.com) — Eye Tracking Panels
- **Method:** Webcam-based eye tracking on ~100K+ opted-in panelists. Measures fixation count, duration, gaze position.
- **Clients:** Licenses panel data to Adelaide and others. Enterprise contracts.
- **Limitation:** Requires camera. Panel-based (sample, not 100% coverage). Tells you WHERE someone looked, not whether they cognitively processed it. Advertising-only.
- **Where they're ahead:** Largest commercial eye-tracking dataset. Academic credibility.
- **Where SWS is ahead:** No camera needed. Measures cognitive engagement, not just gaze. 100% of interactions, not a sample.

### RealEyes (realeyesit.com) — Facial Emotion + Attention AI
- **Method:** Webcam captures facial video. AI detects eye gaze, blink rate, head pose, facial expressions mapped to emotions.
- **Clients:** Mars, Hershey's, CPG brands.
- **Limitation:** Requires webcam consent. Facial expression analysis is scientifically contested (Lisa Feldman Barrett's work). Accuracy issues across demographics. Advertising-focused.
- **Where they're ahead:** Working product with brand-name clients. Emotional dimension.
- **Where SWS is ahead:** Zero hardware. No camera. More scientifically robust signals. Works in every context.

### BioCatch — Behavioral Biometrics (BIGGEST TECHNICAL COMPETITOR)
- **Method:** Keystroke dynamics, mouse movement, scroll behavior, touch pressure, device handling, hand tremor, cognitive load indicators. Builds behavioral profile per user.
- **Clients:** HSBC, Barclays, NatWest. $1.3B valuation (2023 SPAC).
- **Limitation:** Banking fraud detection only. Asks "is this the SAME person?" not "is this person paying attention?" No attention quality score. No cryptographic receipts. No Hick's/Fitts' Law as named signals.
- **Where they're ahead:** MOST SOPHISTICATED DEPLOYED behavioral biometrics in the world. Billions of sessions. Mature signal processing. Regulatory acceptance.
- **Where SWS is ahead:** Different problem (attention vs identity). Portable receipts. Multi-vertical. Transparent scoring (named behavioral science laws vs ML black box).
- **HONEST RISK:** If BioCatch pivoted to attention measurement, they have a 10+ year head start in signal processing. They have NOT done this — that's our window.

### Brave/BAT — "Proof of Attention" Token
- **Method:** Tab-focus timer. Ad was displayed + tab was active for 5-10 seconds = "attention."
- **50M+ monthly active users.** Working crypto infrastructure.
- **Limitation:** "Proof of attention" is a massive overstatement. Trivially gameable. No behavioral science whatsoever. Browser-locked.
- **SWS advantage:** The scientific gap is enormous. SWS actually measures cognitive engagement.

### Survey Quality (Research Defender, Imperium, Verisoul, PureSpectrum)
- All do device fingerprinting, IP fraud, duplicate detection.
- **None measure behavioral engagement quality.**
- **PureSpectrum's PureScore** is closest — analyzes open-ended text responses for quality. Content analysis, not behavioral analysis, but it IS a form of quality scoring.
- **SWS advantage:** Behavioral engagement scoring that catches inattentive real humans, not just bots.

### Fatigue Detection (Seeing Machines, Smart Eye, Caterpillar DSS)
- All use CAMERAS pointed at the face. Hardware-dependent.
- **None use behavioral interaction patterns.**
- **SWS advantage:** Detects fatigue from interaction signals alone. Zero hardware. Any device with a screen.

### Document Reading Verification
- **DocuSign, Adobe Sign, Ironclad, PandaDoc:** Prove a document was opened and signed. CANNOT prove it was read.
- **No product exists that cryptographically proves someone read a document using behavioral signals.** This is genuine white space.

### Employee Training (Relias, HealthStream, Cornerstone, CareAcademy)
- Track login time, video completion %, quiz scores. Trivially cheatable.
- Some have added "anti-speeding" (minimum time per page).
- **No behavioral engagement verification exists in this space.** Genuine white space for SWS.

---

## EMERGING TECH THAT COULD MAKE US STRONGER

### Tier 1 — Implement Now (high impact, proven tech)

**1. WebAuthn / Passkeys — Device-Bound Receipts**
- Bind each attention receipt to a hardware-verified device (iPhone Secure Enclave, Windows TPM)
- At receipt generation time, call `navigator.credentials.get()` with a challenge derived from the receipt hash
- Result: Cryptographically expensive to farm attention across bot instances
- **This proves "real device" + our behavioral signals prove "real human" = strongest verification possible**
- Effort: 2-3 weeks. Ready to ship now.

**2. W3C Verifiable Credentials — Interoperable Receipts**
- Wrap attention receipts as W3C VCs with issuer, subject, claims, proof
- Any VC-compatible verifier (enterprise HR, regulatory tools, LMS) can verify without custom integration
- EU Digital Identity Wallet mandates VC format — this puts us in compliance
- Selective disclosure: employee presents "completed training with verified attention" without revealing exact scores
- Effort: 1-2 weeks. Libraries exist.

**3. Differential Privacy — Protected Analytics**
- Add calibrated Laplace noise to aggregate reports so individual employees can't be identified
- Critical for healthcare/insurance sales where individual behavioral data is sensitive
- "We computed your compliance engagement metrics but literally never saw individual data"
- Effort: 1 week. Straightforward math.

### Tier 2 — Build Next Quarter

**4. Ethereum Attestation Service (EAS) — On-Chain Receipts**
- Register "Attention Receipt" schema on Ethereum. Each verified session = on-chain attestation.
- Smart contracts can gate access based on attention history
- Off-chain attestations (free) with on-chain Merkle root anchoring (fractions of a cent on L2)
- Opens entire Web3 market
- Effort: 3-4 weeks.

**5. WebGPU/WebNN ML Models — Smarter Integrity Checks**
- Replace rule-based integrity checks with a small neural network (~10KB) running in-browser
- Much harder to game than threshold checks
- ONNX Runtime Web is production-ready (used by Microsoft Office)
- Effort: 4-6 weeks.

**6. Zero-Knowledge Proofs — Privacy-Preserving Verification**
- ZK proof: "all 6 signals exceeded threshold" without revealing actual scores
- Nursing home regulator verifies training completion without seeing behavioral surveillance data
- Start server-side, move to browser as WASM performance improves
- Effort: 4-6 weeks.

### Tier 3 — Use for Sales Narrative Now

**7. Privacy Sandbox / Topics API** — Our protocol is ALREADY compliant. Zero third-party cookies, zero cross-site tracking. Use this fact in every pitch.

**8. Apple ATT** — "No ATT prompt needed" is a killer sales line for mobile advertisers. Our signals work within a single app context.

**9. Webcam Eye Tracking (WebGazer.js)** — Optional 7th signal. Gaze-content coherence. Add when a customer specifically wants it.

### The Killer Stack

The most powerful combination possible:

**WebAuthn (device proof) + 6 Behavioral Signals (human proof) + ZK Proof (privacy) + Verifiable Credential (interoperability) + On-chain Anchor (permanence)**

This produces a receipt that says: "A verified hardware device, operated by a verified human (6 behavioral signals above threshold, ZK-proven without revealing raw data), genuinely engaged with this content, issued as a W3C Verifiable Credential, anchored to Ethereum."

**No company in the world offers anything close to this.**

---

## BOTTOM LINE

### What we own that nobody else has:
1. The specific 6-signal behavioral science composite (Fitts', Hick's, timing entropy, scroll saccade, micro-pause, touch variance)
2. Attention quality tiers from behavioral signals (deep/active/passive/background)
3. SHA-256 cryptographic receipts proving attention events
4. Portable attention hashes across platforms
5. Multi-vertical scoring from one SDK (military, medical, insurance, education, workplace, advertising)

### Biggest risks to watch:
1. **BioCatch expansion** into attention measurement (they have the signal infrastructure)
2. **Adelaide moving from predictive to behavioral** measurement (they have the agency relationships)
3. **Google/Meta exposing internal attention metrics** to advertisers (they have the scale)
4. **Academic spin-outs** commercializing behavioral analysis tools (they have peer-reviewed validation)

### Immediate actions:
1. File utility patent emphasizing the COMBINATION (signals + tiers + receipts) — not individual signals
2. Hire patent search firm for FTO search (BioCatch and Google reCAPTCHA families specifically)
3. Start WebAuthn integration (strongest near-term technical moat)
4. Position as "Privacy Sandbox-compatible" and "ATT-compliant" in all marketing

*Report compiled from patent landscape analysis, competitor deep dive, and emerging tech research.*
*April 8, 2026 — SWS Strategic Media LLC*
