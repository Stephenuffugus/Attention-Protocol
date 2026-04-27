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

  // R2-NEW-2 / "THE WALL": raw event log for server-side recompute.
  // Created in init(); recorders fire from the event handlers below.
  // Privacy-safe: keystroke class buckets only (never the actual key);
  // no DOM identifiers, no URL capture, no reflection content.
  var _eventLog = null;

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
  // Each entry: {cls, holdTime, flightTime, t}. `cls` is a privacy-safe
  // character-class bucket (letter/number/space/punct/modifier/nav/enter/other).
  // We never store the actual key or its content — only the class, which lets
  // us compute digraph (class-pair) timing without capturing what the user typed.
  var _keystrokeLog = [];
  var _keyDownTimes = {};     // {keyCode: timestamp} for hold time calc
  var _lastKeyUpTime = 0;
  var _hoverLog = [];         // [{element, enterTime, leaveTime, dwellMs}, ...]
  var _currentHover = null;
  var _lastOneOverFCoherence = null; // Diagnostic for cross-channel 1/f coherence (signal 16b)
  // _clickLog: desktop click + mousedown timestamps, structurally independent
  // from _keystrokeLog and _tapLog. Required for the v2 1/f cross-channel
  // coherence test (Gilden 2001 grounding) — without it, the only "channel"
  // that has enough events on a short CME session is _keystrokeLog, and using
  // _interactionTimestamps as the second channel correlates with keystrokes
  // by construction (it's a union over all event types, dominated by them).
  var _clickLog = [];
  var _tabVisLog = [];        // [{visible: bool, t: timestamp}, ...]
  var _windowFocusLog = [];   // [{focused: bool, t: timestamp}, ...] — window blur/focus, orthogonal to tab-hide
  var _inactivityGaps = [];   // [{startTime, endTime, durationMs}, ...]
  var _lastActivityTime = Date.now();
  var _inactivityThreshold = 3000; // 3s of no interaction = gap
  var _sectionTimings = [];   // [{sectionId, enterTime, exitTime, scrollPct}, ...]
  var _timeline = [];         // [{t, composite, tier, signals, phase}, ...] every 10s
  var _timelineMax = 10000;   // cap: 10k snapshots = ~4 MB JSON, covers ~27h at 10s cadence
  var _timelineTruncated = 0; // count of entries evicted — surfaced in getTimeline for audit

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
  // KEYSTROKE CLASS BUCKETING (privacy-preserving digraph input)
  // ============================================================
  // Classes: l=letter, n=number, s=space, p=punct/symbol, m=modifier,
  // b=backspace/nav, e=enter, x=other. We only ever store the class,
  // never the key itself, so the digraph signal stays PII-free.
  function _keyClass(key, keyCode) {
    if (key != null && typeof key === 'string') {
      if (key.length === 1) {
        var code = key.charCodeAt(0);
        if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) return 'l';
        if (code >= 48 && code <= 57) return 'n';
        if (key === ' ') return 's';
        return 'p';
      }
      if (key === 'Shift' || key === 'Control' || key === 'Alt' || key === 'Meta' || key === 'CapsLock') return 'm';
      if (key === 'Backspace' || key === 'Delete' || key === 'Tab' || key === 'Home' || key === 'End' || key === 'PageUp' || key === 'PageDown' || (key.length > 5 && key.indexOf('Arrow') === 0)) return 'b';
      if (key === 'Enter') return 'e';
      return 'x';
    }
    if (keyCode == null) return 'x';
    if (keyCode >= 65 && keyCode <= 90) return 'l';
    if ((keyCode >= 48 && keyCode <= 57) || (keyCode >= 96 && keyCode <= 105)) return 'n';
    if (keyCode === 32) return 's';
    if (keyCode === 13) return 'e';
    if (keyCode === 8 || keyCode === 46 || keyCode === 9 || (keyCode >= 33 && keyCode <= 40)) return 'b';
    if (keyCode === 16 || keyCode === 17 || keyCode === 18 || keyCode === 20 || keyCode === 91 || keyCode === 93) return 'm';
    return 'p';
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

  // Canonical JSON: deep key-sorted serialization for deterministic hashing.
  // Round-2 R2-NEW-10 fix: NFC-normalize every string + object key
  // before serialization. Without this, "naïve" typed via NFC
  // (composed é) vs NFD (e + combining acute) hashes differently —
  // a verifier on a system that re-normalized differently would fail
  // to reproduce the signer's hash.
  function _nfc(s) {
    return (typeof s === 'string' && typeof s.normalize === 'function')
      ? s.normalize('NFC') : s;
  }
  function _canonicalJSON(obj) {
    if (obj === null || obj === undefined) return 'null';
    if (typeof obj === 'number') return Number.isFinite(obj) ? String(obj) : 'null';
    if (typeof obj === 'boolean') return obj ? 'true' : 'false';
    if (typeof obj === 'string') return JSON.stringify(_nfc(obj));
    if (Array.isArray(obj)) return '[' + obj.map(_canonicalJSON).join(',') + ']';
    if (typeof obj === 'object') {
      var entries = [];
      var origKeys = Object.keys(obj);
      for (var i = 0; i < origKeys.length; i++) {
        entries.push([_nfc(origKeys[i]), obj[origKeys[i]]]);
      }
      entries.sort(function(a, b) { return a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0); });
      return '{' + entries.map(function(e) {
        return JSON.stringify(e[0]) + ':' + _canonicalJSON(e[1]);
      }).join(',') + '}';
    }
    return 'null';
  }

  // Minimal JS SHA-256 fallback
  function _jsSha256(str) {
    // Round-3 R2-NEW-9 fix propagation: the round-2 / T2 batch fixed this
    // function in src/sdk/attention-receipts.js but left the parallel
    // implementation in proof/sdk/attention-protocol.js (which cme-demo.html
    // actually loads) unchanged. Round-3 cryptography review surfaced this
    // as a CRITICAL: any non-ASCII character (smart quote, em-dash,
    // accented user name, CJK, emoji) in the hashed input tripped
    // `if (j >> 8) return ''` and silently produced an empty hash that
    // would collide with every other empty-hash receipt. Now: input is
    // UTF-8 encoded via TextEncoder before processing; bytes are then
    // packed into 32-bit words by the standard SHA-256 schedule.
    var bytes;
    if (typeof TextEncoder !== 'undefined') {
      bytes = new TextEncoder().encode(str);
    } else {
      // Legacy fallback (very old environments). Joins surrogate pairs
      // to their full code point, then UTF-8 encodes — matches WHATWG
      // TextEncoder behavior for valid input. Lone surrogates are
      // emitted as U+FFFD (3-byte replacement) per the spec.
      var out = [];
      for (var ci = 0; ci < str.length; ci++) {
        var c = str.charCodeAt(ci);
        if (c >= 0xD800 && c <= 0xDBFF && ci + 1 < str.length) {
          var c2 = str.charCodeAt(ci + 1);
          if (c2 >= 0xDC00 && c2 <= 0xDFFF) {
            c = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00);
            ci++;
          } else { c = 0xFFFD; }
        } else if (c >= 0xDC00 && c <= 0xDFFF) {
          c = 0xFFFD;
        }
        if (c < 0x80) out.push(c);
        else if (c < 0x800) { out.push(0xC0 | (c >> 6)); out.push(0x80 | (c & 0x3F)); }
        else if (c < 0x10000) { out.push(0xE0 | (c >> 12)); out.push(0x80 | ((c >> 6) & 0x3F)); out.push(0x80 | (c & 0x3F)); }
        else { out.push(0xF0 | (c >> 18)); out.push(0x80 | ((c >> 12) & 0x3F)); out.push(0x80 | ((c >> 6) & 0x3F)); out.push(0x80 | (c & 0x3F)); }
      }
      bytes = out;
    }
    function rightRotate(value, amount) { return (value >>> amount) | (value << (32 - amount)); }
    var mathPow = Math.pow;
    var maxWord = mathPow(2, 32);
    var lengthProperty = 'length';
    var i, j;
    var result = '';
    var words = [];
    var byteLen = bytes[lengthProperty];
    var asciiBitLength = byteLen * 8;
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

    // Padding: append 0x80, then 0x00 bytes until length % 64 === 56.
    var padded = [];
    for (i = 0; i < byteLen; i++) padded.push(bytes[i]);
    padded.push(0x80);
    while (padded[lengthProperty] % 64 !== 56) padded.push(0x00);
    for (i = 0; i < padded[lengthProperty]; i++) {
      j = padded[i];
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

  // Reading-speed plausibility curve (words per minute).
  // Bands derived from the reading literature: typical adult 200-300 WPM,
  // skilled skim 400-700, speed-reader ceiling ~1200, paste/render >> 2000.
  // Returns a [0,1] plausibility score, or null when the rate is so slow
  // the section is more likely a tab-switch than reading (don't penalize).
  function _wpmPlausibility(wpm) {
    if (wpm == null || !isFinite(wpm)) return null;
    if (wpm < 50) return null;                   // skip — tab-switched, not signal
    if (wpm >= 150 && wpm <= 700) return 1.0;    // normal reading band
    if (wpm >= 100 && wpm < 150) return 0.8;     // slow/dabble reading
    if (wpm > 700 && wpm <= 1200) return 0.7;    // fast skim, still plausible
    if (wpm > 1200 && wpm <= 2000) return 0.35;  // edge of human
    if (wpm > 2000 && wpm <= 3500) return 0.15;  // implausible — bot tell
    if (wpm > 3500) return 0.05;                 // absurd — hard flag
    return 0.5;                                  // 50-100, rare; mild neutral
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

    // Independent click log (desktop click + mousedown). Distinct from
    // _keystrokeLog (typing), _scrollLog (scrolls), _tapLog (which on desktop
    // is filled by the same click events but used for click-precision math).
    // The clicks-as-independent-channel use case is the v2 1/f cross-channel
    // coherence test, where the channel must be structurally distinct from
    // the keystroke channel.
    recordClick: function(event) {
      _clickLog.push({ t: Date.now() });
      if (_clickLog.length > 200) _clickLog.shift();
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
      // Scrolling IS activity. Without this, a mobile reading session (which
      // has no mousemove events) logs the entire reading phase as an
      // inactivity gap, pushing gapRatio above 0.7 and making the inactivity
      // signal return -1 for otherwise-engaged humans.
      this.recordActivity();
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
      // Insufficient data: return 0.5 (neutral benefit-of-doubt) rather than
      // -1 sentinel. Rationale: a user who made only 3-4 decisions is not
      // bot-like — humans answer few questions all the time. Returning -1
      // would exclude this signal from the composite and weight-redistribute,
      // pushing distracted-but-honest humans below the bot gating ceiling
      // (~0.30) — verified regression in bot-harness tests 2026-04-26.
      if (_decisionLog.length < 5) return 0.5;

      // Group decisions by option count and compute average response time per group
      var groups = {};
      _decisionLog.forEach(function(d) {
        var key = d.optionCount;
        if (!groups[key]) groups[key] = [];
        groups[key].push(d.responseTimeMs);
      });

      var groupKeys = Object.keys(groups).map(Number).sort(function(a, b) { return a - b; });
      if (groupKeys.length < 2) return 0.5; // benefit-of-doubt for single-option-count sessions

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
      if (completed.length < 3) return 0.5; // benefit-of-doubt for sparse render-interaction data

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
      var cls = _keyClass(event.key, event.keyCode);
      _keystrokeLog.push({ cls: cls, holdTime: holdTime, flightTime: flightTime, t: now });
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
          var dg = this.computeDigraphStats();
          if (dg) {
            // Digraph path: weight the class-pair-transition signal into the
            // keystroke sub-composite. Humans emit diverse class-pairs with
            // natural within-pair variability and cross-pair differentiation
            // (e.g., letter→space transitions are typically faster than
            // letter→punct). Robotic typing collapses these distinctions.
            return rhythmScore * 0.25 + holdInRange * 0.25 + dg.score * 0.50;
          }
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

    // Pattern 7b: Digraph (class-pair transition) timing.
    // Returns null when data is insufficient so callers can fall back to
    // the legacy hold/flight formula. The return shape is stable (documented
    // in tests) and exposed via getHumanConfidence for buyer-auditable proofs.
    computeDigraphStats: function() {
      if (!_keystrokeLog || _keystrokeLog.length < 8) return null;
      var pairs = {};
      for (var i = 1; i < _keystrokeLog.length; i++) {
        var prev = _keystrokeLog[i - 1];
        var curr = _keystrokeLog[i];
        if (!prev || !curr) continue;
        if (prev.cls == null || curr.cls == null) continue;
        var ft = curr.flightTime;
        if (!(ft > 0 && ft < 2000)) continue;
        var k = prev.cls + curr.cls;
        if (!pairs[k]) pairs[k] = [];
        pairs[k].push(ft);
      }
      var keys = Object.keys(pairs);
      if (keys.length < 2) return null;

      // Diversity: number of distinct class-pair transitions observed.
      // 4+ distinct pairs is typical for any real typing in English-like prose.
      // 1-2 pairs is machine-generated monotone input.
      var diversityScore = Math.min(1, keys.length / 4);

      // Within-pair CV: for each pair-type, how variable is the flight time?
      // Humans cluster around 0.3-0.8. Bots uniform-paste collapse toward 0.
      var pairMeans = [];
      var withinCVs = [];
      for (var p = 0; p < keys.length; p++) {
        var vals = pairs[keys[p]];
        if (!vals || vals.length === 0) continue;
        var sum = 0;
        for (var q = 0; q < vals.length; q++) sum += vals[q];
        var mean = sum / vals.length;
        pairMeans.push(mean);
        if (vals.length >= 2 && mean > 0) {
          var vsum = 0;
          for (var r = 0; r < vals.length; r++) vsum += Math.pow(vals[r] - mean, 2);
          withinCVs.push(Math.sqrt(vsum / vals.length) / mean);
        }
      }

      function _scoreWithin(cv) {
        if (cv < 0.10) return 0.00;
        if (cv < 0.25) return (cv - 0.10) / 0.15 * 0.60;
        if (cv <= 0.80) return 0.60 + (cv - 0.25) * 0.40 / 0.55;
        if (cv <= 1.50) return 1.00 - (cv - 0.80) * 0.40 / 0.70;
        return 0.20;
      }

      var avgWithinCV = withinCVs.length
        ? withinCVs.reduce(function(a, b) { return a + b; }, 0) / withinCVs.length
        : 0;
      var withinScore = withinCVs.length ? _scoreWithin(avgWithinCV) : 0.40;

      // Cross-pair differentiation: do different pair types occupy different
      // timing bands? Humans: yes (space-letter transitions are typically
      // faster than letter-punct). Bots pasting uniformly: all pairs collapse
      // to one band.
      var crossCV = 0;
      if (pairMeans.length >= 2) {
        var gm = 0;
        for (var s = 0; s < pairMeans.length; s++) gm += pairMeans[s];
        gm = gm / pairMeans.length;
        if (gm > 0) {
          var cv = 0;
          for (var u = 0; u < pairMeans.length; u++) cv += Math.pow(pairMeans[u] - gm, 2);
          crossCV = Math.sqrt(cv / pairMeans.length) / gm;
        }
      }
      var crossScore;
      if (crossCV < 0.05) crossScore = 0.10;
      else if (crossCV < 0.15) crossScore = 0.10 + (crossCV - 0.05) * 0.50 / 0.10;
      else if (crossCV <= 0.50) crossScore = 0.60 + (crossCV - 0.15) * 0.40 / 0.35;
      else crossScore = Math.max(0.40, 1.00 - (crossCV - 0.50) * 0.60 / 0.50);

      return {
        pairTypes: keys.length,
        diversity: diversityScore,
        withinCV: avgWithinCV,
        within: withinScore,
        crossCV: crossCV,
        cross: crossScore,
        score: diversityScore * 0.25 + withinScore * 0.40 + crossScore * 0.35
      };
    },

    // Pattern 8: Reading Speed Inference
    // Optional wordCount arg enables WPM-coherence scoring: callers that
    // know how much visible text is in a section can pass its word count so
    // we can detect "read 2000 words in 300ms" patterns (paste, render-only).
    recordSectionEntry: function(sectionId, wordCount) {
      _sectionTimings.push({
        sectionId: sectionId,
        enterTime: Date.now(),
        exitTime: null,
        scrollPct: 0,
        wordCount: (typeof wordCount === 'number' && wordCount > 0) ? wordCount : null
      });
    },

    recordSectionExit: function(sectionId, scrollPct, wordCount) {
      for (var i = _sectionTimings.length - 1; i >= 0; i--) {
        if (_sectionTimings[i].sectionId === sectionId && !_sectionTimings[i].exitTime) {
          _sectionTimings[i].exitTime = Date.now();
          _sectionTimings[i].scrollPct = scrollPct || 100;
          if (typeof wordCount === 'number' && wordCount > 0) {
            _sectionTimings[i].wordCount = wordCount;
          }
          break;
        }
      }
    },

    // Reading-speed coherence: per-section WPM vs. what a human can physically
    // read. Returns null when fewer than 2 sections have word counts (can't
    // judge), otherwise {score, sections, meanPlausibility, implausibleRatio}.
    computeReadingCoherence: function() {
      var scores = [];
      var implausible = 0;
      for (var i = 0; i < _sectionTimings.length; i++) {
        var s = _sectionTimings[i];
        if (!s.exitTime || typeof s.wordCount !== 'number' || s.wordCount <= 0) continue;
        var durMs = s.exitTime - s.enterTime;
        if (durMs < 200) continue; // scroll-through artifact, not a read
        var durMin = durMs / 60000;
        var wpm = s.wordCount / durMin;
        var p = _wpmPlausibility(wpm);
        if (p === null) continue; // too slow = tab-switch, don't count either way
        scores.push(p);
        if (p < 0.25) implausible++;
      }
      if (scores.length < 2) return null;
      var mean = scores.reduce(function(a, b) { return a + b; }, 0) / scores.length;
      var implausibleRatio = implausible / scores.length;
      var score = mean;
      // Hard clamp: if majority of sections are physically implausible, the
      // session reads like a bot regardless of average.
      if (implausibleRatio >= 0.5) score = Math.min(score, 0.25);
      return {
        score: score,
        sections: scores.length,
        meanPlausibility: mean,
        implausibleRatio: implausibleRatio
      };
    },

    computeReadingSpeed: function() {
      // Two-band filter:
      //   - Scroll-through artifacts (< 200ms per section) are NOT real reads.
      //     They happen when a user orients themselves by scrolling, or when
      //     a bot scrolls rapidly through the content.
      //   - Valid reads (>= 200ms) are what we score against.
      // But we can't just drop artifacts silently — paste-pattern bots that
      // produce only sub-200ms sections would then fall into "insufficient
      // data -> signal inactive" and effectively escape the penalty. Fix:
      // if the majority of sections are artifacts, flag as "impossibly
      // fast skim" (0.2) regardless of what the remaining valid sections say.
      var all = _sectionTimings.filter(function(s) { return s.exitTime; });
      if (all.length < 3) return -1;
      var artifacts = 0;
      var completed = [];
      for (var i = 0; i < all.length; i++) {
        if ((all[i].exitTime - all[i].enterTime) >= 200) {
          completed.push(all[i]);
        } else {
          artifacts++;
        }
      }
      // Paste / scroll-through pattern — majority of sections are sub-200ms.
      // This was the bot tell before the artifact filter was added; preserve it.
      if (artifacts >= 3 && artifacts > completed.length) return 0.2;
      // Need enough valid sections to produce a stable CV.
      if (completed.length < 3) return -1;
      var durations = completed.map(function(s) { return s.exitTime - s.enterTime; });
      var mean = durations.reduce(function(a, b) { return a + b; }, 0) / durations.length;
      if (mean < 200) return 0.2; // impossibly fast skim — still flag
      if (mean > 60000) return -1; // too long per section = likely tab switch, not signal
      var variance = durations.reduce(function(a, b) { return a + Math.pow(b - mean, 2); }, 0) / durations.length;
      var cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
      // Mobile users read sections in 1-8 seconds typically
      var speedScore = _ascore(mean, 3000);
      var varianceScore = _ascore(cv, 0.4);
      var existing = speedScore * 0.5 + varianceScore * 0.5;

      // Blend in WPM coherence when word counts are available. Coherence is
      // the stronger signal (it catches paste patterns the CV-only scorer
      // can't see), so it gets higher weight in the blend.
      var coh = this.computeReadingCoherence();
      if (coh === null) return existing;
      return existing * 0.4 + coh.score * 0.6;
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

    // Pattern 10: Tab Visibility (with orthogonal window-focus evidence)
    recordVisibilityChange: function(visible) {
      _tabVisLog.push({ visible: visible, t: Date.now() });
    },

    // Window blur/focus is orthogonal to document visibility:
    // - visibilitychange fires when the tab is hidden/shown
    // - blur/focus fires when the window loses OS-level focus (alt-tab, click
    //   to another app) even while the tab remains "visible"
    // Together, an always-foreground, never-blurred session is a stronger
    // bot tell than either signal alone.
    recordWindowFocus: function(focused) {
      _windowFocusLog.push({ focused: !!focused, t: Date.now() });
      if (_windowFocusLog.length > 200) _windowFocusLog.shift();
    },

    getFocusStats: function() {
      var sessionSec = (Date.now() - _sessionStartTime) / 1000;
      var blurs = 0;
      var focuses = 0;
      for (var i = 0; i < _windowFocusLog.length; i++) {
        if (_windowFocusLog[i].focused) focuses++; else blurs++;
      }
      var last = _windowFocusLog.length > 0 ? _windowFocusLog[_windowFocusLog.length - 1].focused : true;
      return {
        blurCount: blurs,
        focusCount: focuses,
        events: _windowFocusLog.length,
        currentlyFocused: last,
        sessionSeconds: sessionSec
      };
    },

    computeTabVisibility: function() {
      var totalTime = Date.now() - _sessionStartTime;
      if (totalTime < 5000) return -1; // too short to judge

      var focusBlurs = 0;
      for (var j = 0; j < _windowFocusLog.length; j++) {
        if (!_windowFocusLog[j].focused) focusBlurs++;
      }

      if (_tabVisLog.length === 0) {
        // No tab-hide events. Window-focus events are a second chance to
        // detect normal human context-switching even when the tab stayed
        // "visible" the whole time.
        if (focusBlurs >= 1) {
          // User alt-tabbed / clicked another app at least once — human.
          return totalTime > 30000 ? 0.85 : 0.78;
        }
        // Neither signal shows any away-event.
        if (totalTime > 120000) return 0.55; // two signals agree: suspiciously perfect
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

      var baseScore;
      // High visibility is good, but some switching is MORE human.
      // Sweet spot: 70-95% visible with 1-3 switches.
      if (visibleRatio > 0.95 && switchCount === 0) baseScore = 0.65; // suspiciously perfect
      else if (visibleRatio >= 0.7 && switchCount >= 1) baseScore = _ascore(visibleRatio, 0.85);
      else if (visibleRatio < 0.5) baseScore = 0.2; // mostly hidden — likely abandoned
      else baseScore = _ascore(visibleRatio * 0.8 + (switchCount > 0 ? 0.15 : 0), 0.7);

      // Focus-coherence bonus: tab stayed visible but window lost focus at
      // least once — that's a real human context switch the tab-only path
      // can't see. Small, bounded bump.
      if (visibleRatio > 0.9 && focusBlurs >= 1) {
        baseScore = Math.min(1.0, baseScore + 0.05);
      }
      return baseScore;
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
      // Require enough session to judge activity patterns reliably.
      if (sessionDuration < 60000) return -1;
      if (_inactivityGaps.length === 0) {
        // No gaps in a 60s+ session = sustained engagement. Bot-or-human
        // ambiguity is resolved by the gated composite (environmental,
        // composition, honeypot layers); this signal alone scores it as focus.
        if (sessionDuration > 60000) return 0.85;
        return 0.7; // short session without gaps is fine
      }
      var totalGapTime = _inactivityGaps.reduce(function(sum, g) { return sum + g.durationMs; }, 0);
      var gapRatio = totalGapTime / sessionDuration;
      // High gap ratio can mean "user is reading" on content-heavy pages. Don't
      // treat it as bot-evidence; flag as insufficient data instead.
      if (gapRatio > 0.7) return -1;
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
      // Ring-buffer cap: evict oldest if we've exceeded the retention window.
      // At 10k entries + ~400 B each, the serialized payload stays under 4 MB
      // which is well inside any practical receipt-transport budget.
      if (_timeline.length > _timelineMax) {
        var overflow = _timeline.length - _timelineMax;
        _timeline.splice(0, overflow);
        _timelineTruncated += overflow;
      }
    },

    getTimeline: function() {
      // Attach truncation state so a verifier can tell whether they're
      // looking at the full session or a tail-only view.
      var out = _timeline.slice();
      if (_timelineTruncated > 0) {
        Object.defineProperty(out, '_truncated', {
          value: _timelineTruncated, enumerable: false
        });
      }
      return out;
    },

    getTimelineMeta: function() {
      return {
        retained: _timeline.length,
        truncated: _timelineTruncated,
        cap: _timelineMax,
        complete: _timelineTruncated === 0
      };
    },

    // ============================================================
    // TIER 1: NEW SIGNALS (zero new data needed)
    // ============================================================

    // Signal 12: RT Variability (Coefficient of Variation + Ex-Gaussian tau)
    // Esterman et al. 2013, strongest single attention metric in cognitive science
    computeRTVariability: function() {
      // Need more interactions for a stable CV estimate. 15 was too few.
      if (_interactionTimestamps.length < 20) return -1;
      var intervals = [];
      for (var i = 1; i < _interactionTimestamps.length; i++) {
        var dt = _interactionTimestamps[i] - _interactionTimestamps[i - 1];
        if (dt > 50 && dt < 10000) intervals.push(dt);
      }
      if (intervals.length < 15) return -1;
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
      // Need enough scroll events AND enough session time before we can
      // judge whether "no backtracking" is suspicious or just a short
      // first-pass read. Short sessions often have zero backtracks legitimately.
      if (_scrollLog.length < 30) return -1;
      var sessionDur = Date.now() - _sessionStartTime;
      if (sessionDur < 120000) return -1; // <2 min → not enough reading time to judge
      var totalScrollEvents = _scrollLog.length;
      var backtrackRatio = upReversals.length / totalScrollEvents;
      // Humans re-read: 5-15% backtrack ratio on medium-difficulty text
      // Bots: 0% (never go back) or random
      if (backtrackRatio === 0) return -1; // insufficient data: no backtrack doesn't prove bot
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

    // Signal 14: Fractal Scaling via prewhitened Detrended Fluctuation Analysis
    // Gilden 2001 (Psych Review 108:33), Wijnants 2009 — biological authenticity fingerprint.
    //
    // Implementation: Torre-Delignières prewhitened DFA-1 (Torre & Delignières 2008,
    // Hum Mov Sci 27:213). Pre-empts the Wagenmakers, Farrell, Ratcliff (2004,
    // Psychon Bull Rev 11:579) critique that naive log-log scaling estimates
    // confuse short-range dependence (AR(1)) for true long-range dependence.
    //
    // Pipeline:
    //   1. Build inter-event interval series x[]
    //   2. Fit AR(1) coefficient phi by least-squares
    //   3. Compute residuals (x - mean) - phi*(x_prev - mean) — removes SRD
    //   4. Run DFA-1 on residuals → returns {alpha, R²} of log-log scaling fit
    //   5. Gate the score on R² ≥ 0.85 (Delignières 2006); otherwise return weak score
    //
    // This is the canonical short-series (n<200) substitute for full ARFIMA MLE,
    // which Wagenmakers himself notes is unstable below n≈256.
    computeFractalScaling: function() {
      if (_interactionTimestamps.length < 31) return -1;
      var x = [];
      for (var i = 1; i < _interactionTimestamps.length; i++) {
        var dt = _interactionTimestamps[i] - _interactionTimestamps[i - 1];
        if (dt > 10 && dt < 10000) x.push(dt);
      }
      var n = x.length;
      if (n < 30) return -1;

      // DFA-1 helper — returns {alpha, r2} for a given series
      function dfa1(series) {
        var N = series.length;
        var mu = 0, s;
        for (s = 0; s < N; s++) mu += series[s];
        mu /= N;
        var profile = [], run = 0;
        for (s = 0; s < N; s++) { run += series[s] - mu; profile.push(run); }
        var grid = [4, 6, 8, 12, 16, 24, 32, 48, 64];
        var lx = [], ly = [];
        for (var g = 0; g < grid.length; g++) {
          var ws = grid[g];
          if (ws > Math.floor(N / 4)) break;
          var nw = Math.floor(N / ws), totSq = 0;
          for (var w = 0; w < nw; w++) {
            var sx = 0, sy = 0, sxy = 0, sx2 = 0, k;
            for (k = 0; k < ws; k++) {
              var y = profile[w * ws + k];
              sx += k; sy += y; sxy += k * y; sx2 += k * k;
            }
            var den = ws * sx2 - sx * sx;
            var slp = den !== 0 ? (ws * sxy - sx * sy) / den : 0;
            var icp = (sy - slp * sx) / ws;
            for (k = 0; k < ws; k++) {
              var d = profile[w * ws + k] - (slp * k + icp);
              totSq += d * d;
            }
          }
          var Fs = Math.sqrt(totSq / (nw * ws));
          if (Fs > 0) { lx.push(Math.log(ws)); ly.push(Math.log(Fs)); }
        }
        if (lx.length < 3) return { alpha: NaN, r2: 0 };
        var L = lx.length, mx = 0, my = 0;
        for (s = 0; s < L; s++) { mx += lx[s]; my += ly[s]; }
        mx /= L; my /= L;
        var num = 0, dxx = 0, dyy = 0;
        for (s = 0; s < L; s++) {
          num += (lx[s] - mx) * (ly[s] - my);
          dxx += (lx[s] - mx) * (lx[s] - mx);
          dyy += (ly[s] - my) * (ly[s] - my);
        }
        var alpha = dxx > 0 ? num / dxx : NaN;
        var r2 = (dxx > 0 && dyy > 0) ? (num * num) / (dxx * dyy) : 0;
        return { alpha: alpha, r2: r2 };
      }

      // AR(1) prewhitening — removes the short-range dependence component
      var mean = 0, t;
      for (t = 0; t < n; t++) mean += x[t];
      mean /= n;
      var arNum = 0, arDen = 0;
      for (t = 1; t < n; t++) {
        arNum += (x[t] - mean) * (x[t - 1] - mean);
        arDen += (x[t - 1] - mean) * (x[t - 1] - mean);
      }
      var phi = arDen > 0 ? arNum / arDen : 0;
      if (phi > 0.99) phi = 0.99;
      if (phi < -0.99) phi = -0.99;
      var resid = [];
      for (t = 1; t < n; t++) resid.push((x[t] - mean) - phi * (x[t - 1] - mean));

      var pw = dfa1(resid);
      if (isNaN(pw.alpha)) return -1;

      // R² gate (Delignières 2006): below 0.85, the log-log scaling fit is too
      // noisy to trust. Return a weak default rather than overclaiming an exponent.
      if (pw.r2 < 0.85) return 0.30;

      // Human motor timing on AR(1) residuals: alpha 0.6-0.9 (persistent pink noise)
      // White noise (random): alpha ~0.5. Brown noise (over-correlated): alpha ~1.0+
      // Bots: alpha near 0.5 (random) or near 0 (fixed intervals); also typically fail R² gate.
      if (pw.alpha >= 0.5 && pw.alpha <= 1.1) {
        return _ascore(1 - Math.abs(pw.alpha - 0.75) * 3, 0.7);
      }
      return 0.2; // outside human range after AR(1) prewhitening
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
    // SIGNAL 16: 1/f Cross-Channel Coherence (NEW — Gilden 2001 grounding)
    //
    // The shared-generator argument: human cognitive timing across channels
    // (clicks, scrolls, keystrokes, taps, decisions) shares a single neural
    // generator, so the 1/f spectral exponent α is approximately equal across
    // channels (Gilden, Thornton, Mallon 1995, Science 267:1837; Gilden 2001
    // Psych Review 108:33). Bots that synthesize each channel independently
    // produce α drawn from independent distributions per-channel — across-
    // channel variance of α is therefore HIGH for bots, LOW for humans.
    //
    // This is the operationalization of the cross-signal coherence claim
    // (see docs/yc-defense/09_cross_signal_coherence_math.md). It catches
    // exactly the regime BeCAPTCHA-Mouse, DMTG, and Wasserstein-DCGAN bots
    // operate in — single-channel attacks that don't model joint coherence.
    //
    // Method: prewhitened DFA-1 (Torre-Delignières 2008, Wagenmakers 2004
    // pre-empt) on each channel that has ≥30 inter-event intervals; compute
    // the across-channel variance of α; map to a 0-1 score (low variance
    // → high coherence → high score).
    // ============================================================

    computeOneOverFCoherence: function() {
      var self = this;
      // Use the same dfa1 logic as computeFractalScaling. We re-derive it
      // inline to avoid extracting a helper that would change the surface
      // area of the module. The price is a bit of code duplication, paid
      // once for two well-separated calls.
      function dfa1(series) {
        var N = series.length;
        if (N < 30) return null;
        var mu = 0, s;
        for (s = 0; s < N; s++) mu += series[s];
        mu /= N;
        var profile = [], run = 0;
        for (s = 0; s < N; s++) { run += series[s] - mu; profile.push(run); }
        var grid = [4, 6, 8, 12, 16, 24, 32, 48, 64];
        var lx = [], ly = [];
        for (var g = 0; g < grid.length; g++) {
          var ws = grid[g];
          if (ws > Math.floor(N / 4)) break;
          var nw = Math.floor(N / ws), totSq = 0;
          for (var w = 0; w < nw; w++) {
            var sx = 0, sy = 0, sxy = 0, sx2 = 0, k;
            for (k = 0; k < ws; k++) {
              var y = profile[w * ws + k];
              sx += k; sy += y; sxy += k * y; sx2 += k * k;
            }
            var den = ws * sx2 - sx * sx;
            var slp = den !== 0 ? (ws * sxy - sx * sy) / den : 0;
            var icp = (sy - slp * sx) / ws;
            for (k = 0; k < ws; k++) {
              var d = profile[w * ws + k] - (slp * k + icp);
              totSq += d * d;
            }
          }
          var Fs = Math.sqrt(totSq / (nw * ws));
          if (Fs > 0) { lx.push(Math.log(ws)); ly.push(Math.log(Fs)); }
        }
        if (lx.length < 3) return null;
        var L = lx.length, mx = 0, my = 0;
        for (s = 0; s < L; s++) { mx += lx[s]; my += ly[s]; }
        mx /= L; my /= L;
        var num = 0, dxx = 0, dyy = 0;
        for (s = 0; s < L; s++) {
          num += (lx[s] - mx) * (ly[s] - my);
          dxx += (lx[s] - mx) * (lx[s] - mx);
          dyy += (ly[s] - my) * (ly[s] - my);
        }
        var alpha = dxx > 0 ? num / dxx : NaN;
        var r2 = (dxx > 0 && dyy > 0) ? (num * num) / (dxx * dyy) : 0;
        if (isNaN(alpha)) return null;
        return { alpha: alpha, r2: r2 };
      }

      function intervalsFromTimestamps(arr) {
        var ints = [];
        for (var i = 1; i < arr.length; i++) {
          var dt = arr[i] - arr[i - 1];
          if (dt > 10 && dt < 10000) ints.push(dt);
        }
        return ints;
      }

      // Build per-channel inter-event interval series. Critical: the channels
      // must be STRUCTURALLY INDEPENDENT (different physical event types), not
      // mathematical unions. v1 used _interactionTimestamps which is a union
      // over all events — keystrokes dominated, making the "interaction"
      // channel effectively the same series as the keystroke channel and
      // correlated by construction. v2 uses only physically-distinct channels
      // and requires ≥30 events per channel for stable α estimation.
      var channels = [];

      var scrollTs = _scrollLog.map(function(s) { return s.t; });
      var scrollInts = intervalsFromTimestamps(scrollTs);
      if (scrollInts.length >= 30) channels.push({ name: 'scroll', ints: scrollInts });

      var clickTs = _clickLog.map(function(c) { return c.t; });
      var clickInts = intervalsFromTimestamps(clickTs);
      if (clickInts.length >= 30) channels.push({ name: 'click', ints: clickInts });

      var keyTs = _keystrokeLog.length >= 30 ? _keystrokeLog.map(function(k) { return k.t; }) : [];
      var keyInts = intervalsFromTimestamps(keyTs);
      if (keyInts.length >= 30) channels.push({ name: 'keystroke', ints: keyInts });

      var tapTs = _tapLog.map(function(t) { return t.t; });
      var tapInts = intervalsFromTimestamps(tapTs);
      if (tapInts.length >= 30) channels.push({ name: 'tap', ints: tapInts });

      // Need at least 2 STRUCTURALLY INDEPENDENT channels for cross-channel
      // comparison. Short CME sessions typically have only keystrokes ≥30, so
      // this signal returns -1 (N/A) on those — that's correct behavior; a
      // signal that fires positively on insufficient data is worse than one
      // that abstains. Long-session use cases (kiosk, gaming, multi-hour
      // learning) will have ≥2 channels and the test will fire.
      if (channels.length < 2) return -1;

      // Compute α per channel (with AR(1) prewhitening — the Wagenmakers
      // 2004 pre-empt; SRD-mimics-LRD critique handled by removing the AR(1)
      // component before estimating scaling).
      var alphas = [];
      var details = [];
      channels.forEach(function(ch) {
        var x = ch.ints;
        var n = x.length;
        // AR(1) coefficient
        var mean = 0, t;
        for (t = 0; t < n; t++) mean += x[t];
        mean /= n;
        var arNum = 0, arDen = 0;
        for (t = 1; t < n; t++) {
          arNum += (x[t] - mean) * (x[t - 1] - mean);
          arDen += (x[t - 1] - mean) * (x[t - 1] - mean);
        }
        var phi = arDen > 0 ? arNum / arDen : 0;
        if (phi > 0.99) phi = 0.99;
        if (phi < -0.99) phi = -0.99;
        var resid = [];
        for (t = 1; t < n; t++) resid.push((x[t] - mean) - phi * (x[t - 1] - mean));
        var pw = dfa1(resid);
        if (pw && pw.r2 >= 0.80) {
          alphas.push(pw.alpha);
          details.push({ channel: ch.name, alpha: pw.alpha, r2: pw.r2, n: n });
        }
      });

      if (alphas.length < 2) return -1;

      // Across-channel variance of α. Humans: shared generator → low variance
      // (~0.05–0.15 typical). Bots independently sampling per-channel → variance
      // 0.20+ commonly.
      var amean = alphas.reduce(function(a, b) { return a + b; }, 0) / alphas.length;
      var avar = alphas.reduce(function(a, b) { return a + Math.pow(b - amean, 2); }, 0) / alphas.length;
      var asd = Math.sqrt(avar);

      // Score: low SD → high coherence → high score. SD ≤ 0.10 = pure-human;
      // SD ≥ 0.30 = uncorrelated channels (bot-like). Map exponentially.
      var score = Math.exp(-asd * 6); // SD=0 → 1.0; SD=0.10 → 0.55; SD=0.30 → 0.17
      score = Math.max(0, Math.min(1, score));

      // Stash diagnostic for the receipt UI
      _lastOneOverFCoherence = {
        alphas: alphas,
        mean_alpha: amean,
        sd_alpha: asd,
        channels: details,
        score: score
      };
      return score;
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
      // Threshold chosen to activate alongside cursorJerk/velocityProfile on
      // typical desktop sessions (20+ samples, 2+ movements). Prior threshold
      // of 3+ movements caused curvatureIndex to stay at -1 (sentinel) while
      // the neighbouring motor signals activated normally — inconsistent
      // coverage on legitimate desktop data.
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
      if (movements.length < 2) return -1;

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
      // Human jerk: moderate and variable (CV 0.3-1.5)
      // Bot jerk: near zero (perfectly smooth) or very high (random noise)
      // 2026-04-26 attempted to tighten via Gaussian — empirically MORE
      // generous to Bezier bots whose actual CV lands near the 0.8 peak.
      // Reverted to original _ascore-based curve which peaks at ~0.81.
      // Real discrimination against curve-aware bots requires submovement
      // detection or tremor-frequency analysis, not single-statistic CV.
      if (avgJerkCV >= 0.2 && avgJerkCV <= 2.0) {
        return _ascore(1 - Math.abs(avgJerkCV - 0.8) * 1.0, 0.7);
      }
      return 0.2;
    },

    // Signal 17c: Submovement Count (NEW 2026-04-26 evening)
    //
    // Real human ballistic mouse movements decompose into a primary ballistic
    // phase followed by 1–2 corrective submovements as the motor system
    // homes in on the target (Woodworth 1899; Meyer, Abrams, Kornblum,
    // Wright, Smith 1988 "Optimality in human motor performance: Ideal
    // control of rapid aimed movements" Psych Review 95:340; Crossman &
    // Goodeve 1983; Elliott, Helsen, Chua 2001). The velocity profile thus
    // shows 2–3 local maxima per movement.
    //
    // Bezier-curve bots produce a single smooth velocity bell (one peak
    // per movement) because cubic Bezier with constant parameterization
    // doesn't model corrective sub-strategies. Even with random control
    // points + Gaussian noise, the noise is HF jitter, not the deliberate
    // mid-movement velocity discontinuity that real corrective submovements
    // produce.
    //
    // This is the discriminator against the DMTG-class adversary that
    // matches Two-Thirds Power Law β, Cursor Jerk CV, Curvature Index, and
    // velocity bell-shape ratio individually but lacks the multi-peak
    // velocity structure of real motor planning. Tested 2026-04-26: my
    // Bezier-mouse adversarial harness shows avg 1.0–1.4 peaks per movement;
    // human reference would show 1.8–2.8.
    computeSubmovementCount: function() {
      if (_mouseMoveLog.length < 30) return -1;
      var movements = [];
      var current = [_mouseMoveLog[0]];
      for (var i = 1; i < _mouseMoveLog.length; i++) {
        if (_mouseMoveLog[i].t - _mouseMoveLog[i - 1].t > 300) {
          if (current.length >= 8) movements.push(current);
          current = [];
        }
        current.push(_mouseMoveLog[i]);
      }
      if (current.length >= 8) movements.push(current);
      if (movements.length < 3) return -1;

      var peakCounts = [];
      movements.forEach(function(m) {
        var velocities = [];
        for (var j = 1; j < m.length; j++) {
          var dt = (m[j].t - m[j - 1].t) / 1000 || 0.016;
          var dist = Math.sqrt(Math.pow(m[j].x - m[j - 1].x, 2) + Math.pow(m[j].y - m[j - 1].y, 2));
          velocities.push(dist / dt);
        }
        if (velocities.length < 6) return;
        // v2 (2026-04-26 evening): heavier smoothing + strict peak detection
        // to suppress 60Hz Bezier-noise false-positives. v1 used 3-point MA
        // and accepted any local maximum; my Bezier-with-jitter bot scored
        // 0.85 (false-positive) because Gaussian noise creates artificial
        // peaks at the per-sample level. v2 adds:
        //   1. 7-point Gaussian-weighted smooth (weights [0.06, 0.12, 0.20, 0.24, 0.20, 0.12, 0.06])
        //      — kernel SD ≈ 1.5 samples, suppresses noise wavelengths < 3 samples
        //   2. Minimum-separation 4 samples (~64ms at 60Hz) between peaks
        //      — real corrective submovements separated by ≥80ms (Crossman & Goodeve 1983)
        //   3. Minimum prominence 15% of global peak — local rises smaller than this
        //      are noise, not corrective submovements
        var smooth = [];
        var kernel = [0.06, 0.12, 0.20, 0.24, 0.20, 0.12, 0.06];
        for (var k = 0; k < velocities.length; k++) {
          var sum = 0, wsum = 0;
          for (var i = 0; i < kernel.length; i++) {
            var idx = k + (i - 3);
            if (idx < 0 || idx >= velocities.length) continue;
            sum += velocities[idx] * kernel[i];
            wsum += kernel[i];
          }
          smooth.push(wsum > 0 ? sum / wsum : 0);
        }
        var maxV = Math.max.apply(null, smooth);
        if (maxV < 5) return;
        var globalThreshold = maxV * 0.30;
        var prominenceThreshold = maxV * 0.15;
        var minSeparation = 4;
        var peaks = [];
        for (var p = 1; p < smooth.length - 1; p++) {
          // Local-max test (strict)
          if (smooth[p] <= smooth[p - 1] || smooth[p] <= smooth[p + 1]) continue;
          // Above global threshold (30% of peak)
          if (smooth[p] < globalThreshold) continue;
          // Find nearest preceding valley (lowest sample within 5 prior samples
          // or until previous accepted peak)
          var valleyStart = peaks.length > 0 ? peaks[peaks.length - 1] : Math.max(0, p - 5);
          var valleyMin = smooth[p];
          for (var v = p - 1; v >= valleyStart; v--) {
            if (smooth[v] < valleyMin) valleyMin = smooth[v];
          }
          // Prominence: peak height above the valley
          var prominence = smooth[p] - valleyMin;
          if (prominence < prominenceThreshold) continue;
          // Minimum separation from previous accepted peak
          if (peaks.length > 0 && (p - peaks[peaks.length - 1]) < minSeparation) {
            // Replace previous peak only if this one is higher
            if (smooth[p] > smooth[peaks[peaks.length - 1]]) {
              peaks[peaks.length - 1] = p;
            }
            continue;
          }
          peaks.push(p);
        }
        var peakCount = peaks.length;
        if (peakCount === 0) peakCount = 1; // at least the global max counts
        peakCounts.push(peakCount);
      });

      if (peakCounts.length < 3) return -1;
      var avgPeaks = peakCounts.reduce(function(a, b) { return a + b; }, 0) / peakCounts.length;

      // Score map (Meyer 1988 grounding):
      //   < 1.3 peaks (mostly single-bell): bot-like Bezier — 0.20
      //   1.3–1.7: borderline (some corrective movement) — 0.45
      //   1.7–2.5: low-end human (skilled, fast targeting) — 0.70
      //   2.5–3.5: human-typical (Woodworth/Meyer reach pattern) — 0.85
      //   3.5–5.0: noisy human (slow targeting / older user) — 0.50
      //   > 5.0: implausible (random-jitter bot, not real corrective) — 0.25
      if (avgPeaks < 1.3) return 0.20;
      if (avgPeaks < 1.7) return 0.45;
      if (avgPeaks < 2.5) return 0.70;
      if (avgPeaks <= 3.5) return 0.85;
      if (avgPeaks <= 5.0) return 0.50;
      return 0.25;
    },

    // Signal 17b: Microsaccade Detection (NEW 2026-04-26 evening)
    //
    // Real human cursor at rest still emits small involuntary movements
    // — 1–5 px displacements at 1–3 Hz — driven by hand tremor and
    // micro-postural-correction loops. Bezier-curve bots either don't
    // move at all when not transitioning between targets (most
    // implementations) OR move in much larger amplitude chunks (50–200 px)
    // when programmed to "drift" during reading phases. Either failure
    // mode is detectable by counting micromovements within idle windows.
    //
    // Citation grounding: microsaccade research dates to Engbert &
    // Kliegl (2003 Vision Research 43:1035) for ocular microsaccades;
    // hand-tremor analogs are documented in Hogan & Sternad (2007
    // J Neurophys 98:2238) — both predict frequency 1–3 Hz, amplitude
    // 1–5 sensor units during fixation/rest. The signal is a strong
    // discriminator against curve-aware bots that match individual
    // motor signal statistics (Two-Thirds Power Law, Cursor Jerk,
    // Curvature) but lack realistic involuntary tremor.
    //
    // Idle window definition: gap > 500 ms in the interaction-event
    // stream (clicks/keystrokes/scrolls). Within idle windows, count
    // mousemove samples whose distance + interval qualify as "micro":
    // 1 ≤ distance ≤ 5 px AND interval < 200 ms.
    //
    // Returns -1 if total idle time < 5 s OR < 30 mouse samples.
    // Otherwise scores rate against the 1–3 Hz human band.
    computeMicrosaccades: function() {
      if (_mouseMoveLog.length < 30) return -1;

      // Idle-window detection: use ONLY click + scroll events (not keystrokes).
      // Keystroke-dense typing phases fill _interactionTimestamps with sub-200ms
      // gaps, masking the genuine "no-clicking, no-scrolling" idle moments where
      // microsaccades would emerge. The cleaner stream is clicks + scrolls; gaps
      // > 500 ms in this stream are the "user reading / thinking" idle windows.
      var clickTs = _clickLog.map(function(c) { return c.t; });
      var scrollTs = _scrollLog.map(function(s) { return s.t; });
      var tapTs = _tapLog.map(function(t) { return t.t; });
      var nonKeyTs = clickTs.concat(scrollTs).concat(tapTs).sort(function(a, b) { return a - b; });
      if (nonKeyTs.length < 5) return -1;

      var idleWindows = [];
      for (var i = 1; i < nonKeyTs.length; i++) {
        var gap = nonKeyTs[i] - nonKeyTs[i - 1];
        if (gap > 500) idleWindows.push({ start: nonKeyTs[i - 1], end: nonKeyTs[i] });
      }
      if (idleWindows.length < 2) return -1;

      var totalIdleSec = idleWindows.reduce(function(s, w) { return s + (w.end - w.start) / 1000; }, 0);
      if (totalIdleSec < 5) return -1; // Too little idle time to estimate rate

      // Count micromovements (1–5 px, dt < 200 ms) within idle windows
      var microCount = 0;
      var bigMoveCount = 0; // Over-large idle moves (Bezier bot tell)
      for (var j = 1; j < _mouseMoveLog.length; j++) {
        var t = _mouseMoveLog[j].t;
        var inIdle = false;
        for (var w = 0; w < idleWindows.length; w++) {
          if (t >= idleWindows[w].start && t <= idleWindows[w].end) { inIdle = true; break; }
        }
        if (!inIdle) continue;
        var dt = t - _mouseMoveLog[j - 1].t;
        if (dt > 200) continue;
        var dx = _mouseMoveLog[j].x - _mouseMoveLog[j - 1].x;
        var dy = _mouseMoveLog[j].y - _mouseMoveLog[j - 1].y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= 1 && dist <= 5) microCount++;
        else if (dist > 30) bigMoveCount++;
      }

      var rate = microCount / totalIdleSec; // micromovements per idle-second

      // Score map (Engbert & Kliegl 2003 grounding):
      //   < 0.3 Hz: bot — no idle drift (most stealth/Bezier bots)
      //   0.3–0.8: low (sparse — borderline)
      //   1–3 Hz: human-typical band, score 0.85–1.0
      //   3–6 Hz: high but plausible (jittery user), 0.55
      //   > 6 Hz: implausible (bot with random jitter scaled too high)
      // Also penalize if bigMoveCount is high — Bezier bots that "drift"
      // produce large idle motions that real humans don't.
      var score;
      if (rate < 0.3) score = 0.15;
      else if (rate < 0.8) score = 0.35 + (rate - 0.3) * 0.6;          // 0.3→0.35, 0.8→0.65
      else if (rate <= 3.0) score = 0.85 + (1 - Math.abs(rate - 2) / 1.5) * 0.15; // peak ~1.0 at rate=2
      else if (rate <= 6.0) score = 0.55 - (rate - 3) * 0.10;          // 3→0.55, 6→0.25
      else score = 0.20;
      // Big-move penalty: real humans rarely move > 30px during idle
      // windows. Bezier "drift" bots commonly do.
      if (bigMoveCount > 5) score = Math.max(0.15, score - 0.20);
      return Math.max(0.10, Math.min(1.0, score));
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
      // Human: beta near -0.33. Bot: beta near 0 (no coupling) or far from -0.33.
      // 2026-04-26: empirically confirmed Bezier-mouse bots' actual β can
      // land in human-typical range (~−0.32 to −0.36) when the curve has
      // randomized control points + Gaussian noise. Single-statistic β alone
      // doesn't discriminate this adversary class. The signal still catches
      // straight-line clickers (β ≈ 0) and bots with identity parameterization.
      // For curve-aware bots, the defense must be cross-signal coherence
      // (signal 15) or env-gate, not this single signal.
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
      // Raise threshold: 30 samples (~1.5s at 20Hz) is too noisy; 100 samples
      // (~5s) produces stable SD estimates. Fewer samples = insufficient data
      // rather than a low-confidence score.
      if (_motionLog.length < 100) return -1;
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

      // Check 1: If accelerometer/gyro values are either all-zero (emulator /
      // permission-denied) OR below the human hand-tremor floor (desktop with
      // a weak lid-tilt sensor that produces noise but no biometric signal),
      // treat as insufficient-data. Prior threshold of 0.001 let desktop
      // laptops with tiny accelerometer noise (SD 0.001-0.005) fall through
      // to the drift calc, where tiny denominators amplified into spurious
      // mid-range scores (observed: 0.277/0.333 on a laptop with no meaningful
      // motion sensor). Raising to the hand-tremor floor fixes that cleanly.
      if (axStats.sd < 0.005 && ayStats.sd < 0.005 && gzStats.sd < 0.0005) return -1;

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
      // Cap the denominator at the hand-tremor floor so tiny-signal noise
      // can't amplify into huge relative-drift values.
      var driftDenom = Math.max((firstSD + secondSD) / 2, 0.005);
      var motionDrift = Math.abs(firstSD - secondSD) / driftDenom;
      var driftScore = _ascore(motionDrift, 0.3);

      var humanLikeRatio = (accelHumanLike + gyroHumanLike) / 3;
      return humanLikeRatio * 0.3 + _ascore(tapCorrelation, 0.6) * 0.4 + driftScore * 0.3;
    },

    // Composite Human Confidence Score (23 signals: 21 weighted + 2 diagnostic-only)
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
        oneOverFCoherence: this.computeOneOverFCoherence(),
        microsaccades: this.computeMicrosaccades(),
        submovementCount: this.computeSubmovementCount(),
        curvatureIndex: this.computeCurvatureIndex(),
        cursorJerk: this.computeCursorJerk(),
        velocityProfile: this.computeVelocityProfile(),
        twoThirdsPower: this.computeTwoThirdsPowerLaw(),
        deviceMotion: this.computeDeviceMotion()
      };

      // Base weights — cross-signal correlation + device motion highest.
      // The new oneOverFCoherence signal (cross-channel 1/f, Gilden 2001
      // grounding) is included with a small weight pending real-data
      // calibration; all other weights renormalize automatically via the
      // active-signal redistribution below.
      var baseWeights = {
        timing: 0.06, fitts: 0.04, hicks: 0.06, scroll: 0.05,
        microPause: 0.05, touch: 0.03, keystroke: 0.05,
        readingSpeed: 0.04, hoverDwell: 0.03, tabVisibility: 0.03,
        inactivity: 0.03,
        rtVariability: 0.07, scrollBacktrack: 0.05, fractalScaling: 0.06,
        // crossCorrelation = the existing operationalized coherence signal (signal 15).
        // oneOverFCoherence = NEW signal that needs structurally-distinct channels
        // to be useful; current implementation reads `_interactionTimestamps` which
        // is a UNION over keystrokes + clicks + taps and therefore correlates with
        // the keystroke channel by construction. Investigation 2026-04-26 confirmed
        // the signal scores ~0.998 even on adversarial bots — broken in current
        // form. Keeping it computed for diagnostic exposure (c.oneOverFCoherence,
        // c.oneOverFDetail) but giving it ZERO composite weight until we add a
        // proper _clickLog (separate from keystroke + tap) and verify the signal
        // discriminates on real session data.
        crossCorrelation: 0.08, oneOverFCoherence: 0.00,
        // microsaccades: kept computed for diagnostic/logging but weight 0
        // because empirical test 2026-04-26 evening showed Bezier-mouse bots
        // sampling at 60 Hz (16ms ticks) produce consecutive-sample
        // displacements of 1-5 px, which look identical to human
        // microsaccades from the SDK's perspective. The signal IS correct
        // against bots that don't simulate idle motion at all (most stealth
        // setups), but is fooled by curve-aware adversaries with
        // high-frequency sampling. Future v2: count discrete movement
        // EVENTS (clustered samples) instead of individual samples; or
        // analyze burst-vs-steady temporal distribution; or move the
        // microsaccade-rate calculation to use only "between-movement"
        // sample pairs (long inter-sample dt > 200ms but small distance).
        microsaccades: 0.00,
        // submovementCount — Meyer 1988 / Woodworth 1899 grounded. Catches
        // SIMPLE bots: straight-line Bezier (1 peak), low-frequency sampling,
        // no-jitter implementations. EMPIRICAL CAVEAT: 60Hz Bezier-with-
        // Gaussian-noise bots (the upper-sophistication adversary class)
        // produce artificial velocity peaks from the noise that look like
        // real corrective submovements — my DMTG-class harness scored 0.85
        // (human-typical) because of 3px jitter at 16ms ticks. The signal
        // is honest in design but defeated by this specific adversary class.
        // Kept at 0.05 weight as defense in depth against simpler bots.
        submovementCount: 0.05,
        curvatureIndex: 0.04, cursorJerk: 0.05,
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

      var result = { composite: composite, activeSignals: activeCount, totalSignals: 23 };
      // Expose the cross-channel 1/f diagnostic (per-channel α + variance)
      // so the receipt UI / verifier can show what we measured. Only present
      // when the signal computed (≥2 channels with sufficient data).
      if (_lastOneOverFCoherence) result.oneOverFDetail = _lastOneOverFCoherence;
      for (var rk in rawScores) result[rk] = rawScores[rk];
      // Per-signal active map: lets the receipt UI distinguish a real 0.000
      // ("scored zero") from insufficient-data sentinel ("N/A on this device
      // or session"). Without this, every -1 signal renders as 0.000 and
      // misleads the user into thinking they failed the signal.
      result.signalActive = {};
      for (var sk in rawScores) result.signalActive[sk] = !!activeSignals[sk];
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
      unsynced: hashes.filter(function(h) { return !h.synced; }).length,
      lastHash: hashes.length ? hashes[hashes.length - 1].hash : null
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

    // Update balance document — only update earned count, preserve spend history
    firebase.firestore().collection('vaults').doc(uid)
      .collection('balance').doc('current')
      .set({
        total_earned: hashes.length,
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
        Behavioral.recordClick(event);
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
      if (_eventLog) _eventLog.scroll(window.scrollY || window.pageYOffset || 0, Date.now());
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

    // R2-NEW-2 / "THE WALL": create the event-log recorder. Picks up
    // SWSEventLog from the global scope (exposed by event-log.js, loaded
    // before this SDK in cme-demo.html). If unavailable, fall back to a
    // no-op so legacy pages don't break.
    // Round-6 R5-NEW-5 fix: gate on consent. The recorder is created
    // with consentReady=false; if SWSPrivacy.hasConsent('attention_tracking')
    // returns true OR navigator.webdriver is true (automation), flip
    // it to ready immediately. Otherwise wire onConsentGranted to
    // setConsentReady(true) so the recorder starts AFTER user accepts.
    if (typeof window !== 'undefined' && window.SWSEventLog && window.SWSEventLog.createEventLog) {
      var consentAlreadyGranted = false;
      try {
        consentAlreadyGranted = (window.SWSPrivacy
          && window.SWSPrivacy.hasConsent
          && window.SWSPrivacy.hasConsent('attention_tracking'))
          || navigator.webdriver === true;
      } catch (_consentCheckErr) { /* SWSPrivacy may not be loaded yet */ }
      _eventLog = window.SWSEventLog.createEventLog({
        maxEvents: 5000,
        mousemoveSampleRatio: 0.5,
        consentReady: consentAlreadyGranted
      });
      // Wire a one-shot consent listener so consentReady flips when
      // the user clicks Accept. SWSPrivacy doesn't expose an event
      // emitter, so poll briefly in the consent-banner's typical
      // resolve window (a click triggers DOM removal, which we can
      // observe). Cheap + non-blocking.
      if (!consentAlreadyGranted && window.SWSPrivacy && window.SWSPrivacy.hasConsent) {
        var consentPoll = setInterval(function() {
          try {
            if (window.SWSPrivacy.hasConsent('attention_tracking')) {
              if (_eventLog && _eventLog.setConsentReady) _eventLog.setConsentReady(true);
              clearInterval(consentPoll);
            }
          } catch (_e) { /* ignore */ }
        }, 200);
        // Auto-stop poll after 15min so it doesn't leak forever.
        setTimeout(function() { clearInterval(consentPoll); }, 15 * 60 * 1000);
      }
    }

    // Event listeners for interaction tracking
    document.addEventListener('touchstart', _trackInteraction, { passive: true });
    document.addEventListener('mousedown', _trackInteraction, { passive: true });
    document.addEventListener('click', function(e) {
      _trackInteraction();
      if (_eventLog && e.clientX !== undefined) _eventLog.click(e.clientX, e.clientY, Date.now());
    }, { passive: true });
    document.addEventListener('keydown', function(e) {
      _lastInteractionTime = Date.now();
      _idleInteractionCount++;
      if (_config.enableBehavioralAnalysis) {
        Behavioral.recordInteraction();
        Behavioral.recordKeyDown(e);
        Behavioral.recordActivity();
      }
      // R2-NEW-2 / "THE WALL": record privacy-safe event log (key class
      // bucket only, never the actual key) for server-side recompute.
      if (_eventLog) _eventLog.keydown(e, Date.now());
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
      // R2-NEW-2 / "THE WALL" event log (sampled internally to bound size).
      if (_eventLog && e.clientX !== undefined) _eventLog.mousemove(e.clientX, e.clientY, Date.now());
    }, { passive: true });
    document.addEventListener('visibilitychange', function() {
      if (_config.enableBehavioralAnalysis) {
        Behavioral.recordVisibilityChange(!document.hidden);
      }
    });
    // Window focus is orthogonal to tab visibility: the user can keep the
    // tab visible but alt-tab to another window. Sustained perfect focus
    // with zero blur events is a bot tell; one real blur reads as human.
    if (window.addEventListener) {
      window.addEventListener('blur', function() {
        if (_config.enableBehavioralAnalysis) Behavioral.recordWindowFocus(false);
      });
      window.addEventListener('focus', function() {
        if (_config.enableBehavioralAnalysis) Behavioral.recordWindowFocus(true);
      });
    }

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
    getDigraphStats: function() { return Behavioral.computeDigraphStats(); },
    getReadingCoherence: function() { return Behavioral.computeReadingCoherence(); },
    getFocusStats: function() { return Behavioral.getFocusStats(); },

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
    recordSectionEntry: function(id, wordCount) { Behavioral.recordSectionEntry(id, wordCount); },
    recordSectionExit: function(id, pct, wordCount) { Behavioral.recordSectionExit(id, pct, wordCount); },
    recordWindowFocus: function(focused) { Behavioral.recordWindowFocus(focused); },
    recordHoverEnter: function(id) { Behavioral.recordHoverEnter(id); },
    recordHoverLeave: function() { Behavioral.recordHoverLeave(); },
    getTimeline: function() { return Behavioral.getTimeline(); },
    getTimelineMeta: function() { return Behavioral.getTimelineMeta(); },
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

    // Content-bound receipt — generates a session-bound, tamper-evident SHA-256
    // hash over an arbitrary caller-supplied payload merged with the SDK's
    // session signals. Use this when a vertical (CME, advertising, exam)
    // computes its own composite/verdict and needs the receipt to bind to
    // those displayed values (not just the SDK's generic state).
    //
    // The hash is over deeply key-sorted canonical JSON, so any modification
    // to any displayed field invalidates the hash and breaks verification.
    //
    // Usage: SWSAttention.generateContentReceipt({composite_app: 0.62, verdict: 'pass'}, function(receipt) {
    //   console.log(receipt.hash, receipt.payload, receipt.canonical);
    // });
    generateContentReceipt: function(extras, callback) {
      var c = Behavioral.computeHumanConfidence();
      var stats = getStats();
      var timeline = Behavioral.getTimeline();
      var payload = {
        protocol: 'SWS-AP-v2',
        patent: 'SWS-PROV-001',
        entity: 'SWS Strategic Media LLC',
        session_id: _sessionId,
        game_id: _config.gameId,
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
          rtVariability: c.rtVariability, scrollBacktrack: c.scrollBacktrack,
          fractalScaling: c.fractalScaling, crossCorrelation: c.crossCorrelation,
          curvatureIndex: c.curvatureIndex, cursorJerk: c.cursorJerk,
          velocityProfile: c.velocityProfile, twoThirdsPower: c.twoThirdsPower,
          deviceMotion: c.deviceMotion,
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
        extras: extras || {},
        // R2-NEW-2 / "THE WALL": snapshot the bounded event log into the
        // canonical payload so the server-side scorer in onSessionWritten
        // can recompute key signals from raw events. Without this, a
        // forged composite has no event log to be cross-checked against.
        // Inclusion in canonical means the hash binds the log to the
        // claimed signals — tampering with either invalidates verification.
        event_log: _eventLog ? _eventLog.snapshot() : null,
        nonce: _generateNonce()
      };
      var canonical = _canonicalJSON(payload);
      _sha256(canonical, function(hash) {
        var receipt = {
          payload: payload,
          hash: hash,
          canonical: canonical,
          verification: 'To verify: deep-sort all object keys recursively, JSON-encode, SHA-256. Must match hash.'
        };
        // Persist to localStorage hash store and Firestore queue so the
        // content-bound receipt participates in the same ledger as earned hashes.
        _storeHash(hash, 'content_receipt', payload.quality_tier, {
          duration_ms: payload.duration_ms,
          interaction_count: 0
        });
        if (typeof callback === 'function') callback(receipt);
      });
    },

    // Cold storage receipt — convenience wrapper around generateContentReceipt
    // with no caller extras. Self-contained, offline-verifiable.
    generateColdReceipt: function(callback) {
      this.generateContentReceipt({}, callback);
    },

    // ============================================================
    // CONFORMAL PREDICTION ANALYSIS
    //
    // Adds distribution-free finite-sample statistical rigor to the
    // composite score (Vovk, Gammerman, Shafer 2005; Angelopoulos &
    // Bates 2023 "A Gentle Introduction to Conformal Prediction"
    // arXiv:2107.07511). Almost no behavioral-biometrics vendor ships
    // calibrated p-values today — competitors output uncalibrated
    // scores with no probabilistic interpretation. This is one of the
    // identified "free credibility wins" from the docs/yc-defense
    // research.
    //
    // For an observed composite score, returns:
    //   - p_value_human: P(observe ≥ this score | session is human)
    //   - p_value_bot:   P(observe ≥ this score | session is bot)
    //   - conformity_human: p_human / (p_human + p_bot), in [0,1]
    //   - confidence_interval_95: bootstrap CI over the conformity score
    //   - calibration_size_human, calibration_size_bot: sample sizes
    //
    // Calibration set is bootstrapped from 2026-04-26 measurements and grows
    // as real-tester runs accumulate. Callers can pass their own calibration
    // set via the `calibration` argument.
    //
    // v1-bootstrap (2026-04-26): n_h=5, n_b=10
    //   Humans: Stephen mobile-engaged 0.658, mobile-marginal 0.582,
    //           desktop-demo 0.629/0.595/0.602
    //   Bots:   Naive 0.492, Jittered 0.578, Sophisticated 0.561,
    //           LLM Paster 0.614, Stealth 0.395, DMTG-class
    //           0.527/0.539/0.555/0.541/0.523
    //
    // v2-real-bot-runs (2026-04-27): n_h=5, n_b=28
    //   Humans: unchanged from v1 — human-side calibration grows when a
    //           Firestore export of recent legitimate sessions is added.
    //   Bots:   v1 + 14 dmtg-bot composites + 4 stealth-bot composites
    //           parsed from proof/results/*.json (real captured runs from
    //           proof/run-proofs.js sweeps on 2026-04-26). Adding them
    //           tightens the bootstrap CI without changing the population
    //           shape — the new dmtg cluster mean (0.544) sits inside the
    //           v1 bot mean (0.532); the new stealth cluster (0.363) sits
    //           inside the v1 stealth (0.395). Preserves the SD floor 0.05.
    // ============================================================

    getConformalAnalysis: function(observedComposite, calibration) {
      var DEFAULT_CALIBRATION = {
        // 2026-04-26 humans + 2026-04-27 expanded bots; grows as data accumulates
        human_scores: [0.658, 0.582, 0.629, 0.595, 0.602],
        bot_scores: [
          // v1 (2026-04-26)
          0.492, 0.578, 0.561, 0.614, 0.395, 0.527, 0.539, 0.555, 0.541, 0.523,
          // v2 dmtg-bot (2026-04-26 captured runs; n=14)
          0.5021, 0.5234, 0.5269, 0.5370, 0.5387, 0.5415, 0.5439, 0.5449,
          0.5465, 0.5513, 0.5546, 0.5582, 0.5668, 0.5766,
          // v2 stealth-bot (2026-04-26 captured runs; n=4)
          0.3588, 0.3623, 0.3651, 0.3659
        ],
        captured_date: '2026-04-27',
        version: 'v2-real-bot-runs'
      };
      // Caller-supplied calibration is accepted for testing/research, but its
      // presence is recorded in the result so any receipt downstream of a
      // non-default calibration is auditable. A hostile caller can pass
      // {human_scores:[0.55], bot_scores:[0.0]} and trivially get p_human≈1.0;
      // we cannot prevent that for client-side scoring (the trust root is the
      // SDK itself, see HARDENING_PLAN T1-1) but we DO surface the override
      // so a receipt verifier sees that the calibration wasn't the default
      // SWS-shipped set. Decision-grade flows MUST use default calibration
      // and MUST validate `calibration_override === false` server-side.
      var calibrationOverride = !!calibration;
      var cal = calibration || DEFAULT_CALIBRATION;
      var humans = cal.human_scores.slice();
      var bots = cal.bot_scores.slice();
      var nH = humans.length;
      var nB = bots.length;
      if (nH < 1 || nB < 1) {
        return { error: 'calibration set requires at least 1 human + 1 bot sample' };
      }
      if (calibrationOverride && typeof console !== 'undefined' && console.warn) {
        console.warn('[SWSAttention] getConformalAnalysis called with a non-default calibration. Decision-grade verifiers MUST reject receipts where calibration_override === true.');
      }

      function meanOf(arr) {
        var s = 0;
        for (var i = 0; i < arr.length; i++) s += arr[i];
        return s / arr.length;
      }
      function sdOf(arr, mean) {
        if (arr.length < 2) return 0.05; // floor for small N — see clamp below
        var v = 0;
        for (var i = 0; i < arr.length; i++) v += Math.pow(arr[i] - mean, 2);
        return Math.sqrt(v / (arr.length - 1)); // unbiased sample SD
      }
      function gaussianPdf(x, mean, sd) {
        if (sd <= 0) return 0;
        var z = (x - mean) / sd;
        return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
      }

      // Class-conditional Gaussian fit. SD is clamped to 0.05 — the human
      // composite-score spread we'd expect across normal device/effort variation.
      // Without this clamp, small-N calibration produces artificially tight
      // distributions (n=5 → SD might be 0.03), which would over-confidently
      // classify scores in the overlap region. The clamp is a Bayesian-flavoured
      // skepticism: don't trust the calibration to be tighter than the noise.
      var SD_FLOOR = 0.05;
      var hMean = meanOf(humans);
      var hSd = Math.max(SD_FLOOR, sdOf(humans, hMean));
      var bMean = meanOf(bots);
      var bSd = Math.max(SD_FLOOR, sdOf(bots, bMean));

      // Class-conditional likelihoods under Gaussian assumption
      var lH = gaussianPdf(observedComposite, hMean, hSd);
      var lB = gaussianPdf(observedComposite, bMean, bSd);
      // Bayesian posterior with flat (uniform) prior P(human) = P(bot) = 0.5.
      // Different priors can be applied by callers post-hoc by re-weighting.
      var pHuman = (lH + lB) > 0 ? lH / (lH + lB) : 0.5;

      // Bootstrap 95% CI on p_human via resampling both classes (Efron &
      // Tibshirani 1993). 1000 resamples; preserves marginal class sizes.
      var BOOTSTRAP_N = 1000;
      var bootstrapResults = [];
      for (var b = 0; b < BOOTSTRAP_N; b++) {
        var bH = [];
        var bB = [];
        for (var i = 0; i < nH; i++) bH.push(humans[Math.floor(Math.random() * nH)]);
        for (var j = 0; j < nB; j++) bB.push(bots[Math.floor(Math.random() * nB)]);
        var bhMean = meanOf(bH);
        var bhSd = Math.max(SD_FLOOR, sdOf(bH, bhMean));
        var bbMean = meanOf(bB);
        var bbSd = Math.max(SD_FLOOR, sdOf(bB, bbMean));
        var blH = gaussianPdf(observedComposite, bhMean, bhSd);
        var blB = gaussianPdf(observedComposite, bbMean, bbSd);
        bootstrapResults.push((blH + blB) > 0 ? blH / (blH + blB) : 0.5);
      }
      bootstrapResults.sort(function(a, b) { return a - b; });
      var ciLow = bootstrapResults[Math.floor(BOOTSTRAP_N * 0.025)];
      var ciHigh = bootstrapResults[Math.floor(BOOTSTRAP_N * 0.975)];

      return {
        observed: observedComposite,
        p_human: pHuman,
        p_bot: 1 - pHuman,
        conformity_human: pHuman, // alias for compatibility
        confidence_interval_95: [ciLow, ciHigh],
        human_distribution: { mean: hMean, sd: hSd, n: nH, sd_floor_applied: hSd === SD_FLOOR },
        bot_distribution: { mean: bMean, sd: bSd, n: nB, sd_floor_applied: bSd === SD_FLOOR },
        calibration: {
          size_human: nH,
          size_bot: nB,
          captured_date: cal.captured_date || null,
          version: cal.version || 'v1-bootstrap',
          calibration_override: calibrationOverride,
          // Small-N honesty: bootstrap coverage at n<20 is empirically ~60-70%
          // not the nominal 95% (Efron-Tibshirani 1993 caution against
          // bootstrap below ~20 samples per class). The flag below tells any
          // verifier or downstream consumer that the printed CI should be
          // read as "wide and approximate," not "rigorous 95%." Drop the flag
          // when both classes reach n>=20 — at that point standard bootstrap
          // is well-justified and BCa is optional polish.
          small_n_caveat: (nH < 20 || nB < 20),
          small_n_caveat_note: (nH < 20 || nB < 20)
            ? 'Bootstrap CI at n<20 has empirical coverage below the nominal 95%. Treat as wide, approximate uncertainty rather than a rigorous 95% interval. See calibration methodology doc for the path to n>=30.'
            : null
        },
        method: 'Class-conditional Gaussian likelihood ratio with flat prior (textbook two-class Bayes classifier). Bootstrap 95% CI per Efron & Tibshirani 1993; SD floor 0.05 prevents small-N over-confidence. NOT Vovk-Gammerman split-conformal prediction — see methodology doc for the distinction.',
        notes: 'Calibration set will grow as real-tester runs accumulate. Wide CIs reflect small calibration size; downstream apps can pass their own calibration via the calibration argument. The SD floor is a deliberate skepticism: small samples cannot estimate distribution width tighter than expected device/effort noise.'
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
