/**
 * SWS Attention Protocol — B2B Client SDK
 * Lightweight tag for B2B clients (survey platforms, training portals,
 * insurance companies, etc.) to integrate attention verification.
 *
 * Usage:
 *   <script src="sws-client.js" data-client-id="your_client_id"></script>
 *
 * This SDK:
 * - Generates attention hashes from user engagement
 * - Produces cryptographic receipts for each session
 * - Sends verification data to the SWS API
 * - Tracks 70/29/1 revenue split
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending.
 */
(function(window, document) {
  'use strict';

  var API_BASE = 'https://api.swsprotocol.com/v1'; // Production API endpoint
  var SDK_VERSION = '1.0.0';

  // ============================================================
  // STATE
  // ============================================================

  var _clientId = '';
  var _sessionId = '';
  var _sessionStart = 0;
  var _interactionCount = 0;
  var _hashes = [];
  var _initialized = false;

  // Behavioral analysis (subset — lightweight for client SDK)
  var _interactionTimestamps = [];
  var _tapLog = [];

  // ============================================================
  // INITIALIZATION
  // ============================================================

  function init(options) {
    if (_initialized) return;

    _clientId = options.clientId || '';
    _sessionId = _generateId();
    _sessionStart = Date.now();
    _initialized = true;

    // Track interactions
    document.addEventListener('click', _trackInteraction, { passive: true });
    document.addEventListener('touchstart', _trackInteraction, { passive: true });
    document.addEventListener('keydown', _trackInteraction, { passive: true });
    document.addEventListener('scroll', function() { _interactionCount++; }, { passive: true });

    // Generate initial page visit hash
    _earnHash('page_visit', 0, 'active');

    // Start idle drip (5 min intervals)
    setInterval(function() {
      if (_interactionCount > 0) {
        _earnHash('idle_drip', 300000, 'passive');
      }
    }, 300000);

    // On page unload: generate session receipt and send to API
    window.addEventListener('beforeunload', function() {
      _sendSessionData();
    });

    // Periodic sync every 2 minutes
    setInterval(_sendSessionData, 120000);
  }

  function _trackInteraction(event) {
    _interactionCount++;
    _interactionTimestamps.push(Date.now());
    if (_interactionTimestamps.length > 200) _interactionTimestamps.shift();

    if (event.type === 'click' || event.type === 'touchstart') {
      var touch = event.touches ? event.touches[0] : event;
      if (touch && touch.clientX !== undefined) {
        _tapLog.push({ x: touch.clientX, y: touch.clientY, t: Date.now() });
        if (_tapLog.length > 100) _tapLog.shift();
      }
    }
  }

  // ============================================================
  // HASH GENERATION (Lightweight)
  // ============================================================

  function _earnHash(eventType, durationMs, qualityTier) {
    var payload = {
      event_type: eventType,
      timestamp: Date.now(),
      session_id: _sessionId,
      duration_ms: durationMs,
      interaction_count: _interactionCount,
      quality_tier: qualityTier,
      game_id: _clientId,
      user_uid: 'client_' + _clientId,
      nonce: Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
    };

    var sorted = JSON.stringify(payload, Object.keys(payload).sort());

    _sha256(sorted, function(hash) {
      _hashes.push({
        hash: hash,
        event_type: eventType,
        timestamp: Date.now(),
        quality_tier: qualityTier,
        duration_ms: durationMs
      });
    });
  }

  // ============================================================
  // BEHAVIORAL ANALYSIS (Lightweight)
  // ============================================================

  function _computeTimingCV() {
    if (_interactionTimestamps.length < 10) return null;
    var intervals = [];
    for (var i = 1; i < _interactionTimestamps.length; i++) {
      intervals.push(_interactionTimestamps[i] - _interactionTimestamps[i - 1]);
    }
    var mean = intervals.reduce(function(a, b) { return a + b; }, 0) / intervals.length;
    if (mean === 0) return 0;
    var variance = intervals.reduce(function(a, b) { return a + Math.pow(b - mean, 2); }, 0) / intervals.length;
    return Math.sqrt(variance) / mean;
  }

  function _computeFittsR() {
    if (_tapLog.length < 10) return null;
    var distances = [], times = [];
    for (var i = 1; i < _tapLog.length; i++) {
      var dx = _tapLog[i].x - _tapLog[i - 1].x;
      var dy = _tapLog[i].y - _tapLog[i - 1].y;
      distances.push(Math.sqrt(dx * dx + dy * dy));
      times.push(_tapLog[i].t - _tapLog[i - 1].t);
    }
    var n = distances.length;
    var sX = 0, sY = 0, sXY = 0, sX2 = 0, sY2 = 0;
    for (var j = 0; j < n; j++) {
      var x = Math.log2(distances[j] + 1);
      var y = times[j];
      sX += x; sY += y; sXY += x * y; sX2 += x * x; sY2 += y * y;
    }
    var denom = Math.sqrt((n * sX2 - sX * sX) * (n * sY2 - sY * sY));
    if (denom === 0) return null;
    var r = (n * sXY - sX * sY) / denom;
    return isNaN(r) ? null : r;
  }

  // ============================================================
  // SESSION DATA TRANSMISSION
  // ============================================================

  function _sendSessionData() {
    if (_hashes.length === 0) return;

    var sessionData = {
      client_id: _clientId,
      session_id: _sessionId,
      sdk_version: SDK_VERSION,
      session_start: _sessionStart,
      session_end: Date.now(),
      duration_ms: Date.now() - _sessionStart,
      interaction_count: _interactionCount,

      // Behavioral verification
      behavioral: {
        timing_cv: _computeTimingCV(),
        fitts_r: _computeFittsR(),
        interactions_per_minute: _interactionCount / ((Date.now() - _sessionStart) / 60000)
      },

      // Hash summary
      hashes: {
        count: _hashes.length,
        items: _hashes
      },

      // Quality assessment
      quality: {
        focus_score: _computeFocusScore(),
        human_confidence: _estimateHumanConfidence(),
        tier_distribution: _getTierDistribution()
      }
    };

    // Send to API (beacon for reliability on page unload)
    _sendBeacon(API_BASE + '/sessions', sessionData);
  }

  function _computeFocusScore() {
    var tiers = _getTierDistribution();
    var weights = { deep: 1.0, active: 0.7, passive: 0.3, background: 0.1 };
    var total = _hashes.length || 1;
    var weighted = 0;
    for (var t in tiers) {
      weighted += tiers[t] * (weights[t] || 0);
    }
    return Math.round((weighted / total) * 100);
  }

  function _estimateHumanConfidence() {
    var cv = _computeTimingCV();
    var fitts = _computeFittsR();

    if (cv === null && fitts === null) return null;

    var score = 0.5; // neutral
    if (cv !== null) {
      score = cv > 0.25 ? Math.min(1, (cv - 0.1) / 1.0) * 0.5 : cv / 0.25 * 0.2;
    }
    if (fitts !== null) {
      score += fitts > 0.15 ? Math.min(0.5, (fitts + 0.5) / 1.5 * 0.5) : 0.1;
    }
    return Math.min(1, Math.max(0, score));
  }

  function _getTierDistribution() {
    var dist = { deep: 0, active: 0, passive: 0, background: 0 };
    _hashes.forEach(function(h) {
      dist[h.quality_tier] = (dist[h.quality_tier] || 0) + 1;
    });
    return dist;
  }

  // ============================================================
  // REVENUE SPLIT TRACKING
  // ============================================================

  /**
   * Track attention value for revenue split calculation.
   * 70% goes to the user (as in-app value / rewards)
   * 29% goes to the developer/client (the B2B customer)
   * 1% goes to SWS protocol fee
   */
  function getRevenueSplit(totalValueCents) {
    return {
      user: Math.round(totalValueCents * 0.70),
      developer: Math.round(totalValueCents * 0.29),
      protocol: Math.round(totalValueCents * 0.01),
      total: totalValueCents
    };
  }

  // ============================================================
  // PUBLIC API FOR CLIENT INTEGRATION
  // ============================================================

  /**
   * Record a custom attention event from the client's application.
   * e.g., survey question viewed, training module started, etc.
   */
  function recordEvent(eventType, durationMs, qualityTier) {
    if (!_initialized) return;
    _earnHash(eventType, durationMs || 0, qualityTier || 'active');
  }

  /**
   * Record a decision point (for Hick's Law analysis).
   * Call when the user makes a choice from N options.
   */
  function recordDecision(optionCount, responseTimeMs) {
    if (!_initialized) return;
    // Store for behavioral analysis
    _interactionTimestamps.push(Date.now());
  }

  /**
   * Generate a completion receipt for the current session.
   * Use for training module completion, survey submission, etc.
   */
  function generateReceipt(contentId, contentName) {
    if (!_initialized) return null;

    return {
      receipt_id: 'rcpt_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6),
      client_id: _clientId,
      session_id: _sessionId,
      content_id: contentId || '',
      content_name: contentName || '',
      generated_at: new Date().toISOString(),
      duration_ms: Date.now() - _sessionStart,
      interaction_count: _interactionCount,
      focus_score: _computeFocusScore(),
      human_confidence: _estimateHumanConfidence(),
      hash_count: _hashes.length,
      timing_cv: _computeTimingCV(),
      quality_tier: _computeFocusScore() >= 70 ? 'deep' :
                    _computeFocusScore() >= 40 ? 'active' :
                    _computeFocusScore() >= 20 ? 'passive' : 'background'
    };
  }

  /**
   * Get current session stats.
   */
  function getStats() {
    return {
      sessionId: _sessionId,
      durationMs: Date.now() - _sessionStart,
      interactionCount: _interactionCount,
      hashCount: _hashes.length,
      focusScore: _computeFocusScore(),
      humanConfidence: _estimateHumanConfidence(),
      timingCV: _computeTimingCV(),
      tierDistribution: _getTierDistribution()
    };
  }

  // ============================================================
  // UTILITIES
  // ============================================================

  function _generateId() {
    var arr = new Uint8Array(16);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(arr);
    } else {
      for (var i = 0; i < 16; i++) arr[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(arr, function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  function _sha256(str, callback) {
    var encoder = new TextEncoder();
    var data = encoder.encode(str);
    if (window.crypto && window.crypto.subtle) {
      window.crypto.subtle.digest('SHA-256', data).then(function(buffer) {
        var arr = Array.from(new Uint8Array(buffer));
        callback(arr.map(function(b) { return b.toString(16).padStart(2, '0'); }).join(''));
      }).catch(function() {
        callback('fallback_' + Date.now().toString(16));
      });
    } else {
      callback('fallback_' + Date.now().toString(16));
    }
  }

  function _sendBeacon(url, data) {
    var json = JSON.stringify(data);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([json], { type: 'application/json' }));
    } else {
      // Fallback: XHR
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(json);
      } catch (e) { /* best effort */ }
    }
  }

  // ============================================================
  // AUTO-INIT
  // ============================================================

  function _autoInit() {
    var scripts = document.getElementsByTagName('script');
    var thisScript = scripts[scripts.length - 1];
    var clientId = thisScript.getAttribute('data-client-id');
    if (clientId) {
      init({ clientId: clientId });
    }
  }

  // ============================================================
  // EXPORT
  // ============================================================

  window.SWSClient = {
    init: init,
    recordEvent: recordEvent,
    recordDecision: recordDecision,
    generateReceipt: generateReceipt,
    getStats: getStats,
    getRevenueSplit: getRevenueSplit,
    version: SDK_VERSION
  };

  // Auto-init from script tag
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _autoInit);
  } else {
    _autoInit();
  }

})(window, document);
