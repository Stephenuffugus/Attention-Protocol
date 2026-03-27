/**
 * SWS Attention Protocol — Economy Rules Engine
 * Enforces daily caps, quality tier multipliers, inflation rules,
 * and cross-game balance management.
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending.
 */
(function(window) {
  'use strict';

  // ============================================================
  // DAILY CAP DEFINITIONS (per the canonical spec)
  // ============================================================

  var DAILY_CAPS = {
    idle_drip:        { maxPerDay: Infinity, maxPerHour: 12, notes: 'Halves after 30min zero-interaction' },
    ambient_mode:     { maxPerDay: Infinity, maxPerHour: 20, notes: 'Self-limiting by screen-on time' },
    tab_return:       { maxPerDay: Infinity, maxPerEvent: 8, notes: 'Cap 8 hashes per return event' },
    notification_tap: { maxPerDay: 3, maxPerEvent: 2, notes: '3 taps per day, 2 hashes per tap' },
    fitness_import:   { maxPerDay: 10, notes: '10,000 steps max' },
    extension_browse: { maxPerDay: 36, maxPerHour: 6, notes: '6/hr, 36/day' },
    partner_activity: { maxPerDay: 1, notes: '1 hash per partner per day', perPartner: true },
    trail_steps_200:  { maxPerDay: 50, notes: 'Reasonable daily walking cap' },
    trail_steps_2000: { maxPerDay: 5, notes: '10,000 steps in 2K milestones' },
    keyboard_mine:    { maxPerDay: 10, notes: '1 hash per 1,000 keystrokes' },
    screen_time:      { maxPerDay: 24, notes: '1 per 30 min, 12 hours max' },
    share_verified:   { maxPerDay: Infinity, notes: 'No cap on genuine shares' },
    share_viewed:     { maxPerDay: Infinity, notes: 'No cap on views' },
    referral_signup:  { maxPerDay: Infinity, notes: 'No cap on referrals' },
    game_start:       { maxPerDay: Infinity, notes: 'No cap on gameplay' },
    game_complete:    { maxPerDay: Infinity, notes: 'No cap on gameplay' },
    game_milestone:   { maxPerDay: Infinity, notes: 'No cap on gameplay' },
    challenge_complete: { maxPerDay: Infinity, notes: 'No cap on gameplay' },
    collection_bonus: { maxPerDay: Infinity, notes: 'No cap on collection' },
    daily_checkin:    { maxPerDay: 1, notes: '1 per day by definition' },
    page_visit:       { maxPerDay: 100, notes: 'Reasonable page visit cap' }
  };

  // ============================================================
  // QUALITY TIER MULTIPLIERS
  // ============================================================

  var TIER_MULTIPLIERS = {
    deep:       2.0,
    active:     1.0,
    passive:    0.5,
    background: 0.25
  };

  // ============================================================
  // STATE
  // ============================================================

  var CAPS_STORAGE_KEY = 'sws_daily_caps';
  var _currentDate = '';
  var _capCounters = {};

  // ============================================================
  // DAILY RESET
  // ============================================================

  function _getTodayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function _loadOrResetCaps() {
    var today = _getTodayKey();
    if (_currentDate === today && Object.keys(_capCounters).length > 0) return;

    try {
      var stored = JSON.parse(localStorage.getItem(CAPS_STORAGE_KEY) || '{}');
      if (stored.date === today) {
        _capCounters = stored.counters || {};
        _currentDate = today;
        return;
      }
    } catch (e) { /* reset */ }

    // New day — reset all counters
    _capCounters = {};
    _currentDate = today;
    _persistCaps();
  }

  function _persistCaps() {
    try {
      localStorage.setItem(CAPS_STORAGE_KEY, JSON.stringify({
        date: _currentDate,
        counters: _capCounters
      }));
    } catch (e) { /* storage full */ }
  }

  // ============================================================
  // CAP CHECK
  // ============================================================

  /**
   * Check if an event type can still earn hashes today.
   * Returns { allowed: boolean, remaining: number, reason: string }
   */
  function checkCap(eventType) {
    _loadOrResetCaps();

    var cap = DAILY_CAPS[eventType];
    if (!cap) {
      // Unknown event type — allow but warn
      return { allowed: true, remaining: Infinity, reason: 'unknown_event_type' };
    }

    var count = _capCounters[eventType] || 0;

    if (cap.maxPerDay !== Infinity && count >= cap.maxPerDay) {
      return {
        allowed: false,
        remaining: 0,
        reason: 'daily_cap_reached',
        cap: cap.maxPerDay,
        earned: count
      };
    }

    // Hourly cap check
    if (cap.maxPerHour) {
      var hourKey = eventType + '_hour_' + new Date().getHours();
      var hourCount = _capCounters[hourKey] || 0;
      if (hourCount >= cap.maxPerHour) {
        return {
          allowed: false,
          remaining: 0,
          reason: 'hourly_cap_reached',
          cap: cap.maxPerHour,
          earned: hourCount
        };
      }
    }

    var remaining = cap.maxPerDay === Infinity ? Infinity : (cap.maxPerDay - count);
    return { allowed: true, remaining: remaining, reason: 'ok' };
  }

  /**
   * Record that a hash was earned for cap tracking.
   */
  function recordEarning(eventType, count) {
    _loadOrResetCaps();
    count = count || 1;

    _capCounters[eventType] = (_capCounters[eventType] || 0) + count;

    // Track hourly too
    var cap = DAILY_CAPS[eventType];
    if (cap && cap.maxPerHour) {
      var hourKey = eventType + '_hour_' + new Date().getHours();
      _capCounters[hourKey] = (_capCounters[hourKey] || 0) + count;
    }

    _persistCaps();
  }

  // ============================================================
  // TIER MULTIPLIER
  // ============================================================

  /**
   * Get the earning multiplier for a quality tier.
   * Deep focus earns 2x, active 1x, passive 0.5x, background 0.25x.
   */
  function getMultiplier(qualityTier) {
    return TIER_MULTIPLIERS[qualityTier] || 1.0;
  }

  /**
   * Calculate effective hash count after applying tier multiplier.
   * Uses probabilistic rounding for fractional hashes.
   */
  function applyMultiplier(baseCount, qualityTier) {
    var multiplier = getMultiplier(qualityTier);
    var effective = baseCount * multiplier;
    var whole = Math.floor(effective);
    var frac = effective - whole;

    // Probabilistic rounding: 0.5x passive has 50% chance of earning each hash
    if (frac > 0 && Math.random() < frac) {
      whole += 1;
    }

    return Math.max(0, whole);
  }

  // ============================================================
  // INFLATION RULE ENFORCEMENT
  // ============================================================

  var _registeredSinks = {};
  var _registeredSources = {};

  /**
   * Register an earning source with its paired spending sink.
   * Enforces the inflation rule: every source must have a sink.
   */
  function registerSource(eventType, sinkDescription) {
    _registeredSources[eventType] = {
      registered: Date.now(),
      sink: sinkDescription
    };
  }

  function registerSink(sinkId, description, costRange) {
    _registeredSinks[sinkId] = {
      description: description,
      costRange: costRange,
      registered: Date.now()
    };
  }

  /**
   * Check if an earning source has a registered spending sink.
   */
  function hasMatchingSink(eventType) {
    return !!_registeredSources[eventType] && !!_registeredSources[eventType].sink;
  }

  // ============================================================
  // CROSS-GAME BALANCE MANAGEMENT
  // ============================================================

  /**
   * Load balance from Firestore vault (source of truth).
   * Falls back to localStorage if offline.
   */
  function loadVaultBalance(uid, callback) {
    if (typeof firebase === 'undefined' || !uid || uid === 'anonymous') {
      var local = parseInt(localStorage.getItem('sws_hash_balance') || '0', 10);
      callback({ current: local, total_earned: local, total_spent: 0, source: 'local' });
      return;
    }

    firebase.firestore().collection('vaults').doc(uid)
      .collection('balance').doc('current')
      .get()
      .then(function(doc) {
        if (doc.exists) {
          var data = doc.data();
          // Sync local with cloud
          localStorage.setItem('sws_hash_balance', String(data.current || 0));
          callback({
            current: data.current || 0,
            total_earned: data.total_earned || 0,
            total_spent: data.total_spent || 0,
            source: 'firestore'
          });
        } else {
          var local = parseInt(localStorage.getItem('sws_hash_balance') || '0', 10);
          callback({ current: local, total_earned: local, total_spent: 0, source: 'local_new' });
        }
      })
      .catch(function() {
        var local = parseInt(localStorage.getItem('sws_hash_balance') || '0', 10);
        callback({ current: local, total_earned: local, total_spent: 0, source: 'local_offline' });
      });
  }

  /**
   * Validate a spend request against the vault balance.
   * Returns { approved: boolean, balance: number, reason: string }
   */
  function validateSpend(amount, reason) {
    var balance = parseInt(localStorage.getItem('sws_hash_balance') || '0', 10);
    if (amount <= 0) return { approved: false, balance: balance, reason: 'invalid_amount' };
    if (balance < amount) return { approved: false, balance: balance, reason: 'insufficient_balance' };
    return { approved: true, balance: balance, reason: 'ok' };
  }

  // ============================================================
  // ECONOMY HEALTH METRICS
  // ============================================================

  function getEconomyStats() {
    _loadOrResetCaps();
    var stats = {
      date: _currentDate,
      caps: {},
      registeredSources: Object.keys(_registeredSources).length,
      registeredSinks: Object.keys(_registeredSinks).length
    };

    for (var eventType in DAILY_CAPS) {
      if (DAILY_CAPS.hasOwnProperty(eventType)) {
        var cap = DAILY_CAPS[eventType];
        var earned = _capCounters[eventType] || 0;
        stats.caps[eventType] = {
          earned: earned,
          maxPerDay: cap.maxPerDay,
          remaining: cap.maxPerDay === Infinity ? Infinity : Math.max(0, cap.maxPerDay - earned),
          pctUsed: cap.maxPerDay === Infinity ? 0 : Math.round((earned / cap.maxPerDay) * 100)
        };
      }
    }

    return stats;
  }

  // ============================================================
  // EXPORT
  // ============================================================

  window.SWSEconomy = {
    checkCap: checkCap,
    recordEarning: recordEarning,
    getMultiplier: getMultiplier,
    applyMultiplier: applyMultiplier,
    registerSource: registerSource,
    registerSink: registerSink,
    hasMatchingSink: hasMatchingSink,
    loadVaultBalance: loadVaultBalance,
    validateSpend: validateSpend,
    getEconomyStats: getEconomyStats,
    DAILY_CAPS: DAILY_CAPS,
    TIER_MULTIPLIERS: TIER_MULTIPLIERS
  };

})(window);
