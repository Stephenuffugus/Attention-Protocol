/**
 * SWS Attention Protocol — Client Tag v1.0.0
 *
 * Drop this on any page to collect behavioral attention signals.
 * Signals are sent to the SWS API for scoring (trade secrets stay server-side).
 *
 * Usage:
 *   <script src="https://cdn.swsprotocol.com/sws-client.js"
 *           data-client-id="YOUR_CLIENT_ID"
 *           data-api-key="YOUR_API_KEY"></script>
 *
 * Or initialize manually:
 *   SWSClient.init({ clientId: '...', apiKey: '...' });
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
(function(window, document) {
  'use strict';

  var VERSION = '1.0.0';
  var API_BASE = 'https://api.swsprotocol.com';  // Production
  var LOCAL_API = 'http://localhost:3001';         // Dev fallback

  // ============================================================
  // STATE
  // ============================================================

  var _config = { clientId: '', apiKey: '', apiBase: '', debug: false, autoSubmit: true };
  var _initialized = false;
  var _sessionId = '';
  var _sessionStart = 0;

  // Signal collection buffers
  var _interactionTimestamps = [];
  var _interactionIntervals = [];
  var _tapSequence = [];
  var _touchData = [];
  var _scrollEvents = [];
  var _decisions = [];
  var _renderLog = [];
  var _pendingRender = false;
  var _lastRenderTime = 0;
  var _interactionCount = 0;

  // ============================================================
  // SESSION ID
  // ============================================================

  function _generateSessionId() {
    var arr = new Uint8Array(16);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(arr);
    } else {
      for (var i = 0; i < 16; i++) arr[i] = Math.floor(Math.random() * 256);
    }
    return 'ses_' + Array.from(arr, function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  // ============================================================
  // SIGNAL COLLECTORS
  // ============================================================

  function _trackInteraction(event) {
    var now = Date.now();
    _interactionCount++;

    // Timing entropy
    if (_interactionTimestamps.length > 0) {
      _interactionIntervals.push(now - _interactionTimestamps[_interactionTimestamps.length - 1]);
    }
    _interactionTimestamps.push(now);
    if (_interactionTimestamps.length > 200) { _interactionTimestamps.shift(); _interactionIntervals.shift(); }

    // Fitts' Law (tap positions)
    if (event.clientX !== undefined) {
      _tapSequence.push({ x: event.clientX, y: event.clientY, t: now });
      if (_tapSequence.length > 100) _tapSequence.shift();
    }

    // Touch data
    if (event.touches && event.touches[0]) {
      var touch = event.touches[0];
      if (touch.radiusX !== undefined) {
        _touchData.push({ radiusX: touch.radiusX, radiusY: touch.radiusY, force: touch.force || 0 });
        if (_touchData.length > 100) _touchData.shift();
      }
    }

    // Micro-pause: record first interaction after render
    if (_pendingRender) {
      _pendingRender = false;
      for (var i = _renderLog.length - 1; i >= 0; i--) {
        if (!_renderLog[i].delay) {
          _renderLog[i].delay = now - _renderLog[i].renderTime;
          break;
        }
      }
    }
  }

  function _trackScroll() {
    _scrollEvents.push({ y: window.scrollY, t: Date.now() });
    if (_scrollEvents.length > 500) _scrollEvents.shift();
  }

  // ============================================================
  // PUBLIC API: Decision & Content Tracking
  // ============================================================

  function recordDecision(optionCount, responseTimeMs) {
    _decisions.push({ optionCount: optionCount, responseTimeMs: responseTimeMs });
    if (_decisions.length > 50) _decisions.shift();
  }

  function recordContentRender(complexity) {
    _lastRenderTime = Date.now();
    _pendingRender = true;
    _renderLog.push({ renderTime: _lastRenderTime, complexity: complexity || 'moderate', delay: null });
    if (_renderLog.length > 50) _renderLog.shift();
  }

  // ============================================================
  // SESSION SUBMISSION
  // ============================================================

  function _buildPayload() {
    return {
      session_id: _sessionId,
      duration_ms: Date.now() - _sessionStart,
      interaction_count: _interactionCount,
      hash_count: 0,
      application_id: window.location ? window.location.hostname : 'unknown',

      // Behavioral signals (raw data — server does the analysis)
      interaction_intervals: _interactionIntervals.slice(-200),
      tap_sequence: _tapSequence.slice(-100),
      decisions: _decisions.slice(-50),
      scroll_events: _scrollEvents.slice(-500),
      render_interactions: _renderLog.filter(function(r) { return r.delay !== null; }),
      touches: _touchData.slice(-100)
    };
  }

  function submitSession(callback) {
    var payload = _buildPayload();
    var apiBase = _config.apiBase || API_BASE;
    var url = apiBase + '/v1/sessions';

    _log('Submitting session', _sessionId, '(' + _interactionCount + ' interactions)');

    // Use fetch with fallback to XMLHttpRequest
    if (typeof fetch === 'function') {
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SWS-API-Key': _config.apiKey,
          'X-SWS-Client-ID': _config.clientId
        },
        body: JSON.stringify(payload)
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        _log('Session scored:', data.score);
        if (callback) callback(null, data);
      })
      .catch(function(err) {
        _log('Submit failed:', err.message);
        // Try local API as fallback
        _submitLocal(payload, callback);
      });
    } else {
      _submitXHR(url, payload, callback);
    }
  }

  function _submitLocal(payload, callback) {
    var url = LOCAL_API + '/v1/sessions';
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SWS-API-Key': _config.apiKey,
        'X-SWS-Client-ID': _config.clientId
      },
      body: JSON.stringify(payload)
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (callback) callback(null, data);
    })
    .catch(function(err) {
      if (callback) callback(err);
    });
  }

  function _submitXHR(url, payload, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('X-SWS-API-Key', _config.apiKey);
    xhr.setRequestHeader('X-SWS-Client-ID', _config.clientId);
    xhr.onload = function() {
      try {
        var data = JSON.parse(xhr.responseText);
        if (callback) callback(null, data);
      } catch (e) {
        if (callback) callback(e);
      }
    };
    xhr.onerror = function() { if (callback) callback(new Error('Network error')); };
    xhr.send(JSON.stringify(payload));
  }

  // Submit via Beacon on page unload (reliable)
  function _submitBeacon() {
    if (!_initialized || !navigator.sendBeacon) return;

    var payload = _buildPayload();
    var apiBase = _config.apiBase || API_BASE;
    var url = apiBase + '/v1/sessions';

    // Beacon doesn't support custom headers, so embed auth in payload
    payload._auth = { clientId: _config.clientId, apiKey: _config.apiKey };

    navigator.sendBeacon(url, JSON.stringify(payload));
  }

  // ============================================================
  // STATS (client-side, before server scoring)
  // ============================================================

  function getLocalStats() {
    return {
      session_id: _sessionId,
      duration_ms: Date.now() - _sessionStart,
      interaction_count: _interactionCount,
      data_collected: {
        interaction_intervals: _interactionIntervals.length,
        tap_positions: _tapSequence.length,
        decisions: _decisions.length,
        scroll_events: _scrollEvents.length,
        render_interactions: _renderLog.filter(function(r) { return r.delay !== null; }).length,
        touch_data: _touchData.length
      },
      signal_readiness: {
        timing_entropy: _interactionIntervals.length >= 10 ? 'ready' : 'collecting (' + _interactionIntervals.length + '/10)',
        fitts_law: _tapSequence.length >= 10 ? 'ready' : 'collecting (' + _tapSequence.length + '/10)',
        hicks_law: _decisions.length >= 5 ? 'ready' : 'collecting (' + _decisions.length + '/5)',
        scroll_saccade: _scrollEvents.length >= 20 ? 'ready' : 'collecting (' + _scrollEvents.length + '/20)',
        micro_pause: _renderLog.filter(function(r) { return r.delay !== null; }).length >= 3 ? 'ready' : 'collecting',
        touch_variance: _touchData.length >= 10 ? 'ready' : 'collecting (' + _touchData.length + '/10)'
      }
    };
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  function init(options) {
    if (_initialized) return;
    options = options || {};

    _config.clientId = options.clientId || '';
    _config.apiKey = options.apiKey || '';
    _config.apiBase = options.apiBase || '';
    _config.debug = options.debug || false;
    _config.autoSubmit = options.autoSubmit !== false;

    _sessionId = _generateSessionId();
    _sessionStart = Date.now();

    // Event listeners
    document.addEventListener('click', _trackInteraction, { passive: true });
    document.addEventListener('mousedown', _trackInteraction, { passive: true });
    document.addEventListener('touchstart', _trackInteraction, { passive: true });
    document.addEventListener('keydown', function() {
      _interactionCount++;
      var now = Date.now();
      if (_interactionTimestamps.length > 0) {
        _interactionIntervals.push(now - _interactionTimestamps[_interactionTimestamps.length - 1]);
      }
      _interactionTimestamps.push(now);
    }, { passive: true });
    window.addEventListener('scroll', _trackScroll, { passive: true });

    // Auto-submit on page unload
    if (_config.autoSubmit) {
      window.addEventListener('beforeunload', _submitBeacon);
      // Also submit periodically (every 2 minutes)
      setInterval(function() {
        if (_interactionCount > 0) submitSession();
      }, 120000);
    }

    _initialized = true;
    _log('Client tag initialized. Session:', _sessionId.substring(0, 16));
  }

  // Auto-init from script tag attributes
  function _autoInit() {
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i--) {
      var s = scripts[i];
      var clientId = s.getAttribute('data-client-id');
      var apiKey = s.getAttribute('data-api-key');
      if (clientId && apiKey) {
        init({
          clientId: clientId,
          apiKey: apiKey,
          apiBase: s.getAttribute('data-api-base') || '',
          debug: s.getAttribute('data-debug') === 'true'
        });
        break;
      }
    }
  }

  // ============================================================
  // HELPERS
  // ============================================================

  function _log() {
    if (_config.debug) {
      var args = ['[SWS Client]'].concat(Array.prototype.slice.call(arguments));
      console.log.apply(console, args);
    }
  }

  // ============================================================
  // EXPORT
  // ============================================================

  window.SWSClient = {
    init: init,
    recordDecision: recordDecision,
    recordContentRender: recordContentRender,
    submitSession: submitSession,
    getLocalStats: getLocalStats,
    getSessionId: function() { return _sessionId; },
    version: VERSION
  };

  // Auto-init from script tag
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _autoInit);
  } else {
    _autoInit();
  }

})(window, document);
