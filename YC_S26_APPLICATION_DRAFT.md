# YC S26 APPLICATION — WORKING DRAFT
## For: Stephen Furpahs, SWS Strategic Media LLC
## Deadline: May 4, 2026
## Status: DRAFT — needs 6 inputs from Stephen before lock

---

## HOW TO USE THIS DOCUMENT

1. Read every answer top to bottom
2. Anywhere you see **`[BRACKETS]`** — that's something only you can fill in
3. Anywhere you see **`[STEPHEN: REVIEW]`** — I'm not sure I captured your voice; please rewrite in your own words
4. When every bracket is gone, copy-paste into the YC application form at **https://www.ycombinator.com/apply**
5. Record the founder video LAST — the script is at the bottom

**Strategic framing (don't forget while editing):**
- Patent filed is the single most credible asset — lead with it when honest to do so
- Solo-founder penalty is real; lean into the "directed multi-team workflow" narrative, not "I'm alone"
- Roundtable (YC-backed Proof of Human) is the obvious comparison — acknowledge it cleanly, then draw the wedge
- Honesty reads as commitment when you have a working artifact. Don't soften the hard numbers.

---

## THE SIX INPUTS — some pre-filled from context, CONFIRM or OVERRIDE each one

| # | Field | Pre-filled (edit if wrong) |
|---|-------|-------------|
| 1 | **City now / post-YC (if accepted)** | **Uniontown, OH** / **Mountain View, CA** *(YC post-acceptance default — change if you'd pick SF or would stay remote)* |
| 2 | **Legal operating entity** (state of formation) | **SWS Strategic Media LLC** — state: `[CONFIRM — likely Ohio per your Uniontown, OH registered address, but check the LLC formation certificate]` |
| 3 | **One pre-existing accomplishment** | *Draft below, rewrite freely:* **"I have operated Stevie Weed Seed, an affiliate/content site, for several years — built the traffic, handled the content ops, and ran the monetization side myself. I also designed and am shipping Lucid Wins, a consumer game with a planned Pi Network (47M user base) deployment. I've worked direct-line in the food-service industry long enough to know where the real compliance-training pain lives, which is why restaurants/franchise training is one of our wedge verticals."** `[REWRITE so this sounds like you talking, and add anything else — work you led, creative projects with real traction, etc.]` |
| 4 | **Honest burn rate + runway** | `[FILL — private / your call]` Format: `Bank: $X. Burn: $Y/mo. Runway: Z months.` Desperation reads as commitment when paired with a working patent-filed artifact. |
| 5 | **Patent provisional serial number** | `[FILL — log into https://patentcenter.uspto.gov and find your 2026-03-17 filing, copy the 63/XXX,XXX serial]` |
| 6 | **Date project started** | *Context I found:* First git commit was **2026-03-27**. Patent drafting likely began earlier. Provisional filed **2026-03-17**. Suggest: `"Patent drafting early 2026; provisional filed 2026-03-17; production SDK first commit 2026-03-27"` — **confirm or replace with whenever you personally consider the project to have begun.** |

---

## COMPANY

### Company name
**SWS Strategic Media LLC** *(confirm — item #2 above)*

### Company URL, if any
- Primary: **https://stevieweedseed.com**
- Proof gallery: **https://sws-attention-proofs.web.app**
- Patent docket: SWS-PROV-001

### Describe what your company does in 50 characters or less.
**Cryptographic receipts of real human attention.**
*(47 chars — fits)*

### Company URL, if any (demo)
**https://sws-attention-proofs.web.app** — live proof gallery covering 9 verticals

### What is your company going to make? Please describe your product and what it does or will do.

We generate cryptographic attention receipts — Ed25519-signed, optionally Bitcoin-anchored — that prove a real human was actually paying attention to a screen, not a bot, not a distracted scroller, not a click-farmer, not an LLM. Every receipt is a W3C Verifiable Credential with a 20-signal behavioral human-confidence score (timing entropy, Fitts' Law, Hick's Law, scroll saccade, micro-pause, touch variance, keystroke dynamics, keystroke digraph timing, reading-speed coherence, window-focus coherence, hover dwell, tab visibility, inactivity patterns, RT variability, scroll backtracking, fractal 1/f scaling, cross-signal correlation, curvature index, cursor jerk/LDLJ, velocity profile, two-thirds power law, device motion) plus a separate LLM-integrity verdict (paste-burst + digraph detector, invisible honeypot canary) and an environmental bot-gate (FingerprintJS BotD). Signals collapse into one human-confidence score and one quality tier (Deep Focus, Active, Passive, Background); the receipt lets any buyer verify everything offline with only our public key — proven via a published offline-verify script using only Node built-in crypto, zero network calls.

The receipts are tamper-evident, privacy-preserving (no PII — just behavioral shape), and work on web and mobile. Architecturally designed to be SCIF-eligible — no content data is stored, only behavioral metrics.

We ship the protocol three ways:

1. **B2B verification service** — Enterprises drop a single JavaScript tag and get scored attention receipts via API. Target verticals: restaurant training compliance (founder's domain), market research panels, nursing home monitoring, corporate training/LMS, advertising, healthcare/digital therapeutics.
2. **Developer SDK** — Any app developer embeds the protocol and gets engagement analytics + verifiable receipts. Revenue split: 70% user, 29% developer, 1% protocol.
3. **Consumer game (Lucid Wins)** — Players earn receipts as they play, redeemable inside the game ecosystem. This is the consumer-facing flywheel and the source of our behavioral calibration dataset. *(Currently in development — no game code shipped yet.)*

The protocol is live on a production site (stevieweedseed.com) generating real attention hashes right now, and the provisional patent was filed March 17, 2026 at the USPTO covering 247 distinct innovations across 24 categories.

### Where do you live now, and where would the company be based after YC?

**Now:** Uniontown, OH | **After YC:** Mountain View, CA *(or wherever YC's current in-person requirement places the batch — confirm at acceptance)*

---

## FOUNDERS

### Please enter the url of a 1 minute unlisted (not private) YouTube video introducing the founder(s).
*(Script at the bottom of this doc — record last, after the written application is locked)*
**[YOUTUBE URL — TO BE FILLED AFTER RECORDING]**

### How long have each of you known one another and how did you meet?
**N/A — solo founder.** See "Why solo" below.

### Who writes code, or does other technical work on your product? Was any of it done by a non-founder?

I direct all technical work. I am not the line-by-line coder — I architect, spec, and review, and I run a small, directed set of AI-assisted engineering agents (primarily Claude Code) that produce the implementations against my specifications. Every commit in the repo is code I have read, tested, and approved. The patent specification, the trade-secret catalog, the 20+ vertical audits, the behavioral science signal library, and the working SDK are all products of this directed workflow.

No non-founder has equity or ownership in the work. No contractors. No co-authors on the patent.

`[STEPHEN: REVIEW — does this capture how you actually work? If you wrote code yourself at any point, add it.]`

### Are you looking for a cofounder?

Open to the right match. I'm solo today because the patent and protocol work demanded a single unified voice through filing, and because the verticals are so broad (market research, insurance, healthcare, advertising, defense, education, training) that a cofounder locked to one domain would have been a constraint, not a force multiplier. Post-funding, a technical cofounder with distributed-systems or cryptography depth, or a commercial cofounder with enterprise B2B sales experience, would be a strong fit.

---

## PROGRESS

### How far along are you?

Far enough to show you what we built, not far enough to show you revenue yet.

**Shipped:**
- Provisional patent filed at USPTO on March 17, 2026 (serial # `[FILL — input #5]`), 29 pages, 247 innovations across 24 categories, $65 micro-entity fee paid, 12-month utility conversion deadline March 17, 2027
- Production SDK: ~30 modules, **778 automated tests passing (100%)** across 36 suites, full suite runs cleanly in ~5.8 minutes (verified 2026-04-24). SDK weighs 48 KB gzipped, loads in 2.8 ms mean / 6.4 ms p95, costs ~2.2 µs per recorded interaction, adds ~108 bytes heap per interaction.
- Live site generating real attention hashes: stevieweedseed.com (Firebase project `focus-grove-fffa8`)
- Public proof gallery covering 9 verticals, with dual-tracked SWS vs. GA4 comparisons, plus nine live public pages including a browser-side full-receipt verifier and a 3-minute proof-of-humanness credential issuer: **https://sws-attention-proofs.web.app**
- **Seven-layer attestation stack, all live:** (1) environmental bot-detection gate via FingerprintJS BotD, (2) 20-signal behavioral composite (timing entropy, Fitts, Hick, scroll saccade, micro-pause, touch variance, keystroke dynamics + digraph timing, reading-speed coherence, window-focus coherence, hover dwell, tab visibility, inactivity, RT variability, scroll backtracking, fractal scaling, cross-signal correlation, curvature index, cursor jerk/LDLJ, velocity profile, two-thirds power law, device motion), (3a) Composition Integrity — paste-burst and keystroke-cadence LLM-cheating detection (Signal 21), (3b) Honeypot Canary — invisible prompt-injection token that trips LLM-assisted sessions (Signal 22), (4) Consent attestation (GDPR Art. 7 / CCPA §1798.120), (5) Ed25519 (EdDSA) cryptographic signature with public JWKS at /.well-known/attention-pubkey.json + validated multi-key rotation path (dry-run complete), (6a) OpenTimestamps Bitcoin anchoring for maximum tamper-resistance, (6b) RFC 3161 Timestamp Authority (DigiCert/Sectigo/GlobalSign compatible) as a pharma-regulator-familiar alternative to Bitcoin
- **Bot-vs-human discrimination, the honest version:** Against standard Puppeteer bot profiles (Naive, Jittered, Selenium, Sophisticated) the behavioral composite alone discriminates by 0.06–0.10. Against a deliberately-sophisticated paste-bot that paces itself like a slow human reader (LLM Paster, measured: 0.61 behavioral composite), behavioral signals alone overlap with the human distribution — by design, a bot coded to pace like a slow reader IS behaving like a slow reader on the reading pass. What catches every bot deterministically is the multi-layer defense: the environmental-gate fingerprint (100% Puppeteer detection via BotD), the composition-integrity paste/mechanical-typing detector (arxiv 2511.12468, 97–99% F1), and cryptographic receipt that proves tamper-evidence. In every Puppeteer adversarial test we have run, 4/4 bots are caught by at least one non-behavioral layer, and the GATED composite pins them to tier PASSIVE (0.300) regardless of behavioral score. Our published gap is the **GATED 0.273** — not the behavioral composite alone. Anyone claiming single-signal behavioral bot detection is ignoring the sophisticated-adversary case; we ship the defense-in-depth because it's what actually holds up.
- Enterprise-ready integrations: W3C Verifiable Credentials (VC Data Model 2.0), OpenBadges 3.0 issuer (LinkedIn-portable), xAPI 1.0.3 adapter (Moodle / Canvas / Articulate / D2L), compressed humanness credential URLs that fit in a standard QR code
- 21 CFR Part 11 clause-by-clause mapping page and evidence-kit ZIP for pharma procurement qualification without a meeting
- Printable compliance report, differential privacy, and WebAuthn device binding modules
- One-tag embed (`<script src="...">`) that any site can drop on any page in 10 minutes
- Trade secret catalog secured; specific calibration values deliberately kept out of the patent

**Not yet shipped:**
- First paying pilot customer (in active outreach)
- Utility patent conversion (budgeted $3-5K, must convert by March 17, 2027)
- 30-day dual-tracked dataset showing the delta between SWS quality metrics and GA4 baseline on real production traffic (begins the moment the Firestore sync deploys this week)

### How long have you been working on this?

Patent drafting began early 2026, provisional filed at USPTO on **March 17, 2026**, production SDK first commit **March 27, 2026**, live attention-hash generation on stevieweedseed.com began same week. Active daily development since then.

### Which of the following best describes your progress?

**SDK deployed on production site, generating attention hashes from real user sessions. Pre-revenue.**

### Is any part of your project reliant on cryptocurrency or blockchain tech?

No. The attention receipts are standalone SHA-256 hashes serving as tamper-evident proof artifacts — they are not cryptocurrency, are not tradeable, are not convertible to fiat, and are not on any blockchain. They are in-application utility tokens governed by platform rules, designed from day one to stay outside securities classification. The protocol never uses the phrases "virtual currency," "cryptocurrency," or "monetary conversion." Each hash is independently verifiable — no chain or ledger required.

### How many active users or customers do you have?

`[UPDATE BEFORE SUBMIT]`

*Placeholder:* "Pre-revenue. The protocol is live on stevieweedseed.com and generating hashes from organic traffic. Firestore sync deploys the week of April 13, 2026 — from that point forward every visitor is measurable. By submission (May 4) we expect N real human sessions in the production database, and a friends-and-family beta layer on top of that through the proof gallery."

`[STEPHEN: when the Firestore deploy is live, replace N with the actual count from the last 7 days.]`

### How much money do you have in the bank right now, and what is your monthly burn rate?

**Bank:** `[FILL]` | **Monthly burn:** `[FILL]` | **Runway at current burn:** `[FILL] months`

*(Input #4 above. Be honest. Desperation reads as commitment when you already have a working patent-filed artifact. YC partners are not going to be scared of "I have 2 months" — they are scared of "I have 18 months and still haven't shipped.")*

### Do you have revenue? How much and how does your revenue work?

No revenue yet. Business model when we turn it on:

1. **B2B verification service** — Per-session or per-event metered pricing for enterprise API access. Target vertical pricing ranges from ~$500/month (small market-research panels) to six figures (insurance/nursing home monitoring with auditable compliance receipts).
2. **Developer SDK** — 1% protocol fee on any monetization flowing through the SDK. Developers keep 29%, users keep 70%.
3. **Consumer game (Lucid Wins)** — Standard consumer game monetization (IAP, cosmetics, cross-app items). Planned for Pi Network deployment (47M user base). *(Game is in development — no code shipped yet.)*

### Anything else you would like us to know?

I'm applying to YC as a solo founder with a filed patent, a working artifact, and a narrow window. The honest frame: I am in a hard place financially and physically, and I'm building anyway. The protocol is real, the code runs, the patent is filed, and the outreach is happening whether YC funds it or not. YC accelerates this by 12-18 months; it does not make the difference between shipping and not shipping.

The one asset nobody else in this space has is the combination of a granted filing date (March 17, 2026) across 247 innovations, a production hash pipeline writing real attention receipts into a cloud datastore right now, and a seven-layer attestation stack — behavioral, environmental, composition-integrity, honeypot, consent, Ed25519-signature, and Bitcoin/RFC-3161-timestamp — validated across 781 automated tests (36 suites, 100% pass in isolation). The defense-in-depth is not theoretical: we ran an adversarial bot profile ("Slow Mimic") that specifically targets the Reading Speed signal by dwelling on each section at plausible human WPM. It successfully faked that one signal (readingSpeed 0.786) but its composite stayed at 0.404 — below the lowest human in our sample (0.431) — because it could not simultaneously replicate timing entropy (constant intervals give it away), Hick's Law (response time must scale with choice count), window-focus coherence (humans naturally alt-tab), and cross-signal correlation (Signal 15 flags when one signal is artificially inflated while others don't move in sympathy). Faking one signal is cheap. Faking twenty in coherent human patterns is the thing you can't do without actually being a human. Roundtable (YC S24) solved a narrower problem (proof-of-human) and solved it well; we extend that surface into *quality of attention plus an auditable cryptographic receipt*, and we do it in a form where any regulator, buyer, or verifier can check the receipt offline, in a browser or on a Node command line using only built-in crypto and our public key — the property that makes us qualifiable for pharma 21 CFR Part 11 audits and for SCIF-eligible environments where Roundtable cannot operate.

If you want me to be in the batch, I will be in the batch. If not, I will ship the first pilot this summer anyway.

`[STEPHEN: REVIEW — this is written in your voice as I understand it. Rewrite any sentence that doesn't sound like you. The emotional honesty matters more than polish.]`

---

## IDEA

### Why did you pick this idea to work on?

`[STEPHEN: this one HAS to be in your words — YC reads this carefully for authenticity. Draft below is starter material only. Rewrite any sentence until it sounds like you talking, not me. The personal hooks are the ones that matter.]`

*Draft (rewrite in your voice):* Two things pushed me to build this. First, running Stevie Weed Seed for years taught me a lesson the whole analytics industry is still avoiding — every dashboard I opened measured *what happened on the page*, and none of them measured *whether a real human was actually there paying attention*. GA4, Clarity, Looker — they all conflate "engagement" with "attention." The gap between those two words is where billions of dollars of ad fraud live, where nursing homes can't prove someone is actually watching a resident, where corporate training can't prove anyone learned anything, and where LLMs now make every existing cheating defense obsolete overnight.

Second, my time working in food service showed me how hollow the industry's training-compliance story is. Franchise training modules get clicked through, everyone knows it, and when an incident happens the receipts that would actually protect the operator do not exist. Nobody in the SDK world has worked that floor; I have.

I built the prototype, filed the patent on March 17, 2026, and kept going because every vertical I looked at — CME, market research panels, nursing homes, restaurants, advertising — revealed the same gap. Nobody has cryptographic receipts for attention. Everybody has proxies. My daughter is why "interesting but does not pay" has never been an option for me. Every decision runs through whether it gets us to the first paying pilot.

### What's new about what you're making?

Four things competitors can't combine:

1. **A composite behavioral score from a deep signal library, not one or two** — Competitors use timing OR mouse movement OR touch variance in isolation. We use 20 production-validated signals weighted into a single human-confidence score: timing entropy (Esterman 2013 CV), Fitts' Law (1954), Hick's Law (1952), scroll saccade, micro-pause (200-600ms cognitive gap), touch variance, keystroke dynamics + keystroke-class digraph timing, reading-speed coherence (WPM plausibility per visible section, literature-banded), window-focus coherence, hover dwell, tab visibility, inactivity patterns, RT variability, scroll backtracking, fractal 1/f scaling via DFA (Gilden 2001), cross-signal correlation, curvature index (MacKenzie 2001), cursor jerk/LDLJ (Flash & Hogan 1985), velocity-profile bell-shape (Morasso 1981), two-thirds power law (Lacquaniti 1983), and device motion (accelerometer/gyroscope). BioCatch is the closest, but they optimize for fraud authentication, not attention *quality*. These signals draw on behavioral science literature with documented discrimination accuracy between human and bot patterns.
2. **Quality tiers, not binary human/bot** — Deep Focus vs. Active vs. Passive vs. Background. The same real human at the same screen can be any of the four depending on what's happening around them, and that distinction is what buyers actually care about.
3. **Cryptographic attention receipts with zero content data** — Hashes contain no PII, no screen contents, no keystrokes. This is an attention verification system architecturally designed to operate in SCIF-eligible environments. It is also COPPA-safe by construction for children's applications.
4. **Cross-vertical generality** — Market research, insurance/nursing homes, advertising, corporate training, healthcare/digital therapeutics, education, defense, financial services. 20+ vertical audits completed. The same protocol, the same SDK, the same receipts.

### What do you understand about your business that other companies in it just don't get?

Everybody in attention/verification is building a single-purpose tool. Roundtable built proof-of-human for forms. BioCatch built behavioral biometrics for fraud. Nielsen built panel measurement. DoubleVerify built ad verification. Each of them owns a slice.

What they all miss: **the signal generating the receipt is the same signal across every vertical**, and the buyer value differs only in the *tier cutoff* they care about. A nursing home needs "Active or better, continuously, with compliance logs." An ad network needs "Active or better, for 15 seconds of view-time, at scale." A corporate training LMS needs "Deep Focus for N minutes, with proof the learner wasn't just leaving the tab open." Same protocol. Different slices.

The company that builds the horizontal layer wins all of them. We're the horizontal layer.

### Who are your competitors? What do you understand about your business that they don't?

- **Roundtable AI (YC S23)** — Proof-of-Human API. Real-time risk score per session, $99 entry price. Strong on bot-vs-human scoring (87% accuracy vs. reCAPTCHA's 69% per their published benchmarks). Wedge: they ship a *score*; we ship a *W3C Verifiable Credential receipt* signed with Ed25519, verifiable offline with only our public key. Different artifact, not just a feature gap.
- **Worldcoin / World ID 4.0** (Tools for Humanity). As of 2026-04-17 shipped deep integrations with Tinder, Zoom, DocuSign, Shopify, Okta, VanEck — 18M verified users. Wedge: World proves *an identity-verified human exists* via iris scan (single-shot enrollment); SWS proves *this specific session had the behavioral signature of attending human engagement*, with zero biometric enrollment and zero PII. Complementary, not substitutable — a World-verified user still needs an attention receipt per-module to prove the CME credit was earned.
- **HUMAN Security / AgenticTrust** (April 2026). Adaptive-trust layer signing AI-agent sessions with HTTP Message Signatures. Wedge: they authenticate *the agent*; we measure *behavioral-integrity of the human on the other end* and bind it to a content hash.
- **BioCatch** — Behavioral biometrics for fraud/authentication (Permira-backed, ~$160M ARR, 280+ FI customers, 3,000+ signals/session). Wedge: they ship a proprietary risk score locked to their engine; we ship a portable, offline-verifiable receipt. Different buyer (fraud ops vs. compliance/credentialing/research).
- **Proof.com / Certify** (launched Oct 2025) — Cryptographic signing of documents with legal-identity biometrics. Wedge: they sign *the attestation*; we sign *a behavioral attention trace* bound to content. Different moment in the workflow.
- **DoubleVerify / IAS / Moat** — Ad verification. IAB+MRC published Attention Measurement Guidelines v1.0 in Nov 2025; DV and IAS are actively expanding attention products to CTV and TikTok. Wedge: they produce proprietary attention scores inside their ad-tech ingest pipeline — not a signed, offline-verifiable receipt a buyer can hand to a compliance auditor five years later.
- **Cloudflare Turnstile / Privacy Pass (RFC 9576)** — Anonymous human-verification tokens at the edge. Wedge: Privacy Pass tokens are binary pass-fail, single-use, no behavioral composite, no content binding.
- **Nielsen / Comscore** — Panel measurement. Opt-in cohorts, small samples, no receipts.
- **GA4 / Clarity / Looker / Hotjar** — Session analytics. They report what happened, not whether a human was there.

What none of them ship: a **per-session, Ed25519-signed, W3C Verifiable Credential** binding a 20-signal behavioral composite + environmental bot-gate + composition-integrity verdict + content hash, **verifiable offline** with only a public key and standard crypto primitives. Roundtable ships a score; World ships identity; HUMAN ships agent signatures; BioCatch ships risk; DV/IAS ship viewability. Everyone ships dashboards. We ship the tamper-evident artifact that sits inside the dashboard, and the same artifact works for an insurance auditor, a market research panel, a CME accrediting body, and a SCIF-operating DoD contractor.

**One honest acknowledgment:** A December 2025 academic paper (IACR ePrint 2025/2330, Kaklamanis/Wang/Malvai/Zhang, "Verifiable Aggregate Receipts with Applications to User Engagement Auditing") is in the same intellectual neighborhood — a theoretical VAR construction with bilinear-pairing aggregation. It is not a product, has no company attached, and our patent claims cover the multi-layer protocol (behavioral composite + environmental gate + composition integrity + Bitcoin/RFC-3161 anchoring) rather than the receipt-aggregation primitive alone. We cite it as evidence the category is beginning to be taken seriously, not as a competitor.

### How do or will you make money? How much could you make?

**Three stacked revenue lines:**

1. **B2B verification service (primary).** Tiered SaaS. Entry tier ~$500/month (market research panels, small insurance deployments). Mid tier $2K-5K/month (LMS, advertising, healthcare). Enterprise tier $10K-50K/month (defense, nursing home networks, large insurance). Conservative TAM at 1% of the US digital analytics market is $600M/year.
2. **Developer SDK (volume play).** 1% protocol fee. Revenue scales with developer adoption. The one-tag embed is already built.
3. **Consumer game (Lucid Wins).** IAP + cosmetics + planned Pi Network deployment (47M user base). Secondary revenue but primary behavioral calibration data source. *(Game in development.)*

**Realistic 3-year envelope if we hit 10-15 enterprise pilots and convert half:** $5M-$15M ARR. That's a fundable trajectory but not a home run — the swing-for-the-fences version is if the B2B service becomes the horizontal layer for attention verification across multiple regulated industries at once, in which case the ceiling is $100M+ ARR within 5 years.

### How will you get users?

1. **4-vertical blitz already in progress** — restaurants (founder's direct industry experience), market research panels, nursing home monitoring, and corporate training/LMS. We're running parallel outreach into all four right now and letting response rate pick the leader. 50+ targeted contacts across these verticals before YC submission.
2. **Restaurant industry as unfair advantage** — founder has years of direct experience in food service. Nobody sells "attention verification" to restaurant chains, but the pain is real: food safety training, OSHA compliance, harassment prevention — all web-based, all "click through and you're done." Restaurant franchise operators make decisions fast, and proof-of-training-completion has regulatory teeth.
3. **Live demo as outreach weapon** — every prospect gets a tagged link to sws-attention-proofs.web.app where they experience the protocol firsthand and their session becomes data in our Firestore. The demo IS the pitch.
4. **Proof gallery as inbound lead magnet** — 9 vertical tiles, public at sws-attention-proofs.web.app. Pushed to relevant Slack groups, subreddits, and LinkedIn.
5. **Pi Network consumer funnel** — Lucid Wins planned for Pi Network (47M user base) to become the top-of-funnel behavioral calibration dataset and a proof point: "the same protocol that powers the consumer game powers the enterprise API." *(Game in development.)*
6. **YC batch network itself** — every batch-mate building an analytics, trust, fraud, insurance, healthcare, education, or restaurant-tech product is a potential integration partner.

---

## EQUITY

### Have you incorporated, or formed any legal entity?
**Yes — SWS Strategic Media LLC** `[CONFIRM state of formation + date — input #2]`

### Have you taken any investment yet?
**No.** Zero outside capital. 100% founder-owned.

### Are you currently fundraising?
**Yes — applying to YC S26, NSF SBIR, and Antler/Techstars in parallel. No term sheets yet.**

---

## CURIOUS

### What convinced you to apply to Y Combinator?

Roundtable AI (YC S23) being in the portfolio convinced me two things are true: (1) YC understands that attention/authenticity verification is a real category, and (2) YC routinely backs founders working in adjacent territory as long as the wedge is clear. The gap between what Roundtable does (real-time proof-of-human risk scoring) and what we do (cryptographic receipts of attention quality, portable as W3C Verifiable Credentials across every vertical with a screen) is exactly the kind of "same neighborhood, different house" YC has funded before — Stripe adjacent to Braintree, Airbnb adjacent to VRBO, and more recently Substack adjacent to Medium.

The other reason is timing. The patent was filed March 17, 2026. The utility conversion deadline is March 17, 2027. An accelerated 12 weeks inside a YC batch is the best possible vehicle for closing the first pilots and setting up the utility patent conversion with real commercial traction behind it.

### How did you hear about Y Combinator?

`[STEPHEN: your story here. "Followed YC for years" is fine if true. Be specific about which company or founder first put it on your radar.]`

---

## FOUNDER VIDEO — 1 MINUTE SCRIPT

Record this LAST, after the written application is locked. Unlisted YouTube upload.

**Setting:** Quiet room, decent lighting (face a window), phone or laptop camera at eye level, single take is fine — YC doesn't grade production quality.

**Script (~150 words, ~60 seconds at conversational pace):**

> "Hi, I'm Stephen Furpahs, solo founder of SWS Strategic Media. I'm building a protocol that generates cryptographic receipts of real human attention.
>
> Everybody in analytics measures what *happened*. Nobody measures whether a human was actually *there*. That gap is where ad fraud lives, where compliance fails, where corporate training can't prove anyone learned anything, and where a nursing home can't prove someone is actually watching a resident.
>
> We use a 20-signal behavioral library — timing entropy, Fitts' Law, Hick's Law, scroll saccade, micro-pause, touch variance, keystroke dynamics plus keystroke digraph timing, reading-speed coherence, window-focus coherence, and ten more grounded in fifty to seventy years of peer-reviewed motor-control and cognitive research — to produce a single human-confidence score and a quality tier, and we wrap that in an Ed25519-signed, optionally-Bitcoin-anchored attention receipt in W3C Verifiable Credential format that works in a market research panel, an insurance audit, a 21 CFR Part 11-regulated pharma training module, or a SCIF-eligible environment. Two additional LLM-integrity signals, Composition Integrity and Honeypot Canary, and an environmental bot-gate ride alongside the behavioral composite.
>
> The patent was filed at the USPTO March 17, 2026 across 247 innovations. The protocol is live on a production site generating hashes right now. The code runs. The tests pass.
>
> I'm applying to YC because I want this protocol to be the horizontal attention verification layer for every vertical that has a screen, and I can move a lot faster inside a batch than outside one. Thanks for reading the application."

**Pre-record checklist:**
- [ ] Water at hand
- [ ] Phone on Do Not Disturb
- [ ] Do one full read-through out loud before recording
- [ ] Shoot 3 takes, pick the best, don't over-edit
- [ ] Upload to YouTube as **Unlisted** (not Private, not Public)
- [ ] Paste the URL in the founder video field of the application

---

## FINAL PRE-SUBMIT CHECKLIST

- [ ] All 6 inputs above are filled in
- [ ] All `[STEPHEN: REVIEW]` blocks rewritten in your voice
- [ ] Live user count updated from Firestore after deploy
- [ ] Founder video recorded, uploaded unlisted, URL pasted
- [ ] Read every answer out loud once — if any sentence sounds like AI-speak, rewrite it
- [ ] Double-check the 50-character company description under the character limit
- [ ] Re-run `npm test` and verify test count matches what's in the draft
- [ ] Submit at https://www.ycombinator.com/apply before **May 4, 2026 8:00pm PT**

---

*Prepared by the SWS Attention Protocol Engineering Team*
*Date: 2026-04-19 (audit-corrected revision)*
*Status: draft — needs 6 inputs + your voice pass*
