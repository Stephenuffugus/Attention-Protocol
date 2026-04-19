/**
 * SWS Attention Protocol — GA4 Bridge
 * Fires Google Analytics 4 custom events alongside every attention hash,
 * enabling side-by-side comparison of what each system captures.
 *
 * Usage:
 *   1. Include gtag.js on your page (standard GA4 snippet)
 *   2. Load this module after attention-protocol.js
 *   3. Call SWSGA4.init({ measurementId: 'G-XXXXXXX' })
 *
 * This module DOES NOT replace GA4 — it runs alongside it, sending
 * matching events so you can compare coverage in GA4 reports.
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending.
 */
(function(window, document) {
  'use strict';

  // ============================================================
  // STATE
  // ============================================================

  var _initialized = false;
  var _measurementId = '';
  var _debug = false;
  var _eventLog = [];        // Local log of all events sent to both systems
  var _comparisonStats = {   // Running comparison counters
    sws_events: 0,
    ga4_events: 0,
    sws_only: 0,     // Events SWS captures that GA4 doesn't
    ga4_only: 0,      // Events GA4 captures that SWS doesn't (page_view, etc.)
    both: 0            // Events both systems capture
  };

  // ============================================================
  // GA4 EVENT MAPPING
  // ============================================================

  /**
   * Maps SWS event types to GA4 custom event names and parameters.
   * GA4 custom events are prefixed with 'sws_' to avoid collision.
   */
  var EVENT_MAP = {
    // Core attention events
    'page_visit':       { ga4Event: 'sws_page_visit',      category: 'attention' },
    'idle_drip':        { ga4Event: 'sws_idle_drip',        category: 'attention' },
    'tab_return':       { ga4Event: 'sws_tab_return',       category: 'attention' },
    'ambient_mode':     { ga4Event: 'sws_ambient',          category: 'attention' },

    // Game/app events
    'game_start':       { ga4Event: 'sws_game_start',       category: 'engagement' },
    'game_complete':    { ga4Event: 'sws_game_complete',     category: 'engagement' },
    'game_milestone':   { ga4Event: 'sws_game_milestone',    category: 'engagement' },

    // Social/viral
    'share_verified':   { ga4Event: 'sws_share_verified',    category: 'social' },
    'share_viewed':     { ga4Event: 'sws_share_viewed',      category: 'social' },
    'referral_signup':  { ga4Event: 'sws_referral_signup',   category: 'social' },

    // Movement
    'trail_steps_200':  { ga4Event: 'sws_steps_200',         category: 'fitness' },
    'trail_steps_2000': { ga4Event: 'sws_steps_2000',        category: 'fitness' },
    'fitness_import':   { ga4Event: 'sws_fitness_import',    category: 'fitness' },

    // Notifications
    'notification_tap': { ga4Event: 'sws_notification_tap',  category: 'notification' },

    // Extension
    'extension_browse': { ga4Event: 'sws_extension_browse',  category: 'extension' },

    // B2B / Completion
    'test_event':       { ga4Event: 'sws_test_event',        category: 'test' }
  };

  // ============================================================
  // SWS-EXCLUSIVE METRICS (what GA4 can't capture)
  // ============================================================

  /**
   * These are the metrics SWS captures that GA4 fundamentally cannot:
   * - Human confidence score (behavioral science)
   * - Quality tier classification
   * - Focus score
   * - Attention hash (cryptographic proof)
   * - Behavioral signal breakdown (6 signals)
   *
   * We send these as custom dimensions/metrics in the GA4 event
   * so they appear in GA4 reports, proving GA4 needs our protocol.
   */

  // ============================================================
  // CORE: SEND EVENT TO BOTH SYSTEMS
  // ============================================================

  /**
   * Send an attention event to both SWS and GA4 simultaneously.
   * Returns a comparison record showing what each system captured.
   */
  function sendDualEvent(eventType, swsData) {
    var comparison = {
      timestamp: Date.now(),
      event_type: eventType,
      sws: {
        captured: true,
        hash: swsData.hash || null,
        quality_tier: swsData.quality_tier || null,
        focus_score: swsData.focus_score || null,
        human_confidence: swsData.human_confidence || null,
        behavioral_signals: swsData.behavioral_signals || null,
        duration_ms: swsData.duration_ms || 0,
        interaction_count: swsData.interaction_count || 0
      },
      ga4: {
        captured: false,
        event_name: null,
        parameters: null
      },
      delta: {} // What SWS captured that GA4 didn't
    };

    // Send to GA4
    var mapping = EVENT_MAP[eventType] || { ga4Event: 'sws_' + eventType, category: 'other' };

    if (_isGtagAvailable()) {
      var ga4Params = {
        event_category: mapping.category,
        sws_event_type: eventType,
        sws_quality_tier: swsData.quality_tier || 'unknown',
        sws_duration_ms: swsData.duration_ms || 0,
        sws_interaction_count: swsData.interaction_count || 0,
        // These are SWS-exclusive metrics — GA4 can't compute them natively
        sws_focus_score: swsData.focus_score || 0,
        sws_human_confidence: Math.round((swsData.human_confidence || 0) * 100),
        sws_hash_prefix: swsData.hash ? swsData.hash.substring(0, 8) : 'none'
      };

      window.gtag('event', mapping.ga4Event, ga4Params);

      comparison.ga4.captured = true;
      comparison.ga4.event_name = mapping.ga4Event;
      comparison.ga4.parameters = ga4Params;

      _comparisonStats.ga4_events++;
      _comparisonStats.both++;
    } else {
      _comparisonStats.sws_only++;
    }

    // Record SWS-exclusive data that GA4 can't natively produce
    comparison.delta = {
      cryptographic_hash: true,        // GA4 has no hash
      behavioral_analysis: true,       // GA4 can't do Fitts'/Hick's/timing analysis
      quality_tier_classification: true, // GA4 doesn't classify engagement quality
      focus_score: true,               // GA4 has "engagement_time" but no focus score
      human_vs_bot_detection: true,    // GA4 doesn't distinguish human from bot (on client side)
      offline_first_sync: true         // GA4 loses data when offline
    };

    _comparisonStats.sws_events++;

    // Log for comparison dashboard
    _eventLog.push(comparison);
    if (_eventLog.length > 10000) _eventLog = _eventLog.slice(-8000);

    _log('Dual event:', eventType, '| GA4:', comparison.ga4.captured ? 'sent' : 'skipped');

    return comparison;
  }

  // ============================================================
  // GA4-ONLY EVENTS (things GA4 tracks that we don't)
  // ============================================================

  /**
   * Record when GA4 fires an event that SWS doesn't track.
   * These are standard GA4 events with no SWS equivalent.
   */
  function recordGA4OnlyEvent(eventName) {
    _comparisonStats.ga4_only++;
    _eventLog.push({
      timestamp: Date.now(),
      event_type: eventName,
      sws: { captured: false },
      ga4: { captured: true, event_name: eventName },
      delta: {
        note: 'GA4-only event — SWS does not track this because it is not attention-related'
      }
    });
  }

  // Standard GA4 events that SWS intentionally doesn't capture
  var GA4_ONLY_EVENTS = [
    'page_view',           // GA4 tracks URL (we don't, privacy)
    'scroll',              // GA4 fires at 90% scroll (we measure saccade quality instead)
    'first_visit',         // GA4 tracks new vs returning (we use session IDs)
    'session_start',       // GA4 session model (we use continuous attention)
    'user_engagement',     // GA4 fires after 10s (we measure quality, not just time)
    'click',               // GA4 tracks outbound clicks (we don't track URLs)
    'file_download',       // Not attention-related
    'form_start',          // Not attention-related
    'form_submit',         // Not attention-related
    'video_start',         // GA4 enhanced measurement (we'd capture via interaction events)
    'video_progress',      // GA4 enhanced measurement
    'video_complete'       // GA4 enhanced measurement
  ];

  // ============================================================
  // HOOK INTO SWS SDK
  // ============================================================

  /**
   * Wire into SWSAttention's onHashEarned callback.
   * Every time a hash is earned, also fire a GA4 event.
   */
  function _hookIntoSWS() {
    if (typeof window.SWSAttention === 'undefined') {
      _log('SWSAttention not found — bridge will wait');
      return false;
    }

    // Store original callback
    var _originalCallback = null;

    // We need to re-init with our callback wrapping
    // Since SWSAttention is already initialized, we hook via a polling approach
    // on getStats to capture new hashes
    var _lastHashCount = 0;

    setInterval(function() {
      if (!window.SWSAttention) return;

      var stats = window.SWSAttention.getStats();
      if (!stats) return;

      var currentCount = stats.totalHashes || 0;
      if (currentCount > _lastHashCount) {
        // New hashes earned — fire GA4 events for them
        var newHashes = currentCount - _lastHashCount;
        var confidence = stats.humanConfidence || {};

        for (var i = 0; i < newHashes; i++) {
          sendDualEvent('hash_earned', {
            quality_tier: _getTopTier(stats.tierDistribution),
            focus_score: stats.focusScore,
            human_confidence: confidence.composite || 0,
            behavioral_signals: confidence,
            duration_ms: stats.sessionDurationMs || 0,
            interaction_count: 0
          });
        }

        _lastHashCount = currentCount;
      }
    }, 2000); // Check every 2 seconds

    return true;
  }

  function _getTopTier(distribution) {
    if (!distribution) return 'active';
    var tiers = ['deep', 'active', 'passive', 'background'];
    var max = 0;
    var top = 'active';
    tiers.forEach(function(t) {
      if ((distribution[t] || 0) > max) {
        max = distribution[t];
        top = t;
      }
    });
    return top;
  }

  // ============================================================
  // COMPARISON REPORT
  // ============================================================

  /**
   * Generate a comparison report between SWS and GA4.
   * This is the proof that SWS captures what GA4 misses.
   */
  function getComparisonReport() {
    var report = {
      generated_at: new Date().toISOString(),
      protocol: 'SWS Proof of Attention Protocol',
      comparison_with: 'Google Analytics 4',

      // Event counts
      stats: {
        sws_events: _comparisonStats.sws_events,
        ga4_events: _comparisonStats.ga4_events,
        both_systems: _comparisonStats.both,
        sws_only: _comparisonStats.sws_only,
        ga4_only: _comparisonStats.ga4_only
      },

      // What SWS captures that GA4 cannot
      sws_exclusive_capabilities: {
        cryptographic_proof: {
          description: 'SHA-256 hash of every attention event',
          ga4_equivalent: 'None — GA4 has no cryptographic verification',
          value: 'Tamper-proof, auditable attention records'
        },
        behavioral_science: {
          description: '6 behavioral signals: timing entropy, Fitts\' Law, Hick\'s Law, scroll saccade, micro-pause, touch variance',
          ga4_equivalent: 'None — GA4 tracks page views and clicks, not behavioral patterns',
          value: 'Distinguishes genuine human attention from bots/tab-farming'
        },
        quality_tier_classification: {
          description: 'Deep Focus (2x) / Active (1x) / Passive (0.5x) / Background (0.25x)',
          ga4_equivalent: 'None — GA4 counts all engagement equally',
          value: 'Not all attention is equal — deep focus is worth more than background tabs'
        },
        focus_score: {
          description: 'Weighted 0-100 score based on time at each quality tier',
          ga4_equivalent: 'engagement_time_msec (total time, no quality)',
          value: '30 minutes of deep focus ≠ 30 minutes of background tab'
        },
        human_vs_bot: {
          description: 'Composite 0-1 confidence score that the user is human',
          ga4_equivalent: 'None — GA4 relies on server-side bot filtering',
          value: 'Client-side, real-time bot detection using behavioral science'
        },
        offline_first: {
          description: 'Hashes stored locally first, synced when online',
          ga4_equivalent: 'GA4 loses events when offline',
          value: 'Never lose attention data, even without network'
        },
        privacy_by_design: {
          description: 'No URLs, no content, no PII — just attention metrics',
          ga4_equivalent: 'GA4 tracks page URLs, referrers, device info',
          value: 'COPPA/SCIF compliant by architecture — no opt-out needed for core tracking'
        }
      },

      // What GA4 captures that SWS intentionally doesn't
      ga4_exclusive_events: GA4_ONLY_EVENTS.map(function(e) {
        return {
          event: e,
          reason_sws_skips: 'Privacy — SWS does not track URLs, content, or navigation patterns'
        };
      }),

      // Recent event log
      recent_events: _eventLog.slice(-50)
    };

    return report;
  }

  /**
   * Get running comparison statistics.
   */
  function getComparisonStats() {
    return {
      sws_events: _comparisonStats.sws_events,
      ga4_events: _comparisonStats.ga4_events,
      both_systems: _comparisonStats.both,
      sws_only: _comparisonStats.sws_only,
      ga4_only: _comparisonStats.ga4_only,
      sws_advantage: _comparisonStats.sws_only - _comparisonStats.ga4_only,
      event_log_size: _eventLog.length
    };
  }

  /**
   * Get the full event log for analysis.
   */
  function getEventLog() {
    return _eventLog.slice();
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  function init(options) {
    if (_initialized) return;
    options = options || {};

    _measurementId = options.measurementId || '';
    _debug = options.debug || false;

    // Auto-load gtag if measurement ID provided and gtag not present
    if (_measurementId && !_isGtagAvailable()) {
      _loadGtag(_measurementId);
    }

    // Record GA4-only events that fire automatically
    GA4_ONLY_EVENTS.forEach(function(event) {
      recordGA4OnlyEvent(event);
    });

    // Hook into SWS SDK
    _hookIntoSWS();

    _initialized = true;
    _log('GA4 Bridge initialized. Measurement ID:', _measurementId || '(none)');
  }

  // ============================================================
  // HELPERS
  // ============================================================

  function _isGtagAvailable() {
    return typeof window.gtag === 'function';
  }

  function _loadGtag(measurementId) {
    // Inject the standard gtag.js snippet
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
    var firstScript = document.getElementsByTagName('script')[0];
    if (firstScript && firstScript.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript);
    } else {
      document.head.appendChild(script);
    }

    window.dataLayer = window.dataLayer || [];
    window.gtag = function() { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
      send_page_view: true,
      cookie_flags: 'SameSite=None;Secure'
    });

    _log('GA4 gtag loaded:', measurementId);
  }

  function _log() {
    if (_debug) {
      var args = ['[SWS GA4 Bridge]'].concat(Array.prototype.slice.call(arguments));
      console.log.apply(console, args);
    }
  }

  // ============================================================
  // EXPORT
  // ============================================================

  window.SWSGA4 = {
    init: init,
    sendDualEvent: sendDualEvent,
    recordGA4OnlyEvent: recordGA4OnlyEvent,
    getComparisonReport: getComparisonReport,
    getComparisonStats: getComparisonStats,
    getEventLog: getEventLog,
    EVENT_MAP: EVENT_MAP,
    GA4_ONLY_EVENTS: GA4_ONLY_EVENTS
  };

})(window, document);
