# TRACK C — REAL-WORLD TESTING + MULTI-VERTICAL OUTREACH
## For: Stephen Furpahs, Director
## Goal: 50+ real human sessions in 10 days, including warm buyer conversations in 4 verticals
## Depends on: DEPLOY_FIRESTORE_NOW.md verification passing (10 minutes)

---

## THE STRATEGY

You're not picking one vertical. You're running a 4-vertical blitz — sending the demo to contacts in each industry and letting the RESPONSE RATE tell you which vertical to double down on. Whoever replies first gets your attention. Whoever ghosts gets deprioritized.

**The four verticals (in order of your personal edge):**

| Vertical | Your edge | Demo pitch hook |
|---|---|---|
| **Restaurants** | Years of direct industry experience — you speak their language | "Prove your staff actually watched the training video, not just clicked play" |
| **Market research panels** | Fastest to cash, every panel operator knows they have bots | "Cryptographic receipt proving your panelist was actually reading the survey" |
| **Nursing home monitoring** | Personal passion, volunteered, authentic story | "Tamper-evident proof a staff member was actively monitoring a resident's screen" |
| **Corporate training / LMS** | Compliance hook is universal, many small vendors | "Prove your employees completed training with genuine attention, not just tab-idling" |

---

## THE DEMO LINK (already live)

**Base URL:** `https://sws-attention-proofs.web.app/demo.html`

**Tagged URLs by audience:**

| Audience | Link to send |
|---|---|
| Friends & family | `https://sws-attention-proofs.web.app/demo.html?source=beta_ff` |
| Restaurant contacts | `https://sws-attention-proofs.web.app/demo.html?source=pilot_restaurant` |
| Market research contacts | `https://sws-attention-proofs.web.app/demo.html?source=pilot_mktres` |
| Nursing home contacts | `https://sws-attention-proofs.web.app/demo.html?source=pilot_nursing` |
| Training/LMS contacts | `https://sws-attention-proofs.web.app/demo.html?source=pilot_training` |
| Your own dev testing | `https://sws-attention-proofs.web.app/demo.html?source=dev` |

Every session automatically tagged in Firestore. No mixing. Clean data per vertical.

---

## 10-DAY SCHEDULE

### Days 1-2: Verification + Inner Circle

**Day 1 — Verify and seed**
- [ ] Complete `DEPLOY_FIRESTORE_NOW.md` (10 min)
- [ ] Open demo on your phone with `?source=dev`, interact for 2 min, check Firestore
- [ ] Text 3-5 closest people (spouse, sibling, best friend) the `?source=beta_ff` link
- [ ] Watch their sessions land in Firestore in real time
- [ ] If anything looks wrong, STOP and come to the Codespace

**Day 2 — Expand inner circle**
- [ ] Text 5-10 more friends/family the `?source=beta_ff` link
- [ ] Quick Firestore check: how many documents in `demos/`? All have signals + quality tiers?

### Days 3-5: Vertical Outreach Begins

**Day 3 — Restaurants (your strongest edge)**
- [ ] Make a list of 10 restaurant contacts: managers, owners, training directors, franchise operators, anyone in food service you've worked with or know personally
- [ ] Text/email 5 of them using **Message Template R** below
- [ ] Send the `?source=pilot_restaurant` link

**Day 4 — Market research**
- [ ] Google "market research panel companies" — find 10 companies with public contact info
- [ ] Email 5 using **Message Template M** below
- [ ] Send the `?source=pilot_mktres` link

**Day 5 — Nursing homes + training**
- [ ] Reach out to 5 nursing home/eldercare contacts using **Message Template N**
- [ ] Reach out to 5 training/HR/LMS contacts using **Message Template T**

### Days 6-8: Follow-up + Expand

**Day 6 — Midpoint check-in**
- [ ] Come to the Codespace with your numbers: total sessions, sessions by source_type, any replies or conversations started
- [ ] I'll pull a data report from Firestore and we'll adjust the plan based on what's working
- [ ] Send gentle follow-ups to anyone who didn't respond in Days 3-5

**Days 7-8 — Double down on responses**
- [ ] Whoever replied → schedule a 15-minute call. That call is your first "pilot conversation."
- [ ] Whoever ghosted → one more nudge, then move on
- [ ] Send second batch of 5 to each responsive vertical

### Days 9-10: Harvest + YC Update

**Day 9** — Final push: send to any remaining contacts you haven't reached
**Day 10** — Come to the Codespace with:
- [ ] Total session count
- [ ] Sessions by source_type breakdown
- [ ] Any conversations or pilot interest
- [ ] I'll generate a data export and we'll update the YC application with real numbers

---

## MESSAGE TEMPLATES

### Template R — Restaurant Industry

> Hey [name] — I know you're in the restaurant world and I built something I think you'd find interesting. It's a tool that proves whether someone actually watched a training video or just clicked play and walked away. Works with any screen — POS training, food safety videos, onboarding modules.
>
> Would you take 2 minutes to try the live demo? Just open this link, scroll through it, interact a bit. No signup, no personal info. I'm collecting real sessions to show potential customers.
>
> [LINK with ?source=pilot_restaurant]
>
> If you know anyone in restaurant operations or training who might want this, I'd love an intro. Thanks!

### Template M — Market Research

> Hi — I built a protocol that generates cryptographic proof of whether a survey respondent was actually paying attention or just clicking through. One JavaScript tag, works with any web-based survey or panel tool.
>
> I know bot traffic and inattentive respondents are a huge data quality problem in market research. This is a new approach: instead of attention checks or CAPTCHAs, we measure six behavioral signals (timing patterns, cursor physics, scroll behavior) and produce a tamper-evident receipt with a quality tier.
>
> Would you take 2 minutes to try the live demo? No signup, no PII collected.
>
> [LINK with ?source=pilot_mktres]
>
> I have a patent filed on the protocol and I'm looking for 2-3 market research partners to pilot with. Happy to jump on a 15-minute call if this is interesting.

### Template N — Nursing Home / Eldercare

> Hi [name] — I've spent time volunteering in nursing homes and I've seen firsthand how hard it is to prove that monitoring is actually happening. I built a protocol that generates tamper-evident cryptographic receipts proving a staff member was actively watching a resident's monitoring screen — not just signed in, but actually paying attention.
>
> It works with any web-based monitoring dashboard. One JavaScript tag. No cameras, no personal data. Just behavioral proof of attention with quality tiers (deep focus vs. passive vs. background).
>
> Would you try the 2-minute demo? I'm collecting real sessions for a patent attorney briefing.
>
> [LINK with ?source=pilot_nursing]
>
> When CMS audits ask for proof of monitoring, this is the answer. Happy to explain more on a quick call.

### Template T — Corporate Training / LMS

> Hi — I built a tool that proves whether an employee actually completed a training module with genuine attention, or just left the tab open in the background. Works with any web-based LMS or training platform. One JavaScript tag.
>
> Instead of quiz-based attention checks, it measures six behavioral signals in real time and produces a cryptographic receipt with a quality tier. Deep Focus means they were reading. Background means they weren't.
>
> 2-minute demo, no signup: [LINK with ?source=pilot_training]
>
> I have a patent filed and I'm looking for 2-3 training platform partners to pilot. Let me know if you'd like to talk.

---

## WHAT TO WATCH IN FIRESTORE

### Quick check (do daily)
1. Firebase Console → **sws-attention-proofs** → **Firestore Database** → **Data**
2. Click **`demos`** collection
3. Count documents → that's your total sessions
4. Look at `source_type` field on recent documents → that's your per-vertical count

### Three things to check per session

| Check | Good | Investigate |
|---|---|---|
| **signals.composite** | 0.3 - 0.9 range | All exactly 0 (signal collection broken) |
| **quality_tier** | Mix of deep/active/passive | All background (possible bot or broken) |
| **source_type** | Matches the link you sent | Missing or wrong (URL param not working) |

### If a pattern looks wrong
Stop sending links. Come to the Codespace. Paste what you see. Don't keep collecting garbage data — it's worse than no data.

---

## SUCCESS CRITERIA AT DAY 10

- [ ] **30+ sessions from friends/family** (`source_type: beta_ff`)
- [ ] **5+ sessions from each vertical** you reached out to (`pilot_restaurant`, `pilot_mktres`, etc.)
- [ ] **At least 1 reply or conversation** from a vertical contact (this is the most important metric)
- [ ] **Quality tier distribution** that looks human: 10-30% deep, 40-60% active, 10-30% passive
- [ ] **At least 4 different device/browser combos** represented
- [ ] **A real number** to put in the YC application

---

## THE RESTAURANT ANGLE — WHY IT'S SMARTER THAN IT SOUNDS

Most attention verification companies are chasing ad tech or financial services. Nobody is pitching restaurants. That's a feature, not a bug:

1. **No incumbent.** Nobody sells "attention verification" to restaurant chains. The training compliance market uses quiz-based checks that everyone cheats.
2. **You speak the language.** You've worked in the industry. You know what a franchise training manager cares about. That domain credibility is something no SDK startup can replicate.
3. **The pain is real and specific.** Food safety training, sexual harassment training, OSHA compliance — all web-based, all "click through and you're done," all legally risky when the training wasn't actually completed.
4. **Fast buyer cycles.** Restaurant groups make decisions faster than insurance companies or defense contractors. A franchise training director can say yes to a $500/month pilot in one meeting.
5. **Proof of concept transfers.** Once you have "we proved staff actually watched the food safety video" in restaurants, you walk that same story into healthcare training, manufacturing safety, financial compliance — every regulated industry with mandatory training.

**This might be where you start.** Not because it's the biggest market, but because it's where YOUR edge is sharpest and the buyer cycle is shortest. Market research is the backup if restaurants don't bite.

---

## AFTER DAY 10

Based on what the data and responses tell us:

1. **Vertical that responded** → schedule pilot calls, draft pilot agreements, set pricing
2. **Adversarial test** → hire Upwork freelancer to try to break the protocol ($200)
3. **YC application** → update user count, lock the draft, record founder video
4. **30-day dual-tracked dataset** → stevieweedseed.com Hostinger deploy (the original `focus-grove-fffa8` task), which starts the GA4 vs SWS comparison clock

---

*Prepared by the SWS Attention Protocol Engineering Team*
*Date: 2026-04-12*
*Strategy: 4-vertical blitz, let response rate pick the winner*
