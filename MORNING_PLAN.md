# Morning Plan
## Your single source of truth when you sit down

**Goal (the one that matters):** Working, marketable product + first paid pilot signed.
**Near-term forcing function:** YC S26 submit deadline is 2026-05-04.

**How to use this file:** When you sit down and ask Claude "what should we do?", Claude will open this file and walk you through it. Pick the time-tier that matches your day and execute in order. Don't skip steps — the order exists because later steps depend on earlier steps.

---

## Where things stand (2026-04-21 end of day)

- ✅ 10 commits pushed today. All audit hardening + tests + docs on origin/main.
- ✅ 708 tests green across 34 suites. Zero real regressions.
- ✅ 7-layer attestation stack live on sws-attention-proofs.web.app.
- ✅ Two study docs ready: `PRODUCT_VALIDATION_PLAYBOOK.md` and `SEVEN_LAYER_DEEP_DIVE.md`.
- ❌ You haven't run the playbook yet (the confidence gate).
- ❌ 20 cold emails not personalized.
- ❌ 90-second CME demo video not recorded.
- ❌ Real human corpus still N=1 (you).
- ❌ Zero paid pilots.

---

## The path, shortest version (top → bottom = first → last)

1. **Run the playbook** — 20 min. Confirm product works under your own hands. Gate on everything else.
2. **Read the deep dive** — 45 min. Know the product well enough to field buyer follow-ups.
3. **Record the 90-second CME demo video** — ~4 hours including script + takes. Most important missing asset.
4. **Build the 20 prospect dossiers** — Claude produces; you review. 2 hours your time.
5. **Personalize + send the 20 cold emails** — 3–4 hours. One good email beats 20 generic ones.
6. **Collect real corpus N≥6** — 1 hour your time (ask 5 friends/family to run a 3-min session).
7. **Unlock deploy blockers when/if a buyer conversation requires them** — Blaze activation, Cloud Run billing, Hostinger deploy.
8. **YC application lock** — final read-through + submit by May 4.

Everything below is the same list expanded into actionable tiers.

---

## Tier 1 — "I only have 30 minutes this morning"

**Goal:** Confirm the product works with your own eyes. Nothing else.

### Step 1 · Run the validation playbook (20 min)
```
Open: /workspaces/Attention-Protocol/PRODUCT_VALIDATION_PLAYBOOK.md
Do every phase. Stop at any Fail mode and tell Claude.
```
Success signal: all 7 boxes at the bottom of the playbook check green.
**If any box fails:** stop the day. Work with Claude to diagnose.

### Step 2 · Tell Claude which box failed (or that all 7 passed)
Claude will either:
- Flag that the product needs a fix before outreach (and propose the fix), OR
- Move you to Tier 2.

**End-of-30-min outcome:** You know whether the product is pitchable.

---

## Tier 2 — "I have 2–3 hours today"

**Goal:** Confidence + one concrete pitch asset built.

### Steps 1–2 from Tier 1 first.

### Step 3 · Read `SEVEN_LAYER_DEEP_DIVE.md` (45 min)
Focus passes:
- §7 (Bitcoin/OpenTimestamps — the one you asked about)
- §11 (the 2-minute argument chain — memorize the order)
- §10 (anti-overclaim list — know what NOT to say)

When finished, tell Claude: "I read the deep dive. My questions are: X, Y, Z."
Claude answers each one and either updates the doc or explains in-line.

### Step 4 · Pick ONE of these and build it with Claude (60–90 min):

**Option A — 20 Prospect Dossiers**
Claude builds: one page per named prospect (Pfizer IME, Medscape, DKBmed, Prova, Haymarket, PPP, Global Ed Group, CEC, Vindico, PeerView, PlatformQ, plus 9 pharma compliance leads — total 20). Each page: procurement cycle, named decision-maker title, specific regulatory driver, tailored pitch hook, likely objections + your honest rebuttals.
Your job: review + redline per company you know personally.
Output: `docs/prospect-dossiers/` directory, 20 files.

**Option B — 90-Second CME Demo Video Script + Shot List**
Claude builds: exact word-for-word narration (~140 words for 90s), shot-by-shot timing, split-screen layout (GA4 green-check vs SWS BACKGROUND), which browser windows to have open, what to click when. You record it in OBS / Loom / QuickTime.
Your job: record 3–5 takes. Pick best. Upload.
Output: `docs/cme-demo-script.md` + the video on YouTube unlisted.

**Option C — AI-Honesty Pitch Cheat Card**
Claude builds: single-page printable card you read before every call. Operationalizes `feedback_ai_honesty_framing.md` into specific scripted phrases for: opening, the "how do you build?" question, the "how big is your team?" question, the technical deep-dive dodge, the close.
Your job: read + adapt to your voice.
Output: `docs/ai-honesty-cheat-card.md`.

**Recommendation:** Option B (the video). You've wanted it since Apr 19. It's your biggest missing asset. One buyer watching the video does more than ten reading the evidence kit.

---

## Tier 3 — "I have the full day"

**Goal:** Two pitch assets built + outreach queue loaded.

### Steps 1–4 from Tier 2.

### Step 5 · Build the second Tier 2 option you didn't pick (60–90 min)

### Step 6 · Personalize 20 cold emails using the dossiers (2–3 hours)
Open `docs/cold-email-templates.md` + the dossier for each target.
For each prospect, produce a personalized version of Template A (pharma) or B (MEC) or C (credentialing). Sign off on each before it goes in your send queue.

Do not send them the same day you build them. **Sleep on them once, then send.** You want one morning to reread each with fresh eyes. Sending tired sends typos.

### Step 7 · Queue corpus collection (15 min)
Draft a 3-line message you'll send to 5 friends / family / close contacts asking them to run a 3-minute session at sws-attention-proofs.web.app/demo.html. Do not send yet — do that tomorrow with the emails.

**End-of-day outcome:** Two major assets built, 20 emails drafted (awaiting one night), corpus request drafted. Ready to execute outreach Day 2.

---

## Checkpoints (what "done" looks like at each stage)

| Stage | Done when |
|---|---|
| Confidence | All 7 playbook boxes green |
| Knowledge | Can explain Bitcoin/OTS tradeoff in your own words for 60 sec without notes |
| Demo video | 90-sec clip uploaded to YouTube unlisted; link works in incognito |
| Dossiers | 20 files in `docs/prospect-dossiers/`, each named + reviewed |
| Emails sent | 20 sent, tracked in a spreadsheet with date + company + outcome |
| Corpus | 6+ real human receipts in Firestore under `demos` collection |
| YC locked | Application reviewed out loud, all `[BRACKETS]` filled, submit button clicked |

---

## Deploy blockers — decisions you need to make (not all at once)

These are *not* urgent unless a specific buyer conversation requires them. Cost/effort:

| Blocker | Unlocks | Cost | Effort | When to do |
|---|---|---|---|---|
| Firebase Blaze activation | Live demo users can mint their own humanness credentials | $0 at pilot scale (free tier 2M/mo) | 5 min | When first pilot asks for "let my learners try it" |
| GCP billing for Cloud Run | api.swsprotocol.com goes live | $5–20/mo at pilot scale | 20 min | Before first pilot with API integration |
| Hostinger deploy of firestore-sync-fix.js | Hashes from stevieweedseed.com reach Firestore | $0 | 30 min (website team) | Before YC submit (gets you real-traffic data) |

You do not have to do any of these to send cold emails. You do have to do at least Blaze + Hostinger before telling a prospect "try it yourself."

---

## When you sit down tomorrow

Say to Claude one of:
- "What should we do?" → Claude opens this file and asks which tier
- "Let's run the playbook" → Claude walks you through it step by step
- "I passed the playbook; let's do Tier 2 Option B" → Claude builds the CME video script
- "I have 30 min" / "I have 3 hours" / "I have the full day" → Claude picks the tier for you

If Claude doesn't immediately reference this file, say: "Open MORNING_PLAN.md" and it will.

---

**Last updated:** 2026-04-21, end of the audit-hardening + deep-dive-docs sprint.
**Next update:** After you run the playbook tomorrow.
