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

*Report compiled from patent landscape analysis and competitive research.*
*Next update: After emerging tech integration research completes.*
