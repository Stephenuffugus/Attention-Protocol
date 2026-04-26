# Competitive Landscape — April 2026

Source: agent research synthesis 2026-04-26. Use this as the "who else is in the lane" reference for YC partner conversations.

## Bot/Fraud Detection (Verdict-as-Output)

| Vendor | Claim | Public Numbers | Output | Funding |
|---|---|---|---|---|
| **BioCatch** | 2,000+ behavioral parameters; mouse/touch/gyro/typing for fraud, AML, scam | $160M+ ARR Q2 2025; 280+ FIs; 14B sessions/mo | Risk score | Permira buyout $1.3B Sep 2024 |
| **HUMAN Security** (White Ops + PerimeterX) | 15T interactions/wk; TLS/JA3-JA4, geo, honeypots, behavior | Forrester Wave Q3 2024 leader | Bot/no-bot verdict | Public/PE-backed |
| **Cloudflare Turnstile** | Privacy-preserving CAPTCHA replacement | "as effective as CAPTCHA" (no numbers) | Pass/fail token | GA Q3 2024 |
| **DataDome** | 99.99% accuracy, 0.01% FPR (vendor claim) | 3T data points/day, sub-2ms | Per-request bot score | $42M Series C Q4 2024 |
| **Akamai Bot Manager** | 700+ dimensions | Undisclosed | 0–100 score | Inside Akamai |
| **Imperva (ex-Distil)** | 99.9% bad-bot block (vendor) | 2025 Bad Bot Report: 37% of all traffic | Classification + block | Inside Thales |
| **Arkose Labs** | 225+ signals; attacker-economics framing | Undisclosed | Score | $70M Series D Q1 2025 |
| **Kasada** | Invisible validation | Forrester Strong Performer | Score | $20M early 2026 |

## AI-Text Detection (Artifact Score)

| Vendor | Vendor Claim | Independent Number | Defeated By |
|---|---|---|---|
| GPTZero | 99.3% accuracy, 0.24% FPR | Holds up in ed benchmarks | Paraphrasers/humanizers |
| Turnitin AI | (not published) | 5–7% FPR on pure human | Paraphrasers |
| Copyleaks | 99% / 0.2% FPR | Independent: 90.7% / ~5% FPR | Paraphrased ChatGPT (100→0%) |
| Originality.ai | (not published) | 83% in head-to-head vs GPTZero | Paraphrasers |

PMC 2025 meta-analysis: **all academic AI-text detectors are unsuitable as sole evidence** in academic-integrity cases. They look at the artifact, not the writing process.

## Proctoring (Webcam + Lockdown)

Proctorio, Honorlock, ExamSoft, Respondus Monitor.

- Market: $868M (2024) → $2.35B (2031). US: $160M (2024).
- **In customer revolt:** Ohio State dropped Proctorio for Honorlock 2024. CUNY petition 27K signatures killed Proctorio there. UT Dallas anti-Honorlock petition.
- Persistent bias studies (race/face-detection) since MIT Tech Review 2020; EFF + EPIC FTC complaint Dec 2020 still unresolved.
- Bypass: virtual webcam, second device, knuckle-scanner spoofing — widely documented.
- Output: flagged video clips for human review; **no cryptographic evidence**.

## Identity / Proof-of-Personhood (Orthogonal)

- **Worldcoin / World** — iris-scan Orb. ~33M World App users, 15M verified Sep 2025. Launched **AgentKit** April 2026 + Tinder integration. Thesis: AI agents need a verified human principal.
- **Holonym Human ID, Privado ID, Anon-Aadhaar, Civic** — ZK personhood credentials. Identity, not behavior.

## Adversarial-Robustness Findings (YC-Relevant)

- **Springer IJIS 2023/2024**: black-box attacks on single-modal mouse/keystroke biometrics succeed at **86–87%**.
- **ScienceDirect Computers & Security 2025**: current keystroke/mouse systems "cannot adapt to user behavior evolution and suffer from limited efficacy."
- **MDPI Cybersecurity 2025 / SJSU 2024**: multi-modal fusion (keyboard + mouse temporally aligned) reaches 99% with 96% spoofing detection. **Validates SWS multi-signal thesis.**

## The Tamper-Evident Receipt Question

**Verified: no vendor in the bot/fraud/proctoring/AI-detection space publishes a tamper-evident cryptographic receipt of session behavior.** Closest analogs:

- FIDO/WebAuthn attestation — proves device authenticity, not session behavior
- HYPR context-based attestation — signed proof-of-presence, one-shot login only
- AuthProof SDK — signed delegation receipts for AI agents, not humans
- C2PA — content provenance for media, not user actions
- Guardtime / Trillian / RFC 6962 Merkle logs — software supply chain & AI-agent audit logs

**The unfilled adjacent market:** late-2025 arXiv paper notes "no existing system provides a tamper-evident, independently verifiable record of what AI agents did." The same gap, unfilled, exists for humans. **SWS Attention Protocol is positioned to own this category.**

## White-Space Analysis (Where to Push)

1. **Receipt-as-product** — every incumbent sells a verdict to the defender (bank, publisher, school). None gives the user / regulator / court a portable hash-anchored record. Owning the receipt format is category creation, not a feature.
2. **Adversarially-robust multi-modal with PUBLISHED benchmarks** — single-modal vendors fail at 86–87% adversarial. Multi-modal academic results hit 99% but no vendor publishes EER. Publishing the gated-composite 0.273 effective gap openly would be a first.
3. **Credentialing/CME wedge** — proctoring incumbents in revolt; BioCatch/HUMAN/DataDome won't enter. $868M market with no cryptographic evidence layer and regulatory tailwind.

## Funding Heat (12-month)

- BioCatch: PE buyout (slowing innovation) → opening for nimble entrant
- DataDome, Arkose, Kasada: still raising → category remains hot
- Imperva: inside Thales, slow → opening
- Proctoring incumbents: customer churn, no major rounds → opening
- Behavioral-biometrics market projection: $18.4B by 2033 (Astute Analytica)

## See also

- [06_global_tech_scout.md](06_global_tech_scout.md) — Asia / Israel / Russia / Eastern Europe scout (DMTG, BGU Malboard, Transmit Security, Tencent, Aadhaar, etc.)
- [07_beyond_botd_fingerprinting.md](07_beyond_botd_fingerprinting.md) — top 5 env-gate upgrades to catch puppeteer-extra-stealth
- [08_ai_text_detection.md](08_ai_text_detection.md) — Pangram + distilGPT2 plan for the CME reflection field
- [09_cross_signal_coherence_math.md](09_cross_signal_coherence_math.md) — formal copula-based defense of our coherence claim
