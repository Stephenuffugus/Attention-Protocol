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

  // New behavioral signals (v2)
  var _keystrokeLog = [];     // [{key, holdTime, flightTime, t}, ...]
  var _keyDownTimes = {};     // {keyCode: timestamp} for hold time calc
  var _lastKeyUpTime = 0;
  var _hoverLog = [];         // [{element, enterTime, leaveTime, dwellMs}, ...]
  var _currentHover = null;
  var _tabVisLog = [];        // [{visible: bool, t: timestamp}, ...]
  var _inactivityGaps = [];   // [{startTime, endTime, durationMs}, ...]
  var _lastActivityTime = Date.now();
  var _inactivityThreshold = 3000; // 3s of no interaction = gap
  var _sectionTimings = [];   // [{sectionId, enterTime, exitTime, scrollPct}, ...]
  var _timeline = [];         // [{t, composite, tier, signals, phase}, ...] every 10s

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

  // Asymptotic scoring: approaches but never reaches 1.0
  // Maps [0, inf) -> [0, ~0.95] with configurable steepness
  function _ascore(value, k) {
    if (value <= 0) return 0;
    return 1 - Math.exp(-value / (k || 1));
  }

  // Click coordinate variance for desktop fallback
  var _clickCoords = [];
  var _mobileInputTimes = [];

  // Mousemove sampling for motor signals (Tier 2)
  var _mouseMoveLog = [];    // [{x, y, t}, ...] sampled at ~60Hz
  var _lastMouseSample = 0;
  var _scrollReversals = []; // [{position, direction, t}, ...] for backtracking

  // Device motion (accelerometer + gyroscope) for mobile physical presence
  var _motionLog = [];       // [{ax, ay, az, gx, gy, gz, t}, ...]
  var _lastMotionSample = 0;
  var _motionPermissionGranted = false;

  var Behavioral = {
    // Pattern 1: Interaction Timing Entropy
    recordInteraction: function() {
      _interactionTimestamps.push(Date.now());
      if (_interactionTimestamps.length > 200) _interactionTimestamps.shift();
    },

    computeTimingCV: function() {
      if (_interactionTimestamps.length < 10) return 0; // insufficient data
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
      if (_tapLog.length < 10) return -1; // insufficient data sentinel
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
      if (denom === 0) return 0.3;
      var r = (n * sumXY - sumX * sumY) / denom;
      if (isNaN(r)) return 0.3;
      // Blend correlation with distance variance to handle small grids
      var distMean = distances.reduce(function(a, b) { return a + b; }, 0) / distances.length;
      var distVar = distances.reduce(function(a, b) { return a + Math.pow(b - distMean, 2); }, 0) / distances.length;
      var distCV = distMean > 0 ? Math.sqrt(distVar) / distMean : 0;
      var corrScore = _ascore(Math.max(0, (r + 1) / 2), 0.5);
      var distScore = _ascore(distCV, 0.8);
      return corrScore * 0.6 + distScore * 0.4;
    },

    // Pattern 4: Scroll Saccade Analysis
    recordScroll: function(scrollY) {
      var y = (scrollY !== undefined) ? scrollY : window.scrollY;
      _scrollLog.push({ y: y, t: Date.now() });
      if (_scrollLog.length > 500) _scrollLog.shift();
    },

    computeScrollSaccade: function() {
      if (_scrollLog.length < 20) return -1; // insufficient data sentinel
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
      return _ascore(fixations, 12);
    },

    // Pattern 6: Touch Pressure/Contact Area Variation
    recordTouch: function(event) {
      var touch = event.touches ? event.touches[0] : null;
      if (touch && touch.radiusX !== undefined) {
        _touchRadii.push({ rx: touch.radiusX, ry: touch.radiusY, force: touch.force || 0 });
        if (_touchRadii.length > 100) _touchRadii.shift();
      }
    },

    recordClickCoord: function(x, y) {
      _clickCoords.push({ x: x, y: y, t: Date.now() });
      if (_clickCoords.length > 100) _clickCoords.shift();
    },

    computeTouchVariance: function() {
      // Mobile: use touch radii
      if (_touchRadii.length >= 10) {
        var rxVals = _touchRadii.map(function(t) { return t.rx; });
        var mean = rxVals.reduce(function(a, b) { return a + b; }, 0) / rxVals.length;
        var variance = rxVals.reduce(function(a, b) { return a + Math.pow(b - mean, 2); }, 0) / rxVals.length;
        return _ascore(variance, 18);
      }
      // Desktop fallback: use click coordinate timing variance
      if (_clickCoords.length >= 10) {
        var intervals = [];
        for (var i = 1; i < _clickCoords.length; i++) {
          intervals.push(_clickCoords[i].t - _clickCoords[i - 1].t);
        }
        var mean2 = intervals.reduce(function(a, b) { return a + b; }, 0) / intervals.length;
        if (mean2 === 0) return 0.3;
        var variance2 = intervals.reduce(function(a, b) { return a + Math.pow(b - mean2, 2); }, 0) / intervals.length;
        var cv = Math.sqrt(variance2) / mean2;
        return _ascore(cv, 1.2);
      }
      return -1; // insufficient data sentinel
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

      if (isNaN(r)) return 0.5;

      var correlationScore = _ascore(Math.max(0, r + 0.3), 0.7);

      var allRTs = [];
      _decisionLog.forEach(function(d) { allRTs.push(d.responseTimeMs); });
      var rtMean = allRTs.reduce(function(a, b) { return a + b; }, 0) / allRTs.length;
      var rtVariance = allRTs.reduce(function(a, b) { return a + Math.pow(b - rtMean, 2); }, 0) / allRTs.length;
      var rtCV = rtMean > 0 ? Math.sqrt(rtVariance) / rtMean : 0;
      var varianceScore = _ascore(rtCV, 0.8);

      return correlationScore * 0.6 + varianceScore * 0.4;
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
      var varianceScore = _ascore(Math.sqrt(varianceSum), 400);

      return ratioScore * 0.6 + varianceScore * 0.4;
    },

    // Pattern 7: Keystroke Dynamics
    recordKeyDown: function(event) {
      _keyDownTimes[event.keyCode] = Date.now();
    },

    recordKeyUp: function(event) {
      var now = Date.now();
      var holdTime = _keyDownTimes[event.keyCode] ? now - _keyDownTimes[event.keyCode] : 0;
      var flightTime = _lastKeyUpTime ? now - _lastKeyUpTime : 0;
      _keystrokeLog.push({ holdTime: holdTime, flightTime: flightTime, t: now });
      if (_keystrokeLog.length > 200) _keystrokeLog.shift();
      _lastKeyUpTime = now;
      delete _keyDownTimes[event.keyCode];
    },

    recordMobileInput: function(timestamp) {
      _mobileInputTimes.push(timestamp);
      if (_mobileInputTimes.length > 200) _mobileInputTimes.shift();
    },

    computeKeystrokeDynamics: function() {
      // Desktop: use real keydown/keyup data
      if (_keystrokeLog.length >= 8) {
        var holdTimes = _keystrokeLog.map(function(k) { return k.holdTime; });
        var flightTimes = _keystrokeLog.filter(function(k) { return k.flightTime > 0 && k.flightTime < 2000; }).map(function(k) { return k.flightTime; });
        if (holdTimes.length >= 5 && flightTimes.length >= 5) {
          function cv(arr) {
            var mean = arr.reduce(function(a, b) { return a + b; }, 0) / arr.length;
            if (mean === 0) return 0;
            var variance = arr.reduce(function(a, b) { return a + Math.pow(b - mean, 2); }, 0) / arr.length;
            return Math.sqrt(variance) / mean;
          }
          var holdCV = cv(holdTimes);
          var flightCV = cv(flightTimes);
          var holdInRange = holdTimes.filter(function(h) { return h >= 50 && h <= 300; }).length / holdTimes.length;
          var rhythmScore = _ascore((holdCV + flightCV) / 2, 0.6);
          return rhythmScore * 0.5 + holdInRange * 0.5;
        }
      }
      // Mobile fallback: use input event timing
      if (_mobileInputTimes.length >= 10) {
        var intervals = [];
        for (var i = 1; i < _mobileInputTimes.length; i++) {
          intervals.push(_mobileInputTimes[i] - _mobileInputTimes[i - 1]);
        }
        var mean = intervals.reduce(function(a, b) { return a + b; }, 0) / intervals.length;
        if (mean === 0) return 0.3;
        var variance = intervals.reduce(function(a, b) { return a + Math.pow(b - mean, 2); }, 0) / intervals.length;
        var mobileCV = Math.sqrt(variance) / mean;
        var inRange = intervals.filter(function(t) { return t >= 30 && t <= 800; }).length / intervals.length;
        return _ascore(mobileCV, 0.6) * 0.4 + inRange * 0.6;
      }
      return -1; // insufficient data sentinel
    },

    // Pattern 8: Reading Speed Inference
    recordSectionEntry: function(sectionId) {
      _sectionTimings.push({ sectionId: sectionId, enterTime: Date.now(), exitTime: null, scrollPct: 0 });
    },

    recordSectionExit: function(sectionId, scrollPct) {
      for (var i = _sectionTimings.length - 1; i >= 0; i--) {
        if (_sectionTimings[i].sectionId === sectionId && !_sectionTimings[i].exitTime) {
          _sectionTimings[i].exitTime = Date.now();
          _sectionTimings[i].scrollPct = scrollPct || 100;
          break;
        }
      }
    },

    computeReadingSpeed: function() {
      var completed = _sectionTimings.filter(function(s) { return s.exitTime; });
      if (completed.length < 2) return -1; // insufficient data sentinel
      var durations = completed.map(function(s) { return s.exitTime - s.enterTime; });
      var mean = durations.reduce(function(a, b) { return a + b; }, 0) / durations.length;
      if (mean < 200) return 0.2; // impossibly fast skim
      if (mean > 60000) return 0.3; // suspiciously long per section
      var variance = durations.reduce(function(a, b) { return a + Math.pow(b - mean, 2); }, 0) / durations.length;
      var cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
      // Mobile users read sections in 1-8 seconds typically
      var speedScore = _ascore(mean, 3000);
      var varianceScore = _ascore(cv, 0.4);
      return speedScore * 0.5 + varianceScore * 0.5;
    },

    // Pattern 9: Cursor/Hover Dwell Time
    recordHoverEnter: function(elementId) {
      _currentHover = { element: elementId, enterTime: Date.now() };
    },

    recordHoverLeave: function() {
      if (_currentHover) {
        var dwell = Date.now() - _currentHover.enterTime;
        _currentHover.leaveTime = Date.now();
        _currentHover.dwellMs = dwell;
        _hoverLog.push(_currentHover);
        if (_hoverLog.length > 100) _hoverLog.shift();
        _currentHover = null;
      }
    },

    recordTouchDwell: function(startTime) {
      if (startTime) {
        var dwell = Date.now() - startTime;
        _hoverLog.push({ element: 'touch', enterTime: startTime, leaveTime: Date.now(), dwellMs: dwell });
        if (_hoverLog.length > 100) _hoverLog.shift();
      }
    },

    computeHoverDwell: function() {
      if (_hoverLog.length < 5) return -1; // insufficient data sentinel
      var dwells = _hoverLog.map(function(h) { return h.dwellMs; });
      var humanLike = dwells.filter(function(d) { return d >= 80 && d <= 5000; }).length;
      var mean = dwells.reduce(function(a, b) { return a + b; }, 0) / dwells.length;
      var variance = dwells.reduce(function(a, b) { return a + Math.pow(b - mean, 2); }, 0) / dwells.length;
      var cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
      var ratioScore = humanLike / dwells.length;
      var varianceScore = _ascore(cv, 0.6);
      return ratioScore * 0.5 + varianceScore * 0.5;
    },

    // Pattern 10: Tab Visibility
    recordVisibilityChange: function(visible) {
      _tabVisLog.push({ visible: visible, t: Date.now() });
    },

    computeTabVisibility: function() {
      var totalTime = Date.now() - _sessionStartTime;
      if (totalTime < 5000) return -1; // too short to judge
      if (_tabVisLog.length === 0) {
        // No visibility changes at all — suspicious if session is long
        // Bots never leave; humans occasionally do
        if (totalTime > 120000) return 0.6; // 2+ min with zero tab switches
        return 0.75; // short session, no switches is normal
      }
      var visibleTime = 0;
      var lastVisible = _sessionStartTime;
      var switchCount = 0;
      _tabVisLog.forEach(function(entry) {
        if (!entry.visible && lastVisible) {
          visibleTime += entry.t - lastVisible;
          lastVisible = null;
          switchCount++;
        } else if (entry.visible) {
          lastVisible = entry.t;
        }
      });
      if (lastVisible) visibleTime += Date.now() - lastVisible;
      var visibleRatio = visibleTime / totalTime;
      // High visibility is good, but some switching is MORE human
      // Sweet spot: 70-95% visible with 1-3 switches
      if (visibleRatio > 0.95 && switchCount === 0) return 0.65; // suspiciously perfect
      if (visibleRatio >= 0.7 && switchCount >= 1) return _ascore(visibleRatio, 0.85); // human-like
      if (visibleRatio < 0.5) return 0.2; // mostly hidden — likely abandoned
      return _ascore(visibleRatio * 0.8 + (switchCount > 0 ? 0.15 : 0), 0.7);
    },

    // Pattern 11: Inactivity Gap Analysis
    recordActivity: function() {
      var now = Date.now();
      if (_lastActivityTime && (now - _lastActivityTime) > _inactivityThreshold) {
        _inactivityGaps.push({
          startTime: _lastActivityTime,
          endTime: now,
          durationMs: now - _lastActivityTime
        });
      }
      _lastActivityTime = now;
    },

    computeInactivityPattern: function() {
      var sessionDuration = Date.now() - _sessionStartTime;
      if (sessionDuration < 10000) return -1; // too short
      if (_inactivityGaps.length === 0) {
        // No gaps at all — slightly suspicious for long sessions (bots are continuous)
        if (sessionDuration > 60000) return 0.55;
        return 0.7; // short session without gaps is fine
      }
      var totalGapTime = _inactivityGaps.reduce(function(sum, g) { return sum + g.durationMs; }, 0);
      var gapRatio = totalGapTime / sessionDuration;
      if (gapRatio > 0.7) return 0.1; // mostly idle
      var gapDurations = _inactivityGaps.map(function(g) { return g.durationMs; });
      var mean = gapDurations.reduce(function(a, b) { return a + b; }, 0) / gapDurations.length;
      var variance = gapDurations.reduce(function(a, b) { return a + Math.pow(b - mean, 2); }, 0) / gapDurations.length;
      var cv = mean > 0 ? Math.sqrt(variance) / mean : 0;

      // Humans: moderate gap ratio (5-40%), variable gap lengths (high CV)
      var gapRatioScore = 1 - Math.abs(gapRatio - 0.15) * 3; // peaks at 15% gap ratio
      gapRatioScore = Math.max(0.1, Math.min(0.9, gapRatioScore));
      var cvScore = _ascore(cv, 0.5);
      return gapRatioScore * 0.5 + cvScore * 0.5;
    },

    // Timeline snapshot (called every 10s)
    recordTimelineSnapshot: function(phase) {
      var c = this.computeHumanConfidence();
      var signals = {};
      for (var k in c) {
        if (k !== 'composite' && k !== 'activeSignals' && k !== 'totalSignals') signals[k] = c[k];
      }
      _timeline.push({
        t: Math.round((Date.now() - _sessionStartTime) / 1000),
        composite: c.composite,
        tier: c.composite >= 0.7 ? 'deep' : c.composite >= 0.5 ? 'active' : c.composite >= 0.25 ? 'passive' : 'background',
        signals: signals,
        activeSignals: c.activeSignals,
        phase: phase || 'unknown'
      });
    },

    getTimeline: function() { return _timeline.slice(); },

    // ============================================================
    // TIER 1: NEW SIGNALS (zero new data needed)
    // ============================================================

    // Signal 12: RT Variability (Coefficient of Variation + Ex-Gaussian tau)
    // Esterman et al. 2013, strongest single attention metric in cognitive science
    computeRTVariability: function() {
      if (_interactionTimestamps.length < 15) return -1;
      var intervals = [];
      for (var i = 1; i < _interactionTimestamps.length; i++) {
        var dt = _interactionTimestamps[i] - _interactionTimestamps[i - 1];
        if (dt > 50 && dt < 10000) intervals.push(dt);
      }
      if (intervals.length < 10) return -1;
      var mean = intervals.reduce(function(a, b) { return a + b; }, 0) / intervals.length;
      var variance = intervals.reduce(function(a, b) { return a + Math.pow(b - mean, 2); }, 0) / intervals.length;
      var cv = Math.sqrt(variance) / mean;
      // Humans: CV 0.15-0.50. Bots: CV < 0.05 or artificially high
      // "In the zone" (low CV ~0.15) = deep focus. "Out of zone" (CV ~0.45) = distracted
      // Ex-Gaussian tau approximation: skewness of the distribution
      var sorted = intervals.slice().sort(function(a, b) { return a - b; });
      var median = sorted[Math.floor(sorted.length / 2)];
      var skewRatio = (mean - median) / (Math.sqrt(variance) || 1);
      // Human attention: moderate CV with positive skew (occasional long lapses)
      var cvScore = (cv >= 0.1 && cv <= 0.6) ? _ascore(1 - Math.abs(cv - 0.3) * 3, 0.8) : 0.2;
      var skewScore = (skewRatio > 0 && skewRatio < 2) ? _ascore(skewRatio, 0.8) : 0.3;
      return cvScore * 0.6 + skewScore * 0.4;
    },

    // Signal 13: Scroll Backtracking (comprehension proxy)
    // Google Research (Khaokaew et al. 2024)
    recordScrollReversal: function(position, direction) {
      _scrollReversals.push({ position: position, direction: direction, t: Date.now() });
      if (_scrollReversals.length > 200) _scrollReversals.shift();
    },

    computeScrollBacktracking: function() {
      if (_scrollReversals.length < 2) return -1;
      var upReversals = _scrollReversals.filter(function(r) { return r.direction === 'up'; });
      if (_scrollLog.length < 10) return -1;
      var totalScrollEvents = _scrollLog.length;
      var backtrackRatio = upReversals.length / totalScrollEvents;
      // Humans re-read: 5-15% backtrack ratio on medium-difficulty text
      // Bots: 0% (never go back) or random
      if (backtrackRatio === 0) return 0.15; // never went back = suspicious or very fast reader
      var score = _ascore(backtrackRatio, 0.08);
      // Also check if backtracks cluster at specific positions (comprehension difficulty)
      if (upReversals.length >= 3) {
        var positions = upReversals.map(function(r) { return r.position; });
        var posMean = positions.reduce(function(a, b) { return a + b; }, 0) / positions.length;
        var posVar = positions.reduce(function(a, b) { return a + Math.pow(b - posMean, 2); }, 0) / positions.length;
        var clustering = Math.sqrt(posVar) > 50 ? 0.3 : 0; // spread out = genuine re-reading
        score = Math.min(score + clustering, 0.95);
      }
      return score;
    },

    // Signal 14: Fractal Scaling via Detrended Fluctuation Analysis
    // Gilden 2001, Wijnants 2009 — biological authenticity fingerprint
    computeFractalScaling: function() {
      if (_interactionTimestamps.length < 50) return -1;
      var intervals = [];
      for (var i = 1; i < _interactionTimestamps.length; i++) {
        var dt = _interactionTimestamps[i] - _interactionTimestamps[i - 1];
        if (dt > 10 && dt < 10000) intervals.push(dt);
      }
      if (intervals.length < 40) return -1;
      var n = intervals.length;
      var mean = intervals.reduce(function(a, b) { return a + b; }, 0) / n;
      // Cumulative sum of deviations (integration)
      var cumsum = [];
      var running = 0;
      for (var j = 0; j < n; j++) {
        running += (intervals[j] - mean);
        cumsum.push(running);
      }
      // DFA: compute fluctuation at multiple window sizes
      var windowSizes = [4, 8, 16, 32];
      var logSizes = [], logFluct = [];
      windowSizes.forEach(function(ws) {
        if (ws > n / 2) return;
        var numWindows = Math.floor(n / ws);
        var totalFluct = 0;
        for (var w = 0; w < numWindows; w++) {
          var segment = cumsum.slice(w * ws, (w + 1) * ws);
          // Linear detrend
          var sx = 0, sy = 0, sxy = 0, sx2 = 0;
          for (var k = 0; k < segment.length; k++) {
            sx += k; sy += segment[k]; sxy += k * segment[k]; sx2 += k * k;
          }
          var denom = segment.length * sx2 - sx * sx;
          var slope = denom !== 0 ? (segment.length * sxy - sx * sy) / denom : 0;
          var intercept = (sy - slope * sx) / segment.length;
          var rms = 0;
          for (var m = 0; m < segment.length; m++) {
            var detrended = segment[m] - (slope * m + intercept);
            rms += detrended * detrended;
          }
          totalFluct += Math.sqrt(rms / segment.length);
        }
        var avgFluct = totalFluct / numWindows;
        if (avgFluct > 0) {
          logSizes.push(Math.log(ws));
          logFluct.push(Math.log(avgFluct));
        }
      });
      if (logSizes.length < 3) return -1;
      // Fit line to get alpha (Hurst exponent proxy)
      var lsx = 0, lsy = 0, lsxy = 0, lsx2 = 0, ln = logSizes.length;
      for (var p = 0; p < ln; p++) {
        lsx += logSizes[p]; lsy += logFluct[p];
        lsxy += logSizes[p] * logFluct[p]; lsx2 += logSizes[p] * logSizes[p];
      }
      var ldenom = ln * lsx2 - lsx * lsx;
      if (ldenom === 0) return 0.3;
      var alpha = (ln * lsxy - lsx * lsy) / ldenom;
      // Human motor timing: alpha 0.6-0.9 (persistent pink noise)
      // Random (white noise): alpha ~0.5. Over-correlated (brown): alpha ~1.5
      // Bots: alpha near 0.5 (random delays) or near 0 (fixed intervals)
      if (alpha >= 0.5 && alpha <= 1.1) {
        return _ascore(1 - Math.abs(alpha - 0.75) * 3, 0.7);
      }
      return 0.2; // outside human range
    },

    // Signal 15: Cross-Signal Correlation Matrix
    // Tsinghua research, adversarial team's #1 recommendation
    computeCrossSignalCorrelation: function() {
      // Correlate interaction timing with scroll timing and keystroke timing
      // Real humans show correlated behavior across channels; bots simulate channels independently
      var hasScroll = _scrollLog.length >= 10;
      var hasKeys = _keystrokeLog.length >= 5 || _mobileInputTimes.length >= 5;
      var hasTaps = _tapLog.length >= 5;
      var channelCount = (hasScroll ? 1 : 0) + (hasKeys ? 1 : 0) + (hasTaps ? 1 : 0);
      if (channelCount < 2) return -1;

      var correlations = [];

      // Correlation 1: When tapping happens, scroll should pause (anti-correlation)
      if (hasTaps && hasScroll) {
        var tapTimes = _tapLog.map(function(t) { return t.t; });
        var scrollGaps = [];
        tapTimes.forEach(function(tt) {
          var nearestScroll = _scrollLog.reduce(function(best, s) {
            var d = Math.abs(s.t - tt);
            return d < Math.abs(best) ? d : best;
          }, 99999);
          scrollGaps.push(nearestScroll);
        });
        var avgGap = scrollGaps.reduce(function(a, b) { return a + b; }, 0) / scrollGaps.length;
        // Humans: taps happen during scroll pauses, so gap should be > 200ms
        correlations.push(avgGap > 200 ? _ascore(avgGap, 1000) : 0.2);
      }

      // Correlation 2: Keystroke bursts should coincide with scroll pauses
      if (hasKeys && hasScroll) {
        var keyTimes = _keystrokeLog.length > 0
          ? _keystrokeLog.map(function(k) { return k.t; })
          : _mobileInputTimes.slice();
        if (keyTimes.length >= 5) {
          var keyDuringScroll = 0;
          keyTimes.forEach(function(kt) {
            var scrollNear = _scrollLog.some(function(s) { return Math.abs(s.t - kt) < 500; });
            if (scrollNear) keyDuringScroll++;
          });
          var keyScrollOverlap = keyDuringScroll / keyTimes.length;
          // Humans: mostly type when not scrolling (low overlap)
          correlations.push(keyScrollOverlap < 0.3 ? _ascore(1 - keyScrollOverlap, 0.6) : 0.3);
        }
      }

      // Correlation 3: Interaction rate should change between phases/content sections
      if (_interactionTimestamps.length >= 20) {
        var half = Math.floor(_interactionTimestamps.length / 2);
        var firstHalf = [], secondHalf = [];
        for (var i = 1; i < half; i++) firstHalf.push(_interactionTimestamps[i] - _interactionTimestamps[i-1]);
        for (var j = half + 1; j < _interactionTimestamps.length; j++) secondHalf.push(_interactionTimestamps[j] - _interactionTimestamps[j-1]);
        var mean1 = firstHalf.reduce(function(a,b){return a+b;},0) / firstHalf.length;
        var mean2 = secondHalf.reduce(function(a,b){return a+b;},0) / secondHalf.length;
        var rateDiff = Math.abs(mean1 - mean2) / ((mean1 + mean2) / 2 || 1);
        // Humans: interaction rate changes as they switch tasks. Bots: constant
        correlations.push(_ascore(rateDiff, 0.5));
      }

      if (correlations.length === 0) return -1;
      return correlations.reduce(function(a, b) { return a + b; }, 0) / correlations.length;
    },

    // ============================================================
    // TIER 2: MOTOR SIGNALS (need mousemove sampling)
    // ============================================================

    recordMouseMove: function(x, y, t) {
      if (t - _lastMouseSample < 16) return; // ~60Hz cap
      _mouseMoveLog.push({ x: x, y: y, t: t });
      if (_mouseMoveLog.length > 500) _mouseMoveLog.shift();
      _lastMouseSample = t;
    },

    // Signal 16: Curvature Index (path efficiency)
    // MacKenzie et al. 2001 — ratio of actual path to straight-line distance
    computeCurvatureIndex: function() {
      if (_mouseMoveLog.length < 20) return -1;
      // Segment movements by velocity pauses (>100ms gap = new movement)
      var movements = [];
      var current = [_mouseMoveLog[0]];
      for (var i = 1; i < _mouseMoveLog.length; i++) {
        if (_mouseMoveLog[i].t - _mouseMoveLog[i-1].t > 300) {
          if (current.length >= 5) movements.push(current);
          current = [];
        }
        current.push(_mouseMoveLog[i]);
      }
      if (current.length >= 5) movements.push(current);
      if (movements.length < 3) return -1;

      var indices = [];
      movements.forEach(function(m) {
        var pathDist = 0;
        for (var j = 1; j < m.length; j++) {
          var dx = m[j].x - m[j-1].x, dy = m[j].y - m[j-1].y;
          pathDist += Math.sqrt(dx*dx + dy*dy);
        }
        var euclidean = Math.sqrt(Math.pow(m[m.length-1].x - m[0].x, 2) + Math.pow(m[m.length-1].y - m[0].y, 2));
        if (euclidean > 10) indices.push(pathDist / euclidean);
      });
      if (indices.length < 3) return -1;
      var avgCI = indices.reduce(function(a,b){return a+b;},0) / indices.length;
      // Human CI: 1.1-1.8. Bot CI: ~1.0 (straight lines) or >2.0 (random noise)
      if (avgCI >= 1.0 && avgCI <= 2.5) {
        return _ascore(1 - Math.abs(avgCI - 1.3) * 1.5, 0.7);
      }
      return 0.2;
    },

    // Signal 17: Cursor Jerk (LDLJ — Log Dimensionless Jerk)
    // Flash & Hogan 1985, BeCAPTCHA-Mouse 98.7% bot detection
    computeCursorJerk: function() {
      if (_mouseMoveLog.length < 30) return -1;
      var movements = [];
      var current = [_mouseMoveLog[0]];
      for (var i = 1; i < _mouseMoveLog.length; i++) {
        if (_mouseMoveLog[i].t - _mouseMoveLog[i-1].t > 300) {
          if (current.length >= 8) movements.push(current);
          current = [];
        }
        current.push(_mouseMoveLog[i]);
      }
      if (current.length >= 8) movements.push(current);
      if (movements.length < 2) return -1;

      var jerkScores = [];
      movements.forEach(function(m) {
        // Compute velocity, acceleration, jerk
        var jerks = [];
        for (var j = 3; j < m.length; j++) {
          var dt1 = (m[j].t - m[j-1].t) / 1000 || 0.016;
          var dt2 = (m[j-1].t - m[j-2].t) / 1000 || 0.016;
          var dt3 = (m[j-2].t - m[j-3].t) / 1000 || 0.016;
          var v1 = Math.sqrt(Math.pow(m[j].x-m[j-1].x,2)+Math.pow(m[j].y-m[j-1].y,2))/dt1;
          var v2 = Math.sqrt(Math.pow(m[j-1].x-m[j-2].x,2)+Math.pow(m[j-1].y-m[j-2].y,2))/dt2;
          var v3 = Math.sqrt(Math.pow(m[j-2].x-m[j-3].x,2)+Math.pow(m[j-2].y-m[j-3].y,2))/dt3;
          var a1 = (v1 - v2) / dt1;
          var a2 = (v2 - v3) / dt2;
          var jerk = (a1 - a2) / dt1;
          jerks.push(Math.abs(jerk));
        }
        if (jerks.length < 3) return;
        var meanJerk = jerks.reduce(function(a,b){return a+b;},0) / jerks.length;
        var jerkVar = jerks.reduce(function(a,b){return a+Math.pow(b-meanJerk,2);},0) / jerks.length;
        var jerkCV = meanJerk > 0 ? Math.sqrt(jerkVar) / meanJerk : 0;
        // Human jerk: moderate and variable (CV 0.3-1.5)
        // Bot jerk: near zero (perfectly smooth) or very high (random noise)
        jerkScores.push(jerkCV);
      });
      if (jerkScores.length < 2) return -1;
      var avgJerkCV = jerkScores.reduce(function(a,b){return a+b;},0) / jerkScores.length;
      if (avgJerkCV >= 0.2 && avgJerkCV <= 2.0) {
        return _ascore(1 - Math.abs(avgJerkCV - 0.8) * 1.0, 0.7);
      }
      return 0.2;
    },

    // Signal 18: Velocity Profile Bell-Shape Index
    // Morasso 1981 — human movements produce bell-shaped velocity curves
    computeVelocityProfile: function() {
      if (_mouseMoveLog.length < 30) return -1;
      var movements = [];
      var current = [_mouseMoveLog[0]];
      for (var i = 1; i < _mouseMoveLog.length; i++) {
        if (_mouseMoveLog[i].t - _mouseMoveLog[i-1].t > 300) {
          if (current.length >= 6) movements.push(current);
          current = [];
        }
        current.push(_mouseMoveLog[i]);
      }
      if (current.length >= 6) movements.push(current);
      if (movements.length < 2) return -1;

      var symmetryScores = [];
      movements.forEach(function(m) {
        var velocities = [];
        for (var j = 1; j < m.length; j++) {
          var dt = (m[j].t - m[j-1].t) / 1000 || 0.016;
          var dist = Math.sqrt(Math.pow(m[j].x-m[j-1].x,2)+Math.pow(m[j].y-m[j-1].y,2));
          velocities.push(dist / dt);
        }
        if (velocities.length < 4) return;
        var peakIdx = velocities.indexOf(Math.max.apply(null, velocities));
        var symmetryRatio = (peakIdx + 1) / velocities.length;
        // Human bell-shape: peak at 35-55% of movement (slight leftward skew)
        // Bot linear: peak at end (ratio ~1.0) or flat (no clear peak)
        if (symmetryRatio >= 0.2 && symmetryRatio <= 0.7) {
          symmetryScores.push(_ascore(1 - Math.abs(symmetryRatio - 0.42) * 4, 0.6));
        } else {
          symmetryScores.push(0.2);
        }
      });
      if (symmetryScores.length < 2) return -1;
      return symmetryScores.reduce(function(a,b){return a+b;},0) / symmetryScores.length;
    },

    // Signal 19: Two-Thirds Power Law (velocity-curvature coupling)
    // Lacquaniti, Terzuolo & Viviani 1983 — hardwired into human CNS since birth
    computeTwoThirdsPowerLaw: function() {
      if (_mouseMoveLog.length < 40) return -1;
      // Need continuous curved movements
      var logV = [], logK = [];
      for (var i = 2; i < _mouseMoveLog.length - 1; i++) {
        var dt = (_mouseMoveLog[i].t - _mouseMoveLog[i-1].t) / 1000 || 0.016;
        if (dt > 0.2) continue; // skip gaps
        var dx1 = _mouseMoveLog[i].x - _mouseMoveLog[i-1].x;
        var dy1 = _mouseMoveLog[i].y - _mouseMoveLog[i-1].y;
        var dx2 = _mouseMoveLog[i+1].x - _mouseMoveLog[i].x;
        var dy2 = _mouseMoveLog[i+1].y - _mouseMoveLog[i].y;
        var v = Math.sqrt(dx1*dx1 + dy1*dy1) / dt;
        if (v < 5) continue; // skip near-stationary
        // Curvature approximation: cross product / speed^3
        var cross = Math.abs(dx1 * dy2 - dy1 * dx2);
        var speed3 = Math.pow(v * dt, 3);
        if (speed3 < 0.001) continue;
        var kappa = cross / speed3;
        if (kappa > 0.001 && v > 0) {
          logV.push(Math.log(v));
          logK.push(Math.log(kappa));
        }
      }
      if (logV.length < 10) return -1;
      // Fit log-log regression: logV = a + beta * logK
      // Human beta should be near -1/3 (~-0.33)
      var n = logV.length;
      var sx = 0, sy = 0, sxy = 0, sx2 = 0;
      for (var j = 0; j < n; j++) {
        sx += logK[j]; sy += logV[j]; sxy += logK[j] * logV[j]; sx2 += logK[j] * logK[j];
      }
      var denom = n * sx2 - sx * sx;
      if (Math.abs(denom) < 0.001) return 0.3;
      var beta = (n * sxy - sx * sy) / denom;
      // Human: beta near -0.33. Bot: beta near 0 (no coupling) or far from -0.33
      var deviation = Math.abs(beta - (-0.333));
      if (deviation < 0.3) {
        return _ascore(1 - deviation * 3, 0.6);
      }
      return 0.2;
    },

    // ============================================================
    // SIGNAL 20: Device Motion (accelerometer + gyroscope)
    // BeCAPTCHA (Acien 2020), Stanford sensor research
    // ============================================================

    recordDeviceMotion: function(ax, ay, az, gx, gy, gz) {
      var now = Date.now();
      if (now - _lastMotionSample < 50) return; // ~20Hz cap
      _motionLog.push({ ax: ax, ay: ay, az: az, gx: gx, gy: gy, gz: gz, t: now });
      if (_motionLog.length > 500) _motionLog.shift();
      _lastMotionSample = now;
    },

    computeDeviceMotion: function() {
      if (_motionLog.length < 30) return -1; // need ~1.5s of data at 20Hz
      // Human holding phone: constant micro-tremor (accelerometer noise CV 0.02-0.15)
      // Bot/emulator: either zero motion or perfectly constant values
      var axVals = _motionLog.map(function(m) { return m.ax; });
      var ayVals = _motionLog.map(function(m) { return m.ay; });
      var gzVals = _motionLog.map(function(m) { return m.gz; });

      function stats(arr) {
        var mean = arr.reduce(function(a,b){return a+b;},0) / arr.length;
        var variance = arr.reduce(function(a,b){return a+Math.pow(b-mean,2);},0) / arr.length;
        var sd = Math.sqrt(variance);
        return { mean: mean, sd: sd, cv: mean !== 0 ? sd / Math.abs(mean) : 0 };
      }

      var axStats = stats(axVals);
      var ayStats = stats(ayVals);
      var gzStats = stats(gzVals);

      // Check 1: Is there any motion at all? (emulators return all zeros)
      if (axStats.sd < 0.001 && ayStats.sd < 0.001 && gzStats.sd < 0.001) return 0.05;

      // Check 2: Human hand tremor produces characteristic SD ranges
      // Accelerometer SD: 0.01-0.5 m/s² for stationary holding
      // Gyroscope SD: 0.001-0.1 rad/s for stationary holding
      var accelHumanLike = (axStats.sd > 0.005 && axStats.sd < 2.0) ? 1 : 0;
      accelHumanLike += (ayStats.sd > 0.005 && ayStats.sd < 2.0) ? 1 : 0;
      var gyroHumanLike = (gzStats.sd > 0.0005 && gzStats.sd < 0.5) ? 1 : 0;

      // Check 3: Motion should correlate with touch events (hand moves when tapping)
      var motionDuringTaps = 0;
      if (_tapLog.length > 0) {
        _tapLog.forEach(function(tap) {
          var nearMotion = _motionLog.filter(function(m) { return Math.abs(m.t - tap.t) < 200; });
          if (nearMotion.length > 0) {
            var tapMotion = nearMotion.reduce(function(sum, m) {
              return sum + Math.abs(m.ax) + Math.abs(m.ay);
            }, 0) / nearMotion.length;
            if (tapMotion > 0.1) motionDuringTaps++;
          }
        });
      }
      var tapCorrelation = _tapLog.length > 0 ? motionDuringTaps / _tapLog.length : 0.5;

      // Check 4: Variability of motion over time (not constant)
      var firstHalf = _motionLog.slice(0, Math.floor(_motionLog.length / 2));
      var secondHalf = _motionLog.slice(Math.floor(_motionLog.length / 2));
      var firstSD = stats(firstHalf.map(function(m){return m.ax;})).sd;
      var secondSD = stats(secondHalf.map(function(m){return m.ax;})).sd;
      var motionDrift = Math.abs(firstSD - secondSD) / ((firstSD + secondSD) / 2 || 1);
      var driftScore = _ascore(motionDrift, 0.3);

      var humanLikeRatio = (accelHumanLike + gyroHumanLike) / 3;
      return humanLikeRatio * 0.3 + _ascore(tapCorrelation, 0.6) * 0.4 + driftScore * 0.3;
    },

    // Composite Human Confidence Score (20 signals)
    computeHumanConfidence: function() {
      var timingCV = this.computeTimingCV();
      var timingScore = _ascore(Math.max(0, timingCV - 0.15), 1.2);

      var rawScores = {
        timing: timingScore,
        fitts: this.computeFittsCompliance(),
        hicks: this.computeHicksCompliance(),
        scroll: this.computeScrollSaccade(),
        microPause: this.computeMicroPauseScore(),
        touch: this.computeTouchVariance(),
        keystroke: this.computeKeystrokeDynamics(),
        readingSpeed: this.computeReadingSpeed(),
        hoverDwell: this.computeHoverDwell(),
        tabVisibility: this.computeTabVisibility(),
        inactivity: this.computeInactivityPattern(),
        rtVariability: this.computeRTVariability(),
        scrollBacktrack: this.computeScrollBacktracking(),
        fractalScaling: this.computeFractalScaling(),
        crossCorrelation: this.computeCrossSignalCorrelation(),
        curvatureIndex: this.computeCurvatureIndex(),
        cursorJerk: this.computeCursorJerk(),
        velocityProfile: this.computeVelocityProfile(),
        twoThirdsPower: this.computeTwoThirdsPowerLaw(),
        deviceMotion: this.computeDeviceMotion()
      };

      // Base weights — cross-signal correlation + device motion highest
      var baseWeights = {
        timing: 0.06, fitts: 0.04, hicks: 0.06, scroll: 0.05,
        microPause: 0.05, touch: 0.03, keystroke: 0.05,
        readingSpeed: 0.04, hoverDwell: 0.03, tabVisibility: 0.03,
        inactivity: 0.03,
        rtVariability: 0.07, scrollBacktrack: 0.05, fractalScaling: 0.06,
        crossCorrelation: 0.08, curvatureIndex: 0.04, cursorJerk: 0.05,
        velocityProfile: 0.04, twoThirdsPower: 0.05,
        deviceMotion: 0.09
      };

      // Identify active signals (returned real data, not -1 sentinel)
      var activeSignals = {};
      var inactiveWeight = 0;
      var activeWeight = 0;
      var activeCount = 0;

      for (var key in rawScores) {
        if (rawScores[key] === -1) {
          // Signal had insufficient data — exclude from scoring
          inactiveWeight += baseWeights[key];
          rawScores[key] = 0; // display as 0, not -1
        } else {
          activeSignals[key] = true;
          activeWeight += baseWeights[key];
          activeCount++;
        }
      }

      // Redistribute inactive weight proportionally across active signals
      var composite = 0;
      if (activeWeight > 0) {
        var scale = 1.0 / activeWeight;
        for (var sig in rawScores) {
          if (activeSignals[sig]) {
            composite += rawScores[sig] * baseWeights[sig] * scale;
          }
        }
      }

      // Confidence floor: scaled for 19 signals
      if (activeCount < 4) composite = Math.min(composite, 0.30);
      else if (activeCount < 7) composite = Math.min(composite, 0.50);
      else if (activeCount < 10) composite = Math.min(composite, 0.70);
      else if (activeCount < 14) composite = Math.min(composite, 0.85);
      // 14+ active signals: uncapped

      var result = { composite: composite, activeSignals: activeCount, totalSignals: 20 };
      for (var rk in rawScores) result[rk] = rawScores[rk];
      return result;
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
      Behavioral.recordActivity();
      Behavioral.recordFirstInteractionAfterRender();
      if (event.type === 'touchstart') {
        Behavioral.recordTap(event);
        Behavioral.recordTouch(event);
      } else if (event.type === 'click' || event.type === 'mousedown') {
        Behavioral.recordTap(event);
        if (event.clientX !== undefined) {
          Behavioral.recordClickCoord(event.clientX, event.clientY);
        }
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
      if (_config.enableBehavioralAnalysis) {
        Behavioral.recordInteraction();
        Behavioral.recordKeyDown(e);
        Behavioral.recordActivity();
      }
    }, { passive: true });
    document.addEventListener('keyup', function(e) {
      if (_config.enableBehavioralAnalysis) Behavioral.recordKeyUp(e);
    }, { passive: true });
    // Device motion (accelerometer + gyroscope) for mobile
    function _startDeviceMotion() {
      if (_motionPermissionGranted) return;
      window.addEventListener('devicemotion', function(e) {
        if (e.accelerationIncludingGravity && _config.enableBehavioralAnalysis) {
          var a = e.accelerationIncludingGravity;
          var r = e.rotationRate || { alpha: 0, beta: 0, gamma: 0 };
          Behavioral.recordDeviceMotion(a.x || 0, a.y || 0, a.z || 0, r.alpha || 0, r.beta || 0, r.gamma || 0);
        }
      }, { passive: true });
      _motionPermissionGranted = true;
    }
    // iOS 13+ requires permission request on user gesture
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      document.addEventListener('click', function _reqMotion() {
        DeviceMotionEvent.requestPermission().then(function(state) {
          if (state === 'granted') _startDeviceMotion();
        }).catch(function() {});
        document.removeEventListener('click', _reqMotion);
      }, { once: true });
    } else if (typeof DeviceMotionEvent !== 'undefined') {
      _startDeviceMotion();
    }

    document.addEventListener('mousemove', function(e) {
      _lastInteractionTime = Date.now();
      if (_config.enableBehavioralAnalysis) {
        Behavioral.recordActivity();
        if (e.clientX !== undefined) {
          Behavioral.recordMouseMove(e.clientX, e.clientY, Date.now());
        }
      }
    }, { passive: true });
    document.addEventListener('visibilitychange', function() {
      if (_config.enableBehavioralAnalysis) {
        Behavioral.recordVisibilityChange(!document.hidden);
      }
    });

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
    recordElementScroll: function(scrollTop) {
      Behavioral.recordScroll(scrollTop);
      // Auto-detect scroll reversals for backtracking signal
      if (_scrollLog.length >= 2) {
        var prev = _scrollLog[_scrollLog.length - 2];
        var curr = _scrollLog[_scrollLog.length - 1];
        var dir = curr.y > prev.y ? 'down' : curr.y < prev.y ? 'up' : null;
        if (dir && _scrollReversals.length > 0) {
          var lastDir = _scrollReversals[_scrollReversals.length - 1].direction;
          if (dir !== lastDir) Behavioral.recordScrollReversal(scrollTop, dir);
        } else if (dir) {
          Behavioral.recordScrollReversal(scrollTop, dir);
        }
      }
    },
    recordMobileInput: function(t) { Behavioral.recordMobileInput(t); },
    recordTouchDwell: function(startTime) { Behavioral.recordTouchDwell(startTime); },
    recordDeviceMotion: function(ax,ay,az,gx,gy,gz) { Behavioral.recordDeviceMotion(ax,ay,az,gx,gy,gz); },
    recordSectionEntry: function(id) { Behavioral.recordSectionEntry(id); },
    recordSectionExit: function(id, pct) { Behavioral.recordSectionExit(id, pct); },
    recordHoverEnter: function(id) { Behavioral.recordHoverEnter(id); },
    recordHoverLeave: function() { Behavioral.recordHoverLeave(); },
    getTimeline: function() { return Behavioral.getTimeline(); },
    takeTimelineSnapshot: function(phase) { Behavioral.recordTimelineSnapshot(phase); },

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

    // Cold storage receipt — generates a self-contained, offline-verifiable receipt
    // Can be stored locally, on USB, in a SCIF, or anywhere without internet
    // Later verified by re-hashing the payload and comparing to the stored hash
    generateColdReceipt: function() {
      var c = Behavioral.computeHumanConfidence();
      var stats = getStats();
      var timeline = Behavioral.getTimeline();
      var payload = {
        protocol: 'SWS-AP-v2',
        patent: 'SWS-PROV-001',
        entity: 'SWS Strategic Media LLC',
        session_id: _sessionId,
        generated: new Date().toISOString(),
        generated_epoch: Date.now(),
        duration_ms: Date.now() - _sessionStartTime,
        signals: {
          composite: c.composite,
          timing: c.timing, fitts: c.fitts, hicks: c.hicks,
          scroll: c.scroll, microPause: c.microPause, touch: c.touch,
          keystroke: c.keystroke, readingSpeed: c.readingSpeed,
          hoverDwell: c.hoverDwell, tabVisibility: c.tabVisibility,
          inactivity: c.inactivity,
          activeSignals: c.activeSignals, totalSignals: c.totalSignals
        },
        quality_tier: c.composite >= 0.7 ? 'deep_focus' : c.composite >= 0.5 ? 'active' : c.composite >= 0.25 ? 'passive' : 'background',
        hashes_earned: stats.totalHashes,
        timeline_summary: {
          snapshots: timeline.length,
          avg_composite: timeline.length > 0 ? timeline.reduce(function(s, t) { return s + t.composite; }, 0) / timeline.length : 0,
          deep_pct: timeline.length > 0 ? Math.round(timeline.filter(function(t) { return t.tier === 'deep'; }).length / timeline.length * 100) : 0,
          active_pct: timeline.length > 0 ? Math.round(timeline.filter(function(t) { return t.tier === 'active'; }).length / timeline.length * 100) : 0
        },
        offline: true,
        requires_internet: false
      };
      // Deterministic JSON for reproducible hashing
      var canonical = JSON.stringify(payload, Object.keys(payload).sort());
      var receiptHash = _sha256(canonical);
      return {
        payload: payload,
        hash: receiptHash,
        canonical: canonical,
        verification: 'To verify: JSON.stringify(payload, Object.keys(payload).sort()) then SHA-256. Must match hash.'
      };
    },

    // Version and meta
    version: '2.0.0',
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
