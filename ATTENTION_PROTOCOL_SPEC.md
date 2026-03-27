# SWS PROOF OF ATTENTION PROTOCOL — CANONICAL SPEC
## Version 1.0 — March 14, 2026
## Classification: CROSS-PROJECT REFERENCE — All Game Teams

---

## WHAT THIS DOCUMENT IS

This is the canonical specification for the SWS Proof of Attention Protocol. It is the single source of truth for any game, app, or platform integrating attention hash technology. If you are a developer (human or AI) working on a game in the SWS ecosystem, this document tells you everything you need to know about how the protocol works, what you can build with it, and what rules you must follow.

The protocol was originally developed inside a procedural botanical collectible game (working title: Petal Walk, formerly Focus Grove). But the technology is game-agnostic. Any interactive experience that can verify human engagement can generate attention hashes.

---

## THE CORE CONCEPT

Human attention is the most valuable and most wasted resource in the digital economy. Every minute a person spends engaged with a screen — playing a game, reading, walking with an app open, browsing — is a minute of real cognitive effort that currently goes unrecorded and unrewarded.

The SWS Proof of Attention Protocol changes that. It generates SHA-256 cryptographic hashes that prove a real human paid real attention for a real duration. These hashes are:

- **Deterministic** — the same input always produces the same hash
- **Unique** — no two attention events produce the same hash
- **Verifiable** — anyone can confirm a hash came from a legitimate attention event
- **Portable** — hashes work across any game or platform in the ecosystem
- **Privacy-safe** — hashes prove engagement happened without revealing what the user was doing

The protocol does NOT track what users do. It tracks HOW LONG they do it and HOW ENGAGED they were while doing it. That distinction is everything.

---

## HOW HASH GENERATION WORKS

### The Attention Payload

Every attention event builds a payload object before hashing. The payload contains:

```
{
  event_type:    string    // What triggered the hash (see Event Types below)
  timestamp:     number    // Unix timestamp in milliseconds
  session_id:    string    // Unique per-session identifier
  duration_ms:   number    // How long the attention event lasted
  interaction_count: number // Taps, clicks, keystrokes, swipes during the event
  quality_tier:  string    // "deep" | "active" | "passive" | "background"
  game_id:       string    // Which game/app generated the event
  user_uid:      string    // Firebase Auth UID (if authenticated)
  nonce:         string    // Random value for uniqueness
}
```

### The Hash Function

The payload is serialized to a deterministic JSON string (keys sorted alphabetically) and run through SHA-256:

```
hash = SHA-256( JSON.stringify(payload, Object.keys(payload).sort()) )
```

The resulting 64-character hex string IS the attention hash. It is stored locally and synced to the user's cloud vault when authenticated.

### The Function Signature

The core function that every integrating game must implement or call:

```javascript
function buildAttentionPayload(eventType, durationMs, interactionCount, qualityTier) {
  return {
    event_type: eventType,
    timestamp: Date.now(),
    session_id: getSessionId(),       // Generated once per app session
    duration_ms: durationMs,
    interaction_count: interactionCount,
    quality_tier: qualityTier,
    game_id: GAME_ID,                 // Unique constant per game
    user_uid: getCurrentUserUid(),     // From Firebase Auth, or "anonymous"
    nonce: generateNonce()             // crypto.getRandomValues or Math.random fallback
  };
}

function generateAttentionHash(payload) {
  var serialized = JSON.stringify(payload, Object.keys(payload).sort());
  // Use SubtleCrypto if available, otherwise a JS SHA-256 implementation
  return sha256(serialized);
}
```

### Hash Storage

Hashes are stored in two places:

1. **localStorage** — immediate, works offline, keyed as `sws_attention_hashes` (JSON array)
2. **Firestore** — cloud sync when authenticated, stored at `vaults/{uid}/hashes` collection

Each stored hash record includes:

```
{
  hash:        string    // The SHA-256 hex string
  event_type:  string    // What generated it
  timestamp:   number    // When it was generated
  game_id:     string    // Which game generated it
  quality_tier: string   // Attention quality classification
  synced:      boolean   // Whether it has been pushed to Firestore
}
```

---

## EVENT TYPES — THE HASH TRIGGERS

These are the defined event types that generate attention hashes. Each game will use a subset of these depending on its mechanics. Games may propose NEW event types to the Director for approval.

### Gameplay Events (Active Engagement)

| Event Type | Trigger | Hashes | Quality Tier |
|-----------|---------|--------|-------------|
| `game_start` | Player begins a game round | 1 | deep |
| `game_milestone` | Player hits an in-game achievement during play | 1 | deep |
| `game_complete` | Player finishes a game round | 1 | deep |
| `challenge_complete` | Player finishes a timed or scored challenge | 1-2 | deep |
| `collection_bonus` | Player adds item to permanent collection | 1-3 | deep |
| `daily_checkin` | Player opens the app and performs a meaningful action | 1 | active |

### Movement Events (Physical Engagement)

| Event Type | Trigger | Hashes | Quality Tier |
|-----------|---------|--------|-------------|
| `trail_steps_200` | 200 real steps counted via GPS haversine or pedometer | 1 | active |
| `trail_steps_2000` | 2,000 step milestone | 1 bonus | active |
| `fitness_import` | 1,000 steps pulled from Google Fit/Strava OAuth | 1 | active |

### Ambient Events (Passive Engagement)

| Event Type | Trigger | Hashes | Quality Tier |
|-----------|---------|--------|-------------|
| `idle_drip` | 5 minutes of continuous foreground visibility | 1 | passive |
| `ambient_mode` | 3 minutes in dedicated ambient/screensaver mode | 1 | passive |
| `tab_return` | Player returns to app after being away | log2(minutes_away + 1), cap 8 | active |
| `notification_tap` | Player taps a push notification to open the app | 2 | active |

### Social Events (Viral Engagement)

| Event Type | Trigger | Hashes | Quality Tier |
|-----------|---------|--------|-------------|
| `share_verified` | Player shares content and someone views it 10+ seconds | 2 (sharer) | active |
| `share_viewed` | Viewer spends 10+ seconds on shared content | 1 (viewer, banked) | passive |
| `referral_signup` | Someone creates an account from a shared link | 5 (sharer) | active |

### Extension/Bridge Events (Cross-Platform Engagement)

| Event Type | Trigger | Hashes | Quality Tier |
|-----------|---------|--------|-------------|
| `extension_browse` | 10 minutes of active browsing via Grove Keeper extension | 1 | passive |
| `partner_activity` | Activity reported from a partner platform (Discord, etc.) | 1/day per partner | background |

---

## THE FOCUS SCORE — ATTENTION QUALITY MULTIPLIER

Not all attention is equal. The Focus Score system classifies attention quality and applies multipliers to hash earning rates.

### Quality Tiers

| Tier | Description | Examples | Hash Multiplier |
|------|------------|----------|----------------|
| **Deep Focus** | Sustained, interactive cognitive engagement | Completing game rounds, creative tasks, long reads, writing | 2.0x |
| **Active Engagement** | Regular interaction, moderate cognitive load | Browsing, chatting, social media with interaction, casual play | 1.0x |
| **Passive Presence** | App is visible but user is mostly idle | Ambient mode, leaving app open on desk, background music | 0.5x |
| **Background** | Minimal direct engagement | Browser extension, lock screen widget, keyboard hash mining | 0.25x |

### Focus Score Calculation

Each session accumulates a weighted score:

```
session_focus_score = sum(minutes_at_tier * tier_weight) / total_session_minutes * 100

Where tier weights are:
  deep    = 1.0
  active  = 0.7
  passive = 0.3
  background = 0.1
```

The Focus Score is displayed to the user as a 0-100 rating: "Your attention quality today: 78/100 — Deep Focus mode detected for 2.3 hours."

### Anti-Cheat Through Quality

The Focus Score IS the anti-cheat system. Bots and auto-clickers produce low-quality attention patterns (zero interaction variance, perfectly regular timing, no mouse/touch entropy). These patterns score low on Focus Score, which means they earn at the background rate (0.25x). Making cheating technically possible but economically pointless is more robust than trying to detect and block every cheat method.

### Interaction Entropy Check

Within any attention event, the payload includes `interaction_count`. For idle drip events, if interaction count equals zero for 30+ minutes, the drip rate halves. This is a soft throttle, not a hard block — it still earns, just slower.

---

## THE FOUR TIERS — DEPLOYMENT TIMELINE

### Tier 1: Ambient Hash Mining (Ships Now — Web PWA)

No architecture changes required. Pure client-side JavaScript additions to any existing web game.

**Features:**
- Idle Hash Drip: 1 hash per 5 min of foreground visibility (~12/hr)
- Ambient Mode: dedicated screensaver state, 1 hash per 3 min (~20/hr), uses Screen Wake Lock API
- Tab Return Bonus: log2(minutes_away + 1) hashes on return, capped at 8
- Notification Tap Rewards: 2 hashes per tapped push notification, max 3/day

**Total code footprint:** ~200 lines per game
**Daily hash potential:** 41 (casual) to 161 (active) per user

### Tier 2: The Attention Bridge (3-6 Months)

Browser extension and OAuth integrations that capture attention outside the game itself.

**Features:**
- Grove Keeper Browser Extension: tracks aggregate browse time (never URLs), 1 hash per 10 min active browsing
- Share-to-Earn Protocol: hashes for sharing game content and having it viewed
- Google Fit/Strava OAuth Bridge: pull step counts, 1,000 steps = 1 hash, cap 10/day
- Partner Activity Bridges: Discord, Telegram, community activity → hashes

**Total code footprint:** ~500 lines client + browser extension (~500 lines) + server OAuth
**Daily hash potential:** 59 (casual) to 220 (active)

### Tier 3: Native App (6-12 Months)

React Native or Capacitor wrapper unlocking device-level APIs.

**Features:**
- Screen Time Oracle: aggregate screen-on time → hashes (30 min = 1 hash, cap 24/day)
- Background Step Counter: native pedometer, works 24/7
- Lock Screen Widget: micro-hashes from widget visibility
- Notification Mini-Games: interactive notifications that earn hashes
- Keyboard Integration (Android): keystroke count → hashes (100 keystrokes = 0.1 hash)

**Daily hash potential:** 80 (casual) to 273 (active)

### Tier 4: The Attention Protocol (12-24 Months)

SWS becomes an attention verification standard.

**Features:**
- SWS Attention SDK: open SDK for third-party developers (70% user / 29% developer / 1% SWS)
- Attention Marketplace: advertisers buy verified attention-minutes, not impressions
- Attention Chain: on-chain attention token (Layer 2 on Polygon or Pi Network)

**This tier transforms from a game feature into infrastructure.**

---

## ECONOMY RULES — NON-NEGOTIABLE

These rules are locked by the Director and apply across ALL games in the ecosystem.

### Hash Earning Caps

Every earning source has a daily cap to prevent inflation:

| Source | Cap |
|--------|-----|
| Idle Drip | Halves after 30 min zero-interaction |
| Ambient Mode | No hard cap (self-limiting by screen-on time) |
| Tab Return | 8 hashes max per return event |
| Notifications | 3 taps per day |
| Fitness Import | 10 hashes per day (10,000 steps) |
| Browser Extension | 6 hashes per hour, 36 per day |
| Partner Bridges | 1 hash per partner per day |

### The Inflation Rule

**Every new earning source MUST ship with a corresponding spending sink.** If your game adds a way to earn hashes, it must simultaneously add a way to spend them. The economy across all games must stay balanced.

### Hash Spending (Current Sinks)

These are sinks established in the origin game. Each game should design its own sinks appropriate to its mechanics:

| Sink | Cost | Notes |
|------|------|-------|
| Skip wait timer (1 day) | 5 hashes | Applicable to any game with time gates |
| Premium feature unlock | 50 hashes | Vision, consultation, etc. |
| Cosmetic upgrades | 15-50 hashes | Game-specific |
| Shop items | 10-100 hashes | Game-specific consumables |
| Marketplace actions | varies | Transaction-adjacent features |

### Cross-Game Hash Portability

Hashes earned in ANY game are stored in the user's unified vault (`vaults/{uid}/hashes` in Firestore). A hash earned in Game A can be spent in Game B. This is the core value proposition for users: every game in the ecosystem feeds the same wallet.

**Important:** Games do NOT manage their own hash balances. The vault is the source of truth. Games read the balance, propose spends (which are validated), and the vault deducts. No game can mint hashes that bypass the vault.

---

## PRIVACY ARCHITECTURE — NON-NEGOTIABLE

These rules override everything. No game, no feature, no business reason justifies violating them.

### We NEVER Store

- Specific URLs visited
- App names used
- Message content
- Keystroke content (keyboard tracks COUNT only)
- Location data beyond opt-in geo-features
- Personal identification data
- Biometric data
- Browsing history
- Health data (weight, heart rate, etc.)

### We ONLY Store

- Aggregate time durations
- Interaction counts (taps, scrolls, keystrokes — numbers only)
- Step counts (from accelerometer or fitness API)
- SHA-256 hashes of attention payloads
- User-chosen display names and game-specific data

### Consent Requirements

- ALL tracking is opt-in with clear consent flows
- Users can export all their data at any time
- Users can delete their attention history permanently
- No data is sold to third parties — ever
- The hashes themselves are the product, not the user data

### The Privacy Pitch

"This game never watches what you do. It watches HOW LONG you do it. Your attention has value — we help you capture that value without ever seeing your private life."

---

## FIREBASE ARCHITECTURE

### Project

All games in the SWS ecosystem share a single Firebase project: `focus-grove-fffa8`

This provides:
- **Firebase Auth** — unified user identity across all games
- **Firestore** — cloud storage for vaults, hashes, game-specific data

### Vault Schema

```
vaults/{uid}/
  ├── hashes/           (collection — all attention hashes)
  │   └── {hash_id}/
  │       ├── hash: string
  │       ├── event_type: string
  │       ├── timestamp: number
  │       ├── game_id: string
  │       ├── quality_tier: string
  │       └── spent: boolean
  │
  ├── balance/          (document — computed hash balance)
  │   ├── total_earned: number
  │   ├── total_spent: number
  │   └── current: number
  │
  ├── fitness/          (document — OAuth tokens for fitness bridges)
  │   ├── provider: string
  │   ├── refresh_token: string (encrypted)
  │   └── last_sync: number
  │
  └── games/            (collection — per-game data)
      └── {game_id}/
          └── ... (game-specific inventory, progress, etc.)
```

### Game IDs (Registered)

Each game in the ecosystem has a unique `game_id` string used in hash payloads and Firestore paths:

| Game | game_id | Status |
|------|---------|--------|
| Petal Walk (origin game) | `petal_walk` | In development |
| (Your other games register here) | TBD | Pending |

**To register a new game:** Contact the Director with the game name and proposed game_id string. The ID must be lowercase, alphanumeric with underscores, and unique across the ecosystem.

---

## TECHNICAL CONSTRAINTS — CURRENT PWA ARCHITECTURE

All games in the ecosystem are currently web PWAs. This means:

| Capability | Available? | Notes |
|-----------|-----------|-------|
| Foreground JS execution | YES | Full access while tab is active |
| Service Worker (background) | VERY LIMITED | ~30 sec after tab close, then killed |
| DeviceMotion (accelerometer) | YES | Foreground only, iOS needs permission |
| Geolocation | YES | Foreground only, needs permission |
| Screen Wake Lock | YES | Keeps screen on while tab is active |
| Page Visibility API | YES | Detects tab focus/blur |
| Push Notifications | YES | Requires push server |
| Monitor other apps | NO | Browser sandbox prevents this |
| Background GPS | NO | Requires native app |
| Read health/step data | NO | Requires native app or OAuth bridge |

**The hard truth:** From a web PWA, you cannot monitor what users do in other apps. The browser sandbox prevents it. Tier 1 and most of Tier 2 work within these constraints. Tier 3 requires a native app decision.

---

## COMPETITIVE LANDSCAPE

| Project | What They Do | Our Advantage |
|---------|-------------|---------------|
| Brave / BAT | Pay users to view ads | We pay for ALL attention, not just ads |
| Sweatcoin / SWEAT | Walk-to-earn tokens | We reward ALL activity, not just walking |
| StepN / GMT | Walk-to-earn with NFT sneakers | They collapsed from mercenary economics. We have real games |
| Pi Network | Tap-to-mine on mobile | 47M users, almost no utility. We ARE utility |
| Google Opinion Rewards | Pay for survey responses | We pay passively — no effort required |

**The moat:** Our games are FUN. Every competitor above is transactional. Players stay because they love the game. The attention protocol is a bonus, not the core pitch.

---

## WHAT GAMES SHOULD DO WITH THIS SPEC

1. Read this document to understand the protocol
2. Read the companion INTEGRATION GUIDE for implementation steps
3. Identify which event types make sense for your game's mechanics
4. Propose new event types if your game has unique engagement patterns
5. Design spending sinks proportional to earning sources
6. Implement the hash generation pipeline using the function signatures above
7. Test single-variable: one hash source at a time
8. All major integration decisions require Director approval

---

## REVENUE PROJECTIONS (Ecosystem-Wide)

| Timeframe | MAU | Daily Hashes | Annual Revenue |
|-----------|-----|-------------|---------------|
| Year 1-2 (Tier 1+2) | 50,000 | 2,000,000 | ~$200,000 |
| Year 2-3 (Tier 3 native) | 500,000 | 50,000,000 | ~$5,340,000 |
| Year 3-5 (Tier 4 protocol) | 5,000,000 | 150,000,000 | ~$77,750,000 |
| Year 5+ (global adoption) | 50,000,000 | 3,000,000,000 | $1,000,000,000+ |

**More games in the ecosystem = more earning sources = more reasons to stay = more users = more attention = more value.** Each game that integrates the protocol makes every other game more valuable.

---

*The game is always the soul. The protocol is the engine.*
*Your game doesn't exist to serve the protocol. The protocol exists to make your game more rewarding.*

*— SWS Proof of Attention Protocol v1.0, March 2026*
