/**
 * Differential Privacy — Test Suite
 *
 * Tests the privacy-preserving aggregation system.
 * Verifies that noise is added, budget is tracked, and
 * aggregate reports protect individual data.
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */

const DP = require('../src/sdk/differential-privacy');

describe('Differential Privacy Module', () => {

  beforeEach(() => {
    DP.init({ epsilon: 1.0, maxBudget: 100.0 });
  });

  // ----------------------------------------------------------
  // BASIC OPERATIONS
  // ----------------------------------------------------------

  describe('Private Mean', () => {
    test('returns a value close to true mean for large datasets', () => {
      // With 1000 values, noise is very small relative to the mean
      var values = [];
      for (var i = 0; i < 1000; i++) values.push(0.7 + (Math.random() - 0.5) * 0.2);
      var result = DP.privateMean(values, { min: 0, max: 1 });

      expect(result.value).toBeGreaterThan(0.5);
      expect(result.value).toBeLessThan(0.9);
      expect(result.epsilon).toBe(1.0);
      expect(result.privacy_guarantee).toContain('differential privacy');
    });

    test('adds measurable noise for small datasets', () => {
      // With 5 values, noise is significant
      var values = [0.7, 0.7, 0.7, 0.7, 0.7];
      var results = [];
      for (var i = 0; i < 20; i++) {
        DP.init({ epsilon: 1.0, maxBudget: 100 });
        results.push(DP.privateMean(values, { min: 0, max: 1 }).value);
      }
      // Not all results should be exactly 0.7 (noise added)
      var unique = new Set(results.map(r => r.toFixed(3)));
      expect(unique.size).toBeGreaterThan(1);
    });

    test('clamps result to valid range', () => {
      var result = DP.privateMean([0.01, 0.01, 0.01], { min: 0, max: 1 });
      expect(result.value).toBeGreaterThanOrEqual(0);
      expect(result.value).toBeLessThanOrEqual(1);
    });

    test('handles empty array', () => {
      var result = DP.privateMean([], { min: 0, max: 1 });
      expect(result.value).toBe(0);
    });

    test('reports noise magnitude', () => {
      var result = DP.privateMean([0.5, 0.5, 0.5], { min: 0, max: 1, epsilon: 1.0 });
      expect(result.noise_magnitude).toBeGreaterThan(0);
    });
  });

  describe('Private Count', () => {
    test('returns count close to true count', () => {
      var items = new Array(100).fill(1);
      var result = DP.privateCount(items);
      expect(result.value).toBeGreaterThan(90);
      expect(result.value).toBeLessThan(110);
    });

    test('accepts numeric input', () => {
      var result = DP.privateCount(50);
      expect(result.value).toBeGreaterThan(40);
      expect(result.value).toBeLessThan(60);
    });

    test('never returns negative', () => {
      var result = DP.privateCount(0);
      expect(result.value).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Private Percentage', () => {
    test('returns percentage close to true value', () => {
      var result = DP.privatePercentage(75, 100);
      expect(result.value).toBeGreaterThan(60);
      expect(result.value).toBeLessThan(90);
    });

    test('handles zero total', () => {
      var result = DP.privatePercentage(0, 0);
      expect(result.value).toBe(0);
    });
  });

  describe('Private Histogram', () => {
    test('produces histogram with correct number of bins', () => {
      var values = [0.1, 0.3, 0.5, 0.7, 0.9, 0.2, 0.4, 0.6, 0.8, 0.95];
      var bins = [
        { min: 0, max: 0.25, label: 'Low' },
        { min: 0.25, max: 0.50, label: 'Medium' },
        { min: 0.50, max: 0.75, label: 'High' },
        { min: 0.75, max: 1.01, label: 'Very High' }
      ];

      var result = DP.privateHistogram(values, bins);
      expect(result.histogram).toHaveLength(4);
      expect(result.histogram[0].label).toBe('Low');
      // Total should be roughly 10 (with noise)
      var total = result.histogram.reduce((s, b) => s + b.count, 0);
      expect(total).toBeGreaterThan(5);
      expect(total).toBeLessThan(20);
    });
  });

  // ----------------------------------------------------------
  // PRIVACY BUDGET
  // ----------------------------------------------------------

  describe('Privacy Budget', () => {
    test('tracks budget usage', () => {
      DP.init({ epsilon: 1.0, maxBudget: 5.0 });
      DP.privateMean([1, 2, 3], { min: 0, max: 10 });
      var status = DP.getBudgetStatus();
      expect(status.used).toBe(1.0);
      expect(status.remaining).toBe(4.0);
    });

    test('exhausts budget after many queries', () => {
      DP.init({ epsilon: 1.0, maxBudget: 3.0 });
      DP.privateMean([1], { min: 0, max: 1 }); // spends 1.0
      DP.privateMean([1], { min: 0, max: 1 }); // spends 1.0
      DP.privateMean([1], { min: 0, max: 1 }); // spends 1.0
      var result = DP.privateMean([1], { min: 0, max: 1 }); // should fail
      expect(result.error).toBe('privacy_budget_exhausted');
    });
  });

  // ----------------------------------------------------------
  // FULL PRIVATE REPORT
  // ----------------------------------------------------------

  describe('Private Report Generation', () => {
    test('generates full report from sessions', () => {
      var sessions = [];
      for (var i = 0; i < 50; i++) {
        sessions.push({
          signals: {
            composite: 0.5 + Math.random() * 0.3,
            hicks: 0.6 + Math.random() * 0.3
          },
          duration_sec: 60 + Math.random() * 120,
          quality_tier: ['deep', 'active', 'passive', 'background'][Math.floor(Math.random() * 4)]
        });
      }

      var report = DP.generatePrivateReport(sessions, { epsilon: 2.0 });

      expect(report.report_type).toBe('SWS Differentially Private Attention Report');
      expect(report.privacy_guarantee).toContain('epsilon=2');
      expect(report.session_count.value).toBeGreaterThan(40);
      expect(report.session_count.value).toBeLessThan(60);
      expect(report.avg_composite_score.value).toBeGreaterThan(0.3);
      expect(report.avg_composite_score.value).toBeLessThan(1.0);
      expect(report.tier_distribution.histogram).toHaveLength(4);

      console.log('\n  === DIFFERENTIALLY PRIVATE REPORT ===');
      console.log('  Sessions:', report.session_count.value, '(true: 50)');
      console.log('  Avg Composite:', report.avg_composite_score.value);
      console.log('  Deep Focus Rate:', report.deep_focus_rate.value + '%');
      console.log('  Human Verified:', report.human_verified_rate.value + '%');
      console.log('  Privacy:', report.privacy_guarantee);
      console.log('  =====================================\n');
    });

    test('handles empty sessions', () => {
      var report = DP.generatePrivateReport([]);
      expect(report.error).toBe('no_sessions');
    });

    test('more epsilon = less noise', () => {
      var sessions = [];
      for (var i = 0; i < 100; i++) {
        sessions.push({ signals: { composite: 0.7, hicks: 0.8 }, duration_sec: 90, quality_tier: 'deep' });
      }

      // Low epsilon = more noise
      DP.init({ epsilon: 0.1, maxBudget: 100 });
      var lowEps = DP.generatePrivateReport(sessions, { epsilon: 0.1 });

      // High epsilon = less noise
      DP.init({ epsilon: 10.0, maxBudget: 100 });
      var highEps = DP.generatePrivateReport(sessions, { epsilon: 10.0 });

      // High epsilon should be closer to true mean (0.7)
      expect(Math.abs(highEps.avg_composite_score.value - 0.7))
        .toBeLessThanOrEqual(Math.abs(lowEps.avg_composite_score.value - 0.7) + 0.1);
    });
  });
});
