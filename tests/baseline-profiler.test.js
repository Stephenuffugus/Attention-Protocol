/**
 * Baseline Profiler & Drift Detector — Test Suite
 *
 * Tests the performance degradation detection engine.
 * Proves: we can detect when a soldier, doctor, or operator
 * is about to underperform based on behavioral signal drift.
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */

const BaselineProfiler = require('../src/sdk/baseline-profiler');

// ============================================================
// HELPERS
// ============================================================

function generateReactionTimes(mean, variance, count) {
  const times = [];
  for (let i = 0; i < count; i++) {
    // Simple normal-ish distribution
    const noise = (Math.random() - 0.5) * 2 * variance;
    times.push(Math.max(50, mean + noise));
  }
  return times;
}

function generateClickPrecisions(mean, variance, count) {
  const precs = [];
  for (let i = 0; i < count; i++) {
    const noise = (Math.random() - 0.5) * 2 * variance;
    precs.push(Math.max(0, mean + noise));
  }
  return precs;
}

function feedBaseline(profiler, opts) {
  opts = opts || {};
  const rtMean = opts.reactionTimeMean || 300;
  const rtVariance = opts.reactionTimeVariance || 50;
  const precMean = opts.precisionMean || 5;
  const precVariance = opts.precisionVariance || 2;
  const count = opts.count || 25;

  profiler.startBaseline();

  const rts = generateReactionTimes(rtMean, rtVariance, count);
  rts.forEach(rt => profiler.recordReactionTime(rt));

  const precs = generateClickPrecisions(precMean, precVariance, count);
  precs.forEach(p => profiler.recordClickPrecision(p));

  // Scroll events
  for (let i = 0; i < count; i++) {
    profiler.recordScroll();
  }

  // Mouse positions (smooth path)
  for (let i = 0; i < count; i++) {
    profiler.recordMousePosition(100 + i * 5, 200 + i * 2);
  }

  // Decision speeds
  const ds = generateReactionTimes(opts.decisionMean || 500, 100, Math.min(count, 15));
  ds.forEach(d => profiler.recordDecisionSpeed(d));
}

// ============================================================
// TESTS
// ============================================================

describe('Baseline Profiler & Drift Detector', () => {

  beforeEach(() => {
    BaselineProfiler.reset();
  });

  // ----------------------------------------------------------
  // INITIALIZATION & PHASES
  // ----------------------------------------------------------

  describe('Initialization', () => {
    test('starts in idle phase', () => {
      BaselineProfiler.init({});
      expect(BaselineProfiler.getPhase()).toBe('idle');
    });

    test('transitions to baseline phase on startBaseline', () => {
      BaselineProfiler.init({});
      BaselineProfiler.startBaseline();
      expect(BaselineProfiler.getPhase()).toBe('baseline');
    });

    test('baseline is null before locking', () => {
      BaselineProfiler.init({});
      expect(BaselineProfiler.getBaseline()).toBeNull();
    });

    test('accepts custom thresholds', () => {
      BaselineProfiler.init({ reactionTimeDriftThreshold: 0.5 });
      expect(BaselineProfiler._internal.config().reactionTimeDriftThreshold).toBe(0.5);
    });
  });

  // ----------------------------------------------------------
  // BASELINE COLLECTION
  // ----------------------------------------------------------

  describe('Baseline Collection', () => {
    test('collects reaction times during baseline phase', () => {
      BaselineProfiler.init({ baselineMinSamples: 5, baselineWindowMs: 0 });
      BaselineProfiler.startBaseline();

      for (let i = 0; i < 10; i++) {
        BaselineProfiler.recordReactionTime(300 + Math.random() * 100);
      }

      expect(BaselineProfiler._internal.baseline().reactionTimes.length).toBe(10);
    });

    test('collects click precisions during baseline phase', () => {
      BaselineProfiler.init({ baselineMinSamples: 5, baselineWindowMs: 0 });
      BaselineProfiler.startBaseline();

      for (let i = 0; i < 8; i++) {
        BaselineProfiler.recordClickPrecision(5 + Math.random() * 3);
      }

      expect(BaselineProfiler._internal.baseline().clickPrecisions.length).toBe(8);
    });

    test('manual lockBaseline computes stats', () => {
      BaselineProfiler.init({ baselineMinSamples: 5, baselineWindowMs: 0 });
      feedBaseline(BaselineProfiler, { count: 25 });

      const locked = BaselineProfiler.lockBaseline();
      expect(locked).toBe(true);
      expect(BaselineProfiler.getPhase()).toBe('monitoring');

      const stats = BaselineProfiler.getBaseline();
      expect(stats).toBeDefined();
      expect(stats.reactionTime.mean).toBeGreaterThan(0);
      expect(stats.reactionTime.count).toBe(25);
    });

    test('lockBaseline fails with insufficient samples', () => {
      BaselineProfiler.init({ baselineMinSamples: 50, baselineWindowMs: 0 });
      BaselineProfiler.startBaseline();

      BaselineProfiler.recordReactionTime(300);
      BaselineProfiler.recordReactionTime(310);

      const locked = BaselineProfiler.lockBaseline();
      expect(locked).toBe(false);
      expect(BaselineProfiler.getPhase()).toBe('baseline');
    });
  });

  // ----------------------------------------------------------
  // BASELINE STATS ACCURACY
  // ----------------------------------------------------------

  describe('Baseline Statistics', () => {
    test('mean calculation is accurate', () => {
      const mean = BaselineProfiler._internal.mean([100, 200, 300, 400, 500]);
      expect(mean).toBe(300);
    });

    test('standard deviation calculation is accurate', () => {
      const sd = BaselineProfiler._internal.stddev([2, 4, 4, 4, 5, 5, 7, 9]);
      expect(sd).toBeCloseTo(2.0, 1);
    });

    test('coefficient of variation is accurate', () => {
      const cv = BaselineProfiler._internal.cv([10, 10, 10, 10]); // zero variance
      expect(cv).toBe(0);

      const cv2 = BaselineProfiler._internal.cv([5, 10, 15, 20]);
      expect(cv2).toBeGreaterThan(0);
    });

    test('median calculation is accurate', () => {
      expect(BaselineProfiler._internal.median([1, 3, 5, 7, 9])).toBe(5);
      expect(BaselineProfiler._internal.median([1, 3, 5, 7])).toBe(4);
    });
  });

  // ----------------------------------------------------------
  // DRIFT DETECTION — NORMAL PERFORMANCE
  // ----------------------------------------------------------

  describe('Normal Performance — No Drift', () => {
    test('reports normal when current matches baseline', () => {
      BaselineProfiler.init({ baselineMinSamples: 5, baselineWindowMs: 0 });
      feedBaseline(BaselineProfiler, { reactionTimeMean: 300, count: 25 });
      BaselineProfiler.lockBaseline();

      // Current performance similar to baseline
      for (let i = 0; i < 10; i++) {
        BaselineProfiler.recordReactionTime(300 + (Math.random() - 0.5) * 60);
        BaselineProfiler.recordClickPrecision(5 + (Math.random() - 0.5) * 2);
        BaselineProfiler.recordScroll();
        BaselineProfiler.recordMousePosition(100 + i * 5, 200 + i * 2);
      }

      const drift = BaselineProfiler.getDrift();
      expect(drift.level).toBe('normal');
      expect(drift.driftScore).toBeLessThan(0.30);
    });
  });

  // ----------------------------------------------------------
  // DRIFT DETECTION — FATIGUE (Soldier after 8 hours)
  // ----------------------------------------------------------

  describe('Fatigue Detection — Soldier Scenario', () => {
    test('detects reaction time slowdown as warning', () => {
      BaselineProfiler.init({ baselineMinSamples: 5, baselineWindowMs: 0 });
      feedBaseline(BaselineProfiler, { reactionTimeMean: 280, count: 25 });
      BaselineProfiler.lockBaseline();

      // After 6 hours: reaction time 40% slower
      for (let i = 0; i < 10; i++) {
        BaselineProfiler.recordReactionTime(400 + Math.random() * 80);
      }

      const drift = BaselineProfiler.getDrift();
      expect(drift.signals.reactionTime.degraded).toBe(true);
      expect(drift.signals.reactionTime.drift).toBeGreaterThan(0.3);
    });

    test('detects multiple degraded signals as alert', () => {
      BaselineProfiler.init({ baselineMinSamples: 5, baselineWindowMs: 0 });
      feedBaseline(BaselineProfiler, {
        reactionTimeMean: 280,
        precisionMean: 5,
        count: 25
      });
      BaselineProfiler.lockBaseline();

      // Severely degraded: slower AND less precise
      for (let i = 0; i < 10; i++) {
        BaselineProfiler.recordReactionTime(500 + Math.random() * 100); // 80% slower
        BaselineProfiler.recordClickPrecision(12 + Math.random() * 5);  // 2x less precise
        BaselineProfiler.recordScroll();
        BaselineProfiler.recordMousePosition(
          100 + i * 5 + Math.random() * 20,  // jerky mouse
          200 + i * 2 + Math.random() * 15
        );
      }

      const drift = BaselineProfiler.getDrift();
      expect(drift.degradedSignals).toBeGreaterThanOrEqual(2);
      expect(drift.level).toMatch(/warning|alert|critical/);
      expect(drift.recommendation).toBeTruthy();

      console.log('\n  === SOLDIER FATIGUE SCENARIO ===');
      console.log(`  Drift score:      ${drift.driftScore}`);
      console.log(`  Level:            ${drift.level}`);
      console.log(`  Degraded signals: ${drift.degradedSignals}/${drift.totalSignals}`);
      console.log(`  Recommendation:   ${drift.recommendation}`);
      if (drift.signals.reactionTime.baselineMean) {
        console.log(`  RT baseline:      ${drift.signals.reactionTime.baselineMean}ms`);
        console.log(`  RT current:       ${drift.signals.reactionTime.currentMean}ms`);
        console.log(`  RT drift:         ${(drift.signals.reactionTime.drift * 100).toFixed(0)}%`);
      }
      console.log('  ================================\n');
    });

    test('critical alert when all signals degrade severely', () => {
      BaselineProfiler.init({
        baselineMinSamples: 5,
        baselineWindowMs: 0,
        reactionTimeDriftThreshold: 0.30,
        precisionDriftThreshold: 0.30,
        criticalThreshold: 0.60
      });
      feedBaseline(BaselineProfiler, {
        reactionTimeMean: 250,
        precisionMean: 4,
        count: 25
      });
      BaselineProfiler.lockBaseline();

      // Extreme degradation — every signal is way off baseline
      for (let i = 0; i < 10; i++) {
        BaselineProfiler.recordReactionTime(700 + Math.random() * 200); // 180% slower
        BaselineProfiler.recordClickPrecision(20 + Math.random() * 10); // 5x worse
        BaselineProfiler.recordScroll();
        BaselineProfiler.recordMousePosition(
          100 + Math.random() * 50, // very jerky
          200 + Math.random() * 50
        );
      }

      const drift = BaselineProfiler.getDrift();
      expect(drift.level).toMatch(/alert|critical/);
      expect(drift.driftScore).toBeGreaterThan(0.5);
    });
  });

  // ----------------------------------------------------------
  // DRIFT DETECTION — DOCTOR SHIFT SCENARIO
  // ----------------------------------------------------------

  describe('Doctor Shift Degradation', () => {
    test('gradual degradation over shift produces escalating alerts', () => {
      BaselineProfiler.init({ baselineMinSamples: 5, baselineWindowMs: 0 });
      feedBaseline(BaselineProfiler, {
        reactionTimeMean: 300,
        precisionMean: 4,
        count: 25
      });
      BaselineProfiler.lockBaseline();

      const levels = [];

      // Simulate 3 check-ins during a 12-hour shift
      // Hour 4: slight fatigue
      BaselineProfiler._internal.current().reactionTimes = [];
      BaselineProfiler._internal.current().clickPrecisions = [];
      for (let i = 0; i < 10; i++) {
        BaselineProfiler.recordReactionTime(340 + Math.random() * 40); // 13% slower
        BaselineProfiler.recordClickPrecision(5 + Math.random() * 2);  // slightly worse
      }
      levels.push(BaselineProfiler.getDrift());

      // Hour 8: noticeable fatigue
      BaselineProfiler._internal.current().reactionTimes = [];
      BaselineProfiler._internal.current().clickPrecisions = [];
      for (let i = 0; i < 10; i++) {
        BaselineProfiler.recordReactionTime(430 + Math.random() * 60); // 43% slower
        BaselineProfiler.recordClickPrecision(8 + Math.random() * 4);  // much worse
      }
      levels.push(BaselineProfiler.getDrift());

      // Hour 12: severe fatigue
      BaselineProfiler._internal.current().reactionTimes = [];
      BaselineProfiler._internal.current().clickPrecisions = [];
      for (let i = 0; i < 10; i++) {
        BaselineProfiler.recordReactionTime(550 + Math.random() * 100); // 83% slower
        BaselineProfiler.recordClickPrecision(14 + Math.random() * 6);  // 3.5x worse
      }
      levels.push(BaselineProfiler.getDrift());

      console.log('\n  === DOCTOR SHIFT DEGRADATION ===');
      levels.forEach((d, i) => {
        console.log(`  Hour ${[4, 8, 12][i]}:  drift=${d.driftScore}  level=${d.level}  degraded=${d.degradedSignals}/${d.totalSignals}`);
      });
      console.log('  ================================\n');

      // Drift should escalate over time
      expect(levels[0].driftScore).toBeLessThan(levels[1].driftScore);
      expect(levels[1].driftScore).toBeLessThan(levels[2].driftScore);

      // Final check should be at least warning level
      expect(levels[2].level).toMatch(/warning|alert|critical/);
    });
  });

  // ----------------------------------------------------------
  // SET BASELINE FROM EXTERNAL DATA
  // ----------------------------------------------------------

  describe('External Baseline', () => {
    test('can set baseline from pre-computed stats', () => {
      BaselineProfiler.init({});
      BaselineProfiler.setBaseline({
        reactionTime: { mean: 300, stddev: 50, cv: 0.167, count: 30 },
        clickPrecision: { mean: 5, stddev: 2, count: 30 },
        scrollRhythm: { mean: 500, cv: 0.3, count: 20 },
        mouseJitter: { mean: 1.2, stddev: 0.5, count: 25 },
        interactionFrequency: { meanGap: 2000, cv: 0.4, count: 20 },
        decisionSpeed: { mean: 500, stddev: 100, count: 15 }
      });

      expect(BaselineProfiler.getPhase()).toBe('monitoring');
      expect(BaselineProfiler.getBaseline()).toBeDefined();
      expect(BaselineProfiler.getBaseline().reactionTime.mean).toBe(300);
    });

    test('drift detection works with external baseline', () => {
      BaselineProfiler.init({});
      BaselineProfiler.setBaseline({
        reactionTime: { mean: 300, stddev: 50, cv: 0.167, count: 30 },
        clickPrecision: { mean: 5, stddev: 2, count: 30 },
        scrollRhythm: { mean: 500, cv: 0.3, count: 20 },
        mouseJitter: { mean: 1.2, stddev: 0.5, count: 25 },
        interactionFrequency: { meanGap: 2000, cv: 0.4, count: 20 },
        decisionSpeed: { mean: 500, stddev: 100, count: 15 }
      });

      // Feed degraded current data
      for (let i = 0; i < 10; i++) {
        BaselineProfiler.recordReactionTime(500 + Math.random() * 100);
        BaselineProfiler.recordClickPrecision(12 + Math.random() * 5);
      }

      const drift = BaselineProfiler.getDrift();
      expect(drift.signals.reactionTime.degraded).toBe(true);
      expect(drift.driftScore).toBeGreaterThan(0);
    });
  });

  // ----------------------------------------------------------
  // SERVER EXPORT
  // ----------------------------------------------------------

  describe('Server Export', () => {
    test('exports complete profiler state', () => {
      BaselineProfiler.init({ baselineMinSamples: 5, baselineWindowMs: 0 });
      feedBaseline(BaselineProfiler, { count: 25 });
      BaselineProfiler.lockBaseline();

      for (let i = 0; i < 5; i++) {
        BaselineProfiler.recordReactionTime(350);
      }

      const exported = BaselineProfiler.exportForServer();
      expect(exported.phase).toBe('monitoring');
      expect(exported.baselineLocked).toBe(true);
      expect(exported.baselineStats).toBeDefined();
      expect(exported.currentWindow.reactionTimes.length).toBe(5);
    });
  });

  // ----------------------------------------------------------
  // DRIFT HISTORY
  // ----------------------------------------------------------

  describe('Drift History', () => {
    test('accumulates drift checks in history', () => {
      BaselineProfiler.init({ baselineMinSamples: 5, baselineWindowMs: 0 });
      feedBaseline(BaselineProfiler, { count: 25 });
      BaselineProfiler.lockBaseline();

      // Do 3 drift checks
      for (let check = 0; check < 3; check++) {
        for (let i = 0; i < 5; i++) {
          BaselineProfiler.recordReactionTime(300 + check * 50);
        }
        BaselineProfiler.getDrift();
      }

      const history = BaselineProfiler.getDriftHistory();
      expect(history.length).toBe(3);
      expect(history[0].timestamp).toBeDefined();
      expect(history[0].driftScore).toBeDefined();
      expect(history[0].level).toBeDefined();
    });
  });

  // ----------------------------------------------------------
  // EDGE CASES
  // ----------------------------------------------------------

  describe('Edge Cases', () => {
    test('drift report before baseline returns no_baseline', () => {
      BaselineProfiler.init({});
      const drift = BaselineProfiler.getDrift();
      expect(drift.level).toBe('no_baseline');
      expect(drift.driftScore).toBe(0);
    });

    test('drift with insufficient current data returns 0 for missing signals', () => {
      BaselineProfiler.init({});
      BaselineProfiler.setBaseline({
        reactionTime: { mean: 300, stddev: 50, cv: 0.167, count: 30 },
        clickPrecision: { mean: 5, stddev: 2, count: 30 },
        scrollRhythm: { mean: 500, cv: 0.3, count: 20 },
        mouseJitter: { mean: 1.2, stddev: 0.5, count: 25 },
        interactionFrequency: { meanGap: 2000, cv: 0.4, count: 20 },
        decisionSpeed: { mean: 500, stddev: 100, count: 15 }
      });

      // Only one reaction time — not enough for analysis
      BaselineProfiler.recordReactionTime(400);

      const drift = BaselineProfiler.getDrift();
      expect(drift.totalSignals).toBe(0); // insufficient data for all signals
    });

    test('reset clears everything', () => {
      BaselineProfiler.init({ baselineMinSamples: 5, baselineWindowMs: 0 });
      feedBaseline(BaselineProfiler, { count: 25 });
      BaselineProfiler.lockBaseline();

      BaselineProfiler.reset();
      expect(BaselineProfiler.getPhase()).toBe('idle');
      expect(BaselineProfiler.getBaseline()).toBeNull();
      expect(BaselineProfiler.getDriftHistory().length).toBe(0);
    });

    test('handles zero baseline values gracefully', () => {
      BaselineProfiler.init({});
      BaselineProfiler.setBaseline({
        reactionTime: { mean: 0, stddev: 0, cv: 0, count: 0 },
        clickPrecision: { mean: 0, stddev: 0, count: 0 },
        scrollRhythm: { mean: 0, cv: 0, count: 0 },
        mouseJitter: { mean: 0, stddev: 0, count: 0 },
        interactionFrequency: { meanGap: 0, cv: 0, count: 0 },
        decisionSpeed: { mean: 0, stddev: 0, count: 0 }
      });

      for (let i = 0; i < 5; i++) {
        BaselineProfiler.recordReactionTime(300);
        BaselineProfiler.recordClickPrecision(5);
      }

      const drift = BaselineProfiler.getDrift();
      // Should not crash, should handle division by zero
      expect(drift).toBeDefined();
      expect(typeof drift.driftScore).toBe('number');
      expect(isNaN(drift.driftScore)).toBe(false);
    });
  });
});
