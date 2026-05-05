# Prolific Study Setup — Attention Protocol Corpus

**Goal:** N=25 vetted human sessions across mixed devices/demographics, single overnight batch, ~$70–$85 total.

**Source tag for Firestore queries:** `prolific_2026-05-05_batch1`

---

## Step 1 — Create your Prolific researcher account

1. Go to https://prolific.com → **Sign up as researcher**
2. Identity verification (driver's license or passport scan, ~10 min)
3. Add a payment method ($85 minimum funding; you only spend what participants earn)

## Step 2 — Generate a completion code

In your Prolific dashboard, when you create the study, Prolific generates a **completion code** for the study (e.g. `C1A2B3D4`). Note this code — you will paste it into the study URL below and demo.html will redirect participants back to Prolific using it.

## Step 3 — Configure the study

**Study type:** External study (URL-based)

**Study URL** (paste this into Prolific exactly, replacing `YOUR_CODE_HERE` with the completion code from Step 2):

```
https://sws-attention-proofs.web.app/demo.html?source=prolific_2026-05-05_batch1&pcc=YOUR_CODE_HERE&PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}&SESSION_ID={{%SESSION_ID%}}
```

Prolific substitutes the `{{%PROLIFIC_PID%}}` etc. tokens automatically per participant.

**Completion method:** "URL redirect" — participant is redirected to `https://app.prolific.com/submissions/complete?cc=...` automatically when the demo finishes (10-second countdown + manual button + paste-fallback all wired in).

**Estimated completion time:** 7 minutes (gives buffer over the actual ~5-min flow)

**Reward:** $1.50 (Prolific's recommended floor for a 5-min task is ~$1.25; $1.50 keeps you above the "fair pay" line and improves quality)

**Total participants:** 25

**Demographics filter (recommended):**
- **Country of residence:** US, UK, Canada, Australia (English-language)
- **Age:** 18–65
- **Approval rate:** ≥95% (Prolific's quality bar)
- **First language:** English
- **No prior participation in our studies** (toggle this so each session is a distinct human)

**Device split:** Prolific lets you split the study into two arms — run **15 desktop-only + 10 mobile-only** or just leave device unrestricted and let it land naturally. Recommend the split so you guarantee mobile coverage for the YC "≥4 device classes" claim.

## Step 4 — Study description (paste this into Prolific)

**Title:**
> 5-minute attention-tracking demo (browser-only, no signup)

**Short description:**
> Read a short passage, answer one comprehension question, and type a brief reflection. We measure how the protocol distinguishes humans from bots.

**Full description (paste into the "What participants will do" field):**

> ### What you will do
>
> 1. Read a short passage about a real-world topic (~3 minutes)
> 2. Click on a few targets and answer one multiple-choice question
> 3. Type a 1–2 sentence reflection (free text, in your own words)
> 4. View your "attention receipt" — a cryptographic summary of how you completed the task
>
> ### What we collect
>
> - The **shape** of your mouse movements and typing rhythm (timing patterns, not content)
> - Time spent on each section
> - Your answers to the comprehension question
>
> ### What we DO NOT collect
>
> - Your name, email, or any personal identifier
> - The actual content of what you type (the protocol records typing **rhythm**, not characters)
> - Your IP address, browser fingerprints, location, webcam, or microphone
>
> ### Why we are doing this
>
> We are validating a cryptographic protocol that produces a verifiable receipt proving a real human (not a bot or an AI) completed an online activity. Your session contributes to a small research dataset (~25 humans across multiple devices) used to calibrate the protocol's human-vs-bot separation.
>
> ### After you finish
>
> You will be redirected back to Prolific automatically (10-second countdown). If the redirect fails, the page will display a code you can paste into Prolific manually.
>
> ### Best done on
>
> A laptop or phone (whichever you'd normally use). Do not use a virtual machine, headless browser, or browser automation — those will be flagged as bot-like by the protocol and your submission will be rejected.

**Eligibility / pre-screen text** (Prolific puts this on the consent page):
> Please complete this study honestly and at your normal reading pace. Do not paste the reflection from another window — type it yourself in your own words. Do not use ChatGPT or any AI assistant. Submissions showing automation patterns will be rejected per Prolific policy.

## Step 5 — Submit study for Prolific approval

Prolific reviews studies in ~1 hour during business hours. Once approved, the study goes live and fills overnight (typically 6–18 hours for N=25 with the filters above).

## Step 6 — Watch the data come in

While the study is filling, monitor in real time:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/workspaces/Attention-Protocol/.gcp-key.json"
node scripts/corpus-status.js prolific_2026-05-05_batch1
```

Each completed Firestore document carries the `prolific.pid`, `prolific.study_id`, `prolific.submission_id` fields, so you can cross-reference any session against Prolific's submission dashboard.

## Step 7 — Approve / reject submissions

Prolific gives you 21 days to approve each submission. Reject only if:
- `environmental.bot === true` (caught by env-gate)
- `composition_integrity.composition_verdict === pasted` (reflection was pasted)
- `duration_sec < 60` (didn't actually engage)
- `interaction_count < 20` (mechanical click-through)

Approve everything else. Honest engagement at any composite score is valuable corpus data — even low-composite real humans tell us about the lower edge of the human distribution.

## Total cost breakdown

| Item | Amount |
|---|---|
| 25 participants × $1.50 | $37.50 |
| Prolific service fee (~33%) | ~$12.40 |
| **Subtotal at $1.50/participant** | **~$49.90** |
| If you set $2.50/participant for premium quality | ~$83.00 total |

Recommend **$1.50 for the pilot batch**. If quality is low you can run a second batch at $2.50 to validate the price/quality curve.

## After the batch lands

1. Run `scripts/analyze-sessions.js` filtered to `prolific_2026-05-05_batch1` for the buyer-ready distribution summary
2. Update `project_current_state.md` memory: real-corpus N from "21 across 5 humans" to "21 + 25 = 46 across 30+ humans"
3. The same SDK + receipt + verifier flow that the buyer uses on a pilot is now backed by real-corpus data — no fabrication, no Stephen-only baseline

---

**Last updated:** 2026-05-05.
