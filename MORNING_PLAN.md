# Morning Plan
## Your single source of truth when you sit down

**Goal (the one that matters):** Working, marketable product + first paid pilot signed.
**Forcing function:** Product first. YC submission is 2026-05-04 but you said it's one of the last things we do, AFTER the product is where we need it to be.

**How to use this file:** When you sit down and ask Claude "what should we do?", Claude opens this file and walks you through it. Pick the time-tier that matches your day and execute in order.

---

## Where things stand (2026-04-21 end of push)

### ✅ Shipped today (large sprint)
- **754 tests green across 36 suites** (was 708 this morning; +46 new tests)
- **Gated composite shipped** — `src/sdk/receipt-composite.js` + unit tests + VC builder integration + bot harness reporter + verify.html display. All 4 bot profiles gate to 0.300 vs human 0.573 → gap **0.273** (was 0.011 pre-gate against LLM Paster)
- **7-layer canonical fixture** — `proof/results/verify-sample-7layer.json`, all 7 attestation layers populated in the signed credentialSubject
- **verify.html enhancements** — renders honeypot (3b) + TSA (6b) cards; Behavioral card shows both behavioral + gated composites with gate provenance
- **20 prospect dossiers** (`docs/prospect-dossiers/`) — every named contact flagged `[VERIFY]` for your LinkedIn pass
- **CME demo script** (`docs/cme-demo-script.md`) — 90-sec word-for-word narration + shot list + recording notes + anti-overclaim guardrails
- **AI-honesty pitch cheat card** (`docs/ai-honesty-cheat-card.md`) — printable, scripted answers to the 4 inevitable questions
- **Technical FAQ for QA teams** (`docs/technical-faq.md`) — 32 Q&As, 2800 words, buyer self-qualification companion to evidence kit
- **Corpus collection kit** (`docs/corpus-collection-kit.md`) + `scripts/corpus-status.js` — invite copy, tagged URL, CLI tracker
- **Canonical fixtures regression tests** — `tests/canonical-fixtures.test.js` (19 tests) protects all 4 shipped fixtures from drift
- **Deep dive fact-checked + rewritten** — §0 frame, §2 signal count 15→20, §2.5 (new — gated composite), §3/§4 citations corrected, §9 fixture-coverage table
- **Playbook Step 1.2** — now points to the fixture that actually renders a full card grid
- **Fixture expiry + new-gate refresh pipeline** — `scripts/refresh-demo-fixtures.js` extended to re-sign both canonical fixtures with gated-composite fields
- **Signing-key rotation kit staged** — `rotation-staging/` + `scripts/rotate-signing-key.js`. Nothing applied yet; security-debt item from in-session key exposure

### ❌ Still open
- You haven't RUN the playbook in-browser yet (Phase 1/2 browser checks). Gate on pitch readiness.
- You haven't finished reading the updated deep dive.
- CME demo video not recorded (script ready, ~4h of your time when you want it)
- Real human corpus still N=1 (toolkit shipped — invites ready to send)
- 20 personalized cold emails not drafted (blocked on you finishing study)
- LLM-in-the-loop bot harness **blocked on Anthropic support** — API key authenticates but their billing layer rejects even with $5 credit. Ticket needed.
- Bogazici empirical-priors calibration — blocked on you downloading the CC-BY dataset (~5 min browser click)
- Signing-key rotation cutover — staged, ready to execute when you decide (~15 min)

---

## The path, product-first order (top → bottom)

1. **Run the playbook browser checks** — 30 min. Phase 1 (live site) + Phase 2.1/2.2 (fresh session + round-trip verify). Gate on confidence.
2. **Finish reading SEVEN_LAYER_DEEP_DIVE.md** — 45 min. §0 (frame), §2.5 (new gated composite section), §7 (Bitcoin), §11 (compressed argument chain), §10 (anti-overclaim).
3. **Record the 90-second CME demo video** — script is word-for-word ready. 3–5 takes, pick best. ~4 hours.
4. **Send corpus invites** — text/email 8–10 people using `docs/corpus-collection-kit.md` templates. Check status with `node scripts/corpus-status.js corpus_2026-04-21_batch1`.
5. **LinkedIn pass on 20 dossiers** — verify [VERIFY] contact names. Red-line any dossier for a company you know personally.
6. **Personalize 20 cold emails** — use dossiers + templates. Sleep on them one night. Send morning 2.
7. **Unblock Anthropic API** — email their support with the ticket template from session log. Once unblocked, we build the LLM-in-the-loop harness (~2–3h my time).
8. **Signing-key rotation cutover** — execute `rotation-staging/ROTATION_PLAN.md` when convenient. Addresses the in-session key exposure.
9. **Bogazici empirical-priors** — download dataset, I build the loader + analysis. Calibrates signal thresholds against 2550 hours of real human mouse data.
10. **Deploy blockers** — Firebase Blaze + Cloud Run + Hostinger fix. Only unblock when a specific pilot conversation requires them.
11. **YC application lock** — LAST. Review existing draft against shipped state, update numbers, submit.

---

## Tier 1 — "I only have 30 minutes"

**Goal:** Confirm the product works with your own eyes, in a browser.

### Step 1 · Run the playbook browser phases (25 min)
Open `PRODUCT_VALIDATION_PLAYBOOK.md`. Run Phase 1 (live site — 3 pastes) and Phase 2.1 (fresh session). Use `proof/results/verify-sample-7layer.json`'s `signed_jwt` for the multi-card render demo.

### Step 2 · Tell Claude which boxes passed/failed
All 7 boxes green → you're pitch-ready on the core demo. Any box fails → stop; diagnose together.

**End-of-30-min outcome:** you know whether the product is pitchable.

---

## Tier 2 — "I have 2–3 hours"

### Steps 1–2 from Tier 1 first.

### Step 3 · Finish the deep dive (45 min)
Updated sections to re-read (since you stopped mid-read):
- §0 (frame — now distinguishes behavioral 0.004 gap from gated 0.273)
- §2 (signal count corrected 15→20 + full 20-signal list)
- §2.5 (new — gated composite)
- §9 (fixture-coverage table + 7-layer fixture)
- §11 (compressed chain — now 8 beats with gated composite)

When finished: "I read the deep dive. My questions are: X, Y, Z."

### Step 4 · Pick ONE asset to lock (60–90 min):

**Option A · Record the CME demo video.** Script is in `docs/cme-demo-script.md`. Set up browser tabs per the pre-production section. 3–5 takes. Upload to YouTube unlisted.

**Option B · LinkedIn pass on the 20 dossiers.** Fill the `[VERIFY]` fields (current VP Accreditation at Medscape, Director of Compliance at Pfizer, etc.). ~5 min per dossier.

**Option C · Send corpus invites.** Text/email 8–10 people from `docs/corpus-collection-kit.md` templates. Check arrivals later with `node scripts/corpus-status.js`.

**Recommendation:** Option C. It's short (15 min active), kicks off a 48-hour collection window in background, and solves the single biggest content gap (N=1 → N≥6).

---

## Tier 3 — "I have the full day"

### Steps 1–4 from Tier 2.

### Step 5 · Personalize 20 cold emails
Use `docs/cold-email-templates.md` (A for pharma, B for MECs, C for credentialing) + the per-prospect dossier. Draft all 20. **Do NOT send same day.** Sleep on them.

### Step 6 · Execute one deferred back-burner item
Pick one of:
- **Unblock Anthropic** — email support with the ticket template (session log has the full template). Once they clear the account, I build the LLM harness.
- **Sign-key rotation cutover** — execute `rotation-staging/ROTATION_PLAN.md`. 15 min, addresses the security debt.
- **Download Bogazici** — 5-min browser click at https://data.mendeley.com/datasets/w6cxr8yc7p/2 → drag zip into Codespace → I run the empirical-priors analysis.

**End-of-day outcome:** playbook confirmed, deep dive studied, 1 major asset locked, 20 emails drafted (awaiting night), 1 deferred item cleared, corpus collection in motion.

---

## Checkpoints (what "done" looks like)

| Stage | Done when |
|---|---|
| Confidence | All 7 playbook boxes green |
| Knowledge | Can explain §2.5 gated composite + §7 Bitcoin tradeoff in your own words for 60 sec without notes |
| Demo video | 90-sec clip uploaded to YouTube unlisted; link works in incognito |
| Corpus | N≥6 clean humans in Firestore tagged `source_type=corpus_2026-04-21_batch1` |
| Emails sent | 20 personalized; tracked with date + company + outcome |
| LLM harness | Anthropic unblocks → we build → bot harness exercises actual LLM-driven cheater |
| Key rotation | New kid live in JWKS; old kid retained during 7-day grace period |
| YC locked | Application reviewed, all `[BRACKETS]` filled, submit when product confidence earns it |

---

## Deploy blockers (do only when a buyer conversation requires)

| Blocker | Unlocks | Cost | Effort |
|---|---|---|---|
| Firebase Blaze | Live demo users mint their own credentials | Free tier 2M/mo | 5 min |
| GCP billing for Cloud Run | api.swsprotocol.com goes live | $5–20/mo | 20 min |
| Hostinger deploy of firestore-sync-fix.js | stevieweedseed.com hashes land in Firestore | $0 | 30 min website team |

---

## When you sit down tomorrow

Say one of:
- "What should we do?" → Claude opens this file
- "I have 30 min" / "2 hours" / "full day" → Claude picks the tier
- "Let's run the playbook" → walks step by step
- "I read the deep dive" → Claude answers your questions
- "Send the corpus invites" → Claude hands you final copy + tracks arrivals
- "Rotate the signing key" → Claude walks the cutover plan

---

**Last updated:** 2026-04-21 afternoon — end of the gated-composite + 7-layer-fixture + FAQ + dossiers + corpus-kit + rotation-staging sprint.
**Next update:** after playbook browser checks or deep-dive re-read completes.
