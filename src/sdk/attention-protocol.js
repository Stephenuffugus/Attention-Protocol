/**
 * SWS Proof of Attention Protocol — Core SDK
 * Version: 1.0.0
 * (c) 2026 SWS Strategic Media LLC. Patent Pending.
 *
 * Drop this script on any page to begin generating
 * cryptographic attention hashes from genuine user engagement.
 *
 * Usage:
 *   <script src="attention-protocol.js"
 *           data-game-id="your_game_id"
 *           data-firebase-config='{ ... }'>
 *   </script>
 *
 * Or initialize manually:
 *   SWSAttention.init({ gameId: 'your_game_id', firebaseConfig: { ... } });
 */
(function(window, document) {
  'use strict';

  // ============================================================
  // CONFIGURATION
  // ============================================================

  var DEFAULT_CONFIG = {
    gameId: 'sws_default',
    idleDripIntervalMs: 5 * 60 * 1000,     // 5 minutes
    ambientIntervalMs: 3 * 60 * 1000,       // 3 minutes
    afkThresholdMs: 30 * 60 * 1000,         // 30 minutes no interaction
    tabReturnMinMinutes: 1,
    tabReturnMaxHashes: 8,
    notificationTapMax: 3,
    localStorageKey: 'sws_attention_hashes',
    balanceKey: 'sws_hash_balance',
    tabHideKey: 'sws_tab_hidden_at',
    enableIdleDrip: true,
    enableTabReturn: true,
    enableAmbientMode: true,
    enableBehavioralAnalysis: true,
    onHashEarned: null,                     // callback(hash, eventType, qualityTier)
    onSyncComplete: null,                   // callback(count)
    debug: false
  };

  // ============================================================
  // STATE
  // ============================================================

  var _config = {};
  var _sessionId = '';
  var _initialized = false;
  var _firebaseAvailable = false;
  var _currentUid = 'anonymous';

  // Offline sync queue with retry
  var _syncQueue = [];
  var _syncRetryTimer = null;
  var _syncRetryCount = 0;
  var _maxSyncRetries = 5;
  var _syncRetryBaseMs = 2000; // exponential backoff: 2s, 4s, 8s, 16s, 32s

  // Hash generation rate limiting
  var _lastHashTime = 0;
  var _hashMinIntervalMs = 500; // min 500ms between hashes to prevent floods
  var _hashBurstCount = 0;
  var _hashBurstWindowMs = 10000;
  var _hashBurstLimit = 20; // max 20 hashes per 10 seconds

  // Idle drip state
  var _idleDripTimer = null;
  var _lastInteractionTime = Date.now();
  var _idleInteractionCount = 0;

  // Ambient mode state
  var _ambientActive = false;
  var _ambientTimer = null;
  var _wakeLock = null;

  // Behavioral analysis state
  var _interactionTimestamps = [];
  var _tapLog = [];
  var _touchRadii = [];
  var _scrollLog = [];
  var _sessionStartTime = Date.now();
  var _tierMinutes = { deep: 0, active: 0, passive: 0, background: 0 };
  var _lastTierCheck = Date.now();
  var _currentTier = 'active';

  // Hick's Law state — tracks decision points and response times
  var _decisionLog = []; // [{optionCount, responseTimeMs, timestamp}, ...]

  // Micro-Pause state — tracks content render → first interaction delays
  var _renderLog = [];   // [{renderTime, firstInteractionTime, contentComplexity}, ...]
  var _lastRenderTime = 0;
  var _pendingRender = false;

  // Daily cap tracking
  var _dailyCaps = {};
  var _dailyCapDate = '';

  // ============================================================
  // UTILITY FUNCTIONS
  // ============================================================

  function _log() {
    if (_config.debug) {
      var args = ['[SWS Attention]'].concat(Array.prototype.slice.call(arguments));
      console.log.apply(console, args);
    }
  }

  function _generateSessionId() {
    var arr = new Uint8Array(16);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(arr);
    } else {
      for (var i = 0; i < 16; i++) arr[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(arr, function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  function _generateNonce() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  function _getCurrentUid() {
    return _currentUid;
  }

  // ============================================================
  // SHA-256 HASHING
  // ============================================================

  function _sha256(str, callback) {
    var encoder = new TextEncoder();
    var data = encoder.encode(str);

    if (window.crypto && window.crypto.subtle) {
      window.crypto.subtle.digest('SHA-256', data).then(function(buffer) {
        var hashArray = Array.from(new Uint8Array(buffer));
        var hashHex = hashArray.map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
        callback(hashHex);
      }).catch(function() {
        callback(_jsSha256(str));
      });
    } else {
      callback(_jsSha256(str));
    }
  }

  // Minimal JS SHA-256 fallback
  function _jsSha256(str) {
    function rightRotate(value, amount) { return (value >>> amount) | (value << (32 - amount)); }
    var mathPow = Math.pow;
    var maxWord = mathPow(2, 32);
    var lengthProperty = 'length';
    var i, j;
    var result = '';
    var words = [];
    var asciiBitLength = str[lengthProperty] * 8;
    var hash = [];
    var k = [];
    var primeCounter = 0;

    var isComposite = {};
    for (var candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) { isComposite[i] = candidate; }
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }

    str += '\x80';
    while (str[lengthProperty] % 64 - 56) str += '\x00';
    for (i = 0; i < str[lengthProperty]; i++) {
      j = str.charCodeAt(i);
      if (j >> 8) return '';
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words[lengthProperty]] = ((asciiBitLength / maxWord) | 0);
    words[words[lengthProperty]] = (asciiBitLength);

    for (j = 0; j < words[lengthProperty];) {
      var w = words.slice(j, j += 16);
      var oldHash = hash;
      hash = hash.slice(0, 8);

      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2];
        var a = hash[0], e = hash[4];
        var temp1 = hash[7]
          + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
          + ((e & hash[5]) ^ ((~e) & hash[6]))
          + k[i]
          + (w[i] = (i < 16) ? w[i] : (
            w[i - 16]
            + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
            + w[i - 7]
            + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
          ) | 0);
        var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
          + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }

      for (i = 0; i < 8; i++) {
        hash[i] = (hash[i] + oldHash[i]) | 0;
      }
    }

    for (i = 0; i < 8; i++) {
      for (j = 3; j + 1; j--) {
        var b = (hash[i] >> (j * 8)) & 255;
        result += ((b < 16) ? '0' : '') + b.toString(16);
      }
    }
    return result;
  }

  // ============================================================
  // BEHAVIORAL SCIENCE ANALYSIS
  // ============================================================

  var Behavioral = {
    // Pattern 1: Interaction Timing Entropy
    recordInteraction: function() {
      _interactionTimestamps.push(Date.now());
      if (_interactionTimestamps.length > 200) _interactionTimestamps.shift();
    },

    computeTimingCV: function() {
      if (_interactionTimestamps.length < 10) return 0.8; // insufficient data, assume human
      var intervals = [];
      for (var i = 1; i < _interactionTimestamps.length; i++) {
        intervals.push(_interactionTimestamps[i] - _interactionTimestamps[i - 1]);
      }
      var mean = intervals.reduce(function(a, b) { return a + b; }, 0) / intervals.length;
      if (mean === 0) return 0;
      var variance = intervals.reduce(function(a, b) { return a + Math.pow(b - mean, 2); }, 0) / intervals.length;
      return Math.sqrt(variance) / mean;
    },

    // Pattern 2: Fitts' Law Compliance
    recordTap: function(event) {
      var touch = event.touches ? event.touches[0] : event;
      if (touch && touch.clientX !== undefined) {
        _tapLog.push({ x: touch.clientX, y: touch.clientY, t: Date.now() });
        if (_tapLog.length > 100) _tapLog.shift();
      }
    },

    computeFittsCompliance: function() {
      if (_tapLog.length < 10) return 0.5;
      var distances = [], times = [];
      for (var i = 1; i < _tapLog.length; i++) {
        var dx = _tapLog[i].x - _tapLog[i - 1].x;
        var dy = _tapLog[i].y - _tapLog[i - 1].y;
        distances.push(Math.sqrt(dx * dx + dy * dy));
        times.push(_tapLog[i].t - _tapLog[i - 1].t);
      }
      var n = distances.length;
      var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
      for (var j = 0; j < n; j++) {
        var x = Math.log2(distances[j] + 1);
        var y = times[j];
        sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x; sumY2 += y * y;
      }
      var denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
      if (denom === 0) return 0.5;
      var r = (n * sumXY - sumX * sumY) / denom;
      return isNaN(r) ? 0.5 : Math.max(0, Math.min(1, (r + 1) / 2));
    },

    // Pattern 4: Scroll Saccade Analysis
    recordScroll: function() {
      _scrollLog.push({ y: window.scrollY, t: Date.now() });
      if (_scrollLog.length > 500) _scrollLog.shift();
    },

    computeScrollSaccade: function() {
      if (_scrollLog.length < 20) return 0.5;
      var fixations = 0;
      var pauseStart = null;
      for (var i = 1; i < _scrollLog.length; i++) {
        var dt = _scrollLog[i].t - _scrollLog[i - 1].t;
        var dy = Math.abs(_scrollLog[i].y - _scrollLog[i - 1].y);
        var velocity = dy / (dt || 1);
        if (velocity < 0.1 && dt > 200) {
          if (!pauseStart) pauseStart = _scrollLog[i - 1].t;
          if (_scrollLog[i].t - pauseStart > 300) { fixations++; pauseStart = null; }
        } else {
          pauseStart = null;
        }
      }
      return Math.min(1, fixations / 4);
    },

    // Pattern 6: Touch Pressure/Contact Area Variation
    recordTouch: function(event) {
      var touch = event.touches ? event.touches[0] : null;
      if (touch && touch.radiusX !== undefined) {
        _touchRadii.push({ rx: touch.radiusX, ry: touch.radiusY, force: touch.force || 0 });
        if (_touchRadii.length > 100) _touchRadii.shift();
      }
    },

    computeTouchVariance: function() {
      if (_touchRadii.length < 10) return 0.5;
      var rxVals = _touchRadii.map(function(t) { return t.rx; });
      var mean = rxVals.reduce(function(a, b) { return a + b; }, 0) / rxVals.length;
      var variance = rxVals.reduce(function(a, b) { return a + Math.pow(b - mean, 2); }, 0) / rxVals.length;
      return Math.min(1, variance / 2);
    },

    // Pattern 3: Hick's Law Compliance (Decision Time Scaling)
    // Human decision time increases logarithmically with number of choices: RT = a + b * log2(n)
    // Bots respond in constant time regardless of choice count
    recordDecision: function(optionCount, responseTimeMs) {
      _decisionLog.push({
        optionCount: optionCount,
        responseTimeMs: responseTimeMs,
        timestamp: Date.now()
      });
      if (_decisionLog.length > 50) _decisionLog.shift();
    },

    computeHicksCompliance: function() {
      if (_decisionLog.length < 5) return 0.5; // insufficient data, assume neutral

      // Group decisions by option count and compute average response time per group
      var groups = {};
      _decisionLog.forEach(function(d) {
        var key = d.optionCount;
        if (!groups[key]) groups[key] = [];
        groups[key].push(d.responseTimeMs);
      });

      var groupKeys = Object.keys(groups).map(Number).sort(function(a, b) { return a - b; });
      if (groupKeys.length < 2) return 0.5; // need at least 2 different option counts

      // Compute Pearson correlation between log2(optionCount) and avg response time
      var xs = [], ys = [];
      groupKeys.forEach(function(count) {
        var times = groups[count];
        var avgTime = times.reduce(function(a, b) { return a + b; }, 0) / times.length;
        xs.push(Math.log2(count));
        ys.push(avgTime);
      });

      var n = xs.length;
      var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
      for (var i = 0; i < n; i++) {
        sumX += xs[i]; sumY += ys[i]; sumXY += xs[i] * ys[i];
        sumX2 += xs[i] * xs[i]; sumY2 += ys[i] * ys[i];
      }
      var denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
      if (denom < 0.001) return 0.3; // Near-zero variance in RT = suspicious (bot-like constant timing)
      var r = (n * sumXY - sumX * sumY) / denom;

      // Positive correlation = human (response time scales with choices per Hick's Law)
      // Zero/negative = bot (constant or inverse time regardless of choices)
      // Map: r <= 0 → 0.0 (definite bot), r >= 0.7 → 1.0 (definite human)
      if (isNaN(r)) return 0.5;
      return Math.max(0, Math.min(1, r / 0.7));
    },

    // Pattern 5: Micro-Pause Analysis (Cognitive Processing Delay)
    // Humans exhibit 200-600ms delay between new content and first interaction (neural processing)
    // Bots interact within 0-50ms (no visual processing needed)
    recordContentRender: function(contentComplexity) {
      // contentComplexity: 'simple' (buttons/icons), 'moderate' (text+images), 'complex' (dense data/forms)
      _lastRenderTime = Date.now();
      _pendingRender = true;
      _renderLog.push({
        renderTime: _lastRenderTime,
        firstInteractionTime: null,
        contentComplexity: contentComplexity || 'moderate'
      });
      if (_renderLog.length > 50) _renderLog.shift();
    },

    recordFirstInteractionAfterRender: function() {
      if (!_pendingRender) return;
      _pendingRender = false;
      var now = Date.now();
      // Find the most recent render without a recorded interaction
      for (var i = _renderLog.length - 1; i >= 0; i--) {
        if (_renderLog[i].firstInteractionTime === null) {
          _renderLog[i].firstInteractionTime = now;
          break;
        }
      }
    },

    computeMicroPauseScore: function() {
      var completed = _renderLog.filter(function(r) { return r.firstInteractionTime !== null; });
      if (completed.length < 3) return 0.5; // insufficient data

      var complexityRanges = {
        simple:   { min: 150, max: 800 },
        moderate: { min: 250, max: 1500 },
        complex:  { min: 400, max: 3000 }
      };

      var humanLikeCount = 0;
      var varianceSum = 0;
      var delays = [];

      completed.forEach(function(r) {
        var delay = r.firstInteractionTime - r.renderTime;
        delays.push(delay);
        var range = complexityRanges[r.contentComplexity] || complexityRanges.moderate;

        // Human-like: delay within expected range for content complexity
        if (delay >= range.min && delay <= range.max) {
          humanLikeCount++;
        }
      });

      // Check variance — humans have variable delays, bots have constant
      if (delays.length >= 3) {
        var mean = delays.reduce(function(a, b) { return a + b; }, 0) / delays.length;
        varianceSum = delays.reduce(function(a, b) { return a + Math.pow(b - mean, 2); }, 0) / delays.length;
      }

      var ratioScore = humanLikeCount / completed.length;
      var varianceScore = Math.min(1, Math.sqrt(varianceSum) / 500); // High variance = human

      // Combine: ratio of human-range delays + variance of delays
      return ratioScore * 0.6 + varianceScore * 0.4;
    },

    // Composite Human Confidence Score
    computeHumanConfidence: function() {
      var timingCV = this.computeTimingCV();
      var timingScore = Math.min(1, Math.max(0, (timingCV - 0.1) / 1.0));

      var fittsScore = this.computeFittsCompliance();
      var scrollScore = this.computeScrollSaccade();
      var touchScore = this.computeTouchVariance();
      var microPauseScore = this.computeMicroPauseScore();
      var hicksScore = this.computeHicksCompliance();

      var composite = (
        timingScore * 0.25 +
        fittsScore * 0.20 +
        hicksScore * 0.10 +
        scrollScore * 0.15 +
        microPauseScore * 0.15 +
        touchScore * 0.15
      );

      return {
        composite: composite,
        timing: timingScore,
        fitts: fittsScore,
        hicks: hicksScore,
        scroll: scrollScore,
        microPause: microPauseScore,
        touch: touchScore
      };
    },

    // Map confidence to max quality tier
    getMaxTier: function() {
      var score = this.computeHumanConfidence().composite;
      if (score > 0.75) return 'deep';
      if (score > 0.50) return 'active';
      if (score > 0.25) return 'passive';
      return 'background';
    }
  };

  // ============================================================
  // FOCUS SCORE
  // ============================================================

  function _updateTierMinutes() {
    var now = Date.now();
    var elapsed = (now - _lastTierCheck) / 60000; // minutes
    _tierMinutes[_currentTier] = (_tierMinutes[_currentTier] || 0) + elapsed;
    _lastTierCheck = now;
  }

  function _computeFocusScore() {
    _updateTierMinutes();
    var weights = { deep: 1.0, active: 0.7, passive: 0.3, background: 0.1 };
    var totalMinutes = 0;
    var weightedSum = 0;
    for (var tier in _tierMinutes) {
      if (_tierMinutes.hasOwnProperty(tier)) {
        totalMinutes += _tierMinutes[tier];
        weightedSum += _tierMinutes[tier] * (weights[tier] || 0);
      }
    }
    if (totalMinutes === 0) return 50;
    return Math.round((weightedSum / totalMinutes) * 100);
  }

  // ============================================================
  // HASH GENERATION PIPELINE
  // ============================================================

  function _buildPayload(eventType, durationMs, interactionCount, qualityTier) {
    return {
      event_type: eventType,
      timestamp: Date.now(),
      session_id: _sessionId,
      duration_ms: durationMs || 0,
      interaction_count: interactionCount || 0,
      quality_tier: qualityTier || 'active',
      game_id: _config.gameId,
      user_uid: _getCurrentUid(),
      nonce: _generateNonce()
    };
  }

  function _generateHash(payload, callback) {
    var sorted = JSON.stringify(payload, Object.keys(payload).sort());
    _sha256(sorted, callback);
  }

  function _storeHash(hash, eventType, qualityTier, payload) {
    var record = {
      hash: hash,
      event_type: eventType,
      timestamp: Date.now(),
      game_id: _config.gameId,
      quality_tier: qualityTier,
      duration_ms: payload.duration_ms || 0,
      interaction_count: payload.interaction_count || 0,
      synced: false
    };

    // localStorage with overflow protection
    var hashes = [];
    try {
      hashes = JSON.parse(localStorage.getItem(_config.localStorageKey) || '[]');
    } catch (e) { hashes = []; }

    // Cap local storage at 10,000 hashes to prevent overflow
    if (hashes.length >= 10000) {
      // Keep newest 8,000, discard oldest 2,000
      hashes = hashes.slice(-8000);
      _log('Hash storage trimmed to prevent overflow');
    }

    hashes.push(record);

    try {
      localStorage.setItem(_config.localStorageKey, JSON.stringify(hashes));
    } catch (e) {
      // localStorage full — trim more aggressively
      hashes = hashes.slice(-1000);
      try {
        localStorage.setItem(_config.localStorageKey, JSON.stringify(hashes));
      } catch (e2) {
        _log('localStorage critically full — hash stored in memory only');
      }
    }

    // Update local balance
    var balance = parseInt(localStorage.getItem(_config.balanceKey) || '0', 10);
    try {
      localStorage.setItem(_config.balanceKey, String(balance + 1));
    } catch (e) { /* non-critical */ }

    // Firestore sync with retry queue
    _syncHashToCloud(record);

    _log('Hash earned:', eventType, hash.substring(0, 12) + '...', '(' + qualityTier + ')');

    if (typeof _config.onHashEarned === 'function') {
      try {
        _config.onHashEarned(hash, eventType, qualityTier);
      } catch (e) {
        _log('onHashEarned callback error:', e.message);
      }
    }
  }

  // ============================================================
  // PUBLIC API: EARN + SPEND
  // ============================================================

  function earnHash(eventType, durationMs, interactionCount, qualityTier) {
    if (!_initialized) return;

    // Input validation
    if (typeof eventType !== 'string' || eventType.length === 0 || eventType.length > 64) {
      _log('Invalid event type:', eventType);
      return;
    }
    var validTiers = { deep: 1, active: 1, passive: 1, background: 1 };
    if (!validTiers[qualityTier]) qualityTier = 'active';
    durationMs = Math.max(0, parseInt(durationMs, 10) || 0);
    interactionCount = Math.max(0, parseInt(interactionCount, 10) || 0);

    // Rate limiting — prevent hash flood
    var now = Date.now();
    if (now - _lastHashTime < _hashMinIntervalMs) {
      _hashBurstCount++;
      if (_hashBurstCount > _hashBurstLimit) {
        _log('Rate limited: too many hashes too fast');
        return;
      }
    } else {
      // Reset burst window
      if (now - _lastHashTime > _hashBurstWindowMs) _hashBurstCount = 0;
    }
    _lastHashTime = now;

    // Enforce max tier from behavioral analysis
    if (_config.enableBehavioralAnalysis) {
      var maxTier = Behavioral.getMaxTier();
      var tierRank = { deep: 3, active: 2, passive: 1, background: 0 };
      if (tierRank[qualityTier] > tierRank[maxTier]) {
        _log('Tier downgraded:', qualityTier, '->', maxTier, '(behavioral analysis)');
        qualityTier = maxTier;
      }
    }

    // Economy cap check (if economy engine is loaded)
    if (window.SWSEconomy && typeof window.SWSEconomy.checkCap === 'function') {
      var capCheck = window.SWSEconomy.checkCap(eventType);
      if (!capCheck.allowed) {
        _log('Cap reached for', eventType, ':', capCheck.reason);
        return;
      }
    }

    // Update current tier tracking
    _currentTier = qualityTier;
    _updateTierMinutes();

    var payload = _buildPayload(eventType, durationMs, interactionCount, qualityTier);
    _generateHash(payload, function(hash) {
      _storeHash(hash, eventType, qualityTier, payload);

      // Record earning in economy engine
      if (window.SWSEconomy && typeof window.SWSEconomy.recordEarning === 'function') {
        window.SWSEconomy.recordEarning(eventType, 1);
      }
    });
  }

  function spendHashes(amount, reason) {
    var balance = parseInt(localStorage.getItem(_config.balanceKey) || '0', 10);
    if (balance < amount) return false;

    localStorage.setItem(_config.balanceKey, String(balance - amount));

    // Log spend to Firestore
    if (_firebaseAvailable && _currentUid !== 'anonymous') {
      try {
        firebase.firestore().collection('vaults').doc(_currentUid)
          .collection('spends').add({
            amount: amount,
            reason: reason,
            game_id: _config.gameId,
            timestamp: Date.now()
          });
      } catch (e) { /* Will sync later */ }
    }

    _log('Spent', amount, 'hashes for:', reason);
    return true;
  }

  function getBalance() {
    return parseInt(localStorage.getItem(_config.balanceKey) || '0', 10);
  }

  function getHashes() {
    try {
      return JSON.parse(localStorage.getItem(_config.localStorageKey) || '[]');
    } catch (e) { return []; }
  }

  function getStats() {
    var hashes = getHashes();
    var tiers = { deep: 0, active: 0, passive: 0, background: 0 };
    var events = {};
    hashes.forEach(function(h) {
      tiers[h.quality_tier] = (tiers[h.quality_tier] || 0) + 1;
      events[h.event_type] = (events[h.event_type] || 0) + 1;
    });
    var confidence = _config.enableBehavioralAnalysis ? Behavioral.computeHumanConfidence() : null;
    return {
      totalHashes: hashes.length,
      balance: getBalance(),
      focusScore: _computeFocusScore(),
      tierDistribution: tiers,
      eventDistribution: events,
      humanConfidence: confidence,
      sessionDurationMs: Date.now() - _sessionStartTime,
      synced: hashes.filter(function(h) { return h.synced; }).length,
      unsynced: hashes.filter(function(h) { return !h.synced; }).length
    };
  }

  // ============================================================
  // FIREBASE / FIRESTORE SYNC
  // ============================================================

  function _initFirebase(firebaseConfig) {
    if (typeof firebase === 'undefined') {
      _log('Firebase SDK not loaded — hashes will be stored locally only');
      return;
    }

    try {
      if (!firebase.apps || firebase.apps.length === 0) {
        if (firebaseConfig && firebaseConfig.apiKey) {
          firebase.initializeApp(firebaseConfig);
        } else {
          _log('No Firebase config provided — local storage only');
          return;
        }
      }

      _firebaseAvailable = true;

      // Anonymous auth
      firebase.auth().signInAnonymously().catch(function(error) {
        _log('Anonymous auth failed:', error.code);
      });

      firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
          _currentUid = user.uid;
          _log('Authenticated as:', user.uid, user.isAnonymous ? '(anonymous)' : '');
          _syncUnsyncedHashes(user.uid);
          _drainSyncQueue(); // Flush any queued hashes
        }
      });
    } catch (e) {
      _log('Firebase init error:', e.message);
    }
  }

  function _syncHashToCloud(record) {
    if (!_firebaseAvailable || _currentUid === 'anonymous') {
      // Queue for later sync
      _syncQueue.push(record);
      return;
    }

    _attemptSync(record, 0);
  }

  function _attemptSync(record, retryCount) {
    try {
      firebase.firestore().collection('vaults').doc(_currentUid)
        .collection('hashes').add({
          hash: record.hash,
          event_type: record.event_type,
          timestamp: record.timestamp,
          game_id: record.game_id,
          quality_tier: record.quality_tier,
          duration_ms: record.duration_ms || 0,
          interaction_count: record.interaction_count || 0,
          synced: true
        })
        .then(function() {
          record.synced = true;
          _markHashSynced(record.hash);
          _syncRetryCount = 0; // Reset on success
        })
        .catch(function(err) {
          _log('Sync failed (attempt ' + (retryCount + 1) + '):', err.message);
          if (retryCount < _maxSyncRetries) {
            var delay = _syncRetryBaseMs * Math.pow(2, retryCount);
            setTimeout(function() {
              _attemptSync(record, retryCount + 1);
            }, delay);
          } else {
            _syncQueue.push(record);
            _log('Max retries reached, queued for later sync');
          }
        });
    } catch (e) {
      _syncQueue.push(record);
    }
  }

  function _markHashSynced(hashValue) {
    try {
      var hashes = JSON.parse(localStorage.getItem(_config.localStorageKey) || '[]');
      var match = hashes.find(function(h) { return h.hash === hashValue; });
      if (match) match.synced = true;
      localStorage.setItem(_config.localStorageKey, JSON.stringify(hashes));
    } catch (e) { /* non-critical */ }
  }

  function _drainSyncQueue() {
    if (_syncQueue.length === 0 || !_firebaseAvailable || _currentUid === 'anonymous') return;
    _log('Draining sync queue:', _syncQueue.length, 'hashes');
    var queue = _syncQueue.splice(0);
    queue.forEach(function(record) {
      _attemptSync(record, 0);
    });
  }

  function _syncUnsyncedHashes(uid) {
    var hashes = [];
    try {
      hashes = JSON.parse(localStorage.getItem(_config.localStorageKey) || '[]');
    } catch (e) { return; }

    var unsynced = hashes.filter(function(h) { return !h.synced; });
    if (unsynced.length === 0) return;

    _log('Syncing', unsynced.length, 'hashes to Firestore...');

    var syncCount = 0;
    unsynced.forEach(function(record) {
      firebase.firestore().collection('vaults').doc(uid)
        .collection('hashes').add({
          hash: record.hash,
          event_type: record.event_type,
          timestamp: record.timestamp,
          game_id: record.game_id,
          quality_tier: record.quality_tier,
          duration_ms: record.duration_ms || 0,
          interaction_count: record.interaction_count || 0,
          synced: true
        })
        .then(function() {
          record.synced = true;
          syncCount++;
          localStorage.setItem(_config.localStorageKey, JSON.stringify(hashes));
          if (syncCount === unsynced.length && typeof _config.onSyncComplete === 'function') {
            _config.onSyncComplete(syncCount);
          }
        })
        .catch(function(err) { _log('Sync failed for hash:', err.message); });
    });

    // Update balance document
    firebase.firestore().collection('vaults').doc(uid)
      .collection('balance').doc('current')
      .set({
        total_earned: hashes.length,
        total_spent: 0,
        current: hashes.length,
        last_updated: Date.now(),
        game_id: _config.gameId
      }, { merge: true });
  }

  // ============================================================
  // TIER 1 FEATURES: IDLE DRIP, TAB RETURN, AMBIENT MODE
  // ============================================================

  function _trackInteraction(event) {
    _lastInteractionTime = Date.now();
    _idleInteractionCount++;

    if (_config.enableBehavioralAnalysis) {
      Behavioral.recordInteraction();
      if (event.type === 'touchstart') {
        Behavioral.recordTap(event);
        Behavioral.recordTouch(event);
      } else if (event.type === 'click' || event.type === 'mousedown') {
        Behavioral.recordTap(event);
      }
    }
  }

  function _startIdleDrip() {
    if (!_config.enableIdleDrip || _idleDripTimer) return;

    _idleDripTimer = setInterval(function() {
      var timeSinceInteraction = Date.now() - _lastInteractionTime;
      var isAfk = timeSinceInteraction > _config.afkThresholdMs;

      // Still earn if AFK, but at half rate
      if (isAfk && Math.random() > 0.5) return;

      earnHash('idle_drip', _config.idleDripIntervalMs, _idleInteractionCount, 'passive');
      _idleInteractionCount = 0;
    }, _config.idleDripIntervalMs);

    _log('Idle drip started');
  }

  function _stopIdleDrip() {
    if (_idleDripTimer) {
      clearInterval(_idleDripTimer);
      _idleDripTimer = null;
      _log('Idle drip stopped');
    }
  }

  function _setupTabReturn() {
    if (!_config.enableTabReturn) return;

    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        localStorage.setItem(_config.tabHideKey, String(Date.now()));
        _stopIdleDrip();
        _updateTierMinutes();
      } else {
        _startIdleDrip();
        var hiddenAt = parseInt(localStorage.getItem(_config.tabHideKey) || '0', 10);
        if (hiddenAt > 0) {
          var minutesAway = (Date.now() - hiddenAt) / 60000;
          if (minutesAway >= _config.tabReturnMinMinutes) {
            var bonus = Math.min(_config.tabReturnMaxHashes, Math.floor(Math.log2(minutesAway + 1)));
            for (var i = 0; i < bonus; i++) {
              earnHash('tab_return', minutesAway * 60000, 0, 'active');
            }
            _log('Tab return:', bonus, 'hashes for', Math.round(minutesAway), 'min away');
          }
          localStorage.removeItem(_config.tabHideKey);
        }
      }
    });
  }

  function _setupScrollTracking() {
    if (!_config.enableBehavioralAnalysis) return;

    window.addEventListener('scroll', function() {
      Behavioral.recordScroll();
    }, { passive: true });
  }

  // Ambient mode (public API)
  function startAmbientMode() {
    if (_ambientActive) return;
    _ambientActive = true;

    if ('wakeLock' in navigator) {
      navigator.wakeLock.request('screen').then(function(lock) {
        _wakeLock = lock;
      }).catch(function() { /* Wake lock not available */ });
    }

    _ambientTimer = setInterval(function() {
      earnHash('ambient_mode', _config.ambientIntervalMs, 0, 'passive');
    }, _config.ambientIntervalMs);

    _log('Ambient mode started');
  }

  function stopAmbientMode() {
    _ambientActive = false;
    if (_ambientTimer) { clearInterval(_ambientTimer); _ambientTimer = null; }
    if (_wakeLock) { _wakeLock.release(); _wakeLock = null; }
    _log('Ambient mode stopped');
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  function init(options) {
    if (_initialized) {
      _log('Already initialized');
      return;
    }

    // Merge options
    _config = {};
    for (var key in DEFAULT_CONFIG) {
      if (DEFAULT_CONFIG.hasOwnProperty(key)) {
        _config[key] = (options && options.hasOwnProperty(key)) ? options[key] : DEFAULT_CONFIG[key];
      }
    }

    _sessionId = _generateSessionId();
    _sessionStartTime = Date.now();

    // Event listeners for interaction tracking
    document.addEventListener('touchstart', _trackInteraction, { passive: true });
    document.addEventListener('mousedown', _trackInteraction, { passive: true });
    document.addEventListener('click', _trackInteraction, { passive: true });
    document.addEventListener('keydown', function(e) {
      _lastInteractionTime = Date.now();
      _idleInteractionCount++;
      if (_config.enableBehavioralAnalysis) Behavioral.recordInteraction();
    }, { passive: true });
    document.addEventListener('mousemove', function() {
      _lastInteractionTime = Date.now();
    }, { passive: true });

    // Firebase
    if (options && options.firebaseConfig) {
      _initFirebase(options.firebaseConfig);
    } else if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
      _firebaseAvailable = true;
      firebase.auth().signInAnonymously().catch(function(error) {
        _log('Anonymous auth failed:', error.code);
      });
      firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
          _currentUid = user.uid;
          _log('Authenticated as:', user.uid);
          _syncUnsyncedHashes(user.uid);
        }
      });
    }

    // Start Tier 1 features
    _setupTabReturn();
    _setupScrollTracking();
    if (!document.hidden) _startIdleDrip();

    // Page visit hash
    earnHash('page_visit', 0, 0, 'active');

    _initialized = true;
    _log('Initialized. Game ID:', _config.gameId, '| Session:', _sessionId.substring(0, 8));
  }

  // ============================================================
  // AUTO-INIT FROM SCRIPT TAG ATTRIBUTES
  // ============================================================

  function _autoInit() {
    var scripts = document.getElementsByTagName('script');
    var thisScript = scripts[scripts.length - 1];

    var gameId = thisScript.getAttribute('data-game-id');
    var configStr = thisScript.getAttribute('data-firebase-config');
    var debug = thisScript.getAttribute('data-debug') === 'true';

    if (gameId) {
      var firebaseConfig = null;
      if (configStr) {
        try { firebaseConfig = JSON.parse(configStr); } catch (e) { /* ignore */ }
      }
      init({
        gameId: gameId,
        firebaseConfig: firebaseConfig,
        debug: debug
      });
    }
  }

  // ============================================================
  // EXPORT PUBLIC API
  // ============================================================

  window.SWSAttention = {
    // Core
    init: init,
    earn: earnHash,
    spend: spendHashes,
    getBalance: getBalance,
    getHashes: getHashes,
    getStats: getStats,

    // Scoring
    getFocusScore: _computeFocusScore,
    getHumanConfidence: function() { return Behavioral.computeHumanConfidence(); },

    // Tier 1 features
    startAmbient: startAmbientMode,
    stopAmbient: stopAmbientMode,

    // Behavioral analysis hooks (for game/app integration)
    recordDecision: function(optionCount, responseTimeMs) { Behavioral.recordDecision(optionCount, responseTimeMs); },
    recordContentRender: function(complexity) { Behavioral.recordContentRender(complexity); },

    // Session info
    getSessionId: function() { return _sessionId; },
    getSessionDuration: function() { return Date.now() - _sessionStartTime; },
    getUserId: function() { return _currentUid; },
    isAuthenticated: function() { return _currentUid !== 'anonymous'; },

    // Sync status
    getSyncStatus: function() {
      var hashes = getHashes();
      return {
        total: hashes.length,
        synced: hashes.filter(function(h) { return h.synced; }).length,
        queued: _syncQueue.length,
        firebaseAvailable: _firebaseAvailable,
        authenticated: _currentUid !== 'anonymous'
      };
    },
    forceSyncNow: function() { _drainSyncQueue(); },

    // Version and meta
    version: '1.0.0',
    patent: 'SWS-PROV-001',
    entity: 'SWS Strategic Media LLC'
  };

  // Auto-init if script tag has data-game-id
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _autoInit);
  } else {
    _autoInit();
  }

})(window, document);
