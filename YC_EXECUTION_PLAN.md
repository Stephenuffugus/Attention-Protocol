# YC S26 — Execution Plan
**Owner: Stephen Furpahs** · **Generated: 2026-04-20 (late night)** · **Submit deadline: ~2026-04-26**

This is your single source of truth for tomorrow morning. Read it once, pick your track, then start executing. Everything here is based on five parallel research teams + a repo audit completed tonight.

Companion docs in this repo:
- `YC_FOUNDER_BRIEF.md` — what the product is, bot taxonomy, what to pitch, Q&A prep
- `YC_S26_APPLICATION_DRAFT.md` — the application draft itself
- `WEBSITE_TEAM_HANDOFF_Firestore_Sync_Fix.md` — historical (Firestore now fixed)

---

## 0. Where you are right now (end of 2026-04-20 session)

**Shipped tonight:**
- ✅ Firestore provisioned on `sws-attention-proofs` (was never created — root cause of "synthetic data" problem)
- ✅ Anonymous auth + rules correct
- ✅ First real human receipt in the cloud: `7d780c38c65d878005d35cf659136d8da6efb6033451cacd9704187a23e26e3c`
- ✅ Three real Puppeteer bot receipts for adversarial comparison
- ✅ SHA-256 display bug fixed (was showing session ID), deployed live
- ✅ YC draft numerically honest (15 production + 5 roadmap signals; 437 tests)
- ✅ Puppeteer bot harness: `proof/run-bot-vs-human.js`
- ✅ Commits `c938d19` + `3ed7d8b` pushed to main
- ✅ `YC_FOUNDER_BRIEF.md` interview cheat sheet

**Known weaknesses (documented honestly):**
- ❌ Bot-vs-human composite gap only ~0.09 under current calibration (not a reliable classifier)
- ❌ Receipts hashed but NOT digitally signed (JWT `alg=none`)
- ❌ No hash chain (each receipt independent)
- ❌ No 90-sec CME demo video
- ❌ Real corpus = N=1 (you)
- ❌ Zero paid pilots

---

## 1. The core reframe (from Team 3 research)

**Old pitch narrative:** *"LLMs broke CME overnight — AI cheating is a hair-on-fire crisis."*
**Problem:** this framing is NOT actually hair-on-fire in CME provider circles. Historical CME fraud is ~5 cases/year. No massive Reddit/LinkedIn panic.

**New pitch narrative:** *"Procurement-ready proof of completion for pharma/FDA-regulated CE + portable credentials."*
**Why it's stronger:** compliance + portability is what CME buyers actually buy today. AI cheating is the trend we're ahead of, not the pain they already feel.

**Sales consequence:** the first pilot conversation is with a pharma CME provider or ACPE pharmacist-CE buyer, not a university worrying about ChatGPT. Pharma has 21 CFR Part 11 obligations and actively buys compliance infrastructure.

---

## 2. Three quotes to drop into your YC application

1. **ACCME, December 2025** — *"Guidance on the Responsible Use of AI in Accredited Continuing Education"*. The accrediting body itself now formally flags AI as an integrity risk. Source: accme.org/resource/guidance-on-ai/
2. **Assessment in Higher Education (Taylor & Francis), 2025** — *"Unproctored online examinations are no longer a meaningful summative assessment method."*
3. **JMIR Research Protocols, 2025** — RCT testing whether high-schoolers can pass CME tests across six medical specialties using ChatGPT-4, predicated on the hypothesis that *"the concept of continuous medical education requires reevaluation."* **This is your single most quotable finding — high-schoolers passing doctor exams via LLM is a one-line pitch sell.**

Also citable in the "What's novel" section of the YC draft:
- **arxiv 2511.12468 (2025)** — *"Detecting LLM-Assisted Academic Dishonesty using Keystroke Dynamics"*. Reports 97-99% F1 using keystroke dwell/flight/digraph features. Justifies adding "Composition Integrity" as our 21st signal.

---

## 3. The 6-day sprint (before YC submit)

Two tracks. Pick one Monday morning based on how you feel.

### Track A — Aggressive (recommended if you have 20+ engineering hours available)

| Day | Work | Effort | Payoff |
|---|---|---|---|
| **1 AM** | Ed25519 signing via `@noble/curves`. Wire `src/sdk/verifiable-credentials.js::toJwt()` to real signing. Generate server keypair, publish public key at `/.well-known/attention-pubkey.json`. | 5 hrs | Kills top crypto reviewer objection |
| **1 PM** | Integrate `@fingerprintjs/BotD` as environmental gate. Re-run `node proof/run-bot-vs-human.js`. Expected: gap widens from 0.09 → ~0.25. | 4 hrs | Classifier actually works |
| **2 AM** | Composition Integrity signal (Signal 21): paste-burst detector + backspace-free-text flag + digraph-interval outlier detector. Cite arxiv 2511.12468 in docstring. | 6 hrs | LLM-cheating moat, arxiv-backed |
| **2 PM** | OpenTimestamps anchoring via `javascript-opentimestamps`. Show "anchoring to Bitcoin…" / "anchored to block #X" in receipt UI. | 6 hrs | "Bitcoin-anchored receipts" pitch line |
| **3 AM** | Wire `src/sdk/privacy-compliance.js` consent module into SDK core (already built, 1 function call to connect). Delete unused `crypto-js` npm dep. | 2 hrs | GDPR/CCPA compliance line |
| **3 PM** | Update `YC_S26_APPLICATION_DRAFT.md` with the three quotes from §2, the reframe from §1, and the three new capabilities (signed + anchored + LLM-integrity). | 2 hrs | Stronger pitch |
| **4** | Record 90-second CME split-screen demo video (GA4 green-check vs SWS BACKGROUND receipt). This is the pitch's single most important asset. | ~4 hrs | THE demo |
| **5** | Get 5 friends/family to each run a real 3-minute session at sws-attention-proofs.web.app/demo.html. Corpus goes from N=1 to N=6+. | ~1 hr your time | Real corpus |
| **6** | Final YC draft read-through out loud. Open demo pages in incognito to verify they work. Submit. | 2 hrs | Ship |

### Track B — Conservative (if you're tired or life intrudes)

Pick these three; ignore everything else:

1. **Ed25519 signing** (Day 1, 5 hrs) — biggest single credibility boost
2. **90-second CME demo video** (Day 2, 4 hrs) — THE pitch asset, unsubstitutable
3. **5 real human sessions** (Day 3-5, 1 hr) — N=1 → N=6+

Everything else goes into the 30-day post-submit roadmap. Honest-but-smaller pitch beats aspirational-bloated pitch.

---

## 4. Post-submit / pre-interview roadmap (30 days)

Ordered by leverage. Don't start these until after you hit submit.

1. **xAPI statement adapter** (1-2 days) — `tincanjs`. Any CME LMS ingests it. Non-negotiable for first pilot.
2. **OpenBadges 3.0** (1 day) — extend existing W3C VC code (already 80% there). Learners port badge to LinkedIn.
3. **Merkle batching** (2 days) — `merkletreejs`. One OpenTimestamps Bitcoin anchor covers thousands of receipts. Scale solved.
4. **Classifier recalibration on Balabit dataset** (3-5 days) — MIT-licensed 10k human trajectories + BeCAPTCHA-Mouse synthetic adversarial. Logistic regression + isotonic calibration. Fixes monotonicity. Target gap: 0.30+.
5. **Honeypot canary tokens** (3-5 days) — fork `jmgirard/honeypot` (MIT). Invisible text LLMs paste but humans don't see. Killer demo moment for interview.
6. **Deploy server backend to Cloud Run + Firestore** (4 hrs) — `server/index.js` is 1425 LOC production-grade, just needs database swap + deploy. Solves `api.swsprotocol.com` gap.
7. **21 CFR Part 11 compliance memo** (2 days) — you satisfy ~70% already; write the validation doc.
8. **ACCME PARS export** (3-5 days) — wait until a pilot gives you their provider ID, then build the XML/Web-Services transformer.
9. **Landing-page content**: "CME Question Template Library" (AI-resistant question formats). 1 week. SEO/lead-gen, positions you as thought leader.

---

## 5. Skip / defer (and why)

- **LTI 1.3** — wait for a pilot to demand Canvas/Blackboard embed.
- **SCORM** — legacy; ask the buyer first, they may not want it.
- **Sigstore/Rekor** — designed for code supply chain, not behavioral data. OpenTimestamps is the right fit here.
- **zk-SNARKs** — 2-6 weeks of circuit design + trusted setup + audit. 12-month roadmap item.
- **HIPAA BAA** — only a blocker if CME content embeds PHI. Cross that bridge when asked.
- **Lucid Wins consumer game** — zero code exists. Do not mention in YC interview unless pushed.

---

## 6. Library cheat sheet (with star counts where known)

| Purpose | Library | Install | Notes |
|---|---|---|---|
| Ed25519 signing | `@noble/curves` | `npm i @noble/curves` | 895⭐, 6 audits incl. Cure53 Sep 2025. Use this. |
| Ed25519 (slimmer) | `@noble/ed25519` | `npm i @noble/ed25519` | Alternative — 5 KB sister package |
| Browser bot detection | `@fingerprintjs/botd` | `npm i @fingerprintjs/botd` | ~20 KB. Single biggest classifier win. |
| Timestamp anchoring | `javascript-opentimestamps` | `npm i javascript-opentimestamps` | Official Bitcoin-anchored timestamps |
| Merkle trees | `merkletreejs` | `npm i merkletreejs` | Most-used JS Merkle lib |
| Merkle (stricter) | `@openzeppelin/merkle-tree` | `npm i @openzeppelin/merkle-tree` | Battle-tested alternative |
| W3C VC signing | `@digitalbazaar/vc` + `@digitalbazaar/ed25519-signature-2020` | `npm i @digitalbazaar/vc @digitalbazaar/ed25519-signature-2020` | For post-submit OpenBadges 3.0 work |
| xAPI | `tincanjs` or `@xapi/xapi` | `npm i tincanjs` | Both work; TinCanJS is canonical |
| LTI 1.3 | `ltijs` | `npm i ltijs` | When a pilot asks |
| Honeypot tokens | Fork `jmgirard/honeypot` | Manual fork | MIT license, Quarto extension |

---

## 7. Public datasets for classifier calibration (post-submit)

| Dataset | License | Size | Use |
|---|---|---|---|
| **Balabit Mouse Dynamics Challenge** | MIT (public GitHub) | 10 users, 3 GB (x,y,t,button) | Train logistic regression on real human trajectories |
| **BeCAPTCHA-Mouse (BiDAlab)** | Research, GitHub | Synthetic + real, labeled bot-vs-human | Adversarial validation |
| **HuMIdb (BiDAlab)** | Research, email atvs@uam.es | 600 users, 14 sensors, 5 GB | Mobile device signals |
| **Buffalo Keystroke** | Request via setlur@buffalo.edu | 157 users | Keystroke rhythm calibration |

Start with Balabit — MIT-licensed, drops into a replay harness in ~2 days.

---

## 8. The 5-class bot taxonomy (from YC_FOUNDER_BRIEF.md §4)

Memorize cold for YC interview:

1. **Naive script bots** — constant-interval clicks. Caught by timing entropy.
2. **Jittered bots** — random delays trying to look human. Caught by Hick's Law (response time doesn't scale with option count).
3. **Puppeteer/Selenium bots** — full browser automation. Caught by BotD (environmental) + fractal scaling + cursor jerk.
4. **LLM-driven bots (GPT filling forms)** — the cheating case. Caught by Composition Integrity (Signal 21) — paste-bursts, no-backspace, digraph anomalies.
5. **Click farms / paid humans** — real humans rushing. Caught by reading speed + cross-signal correlation (flat).

---

## 9. Questions you should NOT answer "idk" to

Memorize the shape of your answer to each (from YC_FOUNDER_BRIEF.md §7):

- How accurate is the classifier?
- Why can't I just use GA4?
- Why hasn't Google / BioCatch done this?
- What's your moat?
- Show me traction.
- Who's the buyer?
- **Why you?** ← rewrite this one in your own voice tomorrow
- What kills this in 18 months?
- What did you learn this week that changed your mind? (Answer: the 0.09 bot gap finding + the reframe.)

---

## 10. Internal asset/gap table (do not show YC; know it cold)

| Asset | Status | Notes |
|---|---|---|
| Patent | ✅ | USPTO 2026-03-17, serial # to add |
| SDK with 437 tests | ✅ | 15 signals production |
| Live proof site | ✅ | sws-attention-proofs.web.app |
| Real human receipts | ⚠ | N=1, target 6+ by submit |
| Real bot receipts | ✅ | N=3 |
| CME demo video | ❌ | Record Day 4 |
| Letters of interest | ❌ | Worth trying for 1 pharma CME provider this week |
| Digital signatures | ❌ | Track A Day 1 fixes this |
| Hash chain | ❌ | 30-day roadmap |
| xAPI / OpenBadges / LTI | ❌ | 30-day roadmap |
| `api.swsprotocol.com` | ❌ | 30-day roadmap |
| Lucid Wins game | ❌ | Do not mention |

---

## 11. Morning-of checklist (day you submit)

Run through this before hitting the submit button:

1. Open `https://sws-attention-proofs.web.app` in incognito — does it load?
2. Open `https://sws-attention-proofs.web.app/demo.html` in incognito — run a session, does it produce a real SHA-256?
3. Click the 90-second CME video link in your draft — does it play?
4. Re-read the asset/gap table (§10). Are you about to overclaim any ❌ items?
5. Does the Why-you section sound like you, not like me?
6. Is the corpus N≥5 real human sessions?
7. Test count in draft matches `npm test` output?
8. Patent serial number filled in?

---

## 12. One-line grounding

You have a patented, working, live, privacy-preserving cryptographic attention-attestation protocol with real receipts in the cloud, a 437-test SDK, a coherent wedge, a founder who knows his gaps, and — if you execute Track A tomorrow — a signed, Bitcoin-anchored, LLM-integrity-aware classifier that actually separates humans from bots. **Tell the truth with precision.** That is the whole game.

---

*End of plan. Sleep. Pick your track in the morning.*
