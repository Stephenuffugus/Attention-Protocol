/**
 * SWS Vertical Scoring Profiles
 *
 * Same protocol, different weights per field. The behavioral signals are
 * universal — what changes is which signals matter MOST for each use case.
 *
 * A soldier's reaction time degradation matters more than scroll velocity.
 * A doctor's protocol reading comprehension matters more than mouse jitter.
 * An insurance policyholder's section-by-section dwell time matters most.
 *
 * This module provides:
 *   - Pre-built profiles for each target vertical
 *   - Custom profile creation
 *   - Multi-signal scoring with vertical-specific weights
 *   - Pass/fail thresholds per vertical
 *   - Certification-grade output (for compliance/legal use)
 *
 * Verticals:
 *   MILITARY    — vigilance, reaction time, sustained focus, fatigue resistance
 *   MEDICAL     — protocol compliance, precision, shift endurance, alert response
 *   INSURANCE   — document reading, section coverage, comprehension indicators
 *   EDUCATION   — sustained engagement, temporal consistency, completion quality
 *   WORKPLACE   — operator alertness, safety compliance, task focus
 *   ADVERTISING — view completion, genuine attention, bot detection
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
(function(root) {
  'use strict';

  // ============================================================
  // BUILT-IN VERTICAL PROFILES
  // ============================================================

  var PROFILES = {
    military: {
      name: 'Military Readiness',
      description: 'Optimized for vigilance, reaction time, sustained focus, and fatigue detection',
      weights: {
        reactionTime: 0.25,       // Critical — slow RT = danger
        reactionTimeConsistency: 0.15, // Variance in RT = fatigue
        clickPrecision: 0.15,     // Motor control degradation
        sustainedFocus: 0.20,     // Can they maintain attention over long periods?
        documentComprehension: 0.10, // Did they read the briefing?
        fatigueResistance: 0.15   // How much have they degraded from baseline?
      },
      thresholds: {
        pass: 0.70,               // Military standard is high
        marginal: 0.55,
        fail: 0.40
      },
      alerts: {
        reactionTimeDrift: 0.30,  // 30% RT increase = alert
        precisionDrift: 0.25,     // 25% precision loss = alert
        sustainedFocusMin: 0.60   // Must maintain 60% focus score
      },
      certificationLevel: 'mission_critical',
      scifCompatible: true,       // No PII, no network required
      offlineCapable: true
    },

    medical: {
      name: 'Medical Shift Monitor',
      description: 'Optimized for shift endurance, protocol compliance, and precision under fatigue',
      weights: {
        reactionTime: 0.15,
        reactionTimeConsistency: 0.10,
        clickPrecision: 0.20,     // Precision is life-critical in medical
        sustainedFocus: 0.15,
        documentComprehension: 0.20, // Protocol reading is mandatory
        fatigueResistance: 0.20   // Shift endurance is the core metric
      },
      thresholds: {
        pass: 0.65,
        marginal: 0.50,
        fail: 0.35
      },
      alerts: {
        reactionTimeDrift: 0.35,
        precisionDrift: 0.20,     // Tighter precision threshold for medical
        sustainedFocusMin: 0.55,
        shiftHoursWarning: 8,     // Alert after 8 hours
        shiftHoursCritical: 12    // Critical after 12 hours
      },
      certificationLevel: 'patient_safety',
      hipaaCompliant: true,
      offlineCapable: true
    },

    insurance: {
      name: 'Insurance Policy Verification',
      description: 'Optimized for document reading proof, section coverage, and comprehension indicators',
      weights: {
        reactionTime: 0.05,       // Less important for document reading
        reactionTimeConsistency: 0.05,
        clickPrecision: 0.05,
        sustainedFocus: 0.10,
        documentComprehension: 0.50, // THIS IS THE POINT — did they read it?
        fatigueResistance: 0.05,
        sectionCoverage: 0.20     // Did they read ALL sections?
      },
      thresholds: {
        pass: 0.60,               // "Read" threshold
        marginal: 0.40,           // "Skimmed"
        fail: 0.20                // "Not read"
      },
      alerts: {
        minSectionsRead: 0.80,    // Must read 80% of sections
        minDwellPerSection: 5000, // At least 5s per section
        scrollToBotomOnly: true   // Flag if they just scrolled to bottom
      },
      certificationLevel: 'compliance',
      legallyBindable: true       // Can be used as proof in disputes
    },

    education: {
      name: 'Education Engagement',
      description: 'Optimized for sustained engagement, temporal consistency, and completion quality',
      weights: {
        reactionTime: 0.10,
        reactionTimeConsistency: 0.10,
        clickPrecision: 0.05,
        sustainedFocus: 0.25,     // Did they stay engaged the whole time?
        documentComprehension: 0.25, // Reading/course material engagement
        fatigueResistance: 0.15,
        temporalConsistency: 0.10 // Consistent effort throughout
      },
      thresholds: {
        pass: 0.60,
        marginal: 0.45,
        fail: 0.25
      },
      alerts: {
        tabSwitchMax: 5,          // Flag excessive tab switching
        inactivityGapMax: 120000, // 2 min gap = flagged
        minimumSessionTime: 0.70  // Must spend 70% of expected time
      },
      certificationLevel: 'academic',
      proctoringCompatible: true
    },

    workplace: {
      name: 'Workplace Safety & Alertness',
      description: 'Optimized for operator alertness, safety compliance, and task focus',
      weights: {
        reactionTime: 0.20,
        reactionTimeConsistency: 0.15,
        clickPrecision: 0.15,
        sustainedFocus: 0.20,
        documentComprehension: 0.15, // Safety manual reading
        fatigueResistance: 0.15
      },
      thresholds: {
        pass: 0.65,
        marginal: 0.50,
        fail: 0.35
      },
      alerts: {
        reactionTimeDrift: 0.35,
        shiftHoursWarning: 10,
        shiftHoursCritical: 14
      },
      certificationLevel: 'osha_compliance',
      offlineCapable: true
    },

    advertising: {
      name: 'Ad Verification',
      description: 'Optimized for view completion, genuine attention proof, and bot detection',
      weights: {
        reactionTime: 0.05,
        reactionTimeConsistency: 0.05,
        clickPrecision: 0.05,
        sustainedFocus: 0.15,
        documentComprehension: 0.05,
        fatigueResistance: 0.05,
        videoCompletion: 0.25,    // Did they watch the whole ad?
        botDetection: 0.20,       // Is this a real person?
        tabFocus: 0.15            // Was the tab in focus during playback?
      },
      thresholds: {
        pass: 0.55,
        marginal: 0.35,
        fail: 0.20
      },
      alerts: {
        tabHiddenDuringVideo: true,
        zeroActivityDuringPlay: true,
        impossibleCompletionSpeed: true
      },
      certificationLevel: 'viewability',
      mrcCompliant: true          // Media Rating Council standards
    }
  };

  // ============================================================
  // SCORING ENGINE
  // ============================================================

  /**
   * Score a session using a vertical profile.
   *
   * @param {string|object} profile - Profile name or custom profile object
   * @param {object} signals - The raw signal scores (0-1 each)
   *   { reactionTime, reactionTimeConsistency, clickPrecision,
   *     sustainedFocus, documentComprehension, fatigueResistance,
   *     sectionCoverage, temporalConsistency, videoCompletion,
   *     botDetection, tabFocus }
   * @returns {object} Scored result with vertical-specific verdict
   */
  function score(profile, signals) {
    // Resolve profile
    var p;
    if (typeof profile === 'string') {
      p = PROFILES[profile];
      if (!p) {
        return { error: 'Unknown profile: ' + profile, validProfiles: Object.keys(PROFILES) };
      }
    } else {
      p = profile;
    }

    if (!signals || typeof signals !== 'object') {
      return { error: 'Signals object required' };
    }

    // Compute weighted score
    var weightedSum = 0;
    var totalWeight = 0;
    var signalDetails = {};

    for (var signalName in p.weights) {
      if (p.weights.hasOwnProperty(signalName)) {
        var weight = p.weights[signalName];
        var value = (signals[signalName] !== undefined && signals[signalName] !== null)
                    ? Math.min(1, Math.max(0, signals[signalName]))
                    : null;

        if (value !== null) {
          weightedSum += value * weight;
          totalWeight += weight;
          signalDetails[signalName] = {
            value: Math.round(value * 1000) / 1000,
            weight: weight,
            contribution: Math.round(value * weight * 1000) / 1000
          };
        } else {
          signalDetails[signalName] = {
            value: null,
            weight: weight,
            contribution: 0,
            missing: true
          };
        }
      }
    }

    // Normalize by total weight of available signals
    var composite = totalWeight > 0 ? weightedSum / totalWeight : 0;
    composite = Math.round(composite * 1000) / 1000;

    // Determine pass/fail
    var verdict;
    if (composite >= p.thresholds.pass) {
      verdict = 'pass';
    } else if (composite >= p.thresholds.marginal) {
      verdict = 'marginal';
    } else {
      verdict = 'fail';
    }

    // Check alerts
    var alerts = [];
    if (p.alerts) {
      if (p.alerts.reactionTimeDrift && signals.fatigueResistance !== undefined) {
        var driftAmount = 1 - signals.fatigueResistance;
        if (driftAmount > p.alerts.reactionTimeDrift) {
          alerts.push({
            type: 'reaction_time_drift',
            severity: driftAmount > p.alerts.reactionTimeDrift * 2 ? 'critical' : 'warning',
            detail: 'Reaction time degraded ' + Math.round(driftAmount * 100) + '% from baseline'
          });
        }
      }

      if (p.alerts.precisionDrift && signals.clickPrecision !== undefined) {
        if (signals.clickPrecision < (1 - p.alerts.precisionDrift)) {
          alerts.push({
            type: 'precision_drift',
            severity: 'warning',
            detail: 'Click precision below threshold'
          });
        }
      }

      if (p.alerts.sustainedFocusMin && signals.sustainedFocus !== undefined) {
        if (signals.sustainedFocus < p.alerts.sustainedFocusMin) {
          alerts.push({
            type: 'focus_below_minimum',
            severity: 'warning',
            detail: 'Sustained focus ' + Math.round(signals.sustainedFocus * 100) +
                    '% below minimum ' + Math.round(p.alerts.sustainedFocusMin * 100) + '%'
          });
        }
      }

      if (p.alerts.minSectionsRead && signals.sectionCoverage !== undefined) {
        if (signals.sectionCoverage < p.alerts.minSectionsRead) {
          alerts.push({
            type: 'incomplete_reading',
            severity: 'warning',
            detail: 'Only ' + Math.round(signals.sectionCoverage * 100) +
                    '% of sections read (minimum: ' + Math.round(p.alerts.minSectionsRead * 100) + '%)'
          });
        }
      }

      if (p.alerts.tabHiddenDuringVideo && signals.tabFocus !== undefined && signals.tabFocus < 0.5) {
        alerts.push({
          type: 'tab_hidden_during_video',
          severity: 'critical',
          detail: 'Tab was hidden for ' + Math.round((1 - signals.tabFocus) * 100) + '% of video playback'
        });
      }

      if (p.alerts.zeroActivityDuringPlay && signals.videoActivity !== undefined && signals.videoActivity < 0.1) {
        alerts.push({
          type: 'zero_activity_during_video',
          severity: 'high',
          detail: 'No user activity detected during video playback'
        });
      }
    }

    return {
      profile: p.name,
      vertical: typeof profile === 'string' ? profile : 'custom',
      composite: composite,
      verdict: verdict,
      certificationLevel: p.certificationLevel || 'standard',
      signals: signalDetails,
      alerts: alerts,
      thresholds: p.thresholds,
      metadata: {
        scifCompatible: p.scifCompatible || false,
        hipaaCompliant: p.hipaaCompliant || false,
        legallyBindable: p.legallyBindable || false,
        offlineCapable: p.offlineCapable || false,
        mrcCompliant: p.mrcCompliant || false,
        proctoringCompatible: p.proctoringCompatible || false
      }
    };
  }

  // ============================================================
  // MULTI-VERTICAL SCORING
  // ============================================================

  /**
   * Score the same signals across ALL verticals at once.
   * Shows how one session maps to every possible use case.
   */
  function scoreAllVerticals(signals) {
    var results = {};
    for (var verticalName in PROFILES) {
      if (PROFILES.hasOwnProperty(verticalName)) {
        results[verticalName] = score(verticalName, signals);
      }
    }
    return results;
  }

  /**
   * Generate a certification report for a specific vertical.
   */
  function generateCertification(profileName, signals, metadata) {
    var result = score(profileName, signals);
    if (result.error) return result;

    metadata = metadata || {};

    return {
      certification: {
        protocol: 'SWS Proof of Attention Protocol',
        version: '1.0',
        issuer: 'SWS Strategic Media LLC',
        patent: 'SWS-PROV-001',
        generated_at: new Date().toISOString(),

        subject: metadata.subjectId || 'anonymous',
        context: metadata.context || 'unspecified',
        vertical: profileName,
        profile: result.profile,

        result: {
          composite: result.composite,
          verdict: result.verdict,
          certification_level: result.certificationLevel,
          alerts_count: result.alerts.length,
          critical_alerts: result.alerts.filter(function(a) { return a.severity === 'critical'; }).length
        },

        compliance: result.metadata,

        signals: result.signals,
        alerts: result.alerts,

        legal_notice: profileName === 'insurance' ?
          'This attention verification receipt may be used as evidence that the subject was presented with and engaged with the referenced document.' :
          profileName === 'medical' ?
          'This report is intended as a supplementary alertness indicator and does not constitute a medical assessment.' :
          profileName === 'military' ?
          'SCIF-compatible. No personally identifiable information is collected or transmitted.' :
          'This attention verification receipt is generated by the SWS Proof of Attention Protocol.'
      }
    };
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  var VerticalProfiles = {
    score: score,
    scoreAllVerticals: scoreAllVerticals,
    generateCertification: generateCertification,

    getProfile: function(name) {
      return PROFILES[name] || null;
    },

    getProfileNames: function() {
      return Object.keys(PROFILES);
    },

    /**
     * Create a custom profile.
     */
    createProfile: function(name, config) {
      if (!config.weights || !config.thresholds) {
        return { error: 'Custom profiles require weights and thresholds' };
      }
      PROFILES[name] = config;
      return { success: true, profile: name };
    },

    PROFILES: PROFILES
  };

  // ============================================================
  // EXPORT
  // ============================================================

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = VerticalProfiles;
  } else if (typeof root !== 'undefined') {
    root.SWSVerticalProfiles = VerticalProfiles;
  }

})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
