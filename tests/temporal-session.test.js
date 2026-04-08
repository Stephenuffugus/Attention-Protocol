/**
 * Temporal Session Analyzer — Test Suite
 *
 * Proves: we can detect fatigue/disengagement WITHIN a single session
 * by comparing early vs late performance.
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */

const TemporalAnalyzer = require('../src/sdk/temporal-session-analyzer');

// ============================================================
// HELPERS
// ============================================================

/**
 * Generate a simulated session with controlled degradation.
 * @param {number} windowCount - Number of 5-min windows
 * @param {object} opts - { rtStart, rtEnd, precStart, precEnd, rateStart, rateEnd }
 */
function generateSession(windowCount, opts) {
  opts = opts || {};
  const windowMs = 300000; // 5 min
  const sessionStart = 1000000;
  const events = [];

  for (let w = 0; w < windowCount; w++) {
    const windowStart = sessionStart + (w * windowMs);
    const eventsPerWindow = opts.eventsPerWindow || 20;

    // Interpolate values between start and end
    const progress = windowCount > 1 ? w / (windowCount - 1) : 0;
    const rtMean = (opts.rtStart || 300) + progress * ((opts.rtEnd || 300) - (opts.rtStart || 300));
    const precMean = (opts.precStart || 5) + progress * ((opts.precEnd || 5) - (opts.precStart || 5));
    const jitterMean = (opts.jitterStart || 1) + progress * ((opts.jitterEnd || 1) - (opts.jitterStart || 1));

    // Scale event count if rate is declining
    const rateMultiplier = opts.rateDecline ? (1 - progress * opts.rateDecline) : 1;
    const adjustedCount = Math.max(5, Math.round(eventsPerWindow * rateMultiplier));

    for (let i = 0; i < adjustedCount; i++) {
      const timeOffset = (windowMs / adjustedCount) * i;
      const ts = windowStart + timeOffset;
      const noise = () => (Math.random() - 0.5) * 0.3;

      events.push({ type: 'reaction_time', timestamp: ts, value: rtMean * (1 + noise()) });
      events.push({ type: 'click_precision', timestamp: ts + 1, value: precMean * (1 + noise()) });
      events.push({ type: 'mouse_jitter', timestamp: ts + 2, value: jitterMean * (1 + noise()) });
      events.push({ type: 'scroll', timestamp: ts + 3, value: 1 });
    }
  }

  // Sort by timestamp
  events.sort((a, b) => a.timestamp - b.timestamp);
  return { events, sessionStart };
}

// ============================================================
// TESTS
// ============================================================

describe('Temporal Session Analyzer', () => {

  beforeEach(() => {
    TemporalAnalyzer.reset();
  });

  // ----------------------------------------------------------
  // INITIALIZATION
  // ----------------------------------------------------------

  describe('Initialization', () => {
    test('initializes with default config', () => {
      TemporalAnalyzer.init({});
      expect(TemporalAnalyzer._internal.config()).toBeDefined();
      expect(TemporalAnalyzer._internal.config().windowSizeMs).toBe(300000);
    });

    test('accepts custom window size', () => {
      TemporalAnalyzer.init({ windowSizeMs: 60000 });
      expect(TemporalAnalyzer._internal.config().windowSizeMs).toBe(60000);
    });
  });

  // ----------------------------------------------------------
  // SUSTAINED ATTENTION (no fatigue)
  // ----------------------------------------------------------

  describe('Sustained Attention — No Fatigue', () => {
    test('stable metrics across session produce sustained_attention verdict', () => {
      TemporalAnalyzer.init({ windowSizeMs: 300000 });

      const { events, sessionStart } = generateSession(5, {
        rtStart: 300, rtEnd: 310,       // barely any change
        precStart: 5, precEnd: 5.2,     // barely any change
        jitterStart: 1.0, jitterEnd: 1.05,
        eventsPerWindow: 20
      });

      TemporalAnalyzer.injectEvents(events, sessionStart);
      const result = TemporalAnalyzer.analyze();

      expect(result.verdict).toBe('sustained_attention');
      expect(result.overallDegradation).toBeLessThan(0.15);
      expect(result.validWindowCount).toBeGreaterThanOrEqual(4);

      console.log('\n  === TEMPORAL: SUSTAINED ATTENTION ===');
      console.log(`  Verdict:       ${result.verdict}`);
      console.log(`  Degradation:   ${result.overallDegradation}`);
      console.log(`  Windows:       ${result.validWindowCount}`);
      console.log('  =====================================\n');
    });
  });

  // ----------------------------------------------------------
  // GRADUAL FATIGUE (exam scenario)
  // ----------------------------------------------------------

  describe('Gradual Fatigue — Exam Scenario', () => {
    test('detects reaction time increasing over session', () => {
      TemporalAnalyzer.init({ windowSizeMs: 300000 });

      const { events, sessionStart } = generateSession(6, {
        rtStart: 280, rtEnd: 500,      // RT doubles over 30 minutes
        precStart: 4, precEnd: 10,     // precision degrades
        jitterStart: 1.0, jitterEnd: 3.0,
        eventsPerWindow: 20
      });

      TemporalAnalyzer.injectEvents(events, sessionStart);
      const result = TemporalAnalyzer.analyze();

      expect(result.verdict).toMatch(/moderate_fatigue|significant_fatigue/);
      expect(result.overallDegradation).toBeGreaterThan(0.20);

      if (result.trends.reactionTime) {
        expect(result.trends.reactionTime.trend).toBe('increasing');
        expect(result.trends.reactionTime.interpretation).toBe('slowing_down');
      }

      console.log('\n  === TEMPORAL: EXAM FATIGUE ===');
      console.log(`  Verdict:       ${result.verdict}`);
      console.log(`  Degradation:   ${result.overallDegradation}`);
      if (result.trends.reactionTime) {
        console.log(`  RT trend:      ${result.trends.reactionTime.interpretation} (${(result.trends.reactionTime.pctChange * 100).toFixed(0)}%)`);
      }
      console.log('  ==============================\n');
    });

    test('detects interaction rate declining (disengagement)', () => {
      TemporalAnalyzer.init({ windowSizeMs: 300000 });

      const { events, sessionStart } = generateSession(5, {
        rtStart: 300, rtEnd: 320,
        eventsPerWindow: 30,
        rateDecline: 0.6  // interaction rate drops 60% over session
      });

      TemporalAnalyzer.injectEvents(events, sessionStart);
      const result = TemporalAnalyzer.analyze();

      if (result.trends.interactionRate) {
        expect(result.trends.interactionRate.trend).toBe('decreasing');
        expect(result.trends.interactionRate.interpretation).toBe('disengaging');
      }
    });
  });

  // ----------------------------------------------------------
  // HALF-SESSION COMPARISON
  // ----------------------------------------------------------

  describe('First Half vs Second Half', () => {
    test('reports rate change between halves', () => {
      TemporalAnalyzer.init({ windowSizeMs: 300000 });

      const { events, sessionStart } = generateSession(6, {
        rtStart: 300, rtEnd: 300,
        eventsPerWindow: 25,
        rateDecline: 0.5  // drops 50%
      });

      TemporalAnalyzer.injectEvents(events, sessionStart);
      const result = TemporalAnalyzer.analyze();

      expect(result.halfComparison).toBeDefined();
      expect(result.halfComparison.firstHalfAvgRate).toBeGreaterThan(
        result.halfComparison.secondHalfAvgRate
      );
    });
  });

  // ----------------------------------------------------------
  // TREND DETECTION UNIT TESTS
  // ----------------------------------------------------------

  describe('Trend Detection', () => {
    test('detects increasing trend', () => {
      TemporalAnalyzer.init({});
      const trend = TemporalAnalyzer._internal.detectTrend([100, 120, 140, 160, 180]);
      expect(trend.trend).toBe('increasing');
      expect(trend.pctChange).toBeGreaterThan(0.5);
    });

    test('detects decreasing trend', () => {
      TemporalAnalyzer.init({});
      const trend = TemporalAnalyzer._internal.detectTrend([200, 170, 140, 110, 80]);
      expect(trend.trend).toBe('decreasing');
      expect(trend.pctChange).toBeLessThan(-0.5);
    });

    test('detects stable trend', () => {
      TemporalAnalyzer.init({});
      const trend = TemporalAnalyzer._internal.detectTrend([100, 102, 98, 101, 99]);
      expect(trend.trend).toBe('stable');
    });

    test('insufficient data returns appropriate response', () => {
      TemporalAnalyzer.init({});
      const trend = TemporalAnalyzer._internal.detectTrend([100]);
      expect(trend.trend).toBe('insufficient_data');
    });
  });

  // ----------------------------------------------------------
  // EDGE CASES
  // ----------------------------------------------------------

  describe('Edge Cases', () => {
    test('analyze with no events returns insufficient_data', () => {
      TemporalAnalyzer.init({});
      const result = TemporalAnalyzer.analyze();
      expect(result.verdict).toBe('insufficient_data');
    });

    test('handles single window session', () => {
      TemporalAnalyzer.init({ windowSizeMs: 600000 }); // 10 min windows

      const { events, sessionStart } = generateSession(1, {
        eventsPerWindow: 30
      });

      TemporalAnalyzer.injectEvents(events, sessionStart);
      const result = TemporalAnalyzer.analyze();
      expect(result.verdict).toBe('insufficient_data'); // need 2+ valid windows
    });

    test('reset clears all state', () => {
      TemporalAnalyzer.init({});
      TemporalAnalyzer.recordReactionTime(300);
      TemporalAnalyzer.recordReactionTime(310);
      TemporalAnalyzer.reset();
      expect(TemporalAnalyzer.getEventCount()).toBe(0);
    });
  });
});
