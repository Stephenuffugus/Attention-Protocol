# Portfolio Weekend Drafts
**Stephen Furpahs / for execution Saturday-Sunday May 10-11, 2026**

Everything you need for Phase 1 (the portfolio weekend) is in this file. Copy, paste, edit. All assets are written assuming Ohio + Eastern Time + flexible hours + the real shipping receipts you have.

Order to execute:
1. Buy stephenfurpahs.com (5 min, do today)
2. Landing page (4 hours Saturday)
3. Resume PDF (1 hour Saturday)
4. Twitter bio + pinned thread (1 hour Saturday)
5. GitHub repo public + redacted (30 min Sunday)
6. Three 90-second demo videos (2 hours Sunday)

---

## ASSET A: Landing page copy (stephenfurpahs.com)

Use Astro, Next.js, or plain HTML. Don't perfect. Ship it. Below is the copy block, ready to paste into whatever scaffold you pick.

### Hero block

> # Solo dev. Two production products and a revenue site shipped in 60 days.
>
> Patent-filed cryptographic SaaS (YC S26 applicant). 96k-line Pi Network game submitting to Pi App Studio this week. A working affiliate-revenue site that earns despite rough edges. AI-multiplier velocity, honestly applied. Open to senior IC or founding-engineer roles, fully remote.
>
> [View the work] [Email] [GitHub] [X]

### About block (one paragraph, under the hero)

> I'm a solo developer based in Ohio (Eastern Time, flexible hours). For the last two months I've been shipping production software at a velocity that would have been impossible without modern AI tooling. Claude Code is roughly 60% of my coding throughput. I write or review every line of architecture. The output is real: a patent-filed cryptographic protocol, a fully-built Pi Network ecosystem game, and several smaller systems built on top of those. I'm explicit about the AI-augmented workflow because hiding it would be lying about how I actually work, and the work speaks for itself either way.

### Projects grid

Build three primary cards (the things that actually function and earn) plus an "Active prototypes" section if you want to show breadth. Each primary card has: screenshot, one-sentence hook, outcome line, tech-stack tags, and link. Don't pad with bones, padding gets caught in the second interview question.

**Card 1: Lucid Winds**
- *Hook:* A 96k-line single-file game living on Pi Network, with a server-validated economy and procedural one-of-one generative plants.
- *Outcome:* Submitted to Pi App Studio May 9, 2026. Live at lucidwinds.com.
- *Stack:* Vanilla JS, Firebase, Cloud Functions, Pi SDK, Polygon NFT primitives.
- *Link:* lucidwinds.com

**Card 2: SWS Attention Protocol**
- *Hook:* A cryptographic system that issues signed receipts proving a real human (not a bot, not a GPT) actually paid attention to a screen.
- *Outcome:* Patent filed March 17, 2026 (USPTO SWS-PROV-001). Submitted to YC Summer 2026. 270+ tests across 45 suites, all green. Production verifier live in any browser.
- *Stack:* Firebase, Cloud Functions, Ed25519, JWKS, OpenTimestamps Bitcoin anchoring, 23 behavioral signals from peer-reviewed cognitive science.
- *Link:* sws-attention-proofs.web.app/demo.html

**Card 3: stevieweedseed.com (revenue-generating affiliate site)**
- *Hook:* A live affiliate-revenue site that's rough around the edges and still earns.
- *Outcome:* Generates real affiliate income on autopilot. Plenty of room to harden.
- *Stack:* [your stack here, Hostinger / static site / WordPress / etc., fill in]
- *Link:* stevieweedseed.com

**(Optional) Active prototypes section, below the three primary cards:**

> *Beyond the three above, I'm actively exploring several adjacent ideas: [list 3 to 5 short prototype names with one-line descriptions of the experiment, no overclaiming about production status]. Some will become products; some won't. The two-product portfolio above is what I can actually defend in an interview.*

This block does the work the "10 projects" line was trying to do (signal breadth and curiosity) without the credibility hit of claiming production status for things that aren't there yet.

### "How I work" block (footer-ish, before contact)

> I ship fast. I document everything. I use Claude Code, Cursor, GPT-4, and Gemini as power tools and I'm explicit about that with every employer. I won't sign non-competes that touch attention measurement, fraud detection, credentialing, or training compliance (I have my own thing in flight there). Floor rate is $140K base for a full-time role. Open to fractional consulting at $100 to $200/hr.

### Contact block

> Email: stephenfurpahs@gmail.com
> GitHub: github.com/[your handle]
> X: x.com/[your handle]
> LinkedIn: linkedin.com/in/[your handle]

### One-liner CSS hint

If you use plain HTML, set `font-family: -apple-system, BlinkMacSystemFont, sans-serif`, `line-height: 1.6`, `max-width: 720px`, dark background `#0a0e17`, text `#e2e8f0`, accent cyan `#06b6d4`. Match your existing SWS site visual style for consistency. Reuse the CSS variables from `/proof/index.html` if you want a 30-minute build.

---

## ASSET B: Three 90-second demo video scripts

No voiceover needed. Just screen capture with text overlays. Loom or QuickTime or OBS, whatever's installed.

Format for each: 0-30s hero feature, 30-60s technical depth, 60-90s stack and outcome.

### Video 1: Lucid Winds (90 seconds)

**0-15s. Cold open.**
- Open lucidwinds.com on phone or browser.
- Text overlay: *"Lucid Winds. A game on Pi Network. 96k lines of code. Solo dev, 6 weeks."*

**15-30s. Hero feature.**
- Play through one round. Show a procedurally-generated plant being earned.
- Text overlay: *"Every plant is one of one. Server-validated. NFT-anchored on Polygon."*

**30-60s. Technical depth.**
- Cut to code editor. Open the single-file architecture.
- Scroll through it visibly. Highlight the server-validation flow with a comment.
- Text overlay at 45s: *"Single-file architecture. Pi SDK + Polygon voucher signer. No backend bloat."*

**60-90s. Stack and outcome.**
- Cut to a stack list visual: Vanilla JS / Firebase / Cloud Functions / Pi SDK / Polygon.
- Text overlay: *"Submitted to Pi App Studio May 9, 2026. Live at lucidwinds.com."*
- End frame: domain + email + GitHub link.

### Video 2: SWS Attention Protocol (90 seconds)

**0-15s. Cold open.**
- Phone screen. Open sws-attention-proofs.web.app/demo.html.
- Text overlay: *"SWS Attention Protocol. Cryptographic proof a real human paid attention."*

**15-30s. Hero feature.**
- Take the demo on the phone. Speed up the recording. Show the result screen with a composite score and quality tier badge.
- Text overlay: *"23 behavioral signals. Ed25519 signature. Bitcoin anchor. Verifiable offline."*

**30-60s. Technical depth.**
- Cut to the verifier page. Paste a JWT. Show all 7 cards turn green.
- Text overlay at 45s: *"Patent filed March 17, 2026. USPTO SWS-PROV-001. YC Summer 2026 applicant."*

**60-90s. Stack and outcome.**
- Stack visual: Firebase + Cloud Functions + Ed25519 + JWKS + OpenTimestamps + 270+ tests.
- Text overlay: *"7 rounds of hostile review. ~85 findings closed. Attacker bypass cost shifted from $50/mo to $5-20k/mo."*
- End frame: sws-attention-proofs.web.app / email / GitHub.

### Video 3: [Pick your strongest third project]

If you don't have an obvious third, use something distinctive from one of the two above. For example, the **Bitcoin-anchoring + JWKS rotation infrastructure** for SWS is its own demo-worthy system. So is the **multi-agent hardening cycle** that ran 7 rounds of adversarial review.

**Default if nothing else jumps out: "How I run Claude Code in production"**

This one is meta but lands hard with AI-tools companies. It shows your actual process.

**0-15s. Cold open.**
- Screen capture of your Claude Code terminal session.
- Text overlay: *"How I shipped a patent-filed cryptographic SaaS in 60 days, solo."*

**15-30s. Hero.**
- Show parallel agent panes. 4 to 10 agents running simultaneously on different tasks.
- Text overlay: *"Multi-agent orchestration as baseline workflow. 21 commits in a single day."*

**30-60s. Depth.**
- Show the moment one agent surfaces a fix and you review it before merging.
- Text overlay at 45s: *"I write or review every line of architecture. AI does the keystroke-level work. The judgment is mine."*

**60-90s. Stack and outcome.**
- Visual: Claude Code / Cursor / GPT / Gemini logos. Then SWS demo URL.
- Text overlay: *"Output: working production cryptographic SaaS. Patent filed. YC submitted. Available for senior IC or founding-engineer roles."*
- End frame: stephenfurpahs.com / email.

---

## ASSET C: One-page PDF resume

Use Notion or Google Docs to format. Export to PDF. Six sentences max. Don't pad.

```
STEPHEN FURPAHS
Solo Developer / AI-Augmented Builder
Ohio, USA (Eastern Time, flexible hours) / stephenfurpahs@gmail.com / stephenfurpahs.com / github.com/[handle]


PROFILE

Solo developer based in the United States. I build complex production systems quickly using
Claude Code as roughly 60% of my coding velocity, and I write or review every line of
architecture myself. The work output is real: a patent-filed cryptographic protocol, a Pi
Network ecosystem game, and several smaller systems built on top of those. I'm looking for a
senior IC or founding-engineer role, fully remote, $140-200K base + equity.


SHIPPED IN THE LAST 60 DAYS

Lucid Winds (96k lines, single file). A Pi Network ecosystem game with a server-validated
economy and procedural one-of-one generative plants. Stack: Vanilla JS, Firebase, Cloud
Functions, Pi SDK, Polygon NFT primitives. Submitted to Pi App Studio May 9, 2026.

SWS Attention Protocol (patent-pending). A cryptographic system that issues signed receipts
proving a real human paid attention to a screen, verifiable offline against a public JWK.
Stack: Firebase, Cloud Functions, Ed25519, JWKS rotation, OpenTimestamps Bitcoin anchoring,
23 peer-reviewed behavioral signals. Patent filed March 17, 2026 (USPTO SWS-PROV-001). YC
Summer 2026 applicant. 270+ tests across 45 suites, all green. 7 rounds of hostile adversarial
review survived; ~85 findings closed; attacker bypass cost shifted from ~$50/mo to $5-20k/mo.

stevieweedseed.com. A live affiliate-revenue website that earns despite rough edges. Real
income, real users, real revenue mechanics. Stack: [fill in].

(Plus active prototypes across several adjacent ideas. The three above are what I can defend
in detail.)


HOW I WORK

Multi-agent AI orchestration as baseline workflow. 21 commits in a single day on a complex
day. Honest about AI-augmented velocity in every interview, code review, and contract.
Comfortable across the full stack from Firebase security rules to client-side cryptography to
production CI/CD. Will not sign non-competes touching attention measurement, fraud detection,
credentialing, or training compliance.


WHAT I'M LOOKING FOR

Senior IC or founding-engineer role at an AI-tools or seed-stage startup. Fully remote.
Eastern Time default with willingness to flex earlier (UK / Europe overlap) or later
(Australia / NZ overlap). Floor: $140K base. Range: $140-200K + equity. Open to fractional
consulting at $100 to $200/hr.
```

Replace the bracketed line with your eight other projects. One sentence each. Don't pad them out.

---

## ASSET D: Twitter / X bio and pinned thread

### Bio (160 chars max)

Pick one. All within limit. Test which one feels right.

**Option 1 (149 chars):**

> Solo dev. Patent-filed crypto SaaS + 96k-line Pi Network game, both shipped solo in 60 days. Open to senior IC / founding-eng roles. Remote, ET.

**Option 2 (139 chars):**

> Solo dev shipping real things fast with Claude Code. Patent-filed crypto SaaS, Pi Network game live. Senior IC / founding-eng roles. Remote.

**Option 3 (135 chars, cleanest):**

> Two production products shipped solo in 60 days using Claude Code. Patent-filed + YC S26 applicant. Senior IC / founding-eng roles. Remote.

Recommend Option 3. Concrete, defensible, names what you want.

### Pinned thread (7 tweets)

Each tweet under 280 chars. Drop a media attachment (screenshot or 5-second clip) on tweets 2-6 where indicated.

**Tweet 1:**

> Two months ago I started shipping production code with Claude Code as my main collaborator.
>
> Output: two production products solo in 60 days. A patent-filed cryptographic SaaS (YC S26 applicant) and a 96k-line Pi Network game submitting this Friday. Plus a working revenue site and a few prototypes still cooking.
>
> Open to senior IC or founding-engineer roles. Thread.

**Tweet 2 (attach screenshot of demo result):**

> SWS Attention Protocol. A signed cryptographic receipt that proves a real human paid attention. Patent filed March 17, 2026.
>
> 23 behavioral signals. Ed25519. Bitcoin-anchored via OpenTimestamps. Verifiable offline.
>
> Live: sws-attention-proofs.web.app/demo.html

**Tweet 3 (attach short clip of Lucid Winds gameplay):**

> Lucid Winds. A game on Pi Network. 96k lines, single file. Server-validated economy. Procedural one-of-one plants minted on Polygon.
>
> Submitted to Pi App Studio May 9.
>
> lucidwinds.com

**Tweet 4 (attach screenshot of multi-agent terminal):**

> How I ship fast: multi-agent Claude Code orchestration as baseline workflow.
>
> Up to 10 agents running in parallel on independent tasks. I write or review every line of architecture. They do the keystroke-level work.
>
> 21 commits in a single day on a complex day.

**Tweet 5 (attach screenshot of test suite):**

> "But you used AI" is the wrong question.
>
> The right question: did the output ship, does it pass adversarial review, and does it work in production?
>
> SWS: 270+ tests across 45 suites, all green. 7 rounds of hostile review. ~85 findings closed.

**Tweet 6 (attach screenshot of any third project):**

> [Project 3 hook line. One sentence. Stack tags. Link.]

**Tweet 7 (call to action):**

> Open to senior IC or founding-engineer roles, fully remote, US-based (Ohio / Eastern Time, flexible hours).
>
> Floor: $140K. Range: $140-200K + equity.
>
> Portfolio: stephenfurpahs.com
> Email: stephenfurpahs@gmail.com
>
> DMs open.

### Posting cadence after the pinned thread

Two posts per primary product: one launch tweet + one behind-the-scenes technical hook. That's 4 to 6 posts across the 2 to 3 primary products, paced one per day. Then add lighter posts about the prototypes and the workflow itself. Algorithm rewards consistency more than virality.

---

## ASSET E: GitHub repo public-and-redacted checklist

You're making at least one repo public this weekend. Lucid Winds is the recommended pick because the cryptographic-SaaS code may have IP you want to keep private during patent prosecution.

### Before pushing public

- Search the repo for: `PI_SERVER_KEY`, `FIREBASE_API_KEY`, `private`, `secret`, `BEGIN PRIVATE KEY`, `apiKey:`, `serviceAccount`, `firebase-adminsdk`, `gcp-key`, `AIza` (Firebase keys start with this).
- Replace any hits with environment-variable references and add a `.env.example` file.
- Add a clear README describing what the project is, the stack, what's redacted, and how to run it locally with your own keys.
- Run `git log --all --full-history -- '*.env*'` to make sure no env file was ever committed. If one was, use `git filter-repo` to scrub it from history.
- Add a LICENSE file. MIT is fine for a public portfolio repo.

### README template

```markdown
# Lucid Winds

A 96k-line single-file game living on Pi Network. Server-validated economy. Procedural
one-of-one generative plants minted on Polygon. Built solo in 6 weeks using Claude Code as the
primary coding collaborator.

## Live

lucidwinds.com (Pi App Studio submission May 9, 2026)

## Stack

- Vanilla JS (single-file architecture)
- Firebase + Cloud Functions
- Pi SDK
- Polygon NFT voucher signer
- Claude Code multi-agent workflow

## Run locally

You'll need your own Pi App Studio credentials and Firebase project. Copy `.env.example` to
`.env` and fill in:

- `PI_SERVER_KEY`
- `FIREBASE_API_KEY`
- `POLYGON_PRIVATE_KEY` (for the voucher signer)

Then `firebase serve` and open `localhost:5000`.

## Why it's a single file

That's the actual question. Short version: it shipped faster, and the deployment story (drop
into Pi App Studio) is simpler. Longer version is in the SHIP_LOG.md.

## Author

Stephen Furpahs / stephenfurpahs.com / @[handle]
```

---

## CHECKLIST FOR THE WEEKEND

Saturday morning (3 hours):
- [ ] Buy stephenfurpahs.com domain
- [ ] Build landing page from ASSET A copy
- [ ] Write resume PDF from ASSET C, export, save to portfolio site
- [ ] Test landing page on phone

Saturday afternoon (1 hour):
- [ ] Refresh Twitter/X profile, set bio (Option 3 from ASSET D)
- [ ] Write the pinned thread, schedule for Monday morning ET

Sunday morning (1 hour):
- [ ] GitHub: pick the repo to make public, scrub secrets, push
- [ ] Verify by cloning the public repo from a fresh terminal

Sunday afternoon (2 hours):
- [ ] Record 3 demo videos (90s each) per ASSET B scripts
- [ ] Upload to Loom or YouTube unlisted
- [ ] Embed on landing page

Total: 6-8 hours across the weekend, exactly as the docx specified.

---

## What to ask me to draft next

Once the portfolio is up, the next bottleneck is per-company cover letters. The platform map and live gigs are in `CAREER_PIVOT_PLAN.md`. When you're ready to start sending Phase 2 emails on Monday May 12, paste the JD of any specific role and I'll draft the cover letter to match it. Same for cold DMs to Amjad / Karri / Guillermo / Flo.
