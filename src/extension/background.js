/**
 * Grove Keeper Browser Extension — Background Service Worker
 * SWS Proof of Attention Protocol
 *
 * Tracks AGGREGATE browsing time only. Never records URLs, page titles,
 * or any content. Privacy-safe by architecture.
 *
 * Earns 1 attention hash per 10 minutes of active browsing.
 * Cap: 6 hashes/hour, 36 hashes/day.
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending.
 */

// ============================================================
// CONFIGURATION
// ============================================================

const HASH_INTERVAL_MS = 10 * 60 * 1000;  // 10 minutes
const HOURLY_CAP = 6;
const DAILY_CAP = 36;
const IDLE_THRESHOLD_SEC = 120;            // 2 minutes idle = not active
const STORAGE_KEY = 'grove_keeper_state';

// ============================================================
// STATE
// ============================================================

let state = {
  activeMinutesToday: 0,
  hashesEarnedToday: 0,
  hashesEarnedThisHour: 0,
  currentHour: new Date().getHours(),
  currentDate: getTodayKey(),
  lastActiveCheck: Date.now(),
  isActive: false,
  totalSessionMinutes: 0,
  hashes: []
};

// ============================================================
// IDLE DETECTION
// ============================================================

chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SEC);

chrome.idle.onStateChanged.addListener(function(idleState) {
  if (idleState === 'active') {
    state.isActive = true;
    state.lastActiveCheck = Date.now();
  } else {
    // 'idle' or 'locked' — user is away
    state.isActive = false;
  }
  saveState();
});

// ============================================================
// ALARM — Fires every 10 minutes
// ============================================================

chrome.alarms.create('grove_keeper_tick', {
  periodInMinutes: 10
});

chrome.alarms.onAlarm.addListener(function(alarm) {
  if (alarm.name !== 'grove_keeper_tick') return;

  resetIfNewDay();
  resetIfNewHour();

  if (!state.isActive) return;

  // User was active for this 10-minute interval
  state.activeMinutesToday += 10;
  state.totalSessionMinutes += 10;

  // Check caps
  if (state.hashesEarnedThisHour >= HOURLY_CAP) return;
  if (state.hashesEarnedToday >= DAILY_CAP) return;

  // Earn a hash
  earnBrowseHash();
});

// ============================================================
// HASH GENERATION
// ============================================================

async function earnBrowseHash() {
  const payload = {
    event_type: 'extension_browse',
    timestamp: Date.now(),
    session_id: await getSessionId(),
    duration_ms: HASH_INTERVAL_MS,
    interaction_count: 0,
    quality_tier: 'passive',
    game_id: 'grove_keeper_ext',
    user_uid: 'extension_user',
    nonce: Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
  };

  const sorted = JSON.stringify(payload, Object.keys(payload).sort());
  const hash = await sha256(sorted);

  const record = {
    hash: hash,
    event_type: 'extension_browse',
    timestamp: Date.now(),
    game_id: 'grove_keeper_ext',
    quality_tier: 'passive',
    synced: false
  };

  state.hashes.push(record);
  state.hashesEarnedToday++;
  state.hashesEarnedThisHour++;

  // Keep last 500 hashes
  if (state.hashes.length > 500) {
    state.hashes = state.hashes.slice(-500);
  }

  saveState();
}

// ============================================================
// SHA-256
// ============================================================

async function sha256(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  const array = Array.from(new Uint8Array(buffer));
  return array.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================
// SESSION / STATE MANAGEMENT
// ============================================================

async function getSessionId() {
  const result = await chrome.storage.local.get('grove_session_id');
  if (result.grove_session_id) return result.grove_session_id;

  const id = crypto.randomUUID();
  await chrome.storage.local.set({ grove_session_id: id });
  return id;
}

function getTodayKey() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function resetIfNewDay() {
  const today = getTodayKey();
  if (state.currentDate !== today) {
    state.currentDate = today;
    state.hashesEarnedToday = 0;
    state.hashesEarnedThisHour = 0;
    state.activeMinutesToday = 0;
    state.currentHour = new Date().getHours();
  }
}

function resetIfNewHour() {
  const hour = new Date().getHours();
  if (state.currentHour !== hour) {
    state.currentHour = hour;
    state.hashesEarnedThisHour = 0;
  }
}

async function saveState() {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

async function loadState() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  if (result[STORAGE_KEY]) {
    state = { ...state, ...result[STORAGE_KEY] };
  }
  resetIfNewDay();
  state.isActive = true;
  state.lastActiveCheck = Date.now();
}

// ============================================================
// MESSAGE HANDLER (for popup communication)
// ============================================================

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (msg.type === 'get_stats') {
    sendResponse({
      activeMinutesToday: state.activeMinutesToday,
      hashesEarnedToday: state.hashesEarnedToday,
      hashesEarnedThisHour: state.hashesEarnedThisHour,
      dailyCap: DAILY_CAP,
      hourlyCap: HOURLY_CAP,
      totalHashes: state.hashes.length,
      isActive: state.isActive
    });
  } else if (msg.type === 'get_hashes') {
    sendResponse({ hashes: state.hashes });
  } else if (msg.type === 'export_hashes') {
    // Return hashes for syncing to main SWS vault
    sendResponse({ hashes: state.hashes.filter(h => !h.synced) });
  }
  return true;
});

// ============================================================
// INIT
// ============================================================

loadState();
