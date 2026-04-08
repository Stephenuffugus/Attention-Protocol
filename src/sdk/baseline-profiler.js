/**
 * SWS Baseline Profiler & Drift Detector
 *
 * Establishes a behavioral baseline for a user, then detects degradation
 * in real-time. Answers the question: "Is this person about to underperform?"
 *
 * Use cases:
 *   - Military: Soldier fatigue/disengagement before mission-critical tasks
 *   - Medical: Doctor attention degradation during long shifts
 *   - Training: Learner fatigue detection during certification
 *   - Workplace: Operator alertness monitoring
 *
 * How it works:
 *   1. BASELINE PHASE: Collect behavioral signals during calibration
 *      (first N minutes or explicit calibration task)
 *   2. MONITORING PHASE: Compare current signals against baseline
 *   3. DRIFT DETECTION: Flag when current performance deviates
 *      beyond threshold from baseline
 *
 * Signals monitored:
 *   - Reaction time (mean + variance)
 *   - Click/tap precision (distance from target center)
 *   - Scroll rhythm consistency
 *   - Mouse movement smoothness (jitter)
 *   - Decision speed (Hick's Law compliance drift)
 *   - Interaction frequency (gaps between actions)
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
(function(root) {
  'use strict';

  // ============================================================
  // CONFIGURATION
  // ============================================================

  var DEFAULT_CONFIG = {
    // Baseline collection
    baselineWindowMs: 5 * 60 * 1000,    // 5 minutes of baseline data
    baselineMinSamples: 20,              // minimum interactions before baseline is valid
    // Monitoring
    monitoringWindowMs: 60 * 1000,       // rolling 60-second window for current state
    // Drift thresholds
    reactionTimeDriftThreshold: 0.40,    // 40% slower than baseline = flagged
    precisionDriftThreshold: 0.35,       // 35% less precise = flagged
    rhythmDriftThreshold: 0.40,          // 40% rhythm change = flagged
    jitterDriftThreshold: 0.50,          // 50% more jitter = flagged
    frequencyDriftThreshold: 0.50,       // 50% fewer interactions = flagged
    // Alert levels
    warningThreshold: 0.30,              // composite drift > 30% = warning
    alertThreshold: 0.50,               // composite drift > 50% = alert
    criticalThreshold: 0.70,            // composite drift > 70% = critical
    // Callbacks
    onDriftDetected: null,               // callback(driftReport)
    onPhaseChange: null,                 // callback('baseline' | 'monitoring')
    debug: false
  };

  // ============================================================
  // STATE
  // ============================================================

  var _config = {};
  var _phase = 'idle';  // idle -> baseline -> monitoring
  var _startTime = 0;

  // Baseline data (accumulated during calibration)
  var _baseline = {
    reactionTimes: [],
    clickPrecisions: [],     // distance from target center in px
    scrollIntervals: [],     // time between scroll events
    mouseJitter: [],         // deviation from smooth path
    interactionGaps: [],     // time between any interaction
    decisionSpeeds: [],      // response time per decision

    // Computed baseline stats (set when baseline is locked)
    locked: false,
    stats: null
  };

  // Current monitoring window
  var _current = {
    reactionTimes: [],
    clickPrecisions: [],
    scrollIntervals: [],
    mouseJitter: [],
    interactionGaps: [],
    decisionSpeeds: [],
    lastInteractionTime: 0
  };

  var _lastMousePos = null;
  var _lastMouseTime = 0;
  var _lastScrollTime = 0;
  var _driftHistory = [];  // [{timestamp, driftScore, level}, ...]

  // ============================================================
  // UTILITY
  // ============================================================

  function _log() {
    if (_config.debug) {
      var args = ['[SWS Baseline]'].concat(Array.prototype.slice.call(arguments));
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

  function _cv(arr) {
    var m = _mean(arr);
    if (m === 0) return 0;
    return _stddev(arr) / m;
  }

  function _median(arr) {
    if (arr.length === 0) return 0;
    var sorted = arr.slice().sort(function(a, b) { return a - b; });
    var mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function _trimWindow(arr, windowMs) {
    var cutoff = _now() - windowMs;
    // If entries have timestamps, filter by time
    // Otherwise keep last N based on window ratio
    var maxEntries = Math.max(10, Math.floor(windowMs / 1000));
    if (arr.length > maxEntries) {
      return arr.slice(arr.length - maxEntries);
    }
    return arr;
  }

  // ============================================================
  // BASELINE COMPUTATION
  // ============================================================

  function _computeStats(data) {
    return {
      reactionTime: {
        mean: _mean(data.reactionTimes),
        median: _median(data.reactionTimes),
        stddev: _stddev(data.reactionTimes),
        cv: _cv(data.reactionTimes),
        count: data.reactionTimes.length
      },
      clickPrecision: {
        mean: _mean(data.clickPrecisions),
        stddev: _stddev(data.clickPrecisions),
        count: data.clickPrecisions.length
      },
      scrollRhythm: {
        mean: _mean(data.scrollIntervals),
        cv: _cv(data.scrollIntervals),
        count: data.scrollIntervals.length
      },
      mouseJitter: {
        mean: _mean(data.mouseJitter),
        stddev: _stddev(data.mouseJitter),
        count: data.mouseJitter.length
      },
      interactionFrequency: {
        meanGap: _mean(data.interactionGaps),
        cv: _cv(data.interactionGaps),
        count: data.interactionGaps.length
      },
      decisionSpeed: {
        mean: _mean(data.decisionSpeeds),
        stddev: _stddev(data.decisionSpeeds),
        count: data.decisionSpeeds.length
      }
    };
  }

  function _lockBaseline() {
    var totalSamples =
      _baseline.reactionTimes.length +
      _baseline.clickPrecisions.length +
      _baseline.scrollIntervals.length +
      _baseline.interactionGaps.length;

    if (totalSamples < _config.baselineMinSamples) {
      _log('Not enough baseline samples:', totalSamples, '/', _config.baselineMinSamples);
      return false;
    }

    _baseline.stats = _computeStats(_baseline);
    _baseline.locked = true;
    _phase = 'monitoring';

    _log('Baseline locked with', totalSamples, 'samples');
    _log('Baseline stats:', JSON.stringify(_baseline.stats));

    if (_config.onPhaseChange) {
      _config.onPhaseChange('monitoring');
    }

    return true;
  }

  // ============================================================
  // DRIFT COMPUTATION
  // ============================================================

  /**
   * Compute how much the current signals have drifted from baseline.
   * Returns a drift report with per-signal and composite scores.
   */
  function _computeDrift() {
    if (!_baseline.locked || !_baseline.stats) {
      return { phase: _phase, driftScore: 0, level: 'no_baseline', signals: {} };
    }

    var currentStats = _computeStats(_current);
    var drifts = {};

    // 1. Reaction Time Drift (slower = degrading)
    if (currentStats.reactionTime.count >= 3 && _baseline.stats.reactionTime.mean > 0) {
      var rtDrift = (currentStats.reactionTime.mean - _baseline.stats.reactionTime.mean)
                    / _baseline.stats.reactionTime.mean;
      drifts.reactionTime = {
        baselineMean: Math.round(_baseline.stats.reactionTime.mean),
        currentMean: Math.round(currentStats.reactionTime.mean),
        drift: Math.round(rtDrift * 1000) / 1000,
        degraded: rtDrift > _config.reactionTimeDriftThreshold
      };
    } else {
      drifts.reactionTime = { drift: 0, degraded: false, data_quality: 'insufficient' };
    }

    // 2. Click Precision Drift (larger distance from center = degrading)
    if (currentStats.clickPrecision.count >= 3 && _baseline.stats.clickPrecision.mean > 0) {
      var precDrift = (currentStats.clickPrecision.mean - _baseline.stats.clickPrecision.mean)
                      / _baseline.stats.clickPrecision.mean;
      drifts.clickPrecision = {
        baselineMean: Math.round(_baseline.stats.clickPrecision.mean * 10) / 10,
        currentMean: Math.round(currentStats.clickPrecision.mean * 10) / 10,
        drift: Math.round(precDrift * 1000) / 1000,
        degraded: precDrift > _config.precisionDriftThreshold
      };
    } else {
      drifts.clickPrecision = { drift: 0, degraded: false, data_quality: 'insufficient' };
    }

    // 3. Scroll Rhythm Drift (irregular rhythm = degrading)
    if (currentStats.scrollRhythm.count >= 3 && _baseline.stats.scrollRhythm.cv > 0) {
      var rhythmDrift = Math.abs(currentStats.scrollRhythm.cv - _baseline.stats.scrollRhythm.cv)
                        / _baseline.stats.scrollRhythm.cv;
      drifts.scrollRhythm = {
        baselineCv: Math.round(_baseline.stats.scrollRhythm.cv * 1000) / 1000,
        currentCv: Math.round(currentStats.scrollRhythm.cv * 1000) / 1000,
        drift: Math.round(rhythmDrift * 1000) / 1000,
        degraded: rhythmDrift > _config.rhythmDriftThreshold
      };
    } else {
      drifts.scrollRhythm = { drift: 0, degraded: false, data_quality: 'insufficient' };
    }

    // 4. Mouse Jitter Drift (more jitter = degrading)
    if (currentStats.mouseJitter.count >= 3 && _baseline.stats.mouseJitter.mean > 0) {
      var jitterDrift = (currentStats.mouseJitter.mean - _baseline.stats.mouseJitter.mean)
                        / _baseline.stats.mouseJitter.mean;
      drifts.mouseJitter = {
        baselineMean: Math.round(_baseline.stats.mouseJitter.mean * 10) / 10,
        currentMean: Math.round(currentStats.mouseJitter.mean * 10) / 10,
        drift: Math.round(jitterDrift * 1000) / 1000,
        degraded: jitterDrift > _config.jitterDriftThreshold
      };
    } else {
      drifts.mouseJitter = { drift: 0, degraded: false, data_quality: 'insufficient' };
    }

    // 5. Interaction Frequency Drift (longer gaps = degrading)
    if (currentStats.interactionFrequency.count >= 3 && _baseline.stats.interactionFrequency.meanGap > 0) {
      var freqDrift = (currentStats.interactionFrequency.meanGap - _baseline.stats.interactionFrequency.meanGap)
                      / _baseline.stats.interactionFrequency.meanGap;
      drifts.interactionFrequency = {
        baselineGap: Math.round(_baseline.stats.interactionFrequency.meanGap),
        currentGap: Math.round(currentStats.interactionFrequency.meanGap),
        drift: Math.round(freqDrift * 1000) / 1000,
        degraded: freqDrift > _config.frequencyDriftThreshold
      };
    } else {
      drifts.interactionFrequency = { drift: 0, degraded: false, data_quality: 'insufficient' };
    }

    // Composite drift score (average of all available drifts, clamped 0-1)
    var driftValues = [];
    var degradedCount = 0;
    for (var key in drifts) {
      if (drifts.hasOwnProperty(key) && drifts[key].data_quality !== 'insufficient') {
        // Use absolute drift, clamped to 0-1
        driftValues.push(Math.min(1, Math.max(0, drifts[key].drift)));
        if (drifts[key].degraded) degradedCount++;
      }
    }

    var compositeDrift = driftValues.length > 0 ?
      driftValues.reduce(function(a, b) { return a + b; }, 0) / driftValues.length : 0;
    compositeDrift = Math.round(compositeDrift * 1000) / 1000;

    var level;
    if (compositeDrift >= _config.criticalThreshold) {
      level = 'critical';
    } else if (compositeDrift >= _config.alertThreshold) {
      level = 'alert';
    } else if (compositeDrift >= _config.warningThreshold) {
      level = 'warning';
    } else {
      level = 'normal';
    }

    var report = {
      phase: _phase,
      timestamp: new Date().toISOString(),
      driftScore: compositeDrift,
      level: level,
      degradedSignals: degradedCount,
      totalSignals: driftValues.length,
      signals: drifts,
      recommendation: _getRecommendation(level, degradedCount, drifts)
    };

    // Store in history
    _driftHistory.push({
      timestamp: _now(),
      driftScore: compositeDrift,
      level: level
    });
    if (_driftHistory.length > 500) _driftHistory.shift();

    // Fire callback if drift detected
    if (level !== 'normal' && _config.onDriftDetected) {
      _config.onDriftDetected(report);
    }

    return report;
  }

  function _getRecommendation(level, degradedCount, drifts) {
    if (level === 'critical') {
      return 'Immediate break recommended. Multiple behavioral signals show significant degradation.';
    }
    if (level === 'alert') {
      var worstSignal = '';
      var worstDrift = 0;
      for (var k in drifts) {
        if (drifts.hasOwnProperty(k) && drifts[k].drift > worstDrift) {
          worstDrift = drifts[k].drift;
          worstSignal = k;
        }
      }
      return 'Performance degradation detected (worst: ' + worstSignal + '). Consider a short break.';
    }
    if (level === 'warning') {
      return 'Minor drift detected. Monitor closely.';
    }
    return 'Performance within normal range.';
  }

  // ============================================================
  // SIGNAL RECORDING (called by the attention protocol)
  // ============================================================

  function _recordInteractionGap() {
    var now = _now();
    if (_current.lastInteractionTime > 0) {
      var gap = now - _current.lastInteractionTime;
      if (_phase === 'baseline') {
        _baseline.interactionGaps.push(gap);
      } else {
        _current.interactionGaps.push(gap);
        _current.interactionGaps = _trimWindow(_current.interactionGaps, _config.monitoringWindowMs);
      }
    }
    _current.lastInteractionTime = now;
  }

  var BaselineProfiler = {
    /**
     * Initialize the profiler.
     */
    init: function(config) {
      _config = {};
      for (var key in DEFAULT_CONFIG) {
        if (DEFAULT_CONFIG.hasOwnProperty(key)) {
          _config[key] = (config && config[key] !== undefined) ? config[key] : DEFAULT_CONFIG[key];
        }
      }
      _startTime = _now();
      _phase = 'idle';
      _baseline = {
        reactionTimes: [],
        clickPrecisions: [],
        scrollIntervals: [],
        mouseJitter: [],
        interactionGaps: [],
        decisionSpeeds: [],
        locked: false,
        stats: null
      };
      _current = {
        reactionTimes: [],
        clickPrecisions: [],
        scrollIntervals: [],
        mouseJitter: [],
        interactionGaps: [],
        decisionSpeeds: [],
        lastInteractionTime: 0
      };
      _lastMousePos = null;
      _lastMouseTime = 0;
      _lastScrollTime = 0;
      _driftHistory = [];

      _log('Initialized');
    },

    /**
     * Start baseline collection phase.
     */
    startBaseline: function() {
      if (!_config.baselineWindowMs) this.init({});
      _phase = 'baseline';
      _startTime = _now();
      _log('Baseline collection started');

      if (_config.onPhaseChange) {
        _config.onPhaseChange('baseline');
      }
    },

    /**
     * Manually lock the baseline and enter monitoring phase.
     * Normally called automatically after enough data.
     */
    lockBaseline: function() {
      return _lockBaseline();
    },

    /**
     * Set baseline from pre-computed data (server-side or loaded from storage).
     */
    setBaseline: function(stats) {
      _baseline.stats = stats;
      _baseline.locked = true;
      _phase = 'monitoring';
      _log('Baseline set from external data');
    },

    /**
     * Record a reaction time measurement.
     * @param {number} reactionTimeMs - Time between stimulus and response
     */
    recordReactionTime: function(reactionTimeMs) {
      _recordInteractionGap();
      if (_phase === 'baseline') {
        _baseline.reactionTimes.push(reactionTimeMs);
        _checkBaselineReady();
      } else if (_phase === 'monitoring') {
        _current.reactionTimes.push(reactionTimeMs);
        _current.reactionTimes = _trimWindow(_current.reactionTimes, _config.monitoringWindowMs);
      }
    },

    /**
     * Record click/tap precision.
     * @param {number} distanceFromCenter - Distance in px from target center
     */
    recordClickPrecision: function(distanceFromCenter) {
      _recordInteractionGap();
      if (_phase === 'baseline') {
        _baseline.clickPrecisions.push(distanceFromCenter);
        _checkBaselineReady();
      } else if (_phase === 'monitoring') {
        _current.clickPrecisions.push(distanceFromCenter);
        _current.clickPrecisions = _trimWindow(_current.clickPrecisions, _config.monitoringWindowMs);
      }
    },

    /**
     * Record a scroll event (tracks rhythm between scrolls).
     */
    recordScroll: function() {
      var now = _now();
      _recordInteractionGap();
      if (_lastScrollTime > 0) {
        var interval = now - _lastScrollTime;
        if (_phase === 'baseline') {
          _baseline.scrollIntervals.push(interval);
          _checkBaselineReady();
        } else if (_phase === 'monitoring') {
          _current.scrollIntervals.push(interval);
          _current.scrollIntervals = _trimWindow(_current.scrollIntervals, _config.monitoringWindowMs);
        }
      }
      _lastScrollTime = now;
    },

    /**
     * Record mouse position (computes jitter from expected smooth path).
     * @param {number} x - Mouse X
     * @param {number} y - Mouse Y
     */
    recordMousePosition: function(x, y) {
      var now = _now();
      if (_lastMousePos && _lastMouseTime) {
        var dt = now - _lastMouseTime;
        if (dt > 0 && dt < 1000) { // ignore large gaps
          var dx = x - _lastMousePos.x;
          var dy = y - _lastMousePos.y;
          var distance = Math.sqrt(dx * dx + dy * dy);
          var velocity = distance / dt;

          // Jitter = velocity variance (smooth movement has consistent velocity)
          // We store instantaneous velocity; jitter is computed as CV of velocities
          if (_phase === 'baseline') {
            _baseline.mouseJitter.push(velocity);
            // Don't check baseline ready for every mouse move — too noisy
          } else if (_phase === 'monitoring') {
            _current.mouseJitter.push(velocity);
            _current.mouseJitter = _trimWindow(_current.mouseJitter, _config.monitoringWindowMs);
          }
        }
      }
      _lastMousePos = { x: x, y: y };
      _lastMouseTime = now;
    },

    /**
     * Record a decision speed (time to choose from N options).
     * @param {number} responseTimeMs - Time to make decision
     */
    recordDecisionSpeed: function(responseTimeMs) {
      _recordInteractionGap();
      if (_phase === 'baseline') {
        _baseline.decisionSpeeds.push(responseTimeMs);
        _checkBaselineReady();
      } else if (_phase === 'monitoring') {
        _current.decisionSpeeds.push(responseTimeMs);
        _current.decisionSpeeds = _trimWindow(_current.decisionSpeeds, _config.monitoringWindowMs);
      }
    },

    /**
     * Get the current drift report.
     */
    getDrift: function() {
      return _computeDrift();
    },

    /**
     * Get the current phase.
     */
    getPhase: function() {
      return _phase;
    },

    /**
     * Get baseline stats (null if not yet locked).
     */
    getBaseline: function() {
      return _baseline.locked ? _baseline.stats : null;
    },

    /**
     * Get drift history.
     */
    getDriftHistory: function() {
      return _driftHistory.slice();
    },

    /**
     * Export profiler state for server-side analysis.
     */
    exportForServer: function() {
      return {
        phase: _phase,
        baselineLocked: _baseline.locked,
        baselineStats: _baseline.stats,
        currentWindow: {
          reactionTimes: _current.reactionTimes.slice(),
          clickPrecisions: _current.clickPrecisions.slice(),
          scrollIntervals: _current.scrollIntervals.slice(),
          mouseJitter: _current.mouseJitter.slice(),
          interactionGaps: _current.interactionGaps.slice(),
          decisionSpeeds: _current.decisionSpeeds.slice()
        },
        driftHistory: _driftHistory.slice(-50)
      };
    },

    /**
     * Reset all state.
     */
    reset: function() {
      _phase = 'idle';
      _baseline = {
        reactionTimes: [], clickPrecisions: [], scrollIntervals: [],
        mouseJitter: [], interactionGaps: [], decisionSpeeds: [],
        locked: false, stats: null
      };
      _current = {
        reactionTimes: [], clickPrecisions: [], scrollIntervals: [],
        mouseJitter: [], interactionGaps: [], decisionSpeeds: [],
        lastInteractionTime: 0
      };
      _lastMousePos = null;
      _lastMouseTime = 0;
      _lastScrollTime = 0;
      _driftHistory = [];
    },

    // Expose for testing
    _internal: {
      computeStats: _computeStats,
      computeDrift: _computeDrift,
      mean: _mean,
      stddev: _stddev,
      cv: _cv,
      median: _median,
      baseline: function() { return _baseline; },
      current: function() { return _current; },
      config: function() { return _config; }
    }
  };

  function _checkBaselineReady() {
    if (_phase !== 'baseline' || _baseline.locked) return;

    var totalSamples =
      _baseline.reactionTimes.length +
      _baseline.clickPrecisions.length +
      _baseline.scrollIntervals.length +
      _baseline.interactionGaps.length;

    var elapsed = _now() - _startTime;

    if (totalSamples >= _config.baselineMinSamples && elapsed >= _config.baselineWindowMs) {
      _lockBaseline();
    }
  }

  // ============================================================
  // EXPORT
  // ============================================================

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = BaselineProfiler;
  } else if (typeof root !== 'undefined') {
    root.SWSBaselineProfiler = BaselineProfiler;
  }

})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
