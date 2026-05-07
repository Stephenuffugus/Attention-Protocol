# CME / Pharma / Compliance Glossary
**Phone-readable. Tap-to-find what a term means mid-call.**

Alphabetical. Use Find on Page on your phone (Ctrl-F or browser menu Find on Page) to jump to a term during a call.

---

**ABFM** = American Board of Family Medicine. Issues family-medicine MOC.

**ABIM** = American Board of Internal Medicine. Issues internal-medicine MOC. ABIM-MOC credit is one of the most-valued credit types in CME.

**ABPN** = American Board of Psychiatry and Neurology. Issues psychiatry/neurology MOC. PPP (your practice round 1) targets this audience.

**ACA** = American College of Apothecaries. Joint-providership for pharmacy CE.

**ACCME** = Accreditation Council for Continuing Medical Education. The regulator. Accredits CME providers. Issues guidance (e.g., December 2025 AI guidance).

**ACPE** = Accreditation Council for Pharmacy Education. The pharmacy-CE regulator. Equivalent of ACCME for PharmDs.

**ANCC** = American Nurses Credentialing Center. Nursing-CE regulator. Equivalent of ACCME for RNs.

**Anti-pitch** = the conversation opener where you say "this is a learning conversation, not a pitch" and ask them to teach you their reality. Recommended for practice rounds 1-3.

**BioCatch** = Israeli behavioral fraud detection company, ~2000 features, classifier output. The biggest competitor in the lane. SWS does NOT compete on classifier accuracy; SWS ships a signed receipt. Different artifact.

**CAIQ-Lite** = Cloud Security Alliance security questionnaire. Pre-fill exists in docs/security-questionnaire-prefill.md. Hand to any prospect who asks for security info; saves ~2 weeks per pilot.

**CECBEMS** / **CAPCE** = EMS continuing education accreditor.

**CME** = Continuing Medical Education. The umbrella term for physician CE.

**CMS** = Centers for Medicare and Medicaid Services. Sometimes referenced as a regulator pressure point in compliance training.

**COPE** = Council on Optometric Practitioner Education. Optometry CE accreditor.

**Composition Integrity** = Layer 03 in the SWS receipt. Catches paste-burst + no-backspace + LLM-tell digraph patterns. Per arxiv 2511.12468.

**CPE** = Continuing Pharmacy Education. ACPE-accredited.

**CPE Monitor** = NABP's national registry where every pharmacy CPE completion is reported. Forms the audit trail; central to PharmCon / freeCE conversations.

**Direct W-2** = the cleanest hire mechanism. Foreign company has a US legal entity and you become their full W-2 employee. Best benefits, best comp.

**DPA** = Data Processing Agreement. A legal artifact a privacy-conscious buyer will want before signing a pilot. SWS does not have one drafted yet. T1-5 in HARDENING_PLAN.md.

**DPIA** = Data Protection Impact Assessment. GDPR Article 35 risk assessment. SWS has one drafted (docs/privacy-DPIA.md, 2026-05-05).

**Ed25519** = the digital signature scheme used by SWS receipts. RFC 8032. Verifiable offline against the JWKS.

**EOR** = Employer of Record. A third-party W-2 employer (Deel / Remote.com / Velocity Global) used by foreign companies hiring US workers without a US legal entity. You're a W-2 of the EOR; benefits via EOR.

**Evidence field** = OpenBadges 3.0's first-class field for attaching proof that a credential was earned. SWS receipts plug into this field.

**FDA Part 11** = 21 CFR Part 11. Governs electronic records integrity in regulated settings (pharma, medical devices). +73% YoY warning letters in H2 2025. The pressure point you cite to Pfizer-adjacent buyers.

**Field Pouch** = Lucid Winds gameplay term. WILD-tab inventory.

**Fitts' Law** = SWS Layer 02 signal. Movement-time-vs-distance regularity. Humans curve, bots teleport.

**Fractional CTO** = part-time CTO-level engineering work for an early-stage startup. 10-15 hrs/week typical. $150-200/hr.

**GxP** = Good X Practice (Manufacturing, Laboratory, Distribution, Clinical, etc.). Pharma compliance umbrella.

**Hick's Law** = SWS Layer 02 signal. Reaction time scales with number of choices. Humans slow with more options; bots respond at constant speed.

**Honeypot** = SWS Layer (canary). Invisible word or instruction that catches LLM-assisted answers.

**IME** = Independent Medical Education. Pharma-funded, content-independent CME. The grant cycle that funds most large MECs.

**Imperium** = panel-fraud detection (M3 Global stacks them with reCAPTCHA + photo-ID). SWS doesn't replace; SWS layers a signed artifact on top.

**JWK / JWKS** = JSON Web Key / JSON Web Key Set. The public-key format. SWS publishes its JWKS at /.well-known/attention-pubkey.json. Verifiers fetch this once and verify forever.

**JWT** = JSON Web Token. SWS receipts are JWTs (encoded as base64url + Ed25519 signature). Paste into verify.html to validate.

**Knapsack solver** = the algorithm Trackfit uses. Constraint-based packing problem.

**Learner integrity** = the new ACCME term covering "did the right person actually complete this." This is THE concept the December 2025 ACCME AI guidance is about.

**LMS / LXP / LRS**:
- LMS = Learning Management System (Moodle, Canvas, D2L, Cornerstone)
- LXP = Learning Experience Platform (Degreed, EdCast)
- LRS = Learning Record Store (Watershed, Veracity, Yet Analytics, Learning Pool)

**LOI** = Letter of Intent. Non-binding commitment to a paid pilot or contract. Often the first artifact a discovery call produces.

**MEC** = Medical Education Company. The independent CME providers (DKBmed, Prova, PeerView, etc.).

**Microentity** = USPTO patent fee tier for solo founders earning under threshold. ~75% discount on official fees. Provisional filing fee = $65.

**MOC** = Maintenance of Certification. The board-level recertification on top of state license CE. Higher-prestige credit type.

**NABP** = National Association of Boards of Pharmacy. Runs CPE Monitor.

**NASBA Standard 24** = the CPA-CPE rule that sponsors must monitor learner attendance "with sufficient frequency and lack of predictability." Interpreted as 3 polling questions per credit hour with unpredictable timing. SWS replaces with one signed receipt.

**OpenBadges 3.0 (OB 3.0)** = 1EdTech standard for digital credentials. W3C VC 2.0-compatible. Has an `evidence` field where SWS receipts plug in.

**OpenTimestamps** = the Bitcoin-anchored timestamping protocol SWS uses. Anchors receipt hashes to specific Bitcoin blocks. Free, open, permissionless.

**P(human)** = "probability of human". calibrated Bayesian score the SWS gated composite produces. NOT a binary bot/human verdict.

**Part 11** = see FDA Part 11.

**Pi App Studio** = Pi Network's app submission and approval system. Lucid Winds submits Friday May 9.

**PII** = Personally Identifiable Information. SWS does NOT collect any. This is the lead in every call's first 60 seconds.

**Procurement** = the formal vendor-evaluation process at large companies. Slow, paperwork-heavy, requires SOC 2 + DPA + MSA. Director-level cold email bypasses it for discovery; pilots may still hit it later.

**Provisional patent** = USPTO mechanism that locks in priority date for 12 months. $65 microentity fee. SWS-PROV-001 already filed. Blink filing planned.

**Roundtable** = YC W24 proof-of-humanness API for surveys. Behavioral biometrics. Possible OEM/partnership for SWS, not direct competitor in CME lane.

**RFP** = Request For Proposals. Pharma's grant-application format. MECs submit competing proposals on a rubric.

**SaaS** = Software as a Service. The standard cloud-hosted business model.

**SOC 2** = AICPA security audit framework. SOC 2 Type 1 = point-in-time. Type 2 = ongoing. Costs $25-50K. Required for production contracts at most F500 buyers; not required for discovery calls.

**Stare Protocol** = Blink's signed peer-to-peer match handshake + state machine + offline/BLE fallback. The thing being filed for provisional patent.

**SVG** = Scalable Vector Graphics. Lucid Winds plant artworks are SVG, deterministically generated from SHA-256 hashes.

**TAM** = Total Addressable Market. The size of the buyer pool for a given vertical.

**Terra Grade** = Lucid Winds rarity grade for plant traits.

**Tier 1 / Tier 2 / Tier 3** = SWS pricing tiers and prospect access tiers. Same name, different concepts. Context-dependent.

**TGE** = Token Generation Event. Web3 / crypto product launch event. Mentioned for pre-seed Web3 prospects with token-only comp.

**Tier 4 conversation** = OUTREACH_PLAY.md term. The post-call follow-up earned by the conversation.

**Touch dwell** = SWS Layer 02 signal. How long a finger rests on a button before lifting. Real humans vary; bots are uniform.

**USPTO** = United States Patent and Trademark Office. uspto.gov/EFS-Web for filing.

**VC** / **Verifiable Credential** = W3C VC 2.0 standard for digital credentials. SWS receipts are conformant VCs (vc-jwt format). Compatible with any VC-aware wallet.

**xAPI** = Experience API (ADL spec, 1.0.3). Standard for tracking learning experiences. SWS ships an xAPI adapter (src/sdk/xapi-adapter.js).

**YC S26** = Y Combinator Summer 2026. SWS application filed May 4, 2026. Decision window 4-8 weeks (June through mid-July).
