# SWS ATTENTION PROTOCOL — GAME INTEGRATION GUIDE
## Version 1.0 — March 14, 2026
## For: All Game Development Teams in the SWS Ecosystem

---

## PURPOSE OF THIS DOCUMENT

You are building a game that will integrate the SWS Proof of Attention Protocol. This guide tells you exactly how to do it — what code to write, what rules to follow, and what to propose back to the Director when you find opportunities unique to your game.

Read the companion document (ATTENTION_PROTOCOL_SPEC.md) first for the full technical spec. This document assumes you understand what attention hashes are and why they matter.

---

## BEFORE YOU WRITE ANY CODE

### Step 1: Register Your Game

Every game needs a unique `game_id`. This is a lowercase string with underscores (e.g., `petal_walk`, `your_game_name`). This ID appears in every hash payload your game generates and in the Firestore path where your game stores user data.

Propose your game_id to the Director (Stephen). It must be unique across the ecosystem.

### Step 2: Identify Your Attention Events

Look at your game's mechanics and map them to attention event types. Ask yourself:

- **What does "deep focus" look like in my game?** (Completing levels, solving puzzles, creating content, sustained play sessions) → These generate `game_complete`, `game_milestone`, or `challenge_complete` events at the `deep` quality tier.

- **What does "active engagement" look like?** (Browsing menus, managing inventory, social features, casual interaction) → These generate `daily_checkin` or custom events at the `active` tier.

- **Does my game have idle or ambient states?** (Viewing collections, background animations, screensaver modes) → These qualify for `idle_drip` and `ambient_mode` at the `passive` tier.

- **Does my game involve physical movement?** (GPS features, step counting, real-world interaction) → These generate `trail_steps` events at the `active` tier.

- **Does my game have shareable content?** (Screenshots, achievements, creations, scores) → These qualify for `share_verified` and `referral_signup` events.

- **Does my game have anything NOT covered by existing event types?** → Propose a new event type to the Director. Describe the trigger, the suggested hash count, the quality tier, and why it represents genuine attention.

### Step 3: Design Your Spending Sinks

**This is mandatory.** You cannot add earning sources without adding spending sinks. The economy must stay balanced.

Common sink patterns that work across game genres:

| Sink Pattern | Example | Typical Cost |
|-------------|---------|-------------|
| Skip a time gate | "Skip 1 day of growing/building/cooldown" | 5 hashes |
| Unlock premium feature | "Use the special analysis/scan/tool" | 50 hashes |
| Cosmetic purchase | "Buy a skin/theme/decoration" | 15-50 hashes |
| Consumable item | "Buy a boost/powerup/one-time-use item" | 10-100 hashes |
| Reroll/retry | "Get a new random result" | 10-25 hashes |
| Expanded capacity | "Add a slot/page/inventory space" | 20-75 hashes |

Design sinks that feel natural to your game. Players should WANT to spend hashes because the sinks are valuable, not feel forced to spend them.

---

## IMPLEMENTATION — THE CODE

### What You Need to Add

Your game needs four things:

1. **The hash generation pipeline** (~60 lines)
2. **Event triggers** wired into your existing gameplay (~varies)
3. **Tier 1 ambient features** (~200 lines)
4. **Balance display and spending UI** (~varies)

### 1. The Hash Generation Pipeline

This is the core. Copy this into your game's IIFE (or equivalent scope). Adapt to your coding style but preserve the payload structure and hash function.

```javascript
// ============================================
// SWS ATTENTION PROTOCOL — HASH PIPELINE
// ============================================

var GAME_ID = 'your_game_id';  // CHANGE THIS to your registered game_id

// Session ID — generated once per app session
var _sessionId = (function() {
  var arr = new Uint8Array(16);
  if (window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(arr);
  } else {
    for (var i = 0; i < 16; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr, function(b) { return b.toString(16).padStart(2, '0'); }).join('');
})();

// Nonce generator
function _generateNonce() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Get current user UID from Firebase Auth (adapt to your auth setup)
function _getCurrentUid() {
  try {
    var user = firebase.auth().currentUser;
    return user ? user.uid : 'anonymous';
  } catch(e) {
    return 'anonymous';
  }
}

// Build the attention payload
function buildAttentionPayload(eventType, durationMs, interactionCount, qualityTier) {
  return {
    event_type: eventType,
    timestamp: Date.now(),
    session_id: _sessionId,
    duration_ms: durationMs || 0,
    interaction_count: interactionCount || 0,
    quality_tier: qualityTier || 'active',
    game_id: GAME_ID,
    user_uid: _getCurrentUid(),
    nonce: _generateNonce()
  };
}

// SHA-256 hash generation (async with SubtleCrypto, fallback available)
function generateAttentionHash(payload, callback) {
  var sorted = JSON.stringify(payload, Object.keys(payload).sort());
  var encoder = new TextEncoder();
  var data = encoder.encode(sorted);

  if (window.crypto && window.crypto.subtle) {
    window.crypto.subtle.digest('SHA-256', data).then(function(buffer) {
      var hashArray = Array.from(new Uint8Array(buffer));
      var hashHex = hashArray.map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
      callback(hashHex);
    }).catch(function() {
      // Fallback: use a JS SHA-256 implementation if SubtleCrypto fails
      callback(_jsSha256(sorted));
    });
  } else {
    callback(_jsSha256(sorted));
  }
}

// Store hash locally and queue for cloud sync
function storeAttentionHash(hash, eventType, qualityTier) {
  var record = {
    hash: hash,
    event_type: eventType,
    timestamp: Date.now(),
    game_id: GAME_ID,
    quality_tier: qualityTier,
    synced: false
  };

  // localStorage
  var hashes = [];
  try {
    hashes = JSON.parse(localStorage.getItem('sws_attention_hashes') || '[]');
  } catch(e) { hashes = []; }
  hashes.push(record);
  localStorage.setItem('sws_attention_hashes', JSON.stringify(hashes));

  // Update local balance
  var balance = parseInt(localStorage.getItem('sws_hash_balance') || '0', 10);
  localStorage.setItem('sws_hash_balance', String(balance + 1));

  // Queue Firestore sync (implement based on your Firebase setup)
  _queueCloudSync(record);
}

// THE MAIN FUNCTION — call this from your game events
function earnAttentionHash(eventType, durationMs, interactionCount, qualityTier) {
  var payload = buildAttentionPayload(eventType, durationMs, interactionCount, qualityTier);
  generateAttentionHash(payload, function(hash) {
    storeAttentionHash(hash, eventType, qualityTier);
    // Optional: show a toast/notification to the player
    _onHashEarned(hash, eventType);
  });
}

// Override this with your game's UI feedback
function _onHashEarned(hash, eventType) {
  console.log('[Attention] Hash earned:', eventType, hash.substring(0, 8) + '...');
  // Example: showToast('+1 Attention Hash');
}

// Firestore sync — adapt to your Firebase setup
function _queueCloudSync(record) {
  var uid = _getCurrentUid();
  if (uid === 'anonymous') return; // No sync without auth

  try {
    firebase.firestore().collection('vaults').doc(uid)
      .collection('hashes').add(record)
      .then(function() { record.synced = true; })
      .catch(function(err) { console.warn('[Attention] Sync failed:', err); });
  } catch(e) {
    // Will sync on next authenticated session
  }
}
```

**Note on SHA-256 fallback:** If you need a pure JS SHA-256 for environments where SubtleCrypto is unavailable, use a lightweight library (e.g., js-sha256 at ~2KB). The origin game uses SubtleCrypto with a fallback. Do NOT skip hashing — the SHA-256 is what makes these hashes cryptographic proof.

### 2. Wiring Event Triggers

Map your game's existing events to `earnAttentionHash()` calls. Examples across game genres:

**Puzzle / Match Game:**
```javascript
// Player starts a round
earnAttentionHash('game_start', 0, 0, 'deep');

// Player hits a milestone mid-round
earnAttentionHash('game_milestone', elapsedMs, moveCount, 'deep');

// Player completes a round
earnAttentionHash('game_complete', totalRoundMs, totalMoves, 'deep');
```

**Collection / Management Game:**
```javascript
// Player adds item to collection
earnAttentionHash('collection_bonus', 0, 1, 'deep');

// Daily login with meaningful action
earnAttentionHash('daily_checkin', 0, 1, 'active');
```

**Adventure / Exploration Game:**
```javascript
// Player discovers a new area
earnAttentionHash('game_milestone', explorationMs, areasVisited, 'deep');

// Player completes a quest
earnAttentionHash('game_complete', questDurationMs, stepsInQuest, 'deep');
```

**Movement / GPS Game:**
```javascript
// Player walks 200 real steps (measured via haversine GPS distance)
earnAttentionHash('trail_steps_200', walkDurationMs, 200, 'active');

// Player hits 2,000 step milestone
earnAttentionHash('trail_steps_2000', walkDurationMs, 2000, 'active');
```

**The principle:** any moment where you can prove the player was genuinely engaged is a hash opportunity. Don't over-generate — a few well-placed triggers feel rewarding. Dozens of triggers feel like noise.

### 3. Tier 1 Ambient Features

These three features ship with EVERY game. They require ~200 lines total and multiply daily hash earning 5-8x.

#### 3A. Idle Hash Drip

```javascript
// ============================================
// IDLE HASH DRIP — 1 hash per 5 min foreground
// ============================================

var _idleDripTimer = null;
var _idleDripInterval = 5 * 60 * 1000; // 5 minutes
var _lastInteractionTime = Date.now();
var _idleInteractionCount = 0;

// Track user interaction (add to your existing event listeners)
function _trackIdleInteraction() {
  _lastInteractionTime = Date.now();
  _idleInteractionCount++;
}
document.addEventListener('touchstart', _trackIdleInteraction, { passive: true });
document.addEventListener('mousemove', _trackIdleInteraction, { passive: true });
document.addEventListener('keydown', _trackIdleInteraction, { passive: true });

// Start drip when page is visible
function _startIdleDrip() {
  if (_idleDripTimer) return;
  _idleDripTimer = setInterval(function() {
    var timeSinceInteraction = Date.now() - _lastInteractionTime;
    var isAfk = timeSinceInteraction > 30 * 60 * 1000; // 30 min no interaction

    // Still earn if AFK, but at half rate (skip every other tick)
    if (isAfk && Math.random() > 0.5) return;

    earnAttentionHash('idle_drip', _idleDripInterval, _idleInteractionCount, 'passive');
    _idleInteractionCount = 0; // Reset per-interval counter
  }, _idleDripInterval);
}

// Stop drip when page is hidden
function _stopIdleDrip() {
  if (_idleDripTimer) {
    clearInterval(_idleDripTimer);
    _idleDripTimer = null;
  }
}

document.addEventListener('visibilitychange', function() {
  if (document.hidden) {
    _stopIdleDrip();
  } else {
    _startIdleDrip();
  }
});

// Start on load if visible
if (!document.hidden) _startIdleDrip();
```

#### 3B. Tab Return Bonus

```javascript
// ============================================
// TAB RETURN BONUS — hashes for coming back
// ============================================

var _TAB_HIDE_KEY = 'sws_tab_hidden_at';

document.addEventListener('visibilitychange', function() {
  if (document.hidden) {
    localStorage.setItem(_TAB_HIDE_KEY, String(Date.now()));
  } else {
    var hiddenAt = parseInt(localStorage.getItem(_TAB_HIDE_KEY) || '0', 10);
    if (hiddenAt > 0) {
      var minutesAway = (Date.now() - hiddenAt) / 60000;
      if (minutesAway >= 1) {
        var bonus = Math.min(8, Math.floor(Math.log2(minutesAway + 1)));
        for (var i = 0; i < bonus; i++) {
          earnAttentionHash('tab_return', minutesAway * 60000, 0, 'active');
        }
        // Optional: show welcome-back message
        // showToast('Welcome back! +' + bonus + ' attention hashes');
      }
      localStorage.removeItem(_TAB_HIDE_KEY);
    }
  }
});
```

#### 3C. Ambient Mode (Adapt to Your Game's Visual Identity)

```javascript
// ============================================
// AMBIENT MODE — screensaver that earns hashes
// ============================================

var _ambientActive = false;
var _ambientTimer = null;
var _wakeLock = null;
var _AMBIENT_INTERVAL = 3 * 60 * 1000; // 3 minutes

function startAmbientMode() {
  _ambientActive = true;

  // Request screen wake lock
  if ('wakeLock' in navigator) {
    navigator.wakeLock.request('screen').then(function(lock) {
      _wakeLock = lock;
    }).catch(function() { /* Wake lock not available */ });
  }

  // Start hash earning
  _ambientTimer = setInterval(function() {
    earnAttentionHash('ambient_mode', _AMBIENT_INTERVAL, 0, 'passive');
  }, _AMBIENT_INTERVAL);

  // YOUR GAME: Show your ambient display here
  // This should be beautiful — it's the "living wallpaper" that makes
  // people WANT to leave it on. Cycle through the player's collection,
  // show animations, display progress, make it a screensaver worth showing.
  _showAmbientDisplay();
}

function stopAmbientMode() {
  _ambientActive = false;
  if (_ambientTimer) { clearInterval(_ambientTimer); _ambientTimer = null; }
  if (_wakeLock) { _wakeLock.release(); _wakeLock = null; }
  _hideAmbientDisplay();
}

// YOUR GAME: Implement these based on your visual identity
function _showAmbientDisplay() {
  // Show a beautiful, slowly animated view of the player's game state
  // This is game-specific — make it gorgeous
}
function _hideAmbientDisplay() {
  // Return to normal game view
}
```

### 4. Balance Display and Spending

Show the player their hash balance somewhere accessible but not intrusive. A small counter in a settings menu, profile screen, or status bar works well.

```javascript
// Read current balance
function getHashBalance() {
  return parseInt(localStorage.getItem('sws_hash_balance') || '0', 10);
}

// Spend hashes (returns true if sufficient balance)
function spendHashes(amount, reason) {
  var balance = getHashBalance();
  if (balance < amount) return false;

  localStorage.setItem('sws_hash_balance', String(balance - amount));

  // Log the spend for analytics and Firestore sync
  var uid = _getCurrentUid();
  if (uid !== 'anonymous') {
    try {
      firebase.firestore().collection('vaults').doc(uid)
        .collection('spends').add({
          amount: amount,
          reason: reason,
          game_id: GAME_ID,
          timestamp: Date.now()
        });
    } catch(e) { /* Will sync later */ }
  }

  return true;
}

// Example usage in your game:
// if (spendHashes(5, 'skip_timer')) { skipOneDay(); }
// if (spendHashes(50, 'premium_scan')) { runPremiumFeature(); }
```

---

## CROSS-GAME HASH PORTABILITY

This is the killer feature for users. Hashes earned in your game are spendable in any other SWS game, and vice versa.

### How It Works

All games read from and write to the same Firestore vault (`vaults/{uid}`). When your game loads, it syncs the hash balance from Firestore. When the player spends hashes, your game writes the spend to Firestore and other games see the updated balance on their next sync.

### Sync Pattern

```javascript
// On game load (after Firebase Auth)
function syncHashBalance() {
  var uid = _getCurrentUid();
  if (uid === 'anonymous') return;

  firebase.firestore().collection('vaults').doc(uid)
    .collection('balance').doc('current')
    .get().then(function(doc) {
      if (doc.exists) {
        var cloudBalance = doc.data().current || 0;
        localStorage.setItem('sws_hash_balance', String(cloudBalance));
      }
    });
}

// Call after Firebase Auth state changes
firebase.auth().onAuthStateChanged(function(user) {
  if (user) syncHashBalance();
});
```

### What This Means for Your Game

A player might walk into your game with 500 hashes earned from playing Petal Walk. That player can immediately spend those hashes in your game. Conversely, a player who loves your game and earns hashes there might discover Petal Walk and already have spending power.

**This creates a network effect.** Every game makes every other game more valuable. Players who play multiple SWS games earn faster and have more to spend. This is the ecosystem flywheel.

---

## TESTING PROTOCOL

Follow single-variable testing. One new hash source at a time.

### For Each New Hash Source

1. **Implement the trigger** in isolation (no other changes in the same build)
2. **Test on a real device** — confirm the hash is generated and stored in localStorage
3. **Check Firestore** — confirm the hash syncs to the cloud vault
4. **Verify the balance** — confirm the local and cloud balances match
5. **Test the corresponding sink** — confirm hashes can be spent on the new feature
6. **Run for 24 hours** — check for rate limit correctness and no double-earning bugs
7. **Then** add the next hash source

### Psychology Testing (3-Phase)

For every new hash-earning feature:

**Phase 1: Silent (1 week)** — Feature is live but invisible. No toast, no UI. Just data collection. Does it technically work? What are baseline numbers?

**Phase 2: Gentle (1 week)** — Feature shows subtle toast notifications when hashes are earned. Does awareness increase return visits? Does it feel rewarding or annoying?

**Phase 3: Visible (1 week)** — Feature has a visible counter. Does visibility create habit loops? Does it change play patterns? Does it feel like a gift or a job?

**Kill switch:** If any feature causes return-visit rate to DROP, kill it immediately. The game must always feel like a game, never like a time clock.

---

## PROPOSING NEW EVENT TYPES

Your game might have engagement patterns that don't map to existing event types. That's good — it means the protocol is expanding.

### Proposal Template

When proposing a new event type to the Director, provide:

```
EVENT TYPE PROPOSAL
---
event_type name:     [lowercase_with_underscores]
trigger:             [What the player does to earn this]
hashes per trigger:  [How many hashes per event]
quality tier:        [deep | active | passive | background]
daily cap:           [Maximum earning per day from this source]
anti-abuse:          [How you prevent farming/botting this source]
spending sink:       [What new sink ships alongside this earning source]
code footprint:      [Estimated lines of code]
why it's real:       [Why this represents genuine human attention]
```

**The "why it's real" field is the most important.** The Director will approve events that prove genuine engagement and reject events that can be trivially automated. "Player stares at screen" is weak. "Player solves a 3-step puzzle requiring pattern recognition" is strong.

---

## WHAT NOT TO DO

These are hard rules. Violating them will get your integration rejected.

1. **Do NOT generate hashes without genuine engagement.** No hash-on-load, no hash-per-pageview, no hash-for-existing. Every hash must represent real attention.

2. **Do NOT bypass the vault.** Your game does not manage its own hash balance. The Firestore vault is the source of truth. Never mint hashes that don't go through the pipeline.

3. **Do NOT store private data in hash payloads.** No URLs, no message content, no app names, no personal data. The payload contains aggregate metrics only.

4. **Do NOT ship earning sources without spending sinks.** The inflation rule is non-negotiable.

5. **Do NOT make hashes the REASON to play.** The game is the reason to play. Hashes are a bonus that makes the game more rewarding. If your game isn't fun without hashes, fix the game first.

6. **Do NOT implement multiple hash sources simultaneously.** Single-variable testing. One source at a time. Test. Stabilize. Then add the next one.

7. **Do NOT promise financial value for hashes.** Hashes are a virtual engagement metric. They may become tradeable in the future, but no game should imply that earning hashes is earning money.

8. **Do NOT change economy values without Director approval.** Hash earning rates, spending costs, caps, and multipliers are ecosystem-wide decisions. Changing them in one game affects all games.

---

## QUICK-START CHECKLIST

For the fastest integration path:

- [ ] Register your game_id with the Director
- [ ] Copy the hash generation pipeline into your codebase
- [ ] Wire `earnAttentionHash('game_start', ...)` to your game's start event
- [ ] Wire `earnAttentionHash('game_complete', ...)` to your game's completion event
- [ ] Add the idle hash drip (~15 lines)
- [ ] Add the tab return bonus (~15 lines)
- [ ] Design at least one spending sink
- [ ] Wire `spendHashes(amount, reason)` to your sink
- [ ] Show the hash balance somewhere in your UI
- [ ] Test on a real device
- [ ] Ship it
- [ ] Then plan ambient mode and additional triggers for your next build

Total code for minimum viable integration: ~100 lines. Time to first hash: under an hour.

---

## COMMUNICATION CHANNELS

- **Director (Stephen):** All approvals, economy decisions, new game registrations
- **Petal Walk team (Claude):** Origin game reference implementation, protocol spec questions
- **Your game's AI team:** Integration implementation, game-specific event design

When in doubt about whether something is allowed, ask the Director. When in doubt about how something works technically, reference this guide and the ATTENTION_PROTOCOL_SPEC.

---

*Your game is the soul. The protocol makes every minute your players spend more valuable.*
*Build something people love. The hashes will follow.*

*— SWS Attention Protocol Integration Guide v1.0, March 2026*
