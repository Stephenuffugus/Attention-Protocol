/**
 * Session Integrity Validator — Test Suite
 *
 * Proves: we can catch fabricated, replayed, and tampered session data.
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */

const IntegrityValidator = require('../src/sdk/session-integrity-validator');

describe('Session Integrity Validator', () => {

  // ----------------------------------------------------------
  // LEGITIMATE SESSION
  // ----------------------------------------------------------

  describe('Legitimate Session', () => {
    test('valid human session passes all checks', () => {
      const result = IntegrityValidator.validate({
        session_id: 'legit_001',
        duration_ms: 120000,
        interaction_count: 45,
        hash_count: 8,
        interaction_intervals: [
          312, 445, 278, 512, 389, 267, 401, 356, 490, 321,
          378, 412, 289, 467, 345, 398, 456, 301, 378, 423
        ],
        tap_sequence: [
          { x: 100, y: 200, t: 1000 },
          { x: 150, y: 250, t: 1400 },
          { x: 80, y: 180, t: 1800 },
          { x: 200, y: 300, t: 2200 },
          { x: 120, y: 220, t: 2600 },
          { x: 170, y: 270, t: 3000 },
          { x: 90, y: 190, t: 3400 },
          { x: 210, y: 310, t: 3900 },
          { x: 130, y: 230, t: 4300 },
          { x: 160, y: 260, t: 4700 }
        ],
        scroll_events: [
          { y: 0, t: 1000 },
          { y: 100, t: 1500 },
          { y: 250, t: 2000 },
          { y: 300, t: 2800 },
          { y: 450, t: 3500 }
        ],
        decisions: [
          { optionCount: 3, responseTimeMs: 800 },
          { optionCount: 5, responseTimeMs: 1200 },
          { optionCount: 2, responseTimeMs: 600 },
          { optionCount: 4, responseTimeMs: 1000 },
          { optionCount: 6, responseTimeMs: 1500 }
        ]
      });

      expect(result.integrity).toBe('valid');
      expect(result.passedChecks).toBe(result.totalChecks);
      expect(result.findings.filter(f => f.severity === 'critical').length).toBe(0);

      console.log('\n  === INTEGRITY: LEGITIMATE SESSION ===');
      console.log(`  Result:   ${result.integrity}`);
      console.log(`  Passed:   ${result.passedChecks}/${result.totalChecks}`);
      console.log(`  Findings: ${result.findings.length}`);
      console.log('  =====================================\n');
    });
  });

  // ----------------------------------------------------------
  // TIMESTAMP MANIPULATION
  // ----------------------------------------------------------

  describe('Timestamp Manipulation', () => {
    test('catches negative time intervals', () => {
      const result = IntegrityValidator.validate({
        session_id: 'tampered_ts',
        duration_ms: 60000,
        interaction_intervals: [300, -100, 250, -50, 400, 300, -200, 350, 280, 320]
      });

      expect(result.flags.timestampIntegrity).toBe(false);
      expect(result.integrity).not.toBe('valid');
      const critical = result.findings.filter(f =>
        f.check === 'timestamp_integrity' && f.severity === 'critical'
      );
      expect(critical.length).toBeGreaterThan(0);
    });

    test('catches out-of-order tap timestamps', () => {
      const result = IntegrityValidator.validate({
        session_id: 'ooo_taps',
        duration_ms: 10000,
        tap_sequence: [
          { x: 100, y: 200, t: 1000 },
          { x: 150, y: 250, t: 900 },  // out of order!
          { x: 120, y: 220, t: 1100 },
          { x: 130, y: 230, t: 1050 }  // out of order!
        ]
      });

      expect(result.flags.timestampIntegrity).toBe(false);
    });

    test('catches mostly-zero intervals (fabricated)', () => {
      const result = IntegrityValidator.validate({
        session_id: 'zero_intervals',
        duration_ms: 30000,
        interaction_intervals: [0, 0, 0, 0, 0, 0, 0, 0, 100, 200]
      });

      expect(result.flags.timestampIntegrity).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // STATISTICAL IMPOSSIBILITY
  // ----------------------------------------------------------

  describe('Statistical Implausibility', () => {
    test('catches sub-80ms reaction times (impossible for humans)', () => {
      const result = IntegrityValidator.validate({
        session_id: 'fast_bot',
        duration_ms: 60000,
        interaction_intervals: [
          10, 15, 12, 8, 20, 11, 14, 9, 13, 16,  // all under 80ms
          300, 250  // only 2 normal ones
        ]
      });

      expect(result.flags.statisticalPlausibility).toBe(false);
    });

    test('catches all clicks at identical position (bot)', () => {
      const taps = [];
      for (let i = 0; i < 20; i++) {
        taps.push({ x: 500, y: 300, t: 1000 + i * 100 });
      }

      const result = IntegrityValidator.validate({
        session_id: 'click_bot',
        duration_ms: 5000,
        tap_sequence: taps
      });

      expect(result.flags.statisticalPlausibility).toBe(false);
      const finding = result.findings.find(f => f.detail.includes('identical position'));
      expect(finding).toBeDefined();
      expect(finding.severity).toBe('critical');
    });

    test('catches impossibly fast decisions', () => {
      const result = IntegrityValidator.validate({
        session_id: 'fast_decisions',
        duration_ms: 10000,
        decisions: [
          { optionCount: 5, responseTimeMs: 30 },  // impossible
          { optionCount: 3, responseTimeMs: 20 },   // impossible
          { optionCount: 8, responseTimeMs: 45 },   // impossible
          { optionCount: 4, responseTimeMs: 10 },   // impossible
          { optionCount: 6, responseTimeMs: 50 },   // impossible
          { optionCount: 2, responseTimeMs: 600 }    // only legit one
        ]
      });

      expect(result.flags.statisticalPlausibility).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // LOW ENTROPY (Machine-Generated Data)
  // ----------------------------------------------------------

  describe('Entropy Check — Machine Detection', () => {
    test('catches perfectly regular intervals (bot timer)', () => {
      // A bot using setInterval(click, 500)
      const intervals = [];
      for (let i = 0; i < 50; i++) intervals.push(500);

      const result = IntegrityValidator.validate({
        session_id: 'timer_bot',
        duration_ms: 25000,
        interaction_intervals: intervals
      });

      expect(result.flags.entropyCheck).toBe(false);
      const finding = result.findings.find(f => f.check === 'entropy');
      expect(finding).toBeDefined();
    });

    test('catches near-zero variance (programmatic)', () => {
      // Slight jitter but suspiciously regular
      const intervals = [];
      for (let i = 0; i < 30; i++) {
        intervals.push(500 + (i % 2)); // alternates 500, 501 — CV ≈ 0.001
      }

      const result = IntegrityValidator.validate({
        session_id: 'near_zero_cv',
        duration_ms: 15000,
        interaction_intervals: intervals
      });

      expect(result.flags.entropyCheck).toBe(false);
    });

    test('catches identical scroll deltas (programmatic scrolling)', () => {
      const scrolls = [];
      for (let i = 0; i < 20; i++) {
        scrolls.push({ y: i * 100, t: i * 200 }); // exactly 100px each time
      }

      const result = IntegrityValidator.validate({
        session_id: 'auto_scroll',
        duration_ms: 4000,
        scroll_events: scrolls
      });

      expect(result.flags.entropyCheck).toBe(false);
    });

    test('human-like entropy passes', () => {
      // Natural human intervals have high variance
      const intervals = [312, 445, 278, 512, 189, 667, 401, 156, 490, 321, 578, 234, 412, 289, 467];

      const result = IntegrityValidator.validate({
        session_id: 'human_entropy',
        duration_ms: 60000,
        interaction_count: 15,
        interaction_intervals: intervals
      });

      expect(result.flags.entropyCheck).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // CROSS-SIGNAL COHERENCE
  // ----------------------------------------------------------

  describe('Cross-Signal Coherence', () => {
    test('catches long session with almost no interactions', () => {
      const result = IntegrityValidator.validate({
        session_id: 'idle_session',
        duration_ms: 600000,  // 10 minutes
        interaction_count: 2  // only 2 interactions
      });

      const finding = result.findings.find(f =>
        f.check === 'cross_signal_coherence' && f.detail.includes('fewer than 5')
      );
      expect(finding).toBeDefined();
    });

    test('catches excessive hash generation rate', () => {
      const result = IntegrityValidator.validate({
        session_id: 'hash_flood',
        duration_ms: 60000,   // 1 minute
        hash_count: 500       // 500 hashes in 1 minute = 500/min (impossible)
      });

      expect(result.flags.crossSignalCoherence).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // VOLUME SANITY
  // ----------------------------------------------------------

  describe('Volume Sanity', () => {
    test('catches impossibly high event rate', () => {
      // 10 events per second for a minute = 600/min
      const intervals = [];
      for (let i = 0; i < 600; i++) intervals.push(100); // 100ms each

      const result = IntegrityValidator.validate({
        session_id: 'flood_attack',
        duration_ms: 60000,
        interaction_intervals: intervals,
        tap_sequence: intervals.map((_, i) => ({ x: 100 + i, y: 200 + i, t: i * 100 }))
      });

      expect(result.flags.volumeSanity).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // REPLAY / DUPLICATE DETECTION
  // ----------------------------------------------------------

  describe('Replay Detection', () => {
    test('catches copy-pasted interval data (first half = second half)', () => {
      const halfData = [312, 445, 278, 512, 389, 267, 401, 356, 490, 321];
      const replayed = halfData.concat(halfData); // exact copy

      const result = IntegrityValidator.validate({
        session_id: 'replay_attack',
        duration_ms: 20000,
        interaction_intervals: replayed
      });

      expect(result.flags.duplicateDetection).toBe(false);
      const finding = result.findings.find(f =>
        f.check === 'duplicate_detection' && f.detail.includes('identical')
      );
      expect(finding).toBeDefined();
    });

    test('catches repeated tap patterns (scripted clicks)', () => {
      const pattern = [
        { x: 100, y: 200, t: 0 },
        { x: 150, y: 250, t: 100 },
        { x: 200, y: 300, t: 200 },
        { x: 250, y: 350, t: 300 },
        { x: 300, y: 400, t: 400 }
      ];

      // Repeat the exact same click pattern 4 times
      const taps = [];
      for (let rep = 0; rep < 4; rep++) {
        pattern.forEach((p, i) => {
          taps.push({ x: p.x, y: p.y, t: rep * 500 + p.t });
        });
      }

      const result = IntegrityValidator.validate({
        session_id: 'scripted_clicks',
        duration_ms: 2000,
        tap_sequence: taps
      });

      expect(result.flags.duplicateDetection).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // COMBINED ATTACK SCENARIOS
  // ----------------------------------------------------------

  describe('Combined Attack Detection', () => {
    test('sophisticated bot (jittered timing but identical positions) caught', () => {
      const taps = [];
      for (let i = 0; i < 30; i++) {
        taps.push({
          x: 500 + (i % 2),  // barely moves
          y: 300,
          t: 1000 + i * (200 + Math.random() * 50) // slightly jittered timing
        });
      }

      const result = IntegrityValidator.validate({
        session_id: 'smart_bot',
        duration_ms: 10000,
        interaction_intervals: taps.map((_, i) => 200 + Math.random() * 50),
        tap_sequence: taps
      });

      expect(result.integrity).not.toBe('valid');
    });

    test('complete fabrication caught — multiple flags', () => {
      // Bot with everything wrong
      const result = IntegrityValidator.validate({
        session_id: 'total_fake',
        duration_ms: 600000,
        interaction_count: 1,
        hash_count: 1000,
        interaction_intervals: [500, 500, 500, 500, 500, 500, 500, 500, 500, 500,
                                500, 500, 500, 500, 500, 500, 500, 500, 500, 500],
        tap_sequence: Array.from({length: 20}, (_, i) => ({ x: 200, y: 200, t: i * 500 })),
        scroll_events: Array.from({length: 20}, (_, i) => ({ y: i * 100, t: i * 200 })),
        decisions: Array.from({length: 5}, () => ({ optionCount: 4, responseTimeMs: 50 }))
      });

      expect(result.integrity).toMatch(/likely_fabricated|rejected/);
      expect(result.passedChecks).toBeLessThan(result.totalChecks - 1);

      console.log('\n  === INTEGRITY: TOTAL FABRICATION ===');
      console.log(`  Result:     ${result.integrity}`);
      console.log(`  Passed:     ${result.passedChecks}/${result.totalChecks}`);
      console.log(`  Findings:   ${result.findings.length}`);
      result.findings.forEach(f => {
        console.log(`    [${f.severity}] ${f.check}: ${f.detail}`);
      });
      console.log('  ===================================\n');
    });
  });

  // ----------------------------------------------------------
  // EDGE CASES
  // ----------------------------------------------------------

  describe('Edge Cases', () => {
    test('empty session still validates without crashing', () => {
      const result = IntegrityValidator.validate({
        session_id: 'empty'
      });
      expect(result).toBeDefined();
      expect(result.integrity).toBeDefined();
    });

    test('session with only session_id passes basic checks', () => {
      const result = IntegrityValidator.validate({
        session_id: 'minimal',
        duration_ms: 5000,
        interaction_count: 0
      });
      expect(result).toBeDefined();
      // Should pass most checks since there's nothing to flag
      expect(result.integrity).toMatch(/valid|suspicious/);
    });
  });
});
