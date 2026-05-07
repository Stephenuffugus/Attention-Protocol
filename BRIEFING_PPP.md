**This is the version to actually send.** The full reasoning, alternative subject lines, alternative body lengths, and reply-decision-tree live in `01-ppp.md`. This file is the locked-in copy you paste into Gmail and personalize in two places.


---


## Two things you have to do before sending


1. **Find the human.** Open LinkedIn → search `Physicians Postgraduate Press` → People tab → filter for **Director of Accreditation** or **Director of CME** or **Director of Outcomes**. If none, check the J Clinical Psychiatry masthead at https://www.psychiatrist.com — accreditation contacts are often listed there. **Tenure ≥2 years, active profile, not a placeholder.** Verify the email pattern by visiting their company site.


2. **Replace `[FIRST NAME]` in the body.** That is the only personalization needed.


If you cannot verify the right person at PPP, **do not send.** Cold-emailing the wrong human burns the account and you cannot send a second cold to PPP for ~6 months. Move to CEC instead (draft coming once we lock this one).


---


## Subject line (locked)


```
Customer development — psychiatry-CME measurement question
```


## Body (locked)


```
[FIRST NAME],


I built a cryptographically-signed receipt that proves a real human engaged with a CME activity — auditor-verifiable offline, no PII collected, no content stored, no URLs tracked. Patent filed 2026-03-17. Solo founder, doing customer development before pitching anyone.


Reaching out to PPP because psychiatry is the one specialty where "did the learner actually engage" is clinically meaningful, not just compliance. Your next ADHD or MDD IME proposal's "measurement of learner progression" line is being scored harder by Otsuka and AbbVie than it was two years ago — I'd value your read on what's actually credible there.


20 minutes. You teach me what grantors are pushing on. I'm not selling. If my product matches your problem we discuss what a free pilot looks like; if not, I leave with a sharper pitch.


Live demo: https://sws-attention-proofs.web.app/cme-demo.html
Public verifier: https://sws-attention-proofs.web.app/verify.html


— Stephen Furpahs
SWS Strategic Media LLC · Patent SWS-PROV-001
```


---


## Send-day checklist


- [ ] LinkedIn person verified (name, title, tenure ≥2y, active profile)
- [ ] Email address confirmed via company site domain pattern
- [ ] `[FIRST NAME]` replaced in body
- [ ] Subject line copied exactly
- [ ] Send between **9:00 AM and 11:00 AM ET** (PPP is Memphis / Central, this is their morning inbox window)
- [ ] **Day:** Tuesday, Wednesday, or Thursday only. Not Monday (inbox overload), not Friday (weekend wipe), not weekends.


## After you send — same day, before you go to bed


1. **Add to tracker** — log it somewhere durable (a file, a spreadsheet, even a Note):
  ```
  2026-05-05 — PPP — [name] — sent: [date]
               hardest expected question: "are you SOC 2?"
               follow-up due: [send-date + 7 days]
               reply: pending
  ```


2. **Mark calendar** for the 7-day bump. If no reply by then, send the one-line bump from `01-ppp.md §6A`.


3. **Walk away from the inbox.** Refreshing changes nothing. The reply will come or it will not.


## When (not if) they reply


Three reply paths, all mapped in `01-ppp.md §6` — the locked answers are there. Read it before responding to anything.


- **"Send me materials first"** → the four artifacts (architecture 1-pager, DPIA, sub-processor list, security questionnaire pre-fill). Three of those still need writing — flagged in `OUTREACH_PLAY.md §3` artifact checklist. **Reply same-day even if the artifacts aren't ready** with: *"Will have those over to you by [end of week]."* Then write them.


- **"Let's talk"** → reply within 4 hours, propose 3 specific 30-min slots. Pre-call ritual in `01-ppp.md §6C`.


- **"Wrong person"** or **"not interested"** → ask for the right person at PPP, or move on.


## What is true the moment you send this


The email is honest. The protocol exists. The patent is filed. The demo is live. The verifier works. The 12 questions in `OUTREACH_PLAY §5` have honest answers pre-written. Everything you need to survive the worst-case 20-minute call is in this repo.


The only thing standing between you and the customer-development conversation is hitting send.


---


**Status:** READY TO SEND as of 2026-05-05.



# Discovery Call Briefing: Physicians Postgraduate Press (PPP)
**Practice round 1. Phone-readable. Read 5 min before the call.**

---

## Who they are (30 seconds)

- Specialty psychiatry MEC + journal publisher
- Publishes the **Journal of Clinical Psychiatry** (their flagship)
- Independent (not publisher-owned, not PE-rolled)
- Smallest team on your Top 10 list; founder-era leadership style
- ABPN audience: psychiatrists doing maintenance-of-certification
- Web: psychiatrist.com (primary domain)

## Who you're targeting

**Director of Accreditation** or **Director of CME Outcomes** (verify on LinkedIn before sending). Boutique enough that the title may also map to "VP of Education" or just "President."

If you can find the founder/president on LinkedIn, the founder is also a viable contact at this size of org.

## Why PPP first

- Smallest team on the list = lighter vendor review
- Specialty-relevance angle: in psychiatry, "did the learner engage" is *clinically* interesting, not just compliance
- Lowest cost if you botch the open. This is the practice round where you find out which words land and which don't.

## Send-ready email

Already drafted at: `outreach-drafts/01-ppp-SEND-THIS.md`

Open that file from your phone before sending Tuesday May 13.

## The hook (memorize this sentence)

> *"Psychiatry is the one specialty where 'did the learner actually engage' is a clinically meaningful question, not just a compliance one. And your next ADHD or MDD IME proposal needs a concrete answer to it."*

That sentence does the work. It signals you understand their specialty. It connects engagement-measurement to clinical relevance, not just rubric compliance.

## The first-meeting ask

> *"Walk me through how you currently fill the 'measurement of learner progression' section of an Otsuka or AbbVie psychiatry IME proposal. And what would have to be true for you to test a receipt on one accredited activity?"*

That's the question. Two parts. Get them talking about their current language first. Then ask the contingent question second.

## The hardest question they will ask

**Q: "How do we explain this to our auditor / how does this look to ABPN?"**

Honest answer:

> *"One paragraph. The receipt is Ed25519-signed, Bitcoin-anchored via OpenTimestamps, verifiable offline against our published JWK. Your auditor pastes the JWT into our verifier or runs scripts/verify-receipt.js locally. No vendor call, no subpoena. I have a 21 CFR Part 11 clause-by-clause matrix I'll send you. ABPN doesn't have a position on cryptographic attestation yet, but the integrity story you can tell their surveyors is stronger than 'click-through completion.'"*

Bridge phrase:

> *"Has ABPN said anything yet about learner integrity in AI-augmented post-tests? I'd love your read on regulatory posture."*

## The risk to watch for

**Sounding like behavioral surveillance to a privacy-skeptical psychiatry audience.** Lead with no-PII, no-content, no-URLs in the first 60 seconds.

If they raise privacy concerns, the line is:

> *"Zero PII collected. Zero content stored. Zero URLs logged. The receipt is behavioral metrics (pacing, scroll patterns, keystroke timing) plus a signature. The JWT can live entirely in your tenant. Our infra is the public verifier and the JWKS endpoint. Nothing else leaves your environment."*

## Never-say in this call

- "Most of your competitors..." (PPP is small; comparison reads as condescending)
- "We're 99% accurate" (you don't know yet on a real population)
- "AI is the threat" (PPP audience is ABPN-MOC physicians; the threat is AI-assisted post-tests, not "AI" the abstract concept)

## Always-say in this call

- "Specialty-relevance is what made me email you first" (acknowledges their fit)
- "I won't pretend I'm at a stage I'm not" (when SOC 2 / entity / runway questions come up)
- "What would you need to see in the first two weeks of a 60-day pilot to know it was worth the next two weeks?" (ends the call with a concrete next-action question)

## The 60-day pilot ask (for end of call, only if they're warm)

- 1 accredited activity
- ≤5,000 learner-sessions
- 60 days
- Free for them; you get a co-authored case study and a frank post-mortem
- One script tag in the activity-template HTML
- No backend changes during pilot
- Their QA team self-verifies every receipt

## After the call

Per OUTREACH_PLAY.md section 8 (post-call discipline):

- Min 0-5: capture verbatim notes
- Min 5-10: extract three deltas (what changed about the product or pitch)
- Min 10-20: draft the follow-up email (subject + body match what they asked for, plus ONE line acknowledging what they taught you, no calendar link, no pilot CTA)
- Min 20-25: log the call (date, role, hardest question, next-action commitment, due date)
- Min 25-30: walk away from the desk. Do NOT call the next prospect. You're amped; you'll mis-pitch.

If they asked you to send something (compliance matrix, AI-integrity one-pager, evidence kit), put it on Friday's calendar TODAY.
