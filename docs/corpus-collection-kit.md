# Corpus Collection Kit
## Get to N≥6 real human sessions fast

**Why this matters:** Memory and YC notes both list "real human corpus N≥6" as the single biggest content gap before YC submission. Your current corpus is N=1 (your own 2026-04-20 session, composite 0.573). Any honest benchmark claim requires at least 6 distinct real users so quality-tier distribution + bot/human separation means something statistically.

**Target:** 6–10 completed sessions from 6–10 distinct humans inside 48 hours.

---

## Step 1 — Pick your batch ID

Give this batch a unique tag so their sessions don't mix with random demo visitors. Suggested format: `corpus_YYYY-MM-DD_batch<N>`.

**Today's batch:** `corpus_2026-04-21_batch1`

---

## Step 2 — The invite link

Share this exact URL with each participant (swap the batch tag if you start a second round later):

```
https://sws-attention-proofs.web.app/demo.html?source=corpus_2026-04-21_batch1
```

The `?source=...` parameter is preserved in the raw Firestore session document so we can filter for exactly these sessions later without touching the unrelated public visitors.

Nothing about this URL changes the demo's behavior. Participants see the same experience as any visitor.

---

## Step 3 — Pick an outreach channel + copy

### SMS / iMessage (one-tap)

> Hey — tiny favor: I'm building a tool that proves a human (not a bot) actually completed online training. It's a 3-minute demo. Would you tap this link and finish the five phases? No signup. No PII. Nothing stored about you personally.
>
> https://sws-attention-proofs.web.app/demo.html?source=corpus_2026-04-21_batch1
>
> Reply when you're done and I'll tell you what your receipt looks like. — Stephen

### Email

> Subject: 3-minute favor — tell me if my demo works
>
> Hi [Name],
>
> I'm building SWS Proof of Attention — a cryptographic receipt that proves a human completed an online training (not a bot, not a click-through, not a GPT paste). I need 6 people to run the demo so I have real data for my YC application this week.
>
> **The ask:** 3 minutes. No signup. No camera. No data collected about you personally (only the shape of your mouse movements and typing rhythm, not anything you typed or read).
>
> Link: https://sws-attention-proofs.web.app/demo.html?source=corpus_2026-04-21_batch1
>
> When you finish you'll see a composite score and a receipt hash. Screenshot it and send back if you want — I'll walk you through what each layer means.
>
> Thanks — owe you one.
>
> Stephen Furpahs
> stephenfurpahs@gmail.com

### Slack / Discord DM (fastest)

> hey — 3 min favor for my YC app? need 6 people to run this demo so i have real human data https://sws-attention-proofs.web.app/demo.html?source=corpus_2026-04-21_batch1 — no signup, no PII, all runs in your browser. screenshot the score when you finish if you're willing

### LinkedIn / Twitter DM (professional tone)

> Hi [Name] — I'm finalizing a YC S26 submission this week for SWS Proof of Attention (cryptographic training-completion receipts for regulated industries). I need 6 real human sessions in my demo to back the benchmarking claim in the application. 3 minutes, no signup, no data about you: https://sws-attention-proofs.web.app/demo.html?source=corpus_2026-04-21_batch1 — appreciate it.

---

## Step 4 — Who to ask

Shortlist (aim for 8–10 asks, expect ~60% completion → 5–6 finished):

- 2 family members who will do it immediately
- 2 friends outside tech (catch the non-developer path)
- 2 friends inside tech (catch the "clever enough to paste" path)
- 2 "neutral" asks (LinkedIn, former colleagues) — simulates how a random learner would complete

**Avoid:** people who know our product too well. They will over-perform or over-think. You want natural engagement.

---

## Step 5 — Tracking progress

Two options, pick whichever is faster for you.

### Option A — Firebase Console (5-second check, no tooling)

Open:
```
https://console.firebase.google.com/project/sws-attention-proofs/firestore/data/~2Fdemos
```

- Click the filter icon → **where** `source_type` **==** `corpus_2026-04-21_batch1`
- Each row is one completed session. Columns: session_id, composite, quality_tier, interaction_count, duration_ms.

### Option B — CLI status script

```bash
node scripts/corpus-status.js corpus_2026-04-21_batch1
```

Prints: count, composite distribution, quality-tier breakdown, environmental-gate verdicts, composition-integrity verdicts.

Requires one-time setup (Stephen only):
```bash
gcloud auth application-default login
# or place a service-account key JSON at proof/functions/.service-account.json
```

See `scripts/corpus-status.js` for details.

---

## Step 6 — What "good data" looks like

For each completed human session, you want:

- `composite >= 0.55` (humans should land above the passive/active threshold)
- `quality_tier in {active, deep}` (tier should reflect engaged behavior)
- `environmental.bot === false` (no participant on a headless browser by accident)
- `composition_integrity.composition_verdict === authored` (no participant who pasted)
- `interaction_count >= 30` (participant actually did the phases)

Any session failing ≥2 of these is a data-quality outlier — note it, but don't count it toward N. You want 6 sessions that pass ≥4/5 of the above.

---

## Step 7 — What to do with the corpus

Once you have N=6 clean human sessions:

1. Export them (CLI: `node scripts/corpus-export.js corpus_2026-04-21_batch1 > corpus.json` — see script) and commit to `proof/results/corpus-2026-04-21.json` (pseudonymized — sessions are already anonymous).
2. Update the YC application's benchmarking section with the real numbers.
3. Update `project_current_state.md` in memory to reflect N≥6 clean corpus.
4. The corpus becomes the baseline for any future classifier recalibration (Balabit-style work builds on top of it).

---

## Honesty footnote

The corpus is small. N=6 is the floor — not the ceiling. Any benchmarking claim from this batch should be qualified as "small-pilot preliminary data" in the YC application, not "statistically validated." Growing to N=60 is a post-seed-pilot priority. The current batch exists to make the claim *defensible*, not *conclusive*.

---

**Last updated:** 2026-04-21. Batch ID suggested: `corpus_2026-04-21_batch1`. Reuse this doc for future batches by bumping the batch number and date.
