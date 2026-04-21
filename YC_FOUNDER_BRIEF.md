# YC S26 — Founder Brief
**For: Stephen Furpahs**
**Last updated: 2026-04-20**

This is your internal cheat sheet. Read it twice. Everything here is based on what actually exists in the repo and live sites as of tonight's commit `c938d19`.

---

## 1. What the product actually is (in one sentence)

A JavaScript SDK that produces **tamper-evident, privacy-preserving cryptographic receipts of human attention** — 15 behavioral signals compressed into one human-confidence score and one SHA-256 hash per session, written to a cloud datastore or on-prem.

That's it. Everything else is a use case.

---

## 2. How it works in 5 bullets

1. **Site embeds one JS tag.** No user login. No webcam. No keystroke text recorded.
2. **SDK watches behavior** — cursor movement, click timing, scroll rhythm, decision time vs option count, typing cadence, tab focus. 15 signals, each grounded in published behavioral-science literature (Fitts, Hicks, Shannon entropy, fractal 1/f noise, two-thirds power law, etc.).
3. **Signals collapse into one composite score** (0.0–1.0) and one **quality tier**: Deep Focus (≥0.7), Active (≥0.5), Passive (≥0.25), Background (<0.25).
4. **Every scoring event gets hashed** — 9-field payload → SHA-256 → 64-char hex receipt. The receipt is tamper-evident: any mutation of the underlying data invalidates the hash.
5. **Receipts land in Firestore** (or any datastore a customer prefers) under an anonymous UID. The customer can later audit any session by re-running the hash computation against the stored payload.

**Tech stack:** Vanilla JS SDK (no framework lock-in), Web Crypto API for SHA-256, Firebase Auth + Firestore for storage. Node/Jest/Puppeteer for testing. Hosted on Firebase Hosting.

---

## 3. What it DOES NOT do (critical — don't overclaim)

- ❌ **Does not know who you are.** No PII collected. Just behavioral shape.
- ❌ **Does not record content.** No screen contents, no keystroke *text*, no audio.
- ❌ **Does not reliably classify bot-vs-human today.** Under current calibration, the composite gap between a well-engineered Puppeteer bot and a real human is only ~0.09. The signal library is research-grade; the classifier calibration is early. **Pitch receipts, not detection.**
- ❌ **Does not verify identity.** That's a separate problem. Roundtable (YC S24) is close-ish; we're orthogonal.
- ❌ **Does not work without JavaScript.** Server-side-rendered PDFs, CLI tools, etc. are out of scope.
- ✅ **Digital signatures are live.** Receipts are now Ed25519-signed (JWT `alg=EdDSA`). Public JWKS at `/.well-known/attention-pubkey.json` — anyone can verify offline in a browser. (Shipped 2026-04-21.)
- ❌ **Does not have a hash chain.** Each receipt is independent. Tamper-evident per-receipt via Ed25519 + Bitcoin/RFC-3161 timestamp, but no total-ordering cryptographic guarantee across a batch. Merkle batching scaffolded.

---

## 4. Bot taxonomy — the question you asked

Five adversary classes you should know cold. For each: what they do, what they're used for, and which of our signals catches them (in theory — remember, the composite is weak; individual signals are stronger).

| Adversary | What they are | Seen where | Best-case SWS signal |
|---|---|---|---|
| **Naive script bots** | Constant-interval clicks, no mouse movement, `.click()` via DOM | Cheap ad fraud, basic ballot stuffing | Timing entropy (near zero variance) |
| **Jittered bots** | Random delays trying to look human, still scripted | Mid-tier survey fraud, bot networks | Hick's Law (response time doesn't scale with task complexity) |
| **Puppeteer/Selenium bots** | Full browser automation, real mouse events, realistic waits | Sophisticated scraping, credential stuffing, click farms | Fractal scaling (1/f noise), cursor jerk (LDLJ), two-thirds power law |
| **LLM-driven bots** | GPT/Claude filling in forms, answering questions | Emerging — cheating in CME, LMS, online exams | Keystroke rhythm (LLM pastes), micro-pauses (too uniform), reading speed (too fast) |
| **Click farms / incentivized humans** | Real humans paid per click, rushing through content | Ad fraud, CAPTCHA farms, survey fraud | Reading speed (too fast for comprehension), scroll backtrack (none — they don't re-read), cross-signal correlation (flat) |

**The honest punchline:** Our 15 signals *can* discriminate each of these. Our current composite weighting *under-penalizes* scripted timing, which is why naive bots score ~0.50 instead of ~0.20. Calibration is post-YC work. For now: pitch the **receipt and signal breakdown**, not the single composite score.

---

## 5. What to LEAD with (YC wants one sharp thing, not everything)

**The primary wedge:** Credentialing / anti-cheating.

**The one-line pitch (locked):**
> *"We prove future doctors, lawyers, and pilots actually did the work. No webcam. No keystroke logger. One SDK."*

**Why credentialing:**
- ACCME, state bar, FAA all require proof of engagement for CE credit
- LLMs made every online course cheatable overnight — a category-defining moment
- Webcam proctoring (Proctorio, Honorlock) is privacy-toxic and provably failing
- $3–4B TAM by 2030 in CME alone
- Regulatory moat — ACCME and 21 CFR Part 11 are technical compliance categories; once you're certified, displacement is slow

**The demo that closes:** 90-second split-screen screencast — GA4 shows a green checkmark for a CME module someone slept through; SWS shows BACKGROUND tier, composite 0.18, and a receipt that would fail an ACCME audit. That video is the single most important asset you need to record this week.

---

## 6. What NOT to lead with (category graveyards)

- 🚫 **Ad fraud** — crowded, commoditized, nobody cares anymore, DoubleVerify won
- 🚫 **Bot detection as headline claim** — BioCatch owns this vertical and has 10+ years of fraud data you don't have, plus our current classifier gap is 0.09
- 🚫 **"We replace GA4"** — GA4 is free and sticky; you're a complement to it (proof receipts, not analytics)
- 🚫 **"Lucid Wins is our flywheel"** — the game doesn't have code yet; mentioning it invites follow-up you can't satisfy
- 🚫 **Restaurants** — your personal edge, but small TAM for the YC story. Mention as "first revenue in 60 days," not the thesis

---

## 7. Likely YC interview questions + your prepared answers

Memorize the shape of these, not the exact words. Your voice beats my voice.

**Q: "How accurate is your classifier?"**
A: "The signal library is research-grade — 15 behavioral signals, each grounded in published work. The composite classifier calibration is early, and under my current weights the bot-vs-human gap on well-engineered adversarial scripts is about 0.09. I'm honest about that. It's why I pitch auditable attention attestation, not binary bot detection. The receipt itself — tamper-evident, signal-rich, inspectable — is what enables credentialing audits today. Classifier tuning is a post-YC roadmap item."

**Q: "Why can't I just use GA4 / Clarity / session replay?"**
A: "Those tools report *what happened on the page*. They don't answer *was a human cognitively engaged*. A CME video that autoplayed while the learner ate lunch looks identical to a focused study session in GA4. In SWS it's BACKGROUND tier with a receipt that fails audit. The distinction is only visible at the behavioral-signal layer."

**Q: "Why hasn't Google or someone big done this?"**
A: "Ad-tech tried — DoubleVerify, IAS, Moat — and settled for viewability, because viewability is legally defensible in an IAB contract. Fraud-detection giants like BioCatch focused on identity spoofing, not attention quality. Proctoring companies went to webcams because it was faster to ship and privacy was someone else's problem. Nobody combined behavioral-science rigor plus crypto receipts plus privacy-first architecture plus a single-JS-tag deployment. The overlap area is where I filed."

**Q: "What's your moat?"**
A: "Three layers. Patent filed March 17 2026, 247 distinct innovations, 12-month conversion window. Category creation — credentialing buyers don't have an RFP line item for this yet, so we define the category. Behavioral-science-first design, not ML — we don't need a training dataset, we deploy day one. A BioCatch with unlimited resources would still need 18 months to reach feature parity, and the patent covers the composite-signal-to-receipt mapping."

**Q: "Show me traction."**
A: *(Honest answer):* "I filed the patent, shipped the SDK with 652 passing tests, deployed the live proof gallery at sws-attention-proofs.web.app, built a seven-layer attestation stack (Ed25519-signed, Bitcoin-anchored, RFC 3161-timestamped, with LLM-cheating detection and consent attestation), and generated real human attention receipts under those seven layers. Zero paid pilots yet. Three in conversation. I'm applying to YC because funding compresses a 12–18 month roadmap into 6."

**Q: "Who's the buyer in credentialing?"**
A: "ACCME-accredited CME providers ($1B+ market, ~1,800 organizations). Corporate training/LMS (Cornerstone, Workday Learning, Litmos — $15B). Professional licensure boards (state bar, FAA, nursing). All three pay per-learner-per-session today; replacing their "we believe they watched it" attestation with "here's the cryptographic receipt" is a direct procurement conversation."

**Q: "Why you?"**
A: *(Only you can answer this. Don't memorize mine — write yours. Truth beats polish. The YC draft already has a raw version of it — lines 155–161. Rewrite in your voice.)*

**Q: "What kills this in 18 months?"**
A: "Google Chrome shipping a built-in privacy-preserving attention API that obviates third-party measurement. Low probability but highest-impact. Near-term: BioCatch adding a receipt layer on top of their fraud stack, which they could reasonably do. The patent slows them; category ownership in credentialing is the real defense."

**Q: "What's one thing you learned this week that changed your mind?"**
A: *(Use tonight's finding.)* "I ran my own Puppeteer bots against my own live demo last night and confirmed the composite-score gap between bot and human is only about 0.09. I thought it would be bigger. That result killed the 'we detect bots' framing for the whole pitch and forced me back to 'we produce auditable receipts,' which is actually the stronger story."

---

## 8. Your honest state going into the interview (internal, not for YC ears)

| Asset | Real? | Notes |
|---|---|---|
| Patent | ✅ | Filed USPTO 2026-03-17, serial # to be added |
| Production SDK | ✅ | 652 tests (33 suites), 7-layer stack live, 15 behavioral + 2 LLM-integrity signals, 3 behavioral in research |
| Live proof site | ✅ | sws-attention-proofs.web.app — 9 public pages |
| Real human receipts | ⚠ | N=1 (you, 2026-04-20, composite 0.573, Bitcoin-pending). Target: 10+ before submission |
| Real bot receipts | ✅ | N=3, demonstrating pipeline works under adversarial input |
| 90-sec CME demo video | ❌ | Not recorded yet — **most important missing asset** |
| Letters of interest | ❌ | Zero. Worth trying for one CME provider this week |
| Ed25519 digital signatures on receipts | ✅ | Live. JWKS at /.well-known/attention-pubkey.json |
| OpenTimestamps Bitcoin anchoring | ✅ | Live. Stephen's 0.573 receipt stamped 2026-04-20, pending Bitcoin confirmation |
| RFC 3161 TSA (pharma-regulator alternative) | ✅ | Live. DigiCert/Sectigo/GlobalSign compatible |
| Browser-side full-receipt verifier | ✅ | verify.html — the YC pitch asset |
| Proof of Humanness (second YC wedge) | ✅ | /prove-humanness.html, QR-compressed, 3-min renewable |
| W3C Verifiable Credentials | ✅ | VC 2.0 + OpenBadges 3.0 issuer + xAPI 1.0.3 adapter |
| Consent module (GDPR Art. 7 / CCPA) | ✅ | Wired into the 7-layer pipeline |
| Composition Integrity (LLM-cheating detector, Signal 21) | ✅ | Paste-burst + keystroke cadence, arxiv-backed |
| Honeypot Canary (invisible LLM trap, Signal 22) | ✅ | 7-layer stack complete |
| Evidence kit ZIP + cold-email playbook | ✅ | dist/evidence-kit.zip + docs/cold-email-templates.md |
| 21 CFR Part 11 clause-by-clause mapping | ✅ | /part-11.html — pharma procurement asset |
| Production API `api.swsprotocol.com` | ❌ | Blocked on GCP billing for Cloud Run |
| Firebase Functions (in-session signing for live demo users) | ⚠ | Full scaffold ready; blocked on Blaze-plan activation |
| Lucid Wins game | ❌ | Design only, no code. Do not mention unless pushed. |

**If someone asks about anything in the ❌ / ⚠ column:** don't dodge. Say "that's on the roadmap, here's when." YC partners are allergic to dodging; they respect founders who name their gaps precisely.

---

## 9. The three pages of the demo site a YC reviewer will actually open

1. **https://sws-attention-proofs.web.app** — landing / proof gallery
2. **https://sws-attention-proofs.web.app/demo.html** — the live interactive test that generates a real SHA-256 receipt
3. *(After you record it)* **The 90-sec CME screencast** — linked from your YC application body

Make sure all three work flawlessly on mobile + desktop the morning you submit. Open them in incognito right before you hit submit.

---

## 10. One sentence to end on

**You have a patented, working, live, privacy-preserving cryptographic attestation protocol with real Ed25519-signed and Bitcoin-anchored receipts, 652 passing tests across 33 suites, a seven-layer attestation stack, two wedges (pharma compliance + proof of humanness), and a founder who knows his gaps.** That is strictly more than most Demo Day companies have at their YC interview. Don't oversell. Don't undersell. Tell the truth with precision — that's the whole game.

---

*Internal doc. Not for YC eyes. Keep in repo for reference.*
