# YC S26 — Live Submission Answers

**For:** Stephen Furpahs, SWS Strategic Media LLC
**Submission deadline:** 2026-05-04, 8:00pm PT
**Purpose:** Final answers as Stephen pastes them into the YC form. Used by Stephen + Jessie for review and partner-interview quiz prep.

---

## COMPANY

### 50-character description
> Cryptographic receipts of real human attention.

(47 chars)

### Company URL
> https://sws-attention-proofs.web.app

### Demo video
> *TBD — recording during May 2-3.*

### Product link
> https://sws-attention-proofs.web.app/cme-demo.html

### Login credentials
> No login required — demo is open.

### What is your company going to make? Please describe your product and what it does or will do.

> SWS makes a cryptographic attention receipt — a tamper-evident artifact that proves a real human paid attention to a screen. Every receipt is a W3C Verifiable Credential, content-bound by SHA-256 and Ed25519-signed. Buyers verify offline in any browser; no SWS server involved.
>
> Each receipt carries a 23-signal behavioral composite drawn from decades of peer-reviewed motor-control research, a quality tier (Deep Focus / Active / Passive / Background), and a calibrated Bayesian P(human) score with a bootstrap confidence interval. No PII, no keystrokes, no screen contents leave the device.
>
> Buyers attach a receipt to any moment that used to be taken on faith: a CME credit, a survey response, an ad impression, a corporate-training completion, a nursing-home resident's afternoon viewing. Same protocol across every vertical — buyers differ only in the quality tier and duration they require.
>
> Today: B2B verification API (CME-led), one-tag developer SDK, consumer game in development.

### Where do you live now, and where would the company be based after YC?

> Currently based in Uniontown, OH. I'll relocate to the Bay Area for the duration of the YC batch — fully committed to being on-site. Long-term HQ is open: I'm willing and intending to travel for fundraising, design partner work, and pilot deployments, with the company likely operating distributed-first post-batch.

---

## PROGRESS

### How far along are you?

> **Built and live.** The product is in production today — anyone can visit the live CME demo at sws-attention-proofs.web.app/cme-demo.html, complete a session, and walk away with a cryptographically-signed receipt they can verify in their own browser.
>
> **Patent filed.** USPTO provisional **2026-03-17**, covering 247 innovations across 24 categories.
>
> **What the receipt does.** It binds a content hash, twenty-three behavioral signals, a quality tier (Deep Focus / Active / Passive / Background), and a Bayesian probability that a real human paid attention — into a single tamper-evident artifact, signed with Ed25519, verifiable offline. No PII, keystrokes, or screen contents leave the device.
>
> **Tested.** 270+ tests across 45 suites, regression-verified on every commit. Seven rounds of hostile-agent review (security, statistics, business, code, competitive, legal, infrastructure, UX, crypto deep-audit, adversarial bot designer) closed ~85 findings before any customer conversation.
>
> **Next.** No revenue yet. First CME outreach launches during the YC batch — goal: 2 design partners by Demo Day.

### How long have each of you been working on this? How much of that has been full time?

> Patent drafting began early 2026; provisional filed at the USPTO 2026-03-17; first SDK commit 2026-03-27 — about four months of focused work, daily development since.
>
> Full-time: yes. I made the decision to stop working for other people and focus on building something for my family. I'm a stay-at-home parent; the rest of my time goes to the company, typically 16+ hours a day. Building this is how I provide long-term, so the commitment is total.

### Tech stack (including AI models / AI coding tools)

> **Frontend / SDK:** Vanilla JavaScript (no framework), WebCrypto API for in-browser receipt verification, `@fingerprintjs/botd` for environmental-gate baseline. The receipt-verifier runs in any modern browser with no build step.
>
> **Backend:** Node.js 20 on Firebase Cloud Functions. Firestore for session state. Firebase Hosting for the proof gallery (sws-attention-proofs.web.app).
>
> **Cryptography:** Ed25519 (native Node.js crypto), SHA-256, W3C Verifiable Credentials data model, RFC 3161 timestamp authority (`@peculiar/asn1-tsp`), OpenTimestamps Bitcoin anchoring (`javascript-opentimestamps`), `merkletreejs` for Merkle inclusion proofs.
>
> **Testing:** Jest, plus Puppeteer + `puppeteer-extra-stealth` for the adversarial-bot harness.
>
> **AI coding tools:** Claude Code (Anthropic) is my primary engineering agent. I architect, spec, and review; the agent produces implementations against those specs; every commit is code I have read, tested, and approved. Claude Code is the only AI tool in my engineering loop — no copilots, no autonomous agents.
>
> **AI models in the product itself: None.** The protocol is deterministic — behavioral statistics, cryptographic primitives, a Bayesian classifier with bootstrap uncertainty bounds. No LLM calls in the receipt path. The product is mathematics and cryptography, not an AI wrapper.

### Coding agent session attachment

> *Skipped.* Session export not feasible before deadline; protecting role-conditioning prompting methods as part of creative direction.

### Are people using your product? Do you have revenue?

> No. The product is live and producing real receipts on the demo, but no paying users yet. First CME-pilot outreach launches during the batch.

### When will you have a version people can use?

> Available now. The live demo at sws-attention-proofs.web.app/cme-demo.html runs end-to-end and produces signed, verifiable receipts. The "no" above reflects no paying customers yet — first design-partner pilots target the YC batch.

---

## IDEA

### Why did you pick this idea? Domain expertise? How do you know people need it?

> I built the prototype by accident.
>
> I was making math games and puzzles for my daughter. The idea was that she could earn beautiful art and haikus by doing the work — drawing, making music, solving puzzles, learning new ways to think and problem-solve, or just doing speed math. Her cards would be made by her own effort. I wanted her to learn vocabulary the way I did, growing up reading Magic: The Gathering cards.
>
> I added a system to grade the level of her engagement so I could see how hard she was actually working without hovering over her. She'd feel unbothered while working; I'd have a sense of her level. The point was to reward harder work — playing chess on harder difficulties, sticking with a puzzle longer — with more beautiful, more embellished art.
>
> After a few weeks I decided to release the game. Then I realized I didn't like the engagement-grading system. It wasn't fair to new players, to children trying to learn, or to anyone struggling to keep up but trying. People doing their best deserved the same beauty as everyone else. I went to remove the entire engine.
>
> Claude told me not to. It flagged what I'd built as proprietary technology that should be developed and patented — anti-AI, healthcare, transport, shipping, military, anywhere a real human's attention needs to be provable. I laughed. I had never thought of it that way.
>
> That's when I stopped sleeping. I have spent the last few months turning the engine I almost deleted into the protocol it is now. I would be grateful for help and partnership to take it to the next stage.

### Competitors and what you understand

> **Direct (similar work, different artifact or buyer):**
>
> - **Roundtable AI (YC S23)** — real-time risk score, $99/mo entry. They ship a score; we ship an offline-verifiable W3C Verifiable Credential. Their own research page admits no false-positive testing against humans, no active adversarial optimization. That gap is our wedge.
> - **BioCatch** (~$160M ARR, Permira-backed) — proprietary score for bank fraud ops. Not portable, not offline-verifiable. Wrong buyer for compliance/credentialing.
> - **DoubleVerify / IAS / Moat** — ad-tech ingest pipelines. Real-time score, not a replayable artifact a compliance auditor can verify five years later.
>
> **Adjacent identity / personhood:**
>
> - **World ID** — 18M users, iris-scan identity. Proves a human exists; we prove this specific session had attention. Complementary — a World-verified user still needs a per-module receipt.
> - **HUMAN Security AgenticTrust** — authenticates the AI agent. We measure the human on the other end and bind to a content hash.
> - **Humanity Protocol** — pivoted Feb 2026 to "Proof of Trust" via palm biometrics. Personhood, not session attention.
>
> **Watch (real long-term threat):**
>
> - **Cloudflare WebBotAuth + ARC/ACT** — sits in the request path for ~20% of the web, driving the IETF WebBotAuth working group with an April 2026 IESG deadline. Their stated 2026 architecture is engineered for *unlinkability* (anonymous, rate-limited tokens) — explicitly incompatible with the attribution that compliance buyers (pharma audits, ACCME, FDA, FINRA) require. Their philosophical commitment is structurally on our side, not against us. Worth watching anyway.
> - **C2PA / Content Credentials** — content provenance. Have not extended into reader/attention proof; that gap is open.
>
> **Honest acknowledgment:** IACR ePrint 2025/2330 (Kaklamanis et al., Dec 2025) describes a theoretical Verifiable Aggregate Receipts construction. Academic paper, no product. Cited as evidence the category is being taken seriously.
>
> **Where I bet, and why I think the bet holds.**
>
> The agentic-web problem — proving who is human and what they actually paid attention to — is being worked on by people far smarter and better resourced than me: Cloudflare in standards, Worldcoin and Humanity Protocol on identity, BioCatch and Roundtable on behavioral signals, FIDO on agentic authentication. I haven't out-thought any of them. What I did was build and file on this specific method first.
>
> The bet: regulated buyers need *attribution* — replayable proof tied to a specific identity and session — and most of the field is converging on *unlinkability* (privacy-preserving anonymous tokens). Those are structurally different products. The horizontal protocol that handles attribution + quality tiers + offline verification + content binding is what my provisional patent (USPTO 2026-03-17, 247 innovations across 24 categories, utility conversion by 2027-03-17) covers. The regulated-attribution lane is open, and the provisional locks the priority date there.
>
> That's not "I see something they don't." It's "I picked the right corner of a crowded field early enough to file."

### How do or will you make money? How much could you make?

> **Pricing.** B2B verification API, metered subscription:
>
> | Tier | Price | Buyers |
> |---|---|---|
> | Entry | ~$500/mo | Small market-research, small insurance |
> | Mid | $2-5K/mo | LMS providers, mid-market ad-tech, healthcare compliance |
> | Enterprise | $10-50K/mo | Pharma CME, defense / SCIF, nursing-home networks, financial-advisor compliance |
>
> Plus a 1% protocol fee on the one-tag developer SDK and IAP / revenue share from the consumer game (Lucid Wins, in development).
>
> **Revenue ladder (realistic, post-YC):**
>
> - **Months 0-6:** 2-3 design partners at $0-25K (free pilots with case-study rights are standard in pharma/CME compliance). Goal: 2 design partners by Demo Day.
> - **Months 6-12:** 4-8 paying customers at $30-60K ACV. ARR $150-500K.
> - **Months 18-24:** First $1M ARR likely via 3-5 anchor enterprise pilots at $150-300K plus mid-market base. Pharma procurement cycles 6-9 months mean revenue lags pipeline.
>
> **3-year envelope:**
>
> - **Base case:** $1-5M ARR by year 3 — 8-20 customers, single vertical anchor (CME), mid-market expansion.
> - **Upside:** $10M+ ARR by year 3 if multiple verticals adopt or one anchor pharma-CME deal lands at top of range.
>
> **5-year horizontal-protocol ceiling:** $30-100M ARR if the receipt layer wins across CME, proctoring, ad-verification compliance, and corporate training. That's the trajectory of comparables (Persona, Alloy, Plaid) — 5-7 year arcs.
>
> **TAM derivation (US, addressable slice):**
>
> | Vertical | Addressable slice | Source |
> |---|---|---|
> | CME compliance | $50-200M | ACCME 2022, Veeva Vault benchmarks |
> | Online proctoring (AI-cheating crisis) | $100-300M | Pearson VUE / Prometric / ProctorU |
> | Behavioral biometrics (compliance slice) | $100-500M | BioCatch ($160M ARR) ex-banking |
> | Ad-verification compliance add-on | $50-200M | DV / IAS revenue × compliance slice |
> | Corporate compliance training | $100-300M | FINRA / SOX seat licensing |
>
> **Total addressable across SWS verticals (SAM): $500M-1.5B/yr in the US.** Capturing 5-15% over 5-7 years = $30-100M ARR.

### Category

> B2B SaaS (primary). Security as secondary if available.

### Other ideas you considered

> *Status: draft below — Stephen wants to revisit and possibly expand. He has Lucid Wins plus two other games, multiple apps, guitar tech, and other ideas in mind. Discipline kept the AP as primary because it's the highest-paying-upfront and most YC-relevant.*

> Three adjacent ideas I considered separately. Each touches the same core problem from a different surface.
>
> **1. Lucid Wins, consumer game on Pi Network.** Puzzle, math, and chess gameplay where engagement-earned hashes deterministically generate one-of-one procedural art (~280 trait slots) and strict-syllable haiku for each player. Pi Network's ~50M user base provides built-in distribution. This is the consumer surface of the same protocol the B2B side sells to compliance buyers. Already in development.
>
> **2. Engagement proof for kids' learning.** The original prototype, repositioned. Parents see how engaged their child actually was during math, drawing, or puzzle work, without hovering over them. Cryptographic receipts for completed homework, reading sessions, or at-home practice. Schools could use it as anti-cheating for assigned digital work. Same engine, different buyer.
>
> **3. Provenance for human-created digital work.** Adjacent to C2PA (which covers content authenticity at capture time) but for the creation process itself. The same hash-deterministic architecture that powers Lucid Wins's procedural art could prove this digital painting, song, or written piece was made by a human with verifiable effort, hour by hour. Increasingly relevant as AI-generated content saturates marketplaces.
>
> The first is in development today. The second I shelved because the regulated-buyer pitch (CME, pharma, FINRA) was sharper and faster to revenue. The third is a longer-tail bet that becomes more valuable as Cloudflare's unlinkability stack closes off attribution everywhere else online.

---

## REMAINING FIELDS (TBD as Stephen reaches them)

- [ ] Equity / fundraising / cap table
- [ ] Why YC
- [ ] How heard about YC
- [ ] Anything else
- [ ] Founder video URL (recorded during May 2-3)
- [ ] Coding agent session attachment (skipped unless export becomes feasible)

---

## QUIZ PREP — questions a YC partner (or Jessie) is likely to ask

### On the product
1. "Show me a receipt." → live demo + verify.html walkthrough
2. "Why isn't this just a fancier captcha?" → captcha is binary pass/fail; receipt is a content-bound, signed credential auditors can replay
3. "What stops a sophisticated bot?" → multi-layer defense (env-gate + behavioral + composition + content-bound + signed); single-layer wouldn't hold against Bezier-class bots and we said so honestly

### On commercial
1. "Why $500/mo entry when Roundtable is $99?" → different artifact (receipt vs score); compliance buyer pays for the audit-grade artifact, not the binary signal
2. "Pharma procurement is 6-9 months. How do you survive that long pre-revenue?" → YC funding is the bridge; CME LMS resellers (Medbridge, AMA Ed Hub) shorten the cycle; mid-market ad-tech and proctoring are faster sales
3. "What's your CAC?" → unknown until first cold-email outreach lands during the batch
4. "What if Cloudflare pivots tomorrow?" → patent priority + their stated unlinkability commitment is structural; if they break it they collide with EU privacy regulators

### On founder / team
1. "Why solo?" → patent and protocol work demanded one unified voice through filing; open to cofounder for distributed-systems / cryptography or enterprise B2B sales depth
2. "Why does a stay-at-home parent in Uniontown OH have the right to build pharma compliance infrastructure?" → I built the prototype by accident, found the patentable invention, filed it; no claim that I'm the smartest person in the field — I picked the right corner early and locked priority
3. "How do you scale beyond yourself?" → YC capital funds 2-3 hires (engineering + sales + ops); the protocol is documented, tested, and architecturally separable

### On the patent
1. "It's only a provisional, not granted." → industry-standard for pre-seed; locks priority date 2026-03-17; utility conversion by 2027-03-17; YC funding covers attorney fees easily
2. "How can a provisional cover 247 innovations?" → 29-page filing across 24 categories of behavioral, environmental, composition, cryptographic, and verification primitives; partner can review under NDA

### On the math
1. "Calibration set is n_h=5, n_b=28. That's tiny." → correct; small-N caveat is on every receipt today; calibration grows as real-tester runs accumulate; bootstrap CI is honest about coverage at small N
2. "Bezier-bots fool single signals — doesn't that defeat you?" → honest disclosure in application; per-signal threshold tightening was tried twice and reverted; structural defense is the layered stack
3. "How do you know the 23 signals aren't redundant?" → 21 weighted, 2 diagnostic; signals are independent in the cognitive-science literature (Fitts, Hick, prewhitened DFA-1, etc.); calibration metadata reports per-signal contribution

### On hostile-review claims
1. "$5-20K/mo + 200-400h adversary cost — is that measured or estimated?" → adversarial bot-designer simulation, not a bug bounty; honest as an estimate, not a real-world test
2. "100/100 tamper attacks detected — what test?" → `scripts/test-tampering-attack.js`; 100 random DOM-level modifications of a legitimate receipt; every one detected by the verifier

---

*Document maintained alongside Stephen's live YC submission. Updated as each answer is finalized.*
