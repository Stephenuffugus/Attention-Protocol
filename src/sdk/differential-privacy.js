/**
 * SWS Attention Protocol — Differential Privacy Module
 *
 * Adds mathematically guaranteed privacy to aggregate attention reports.
 * Uses calibrated Laplace noise so individual users cannot be identified
 * from published statistics.
 *
 * Critical for healthcare, insurance, and enterprise compliance where
 * individual behavioral data is sensitive.
 *
 * "We computed your compliance engagement metrics, but we literally
 * never exposed any individual's data."
 *
 * Key concepts:
 *   Epsilon (privacy budget): Lower = more privacy, more noise
 *     - epsilon=0.1: Very private (significant noise)
 *     - epsilon=1.0: Standard privacy (moderate noise)
 *     - epsilon=10:  Low privacy (minimal noise)
 *
 *   Sensitivity: Maximum change one person can cause in the result
 *     - For a mean of N people with scores 0-100: sensitivity = 100/N
 *     - For a count: sensitivity = 1
 *
 * Usage:
 *   SWSPrivacyGuard.init({ epsilon: 1.0 });
 *   SWSPrivacyGuard.privateMean(scores)       → noisy mean
 *   SWSPrivacyGuard.privateCount(items)        → noisy count
 *   SWSPrivacyGuard.privateHistogram(values, bins) → noisy distribution
 *   SWSPrivacyGuard.generatePrivateReport(sessions) → full DP report
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
(function(root) {
  'use strict';

  // ============================================================
  // CONFIGURATION
  // ============================================================

  var _config = {
    epsilon: 1.0,          // Privacy budget per query
    maxBudget: 10.0,       // Total budget before refusing queries
    budgetWindow: 86400000 // Budget reset window (24 hours in ms)
  };
  var _budgetUsed = 0;
  var _budgetWindowStart = Date.now();

  function init(opts) {
    if (opts) {
      if (opts.epsilon !== undefined) _config.epsilon = opts.epsilon;
      if (opts.maxBudget !== undefined) _config.maxBudget = opts.maxBudget;
      if (opts.budgetWindow !== undefined) _config.budgetWindow = opts.budgetWindow;
    }
    _budgetUsed = 0;
    _budgetWindowStart = Date.now();
  }

  // ============================================================
  // LAPLACE MECHANISM
  // ============================================================

  /**
   * Generate Laplace noise with location 0 and scale b.
   * Laplace(0, b) where b = sensitivity / epsilon.
   */
  function _laplace(scale) {
    // Inverse CDF method: X = -b * sign(U) * ln(1 - 2|U|) where U ~ Uniform(-0.5, 0.5)
    var u = Math.random() - 0.5;
    var sign = u < 0 ? -1 : 1;
    return -scale * sign * Math.log(1 - 2 * Math.abs(u));
  }

  /**
   * Check and spend privacy budget.
   * Returns false if budget is exhausted.
   */
  function _spendBudget(epsilon) {
    // Reset budget if window has passed
    if (Date.now() - _budgetWindowStart > _config.budgetWindow) {
      _budgetUsed = 0;
      _budgetWindowStart = Date.now();
    }

    if (_budgetUsed + epsilon > _config.maxBudget) {
      return false; // Budget exhausted
    }

    _budgetUsed += epsilon;
    return true;
  }

  // ============================================================
  // PRIVATE AGGREGATION FUNCTIONS
  // ============================================================

  /**
   * Compute a differentially private mean.
   *
   * @param {number[]} values - Array of values
   * @param {Object} opts
   * @param {number} opts.min - Minimum possible value (default: 0)
   * @param {number} opts.max - Maximum possible value (default: 1)
   * @param {number} opts.epsilon - Override epsilon for this query
   *
   * @returns {Object} { value: noisy mean, epsilon: spent, noise_magnitude: expected noise }
   */
  function privateMean(values, opts) {
    opts = opts || {};
    var epsilon = opts.epsilon || _config.epsilon;
    var min = opts.min !== undefined ? opts.min : 0;
    var max = opts.max !== undefined ? opts.max : 1;

    if (!_spendBudget(epsilon)) {
      return { value: null, error: 'privacy_budget_exhausted' };
    }

    if (values.length === 0) {
      return { value: 0, epsilon: epsilon, noise_magnitude: 0 };
    }

    // Clamp values to [min, max]
    var clamped = values.map(function(v) {
      return Math.max(min, Math.min(max, v));
    });

    // True mean
    var trueMean = clamped.reduce(function(a, b) { return a + b; }, 0) / clamped.length;

    // Sensitivity of mean = (max - min) / n
    var sensitivity = (max - min) / clamped.length;
    var scale = sensitivity / epsilon;
    var noise = _laplace(scale);

    var noisyMean = trueMean + noise;
    // Clamp result to valid range
    noisyMean = Math.max(min, Math.min(max, noisyMean));

    return {
      value: Math.round(noisyMean * 1000) / 1000,
      epsilon: epsilon,
      n: values.length,
      noise_magnitude: Math.round(scale * 1000) / 1000,
      privacy_guarantee: 'epsilon=' + epsilon + ' differential privacy'
    };
  }

  /**
   * Compute a differentially private count.
   */
  function privateCount(items, opts) {
    opts = opts || {};
    var epsilon = opts.epsilon || _config.epsilon;

    if (!_spendBudget(epsilon)) {
      return { value: null, error: 'privacy_budget_exhausted' };
    }

    var trueCount = Array.isArray(items) ? items.length : items;
    var sensitivity = 1; // One person changes count by at most 1
    var scale = sensitivity / epsilon;
    var noise = _laplace(scale);

    var noisyCount = Math.max(0, Math.round(trueCount + noise));

    return {
      value: noisyCount,
      epsilon: epsilon,
      noise_magnitude: Math.round(scale * 1000) / 1000,
      privacy_guarantee: 'epsilon=' + epsilon + ' differential privacy'
    };
  }

  /**
   * Compute a differentially private percentage/proportion.
   */
  function privatePercentage(count, total, opts) {
    opts = opts || {};
    var epsilon = opts.epsilon || _config.epsilon;

    if (!_spendBudget(epsilon)) {
      return { value: null, error: 'privacy_budget_exhausted' };
    }

    if (total === 0) return { value: 0, epsilon: epsilon, noise_magnitude: 0 };

    var truePct = count / total;
    var sensitivity = 1 / total;
    var scale = sensitivity / epsilon;
    var noise = _laplace(scale);

    var noisyPct = Math.max(0, Math.min(1, truePct + noise));

    return {
      value: Math.round(noisyPct * 1000) / 10, // As percentage
      epsilon: epsilon,
      noise_magnitude: Math.round(scale * 10000) / 100,
      privacy_guarantee: 'epsilon=' + epsilon + ' differential privacy'
    };
  }

  /**
   * Compute a differentially private histogram.
   * Each bin count gets independent Laplace noise.
   */
  function privateHistogram(values, bins, opts) {
    opts = opts || {};
    var epsilon = opts.epsilon || _config.epsilon;
    // Split epsilon across bins
    var perBinEpsilon = epsilon / bins.length;

    if (!_spendBudget(epsilon)) {
      return { value: null, error: 'privacy_budget_exhausted' };
    }

    var histogram = bins.map(function(bin) {
      var count = values.filter(function(v) {
        return v >= bin.min && v < bin.max;
      }).length;

      var scale = 1 / perBinEpsilon;
      var noise = _laplace(scale);
      var noisyCount = Math.max(0, Math.round(count + noise));

      return {
        label: bin.label || (bin.min + '-' + bin.max),
        count: noisyCount
      };
    });

    return {
      histogram: histogram,
      epsilon: epsilon,
      bins: bins.length,
      privacy_guarantee: 'epsilon=' + epsilon + ' differential privacy (split across ' + bins.length + ' bins)'
    };
  }

  // ============================================================
  // FULL PRIVATE REPORT
  // ============================================================

  /**
   * Generate a differentially private aggregate report from sessions.
   * This is what you show to clients — guaranteed individual privacy.
   *
   * @param {Object[]} sessions - Array of session objects with signals, quality_tier, etc.
   * @param {Object} opts - { epsilon: 1.0 }
   */
  function generatePrivateReport(sessions, opts) {
    opts = opts || {};
    var epsilon = opts.epsilon || _config.epsilon;
    // Budget: allocate epsilon across all queries in the report
    var queryCount = 8; // Number of distinct queries below
    var perQueryEpsilon = epsilon / queryCount;

    if (sessions.length === 0) {
      return { error: 'no_sessions', note: 'Need at least 1 session for a report' };
    }

    var composites = sessions.map(function(s) { return s.signals ? s.signals.composite : 0; });
    var durations = sessions.map(function(s) { return s.duration_sec || 0; });
    var hicks = sessions.map(function(s) { return s.signals ? s.signals.hicks : 0; });
    var deepCount = sessions.filter(function(s) { return s.quality_tier === 'deep'; }).length;
    var activeCount = sessions.filter(function(s) { return s.quality_tier === 'active'; }).length;
    var passiveCount = sessions.filter(function(s) { return s.quality_tier === 'passive'; }).length;
    var backgroundCount = sessions.filter(function(s) { return s.quality_tier === 'background'; }).length;

    var report = {
      report_type: 'SWS Differentially Private Attention Report',
      generated_at: new Date().toISOString(),
      privacy_guarantee: 'epsilon=' + epsilon + ' differential privacy',
      total_privacy_budget_used: epsilon,
      note: 'All values include calibrated noise. No individual session can be identified from these aggregates.',

      session_count: privateCount(sessions, { epsilon: perQueryEpsilon }),
      avg_composite_score: privateMean(composites, { min: 0, max: 1, epsilon: perQueryEpsilon }),
      avg_duration_sec: privateMean(durations, { min: 0, max: 3600, epsilon: perQueryEpsilon }),
      avg_hicks_compliance: privateMean(hicks, { min: 0, max: 1, epsilon: perQueryEpsilon }),
      deep_focus_rate: privatePercentage(deepCount, sessions.length, { epsilon: perQueryEpsilon }),
      active_rate: privatePercentage(activeCount, sessions.length, { epsilon: perQueryEpsilon }),
      passive_rate: privatePercentage(passiveCount, sessions.length, { epsilon: perQueryEpsilon }),
      human_verified_rate: privatePercentage(
        sessions.filter(function(s) { return s.signals && s.signals.composite >= 0.5; }).length,
        sessions.length,
        { epsilon: perQueryEpsilon }
      ),

      tier_distribution: privateHistogram(composites, [
        { min: 0, max: 0.25, label: 'Background (0-0.25)' },
        { min: 0.25, max: 0.50, label: 'Passive (0.25-0.50)' },
        { min: 0.50, max: 0.70, label: 'Active (0.50-0.70)' },
        { min: 0.70, max: 1.01, label: 'Deep Focus (0.70-1.0)' }
      ], { epsilon: perQueryEpsilon })
    };

    return report;
  }

  // ============================================================
  // BUDGET STATUS
  // ============================================================

  function getBudgetStatus() {
    // Check if window has passed
    if (Date.now() - _budgetWindowStart > _config.budgetWindow) {
      return { used: 0, remaining: _config.maxBudget, total: _config.maxBudget, window: 'fresh' };
    }
    return {
      used: Math.round(_budgetUsed * 1000) / 1000,
      remaining: Math.round((_config.maxBudget - _budgetUsed) * 1000) / 1000,
      total: _config.maxBudget,
      window_remaining_ms: _config.budgetWindow - (Date.now() - _budgetWindowStart)
    };
  }

  // ============================================================
  // EXPORT
  // ============================================================

  var PrivacyGuard = {
    init: init,
    privateMean: privateMean,
    privateCount: privateCount,
    privatePercentage: privatePercentage,
    privateHistogram: privateHistogram,
    generatePrivateReport: generatePrivateReport,
    getBudgetStatus: getBudgetStatus
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PrivacyGuard;
  } else if (typeof root !== 'undefined') {
    root.SWSPrivacyGuard = PrivacyGuard;
  }

})(typeof window !== 'undefined' ? window : this);
