/**
 * SWS Military Readiness Attention Module
 *
 * Purpose-built for defense applications where attention failures
 * have life-or-death consequences.
 *
 * Capabilities:
 *   - Mission brief reading verification with section-level proof
 *   - Sustained vigilance scoring over extended watch periods
 *   - Real-time fatigue detection with escalating alert levels
 *   - Pre-mission readiness assessment
 *   - SCIF-compatible: zero PII, zero network, zero content capture
 *   - Works offline — all processing is local
 *
 * Integration targets:
 *   - Tablet-based mission brief systems
 *   - Watch station monitoring terminals
 *   - Training certification platforms
 *   - Pre-deployment readiness checks
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
(function(root) {
  'use strict';

  // ============================================================
  // READINESS LEVELS (maps to military readiness conditions)
  // ============================================================

  var READINESS_LEVELS = {
    FULL: { level: 4, label: 'FULL READINESS', minScore: 0.80, color: 'green' },
    SUBSTANTIAL: { level: 3, label: 'SUBSTANTIAL READINESS', minScore: 0.65, color: 'yellow' },
    MARGINAL: { level: 2, label: 'MARGINAL READINESS', minScore: 0.45, color: 'orange' },
    DEGRADED: { level: 1, label: 'DEGRADED — IMMEDIATE ACTION REQUIRED', minScore: 0, color: 'red' }
  };

  // ============================================================
  // STATE
  // ============================================================

  var _config = {};
  var _initialized = false;
  var _assessmentStart = 0;
  var _phase = 'idle'; // idle, brief_reading, vigilance, assessment

  // Brief reading state
  var _briefSections = {};
  var _briefComplete = false;

  // Vigilance state (sustained attention over time)
  var _vigilanceChecks = []; // [{timestamp, reactionTimeMs, accurate, stimulusType}, ...]
  var _vigilanceWindowMs = 0;
  var _missedStimuli = 0;
  var _falseAlarms = 0;

  // Fatigue tracking
  var _baselineRT = null;
  var _currentRT = [];
  var _rtWindows = []; // [{windowStart, meanRT, accuracy}, ...]

  // Overall readiness
  var _lastReadinessScore = null;

  // ============================================================
  // UTILITY
  // ============================================================

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
    return Math.sqrt(arr.reduce(function(a, b) { return a + Math.pow(b - m, 2); }, 0) / arr.length);
  }

  // ============================================================
  // BRIEF READING MODULE
  // ============================================================

  function _registerBriefSection(sectionId, meta) {
    _briefSections[sectionId] = {
      id: sectionId,
      title: meta.title || sectionId,
      wordCount: meta.wordCount || 0,
      classification: meta.classification || 'UNCLASSIFIED',
      critical: meta.critical || false, // critical sections MUST be read
      order: meta.order || 0,

      // Tracking
      dwellMs: 0,
      viewCount: 0,
      reReadCount: 0,
      activeSignals: 0,
      read: false,
      score: 0
    };
  }

  function _scoreBriefSection(sectionId) {
    var section = _briefSections[sectionId];
    if (!section) return null;

    var expectedReadMs = Math.max(3000, (section.wordCount / 180) * 60 * 1000); // 180 WPM for technical content
    var dwellRatio = Math.min(1, section.dwellMs / expectedReadMs);

    var scores = {
      dwell: dwellRatio >= 0.7 ? 1.0 : dwellRatio >= 0.4 ? 0.5 + 0.5 * (dwellRatio / 0.7) : dwellRatio * 0.7,
      reRead: section.reReadCount >= 1 ? 1.0 : 0.5, // re-reading is expected for mission briefs
      engagement: section.activeSignals >= 3 ? 1.0 :
                  section.activeSignals >= 1 ? 0.5 : 0.1
    };

    var composite = scores.dwell * 0.50 + scores.reRead * 0.20 + scores.engagement * 0.30;
    section.score = Math.round(composite * 1000) / 1000;
    section.read = composite >= 0.5;

    return {
      sectionId: sectionId,
      title: section.title,
      classification: section.classification,
      critical: section.critical,
      wordCount: section.wordCount,
      dwellMs: section.dwellMs,
      read: section.read,
      score: section.score,
      scores: scores
    };
  }

  function _scoreBrief() {
    var sectionIds = Object.keys(_briefSections);
    var results = [];
    var criticalPassed = true;
    var totalRead = 0;
    var weightedSum = 0;
    var totalWeight = 0;

    sectionIds.forEach(function(id) {
      var result = _scoreBriefSection(id);
      if (result) {
        results.push(result);
        var weight = result.critical ? 2 : 1; // critical sections count double
        weightedSum += result.score * weight;
        totalWeight += weight;
        if (result.read) totalRead++;
        if (result.critical && !result.read) criticalPassed = false;
      }
    });

    var briefScore = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 1000) / 1000 : 0;
    var coverageRatio = sectionIds.length > 0 ? totalRead / sectionIds.length : 0;

    return {
      briefScore: briefScore,
      coverageRatio: Math.round(coverageRatio * 1000) / 1000,
      totalSections: sectionIds.length,
      sectionsRead: totalRead,
      criticalSectionsPassed: criticalPassed,
      sections: results,
      verdict: criticalPassed && briefScore >= 0.65 ? 'brief_comprehended' :
               !criticalPassed ? 'critical_sections_missed' :
               briefScore >= 0.40 ? 'brief_partially_read' : 'brief_not_read'
    };
  }

  // ============================================================
  // VIGILANCE MODULE (sustained attention over time)
  // ============================================================

  function _scoreVigilance() {
    if (_vigilanceChecks.length < 5) {
      return { score: 0, verdict: 'insufficient_data', checks: _vigilanceChecks.length };
    }

    var reactionTimes = _vigilanceChecks
      .filter(function(c) { return c.accurate; })
      .map(function(c) { return c.reactionTimeMs; });

    var accuracy = _vigilanceChecks.filter(function(c) { return c.accurate; }).length / _vigilanceChecks.length;

    var meanRT = _mean(reactionTimes);
    var rtConsistency = reactionTimes.length >= 3 ? 1 - Math.min(1, _stddev(reactionTimes) / meanRT) : 0.5;

    // Score components
    var accuracyScore = accuracy;
    var speedScore = meanRT <= 400 ? 1.0 :
                     meanRT <= 600 ? 0.8 :
                     meanRT <= 1000 ? 0.5 :
                     meanRT <= 1500 ? 0.3 : 0.1;

    // Miss rate penalty
    var missRate = _missedStimuli / Math.max(1, _vigilanceChecks.length + _missedStimuli);
    var missScore = 1 - missRate;

    // False alarm penalty (responding when no stimulus)
    var falseAlarmRate = _falseAlarms / Math.max(1, _vigilanceChecks.length + _falseAlarms);
    var falseAlarmScore = 1 - (falseAlarmRate * 2); // double penalty for false alarms
    falseAlarmScore = Math.max(0, falseAlarmScore);

    var composite = (
      accuracyScore * 0.30 +
      speedScore * 0.25 +
      rtConsistency * 0.15 +
      missScore * 0.20 +
      falseAlarmScore * 0.10
    );

    return {
      score: Math.round(composite * 1000) / 1000,
      accuracy: Math.round(accuracy * 1000) / 1000,
      meanReactionTimeMs: Math.round(meanRT),
      reactionTimeConsistency: Math.round(rtConsistency * 1000) / 1000,
      missRate: Math.round(missRate * 1000) / 1000,
      falseAlarmRate: Math.round(falseAlarmRate * 1000) / 1000,
      totalChecks: _vigilanceChecks.length,
      missedStimuli: _missedStimuli,
      falseAlarms: _falseAlarms,
      verdict: composite >= 0.75 ? 'vigilant' :
               composite >= 0.55 ? 'adequate' :
               composite >= 0.35 ? 'degraded' : 'unfit'
    };
  }

  // ============================================================
  // FATIGUE ASSESSMENT
  // ============================================================

  function _scoreFatigue() {
    if (!_baselineRT || _currentRT.length < 3) {
      return { score: 1.0, drift: 0, verdict: 'no_baseline' };
    }

    var currentMean = _mean(_currentRT);
    var baselineMean = _baselineRT.mean;

    if (baselineMean <= 0) return { score: 1.0, drift: 0, verdict: 'invalid_baseline' };

    var drift = (currentMean - baselineMean) / baselineMean;
    drift = Math.max(0, drift); // only care about slowing down

    // Fatigue score: 1.0 = fresh, 0.0 = completely fatigued
    var fatigueScore = Math.max(0, 1 - (drift / 0.8)); // 80% slower = 0

    // Check RT window trend
    var windowDrift = 'stable';
    if (_rtWindows.length >= 3) {
      var first = _rtWindows[0].meanRT;
      var last = _rtWindows[_rtWindows.length - 1].meanRT;
      var windowPctChange = (last - first) / first;
      if (windowPctChange > 0.30) windowDrift = 'increasing';
      else if (windowPctChange < -0.10) windowDrift = 'decreasing';
    }

    return {
      score: Math.round(fatigueScore * 1000) / 1000,
      drift: Math.round(drift * 1000) / 1000,
      baselineMeanMs: Math.round(baselineMean),
      currentMeanMs: Math.round(currentMean),
      windowTrend: windowDrift,
      windowCount: _rtWindows.length,
      verdict: fatigueScore >= 0.75 ? 'fresh' :
               fatigueScore >= 0.55 ? 'mild_fatigue' :
               fatigueScore >= 0.35 ? 'moderate_fatigue' : 'severe_fatigue'
    };
  }

  // ============================================================
  // OVERALL READINESS ASSESSMENT
  // ============================================================

  function _assessReadiness() {
    var brief = _scoreBrief();
    var vigilance = _scoreVigilance();
    var fatigue = _scoreFatigue();

    // Combine scores with military-specific weights
    var hasVigilance = vigilance.verdict !== 'insufficient_data';
    var hasFatigue = fatigue.verdict !== 'no_baseline' && fatigue.verdict !== 'invalid_baseline';

    var components = [];
    components.push({ name: 'briefing', score: brief.briefScore, weight: 0.30 });
    if (hasVigilance) {
      components.push({ name: 'vigilance', score: vigilance.score, weight: 0.40 });
    }
    if (hasFatigue) {
      components.push({ name: 'fatigue_resistance', score: fatigue.score, weight: 0.30 });
    }

    // Normalize weights
    var totalWeight = components.reduce(function(a, c) { return a + c.weight; }, 0);
    var composite = components.reduce(function(a, c) { return a + c.score * c.weight; }, 0) / totalWeight;
    composite = Math.round(composite * 1000) / 1000;

    // Determine readiness level
    var readinessLevel;
    if (composite >= READINESS_LEVELS.FULL.minScore) {
      readinessLevel = READINESS_LEVELS.FULL;
    } else if (composite >= READINESS_LEVELS.SUBSTANTIAL.minScore) {
      readinessLevel = READINESS_LEVELS.SUBSTANTIAL;
    } else if (composite >= READINESS_LEVELS.MARGINAL.minScore) {
      readinessLevel = READINESS_LEVELS.MARGINAL;
    } else {
      readinessLevel = READINESS_LEVELS.DEGRADED;
    }

    // Critical overrides — if critical brief sections missed, cap at MARGINAL
    if (!brief.criticalSectionsPassed && readinessLevel.level > 2) {
      readinessLevel = READINESS_LEVELS.MARGINAL;
    }

    // If fatigue is severe, cap at MARGINAL
    if (hasFatigue && fatigue.verdict === 'severe_fatigue' && readinessLevel.level > 2) {
      readinessLevel = READINESS_LEVELS.MARGINAL;
    }

    var alerts = [];
    if (!brief.criticalSectionsPassed) {
      alerts.push({
        type: 'critical_brief_missed',
        severity: 'critical',
        detail: 'Critical mission brief section(s) were not read'
      });
    }
    if (hasFatigue && fatigue.drift > 0.40) {
      alerts.push({
        type: 'fatigue_warning',
        severity: fatigue.drift > 0.60 ? 'critical' : 'warning',
        detail: 'Reaction time degraded ' + Math.round(fatigue.drift * 100) + '% from baseline'
      });
    }
    if (hasVigilance && vigilance.missRate > 0.20) {
      alerts.push({
        type: 'vigilance_gap',
        severity: 'warning',
        detail: 'Missing ' + Math.round(vigilance.missRate * 100) + '% of stimuli'
      });
    }

    _lastReadinessScore = composite;

    return {
      readinessScore: composite,
      readinessLevel: readinessLevel.label,
      readinessCode: readinessLevel.level,
      color: readinessLevel.color,

      components: {
        briefing: brief,
        vigilance: vigilance,
        fatigue: fatigue
      },

      alerts: alerts,

      scifCompliant: true,
      piiCollected: false,
      contentCaptured: false,
      networkRequired: false,

      assessmentDurationMs: _now() - _assessmentStart,
      timestamp: new Date().toISOString()
    };
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  var MilitaryReadiness = {

    init: function(config) {
      _config = config || {};
      _initialized = true;
      _assessmentStart = _now();
      _phase = 'idle';
      _briefSections = {};
      _briefComplete = false;
      _vigilanceChecks = [];
      _missedStimuli = 0;
      _falseAlarms = 0;
      _baselineRT = null;
      _currentRT = [];
      _rtWindows = [];
      _lastReadinessScore = null;
    },

    // Brief reading
    registerBriefSection: function(sectionId, meta) {
      _registerBriefSection(sectionId, meta || {});
    },

    recordBriefView: function(sectionId, dwellMs, options) {
      var section = _briefSections[sectionId];
      if (!section) return;
      options = options || {};
      section.dwellMs += dwellMs;
      section.viewCount++;
      if (options.reRead) section.reReadCount++;
      if (options.activeSignals) section.activeSignals += options.activeSignals;
    },

    scoreBrief: function() {
      return _scoreBrief();
    },

    // Vigilance
    recordVigilanceCheck: function(reactionTimeMs, accurate, stimulusType) {
      _vigilanceChecks.push({
        timestamp: _now(),
        reactionTimeMs: reactionTimeMs,
        accurate: accurate !== false, // default true
        stimulusType: stimulusType || 'visual'
      });
      if (_vigilanceChecks.length > 5000) _vigilanceChecks.shift();

      // Track current RT for fatigue
      if (accurate !== false) {
        _currentRT.push(reactionTimeMs);
        if (_currentRT.length > 50) _currentRT.shift();
      }
    },

    recordMissedStimulus: function() {
      _missedStimuli++;
    },

    recordFalseAlarm: function() {
      _falseAlarms++;
    },

    scoreVigilance: function() {
      return _scoreVigilance();
    },

    // Fatigue
    setBaseline: function(baselineStats) {
      _baselineRT = baselineStats; // { mean, stddev }
    },

    setBaselineFromData: function(reactionTimes) {
      if (!reactionTimes || reactionTimes.length < 5) return;
      _baselineRT = {
        mean: _mean(reactionTimes),
        stddev: _stddev(reactionTimes)
      };
    },

    recordRTWindow: function(meanRT, accuracy) {
      _rtWindows.push({
        windowStart: _now(),
        meanRT: meanRT,
        accuracy: accuracy
      });
    },

    scoreFatigue: function() {
      return _scoreFatigue();
    },

    // Full assessment
    assessReadiness: function() {
      return _assessReadiness();
    },

    getReadinessLevels: function() {
      return READINESS_LEVELS;
    },

    reset: function() {
      _initialized = false;
      _briefSections = {};
      _vigilanceChecks = [];
      _missedStimuli = 0;
      _falseAlarms = 0;
      _baselineRT = null;
      _currentRT = [];
      _rtWindows = [];
    },

    _internal: {
      mean: _mean,
      stddev: _stddev,
      briefSections: function() { return _briefSections; },
      vigilanceChecks: function() { return _vigilanceChecks; }
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MilitaryReadiness;
  } else if (typeof root !== 'undefined') {
    root.SWSMilitaryReadiness = MilitaryReadiness;
  }

})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
