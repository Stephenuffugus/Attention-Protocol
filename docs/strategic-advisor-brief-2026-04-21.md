# Strategic Advisor Brief — 2026-04-21
## External outside-read commissioned to cross-check Stephen's plan

**Context:** Stephen asked for a senior product + GTM director's read on the current state of SWS Proof of Attention. This doc captures the advisor's brief verbatim so it doesn't get buried in conversation history. Stephen then applied his own judgment and chose a learning-first path over the advisor's "send 5 emails tonight" recommendation (see §5 at the bottom).

---

## 1. The advisor's "next 2 hours" answer

> "**Stop building. Open a browser, run Phases 1 and 2 of `PRODUCT_VALIDATION_PLAYBOOK.md` on the live site, then do the LinkedIn pass on the top 5 dossiers (Pfizer, Medscape, PlatformQ Health, DKBmed, Credly).** 30 minutes of playbook + 25 minutes of LinkedIn + 5 minutes of honest self-assessment = one usable prospect list and confirmed pitch-readiness. You cannot ship another feature until you have looked at your own product through a buyer's eyes in a browser and named five real humans to email."

## 2. The advisor's 10-step ordering

1. **Playbook browser run** (30 min, Stephen) — confirms the product works with his own eyes
2. **LinkedIn-verify top 5 dossiers only** (25 min, Stephen) — Pfizer, Medscape, PlatformQ Health, DKBmed, Credly. Real names. Not all 20.
3. **Send corpus invites to 8–10 humans tonight** (15 min, Stephen + templates) — 48h background collection starts immediately
4. **Personalize + send 5 cold emails tomorrow morning** (60 min, Stephen + AI drafting)
5. **Record the 90-second CME demo video** (3–4 hrs, Stephen) — only after (1)–(4); useless without a name to send it to
6. **Download Bogazici dataset** (5 min, Stephen, AI builds loader) — cheapest unblock on the board
7. **Signing-key rotation cutover** (15 min, Stephen) — InfoSec review hygiene
8. **Send the next 15 cold emails in two waves over 4–5 days** (2–3 hrs, Stephen) — staggered for signal
9. **Book any reply into a 20-min call within 48h** — the reply is the product
10. **Only after a real buyer conversation — lock the YC S26 application** (2–3 hrs) — "in conversation with X" makes the app 10× stronger

## 3. Distractions the advisor says to drop

- **LLM-in-the-loop bot harness** (blocked on Anthropic) — "engineering polish a buyer will never ask about"
- **Balabit recalibration** — "defense-in-depth story is BETTER than a single clean number. Stop trying to make pure behavioral carry the pitch alone." 10–15 hrs saved.
- **Batch-verifying all 20 LinkedIns before sending any email** — "procrastination dressed as prep. 5 verified + 5 sent beats 20 verified + 0 sent."
- **More tests, fixtures, documentation** — "product is over-documented relative to zero paid pilots"
- **Pre-unblocking deploy infrastructure** (Firebase Blaze, Cloud Run, Hostinger) — "don't pre-spend on infra for buyers who haven't said yes"

## 4. Gaps the advisor flagged

1. **No pricing.** Every template says "free pilot." Zero answer ready for "what does this cost at scale." Draft three price points (per-credential / per-seat-month / flat platform fee) this week.
2. **No pilot success-criteria document.** What's a "successful 60-day pilot" — 5 metrics agreed at kickoff. Without this, a pilot runs 60 days and produces no case study, no LOI, no reference.
3. **No revenue runway calibration date.** Memory says "financial situation is tight" but the plan has no "if nothing closes by date X, I do Y." Operational decision; write it down.
4. **No LOI template.** One-page non-binding letter of intent for when a buyer says "yes but procurement is slow." Lets Stephen put "LOIs signed with X" in the YC app.
5. **No warm-intro path.** 20 cold emails produce 1–3 replies at industry benchmark. A single warm intro from Stephen's personal network > all 20. Spend one hour making that list.
6. **Entity formalization.** SWS Strategic Media LLC is named but "not incorporated formally" per memory. Pharma procurement won't contract with a non-entity. Two hours with a LegalZoom-equivalent in the next two weeks.

## 5. The advisor's "honest business question"

> "**What's the real reason you haven't sent a single cold email yet?** You have the templates. You have the dossiers. You have the evidence kit. You have the deep dive. You have 754 tests, a live site, a signed receipt, a patent, and an AI-honesty cheat card. You have every artifact a solo founder could reasonably build before outreach — and several that most wouldn't build at all."
>
> "What you don't have is a single reply from a real buyer. And the plan keeps finding one more thing to polish before that reply becomes possible. The demo video. The behavioral recalibration. The Balabit dataset. The LLM-in-the-loop harness. Another round of FAQ edits."
>
> "Pitching is the part where the AI can't help you. It's the part where you find out whether the thing is real. **Send the five emails. Then build whatever they tell you is missing.**"

---

## 6. Stephen's response to the advisor (captured verbatim)

> "i havent wanted to send anything or start pitching because i legit have no idea how to apply this, how a busoiness will use it, i dont even know the businesses your recommending so i have a ton of learning to do which is fine but i cant go pitching a company if i dont know it works fantastically or even how it works"

## 7. The reconciled path Stephen chose — learning-first

The advisor read the situation as avoidance. Stephen's honest self-assessment is different: he does not yet understand the buyer's business well enough to survive a pitch call, and pitching before understanding burns leads permanently. That is a rigorous decision, not procrastination.

**The reconciled priority: 4-part learning arc before any email goes out.**

1. **Touch the product** — run the playbook in a browser (30 min)
2. **Business use-case primer** — `docs/buyer-use-cases.md`: "day in the life" of a Pfizer GxP training admin, a Medscape accreditation lead, and a Credly product manager using SWS (~60 min Claude produces + 30 min Stephen reads)
3. **Prospect primer** — `docs/prospect-primers.md`: one page per top-5 company covering what they do, how they make money, their #1 pain point, who in their org cares, what's on their 2026 roadmap that SWS fits (~60 min Claude produces + 30 min Stephen reads)
4. **Mock pitch drill** — Claude role-plays a Director of QA Systems at Pfizer; Stephen pitches; Claude asks the hard questions; iterate on weak spots (~30 min interactive)

After Part 4, if Stephen feels solid, we draft the first 5 emails together. If not, we do more drills before any email.

**The advisor's gaps (pricing, pilot criteria, runway date, LOI template, warm-intro path, entity formalization) get addressed inside this arc** — the business use-case primer forces us to name pricing; the prospect primer forces us to name warm-intro paths; the mock drill surfaces where pricing / LOI / entity questions hit us hardest.

---

**Last updated:** 2026-04-21 evening.
**Next update:** after Part 1 (playbook in browser) + Part 2 (buyer use cases) land tomorrow.
