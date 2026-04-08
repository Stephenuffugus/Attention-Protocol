/**
 * SWS Temporal Session Analyzer
 *
 * Compares behavioral signals from early in a session vs late in a session
 * to detect within-session fatigue, disengagement, or cognitive overload.
 *
 * Unlike the Baseline Profiler (which compares against a stored baseline),
 * this works within a SINGLE session — no prior data needed.
 *
 * Use cases:
 *   - Online exam proctoring (student attention degrades during long exams)
 *   - Training certification (did they stay engaged through the full course?)
 *   - Shift monitoring (operator alertness throughout a shift)
 *   - Content engagement (reader drops off halfway through an article)
 *
 * How it works:
 *   1. Divides the session into time windows (e.g., 5-minute blocks)
 *   2. Computes behavioral metrics for each window
 *   3. Detects trends: declining, stable, improving, erratic
 *   4. Flags specific degradation points
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
(function(root) {
  'use strict';

  // ============================================================
  // CONFIGURATION
  // ============================================================

  var DEFAULT_CONFIG = {
    // Window size for temporal analysis
    windowSizeMs: 5 * 60 * 1000,   // 5-minute windows
    // Minimum events per window to be considered valid
    minEventsPerWindow: 5,
    // Degradation detection
    degradationThreshold: 0.25,     // 25% decline = flagged
    trendMinWindows: 3,             // need at least 3 windows for trend
    debug: false
  };

  // ============================================================
  // STATE
  // ============================================================

  var _config = {};
  var _initialized = false;
  var _sessionStart = 0;

  // Raw event log — all events timestamped
  var _events = [];  // [{type, timestamp, value, metadata}, ...]

  // ============================================================
  // UTILITY
  // ============================================================

  function _log() {
    if (_config.debug) {
      var args = ['[SWS Temporal]'].concat(Array.prototype.slice.call(arguments));
      console.log.apply(console, args);
    }
  }

  function _now() {
    return Date.now();
  }

  function _mean(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce(function(a, b) { return a + b; }, 0) / arr.length;
  }

  function _stddev(arr) {
    if (arr.length < 2) return 0;
    var m = _mean(arr);
    var variance = arr.reduce(function(a, b) { return a + Math.pow(b - m, 2); }, 0) / arr.length;
    return Math.sqrt(variance);
  }

  // ============================================================
  // EVENT RECORDING
  // ============================================================

  function _recordEvent(type, value, metadata) {
    _events.push({
      type: type,
      timestamp: _now(),
      value: value,
      metadata: metadata || null
    });
    if (_events.length > 10000) _events.shift();
  }

  // ============================================================
  // WINDOW ANALYSIS
  // ============================================================

  /**
   * Divide events into time windows and compute metrics per window.
   */
  function _buildWindows() {
    if (_events.length === 0) return [];

    var sessionDuration = _now() - _sessionStart;
    var windowCount = Math.max(1, Math.ceil(sessionDuration / _config.windowSizeMs));
    var windows = [];

    for (var w = 0; w < windowCount; w++) {
      var windowStart = _sessionStart + (w * _config.windowSizeMs);
      var windowEnd = windowStart + _config.windowSizeMs;

      var windowEvents = _events.filter(function(e) {
        return e.timestamp >= windowStart && e.timestamp < windowEnd;
      });

      // Compute metrics for this window
      var reactionTimes = windowEvents
        .filter(function(e) { return e.type === 'reaction_time'; })
        .map(function(e) { return e.value; });

      var clickPrecisions = windowEvents
        .filter(function(e) { return e.type === 'click_precision'; })
        .map(function(e) { return e.value; });

      var scrollEvents = windowEvents
        .filter(function(e) { return e.type === 'scroll'; });

      var interactionGaps = [];
      var allEvents = windowEvents.sort(function(a, b) { return a.timestamp - b.timestamp; });
      for (var i = 1; i < allEvents.length; i++) {
        interactionGaps.push(allEvents[i].timestamp - allEvents[i - 1].timestamp);
      }

      var mouseJitter = windowEvents
        .filter(function(e) { return e.type === 'mouse_jitter'; })
        .map(function(e) { return e.value; });

      windows.push({
        index: w,
        startMs: windowStart - _sessionStart,
        endMs: windowEnd - _sessionStart,
        eventCount: windowEvents.length,
        metrics: {
          reactionTime: reactionTimes.length >= 2 ? {
            mean: _mean(reactionTimes),
            stddev: _stddev(reactionTimes),
            count: reactionTimes.length
          } : null,
          clickPrecision: clickPrecisions.length >= 2 ? {
            mean: _mean(clickPrecisions),
            stddev: _stddev(clickPrecisions),
            count: clickPrecisions.length
          } : null,
          interactionRate: {
            eventsPerMinute: windowEvents.length / (_config.windowSizeMs / 60000),
            meanGap: interactionGaps.length > 0 ? _mean(interactionGaps) : null,
            count: windowEvents.length
          },
          mouseJitter: mouseJitter.length >= 2 ? {
            mean: _mean(mouseJitter),
            count: mouseJitter.length
          } : null,
          scrollCount: scrollEvents.length
        },
        valid: windowEvents.length >= _config.minEventsPerWindow
      });
    }

    return windows;
  }

  // ============================================================
  // TREND DETECTION
  // ============================================================

  /**
   * Detect trends in a series of values.
   * Returns { trend, slope, pctChange, degradationPoint }
   */
  function _detectTrend(values) {
    if (values.length < 2) {
      return { trend: 'insufficient_data', slope: 0, pctChange: 0, degradationPoint: null };
    }

    // Simple linear regression
    var n = values.length;
    var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (var i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }
    var slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    // Percentage change from first to last
    var first = values[0];
    var last = values[values.length - 1];
    var pctChange = first !== 0 ? (last - first) / Math.abs(first) : 0;

    // Find degradation point (where values start consistently worsening)
    var degradationPoint = null;
    if (values.length >= 3) {
      for (var j = 1; j < values.length - 1; j++) {
        // Check if all subsequent values are worse than this point
        var allWorse = true;
        for (var k = j + 1; k < values.length; k++) {
          if (values[k] <= values[j]) {
            allWorse = false;
            break;
          }
        }
        if (allWorse && (values[values.length - 1] - values[j]) / Math.max(1, Math.abs(values[j])) > _config.degradationThreshold) {
          degradationPoint = j;
          break;
        }
      }
    }

    var trend;
    var absPctChange = Math.abs(pctChange);
    if (absPctChange < 0.10) {
      trend = 'stable';
    } else if (slope > 0) {
      trend = 'increasing';  // for RT/precision, increasing = degrading
    } else {
      trend = 'decreasing';
    }

    return {
      trend: trend,
      slope: Math.round(slope * 1000) / 1000,
      pctChange: Math.round(pctChange * 1000) / 1000,
      degradationPoint: degradationPoint
    };
  }

  // ============================================================
  // FULL SESSION ANALYSIS
  // ============================================================

  function _analyze() {
    var windows = _buildWindows();
    var validWindows = windows.filter(function(w) { return w.valid; });

    if (validWindows.length < 2) {
      return {
        sessionDurationMs: _now() - _sessionStart,
        windowCount: windows.length,
        validWindowCount: validWindows.length,
        verdict: 'insufficient_data',
        overallDegradation: 0,
        trends: {},
        windows: windows,
        degradationPoints: [],
        recommendation: 'Not enough data for temporal analysis.'
      };
    }

    // Extract metric series from valid windows
    var rtSeries = [];
    var precSeries = [];
    var rateSeries = [];
    var jitterSeries = [];

    validWindows.forEach(function(w) {
      if (w.metrics.reactionTime) rtSeries.push(w.metrics.reactionTime.mean);
      if (w.metrics.clickPrecision) precSeries.push(w.metrics.clickPrecision.mean);
      rateSeries.push(w.metrics.interactionRate.eventsPerMinute);
      if (w.metrics.mouseJitter) jitterSeries.push(w.metrics.mouseJitter.mean);
    });

    var trends = {};
    var degradationPoints = [];

    // Analyze each metric series
    if (rtSeries.length >= _config.trendMinWindows) {
      trends.reactionTime = _detectTrend(rtSeries);
      trends.reactionTime.interpretation =
        trends.reactionTime.trend === 'increasing' ? 'slowing_down' :
        trends.reactionTime.trend === 'decreasing' ? 'speeding_up' : 'stable';
      if (trends.reactionTime.degradationPoint !== null) {
        degradationPoints.push({
          metric: 'reactionTime',
          windowIndex: trends.reactionTime.degradationPoint,
          description: 'Reaction time began increasing'
        });
      }
    }

    if (precSeries.length >= _config.trendMinWindows) {
      trends.clickPrecision = _detectTrend(precSeries);
      trends.clickPrecision.interpretation =
        trends.clickPrecision.trend === 'increasing' ? 'less_precise' :
        trends.clickPrecision.trend === 'decreasing' ? 'more_precise' : 'stable';
      if (trends.clickPrecision.degradationPoint !== null) {
        degradationPoints.push({
          metric: 'clickPrecision',
          windowIndex: trends.clickPrecision.degradationPoint,
          description: 'Click precision began degrading'
        });
      }
    }

    if (rateSeries.length >= _config.trendMinWindows) {
      trends.interactionRate = _detectTrend(rateSeries);
      trends.interactionRate.interpretation =
        trends.interactionRate.trend === 'decreasing' ? 'disengaging' :
        trends.interactionRate.trend === 'increasing' ? 'more_active' : 'stable';
      if (trends.interactionRate.trend === 'decreasing' &&
          Math.abs(trends.interactionRate.pctChange) > _config.degradationThreshold) {
        degradationPoints.push({
          metric: 'interactionRate',
          windowIndex: trends.interactionRate.degradationPoint,
          description: 'Interaction rate began declining'
        });
      }
    }

    if (jitterSeries.length >= _config.trendMinWindows) {
      trends.mouseJitter = _detectTrend(jitterSeries);
      trends.mouseJitter.interpretation =
        trends.mouseJitter.trend === 'increasing' ? 'more_erratic' :
        trends.mouseJitter.trend === 'decreasing' ? 'smoother' : 'stable';
      if (trends.mouseJitter.degradationPoint !== null) {
        degradationPoints.push({
          metric: 'mouseJitter',
          windowIndex: trends.mouseJitter.degradationPoint,
          description: 'Mouse movement became more erratic'
        });
      }
    }

    // Compute overall degradation score
    var degradationScores = [];
    if (trends.reactionTime && trends.reactionTime.trend === 'increasing') {
      degradationScores.push(Math.min(1, Math.abs(trends.reactionTime.pctChange)));
    }
    if (trends.clickPrecision && trends.clickPrecision.trend === 'increasing') {
      degradationScores.push(Math.min(1, Math.abs(trends.clickPrecision.pctChange)));
    }
    if (trends.interactionRate && trends.interactionRate.trend === 'decreasing') {
      degradationScores.push(Math.min(1, Math.abs(trends.interactionRate.pctChange)));
    }
    if (trends.mouseJitter && trends.mouseJitter.trend === 'increasing') {
      degradationScores.push(Math.min(1, Math.abs(trends.mouseJitter.pctChange)));
    }

    var overallDegradation = degradationScores.length > 0 ?
      degradationScores.reduce(function(a, b) { return a + b; }, 0) / degradationScores.length : 0;
    overallDegradation = Math.round(overallDegradation * 1000) / 1000;

    // Determine verdict
    var verdict;
    if (overallDegradation >= 0.50) {
      verdict = 'significant_fatigue';
    } else if (overallDegradation >= 0.25) {
      verdict = 'moderate_fatigue';
    } else if (degradationPoints.length > 0) {
      verdict = 'mild_fatigue';
    } else {
      verdict = 'sustained_attention';
    }

    // Build recommendation
    var recommendation;
    if (verdict === 'significant_fatigue') {
      recommendation = 'Significant performance decline detected. Session should be paused or ended.';
    } else if (verdict === 'moderate_fatigue') {
      recommendation = 'Moderate fatigue detected. A break is recommended.';
    } else if (verdict === 'mild_fatigue') {
      recommendation = 'Minor decline in some metrics. Monitor for continued degradation.';
    } else {
      recommendation = 'Attention sustained throughout session.';
    }

    // First half vs second half comparison
    var halfPoint = Math.floor(validWindows.length / 2);
    var firstHalf = validWindows.slice(0, halfPoint);
    var secondHalf = validWindows.slice(halfPoint);

    var firstHalfRate = _mean(firstHalf.map(function(w) { return w.metrics.interactionRate.eventsPerMinute; }));
    var secondHalfRate = _mean(secondHalf.map(function(w) { return w.metrics.interactionRate.eventsPerMinute; }));
    var halfComparison = {
      firstHalfAvgRate: Math.round(firstHalfRate * 10) / 10,
      secondHalfAvgRate: Math.round(secondHalfRate * 10) / 10,
      rateChange: firstHalfRate > 0 ?
        Math.round(((secondHalfRate - firstHalfRate) / firstHalfRate) * 1000) / 1000 : 0
    };

    return {
      sessionDurationMs: _now() - _sessionStart,
      windowCount: windows.length,
      validWindowCount: validWindows.length,
      verdict: verdict,
      overallDegradation: overallDegradation,
      trends: trends,
      halfComparison: halfComparison,
      degradationPoints: degradationPoints,
      recommendation: recommendation,
      windows: windows.map(function(w) {
        return {
          index: w.index,
          startMs: w.startMs,
          endMs: w.endMs,
          eventCount: w.eventCount,
          valid: w.valid,
          metrics: w.metrics
        };
      })
    };
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  var TemporalAnalyzer = {
    init: function(config) {
      _config = {};
      for (var key in DEFAULT_CONFIG) {
        if (DEFAULT_CONFIG.hasOwnProperty(key)) {
          _config[key] = (config && config[key] !== undefined) ? config[key] : DEFAULT_CONFIG[key];
        }
      }
      _events = [];
      _sessionStart = _now();
      _initialized = true;
      _log('Initialized');
    },

    recordReactionTime: function(ms) {
      _recordEvent('reaction_time', ms);
    },

    recordClickPrecision: function(distancePx) {
      _recordEvent('click_precision', distancePx);
    },

    recordScroll: function() {
      _recordEvent('scroll', 1);
    },

    recordMouseJitter: function(velocity) {
      _recordEvent('mouse_jitter', velocity);
    },

    recordInteraction: function(type) {
      _recordEvent('interaction', 1, { type: type });
    },

    /**
     * Inject events directly (for testing / server-side analysis).
     */
    injectEvents: function(events, sessionStartTime) {
      _events = events.slice();
      if (sessionStartTime) _sessionStart = sessionStartTime;
    },

    analyze: function() {
      return _analyze();
    },

    getEventCount: function() {
      return _events.length;
    },

    reset: function() {
      _events = [];
      _sessionStart = 0;
      _initialized = false;
    },

    _internal: {
      buildWindows: _buildWindows,
      detectTrend: _detectTrend,
      events: function() { return _events; },
      config: function() { return _config; },
      mean: _mean,
      stddev: _stddev
    }
  };

  // ============================================================
  // EXPORT
  // ============================================================

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TemporalAnalyzer;
  } else if (typeof root !== 'undefined') {
    root.SWSTemporalAnalyzer = TemporalAnalyzer;
  }

})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
