# Global Tech Scout — Asia / Israel / Russia / Eastern Europe

Source: agent research synthesis 2026-04-26. Cutoff: April 2026.

## TL;DR — three things to absorb, three to fear, three to cite

### Top 3 to absorb

1. **Bind the receipt optionally to a TEE/TPM attestation quote** (composite-attestation pattern, CCxTrust 2025). Software fallback for non-TEE devices. Single biggest defensibility upgrade available — receipt becomes silicon-anchored.
2. **Multi-instance / session-vector aggregation** (Session2vec, MDPI Electronics, May 2025). 20 signals → session embedding hashed into receipt. Verifier checks "session embedding is consistent with human-distribution prior."
3. **Side-channel keystroke verification** (Ben-Gurion University Malboard defense). Adds timing-distribution + error-correction-reaction features so a Malboard-style USB injection that forges rhythm still fails our higher-order signals. Closes the most public attack on keystroke biometrics.

### Top 3 threats

1. **DMTG diffusion mouse-trajectory bot** (Tsinghua, arXiv 2410.18233, Oct 2024). Reduces bot detection by **4.75–9.73%** vs. prior baselines. Targets GeeTest, Akamai. Until our gated composite is benchmarked against DMTG, the published "0.273 effective gap" carries an asterisk.
2. **BioCatch Trust Australia** — Permira-funded, $1.3B, $160M+ ARR Q2 2025, 525M users. Now building **inter-bank cross-tenant intelligence-sharing** — exactly the network-effect moat we want for receipts.
3. **Transmit Security "Blinded by the Agent"** (Oct 2025). They publicly make our same "behavioral bio is broken by AI agents" argument, then funnel buyers into Mosaic + passkeys. Risk: they own the narrative before we do.

### Top 3 academic citations to pre-empt

1. **Liu, Cui, Ge, Zhan. DMTG: A Human-Like Mouse Trajectory Generation Bot Based on Entropy-Controlled Diffusion Networks. arXiv:2410.18233 (Oct 2024).**
2. **Zhang, Pan, Han, Wang, Lu. Session2vec: Session Modeling with Multi-Instance Learning for Accurate Malicious Web Robot Detection. Electronics, MDPI, May 2025.**
3. **Plesner et al. (ETH Zurich, 2024)** defeating reCAPTCHAv2 with YOLOv8 + simulated mouse model — "CAPTCHA is dead" canonical citation. Pair with **BGU Malboard paper** (Computer & Security) for "keystroke-rhythm alone is forgeable."

## Israel — high-impact players

| Player | What's new (2024-2026) | Implication |
|---|---|---|
| **BioCatch (post-Permira)** | $160M+ ARR, 15B sessions/mo, 525M users, BioCatch Trust Australia inter-bank graph | Building cross-tenant moat we don't have |
| **Transmit Security** | Mosaic on Google Cloud (2025) + "Blinded by the Agent" public report | Same thesis, different solution (passkeys vs receipts) |
| **Source Defense** | Pure-play client-side script integrity, PCI DSS 4.0 6.4.3/11.6.1 | Complementary, not competitive |
| **HUMAN Security** | Sightline (2025) — operator-level attack-attribution graph | Operator-graph capability we don't have |
| **Akamai Israel R&D** | Bot Manager 100+ signals, edge ML | Closest functional competitor in "JS sensor → score" category — but no receipt |
| **Ben-Gurion University** | **Malboard** paper (Computer & Security): USB keyboard auto-generates keystroke streams cloning victim's rhythm; defeats commercial keystroke-dynamics products | Pure timing-based keystroke is forgeable; defense is side-channel |

## China — DMTG is the fire alarm

- **DMTG (Tsinghua, Oct 2024)** — entropy-controlled DDIM diffusion + style-transfer for per-user, per-page mouse trajectories. Targets Akamai + GeeTest. **Single most important offensive paper of the cycle.** Must benchmark against this before any pitch.
- **Session2vec (MDPI Electronics, May 2025)** — FastText URL vectors + SARD/SFAR aggregation. Direct competitor to session-receipt thinking — argues session-level modeling beats per-event. Cite or pre-empt.
- **Tencent / Alibaba / Baidu** — production tooling (T-Sec, Alibaba Cloud Anti-Bot, Baidu Fengchao) heavily ML-based; English-language research thin; operate at >10× BioCatch scale.
- **Chinese CAPTCHA-bypass economy** (打码平台) — CapSolver, 2Captcha, YesCaptcha now AI-driven. ETH Zurich 2024: YOLOv8 solves reCAPTCHAv2 at **100%**. Visual CAPTCHA is dead in 2026.

## Japan / South Korea

- **NEC, Fujitsu, NTT DATA, MUFG consortium** — decentralized digital identity (SSI) with behavioral layer. Light on published behavioral-bio research vs Israeli players.
- **LINE Yahoo (2025)** — post-data-leak remediation built behavioral + correlation analysis rules. eKYC mandatory.
- **Samsung Knox + Secure Enclave attestation** — relevant adjacent vector; see hardware attestation section.

## Russia

- **Group-IB (Singapore HQ, Russian-rooted)** — Fraud Protection module: behavioral biometrics + device fingerprint + geolocation + keystroke + AI-driven Unified Risk Platform (2024-2025). Spun off Russian ops to F.A.C.T. Deep payment-fraud telemetry across MEA/SEA banking.
- **Kaspersky** — 2025 messaging shifted: now publicly warns biometric data is being targeted as **immutable credential** (Q2 2025 phishing report). English-language research output dropped post-sanctions. Strategic implication: their "biometrics is now an attack target" thesis **strengthens our cryptographic-commitment positioning**.
- **Yandex** — KillBot Web Protector (Yandex Cloud Marketplace). Multi-layered approach. No published behavioral-biometric SDK.

## India

- **Aadhaar / UIDAI** — 2.7B+ authentications FY24-25. Jan 2025: private companies (HyperVerge) granted Aadhaar infrastructure access using behavioral data analytics. UIDAI publicly says it will use behavioural insights for Mandatory Biometric Update. India is becoming the world's largest behavioral-biometric data lake, accessible via API.

## Eastern Europe / Switzerland

- **ETH Zurich (Plesner et al., 2024)** — defeated reCAPTCHAv2 100% using YOLOv8 + VPN + simulated mouse + fake browser/cookie state. Canonical "CAPTCHA is dead" citation.
- **NDSS 2025** — Cascading Spy Sheets (CSS-based fingerprinting attacks).
- **IMC 2025** — FP-Inconsistent (measures fingerprint inconsistencies in evasive bot traffic) + Breaking the Shield (attacks Brave's farbling + 9 anti-fingerprint extensions).

## Cross-cutting techniques (any region)

- **Hardware attestation (TEE / TPM / Secure Enclave)** — 2025 saw composite attestation (CCxTrust) binding CPU-TEE + TPM into a single signed quote. ElasticPay (PMC 2024) uses TEE+TPM+SE for offline P2P payments. Strategic call: **our receipt should optionally bind to a TEE attestation when present**, making it nearly unforgeable on-device.
- **Federated behavioral biometrics** — Hybrid CNN-RNN federated models hit >92% user-ID accuracy on edge devices (2025). DBS, HSBC piloting layered (face+voice+behavior) stacks. Threat to our privacy story.
- **ZKP + biometric commitment** — Pedersen vector commitment + multimodal ZKP scheme published in PLOS One 2025; BioAu-SVM+ZKP (Computers & Security 2024). Directly overlap our patent language. **Patent attorney consult required.**

## Sources

See agent's full source list in original research output; key ones:
- [DMTG arXiv:2410.18233](https://arxiv.org/abs/2410.18233)
- [Session2vec MDPI Electronics May 2025](https://www.mdpi.com/2079-9292/14/10/1945)
- [BGU Malboard ScienceDaily summary](https://www.sciencedaily.com/releases/2019/06/190606101847.htm)
- [Permira/BioCatch $1.3B](https://www.permira.com/news-and-insights/announcements/permira-completes-acquisition-of-majority-position-in-biocatch-at-13-billion-valuation)
- [Transmit Security "Blinded by the Agent"](https://finance.yahoo.com/news/transmit-security-warns-ai-agents-131500747.html)
- [ETH Zurich reCAPTCHAv2 defeat](https://quantaintelligence.ai/2024/09/29/technology/new-study-reveals-captcha-vulnerabilities)
- [CCxTrust composite TEE+TPM (CNCF Oct 2025)](https://www.cncf.io/blog/2025/10/08/a-tpm-based-combined-remote-attestation-method-for-confidential-computing/)
