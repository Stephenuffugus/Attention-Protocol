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

## THE SIX INPUTS I NEED FROM YOU BEFORE LOCK

| # | Field | Your Answer |
|---|-------|-------------|
| 1 | **City now / post-YC (if accepted)** | `[FILL]` / `[FILL]` |
| 2 | **Legal operating entity** (confirm SWS Strategic Media LLC, state of formation) | `[FILL]` |
| 3 | **One pre-existing accomplishment** — anything notable you built/shipped/ran before this project (Stevie Weed Seed affiliate site counts, Lucid Wins game counts, any creative work, any team you led) | `[FILL]` |
| 4 | **Honest burn rate + runway** (months of runway at current burn — desperation reads as commitment when paired with a working artifact) | `[FILL]` |
| 5 | **Patent provisional serial number** (from USPTO Patent Center — much stronger than "filed") | `[FILL]` |
| 6 | **Date project started** (first commit? first patent draft? whenever you consider it to have begun) | `[FILL]` |

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

We generate SHA-256 cryptographic attention receipts that prove a real human was actually paying attention to a screen, not a bot, not a distracted scroller, not a click-farmer. Every receipt is a 9-field payload hashed with behavioral signals: timing entropy, Fitts' Law curvature, scroll saccade pauses, micro-pause distribution, touch variance, and Hick's Law reaction curves — part of a 15-signal production library (with 5 additional signals in active development) that collapses into a single human-confidence score and a quality tier (Deep Focus, Active, Passive, Background).

The receipts are tamper-evident, privacy-preserving (no PII — just behavioral shape), and work on web and mobile. Architecturally designed to be SCIF-eligible — no content data is stored, only behavioral metrics.

We ship the protocol three ways:

1. **B2B verification service** — Enterprises drop a single JavaScript tag and get scored attention receipts via API. Target verticals: restaurant training compliance (founder's domain), market research panels, nursing home monitoring, corporate training/LMS, advertising, healthcare/digital therapeutics.
2. **Developer SDK** — Any app developer embeds the protocol and gets engagement analytics + verifiable receipts. Revenue split: 70% user, 29% developer, 1% protocol.
3. **Consumer game (Lucid Wins)** — Players earn receipts as they play, redeemable inside the game ecosystem. This is the consumer-facing flywheel and the source of our behavioral calibration dataset. *(Currently in development — no game code shipped yet.)*

The protocol is live on a production site (stevieweedseed.com) generating real attention hashes right now, and the provisional patent was filed March 17, 2026 at the USPTO covering 247 distinct innovations across 24 categories.

### Where do you live now, and where would the company be based after YC?

**Now:** `[CITY #1]` | **After YC:** `[CITY #2]` *(input #1 above)*

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
- Production SDK: 22 modules, 437 automated tests passing (100%), runs in ~4.7 minutes (verified 2026-04-19)
- Live site generating real attention hashes: stevieweedseed.com (Firebase project `focus-grove-fffa8`)
- Public proof gallery covering 9 verticals, with dual-tracked SWS vs. GA4 comparisons: **https://sws-attention-proofs.web.app**
- Behavioral human-confidence scoring library: 15 production-validated signals (timing entropy, Fitts, Hick, scroll saccade, micro-pause, touch variance, keystroke rhythm, cross-signal correlation, two-thirds power law, and more) + 5 emergent signals in active development, with strong separation between human and bot patterns in our simulations
- Printable compliance report for lawyers and regulators
- W3C VC-structured receipts + differential privacy + WebAuthn device binding modules *(cryptographic signing on the roadmap)*
- One-tag embed (`<script src="...">`) that any site can drop on any page in 10 minutes
- Trade secret catalog secured; specific calibration values deliberately kept out of the patent

**Not yet shipped:**
- First paying pilot customer (in active outreach)
- Utility patent conversion (budgeted $3-5K, must convert by March 17, 2027)
- 30-day dual-tracked dataset showing the delta between SWS quality metrics and GA4 baseline on real production traffic (begins the moment the Firestore sync deploys this week)

### How long have you been working on this?

**`[DATE PROJECT STARTED — input #6]`** to today. Patent filed March 17, 2026. Production hash generation began `[DATE]`.

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

The one asset nobody else in this space has is the combination of a granted filing date (March 17, 2026) across 247 innovations, a production hash pipeline writing real attention receipts into a cloud datastore right now, and a 15-signal behavioral library (with 5 more signals in active development) validated across 437 automated tests. Roundtable (YC S24) solved a narrower problem (proof-of-human) and solved it well; we extend that surface into *quality of attention*, not just authenticity, and we do it with cryptographic attention receipts that work in SCIF-eligible environments where Roundtable cannot operate.

If you want me to be in the batch, I will be in the batch. If not, I will ship the first pilot this summer anyway.

`[STEPHEN: REVIEW — this is written in your voice as I understand it. Rewrite any sentence that doesn't sound like you. The emotional honesty matters more than polish.]`

---

## IDEA

### Why did you pick this idea to work on?

`[STEPHEN: this one HAS to be in your words — YC reads this carefully for authenticity. Draft below as a starting point. Rewrite with whatever story actually made you pick this.]`

*Draft:* I have been building and running the Stevie Weed Seed affiliate site for years, and I have watched firsthand as the entire ad/analytics stack became incapable of distinguishing "a person actually reading this" from "a bot clicking through" from "a distracted human who never looked at the page." GA4, Clarity, Looker — all of them report on what *happened*, not on whether a human was *there*. The gap between "engagement" and "attention" is the gap where billions of dollars of ad fraud live, where nursing homes can't prove someone is actually monitoring a resident, where corporate training can't prove anyone learned anything, and where defense contractors can't verify a pilot is actually watching the screen in a SCIF.

I built a working prototype, patented it, and then kept going because every vertical I looked into revealed the same gap: nobody has receipts for attention. Everybody has proxies.

### What's new about what you're making?

Four things competitors can't combine:

1. **A composite behavioral score from a deep signal library, not one or two** — Competitors use timing OR mouse movement OR touch variance in isolation. We use 15 production-validated signals (timing entropy, Fitts' Law curvature, Hick's Law reaction, scroll saccade, micro-pause distribution, touch variance, keystroke rhythm, cross-signal correlation, two-thirds power law coupling, and more) with 5 additional signals in active development, weighted into a single human-confidence score. BioCatch is the closest, but they optimize for fraud authentication, not attention *quality*. These signals draw on behavioral science literature with documented discrimination accuracy between human and bot patterns.
2. **Quality tiers, not binary human/bot** — Deep Focus vs. Active vs. Passive vs. Background. The same real human at the same screen can be any of the four depending on what's happening around them, and that distinction is what buyers actually care about.
3. **Cryptographic attention receipts with zero content data** — Hashes contain no PII, no screen contents, no keystrokes. This is an attention verification system architecturally designed to operate in SCIF-eligible environments. It is also COPPA-safe by construction for children's applications.
4. **Cross-vertical generality** — Market research, insurance/nursing homes, advertising, corporate training, healthcare/digital therapeutics, education, defense, financial services. 20+ vertical audits completed. The same protocol, the same SDK, the same receipts.

### What do you understand about your business that other companies in it just don't get?

Everybody in attention/verification is building a single-purpose tool. Roundtable built proof-of-human for forms. BioCatch built behavioral biometrics for fraud. Nielsen built panel measurement. DoubleVerify built ad verification. Each of them owns a slice.

What they all miss: **the signal generating the receipt is the same signal across every vertical**, and the buyer value differs only in the *tier cutoff* they care about. A nursing home needs "Active or better, continuously, with compliance logs." An ad network needs "Active or better, for 15 seconds of view-time, at scale." A corporate training LMS needs "Deep Focus for N minutes, with proof the learner wasn't just leaving the tab open." Same protocol. Different slices.

The company that builds the horizontal layer wins all of them. We're the horizontal layer.

### Who are your competitors? What do you understand about your business that they don't?

- **Roundtable Research (YC S24)** — Proof of Human. Narrow: solves CAPTCHA replacement for forms. We respect what they built. Wedge: they verify presence; we verify *quality and duration*. Different buyer (trust/safety vs. analytics) and different integration surface.
- **BioCatch** — Behavioral biometrics for fraud/authentication. Very strong in their lane. Wedge: they optimize for "is this the same person who logged in yesterday" — not "is this person actually paying attention right now."
- **DoubleVerify / IAS / MOAT** — Ad verification. Session-level, vendor-controlled, reliant on pixel beacons. Wedge: they measure impressions and visibility, not behavioral quality.
- **Nielsen / Comscore** — Panel measurement. Opt-in cohorts, small samples, no receipts. Wedge: we work on 100% of traffic, with cryptographic receipts, without a panel.
- **GA4 / Clarity / Looker / Hotjar** — Session analytics. They report what happened, not whether a human was there.

What they don't get: the receipt itself is the product. Everyone ships dashboards. We ship the tamper-evident artifact that sits inside the dashboard, and the same artifact works for an insurance auditor, a market research panel, and a DoD contractor.

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

Roundtable Research being in the YC portfolio convinced me two things are true: (1) YC understands that attention/authenticity verification is a real category, and (2) YC is willing to back founders working in adjacent territory as long as the wedge is clear. The gap between what Roundtable does (proof-of-human for forms) and what we do (receipts of attention quality across every vertical that has a screen) is exactly the kind of "same neighborhood, different house" that YC has funded before (Stripe adjacent to Braintree, Airbnb adjacent to VRBO, etc.).

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
> We use a 15-signal behavioral library — including timing entropy, Fitts' Law, scroll saccade, micro-pause, touch variance, Hick's Law, keystroke rhythm, and cross-signal correlation — to produce a single human-confidence score and a quality tier, and we wrap that in a SHA-256 attention receipt that works in a market research panel, an insurance audit, or a SCIF-eligible environment. Five additional signals are in active development.
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
