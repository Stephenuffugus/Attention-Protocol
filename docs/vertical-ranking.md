# SWS Attention Protocol — Vertical Ranking
## Where to pitch first, where to pitch later, where not to pitch

**Who this is for:** Stephen. Synthesis of the 17-team research already in the repo (per-vertical briefings in `OUTREACH_4_VERTICAL_BLITZ.md`, `GO_TO_MARKET_Team_Briefings.md`, `public/verticals/`, `docs/prospect-dossiers/`, `docs/prospect-primers.md`, `docs/buyer-use-cases.md`, `YC_EXECUTION_PLAN.md`, `YC_FOUNDER_BRIEF.md`) plus the gaps that emerged when I tallied what was covered vs. what was only placeholder.

**What "no-brainer" means here:** Not "biggest total market." A no-brainer pitch is one where the buyer feels the pain acutely today, can deploy in a day, pays without agony, and can't get the same thing from anyone else. That's the filter. It's not the same filter as "eventual ARR."

**How to use it:** Read §1 for the scoring rubric (so you can challenge it). Read §2 for the ranked table. Read §3 for the three "start here" verticals in detail. Read §4–§5 for the rest with a short why/why-not per vertical. Read §6 for the three we should explicitly *not* lead with.

**Freeze rule:** Standard. Updates stage in `vertical-ranking.next.md`.

**Last updated:** 2026-04-24.

---

## Table of contents

1. Scoring rubric (how the ranks get computed)
2. Ranked table — all 17 verticals, ordered top to bottom
3. The three "start here" verticals (full reasoning)
4. Second tier — warm, go after the first wins
5. Long-cycle / strategic-patience tier
6. Do-not-lead-with tier
7. What changes the ranking (watch-outs)

---

## 1. Scoring rubric

Each vertical scores 1–5 on five axes. Higher is better. Sum = /25.

| Axis | What it measures | 5 looks like | 1 looks like |
|---|---|---|---|
| **Pain today** | How acute is the felt pain *right now* for the buyer? | Named public problem, active regulator pressure, recent incident | Vague anxiety, no incident, no enforcement |
| **Integration ease** | How quickly can they deploy SWS and see a receipt? | One script tag, 10 min, no backend | Multi-month security + SOC 2 + custom infra |
| **Revenue density** | $ per closed deal | $500K+ enterprise annual | <$5K per customer |
| **SWS unique fit** | How un-substitutable is our angle vs. competitors? | Only SWS can produce this artifact; structural moat | Crowded category, replaceable |
| **Decision speed** | How fast to first signed pilot? | Director-discretionary, 30–60 days | Multi-year RFP, board approval |

A vertical with a 20+/25 is a "no-brainer." A 17–19 is a worthy second wave. Below 17: don't lead with it.

---

## 2. Ranked table

All 17 verticals from the research, scored.

| # | Vertical | Pain | Int. | Rev. | Fit | Speed | **Total** | Tier |
|---|---|---|---|---|---|---|---|---|
| 1 | Market Research / Survey Platforms | 5 | 5 | 3 | 4 | 4 | **21** | START |
| 2 | CME / Medical Education (MECs) | 4 | 5 | 3 | 5 | 4 | **21** | START |
| 3 | Pharma GxP Compliance (Pfizer-class) | 5 | 3 | 5 | 5 | 2 | **20** | Strategic patience |
| 4 | Credentialing (Credly / Accredible) | 3 | 5 | 4 | 5 | 3 | **20** | Strategic patience |
| 5 | Clinical Trial Consent Attestation | 5 | 3 | 5 | 5 | 2 | **20** | Strategic patience |
| 6 | Nursing Homes / Senior Care | 5 | 4 | 3 | 4 | 3 | **19** | Second tier |
| 7 | FINRA Compliance (Financial Services) | 4 | 4 | 5 | 4 | 2 | **19** | Second tier |
| 8 | Restaurants / Franchise Training | 4 | 4 | 2 | 3 | 5 | **18** + personal edge | START |
| 9 | Corporate LMS / Compliance Training | 4 | 4 | 4 | 4 | 2 | **18** | Second tier |
| 10 | Pharmacy Board CE | 4 | 4 | 2 | 4 | 4 | **18** | Second tier |
| 11 | Nursing CE | 4 | 4 | 2 | 4 | 4 | **18** | Second tier |
| 12 | Ad-viewability / Verified Attention Media | 3 | 5 | 4 | 3 | 3 | **18** | Do not lead |
| 13 | Insurance (Training / Premium Discount) | 4 | 3 | 4 | 4 | 2 | **17** | Second tier |
| 14 | Remote Proctoring Complement | 3 | 4 | 3 | 4 | 3 | **17** | Second tier |
| 15 | Higher-Ed Online Testing | 3 | 4 | 3 | 3 | 3 | **16** | Do not lead |
| 16 | Military / DoD Training | 4 | 2 | 5 | 4 | 1 | **16** | Do not lead |
| 17 | Political-Ad Viewership | 2 | 4 | 3 | 2 | 3 | **14** | Do not lead |

Three rise to the top for "start here": **Market Research**, **CME / MECs**, and **Restaurants** (Stephen's personal edge adds a bump not captured in the 25-point score).

---

## 3. The three "start here" verticals

### Start Here #1 — Market Research / Survey Platforms

**Score: 21/25. Reason you start here: the industry already knows they have the problem and is actively shopping.**

**What we sell them:** One JS tag on the survey page. Per-response attention score bundled with the existing survey response. The output isn't *"is this a bot?"* (existing vendors do that) — it's *"did this verified human actually pay attention for 8 minutes, or did they speed-click in 45 seconds?"*

**Why it's a no-brainer:**
- Research Defender's own published fraud rate is 33% on standard sources, 26% on top-tier, 84% of which "passes traditional quality checks." The industry's own trade associations have called data quality "existential."
- Every buyer on the target list (Qualtrics, SurveyMonkey, Typeform, Alchemer, Dynata, Cint, Lucid, Prodege, etc.) has a named VP Product or Director of Data Quality who owns this.
- Integration is genuinely one tag. No LMS, no xAPI, no SCIF. Deploy by end of week.
- Existing anti-fraud tools (Research Defender, Imperium, Verisoul, PureSpectrum) are complementary — they answer "real person?", we answer "real attention?". We don't displace; we layer on.

**Where the research is:** `GO_TO_MARKET_Team_Briefings.md` Team 2 — 15 named targets with specific pitch angles and named roles. The research team already wrote the first-email templates.

**Start with:** Qualtrics VP Product. If that's cold, go SurveyMonkey (Momentive) Director of Platform Integrity. If both cold, go to the panel companies (Dynata, Lucid) who live even closer to the fraud problem.

**First-90-days target:** Signed pilot with one Tier-1 survey platform OR two Tier-2 panel companies.

### Start Here #2 — CME / Medical Education (MECs)

**Score: 21/25. Reason you start here: the tailwind is named, dated, and still live.**

**What we sell them:** One script tag on each accredited activity. Per-activity receipt that goes into their IME grant proposal as "measurement of learner progression" evidence. Per-activity receipt that also covers their ACCME self-study.

**Why it's a no-brainer:**
- **Pfizer's 2025 IME RFPs literally score "measurement of learner progression."** MECs who can put a better line in that section of the proposal directly win more grant dollars next cycle.
- **ACCME's December 2025 AI guidance** opened the category for integrity-of-engagement evidence. Nobody has a standard technical answer. First mover sets the template.
- 10 named MECs already dossiered: Medscape, DKBmed, Prova, Haymarket, PPP, Global Eduokay i love trying to get into acation, Creative Educational Concepts, Vindico, PeerView, PlatformQ Health.
- Pilot is Director-discretionary (<$50K typically) on one accredited activity. Below procurement pain.
- Two buyer-specific `docs/buyer-use-cases.md` personas (Marcus at Medscape, Priya at Pfizer) already written — you can run the pitch tomorrow.

**Where the research is:** `docs/prospect-dossiers/01-medscape-education.md` through `09-peerview-institute.md` + `10-platformq-health.md`. `docs/prospect-primers.md` for Pfizer / Medscape / PlatformQ / DKBmed business-model view. `docs/buyer-use-cases.md` for the Marcus persona.

**Start with:** Medscape (VP Accreditation / Director Outcomes) — highest-leverage single MEC. If cold, PlatformQ Health — tech-forward, faster technical eval. If cold, DKBmed — specialist MEC, tight faculty, oncology wedge.

**First-90-days target:** One MEC pilot signed on one accredited activity, joint case study clause in the MSA.

### Start Here #3 — Restaurants / Franchise Training

**Score: 18/25 + Stephen's personal edge. Reason you start here: you can say "I've worked in food service" and every competing SDK startup can't.**

**What we sell them:** Script tag on food-safety / OSHA / alcohol-service / harassment training modules. Receipt proves the employee *actually watched the training*, not just clicked through. When an incident happens and the lawyer asks for training records, the receipt is the artifact.

**Why it's a no-brainer for *you specifically*:**
- You have direct industry experience. "I know what your training compliance problem actually looks like because I've been on the ground" is a sentence no other SDK founder can truthfully say.
- The pain is universal: franchise training compliance is clicked-through, everyone knows it, nobody has solved it, incidents happen.
- Integration is simple: one tag on the training module.
- Channel opportunity: restaurant training platforms (Schoox, Wisetail, PlayerLync) are natural OEM partners. One platform deal compounds across hundreds of franchise clients.

**Why it isn't the #1 by score alone:** lower revenue density per direct-to-operator deal vs. pharma or enterprise LMS.

**Where the research is:** `OUTREACH_4_VERTICAL_BLITZ.md` Vertical 1 — target-role breakdown, pain narrative, named tech vendors to approach. Target-list template empty — you fill it from your industry contacts.

**Start with:** One of the restaurant tech vendors (Schoox, Wisetail, PlayerLync) for a channel deal; or one multi-unit operator you have warm access to, for a direct pilot. The vendor path is higher leverage; the direct path is faster.

**First-90-days target:** Either (a) one OEM/channel conversation with a restaurant-training platform advanced past the technical-eval stage, or (b) one signed pilot with a multi-unit operator via warm intro.

---

## 4. Second-tier — warm after the first wins

Worth pursuing *after* you have one signed pilot from a "start here" vertical, because the case study you produce there will accelerate these conversations.

### Nursing Homes / Senior Care (19/25)
CMS 3-year survey compliance, documented staff-training fraud (reports of staff clicking at 4× speed). Named chains: Brookdale, Ensign, ProMedica. Named LMS vendors to OEM with: Relias, HealthStream, CareAcademy. *Wait until you have a case study — regulated buyers distrust cold pitches.*

### FINRA Compliance (Financial Services) (19/25)
Documented FINRA enforcement actions on training completion-fraud. Large enterprise deals. Slow sales cycle. *Not worth leading in the 11-day YC window; queue for post-pilot.*

### Corporate LMS / Compliance Training (18/25)
HIPAA training, security awareness, AML compliance. Named LMS vendors: Cornerstone, Docebo, TalentLMS, SAP SuccessFactors. Our xAPI adapter is already built for this. *OEM path is the right play, not direct to enterprise end-buyers.*

### Pharmacy Board CE (18/25)
State Board CE re-cert, variable strictness. Your pharmacist friend's domain exactly. *Great fit for a second wave, especially if the pharmacist introduces you.*

### Nursing CE (18/25)
Similar to Pharmacy Board CE, larger population, state-specific compliance rules.

### Insurance (Training / Premium Discounts) (17/25)
State Farm, Progressive, Nationwide, CNA — each has a training-for-premium-discount line. Fraud in defensive-driving and workplace-safety training is documented. *Big deals, slow close.*

### Remote Proctoring Complement (17/25)
Proctorio/Respondus are losing universities on privacy backlash. Our no-PII story is the anti-proctoring pitch. *Worth exploring if a university warm-intro surfaces.*

---

## 5. Long-cycle / strategic-patience tier

These are the highest-value targets on revenue-density alone. But you don't *start* here — you keep them warm while you rack up pilot wins in the start-here verticals, then re-approach with case studies.

### Pharma GxP Compliance (Pfizer-class) (20/25)
Highest eventual revenue on this whole list — $50K–$500K enterprise annual after SOC 2. But the buying cycle is 9–12 months RFP-end-to-end. Do not lead. Do keep warm with a named Pfizer-compliance contact. The research is there (`docs/prospect-dossiers/11-pfizer.md` through `19-johnson-johnson.md`, plus `docs/prospect-primers.md` Pfizer section).

### Credentialing (Credly / Accredible) (20/25)
Highest compounding leverage — one deal with Credly ships into hundreds of their enterprise customers. But Pearson procurement is slow. Start by pilot with *one* enterprise customer who already issues credentials through Credly, then escalate. Research in `docs/prospect-dossiers/20-credly.md` and `docs/buyer-use-cases.md` (Jordan persona).

### Clinical Trial Consent Attestation (20/25)
Pharma-regulated, ICH-GCP-adjacent, per-trial pricing is material. The "negative-space attestation" angle (*no machine was here during the consent window*) is legally distinctive. But CRO procurement is slow. Worth a one-pager eventually; not for now.

---

## 6. Do-not-lead-with tier

Covered in the research but flagged as wrong to lead with for the next 90 days:

### Ad-viewability / Verified Attention for Media (18/25)
Technically our stack fits perfectly. Commercially, the MRC-accredited viewability vendors (IAS, DoubleVerify, Moat) dominate a crowded commoditized category. Our `YC_FOUNDER_BRIEF.md` explicitly flags this as "crowded, commoditized, do not lead with." Respect that.

### Higher-Ed Online Testing (16/25)
Proctorio/Respondus are the incumbents and they're taking privacy hits, but higher-ed budgets are tight and procurement is shared-governance slow. Not a no-brainer right now.

### Military / DoD Training (16/25)
Revenue is huge but the sales cycle is years, requires clearances, and deployment is air-gapped / SCIF. Our SDK has SCIF-compatible offline verification, but you do not break into DoD cold. Revisit post-Series A.

### Political-Ad Viewership / Election Integrity (14/25)
Policy-sensitive, adversarial, reputationally risky. Don't touch it.

### Gaming (Lucid Wins) (deliberately not scored)
The research log explicitly flagged this as "design only, no code, do not mention in YC interview unless pushed." Respect that.

---

## 7. What changes the ranking — watch-outs

- **If your pharmacist friend makes a single warm intro** to a state Board of Pharmacy CE content provider or a hospital pharmacy chain — Pharmacy Board CE jumps from second-tier to start-here. Warm intros change the decision-speed score by 2 points.
- **If an incident hits the news** in any vertical — a training-fraud lawsuit in restaurants, a CMS fine on a named nursing home chain, a FINRA penalty tied to training-completion — the pain-today score for that vertical jumps, and you should pivot a week of outreach to ride the news cycle.
- **If Credly's product team responds to a pitch email with genuine engagement** — credentialing vaults to start-here. One Credly pilot unlocks the whole OpenBadges channel.
- **If SOC 2 completes** — everything in the pharma / enterprise column becomes meaningfully more reachable. Pharma moves from 20 → 23.
- **If your LLC formalizes** — the LOI template actually becomes enforceable on your side, which lets you offer LOIs aggressively to the slow-procurement verticals (pharma, FINRA, insurance) and keep them warm with a signed artifact.

---

## 8. One-sentence recommendation

Run the 30-day outreach blitz split 60/30/10 across **Market Research** (60% of your effort — fastest first yes), **CME / MECs** (30% — riding the ACCME + IME tailwind), and **Restaurants via tech-vendor channel** (10% — your personal edge, OEM-scale leverage). Keep pharma, credentialing, and clinical-trial consent warm with a named contact each but don't lead with them until you have one signed pilot from the first three.

---

**End of vertical-ranking.** Numbers are opinions, not oracles. Push back on any scoring you think is wrong.
