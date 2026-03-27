# CLAUDE CODE MASTER BRIEFING
# SWS PROOF OF ATTENTION PROTOCOL
# Complete Project Handoff
# From: Patent Research & Compilation Team (Claude.ai)
# To: Claude Code Development Environment
# Date: March 20, 2026
# Director: Stephen Furpahs

---

## WHO YOU ARE AND WHAT YOU'RE DOING

You are the lead development team for the SWS Proof of Attention Protocol. Stephen Furpahs is the inventor and director. He's building a system that generates SHA-256 cryptographic hashes as verifiable proof of genuine human attention across digital and physical-world interactions. The protocol measures behavioral science patterns to classify attention quality and produce verifiable receipts that businesses pay for.

**This is not a concept. The patent is filed. The protocol is live on a production website. Real hashes are being generated from real users right now.**

---

## CRITICAL CONTEXT — WHAT HAS ALREADY BEEN DONE

### Patent: FILED ✅
- **Docket:** SWS-PROV-001
- **Filed:** March 17, 2026 at patentcenter.uspto.gov
- **Fee paid:** $65 (micro entity)
- **Pages:** 29
- **Entity:** SWS Strategic Media LLC
- **Inventor:** Stephen Furpahs, 2594 Spade Rd, Uniontown, Ohio 44685
- **Coverage:** 247 distinct patentable innovations across 24 categories
- **Prior art:** 9 references analyzed and distinguished (Brave/BAT, behavioral biometrics patents, Sweatcoin, StepN, Art Blocks, Pi Network, Google Opinion Rewards, Nielsen, DoubleVerify/IAS/MOAT)
- **All prior art rated:** 178 STRONG, 58 MEDIUM, 0 WEAK
- **Utility patent conversion deadline:** March 17, 2027 (12 months from filing)

### Live Website: GENERATING HASHES ✅
- **Site:** stevieweedseed.com (affiliate seed bank site)
- **Firebase project:** focus-grove-fffa8
- **GA4 property:** G-5JFFYEJ6XP
- **Hash pipeline:** WORKING — confirmed via localStorage showing real SHA-256 hashes with proper event types, quality tiers, timestamps, durations, interaction counts
- **Event types generating:** idle_drip (passive), tab_return (active), page_visit (active)
- **game_id:** steveweetsie_web
- **localStorage key:** sws_attention_hashes

### CRITICAL BUG — NOT YET FIXED:
- **All hashes show "synced": false** — they are NOT reaching Firestore
- **Root cause:** Visitors are unauthenticated. No Firebase Auth = no UID = no Firestore write path
- **Fix:** Enable Firebase Anonymous Authentication and add signInAnonymously() + sync function
- **Detailed fix instructions:** See WEBSITE_TEAM_HANDOFF_Firestore_Sync_Fix.md
- **THIS IS THE #1 PRIORITY BEFORE ANYTHING ELSE**

### Trade Secrets: CATALOGED AND SECURED ✅
- Trade secret catalog created and stored on encrypted Google Drive
- ALL specific calibration values excluded from patent
- Patent uses generic language ("a defined threshold", "a first multiplier") instead of specific numbers
- See trade secret values section below for what the actual numbers are

---

## THE PROTOCOL — TECHNICAL SPECIFICATION

### Core Pipeline
1. User interacts with an application (game, website, training portal, survey, anything)
2. Interaction events trigger payload construction
3. Payload: 9 fields — event_type, timestamp, session_id, duration_ms, interaction_count, quality_tier, game_id, user_uid, nonce
4. Payload is serialized with JSON.stringify() with keys sorted alphabetically
5. Serialized string is hashed with SHA-256 (SubtleCrypto API, fallback to JS implementation)
6. Hash + metadata stored to localStorage (immediate) and Firestore vault (when authenticated)

### Quality Tiers and Multipliers (TRADE SECRET VALUES)
| Tier | Earning Multiplier | Focus Score Weight |
|------|-------------------|-------------------|
| Deep Focus | 2.0x | 1.0 |
| Active Engagement | 1.0x | 0.7 |
| Passive Presence | 0.5x | 0.3 |
| Background | 0.25x | 0.1 |

Bot earning rate at background: 0.25x / 2.0x = 12.5% of human deep-focus rate.

### Focus Score Formula
```
score = sum(minutes_at_tier * tier_weight) / total_minutes * 100
```

### Composite Human Confidence Score (6 Behavioral Signals)
| Signal | Weight | Human Range | Bot Cutoff |
|--------|--------|-------------|------------|
| Timing Entropy (CV) | 0.25 | CV 0.4-1.5 | CV < 0.25 |
| Fitts' Law (r) | 0.20 | r > 0.3 | r < 0.15 |
| Hick's Law | 0.10 | Scales with options | Constant |
| Scroll Saccade | 0.15 | 2-8 pauses/screen | 0 pauses |
| Micro-Pause | 0.15 | 200-2000ms | 0-50ms |
| Touch Variance | 0.15 | Variance > 0.5 | Variance ≈ 0 |

### Tier Boundaries from Composite Score
| Score | Maximum Tier |
|-------|-------------|
| > 0.75 | DEEP FOCUS |
| 0.50-0.75 | ACTIVE |
| 0.25-0.50 | PASSIVE |
| < 0.25 | BACKGROUND (forced) |

### Hash Economy Earning Rates (TRADE SECRET VALUES)
| Source | Rate | Daily Cap |
|--------|------|-----------|
| Idle Hash Drip | 1 hash / 5 min (~12/hr) | Halves after 30 min 0-interaction |
| Ambient Mode | 1 hash / 3 min (~20/hr) | Self-limiting |
| Tab Return | log2(min_away + 1) | Cap 8 per return |
| Notification Tap | 2 hashes per tap | 3 taps/day |
| Browser Extension | 1 hash / 10 min | 6/hr, 36/day |
| Fitness Import | 1 hash / 1,000 steps | 10/day |
| Share (sharer) | 2 hashes if 10s+ view | No cap |
| Referral Signup | 5 hashes to sharer | No cap |
| Keyboard Miner | 1 hash / 1,000 keystrokes | 10/day |
| Screen Time Oracle | 1 hash / 30 min | 24/day |

### SDK Revenue Split
- 70% user / 29% developer / 1% protocol fee

### Firestore Structure
```
vaults/{uid}/
  hashes/          — individual hash documents
  balance/current  — { total_earned, total_spent, current, last_updated }
  
store_catalog/{game_id}/items/{item_id}  — cross-app storefront

friendCodes/{code}  — existing friend system (already in production)
```

---

## INFRASTRUCTURE

| System | Details |
|--------|---------|
| Firebase Project | focus-grove-fffa8 |
| Firestore Location | nam5 |
| Firebase Plan | Blaze (pay-as-you-go with spending limit) |
| GA4 Property | G-5JFFYEJ6XP |
| BigQuery Datasets | firestore_export, firestore_vaults, firestore_pocdata |
| GA4 Property Number | 524977676 |
| Microsoft Clarity | Deployed |
| UptimeRobot | Deployed |
| Looker Studio | Connected to GA4 |
| Hosting | Hostinger (file manager) |
| GitHub Repo | lucid-winds (Codespace) |
| MCPs Connected | Context7, Sequential Thinking |
| Playwright MCP | Failed (headless environment), deprioritized |
| Hugging Face | Account and API token obtained, install not yet run |

### Stephen's Accounts
- stephenfurpahs@gmail.com — primary Google account
- stevieweedseed@gmail.com — website/Firebase account
- Both need access to focus-grove-fffa8 project

---

## THE THREE BUSINESS MODELS

### Model 1: Consumer Game (Lucid Wins)
Players earn attention hashes by playing games. Hashes are redeemable for in-app features, cosmetics, and cross-app items. The game is the consumer-facing engagement layer. Formerly called Petal Walk, then Focus Grove, now Lucid Wins.

### Model 2: B2B Verification Service (THE BIG MONEY)
Businesses integrate the protocol into THEIR OWN existing systems. They receive attention verification receipts as a service. No consumer economy required. The business pays per-user, per-event, per-session, or subscription. Delivered as cloud dashboard, API, on-premises integration, or white-label solution.

Target verticals: market research (fastest), insurance/nursing homes (highest per-client), advertising, corporate training, healthcare/digital therapeutics, education, military/defense, financial services, and 20+ more.

### Model 3: Developer SDK
Any developer drops one JavaScript tag into their app. Gets engagement analytics and attention verification. Revenue split: 70% user / 29% developer / 1% protocol.

**Each model works independently. None requires the others.**

---

## WHAT NEEDS TO BE BUILT — PRIORITY ORDER

### P0: Fix Firestore Sync (IMMEDIATE)
The hash pipeline generates hashes locally but they're not reaching Firestore. Fix:
1. Enable Anonymous Auth in Firebase Console
2. Add firebase.auth().signInAnonymously() to site initialization
3. Add onAuthStateChanged listener that syncs unsynced hashes to Firestore
4. Update Firestore security rules
Full instructions in WEBSITE_TEAM_HANDOFF_Firestore_Sync_Fix.md

### P1: Attention Quality Dashboard
Build a dashboard that shows hash data alongside GA4 data for the same time period:
- GA4 side: pageviews, session duration, bounce rate, traffic sources
- Protocol side: hash count, quality tier distribution, average Focus Score, interaction density, timing entropy
- Side-by-side comparison proving the protocol sees things GA4 can't
- This dashboard IS the sales demo for B2B clients

### P2: GA4 ↔ Hash Alignment
Align GA4 sessions with attention hash sessions by matching timestamps within a window. Show: "GA4 says 3 minutes. Protocol says active engagement for 2:40 with 23 interactions, Focus Score 68, timing CV 0.8 (confirmed human)."

### P3: Lucid Wins Game Development
The primary consumer game deploying on Pi Network. Trading card game also in development. ATP Trivia is the immediate P0 Pi Network app.

### P4: B2B Pilot Infrastructure
Build the hosted dashboard that a pilot client would actually see. Simple: client drops JS tag, gets a login to a dashboard showing their engagement data with quality scoring.

### P5: Second Patent Preparation
If the development work reveals new patentable innovations (and it will), prepare documentation for a continuation or second provisional filing.

---

## REGULATORY RULES — NEVER VIOLATE THESE

1. **Never use:** "virtual currency," "fiat currency," "monetary conversion," "cryptocurrency" when describing the protocol's hashes. They are "engagement verification receipts" and "in-application utility tokens."

2. **ATP (Attention Token Protocol) must remain a utility token** — never purchasable with fiat, never exchange-tradeable. This avoids securities classification.

3. **COPPA compliance by design** — hash payloads contain no personal information. This is a key differentiator for children's applications.

4. **SCIF advantage** — hash payloads contain zero content data, making it the only attention verification system operable in classified military environments.

5. **Trade secrets stay out of any public-facing code or documentation.** The specific threshold values, weights, and calibration numbers are kept in the trade secret catalog only. Production code can reference them as configurable parameters loaded from a secure config, never hardcoded in client-side JavaScript.

---

## FILES AVAILABLE IN THIS PROJECT

### Core Technical Docs (READ THESE FIRST)
- ATTENTION_PROTOCOL_SPEC.md — THE canonical spec. 9-field payload, event types, quality tiers, Focus Score, vault schema, economy rules, privacy architecture.
- ATTENTION_PROTOCOL_INTEGRATION_GUIDE.md — Step-by-step implementation guide with JavaScript code.
- BEHAVIORAL_SCIENCE_PATTERNS.md — All 6 behavioral patterns with scientific basis, JS implementation, discrimination accuracy, and patent claim language.
- PATENT_TECHNOLOGY_COMPILATION.md — Technical compilation of the full system.
- PRIOR_ART_AND_DISTINCTIONS.md — 9 prior art references with distinction analysis.
- BUSINESS_VERTICALS_AND_VALUE.md — 13+ verticals with problem/solution/pricing.

### Project Management
- ATTENTION_PROTOCOL_PROJECT_INSTRUCTIONS.md — The 4-pass patent compilation process instructions.
- SWS_Protocol_Team_Briefing.md — Prompts given to each game team.
- SWS_MASTER_REFERENCE.md — Master reference document.

### Game Team Audits (20+ vertical-specific audits)
- PETAL_WALK_ATTENTION_PROTOCOL_AUDIT.docx — Origin botanical game (now Lucid Wins)
- SNAPBINDER_ATTENTION_PROTOCOL_AUDIT_UPDATED-1.docx — AR photo trading
- fracture-attention-audit.html — Battle card game
- fracture-attention-economy.html — Fracture economy design
- fracture-attention-integration-rnd.html — Fracture integration R&D
- DRESS_ME_ATTENTION_PROTOCOL_AUDIT.md — AI fashion app
- FORGE_Complete_Attention_Protocol_Application_Audit.docx — Software dev integration
- ChromaForge_Attention_Protocol_RD_Deep_Dive-1.docx — Color intelligence
- astra-vault-audit.docx — Astronomical observatory
- sws-ecosystem-architecture.html — Full ecosystem architecture

### Vertical-Specific Audits
- ADVERTISING_COMPLETE_ATTENTION_PROTOCOL_APPLICATION_AUDIT.docx
- Insurance_Attention_Protocol_Audit.docx
- SWS_Medical_RD_Deep_Dive.docx
- SWS_Education_Vertical_RD_Deep_Dive-2.docx
- SWS_Military_Defense_RD_Deep_Dive.docx
- SWS_Video_Game_RD_Complete_Audit.docx
- SPORTS_ATTENTION_PROTOCOL_AUDIT.docx
- TRANSPORTATION_ATTENTION_PROTOCOL_AUDIT.docx
- AGRICULTURE_WEATHER_MEDIA_ATTENTION_PROTOCOL_AUDIT.docx
- BEAUTY_COSMETICS_FASHION_ATTENTION_PROTOCOL_AUDIT.docx
- Natural_Resources_Complete_Attention_Protocol_Audit.docx
- Games_Toys_Cognitive_Dev_Attention_Protocol_Audit.docx
- Polymer_Science_Advanced_Technologies_Complete_Attention_Protocol_Audit.docx
- SWS_Restaurant_Retail_Attention_Protocol_Audit.docx
- Politics_IA_Attention_Protocol_Audit.docx
- Space_Tech_Astrophysics_Attention_Protocol_Audit.docx
- sws-financial-systems-audit.html
- SWS_MASTER_APPLICATION_AUDIT.docx / SWS_MASTER_APPLICATION_AUDIT-1.docx

### Patent & Legal (Reference Only — Already Filed)
- SWS_Attention_Protocol_Patent_Brief1.pdf — Original patent brief

### Deliverables Produced (Available as Output Files)
- SWS_PROV_001_Comprehensive_Patent_Application.pdf — THE FILED PATENT (29 pages, embedded fonts)
- SWS_Attorney_Briefing_Package.docx — For patent attorney, 5 Crown Jewel claims, cost roadmap
- SWS_Trade_Secret_Catalog.docx — ALL proprietary values (CONFIDENTIAL, NDA-only)
- STRATEGIC_ASSET_PRIORITIZATION.md — 22 claim clusters rated by safety/cost/profit
- PASS1_COMPLETE_INVENTORY.md — 247 items across 24 categories
- PASS2_PRIOR_ART_CROSSREF.md — Prior art strength ratings for all items
- PASS3_GAP_CHECK.md — Systematic coverage verification
- WEBSITE_TEAM_HANDOFF_Firestore_Sync_Fix.md — Fix for the Firestore sync issue
- GO_TO_MARKET_Team_Briefings.md — Team 2 (Market Research) and Team 1 (Insurance/Nursing Homes) with target lists, email templates, pricing, competitive analysis

---

## STEPHEN'S WORKING STYLE — READ THIS

- **Honesty over reassurance.** Never tell him something is done when it isn't. He will check. He will find out. Be upfront about what's working and what's not.
- **One instruction at a time.** Plain language. Sequential steps. Don't skip ahead of where he is.
- **He's the director, not the coder.** Build things he can deploy, test, and demonstrate. Don't give him code to debug.
- **Multi-team framing.** He organizes work as specialized teams (advertising team, insurance team, etc.) producing formal deliverables. Maintain that framing.
- **Exhaustive coverage.** Every audit, every document, every analysis should cover every conceivable angle. He pushes back hard and every pushback has revealed real gaps.
- **The game is Lucid Wins.** Not Petal Walk, not Focus Grove. Other game names (Fracture, SnapBinder, Dress Me, ChromaForge, Astra Vault) are working titles that may change.
- **The company is SWS Strategic Media LLC.** Not Lucid Winds LLC. Get this right on every document.
- **His personal passion is nursing homes.** He's volunteered in them. The nursing home vertical isn't just business — it's personal. Use that authenticity.
- **Pi Network deployment is a major goal.** 47M user base. Smart contracts live as of Pi Day March 14, 2026. Broader Mainnet eligibility criteria not yet published.

---

## THE PROMPT TO GIVE CLAUDE CODE

Copy everything above this line into Claude Code's context. Then say:

"You are the lead development team for the SWS Proof of Attention Protocol. I've given you the complete project context above. Your immediate priorities are:

1. Fix the Firestore sync issue — enable anonymous auth and get hashes flowing from localStorage to Firestore on my live site (stevieweedseed.com, Firebase project focus-grove-fffa8).

2. Build an attention quality dashboard that compares hash data from Firestore with GA4 data, showing side-by-side what GA4 sees vs. what our protocol sees for the same user sessions.

3. Review all project knowledge files and identify any new patentable innovations or implementation improvements that should be documented.

4. Begin building the B2B pilot infrastructure — a simple hosted dashboard where a trial client can see their attention quality data after dropping our JS tag on their site.

Start with priority 1. Walk me through it one step at a time. I'm working in a GitHub Codespace (lucid-winds repo) with Context7 MCP and Sequential Thinking MCP connected."
