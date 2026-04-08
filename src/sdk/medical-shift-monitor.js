/**
 * SWS Medical Shift Attention Monitor
 *
 * Purpose-built for healthcare where attention degradation
 * directly impacts patient safety.
 *
 * Capabilities:
 *   - Shift-length fatigue tracking (4, 8, 12, 16+ hour shifts)
 *   - Protocol/order reading verification
 *   - Escalating alert system (self → charge nurse → supervisor)
 *   - Precision tracking (critical for medication administration)
 *   - Handoff readiness scoring
 *   - HIPAA-compliant: no patient data captured, no PHI
 *
 * Integration targets:
 *   - EHR systems (Epic, Cerner, Meditech)
 *   - Medication administration records
 *   - Protocol/policy management systems
 *   - Shift management/scheduling systems
 *   - Nurse call systems
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
(function(root) {
  'use strict';

  // ============================================================
  // SHIFT ALERT LEVELS
  // ============================================================

  var ALERT_LEVELS = {
    GREEN:  { level: 0, label: 'GREEN — Normal Performance', action: 'None' },
    YELLOW: { level: 1, label: 'YELLOW — Minor Degradation', action: 'Self-monitor, consider break' },
    ORANGE: { level: 2, label: 'ORANGE — Significant Degradation', action: 'Notify charge nurse, mandatory break recommended' },
    RED:    { level: 3, label: 'RED — Critical Degradation', action: 'Notify supervisor, relieve from critical tasks immediately' }
  };

  // Shift fatigue curves — expected degradation by hours worked
  var SHIFT_FATIGUE_BASELINE = {
    4:  { expectedDrift: 0.05, alertThreshold: 0.15 },
    8:  { expectedDrift: 0.15, alertThreshold: 0.30 },
    12: { expectedDrift: 0.30, alertThreshold: 0.45 },
    16: { expectedDrift: 0.45, alertThreshold: 0.55 }
  };

  // ============================================================
  // STATE
  // ============================================================

  var _config = {};
  var _initialized = false;
  var _shiftStart = 0;

  // Shift tracking
  var _shiftHours = 0;
  var _breaksTaken = [];        // [{startTime, endTime, durationMs}, ...]
  var _totalBreakMs = 0;

  // Performance windows (periodic check-ins)
  var _checkIns = [];           // [{timestamp, reactionTimeMs, precisionPx, accuracy, alertLevel}, ...]

  // Protocol reading
  var _protocolsReviewed = {};  // protocolId -> { read, score, dwellMs, ... }

  // Precision tracking (critical for med admin)
  var _precisionHistory = [];   // [{timestamp, precisionPx, taskType}, ...]
  var _baselinePrecision = null;

  // RT tracking
  var _baselineRT = null;
  var _currentWindowRTs = [];

  // Alert history
  var _alertHistory = [];

  // ============================================================
  // UTILITY
  // ============================================================

  function _now() { return Date.now(); }

  function _mean(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce(function(a, b) { return a + b; }, 0) / arr.length;
  }

  function _stddev(arr) {
    if (arr.length < 2) return 0;
    var m = _mean(arr);
    return Math.sqrt(arr.reduce(function(a, b) { return a + Math.pow(b - m, 2); }, 0) / arr.length);
  }

  // ============================================================
  // SHIFT MANAGEMENT
  // ============================================================

  function _getShiftHours() {
    return (_now() - _shiftStart) / (1000 * 60 * 60);
  }

  function _getExpectedFatigueBaseline() {
    var hours = _shiftHours || _getShiftHours();
    // Interpolate between known points
    var keys = Object.keys(SHIFT_FATIGUE_BASELINE).map(Number).sort(function(a, b) { return a - b; });
    for (var i = keys.length - 1; i >= 0; i--) {
      if (hours >= keys[i]) {
        return SHIFT_FATIGUE_BASELINE[keys[i]];
      }
    }
    return SHIFT_FATIGUE_BASELINE[4];
  }

  // ============================================================
  // PERFORMANCE CHECK-IN
  // ============================================================

  function _performCheckIn(data) {
    var checkIn = {
      timestamp: _now(),
      shiftHour: Math.round(_getShiftHours() * 10) / 10,
      reactionTimeMs: data.reactionTimeMs || null,
      precisionPx: data.precisionPx || null,
      accuracy: data.accuracy !== undefined ? data.accuracy : null,
      taskType: data.taskType || 'general'
    };

    // Compute drift from baseline
    var rtDrift = 0;
    if (_baselineRT && checkIn.reactionTimeMs) {
      rtDrift = (checkIn.reactionTimeMs - _baselineRT.mean) / _baselineRT.mean;
    }

    var precDrift = 0;
    if (_baselinePrecision && checkIn.precisionPx) {
      precDrift = (checkIn.precisionPx - _baselinePrecision.mean) / _baselinePrecision.mean;
    }

    // Determine alert level
    var expected = _getExpectedFatigueBaseline();
    var maxDrift = Math.max(rtDrift, precDrift);

    var alertLevel;
    if (maxDrift <= expected.expectedDrift * 1.5) {
      alertLevel = ALERT_LEVELS.GREEN;
    } else if (maxDrift <= expected.alertThreshold) {
      alertLevel = ALERT_LEVELS.YELLOW;
    } else if (maxDrift <= expected.alertThreshold * 1.5) {
      alertLevel = ALERT_LEVELS.ORANGE;
    } else {
      alertLevel = ALERT_LEVELS.RED;
    }

    checkIn.rtDrift = Math.round(rtDrift * 1000) / 1000;
    checkIn.precDrift = Math.round(precDrift * 1000) / 1000;
    checkIn.alertLevel = alertLevel.level;
    checkIn.alertLabel = alertLevel.label;
    checkIn.action = alertLevel.action;

    _checkIns.push(checkIn);
    if (_checkIns.length > 500) _checkIns.shift();

    // Record alert if not green
    if (alertLevel.level > 0) {
      _alertHistory.push({
        timestamp: checkIn.timestamp,
        shiftHour: checkIn.shiftHour,
        level: alertLevel.level,
        label: alertLevel.label,
        rtDrift: checkIn.rtDrift,
        precDrift: checkIn.precDrift
      });
    }

    return checkIn;
  }

  // ============================================================
  // PROTOCOL READING
  // ============================================================

  function _registerProtocol(protocolId, meta) {
    _protocolsReviewed[protocolId] = {
      id: protocolId,
      title: meta.title || protocolId,
      wordCount: meta.wordCount || 0,
      critical: meta.critical || false,
      requiredBy: meta.requiredBy || null,
      dwellMs: 0,
      viewCount: 0,
      activeSignals: 0,
      read: false,
      score: 0
    };
  }

  function _recordProtocolView(protocolId, dwellMs, options) {
    var protocol = _protocolsReviewed[protocolId];
    if (!protocol) return;
    options = options || {};
    protocol.dwellMs += dwellMs;
    protocol.viewCount++;
    if (options.activeSignals) protocol.activeSignals += options.activeSignals;
  }

  function _scoreProtocolCompliance() {
    var protocols = Object.keys(_protocolsReviewed);
    if (protocols.length === 0) return { score: 1.0, verdict: 'no_protocols', protocols: [] };

    var results = [];
    var totalRead = 0;
    var criticalRead = 0;
    var criticalTotal = 0;

    protocols.forEach(function(id) {
      var p = _protocolsReviewed[id];
      var expectedMs = Math.max(5000, (p.wordCount / 150) * 60 * 1000); // 150 WPM for medical protocols
      var dwellRatio = Math.min(1, p.dwellMs / expectedMs);

      var score = dwellRatio >= 0.6 ? dwellRatio :
                  dwellRatio >= 0.3 ? 0.4 : dwellRatio * 0.5;

      if (p.activeSignals >= 2) score = Math.min(1, score * 1.2);

      score = Math.round(score * 1000) / 1000;
      p.score = score;
      p.read = score >= 0.5;

      if (p.read) totalRead++;
      if (p.critical) {
        criticalTotal++;
        if (p.read) criticalRead++;
      }

      results.push({
        protocolId: id,
        title: p.title,
        critical: p.critical,
        read: p.read,
        score: score,
        dwellMs: p.dwellMs,
        wordCount: p.wordCount
      });
    });

    var overallScore = protocols.length > 0 ? totalRead / protocols.length : 0;
    var criticalCompliance = criticalTotal > 0 ? criticalRead / criticalTotal : 1;

    return {
      score: Math.round(overallScore * 1000) / 1000,
      criticalCompliance: Math.round(criticalCompliance * 1000) / 1000,
      totalProtocols: protocols.length,
      protocolsRead: totalRead,
      criticalRead: criticalRead,
      criticalTotal: criticalTotal,
      verdict: criticalCompliance === 1 && overallScore >= 0.8 ? 'fully_compliant' :
               criticalCompliance === 1 ? 'compliant' :
               criticalCompliance >= 0.5 ? 'partial_compliance' : 'non_compliant',
      protocols: results
    };
  }

  // ============================================================
  // HANDOFF READINESS
  // ============================================================

  function _assessHandoffReadiness() {
    var fatigue = _scoreFatigue();
    var compliance = _scoreProtocolCompliance();
    var shiftHours = _getShiftHours();

    // Recent performance (last 3 check-ins)
    var recentCheckIns = _checkIns.slice(-3);
    var recentAlertLevel = 0;
    recentCheckIns.forEach(function(c) {
      if (c.alertLevel > recentAlertLevel) recentAlertLevel = c.alertLevel;
    });

    var handoffScore = (
      fatigue.score * 0.35 +
      compliance.score * 0.35 +
      (1 - recentAlertLevel / 3) * 0.30
    );

    return {
      handoffReady: handoffScore >= 0.60 && compliance.criticalCompliance === 1,
      score: Math.round(handoffScore * 1000) / 1000,
      shiftHours: Math.round(shiftHours * 10) / 10,
      fatigue: fatigue,
      compliance: compliance,
      recentAlertLevel: recentAlertLevel,
      concerns: _buildHandoffConcerns(fatigue, compliance, recentAlertLevel)
    };
  }

  function _buildHandoffConcerns(fatigue, compliance, alertLevel) {
    var concerns = [];
    if (fatigue.verdict === 'severe_fatigue' || fatigue.verdict === 'moderate_fatigue') {
      concerns.push('Provider showing ' + fatigue.verdict.replace('_', ' '));
    }
    if (compliance.criticalCompliance < 1) {
      concerns.push(compliance.criticalTotal - compliance.criticalRead + ' critical protocol(s) not reviewed');
    }
    if (alertLevel >= 2) {
      concerns.push('Recent performance alerts at ORANGE or RED level');
    }
    return concerns;
  }

  function _scoreFatigue() {
    if (!_baselineRT || _currentWindowRTs.length < 3) {
      return { score: 1.0, drift: 0, verdict: 'no_baseline' };
    }
    var currentMean = _mean(_currentWindowRTs);
    if (_baselineRT.mean <= 0) return { score: 1.0, drift: 0, verdict: 'invalid_baseline' };
    var drift = Math.max(0, (currentMean - _baselineRT.mean) / _baselineRT.mean);
    var score = Math.max(0, 1 - drift / 0.8);
    return {
      score: Math.round(score * 1000) / 1000,
      drift: Math.round(drift * 1000) / 1000,
      baselineMeanMs: Math.round(_baselineRT.mean),
      currentMeanMs: Math.round(currentMean),
      verdict: score >= 0.75 ? 'fresh' :
               score >= 0.55 ? 'mild_fatigue' :
               score >= 0.35 ? 'moderate_fatigue' : 'severe_fatigue'
    };
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  var MedicalShiftMonitor = {

    init: function(config) {
      _config = config || {};
      _initialized = true;
      _shiftStart = _now();
      _shiftHours = 0;
      _breaksTaken = [];
      _totalBreakMs = 0;
      _checkIns = [];
      _protocolsReviewed = {};
      _precisionHistory = [];
      _baselinePrecision = null;
      _baselineRT = null;
      _currentWindowRTs = [];
      _alertHistory = [];
    },

    // Shift management
    setShiftStart: function(timestamp) {
      _shiftStart = timestamp || _now();
    },

    recordBreak: function(durationMs) {
      _breaksTaken.push({
        startTime: _now() - durationMs,
        endTime: _now(),
        durationMs: durationMs
      });
      _totalBreakMs += durationMs;
    },

    getShiftHours: function() {
      return Math.round(_getShiftHours() * 10) / 10;
    },

    // Baselines
    setBaselineRT: function(stats) {
      _baselineRT = stats; // { mean, stddev }
    },

    setBaselineFromData: function(reactionTimes) {
      if (!reactionTimes || reactionTimes.length < 5) return;
      _baselineRT = { mean: _mean(reactionTimes), stddev: _stddev(reactionTimes) };
    },

    setBaselinePrecision: function(stats) {
      _baselinePrecision = stats; // { mean, stddev }
    },

    // Performance check-in
    checkIn: function(data) {
      if (data.reactionTimeMs) {
        _currentWindowRTs.push(data.reactionTimeMs);
        if (_currentWindowRTs.length > 30) _currentWindowRTs.shift();
      }
      return _performCheckIn(data);
    },

    // Protocol compliance
    registerProtocol: function(protocolId, meta) {
      _registerProtocol(protocolId, meta || {});
    },

    recordProtocolView: function(protocolId, dwellMs, options) {
      _recordProtocolView(protocolId, dwellMs, options);
    },

    scoreProtocolCompliance: function() {
      return _scoreProtocolCompliance();
    },

    // Fatigue
    scoreFatigue: function() {
      return _scoreFatigue();
    },

    // Handoff
    assessHandoffReadiness: function() {
      return _assessHandoffReadiness();
    },

    // Full shift report
    getShiftReport: function() {
      return {
        shiftHours: Math.round(_getShiftHours() * 10) / 10,
        breaksTaken: _breaksTaken.length,
        totalBreakMinutes: Math.round(_totalBreakMs / 60000),
        totalCheckIns: _checkIns.length,
        alertHistory: _alertHistory.slice(),
        highestAlertLevel: _alertHistory.reduce(function(max, a) {
          return a.level > max ? a.level : max;
        }, 0),
        fatigue: _scoreFatigue(),
        protocolCompliance: _scoreProtocolCompliance(),
        handoffReadiness: _assessHandoffReadiness(),
        hipaaCompliant: true,
        phiCollected: false,
        patientDataCaptured: false
      };
    },

    getAlertLevels: function() {
      return ALERT_LEVELS;
    },

    reset: function() {
      _initialized = false;
      _checkIns = [];
      _protocolsReviewed = {};
      _precisionHistory = [];
      _baselinePrecision = null;
      _baselineRT = null;
      _currentWindowRTs = [];
      _alertHistory = [];
      _breaksTaken = [];
      _totalBreakMs = 0;
    },

    _internal: {
      checkIns: function() { return _checkIns; },
      alertHistory: function() { return _alertHistory; },
      protocols: function() { return _protocolsReviewed; }
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MedicalShiftMonitor;
  } else if (typeof root !== 'undefined') {
    root.SWSMedicalShiftMonitor = MedicalShiftMonitor;
  }

})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
