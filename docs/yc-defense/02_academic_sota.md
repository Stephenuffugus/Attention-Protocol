# Academic State of the Art — Behavioral Biometrics

Source: agent research synthesis 2026-04-26. Use to defend technical choices to a YC technical partner.

## Top 5 Citations to Use Proactively

1. **Killourhy & Maxion (2009)**, "Comparing Anomaly-Detection Algorithms for Keystroke Dynamics," DSN — gold-standard benchmark methodology; cite to prove we know how to measure EER.
2. **Frank et al. (2013)**, "Touchalytics," IEEE TIFS 8(1) — 30 touch features → <4% EER one week post-enrollment; anchors mobile signal claims.
3. **Acien, Morales, Fierrez, Vera-Rodriguez (2022)**, "BeCAPTCHA-Mouse," Pattern Recognition 127:108643 — neuromotor + GAN bots; cite as the SOTA we benchmark against.
4. **Khan et al. (2024)**, "Mouse Dynamics Behavioral Biometrics: A Survey," ACM Computing Surveys (arXiv:2208.09061) — current canonical survey; cite once for literature command.
5. **Lacquaniti, Terzuolo, Viviani (1983)**, "The law relating the kinematic and figural aspects of drawing movements," Acta Psychologica 54:115 — biomechanical invariant (2/3 power law); proves our signals are grounded in motor neuroscience.

## Top 3 Papers to Pre-empt

1. **Wagenmakers, Farrell, Ratcliff (2004)**, "Estimation and interpretation of 1/fα noise in human cognition," Psychon. Bull. Rev. 11:579 — many "1/f" claims are SRD (short-range dependence) artifacts. **Pre-empt:** show our α-estimator uses ARFIMA + AIC model selection, not naive log-log slope.
2. **Tan et al. (2024)**, "DMTG: Human-Like Mouse Trajectory Generation Bot Based on Entropy-Controlled Diffusion Networks," arXiv:2410.18233 — diffusion bots defeat single-signal detectors. **Pre-empt:** our gated composite (0.273 effective gap) is exactly designed for this; show DMTG-class trajectories in the adversarial harness.
3. **Iliou et al. (2023)**, "ReMouse Dataset," MDPI Cybersecurity — session-replay bots beat similarity-based detection because they ARE real human trajectories played back. **Pre-empt:** receipt + per-session nonce + cross-signal coherence detect replay even when the trajectory is genuine.

## Domain Coverage

### Mouse Dynamics
- Foundational: Pusara & Brodley (2004), Ahmed & Traore (2007), Shen, Cai, Guan (2012).
- Modern: Khan et al. 2024 survey; Acien BeCAPTCHA-Mouse 2022; Iliou et al. 2024 (mouse + comm metadata).
- Adversarial: DMTG (2024) defeats classical detectors; ReMouse (2023) defeats similarity-only methods.
- Features that matter: velocity profile (Fitts ballistic), curvature, jerk (3rd derivative), pause distribution, click-down/up dwell, micro-tremor. EER ranges: velocity+curvature ~5–15% on Balabit; +jerk+tremor below 5%.

### Keystroke Dynamics
- Foundational: Monrose & Rubin (2000) — flight time + dwell time. Killourhy & Maxion (2009) CMU benchmark — EER varies 8x between detectors (0.096 best, 0.828 worst).
- Modern: Stragapede et al. 2023 transformer (~3% EER on Aalto/HuMIdb); Acien et al. 2021 TypeNet (2.2% EER, 168k subjects).
- Adversarial: Tey et al. 2013 timing replay; Negi et al. 2018 GAN keystroke generators cut detector accuracy in half.

### Touch Dynamics (Mobile)
- Foundational: Frank et al. 2013 Touchalytics — 30 swipe features (velocity, pressure, finger area, inter-stroke time). 0% EER intra-session, 2–3% inter-session, <4% one week.
- Multi-touch: Feng FAST 2012/2014; Bo SilentSense 2013 (touch + motion sensors).
- Modern: Stragapede 2023 BehavePassDB; Stragapede 2024 multi-modal mobile (Pattern Recognition Letters).

### Reading from Scroll/Dwell (no eye tracking) — THIN LITERATURE = WHITE SPACE
- Cole et al. 2011 — scroll-and-dwell as gaze proxy.
- Lagun & Lalmas 2016 (WSDM) — viewport time as engagement at Yahoo scale.
- Arapakis et al. 2014 — dwell time as relevance proxy.
- **Validated reading-detection from scroll-only kinematics at the per-paragraph level is open.** Credible novelty claim for SWS.

### 1/f / Pink Noise
- Foundational: Gilden, Thornton, Mallon 1995 (Science 267:1837); Gilden 2001 (Psych Review 108:33).
- The skeptical counter: Wagenmakers, Farrell, Ratcliff 2004 — ARFIMA modeling shows many published "1/f" results are SRD-confounded. **MUST pre-empt.**
- Adversarial implication: bots with i.i.d. or AR(1) noise produce α≈0 or ~0.3, not the human α≈1. Genuine 1/f requires fractional integration — most bots don't have it.

### Cognitive-Motor Invariants
- Fitts 1954 (J. Experimental Psychology 47:381) — MT = a + b·log2(D/W+1). Bots without embedded Fitts produce constant-velocity straight lines.
- Hick 1952 — choice RT = a + b·log2(n+1). Generalized to entropy form.
- Lacquaniti 1983 — 2/3 power law (V = K·C^-1/3). Biomechanical, not data-learnable. Zago et al. 2018 confirms robustness; Maoz 2006 addresses noise floor.
- Most public bot frameworks (puppeteer-extra-stealth, ghost-cursor) implement Fitts approximately but NOT the 2/3 power law.

### Cross-Signal Coherence — WHITE SPACE
- Score-level fusion: Ross & Jain 2003 (IEEE TPAMI), Nandakumar et al. 2008 (likelihood-ratio fusion).
- Feature-level fusion: standard in surveys.
- **No paper formalizes "human signals must be mutually coherent or it's a bot."** Closest: Chingovska 2014 (face/voice liveness via cross-modality consistency). Stragapede 2024 (multi-modal mobile) — additive score fusion, not coherence as primary signal.
- **SWS gated composite is novel here. Defensible category.**

### Cryptographic Commitment to Behavior
- Foundational: Goldwasser/Micali/Rackoff 1989 (ZKPs); Pedersen 1991 (commitments); Groth 2016 (zk-SNARKs).
- Closest prior art: arXiv:2603.00179 (2026) — "Privacy-Preserving Proof of Human Authorship via Zero-Knowledge Process Attestation" (Groth16 + Pedersen + Bulletproofs over keystroke/typing/editing).
- Liu et al. 2024 (Computers & Security) — BioAu-SVM+ZKP. Guo et al. 2022 — biometric ID via zk-SNARK.
- **SWS differentiator:** existing schemes prove "I match a stored template." We commit to RAW behavioral evidence + composite score as a tamper-evident receipt, separable from identity. **This framing has no clear named precedent.**

### Statistical Calibration
- Conformal prediction (Vovk/Gammerman/Shafer 2005; Angelopoulos & Bates 2023 tutorial arXiv:2107.07511) provides distribution-free finite-sample coverage — the right framing for a "human-confidence p-value."
- **Almost no behavioral-biometric paper uses it.** Eberz et al. 2017 (AsiaCCS) closest. **Adopting conformal calibration is a free credibility win for SWS.**
