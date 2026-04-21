# SWS CME Demo — 90-Second Video Script + Shot List
## Production target: one 90-second screencast you send to every MEC on cold-email template B

**Filmed on:** your laptop. OBS Studio, QuickTime, or Loom.
**Upload to:** YouTube unlisted. Paste link into Template B emails.
**Rewrite budget:** ~4 hours (script → setup → 3–5 takes → pick best → upload).

---

## Why this video — the claim it earns

A cold email gets opened for 11 seconds. An evidence-kit ZIP gets downloaded by maybe one reader in ten. A 90-second video that shows a real session go from screen-interaction to Bitcoin-anchored receipt to an in-browser verifier **turns a claim into a fact**. You want one minute of a VP Accreditation's attention; you spend it showing them the thing working.

The deep-dive doc argues the pitch is the *receipt*, not the classifier. This script is how you demonstrate that in 90 seconds — zero slides, all product.

---

## Pre-production — setup before you press record

### Browser windows (have all five open in **one profile window**, tabs 1–5 left to right)

| Tab | URL | State when recording starts |
|---|---|---|
| 1 | `https://sws-attention-proofs.web.app/demo.html` | Scroll to top, welcome screen |
| 2 | `https://sws-attention-proofs.web.app/verify.html` | Empty textarea |
| 3 | `https://sws-attention-proofs.web.app/prove-humanness.html` | Empty textarea |
| 4 | A generic LMS "completion confirmation" screenshot (Medscape, Cadmium, or a placeholder — saved as `lms-green-check.png`) | Full-screen image |
| 5 | `https://sws-attention-proofs.web.app/.well-known/attention-pubkey.json` | Raw JWKS JSON, formatted |

### One-time prep files (on your desktop)

- `/tmp/stephen-0573.jwt` — the known-good JWT from the anchored receipt. We already exported it. Have it open in a text editor on a second monitor, or in a Notes window you can Cmd-Tab to.
- `/tmp/humanness-sample.jwt` — the humanness credential JWT. Same.

### OBS / Loom settings

- **Canvas:** 1920×1080
- **Frame rate:** 30 fps
- **Mic:** external USB mic if you have one; built-in is acceptable but do a 10-sec voice test first.
- **Cursor:** enable "highlight cursor" (OBS has a cursor highlight filter; Loom does it automatically) — viewers need to see where you click.
- **Webcam:** off. No talking head. This is a product demo, not a pitch.

### Recording environment

- Full-screen the browser window; hide dock/menubar (Cmd-Option-D on macOS).
- **Disable notifications** (macOS Focus → Do Not Disturb).
- Close Slack, Messages, Email.
- Battery plugged in (no low-power CPU throttling during Puppeteer-heavy screens).

---

## The script — word-for-word narration, timed

**Total narration:** ~119 words. At ~80 wpm (deliberate, product-demo pace) this fills ~90 seconds with natural visual pauses. **Do not rush.** Silence over a shot of a Bitcoin-anchor badge is more persuasive than hurried words.

### [00:00 – 00:10] HOOK (10 s) — Tab 4 / LMS green-check image

**Visual:** Full-screen screenshot of a generic LMS completion screen. "Module complete ✓ · Certificate issued." Hold. Zoom in on the check.

**Narration:**
> "This is what your LMS says happened. Module complete, badge awarded. But Pfizer's 2025 IME grant proposals now score *outcomes rigor*. Your grantor will ask: did the learner actually pay attention?"

### [00:10 – 00:35] THE SESSION (25 s) — Tab 1 / demo.html

**Visual:** Click Tab 1. Scroll over the welcome screen. Click through consent. Skip visibly through the 5 phases — don't try to play through; just cursor over each phase name and let the viewer see there's structure. Land on the results screen.

**Narration (starts when you click Tab 1):**
> "SWS Proof of Attention. Same session, ninety seconds. Fifteen behavioral signals from the published literature — Fitts' Law, Hick's Law, fractal one-over-f scaling — plus a BotD environmental check, a typed-response integrity detector, and a consent attestation. All rolled up into one signed receipt."

**Recording note:** This is where you need a *pre-recorded* demo session, not a live playthrough. Run the session once before recording, screenshot or screen-record the results page showing composite 0.57 / quality tier `active` / 6-layer grid. Cut to that static frame at 00:30.

### [00:35 – 00:55] THE LAYERED RECEIPT (20 s) — frozen results-page image

**Visual:** Hold on the 6-layer results grid. Cursor slowly highlights each row:

1. Behavioral composite · 0.573 · `active`
2. Environmental bot check · BotD v2 · `human`
3. Composition integrity · typed, not pasted · `authored`
4. Consent · granted 2026-04-20 · GDPR Art. 7
5. Ed25519 signature · `sws-attention-2026-04`
6. Bitcoin anchor · OpenTimestamps · block N

**Narration:**
> "Six attestation layers. Behavioral. Environmental. Composition. Consent. Ed25519 signature. And an OpenTimestamps Bitcoin anchor — so the receipt can be proven to have existed at a specific block height, without trusting us."

### [00:55 – 01:20] INDEPENDENT VERIFICATION (25 s) — Tab 2 / verify.html

**Visual:** Click Tab 2. Paste the `/tmp/stephen-0573.jwt` contents into the textarea. Click **Verify**. Green banner appears. Wait two full seconds on the green banner — viewers need to see it land. Then scroll down to reveal the 6-layer grid.

**Narration (starts when you click Verify):**
> "Any grantor verifies this in their own browser. Our public key is at a standard JWKS URL — no SWS server, no API call, no account. Green across all six layers. Offline. Tamper-evident. This is what cryptographically-verifiable CME looks like."

### [01:20 – 01:30] CLOSE (10 s) — full-screen text card or Tab 1 homepage

**Visual:** Cut to a simple title card (you can build this as a 1920×1080 PNG in Keynote or a browser bookmark; black background, white text):

```
SWS Proof of Attention
Ed25519-signed · Bitcoin-anchored · offline-verifiable

Pilot your next IME module:
stephenfurpahs@gmail.com
sws-attention-proofs.web.app

Patent Pending SWS-PROV-001
```

**Narration:**
> "Proof of Attention. Inspectable offline. Pilot your next accredited activity with us."

---

## Shot list summary

| Cue | Start | End | Duration | Source |
|---|---|---|---|---|
| 1. LMS green-check hook | 00:00 | 00:10 | 10 s | Tab 4 screenshot |
| 2. demo.html welcome + phases | 00:10 | 00:35 | 25 s | Tab 1 live |
| 3. Frozen results grid | 00:35 | 00:55 | 20 s | Pre-recorded still |
| 4. verify.html green check | 00:55 | 01:20 | 25 s | Tab 2 live |
| 5. Close card | 01:20 | 01:30 | 10 s | Static image |

---

## Recording sequence (do in this order)

1. **Voice-only pass (5 min).** Record the narration alone, three takes, pick the cleanest. Save as `narration.wav`. No visuals yet — this lets you nail pacing before you coordinate clicks.
2. **Visual-only pass (10 min).** Screen-record the click sequence silently, following the timings above. Use the narration in headphones as timing reference, but don't capture audio on this pass. Three takes.
3. **Compose in iMovie / Final Cut / DaVinci (30 min).** Lay the narration audio under the visual track. Nudge visual cuts to land on sentence boundaries. Add the close card PNG.
4. **Export 1080p H.264.** Target under 40 MB (YouTube + Gmail attachment friendly).
5. **Upload to YouTube unlisted.** Copy link. Test in incognito — if the page is blocked without login, change the privacy setting.

---

## What NOT to say in the video

These claims overreach your evidence. Do not include them even if tempted:

- **Do not say "detects bots."** Your bot-vs-human composite gap is only 0.09. The pitch is that the *receipt carries layered evidence* (environmental + honeypot + composition), not that any single score separates bot from human. If a viewer asks about bot detection, route them to `SEVEN_LAYER_DEEP_DIVE.md` §10.
- **Do not say "GDPR compliant."** You have a *GDPR-aligned consent attestation*. Compliance is a legal determination you are not empowered to make.
- **Do not say "the only."** You are not the only cryptographically-signed credential system; you are *uniquely* the behavioral-receipts-as-VC system. Keep it specific.
- **Do not use the words "AI" or "machine learning."** The product is deterministic behavioral measurement + cryptographic signing. Saying AI invites the wrong category of question.
- **Do not mention the composite score as a bot classifier.** Score *plus* environmental *plus* honeypot *plus* composition is the layered judgment. One number alone is not the claim.

---

## Post-production checklist

- [ ] Length is 90 ± 5 seconds
- [ ] Narration is clearly audible over any cursor/click sounds
- [ ] Green-check verify banner is on screen for at least 2 full seconds
- [ ] Close card includes: stephenfurpahs@gmail.com, sws-attention-proofs.web.app, patent reference
- [ ] Uploaded to YouTube *unlisted* (not private, not public)
- [ ] Link tested in incognito window — loads without login
- [ ] Link pasted into `docs/cold-email-templates.md` under a new "video" section

---

## How the video integrates with the cold-email templates

Add **one line** to each of Templates A, B, and C, right above the "One ask" paragraph:

> 90-second demo, no sign-up required: [YouTube link]

No more than one line. The video earns the click because it's short and the email earned the open because it's specific. Stacking them both makes the pitch feel effortless to evaluate — which is the buyer ask.

---

**Last updated:** 2026-04-21 · drafted alongside the audit-hardening + playbook sprint.
**Recording status:** not yet recorded. Blocking signal: playbook must pass first.
