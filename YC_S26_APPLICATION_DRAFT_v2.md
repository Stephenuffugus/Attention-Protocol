# YC S26 APPLICATION — TIGHT DRAFT v2

**For:** Stephen Furpahs, SWS Strategic Media LLC
**Deadline:** 2026-05-04, 8pm PT
**Status:** Substance ready. Needs 6 Stephen-only inputs + your voice pass on 4 sections.

---

## How to use this doc

1. Skim once top to bottom. Aim for <5 min.
2. Fill the 6 brackets at the top. Those are pure data lookup.
3. Read the 4 `[REWRITE]` sections aloud. Rewrite anything that sounds like AI, not you.
4. Record the 1-min founder video LAST.
5. Submit at https://www.ycombinator.com/apply.

---

## THE 6 STEPHEN-ONLY INPUTS

| # | Field | Value |
|---|-------|-------|
| 1 | LLC state of formation | `[FILL — likely Ohio per Uniontown registration; check formation cert]` |
| 2 | Bank / monthly burn / runway | `Bank: $___ · Burn: $___/mo · Runway: ___ months` |
| 3 | Patent provisional serial | `[FILL — patentcenter.uspto.gov, 2026-03-17 filing, 63/XXX,XXX]` |
| 4 | Project-start date framing | Suggested: `Patent drafting early 2026 → provisional filed 2026-03-17 → first SDK commit 2026-03-27`. Override if you consider it earlier. |
| 5 | One pre-existing accomplishment | Draft below — **rewrite in your voice.** |
| 6 | Founder video URL | Recorded last. Upload as **Unlisted** YouTube. Script at the bottom. |

---

## COMPANY

**Name:** SWS Strategic Media LLC
**50-char description:** *Cryptographic receipts of real human attention.* (47 chars)
**Reviewer URL:** https://sws-attention-proofs.web.app/for-reviewers.html
**Demo:** https://sws-attention-proofs.web.app
**Live site producing real receipts:** https://stevieweedseed.com (Firebase `focus-grove-fffa8`)

### What we make

A cryptographic attention receipt — content-bound SHA-256, Ed25519-signed, optionally Bitcoin-anchored — that proves a real human paid attention to a screen. Not a bot, not an LLM, not a distracted scroller. Every receipt is a W3C Verifiable Credential carrying a 23-signal behavioral composite, a quality tier (Deep Focus / Active / Passive / Background), and a calibrated Bayesian P(human) score with a bootstrap confidence interval.

Buyers verify offline in any browser with WebCrypto. No SWS server involved. That property is what qualifies the receipt for pharma 21 CFR Part 11 audits and SCIF-eligible environments.

**Three product surfaces:** B2B verification API (primary, CME-led), one-tag developer SDK (1% protocol fee), consumer game (Lucid Wins, Pi Network deployment, in development). The protocol is the same across all three.

### Where based
Now: Uniontown, OH. Post-YC: Mountain View / SF as the batch requires.

---

## FOUNDER

**Solo founder.** I direct the technical work — architect, spec, review — and use AI-assisted engineering agents (primarily Claude Code) to produce implementations against my specifications. Every commit is code I have read, tested, and approved. No contractors. No co-authors. No equity outside me.

`[REWRITE — say this in your voice. If you wrote any line yourself, mention it.]`

**Open to a cofounder?** Yes for the right match — distributed-systems / cryptography depth, or enterprise B2B sales experience. Solo today because the patent and protocol work demanded one unified voice through filing.

---

## PROGRESS

### Where we are

**The wall is live in production.** Three Cloud Functions on `sws-attention-proofs` serve signed receipts (`signReceipt`), the JWKS endpoint (`publicKey`), and server-side composite recompute (`onSessionWritten`). Firestore rules + indexes + TTL deployed. Real signed receipts coming back from cme-demo.html as of this week.

**The protocol:**

- **Provisional patent** filed at USPTO **2026-03-17** (serial `[INPUT #3]`), 29 pages, 247 innovations across 24 categories. Utility conversion deadline 2027-03-17.
- **23-signal behavioral composite** (21 weighted, 2 diagnostic). Each signal grounded in 50-70 years of peer-reviewed motor-control and cognitive science: timing entropy (Esterman 2013), Fitts (1954), Hick (1952), prewhitened DFA-1 1/f scaling (Torre-Delignières — pre-empts the Wagenmakers 2004 SRD critique), submovement count v2 (Crossman & Goodeve / Meyer 1988), curvature (MacKenzie 2001), cursor jerk (Flash & Hogan 1985), two-thirds power law (Lacquaniti 1983), and 15 more.
- **7-vector environmental gate** catching puppeteer-extra-stealth-class adversaries: BotD + WebGL renderer + WebGPU adapter + Function.toString consistency + iframe-frontier + chrome.runtime + AudioContext prototype-shape. Cross-browser graceful-degradation prevents Firefox/Safari false positives.
- **Composition Integrity** layer (paste-burst + LLM honeypot canary).
- **Content-bound SHA-256 receipt** — every displayed value is in a deeply key-sorted canonical JSON whose hash IS the receipt. Adversarial test runs **100/100 random tamper variations detected**, 27/27 pathological canonical-input cases (Unicode, RTL, CJK, deeply-nested objects, NaN/Infinity) produce deterministic valid hashes.
- **Ed25519 issuer attestation** with public JWKS at `/.well-known/attention-pubkey.json`. Multi-key rotation path validated via dry-run.
- **Calibrated Bayesian P(human)** score with a bootstrap confidence interval on every receipt. Class-conditional Gaussian likelihood ratio with flat prior; Efron-Tibshirani 1993 bootstrap. Calibration set v2: 5 humans + 28 bots, growing — every receipt carries an explicit small-N caveat until both classes reach n≥20. Almost no behavioral-biometrics vendor publishes uncertainty at all.

### Validation

- **45 test suites, 270+ tests**, regression-verified after every commit. Targeted post-deploy run 2026-04-29: 152/152 across signals + bot-harness + e2e + wall empirical.
- **1000-session synthetic human distribution: 0 false positives.** Mean divergence delta 0.050 against the 0.30 threshold = 6× margin.
- **5/5 documented adversarial bot attack vectors caught** with 5-7× margin: paste-bot, mechanical typist, motion-only, too-fast burst, truncated log.
- **Server-side recompute latency 1.6ms** on max-size event logs. Cloud Function 60s timeout = 38,000× headroom.
- **Bot-vs-human discrimination, the honest version.** Standard Puppeteer bots score 0.06–0.10 behavioral gap. A deliberately sophisticated paste-bot (DMTG-class, Tsinghua arXiv:2410.18233) overlaps the human distribution behaviorally — by design, a bot coded to pace like a slow reader IS behaving like a slow reader. **What catches every bot is the multi-layer defense: gated composite gap 0.243–0.262** across all tested bot profiles. We only publish the gated number.

### What we shipped this week (2026-04-29)

The founder ran cme-demo.html on himself reading carefully and got MARGINAL — composite 0.647, three thousandths below the 0.65 CREDIT threshold. Diagnosis: **three calibration bugs penalized engaged slow careful readers.**

1. **Curvature dead zone.** `_ascore(1 - |avgCI - 1.3| × 1.5, 0.7)` collapsed to exactly 0 across `avgCI` in [1.97, 2.5] — the cursor patterns of a focused reader whose mouse wandered around the text.
2. **RT Variability dead zone.** Same pattern. Slow careful readers produce variable click intervals (cv > 0.5); the formula scored them ≤ 0.27.
3. **Inactivity Pattern peak too narrow.** Calibrated for active-mouse use cases (peak at 15% gap ratio); content-heavy reading naturally produces 25-45% gap time.

All three fixed in the same day. 19 regression tests pin the new formula profiles. **Bot-vs-human discrimination unchanged** — only humans benefit, not bots. Both commits deployed to production.

The MARGINAL receipt is the YC exhibit. The system flagged the founder's session correctly, P(human) = 0.861 [0.795–0.923] cleanly classified him as human, and the CME composite refused credit because the session was mixed. **Then we found three real bugs and fixed them the same day.** That's the failure mode and the response loop.

### Open

- **First paying pilot.** Deliberate hold — discipline is "100% confidence in product before pitching pilots." Outreach in `OUTREACH_PLAY.md`, top-10 prospects ranked, first email drafted (PPP / J Clinical Psychiatry CME).
- **Utility patent conversion** ($3-5K, by 2027-03-17).
- **30-day production dataset.** Firestore sync deployed; data accumulating from 2026-04-26.
- **ZK proof-of-attention layer.** Research complete, ~6 weeks engineering, post-YC priority.

### How long working on this
Patent drafting began early 2026, provisional filed **2026-03-17**, first SDK commit **2026-03-27**, daily development since.

### Revenue / users
**Pre-revenue.** Live site generates hashes from organic traffic; Firestore sync deployed 2026-04-26. By 2026-05-04 we'll have N real human sessions in the production database. `[INPUT — replace N with last-7-days count from Firestore before submit]`

### Crypto/blockchain
**No.** Receipts are SHA-256 hashes serving as tamper-evident artifacts. Not tradeable. Not on any chain. OpenTimestamps Bitcoin anchoring is *optional* and produces a timestamp commitment, not a token.

---

## IDEA

### Why this idea

`[REWRITE in your voice — YC reads this for authenticity. The personal hooks matter. Starter material below; rewrite each sentence until it sounds like you talking, not me.]`

Two things pushed me to build this. Running Stevie Weed Seed for years showed me every analytics dashboard measures *what happened on the page* — not whether a human was actually paying attention. GA4, Clarity, Looker all conflate engagement with attention. That gap is where ad fraud lives, where nursing homes can't prove a resident watched something, where corporate training can't prove anyone learned, and where LLMs make every existing cheating defense obsolete overnight.

Working in food service showed me how hollow the training-compliance story actually is. Modules get clicked through, everyone knows it, and when an incident happens the receipts that would protect the operator do not exist.

I built the prototype, filed the patent 2026-03-17, and kept going because every vertical I looked at — CME, market research, nursing homes, restaurants, advertising — revealed the same gap. My daughter is why "interesting but doesn't pay" has never been an option. Every decision runs through whether it gets us to the first paying pilot.

### What's new — three things competitors can't combine

1. **23-signal composite, not one or two.** BioCatch optimizes for fraud authentication and ships a proprietary risk score, not a portable receipt. Roundtable ships a score, not a credential. World ID proves *an identity-verified human exists*; we prove *this specific session had attention engagement* with zero biometric enrollment.
2. **Quality tiers, not binary human/bot.** Deep Focus / Active / Passive / Background. The same human at the same screen can be any of the four. That distinction is what regulated buyers actually pay for.
3. **Cryptographic receipts with zero content data.** Hashes contain no PII, no screen contents, no keystrokes. Architecturally SCIF-eligible. COPPA-safe by construction.

### What we understand that others miss

The signal generating the receipt is the same across every vertical. Buyers differ only in the *tier cutoff* they care about. A nursing home needs "Active or better, continuously, with logs." An ad network needs "Active or better, 15 seconds of view-time." A CME LMS needs "Deep Focus for N minutes with proof the learner wasn't just leaving the tab open." **Same protocol. Different slices. The company that builds the horizontal layer wins all of them.**

### Competitors

- **Roundtable AI (YC S23).** Real-time risk score, $99 entry. They ship a score; we ship a W3C Verifiable Credential signed with Ed25519, verifiable offline. Different artifact.
- **Worldcoin / World ID 4.0.** 18M verified users, integrations with Tinder/Zoom/DocuSign as of 2026-04-17. They prove identity once via iris scan; we prove behavioral attention per-session. Complementary, not substitutable — a World-verified user still needs an attention receipt per CME module.
- **HUMAN AgenticTrust** (Apr 2026). Authenticates *the AI agent*; we measure the human on the other end and bind to content hash.
- **BioCatch** (Permira-backed, ~$160M ARR). Ships a proprietary risk score for fraud ops; we ship a portable offline-verifiable receipt for compliance/credentialing/research. Different buyer.
- **DV / IAS / Moat.** Ad-tech ingest pipeline. Not a receipt a compliance auditor can replay five years later.
- **Cloudflare Privacy Pass.** Binary pass-fail tokens. No behavioral composite. No content binding.
- **GA4 / Clarity / Looker.** Report what happened. Not whether a human was there.

**Honest acknowledgment:** IACR ePrint 2025/2330 (Kaklamanis et al., Dec 2025) is in adjacent intellectual territory — a theoretical Verifiable Aggregate Receipts construction. Not a product. No company. Our patent claims cover the multi-layer protocol (behavioral + environmental + composition + anchoring) rather than the receipt-aggregation primitive alone. Cited as evidence the category is being taken seriously.

### Revenue

| Tier | Price | Target |
|---|---|---|
| Entry | ~$500/mo | Market research panels, small insurance |
| Mid | $2-5K/mo | LMS, ad-tech, healthcare |
| Enterprise | $10-50K/mo | Defense, nursing home networks, large insurance |

Conservative TAM at 1% of US digital analytics is $600M/yr. Realistic 3-year envelope on 10-15 enterprise pilots converted half: $5-15M ARR. Horizontal layer outcome ceiling: $100M+ ARR within 5 years.

Plus 1% protocol fee on the developer SDK and consumer game (Lucid Wins) IAP/Pi Network revenue.

### How we get users

1. **CME as primary wedge.** Largest fraud, sharpest pain, regulators watching (ACCME, ABMS, state boards), no entrenched competitor. CME flow live at sws-attention-proofs.web.app/cme-demo.html, 21 CFR Part 11 mapping included. First cold email drafted (PPP / J Clinical Psychiatry).
2. **Live demo IS the pitch.** Every conversation opens with a tagged link. Prospect runs the demo, their session becomes data, they leave with a verifiable receipt. Receipt-explorer page lets a technical reviewer see every layer before a sales call.
3. **Outreach gated on pilot-ready bar, by design.** Pre-pilot beta with 4 unaffiliated testers (2026-04-25) surfaced 4 product-blocking bugs — exactly the kind a pilot client's auditor would catch. All fixed within 24 hours. Today's three calibration bugs surfaced and fixed the same day. The bar is "100% confidence before cold-emailing buyers"; we are very close.
4. **Proof gallery as inbound magnet.** 9 vertical tiles, public, share-ready for Slack and LinkedIn at the moment we judge it pilot-ready.

---

## EQUITY

**Incorporated:** SWS Strategic Media LLC `[INPUT #1 — state of formation]`
**Outside investment:** None. 100% founder-owned.
**Fundraising:** Applying to YC S26, NSF SBIR Phase I, Antler/Techstars in parallel. No term sheets.

---

## CURIOUS

### Why YC

Roundtable AI (YC S23) being in the portfolio convinced me YC understands that attention/authenticity verification is a real category and routinely backs founders working in adjacent territory when the wedge is clear. The gap between Roundtable's real-time risk scoring and our cryptographic receipts of attention quality (portable W3C credentials across every regulated vertical) is the kind of "same neighborhood, different house" YC has funded before — Stripe near Braintree, Substack near Medium.

Timing is the other reason. Patent filed 2026-03-17. Utility conversion deadline 2027-03-17. An accelerated 12 weeks inside YC is the best vehicle for closing the first pilots and converting the patent with real commercial traction behind it.

### How heard
`[REWRITE — your story. "Followed YC for years" is fine if true. Be specific about which company or founder first put it on your radar.]`

---

## ANYTHING ELSE

`[REWRITE — this is the one section where emotional honesty matters more than polish. The draft below is a starting point.]`

I'm applying as a solo founder with a filed patent, a working artifact deployed in production, and a narrow window. The honest frame: I'm in a hard place financially and physically, and I'm building anyway. The protocol is real, the code runs, the patent is filed, the wall is live. YC accelerates this by 12-18 months; it does not make the difference between shipping and not shipping.

The asset nobody else has is the combination of: a granted filing date across 247 innovations; production receipts being signed and validated against a 7-layer attestation stack right now; 270+ tests across 45 suites; a hostile-review hardening cycle that closed ~93 findings across 7 rounds; a calibrated Bayesian P(human) on every receipt; offline browser verification with no SWS server involved.

The honest disclosure I'd rather a YC partner hear from me first: a sufficiently sophisticated paste-bot (Bezier-mouse + Voss-McCartney 1/f timing per channel + Hick's-Law-aware decision delays — Tsinghua DMTG-class) produces single-signal motor statistics inside human-typical bands. Per-signal threshold tightening cannot fix this and we tried twice. The structural defense is the layered stack: env-gate cloud-VM detection + composition integrity + cross-signal coherence + content-bound receipt + server-side recompute (the wall). Bypass cost shifted from $50/mo + 56h to $5-20K/mo + 200-400h after the wall shipped.

If you want me in the batch, I'll be in the batch. If not, I'm shipping the first pilot this summer anyway.

---

## FOUNDER VIDEO — 1 MIN SCRIPT

Record LAST. Quiet room, decent light, phone or laptop at eye level, single take is fine. **Don't read word-for-word — internalize the 5 beats and tell it.**

> Hi, I'm Stephen Furpahs, solo founder of SWS Strategic Media. I'm building cryptographic proof of human attention — a tamper-evident receipt every regulated transaction can attach as evidence that a real human did the work, not an AI agent or a bot.
>
> Everybody in analytics measures what happened. Nobody measures whether a human was actually there. That gap is where ad fraud lives, where compliance fails, where CME credentialing can be defeated by a script, and where the agentic web has no audit layer.
>
> We measure 23 behavioral signals — Fitts, Hick, prewhitened 1/f scaling, submovement count, twenty more — every one grounded in 50 to 70 years of peer-reviewed motor-control and cognitive research. The receipt is a SHA-256 hash of the entire session. Tested against a hundred random tamper attacks: every one detected. Every receipt includes a calibrated Bayesian probability the session was human, with bootstrap uncertainty bounds.
>
> Patent filed at the USPTO March 17, 2026. The protocol is live right now, deployed on Firebase Cloud Functions. Anyone can verify a receipt in their browser using only WebCrypto — no SWS server involved.
>
> I'm applying because I want this to be the audit layer for every vertical with a screen, starting with CME credentialing where the fraud is largest and the regulators are watching. Thanks for watching.

**Pre-record:** water at hand, phone on DND, one timed read-through aloud (target 55-60s; if you're hitting 70+ slow down or trim), shoot 3 takes pick the best, upload as **Unlisted**.

---

## FINAL PRE-SUBMIT CHECKLIST

### Stephen-only inputs
- [ ] Input #1: LLC state of formation
- [ ] Input #2: bank / burn / runway
- [ ] Input #3: USPTO provisional serial 63/XXX,XXX
- [ ] Input #4: confirm or replace project-start framing
- [ ] Input #5: rewrite pre-existing-accomplishment in your voice
- [ ] Input #6: replace `N` with last-7-days Firestore session count

### `[REWRITE]` sections (your voice required)
- [ ] Code-writing answer (FOUNDER section)
- [ ] Why this idea (IDEA section)
- [ ] How heard about YC (CURIOUS section)
- [ ] Anything else (last section before video)

### Founder video
- [ ] Recorded ~55-60s
- [ ] Uploaded as **Unlisted** to YouTube
- [ ] URL pasted in COMPANY section

### Verification
- [ ] Read every answer aloud once. Cut anything that sounds like AI-speak.
- [ ] Confirm 50-char company description fits.
- [ ] `git push origin main` — get unpushed commits to GitHub.
- [ ] Live-site smoke checks pass (scripts in `scripts/test-*.js`).
- [ ] `for-reviewers.html` returns 200.

### Submit
- [ ] https://www.ycombinator.com/apply before **2026-05-04, 8:00pm PT**

---

*v2 of YC_S26_APPLICATION_DRAFT.md — same structure, ~65% shorter, today's wall + calibration narrative integrated, accurate test counts.*
*Original frozen at YC_S26_APPLICATION_DRAFT.md. Diff anything you want to keep from the original; nothing was thrown away that you didn't want cut.*
