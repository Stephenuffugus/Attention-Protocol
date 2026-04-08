/**
 * SWS Session Integrity Validator
 *
 * Detects fabricated, replayed, or tampered session data.
 * This is the anti-cheat layer — catches people trying to fake attention.
 *
 * Use cases:
 *   - Replay attack detection (same session submitted twice with different IDs)
 *   - Fabricated data detection (statistically impossible signal patterns)
 *   - Timing manipulation (timestamps altered or out of order)
 *   - Signal coherence (do the different signals tell a consistent story?)
 *   - Volume anomalies (too many or too few events for the session duration)
 *
 * Checks performed:
 *   1. TIMESTAMP INTEGRITY: Are timestamps monotonically increasing? Realistic gaps?
 *   2. STATISTICAL PLAUSIBILITY: Are values within human-possible ranges?
 *   3. ENTROPY CHECK: Do values have enough randomness? (fabricated data is too regular)
 *   4. CROSS-SIGNAL COHERENCE: Do different signals tell the same story?
 *   5. VOLUME SANITY: Event count matches session duration?
 *   6. DUPLICATE DETECTION: Exact or near-duplicate signal patterns?
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
(function(root) {
  'use strict';

  // ============================================================
  // HUMAN POSSIBILITY RANGES
  // ============================================================

  var HUMAN_RANGES = {
    reactionTimeMs: { min: 80, max: 5000 },       // <80ms = impossible, >5s = inactive
    clickPrecisionPx: { min: 0, max: 200 },        // >200px = off-screen
    scrollVelocity: { min: 0, max: 50 },            // px/ms — >50 is inhuman
    mouseVelocity: { min: 0, max: 30 },             // px/ms
    interactionGapMs: { min: 50, max: 600000 },     // 50ms to 10 min
    decisionTimeMs: { min: 100, max: 30000 },       // 100ms to 30s
    touchRadiusPx: { min: 1, max: 100 },            // touch area
    sessionDurationMs: { min: 1000, max: 86400000 }, // 1s to 24h
    eventsPerMinute: { min: 0.1, max: 300 }          // practically 0 to 5/sec
  };

  // ============================================================
  // VALIDATION ENGINE
  // ============================================================

  var IntegrityValidator = {

    /**
     * Validate a complete session submission.
     * @param {object} session - The session data to validate
     * @returns {object} Validation result with pass/fail and detailed findings
     */
    validate: function(session) {
      var findings = [];
      var flags = {
        timestampIntegrity: true,
        statisticalPlausibility: true,
        entropyCheck: true,
        crossSignalCoherence: true,
        volumeSanity: true,
        duplicateDetection: true
      };

      // 1. TIMESTAMP INTEGRITY
      var tsResult = this._checkTimestamps(session);
      findings = findings.concat(tsResult.findings);
      if (!tsResult.pass) flags.timestampIntegrity = false;

      // 2. STATISTICAL PLAUSIBILITY
      var statResult = this._checkPlausibility(session);
      findings = findings.concat(statResult.findings);
      if (!statResult.pass) flags.statisticalPlausibility = false;

      // 3. ENTROPY CHECK
      var entropyResult = this._checkEntropy(session);
      findings = findings.concat(entropyResult.findings);
      if (!entropyResult.pass) flags.entropyCheck = false;

      // 4. CROSS-SIGNAL COHERENCE
      var coherenceResult = this._checkCoherence(session);
      findings = findings.concat(coherenceResult.findings);
      if (!coherenceResult.pass) flags.crossSignalCoherence = false;

      // 5. VOLUME SANITY
      var volumeResult = this._checkVolume(session);
      findings = findings.concat(volumeResult.findings);
      if (!volumeResult.pass) flags.volumeSanity = false;

      // 6. DUPLICATE DETECTION
      var dupResult = this._checkDuplicates(session);
      findings = findings.concat(dupResult.findings);
      if (!dupResult.pass) flags.duplicateDetection = false;

      // Overall result
      var failedChecks = Object.values(flags).filter(function(v) { return !v; }).length;
      var totalChecks = Object.keys(flags).length;

      var integrity;
      if (failedChecks === 0) {
        integrity = 'valid';
      } else if (failedChecks <= 1) {
        integrity = 'suspicious';
      } else if (failedChecks <= 3) {
        integrity = 'likely_fabricated';
      } else {
        integrity = 'rejected';
      }

      return {
        integrity: integrity,
        passedChecks: totalChecks - failedChecks,
        totalChecks: totalChecks,
        flags: flags,
        findings: findings,
        recommendation: this._getRecommendation(integrity, findings)
      };
    },

    // ============================================================
    // CHECK 1: TIMESTAMP INTEGRITY
    // ============================================================

    _checkTimestamps: function(session) {
      var findings = [];
      var pass = true;

      // Check interaction intervals for monotonicity issues
      if (Array.isArray(session.interaction_intervals)) {
        var negativeCount = 0;
        var zeroCount = 0;
        session.interaction_intervals.forEach(function(interval) {
          if (interval < 0) negativeCount++;
          if (interval === 0) zeroCount++;
        });

        if (negativeCount > 0) {
          findings.push({
            check: 'timestamp_integrity',
            severity: 'critical',
            detail: negativeCount + ' negative time intervals detected (impossible / time manipulation)'
          });
          pass = false;
        }

        if (zeroCount > session.interaction_intervals.length * 0.5) {
          findings.push({
            check: 'timestamp_integrity',
            severity: 'high',
            detail: 'Over 50% zero-interval timestamps (likely fabricated)'
          });
          pass = false;
        }
      }

      // Check tap sequence timestamps
      if (Array.isArray(session.tap_sequence) && session.tap_sequence.length > 1) {
        var outOfOrder = 0;
        for (var i = 1; i < session.tap_sequence.length; i++) {
          if (session.tap_sequence[i].t < session.tap_sequence[i - 1].t) {
            outOfOrder++;
          }
        }
        if (outOfOrder > 0) {
          findings.push({
            check: 'timestamp_integrity',
            severity: 'critical',
            detail: outOfOrder + ' out-of-order tap timestamps (data tampered)'
          });
          pass = false;
        }
      }

      // Check scroll event timestamps
      if (Array.isArray(session.scroll_events) && session.scroll_events.length > 1) {
        var scrollOutOfOrder = 0;
        for (var j = 1; j < session.scroll_events.length; j++) {
          if (session.scroll_events[j].t < session.scroll_events[j - 1].t) {
            scrollOutOfOrder++;
          }
        }
        if (scrollOutOfOrder > 0) {
          findings.push({
            check: 'timestamp_integrity',
            severity: 'high',
            detail: scrollOutOfOrder + ' out-of-order scroll timestamps'
          });
          pass = false;
        }
      }

      // Duration sanity
      if (session.duration_ms !== undefined) {
        if (session.duration_ms < HUMAN_RANGES.sessionDurationMs.min) {
          findings.push({
            check: 'timestamp_integrity',
            severity: 'medium',
            detail: 'Session duration too short: ' + session.duration_ms + 'ms'
          });
        }
        if (session.duration_ms > HUMAN_RANGES.sessionDurationMs.max) {
          findings.push({
            check: 'timestamp_integrity',
            severity: 'medium',
            detail: 'Session duration exceeds 24 hours: ' + session.duration_ms + 'ms'
          });
        }
      }

      return { pass: pass, findings: findings };
    },

    // ============================================================
    // CHECK 2: STATISTICAL PLAUSIBILITY
    // ============================================================

    _checkPlausibility: function(session) {
      var findings = [];
      var pass = true;

      // Check reaction times
      if (Array.isArray(session.interaction_intervals)) {
        var impossibleRT = 0;
        session.interaction_intervals.forEach(function(rt) {
          if (rt < HUMAN_RANGES.reactionTimeMs.min || rt > HUMAN_RANGES.reactionTimeMs.max) {
            impossibleRT++;
          }
        });
        if (impossibleRT > session.interaction_intervals.length * 0.2) {
          findings.push({
            check: 'statistical_plausibility',
            severity: 'high',
            detail: impossibleRT + ' reaction times outside human range (80ms-5000ms)'
          });
          pass = false;
        }
      }

      // Check tap positions — all clicks in exact same spot?
      if (Array.isArray(session.tap_sequence) && session.tap_sequence.length >= 5) {
        var uniquePositions = new Set();
        session.tap_sequence.forEach(function(tap) {
          uniquePositions.add(Math.round(tap.x) + ',' + Math.round(tap.y));
        });
        if (uniquePositions.size === 1) {
          findings.push({
            check: 'statistical_plausibility',
            severity: 'critical',
            detail: 'All ' + session.tap_sequence.length + ' taps at identical position (definite bot)'
          });
          pass = false;
        }
        if (uniquePositions.size < session.tap_sequence.length * 0.1) {
          findings.push({
            check: 'statistical_plausibility',
            severity: 'high',
            detail: 'Only ' + uniquePositions.size + ' unique positions for ' + session.tap_sequence.length + ' taps (likely bot)'
          });
          pass = false;
        }
      }

      // Check decision times
      if (Array.isArray(session.decisions)) {
        var impossibleDecisions = 0;
        session.decisions.forEach(function(d) {
          if (d.responseTimeMs < HUMAN_RANGES.decisionTimeMs.min) impossibleDecisions++;
        });
        if (impossibleDecisions > session.decisions.length * 0.3) {
          findings.push({
            check: 'statistical_plausibility',
            severity: 'high',
            detail: impossibleDecisions + ' decisions faster than 100ms (impossible for humans)'
          });
          pass = false;
        }
      }

      return { pass: pass, findings: findings };
    },

    // ============================================================
    // CHECK 3: ENTROPY CHECK
    // ============================================================

    _checkEntropy: function(session) {
      var findings = [];
      var pass = true;

      // Check if interaction intervals have suspiciously low entropy
      if (Array.isArray(session.interaction_intervals) && session.interaction_intervals.length >= 10) {
        var intervals = session.interaction_intervals;
        var mean = intervals.reduce(function(a, b) { return a + b; }, 0) / intervals.length;
        if (mean === 0) {
          findings.push({
            check: 'entropy',
            severity: 'critical',
            detail: 'Zero mean interaction interval (all zeros — fabricated)'
          });
          pass = false;
        } else {
          var variance = intervals.reduce(function(a, b) { return a + Math.pow(b - mean, 2); }, 0) / intervals.length;
          var cv = Math.sqrt(variance) / mean;

          if (cv < 0.01) {
            findings.push({
              check: 'entropy',
              severity: 'critical',
              detail: 'Near-zero timing variance (CV=' + cv.toFixed(4) + '). Machine-generated intervals.'
            });
            pass = false;
          } else if (cv < 0.05) {
            findings.push({
              check: 'entropy',
              severity: 'high',
              detail: 'Suspiciously low timing variance (CV=' + cv.toFixed(4) + '). Likely programmatic.'
            });
            pass = false;
          }
        }

        // Check for exact repetitions
        var uniqueIntervals = new Set(intervals.map(function(v) { return Math.round(v); }));
        if (uniqueIntervals.size < 3 && intervals.length >= 10) {
          findings.push({
            check: 'entropy',
            severity: 'high',
            detail: 'Only ' + uniqueIntervals.size + ' unique interval values in ' + intervals.length + ' samples (programmatic)'
          });
          pass = false;
        }
      }

      // Check scroll event regularity
      if (Array.isArray(session.scroll_events) && session.scroll_events.length >= 10) {
        var scrollDiffs = [];
        for (var i = 1; i < session.scroll_events.length; i++) {
          scrollDiffs.push(session.scroll_events[i].y - session.scroll_events[i - 1].y);
        }
        var uniqueScrollDiffs = new Set(scrollDiffs);
        if (uniqueScrollDiffs.size === 1 && scrollDiffs.length >= 10) {
          findings.push({
            check: 'entropy',
            severity: 'high',
            detail: 'All scroll deltas identical (' + scrollDiffs[0] + 'px). Programmatic scrolling.'
          });
          pass = false;
        }
      }

      return { pass: pass, findings: findings };
    },

    // ============================================================
    // CHECK 4: CROSS-SIGNAL COHERENCE
    // ============================================================

    _checkCoherence: function(session) {
      var findings = [];
      var pass = true;

      // High interaction count but zero scroll events = incoherent
      if (session.interaction_count > 50 &&
          (!Array.isArray(session.scroll_events) || session.scroll_events.length === 0)) {
        findings.push({
          check: 'cross_signal_coherence',
          severity: 'medium',
          detail: session.interaction_count + ' interactions but zero scrolls (unusual for engaged session)'
        });
      }

      // Lots of decisions but no tap data = suspicious
      if (Array.isArray(session.decisions) && session.decisions.length >= 10 &&
          (!Array.isArray(session.tap_sequence) || session.tap_sequence.length < 5)) {
        findings.push({
          check: 'cross_signal_coherence',
          severity: 'medium',
          detail: session.decisions.length + ' decisions but minimal tap data (decisions require interaction)'
        });
      }

      // Very long session but very few events = suspicious
      if (session.duration_ms > 300000 && session.interaction_count < 5) {
        findings.push({
          check: 'cross_signal_coherence',
          severity: 'high',
          detail: 'Session >5min with fewer than 5 interactions (idle bot or fabricated duration)'
        });
        pass = false;
      }

      // High hash count relative to session time
      if (session.hash_count > 0 && session.duration_ms > 0) {
        var hashesPerMinute = session.hash_count / (session.duration_ms / 60000);
        if (hashesPerMinute > 20) {
          findings.push({
            check: 'cross_signal_coherence',
            severity: 'high',
            detail: hashesPerMinute.toFixed(1) + ' hashes/min (max expected ~10/min for active use)'
          });
          pass = false;
        }
      }

      return { pass: pass, findings: findings };
    },

    // ============================================================
    // CHECK 5: VOLUME SANITY
    // ============================================================

    _checkVolume: function(session) {
      var findings = [];
      var pass = true;

      // Count total events
      var totalEvents = 0;
      if (Array.isArray(session.interaction_intervals)) totalEvents += session.interaction_intervals.length;
      if (Array.isArray(session.tap_sequence)) totalEvents += session.tap_sequence.length;
      if (Array.isArray(session.scroll_events)) totalEvents += session.scroll_events.length;
      if (Array.isArray(session.decisions)) totalEvents += session.decisions.length;
      if (Array.isArray(session.touches)) totalEvents += session.touches.length;

      if (session.duration_ms > 0 && totalEvents > 0) {
        var eventsPerMinute = totalEvents / (session.duration_ms / 60000);

        if (eventsPerMinute > HUMAN_RANGES.eventsPerMinute.max) {
          findings.push({
            check: 'volume_sanity',
            severity: 'critical',
            detail: eventsPerMinute.toFixed(1) + ' events/min exceeds human maximum (' +
                    HUMAN_RANGES.eventsPerMinute.max + '/min)'
          });
          pass = false;
        }

        if (eventsPerMinute < HUMAN_RANGES.eventsPerMinute.min && session.duration_ms > 60000) {
          findings.push({
            check: 'volume_sanity',
            severity: 'medium',
            detail: 'Only ' + eventsPerMinute.toFixed(2) + ' events/min for a ' +
                    Math.round(session.duration_ms / 60000) + '-min session'
          });
        }
      }

      return { pass: pass, findings: findings };
    },

    // ============================================================
    // CHECK 6: DUPLICATE / REPLAY DETECTION
    // ============================================================

    _checkDuplicates: function(session) {
      var findings = [];
      var pass = true;

      // Check for exact duplicate interaction intervals (copy-paste attack)
      if (Array.isArray(session.interaction_intervals) && session.interaction_intervals.length >= 20) {
        var intervals = session.interaction_intervals;
        var halfLen = Math.floor(intervals.length / 2);
        var firstHalf = intervals.slice(0, halfLen);
        var secondHalf = intervals.slice(halfLen, halfLen * 2);

        var matching = 0;
        for (var i = 0; i < firstHalf.length; i++) {
          if (firstHalf[i] === secondHalf[i]) matching++;
        }

        if (matching / firstHalf.length > 0.9) {
          findings.push({
            check: 'duplicate_detection',
            severity: 'critical',
            detail: 'First and second half of intervals are ' +
                    Math.round(matching / firstHalf.length * 100) + '% identical (replayed data)'
          });
          pass = false;
        }
      }

      // Check for repeated tap patterns
      if (Array.isArray(session.tap_sequence) && session.tap_sequence.length >= 10) {
        var taps = session.tap_sequence;
        var pattern = [];
        for (var j = 0; j < Math.min(5, taps.length); j++) {
          pattern.push(Math.round(taps[j].x) + ',' + Math.round(taps[j].y));
        }
        var patternStr = pattern.join('|');

        var repetitions = 0;
        for (var k = 5; k <= taps.length - 5; k += 5) {
          var chunk = [];
          for (var m = k; m < k + 5 && m < taps.length; m++) {
            chunk.push(Math.round(taps[m].x) + ',' + Math.round(taps[m].y));
          }
          if (chunk.join('|') === patternStr) repetitions++;
        }

        if (repetitions >= 2) {
          findings.push({
            check: 'duplicate_detection',
            severity: 'high',
            detail: 'Tap position pattern repeats ' + (repetitions + 1) + ' times (scripted clicks)'
          });
          pass = false;
        }
      }

      return { pass: pass, findings: findings };
    },

    // ============================================================
    // RECOMMENDATION
    // ============================================================

    _getRecommendation: function(integrity, findings) {
      if (integrity === 'valid') {
        return 'Session data passes all integrity checks. Proceed with scoring.';
      }
      if (integrity === 'suspicious') {
        return 'One integrity check flagged. Score with caution, monitor this client.';
      }
      if (integrity === 'likely_fabricated') {
        return 'Multiple integrity checks failed. Do NOT score this session. Flag for review.';
      }
      return 'Session data rejected. ' + findings.filter(function(f) {
        return f.severity === 'critical';
      }).length + ' critical issues detected.';
    }
  };

  // ============================================================
  // EXPORT
  // ============================================================

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = IntegrityValidator;
  } else if (typeof root !== 'undefined') {
    root.SWSIntegrityValidator = IntegrityValidator;
  }

})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
