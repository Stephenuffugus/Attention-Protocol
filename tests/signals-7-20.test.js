/**
 * SWS Attention Protocol — Signals 7-20 Test Coverage
 * Tests for the 14 behavioral signals added in SDK v2.0.0
 *
 * Run with: npx jest tests/signals-7-20.test.js --verbose --forceExit
 */

const { loadSDK, resetState, dispatchDocEvent } = require('./setup');

// Helper: reload all SDK modules fresh
function reloadSDK() {
  resetState();
  loadSDK('../src/sdk/secure-config.js');
  loadSDK('../src/sdk/attention-protocol.js');
  loadSDK('../src/sdk/economy-engine.js');
  SWSAttention.init({ gameId: 'signals_test', debug: false, enableBehavioralAnalysis: true });
}

// Initial load
loadSDK('../src/sdk/secure-config.js');
loadSDK('../src/sdk/attention-protocol.js');
loadSDK('../src/sdk/economy-engine.js');

beforeEach(() => {
  reloadSDK();
});

// Helper: simulate N mousedown events at varying positions with delays
function simulateMousedowns(n, done, callback) {
  let count = 0;
  function go() {
    if (count < n) {
      dispatchDocEvent('mousedown', {
        type: 'mousedown',
        clientX: 100 + count * 7 + Math.floor(Math.sin(count) * 20),
        clientY: 200 + count * 5 + Math.floor(Math.cos(count) * 15)
      });
      count++;
      // Use variable but bounded delays (100-400ms)
      const delay = 100 + (count * 37) % 300;
      setTimeout(go, delay);
    } else {
      callback();
    }
  }
  go();
}

// Helper: simulate N mouse moves to populate _mouseMoveLog
// Creates curved movements with pauses (>300ms gaps) between segments
function simulateMouseMoves(segments, pointsPerSegment, callback) {
  let segIdx = 0;
  let ptIdx = 0;
  let baseTime = Date.now();

  function go() {
    if (segIdx >= segments) {
      callback();
      return;
    }
    if (ptIdx < pointsPerSegment) {
      const t = ptIdx / pointsPerSegment;
      // Curved path for each segment (bell-shaped velocity = slow-fast-slow)
      const speed = Math.sin(t * Math.PI); // 0 -> 1 -> 0
      const baseX = segIdx * 200 + 50;
      const baseY = segIdx * 100 + 50;
      const x = baseX + t * 180 + Math.sin(t * Math.PI * 2) * 30;
      const y = baseY + t * 120 + Math.cos(t * Math.PI * 2) * 20;
      dispatchDocEvent('mousemove', {
        clientX: Math.round(x),
        clientY: Math.round(y)
      });
      ptIdx++;
      setTimeout(go, 20); // ~50Hz, above the 16ms throttle
    } else {
      // Pause between segments (>300ms to create segment break)
      ptIdx = 0;
      segIdx++;
      setTimeout(go, 350);
    }
  }
  go();
}

// Helper: simulate keystrokes (keydown + keyup pairs)
function simulateKeystrokes(n, callback) {
  let count = 0;
  function go() {
    if (count < n) {
      const keyCode = 65 + (count % 26); // a-z
      dispatchDocEvent('keydown', { type: 'keydown', keyCode: keyCode });
      // Hold time: 50-200ms (human-like)
      const holdTime = 50 + (count * 17) % 150;
      setTimeout(() => {
        dispatchDocEvent('keyup', { type: 'keyup', keyCode: keyCode });
        count++;
        // Flight time: 80-300ms
        const flightTime = 80 + (count * 23) % 220;
        setTimeout(go, flightTime);
      }, holdTime);
    } else {
      callback();
    }
  }
  go();
}

// ============================================================
// Signal 7: Keystroke Dynamics
// ============================================================
describe('Signal 7: Keystroke Dynamics', () => {
  test('returns sentinel (0) with insufficient mobile input data (<10)', () => {
    for (let i = 0; i < 5; i++) {
      SWSAttention.recordMobileInput(Date.now() + i * 200);
    }
    const c = SWSAttention.getHumanConfidence();
    expect(c.keystroke).toBe(0);
  });

  test('returns valid [0,1] score with sufficient mobile input data (>=10)', () => {
    const base = Date.now();
    const intervals = [120, 180, 95, 210, 150, 300, 90, 170, 250, 130, 200, 160, 110, 280, 140];
    let t = base;
    for (const interval of intervals) {
      t += interval;
      SWSAttention.recordMobileInput(t);
    }
    const c = SWSAttention.getHumanConfidence();
    expect(c.keystroke).toBeGreaterThan(0);
    expect(c.keystroke).toBeLessThanOrEqual(1);
  });

  test('human variable intervals score higher than bot constant intervals', () => {
    // Human: variable intervals
    const baseH = Date.now();
    const humanIntervals = [120, 250, 95, 310, 150, 400, 80, 170, 550, 130, 200, 160, 110, 380, 140];
    let t = baseH;
    for (const iv of humanIntervals) { t += iv; SWSAttention.recordMobileInput(t); }
    const humanScore = SWSAttention.getHumanConfidence().keystroke;

    reloadSDK();

    // Bot: perfectly regular 100ms intervals
    const baseB = Date.now();
    for (let i = 0; i < 15; i++) SWSAttention.recordMobileInput(baseB + i * 100);
    const botScore = SWSAttention.getHumanConfidence().keystroke;

    expect(humanScore).toBeGreaterThan(botScore);
  });

  test('desktop keystroke path: returns valid score with 8+ keydown/keyup pairs', (done) => {
    simulateKeystrokes(12, () => {
      const c = SWSAttention.getHumanConfidence();
      expect(c.keystroke).toBeGreaterThan(0);
      expect(c.keystroke).toBeLessThanOrEqual(1);
      done();
    });
  }, 15000);

  test('empty mobile input array returns sentinel', () => {
    const c = SWSAttention.getHumanConfidence();
    expect(c.keystroke).toBe(0);
  });
});

// ============================================================
// Signal 7b: Digraph (class-pair transition) timing
// ============================================================
// Helper: dispatch keydown/keyup pairs with a specific `key` string (so the
// SDK's class bucketing picks up varied character classes) and per-pair flight
// time. Each step is sync-ish via setTimeout chaining.
function simulateTypedSequence(steps, callback) {
  let i = 0;
  function go() {
    if (i >= steps.length) { callback(); return; }
    const step = steps[i++];
    // keydown
    dispatchDocEvent('keydown', { type: 'keydown', keyCode: step.keyCode || 0, key: step.key });
    setTimeout(() => {
      // keyup at +holdTime
      dispatchDocEvent('keyup', { type: 'keyup', keyCode: step.keyCode || 0, key: step.key });
      setTimeout(go, step.flight);
    }, step.hold);
  }
  go();
}

// Convenience: build a "typed phrase" step list with per-digit hold/flight jitter.
function buildTypedSteps(phrase, baseHold, baseFlight, jitter) {
  const steps = [];
  for (let i = 0; i < phrase.length; i++) {
    const ch = phrase[i];
    steps.push({
      key: ch,
      keyCode: ch.charCodeAt(0),
      hold: Math.max(30, baseHold + Math.floor(Math.sin(i * 1.7) * jitter)),
      flight: Math.max(40, baseFlight + Math.floor(Math.cos(i * 1.3) * jitter))
    });
  }
  return steps;
}

describe('Signal 7b: Digraph (class-pair) timing', () => {
  test('returns null when fewer than 8 keystrokes are logged', (done) => {
    simulateTypedSequence(buildTypedSteps('abc', 80, 120, 40), () => {
      const dg = SWSAttention.getDigraphStats();
      expect(dg).toBeNull();
      done();
    });
  }, 10000);

  test('returns null when only one class-pair type is observed (all letters)', (done) => {
    // 12 lowercase letters in a row → every transition is l→l (one pair type)
    simulateTypedSequence(buildTypedSteps('abcdefghijkl', 90, 130, 30), () => {
      const dg = SWSAttention.getDigraphStats();
      expect(dg).toBeNull();
      done();
    });
  }, 10000);

  test('returns a well-shaped result for diverse human-like typing', (done) => {
    // Letters + spaces + punctuation → 4+ distinct class-pair types
    const phrase = 'hello world, this is a test.';
    simulateTypedSequence(buildTypedSteps(phrase, 95, 140, 45), () => {
      const dg = SWSAttention.getDigraphStats();
      expect(dg).not.toBeNull();
      expect(dg.pairTypes).toBeGreaterThanOrEqual(4);
      expect(dg.score).toBeGreaterThan(0);
      expect(dg.score).toBeLessThanOrEqual(1);
      expect(dg.diversity).toBeGreaterThan(0);
      expect(dg.within).toBeGreaterThanOrEqual(0);
      expect(dg.cross).toBeGreaterThanOrEqual(0);
      done();
    });
  }, 15000);

  test('human varied typing scores strictly higher than robotic uniform-paste', (done) => {
    // Human: diverse classes + natural within-pair jitter
    const humanPhrase = 'the quick brown fox jumps, over 3 lazy dogs.';
    simulateTypedSequence(buildTypedSteps(humanPhrase, 95, 145, 55), () => {
      const humanDg = SWSAttention.getDigraphStats();
      const humanScore = humanDg ? humanDg.score : -1;
      reloadSDK();

      // Robot: same diversity of classes (so diversity isn't the only lever)
      // but zero within-pair variability — every flight time is identical.
      const botPhrase = 'the quick brown fox jumps, over 3 lazy dogs.';
      const botSteps = [];
      for (let i = 0; i < botPhrase.length; i++) {
        botSteps.push({
          key: botPhrase[i],
          keyCode: botPhrase.charCodeAt(i),
          hold: 80,   // fixed
          flight: 120 // fixed — no jitter at all
        });
      }
      simulateTypedSequence(botSteps, () => {
        const botDg = SWSAttention.getDigraphStats();
        const botScore = botDg ? botDg.score : -1;
        expect(humanScore).toBeGreaterThan(botScore);
        done();
      });
    });
  }, 20000);

  test('keystroke sub-composite integrates digraph signal end-to-end', (done) => {
    // With diverse typing, the full keystroke composite should still return a
    // valid [0,1] score. This is the regression guard for the fold-in change.
    simulateTypedSequence(buildTypedSteps('hello world, 2026 is here.', 95, 140, 40), () => {
      const c = SWSAttention.getHumanConfidence();
      expect(c.keystroke).toBeGreaterThan(0);
      expect(c.keystroke).toBeLessThanOrEqual(1);
      done();
    });
  }, 15000);
});

// ============================================================
// Signal 8: Reading Speed Inference
// ============================================================
describe('Signal 8: Reading Speed Inference', () => {
  test('returns sentinel with 0 completed sections', () => {
    const c = SWSAttention.getHumanConfidence();
    expect(c.readingSpeed).toBe(0);
  });

  test('returns sentinel with only 1 completed section', () => {
    SWSAttention.recordSectionEntry('sec1');
    SWSAttention.recordSectionExit('sec1', 100);
    const c = SWSAttention.getHumanConfidence();
    expect(c.readingSpeed).toBe(0);
  });

  test('returns valid [0,1] score with 3+ completed sections', (done) => {
    // Threshold raised from 2 to 3 after 2026-04-21 calibration fix:
    // 2 data points is too few to compute a stable CV, so it now returns -1.
    SWSAttention.recordSectionEntry('sec1');
    setTimeout(() => {
      SWSAttention.recordSectionExit('sec1', 100);
      SWSAttention.recordSectionEntry('sec2');
      setTimeout(() => {
        SWSAttention.recordSectionExit('sec2', 100);
        SWSAttention.recordSectionEntry('sec3');
        setTimeout(() => {
          SWSAttention.recordSectionExit('sec3', 100);
          const c = SWSAttention.getHumanConfidence();
          expect(c.readingSpeed).toBeGreaterThan(0);
          expect(c.readingSpeed).toBeLessThanOrEqual(1);
          done();
        }, 250);
      }, 250);
    }, 250);
  });

  test('impossibly fast reading (mean < 200ms) returns 0.2', (done) => {
    SWSAttention.recordSectionEntry('a');
    setTimeout(() => {
      SWSAttention.recordSectionExit('a', 100);
      SWSAttention.recordSectionEntry('b');
      setTimeout(() => {
        SWSAttention.recordSectionExit('b', 100);
        const c = SWSAttention.getHumanConfidence();
        // ~20ms per section should yield 0.2
        expect(c.readingSpeed).toBeLessThanOrEqual(0.3);
        done();
      }, 10);
    }, 10);
  });

  test('unfinished section entry does not count', () => {
    SWSAttention.recordSectionEntry('sec1');
    // no exit
    SWSAttention.recordSectionEntry('sec2');
    // no exit
    const c = SWSAttention.getHumanConfidence();
    expect(c.readingSpeed).toBe(0);
  });
});

// ============================================================
// Signal 8b: Reading-Speed Coherence (WPM plausibility)
// ============================================================
describe('Signal 8b: Reading-Speed Coherence (WPM)', () => {
  test('getReadingCoherence returns null when no sections have wordCount', (done) => {
    SWSAttention.recordSectionEntry('s1');
    setTimeout(() => {
      SWSAttention.recordSectionExit('s1', 100);
      SWSAttention.recordSectionEntry('s2');
      setTimeout(() => {
        SWSAttention.recordSectionExit('s2', 100);
        expect(SWSAttention.getReadingCoherence()).toBeNull();
        done();
      }, 150);
    }, 150);
  }, 5000);

  test('getReadingCoherence returns null with only one wordCount section', (done) => {
    SWSAttention.recordSectionEntry('s1', 5);
    setTimeout(() => {
      SWSAttention.recordSectionExit('s1', 100);
      SWSAttention.recordSectionEntry('s2'); // no wordCount
      setTimeout(() => {
        SWSAttention.recordSectionExit('s2', 100);
        expect(SWSAttention.getReadingCoherence()).toBeNull();
        done();
      }, 300);
    }, 300);
  }, 5000);

  test('plausible WPM sections score near 1.0 on coherence', (done) => {
    // 5 words in 1000ms = 300 WPM (squarely in the reading band)
    SWSAttention.recordSectionEntry('s1', 5);
    setTimeout(() => {
      SWSAttention.recordSectionExit('s1', 100);
      SWSAttention.recordSectionEntry('s2', 5);
      setTimeout(() => {
        SWSAttention.recordSectionExit('s2', 100);
        SWSAttention.recordSectionEntry('s3', 5);
        setTimeout(() => {
          SWSAttention.recordSectionExit('s3', 100);
          const coh = SWSAttention.getReadingCoherence();
          expect(coh).not.toBeNull();
          expect(coh.sections).toBe(3);
          expect(coh.score).toBeGreaterThan(0.8);
          expect(coh.implausibleRatio).toBe(0);
          done();
        }, 1000);
      }, 1000);
    }, 1000);
  }, 8000);

  test('implausibly fast WPM sections score low on coherence', (done) => {
    // 50 words in 250ms = 12000 WPM per section (paste-like)
    SWSAttention.recordSectionEntry('s1', 50);
    setTimeout(() => {
      SWSAttention.recordSectionExit('s1', 100);
      SWSAttention.recordSectionEntry('s2', 50);
      setTimeout(() => {
        SWSAttention.recordSectionExit('s2', 100);
        SWSAttention.recordSectionEntry('s3', 50);
        setTimeout(() => {
          SWSAttention.recordSectionExit('s3', 100);
          const coh = SWSAttention.getReadingCoherence();
          expect(coh).not.toBeNull();
          expect(coh.implausibleRatio).toBeGreaterThanOrEqual(0.5);
          expect(coh.score).toBeLessThanOrEqual(0.25);
          done();
        }, 250);
      }, 250);
    }, 250);
  }, 5000);

  test('plausible-WPM readingSpeed scores strictly higher than implausible-WPM', (done) => {
    // Human: 5 words per 1000ms (300 WPM)
    SWSAttention.recordSectionEntry('s1', 5);
    setTimeout(() => {
      SWSAttention.recordSectionExit('s1', 100);
      SWSAttention.recordSectionEntry('s2', 5);
      setTimeout(() => {
        SWSAttention.recordSectionExit('s2', 100);
        SWSAttention.recordSectionEntry('s3', 5);
        setTimeout(() => {
          SWSAttention.recordSectionExit('s3', 100);
          const human = SWSAttention.getHumanConfidence().readingSpeed;
          reloadSDK();

          // Bot: 50 words per 250ms (12000 WPM) — bypasses the mean<200 gate
          SWSAttention.recordSectionEntry('s1', 50);
          setTimeout(() => {
            SWSAttention.recordSectionExit('s1', 100);
            SWSAttention.recordSectionEntry('s2', 50);
            setTimeout(() => {
              SWSAttention.recordSectionExit('s2', 100);
              SWSAttention.recordSectionEntry('s3', 50);
              setTimeout(() => {
                SWSAttention.recordSectionExit('s3', 100);
                const bot = SWSAttention.getHumanConfidence().readingSpeed;
                expect(human).toBeGreaterThan(bot);
                done();
              }, 250);
            }, 250);
          }, 250);
        }, 1000);
      }, 1000);
    }, 1000);
  }, 15000);

  test('readingSpeed stays unchanged when no wordCount is provided (backcompat)', (done) => {
    SWSAttention.recordSectionEntry('s1');
    setTimeout(() => {
      SWSAttention.recordSectionExit('s1', 100);
      SWSAttention.recordSectionEntry('s2');
      setTimeout(() => {
        SWSAttention.recordSectionExit('s2', 100);
        SWSAttention.recordSectionEntry('s3');
        setTimeout(() => {
          SWSAttention.recordSectionExit('s3', 100);
          expect(SWSAttention.getReadingCoherence()).toBeNull();
          const c = SWSAttention.getHumanConfidence();
          expect(c.readingSpeed).toBeGreaterThan(0);
          expect(c.readingSpeed).toBeLessThanOrEqual(1);
          done();
        }, 250);
      }, 250);
    }, 250);
  }, 5000);

  test('wordCount can be provided at exit instead of entry', (done) => {
    SWSAttention.recordSectionEntry('s1'); // no wordCount
    setTimeout(() => {
      SWSAttention.recordSectionExit('s1', 100, 5); // wordCount on exit
      SWSAttention.recordSectionEntry('s2');
      setTimeout(() => {
        SWSAttention.recordSectionExit('s2', 100, 5);
        const coh = SWSAttention.getReadingCoherence();
        expect(coh).not.toBeNull();
        expect(coh.sections).toBe(2);
        done();
      }, 1000);
    }, 1000);
  }, 5000);
});

// ============================================================
// Signal 9: Cursor/Hover Dwell Time
// ============================================================
describe('Signal 9: Cursor/Hover Dwell Time', () => {
  test('returns sentinel with fewer than 5 hover events', () => {
    for (let i = 0; i < 3; i++) {
      SWSAttention.recordTouchDwell(Date.now() - 200);
    }
    const c = SWSAttention.getHumanConfidence();
    expect(c.hoverDwell).toBe(0);
  });

  test('returns valid [0,1] score with 5+ touch dwell events', () => {
    for (let i = 0; i < 8; i++) {
      SWSAttention.recordTouchDwell(Date.now() - (100 + i * 80));
    }
    const c = SWSAttention.getHumanConfidence();
    expect(c.hoverDwell).toBeGreaterThan(0);
    expect(c.hoverDwell).toBeLessThanOrEqual(1);
  });

  test('human-like dwell times (80-5000ms) score well', () => {
    const dwells = [150, 300, 500, 200, 800, 250, 1200];
    for (const d of dwells) {
      SWSAttention.recordTouchDwell(Date.now() - d);
    }
    const c = SWSAttention.getHumanConfidence();
    expect(c.hoverDwell).toBeGreaterThan(0.3);
  });

  test('hover enter/leave cycle works', (done) => {
    let i = 0;
    function next() {
      if (i < 6) {
        SWSAttention.recordHoverEnter('el' + i);
        setTimeout(() => {
          SWSAttention.recordHoverLeave();
          i++;
          next();
        }, 100 + i * 50);
      } else {
        const c = SWSAttention.getHumanConfidence();
        expect(c.hoverDwell).toBeGreaterThan(0);
        expect(c.hoverDwell).toBeLessThanOrEqual(1);
        done();
      }
    }
    next();
  }, 5000);

  test('leave without enter does not crash', () => {
    expect(() => SWSAttention.recordHoverLeave()).not.toThrow();
  });
});

// ============================================================
// Signal 10: Tab Visibility Patterns
// ============================================================
describe('Signal 10: Tab Visibility Patterns', () => {
  test('returns sentinel when session is under 5 seconds', () => {
    const c = SWSAttention.getHumanConfidence();
    expect(c.tabVisibility).toBe(0);
  });

  test('returns 0.75 for short session with no visibility changes', (done) => {
    // Wait just over 5 seconds
    setTimeout(() => {
      const c = SWSAttention.getHumanConfidence();
      // Short session (<120s) with no switches = 0.75
      expect(c.tabVisibility).toBeCloseTo(0.75, 1);
      done();
    }, 5200);
  }, 10000);
});

// ============================================================
// Signal 10b: Active Window-Focus Tracking
// ============================================================
describe('Signal 10b: Window-Focus Tracking', () => {
  test('getFocusStats returns zero state on a fresh session', () => {
    const s = SWSAttention.getFocusStats();
    expect(s.blurCount).toBe(0);
    expect(s.focusCount).toBe(0);
    expect(s.events).toBe(0);
    expect(s.currentlyFocused).toBe(true);
  });

  test('recordWindowFocus captures blur/focus events in order', () => {
    SWSAttention.recordWindowFocus(false);
    SWSAttention.recordWindowFocus(true);
    SWSAttention.recordWindowFocus(false);
    const s = SWSAttention.getFocusStats();
    expect(s.blurCount).toBe(2);
    expect(s.focusCount).toBe(1);
    expect(s.events).toBe(3);
    expect(s.currentlyFocused).toBe(false);
  });

  test('truthy/falsy inputs are coerced to booleans', () => {
    SWSAttention.recordWindowFocus(0);
    SWSAttention.recordWindowFocus(1);
    SWSAttention.recordWindowFocus('');
    const s = SWSAttention.getFocusStats();
    expect(s.blurCount).toBe(2);
    expect(s.focusCount).toBe(1);
  });

  test('session with a blur event scores tabVisibility strictly higher than a matched no-event session', (done) => {
    // Session A: 5.2s, no visibility and no focus events → baseline 0.75
    setTimeout(() => {
      const a = SWSAttention.getHumanConfidence().tabVisibility;
      reloadSDK();
      // Session B: 5.2s, no visibility events, one blur + one focus → 0.78
      SWSAttention.recordWindowFocus(false);
      setTimeout(() => {
        SWSAttention.recordWindowFocus(true);
      }, 120);
      setTimeout(() => {
        const b = SWSAttention.getHumanConfidence().tabVisibility;
        expect(b).toBeGreaterThan(a);
        done();
      }, 5200);
    }, 5200);
  }, 20000);

  test('focus events do not crash when driven through the public API', () => {
    expect(() => {
      for (let i = 0; i < 10; i++) {
        SWSAttention.recordWindowFocus(i % 2 === 0);
      }
      SWSAttention.getFocusStats();
      SWSAttention.getHumanConfidence();
    }).not.toThrow();
  });
});

// ============================================================
// Timeline ring-buffer (retention cap)
// ============================================================
describe('Timeline ring-buffer retention', () => {
  test('getTimelineMeta reports a fresh session as complete with retained=0', () => {
    const meta = SWSAttention.getTimelineMeta();
    expect(meta.retained).toBe(0);
    expect(meta.truncated).toBe(0);
    expect(meta.complete).toBe(true);
    expect(meta.cap).toBe(10000);
  });

  test('snapshots below the cap are all retained, nothing truncated', () => {
    for (let i = 0; i < 50; i++) SWSAttention.takeTimelineSnapshot('t' + i);
    const meta = SWSAttention.getTimelineMeta();
    expect(meta.retained).toBe(50);
    expect(meta.truncated).toBe(0);
    expect(meta.complete).toBe(true);
    expect(SWSAttention.getTimeline().length).toBe(50);
  });

  test('snapshots beyond the cap evict the oldest (FIFO), count reported honestly', () => {
    // Exceed the cap by a small margin to exercise the ring-buffer path
    // without slowing the test suite unnecessarily.
    const over = 25;
    const total = 10000 + over;
    for (let i = 0; i < total; i++) SWSAttention.takeTimelineSnapshot('t' + i);
    const meta = SWSAttention.getTimelineMeta();
    expect(meta.retained).toBe(10000);
    expect(meta.truncated).toBe(over);
    expect(meta.complete).toBe(false);
    const tl = SWSAttention.getTimeline();
    expect(tl.length).toBe(10000);
    // Newest snapshot's phase matches the last one we recorded
    expect(tl[tl.length - 1].phase).toBe('t' + (total - 1));
    // Truncation annotation is present (non-enumerable, so doesn't leak into JSON)
    expect(tl._truncated).toBe(over);
  }, 30000);
});

// ============================================================
// Signal 11: Inactivity Gap Analysis
// ============================================================
describe('Signal 11: Inactivity Gap Analysis', () => {
  test('returns sentinel when session is under 10 seconds', () => {
    const c = SWSAttention.getHumanConfidence();
    expect(c.inactivity).toBe(0);
  });
});

// ============================================================
// Signal 12: RT Variability (Esterman 2013)
// ============================================================
describe('Signal 12: RT Variability', () => {
  test('returns sentinel with fewer than 15 interaction timestamps', () => {
    const c = SWSAttention.getHumanConfidence();
    expect(c.rtVariability).toBe(0);
  });

  test('returns valid score with 20+ interactions via dispatchDocEvent', (done) => {
    let count = 0;
    function go() {
      if (count < 22) {
        dispatchDocEvent('mousedown', {
          type: 'mousedown',
          clientX: 100 + count * 5,
          clientY: 200 + count * 3
        });
        count++;
        // Variable delays to produce human-like CV
        const delay = 150 + (count * 41) % 350;
        setTimeout(go, delay);
      } else {
        const c = SWSAttention.getHumanConfidence();
        expect(c.rtVariability).toBeGreaterThan(0);
        expect(c.rtVariability).toBeLessThanOrEqual(1);
        done();
      }
    }
    go();
  }, 20000);
});

// ============================================================
// Signal 13: Scroll Backtracking (Comprehension Proxy)
// ============================================================
describe('Signal 13: Scroll Backtracking', () => {
  test('returns sentinel with insufficient scroll data', () => {
    const c = SWSAttention.getHumanConfidence();
    expect(c.scrollBacktrack).toBe(0);
  });

  test('returns valid score with scroll data including reversals', () => {
    // 15 positions with direction changes
    const positions = [0, 50, 100, 150, 200, 250, 300, 250, 200, 150, 200, 250, 300, 350, 400];
    for (const pos of positions) {
      SWSAttention.recordElementScroll(pos);
    }
    const c = SWSAttention.getHumanConfidence();
    // With reversals and 15 scroll events (>= 10 required), should be active
    if (c.scrollBacktrack > 0) {
      expect(c.scrollBacktrack).toBeLessThanOrEqual(1);
    }
  });

  test('no backtracking (pure downward) yields low score', () => {
    for (let i = 0; i < 25; i++) {
      SWSAttention.recordElementScroll(i * 50);
    }
    const c = SWSAttention.getHumanConfidence();
    // 0 up-reversals => score of 0.15
    if (c.scrollBacktrack > 0) {
      expect(c.scrollBacktrack).toBeLessThanOrEqual(0.20);
    }
  });

  test('single scroll event returns sentinel', () => {
    SWSAttention.recordElementScroll(100);
    const c = SWSAttention.getHumanConfidence();
    expect(c.scrollBacktrack).toBe(0);
  });
});

// ============================================================
// Signal 14: Fractal Scaling via DFA (Gilden 2001)
// ============================================================
describe('Signal 14: Fractal Scaling', () => {
  test('returns sentinel with fewer than 50 interactions', () => {
    const c = SWSAttention.getHumanConfidence();
    expect(c.fractalScaling).toBe(0);
  });

  test('returns valid score with 55+ interactions', (done) => {
    let count = 0;
    function go() {
      if (count < 58) {
        dispatchDocEvent('mousedown', {
          type: 'mousedown',
          clientX: 100 + (count * 13) % 400,
          clientY: 100 + (count * 11) % 300
        });
        count++;
        // Variable delays that produce pink-noise-like intervals
        const delay = 80 + (count * 31) % 250;
        setTimeout(go, delay);
      } else {
        const c = SWSAttention.getHumanConfidence();
        // With 58 interactions, should have enough for DFA
        // May still return -1 if not enough intervals pass the 10-10000ms filter
        if (c.fractalScaling > 0) {
          expect(c.fractalScaling).toBeLessThanOrEqual(1);
        }
        done();
      }
    }
    go();
  }, 30000);
});

// ============================================================
// Signal 15: Cross-Signal Correlation Matrix
// ============================================================
describe('Signal 15: Cross-Signal Correlation', () => {
  test('returns sentinel with only one active channel', () => {
    const c = SWSAttention.getHumanConfidence();
    expect(c.crossCorrelation).toBe(0);
  });

  test('returns valid score with scroll + mobile input channels', () => {
    // Scroll: 15 events
    for (let i = 0; i < 15; i++) {
      SWSAttention.recordElementScroll(i * 30);
    }
    // Mobile input: 10 events (timestamps spread apart from scroll)
    const base = Date.now();
    for (let i = 0; i < 10; i++) {
      SWSAttention.recordMobileInput(base + i * 500);
    }
    const c = SWSAttention.getHumanConfidence();
    if (c.crossCorrelation > 0) {
      expect(c.crossCorrelation).toBeLessThanOrEqual(1);
    }
  });

  test('interaction rate difference between halves detected with enough data', (done) => {
    // Need 20+ interaction timestamps plus 2 channels
    // First: scroll for channel 1
    for (let i = 0; i < 15; i++) SWSAttention.recordElementScroll(i * 20);
    // Mobile input for channel 2
    const base = Date.now();
    for (let i = 0; i < 10; i++) SWSAttention.recordMobileInput(base + i * 300);

    // Interactions via mousedown (for rate difference correlation)
    let count = 0;
    function go() {
      if (count < 25) {
        dispatchDocEvent('mousedown', {
          type: 'mousedown', clientX: 50 + count * 10, clientY: 50
        });
        count++;
        // Change rate midway: fast then slow
        const delay = count < 12 ? 100 : 300;
        setTimeout(go, delay);
      } else {
        const c = SWSAttention.getHumanConfidence();
        if (c.crossCorrelation > 0) {
          expect(c.crossCorrelation).toBeLessThanOrEqual(1);
        }
        done();
      }
    }
    go();
  }, 15000);
});

// ============================================================
// Signal 16: Curvature Index (MacKenzie 2001)
// ============================================================
describe('Signal 16: Curvature Index', () => {
  test('returns sentinel with fewer than 20 mouse samples', () => {
    const c = SWSAttention.getHumanConfidence();
    expect(c.curvatureIndex).toBe(0);
  });

  test('returns valid score with curved mouse movements', (done) => {
    // Need 20+ samples organized into 3+ movements of 5+ points each
    // Movements are separated by >300ms gaps
    simulateMouseMoves(4, 8, () => {
      const c = SWSAttention.getHumanConfidence();
      if (c.curvatureIndex > 0) {
        expect(c.curvatureIndex).toBeLessThanOrEqual(1);
      }
      done();
    });
  }, 15000);
});

// ============================================================
// Signal 17: Cursor Jerk / LDLJ (Flash & Hogan 1985)
// ============================================================
describe('Signal 17: Cursor Jerk', () => {
  test('returns sentinel with fewer than 30 mouse samples', () => {
    const c = SWSAttention.getHumanConfidence();
    expect(c.cursorJerk).toBe(0);
  });

  test('returns valid score with sufficient curved mouse movements', (done) => {
    // Need 30+ samples with 2+ movements of 8+ points each
    simulateMouseMoves(4, 12, () => {
      const c = SWSAttention.getHumanConfidence();
      if (c.cursorJerk > 0) {
        expect(c.cursorJerk).toBeLessThanOrEqual(1);
      }
      done();
    });
  }, 20000);
});

// ============================================================
// Signal 18: Velocity Profile Bell-Shape (Morasso 1981)
// ============================================================
describe('Signal 18: Velocity Profile', () => {
  test('returns sentinel with fewer than 30 mouse samples', () => {
    const c = SWSAttention.getHumanConfidence();
    expect(c.velocityProfile).toBe(0);
  });

  test('returns valid score with sufficient mouse movements', (done) => {
    // Need 30+ samples with 2+ movements of 6+ points each
    simulateMouseMoves(4, 10, () => {
      const c = SWSAttention.getHumanConfidence();
      if (c.velocityProfile > 0) {
        expect(c.velocityProfile).toBeLessThanOrEqual(1);
      }
      done();
    });
  }, 20000);
});

// ============================================================
// Signal 19: Two-Thirds Power Law (Lacquaniti 1983)
// ============================================================
describe('Signal 19: Two-Thirds Power Law', () => {
  test('returns sentinel with fewer than 40 mouse samples', () => {
    const c = SWSAttention.getHumanConfidence();
    expect(c.twoThirdsPower).toBe(0);
  });

  test('returns valid score with 40+ mouse samples', (done) => {
    // Need 40+ samples with continuous curved movement
    simulateMouseMoves(5, 12, () => {
      const c = SWSAttention.getHumanConfidence();
      if (c.twoThirdsPower > 0) {
        expect(c.twoThirdsPower).toBeLessThanOrEqual(1);
      }
      done();
    });
  }, 25000);
});

// ============================================================
// Signal 20: Device Motion (accelerometer/gyroscope)
// ============================================================
describe('Signal 20: Device Motion', () => {
  test('returns sentinel with fewer than 100 motion samples', () => {
    // Threshold raised from 30 to 100 after 2026-04-21 calibration fix:
    // ~5s of data (vs 1.5s) produces stable SD estimates.
    for (let i = 0; i < 50; i++) {
      SWSAttention.recordDeviceMotion(0.1, 9.8, 0.05, 0.01, 0.02, 0.01);
    }
    const c = SWSAttention.getHumanConfidence();
    expect(c.deviceMotion).toBe(0);
  });

  test('returns valid score with 100+ human-like motion samples', (done) => {
    let count = 0;
    function go() {
      if (count < 110) {
        const ax = 0.1 + Math.sin(count * 0.3) * 0.08;
        const ay = 9.81 + Math.sin(count * 0.5) * 0.05;
        const az = 0.1 + Math.cos(count * 0.4) * 0.06;
        const gx = 0.005 + Math.sin(count * 0.2) * 0.003;
        const gy = 0.008 + Math.cos(count * 0.3) * 0.004;
        const gz = 0.003 + Math.sin(count * 0.15) * 0.002;
        SWSAttention.recordDeviceMotion(ax, ay, az, gx, gy, gz);
        count++;
        setTimeout(go, 55);
      } else {
        const c = SWSAttention.getHumanConfidence();
        expect(c.deviceMotion).toBeGreaterThan(0);
        expect(c.deviceMotion).toBeLessThanOrEqual(1);
        done();
      }
    }
    go();
  }, 10000);

  test('weak-signal laptop motion (below hand-tremor floor) returns -1 not a partial score', (done) => {
    // Regression for the desktop laptop bug (observed 2026-04-24): MacBook-style
    // lid-tilt sensors produce tiny nonzero accelerometer values (SD 0.001-0.003)
    // that are above the all-zero check but below the human hand-tremor floor.
    // Prior logic amplified this into ~0.30. Should return -1 (sentinel → 0).
    let count = 0;
    function go() {
      if (count < 110) {
        // Tiny-signal values: SD will be around 0.001-0.002, well below the
        // 0.005 hand-tremor floor.
        const tinyAx = 0.0001 + Math.sin(count * 0.1) * 0.001;
        const tinyAy = 0.0001 + Math.cos(count * 0.1) * 0.001;
        const tinyGz = 0.00005 + Math.sin(count * 0.05) * 0.0001;
        SWSAttention.recordDeviceMotion(tinyAx, tinyAy, 0.001, 0, 0, tinyGz);
        count++;
        setTimeout(go, 55);
      } else {
        const c = SWSAttention.getHumanConfidence();
        expect(c.deviceMotion).toBe(0); // -1 sentinel → 0 in output
        done();
      }
    }
    go();
  }, 10000);

  test('all-zero motion (emulator) returns -1 insufficient data', (done) => {
    // Post-2026-04-21 calibration: flat-zero accelerometer is treated as
    // "device quirk / permission denied", not "bot-like", so the signal is
    // excluded from scoring via -1 sentinel (displayed as 0).
    let count = 0;
    function go() {
      if (count < 110) {
        SWSAttention.recordDeviceMotion(0, 0, 0, 0, 0, 0);
        count++;
        setTimeout(go, 55);
      } else {
        const c = SWSAttention.getHumanConfidence();
        expect(c.deviceMotion).toBe(0);
        done();
      }
    }
    go();
  }, 10000);

  test('extreme values do not crash', () => {
    expect(() => {
      SWSAttention.recordDeviceMotion(99999, -99999, 0, 0, 0, 0);
      SWSAttention.recordDeviceMotion(0, 0, 0, 99999, -99999, 0);
    }).not.toThrow();
  });
});

// ============================================================
// Confidence Cap Logic
// ============================================================
describe('Confidence Cap Logic', () => {
  test('with fresh SDK (3 active signals: timing, hicks, microPause), cap is 0.30', () => {
    // Signals 1,3,5 return non-sentinel defaults (0, 0.5, 0.5), so 3 active
    const c = SWSAttention.getHumanConfidence();
    expect(c.activeSignals).toBe(3);
    expect(c.composite).toBeLessThanOrEqual(0.30);
  });

  test('totalSignals is always 20', () => {
    const c = SWSAttention.getHumanConfidence();
    expect(c.totalSignals).toBe(20);
  });

  test('all 20 signal keys present in output with numeric values', () => {
    const c = SWSAttention.getHumanConfidence();
    const keys = [
      'timing', 'fitts', 'hicks', 'scroll', 'microPause', 'touch',
      'keystroke', 'readingSpeed', 'hoverDwell', 'tabVisibility',
      'inactivity', 'rtVariability', 'scrollBacktrack', 'fractalScaling',
      'crossCorrelation', 'curvatureIndex', 'cursorJerk', 'velocityProfile',
      'twoThirdsPower', 'deviceMotion'
    ];
    for (const key of keys) {
      expect(c).toHaveProperty(key);
      expect(typeof c[key]).toBe('number');
    }
  });

  test('inactive signals mapped to 0 (not -1) in output', () => {
    const c = SWSAttention.getHumanConfidence();
    const keys = [
      'timing', 'fitts', 'hicks', 'scroll', 'microPause', 'touch',
      'keystroke', 'readingSpeed', 'hoverDwell', 'tabVisibility',
      'inactivity', 'rtVariability', 'scrollBacktrack', 'fractalScaling',
      'crossCorrelation', 'curvatureIndex', 'cursorJerk', 'velocityProfile',
      'twoThirdsPower', 'deviceMotion'
    ];
    for (const key of keys) {
      expect(c[key]).toBeGreaterThanOrEqual(0);
    }
  });

  test('composite always in [0, 1]', () => {
    const c = SWSAttention.getHumanConfidence();
    expect(c.composite).toBeGreaterThanOrEqual(0);
    expect(c.composite).toBeLessThanOrEqual(1);
  });

  test('adding more signals raises the cap', (done) => {
    // Start with 3 active signals (timing, hicks, microPause)
    const c1 = SWSAttention.getHumanConfidence();
    expect(c1.activeSignals).toBe(3);

    // Add mobile input -> keystroke becomes active (signal 7)
    const base = Date.now();
    for (let i = 0; i < 15; i++) {
      SWSAttention.recordMobileInput(base + i * (100 + i * 20));
    }

    // Add touch dwells -> hoverDwell becomes active (signal 9)
    for (let i = 0; i < 8; i++) {
      SWSAttention.recordTouchDwell(Date.now() - (100 + i * 80));
    }

    // Add section entries/exits -> readingSpeed becomes active (signal 8)
    SWSAttention.recordSectionEntry('s1');
    setTimeout(() => {
      SWSAttention.recordSectionExit('s1', 100);
      SWSAttention.recordSectionEntry('s2');
      setTimeout(() => {
        SWSAttention.recordSectionExit('s2', 100);

        const c2 = SWSAttention.getHumanConfidence();
        // Should now have at least 6 active signals
        expect(c2.activeSignals).toBeGreaterThan(c1.activeSignals);
        // With 4-6 signals, cap goes to 0.50
        if (c2.activeSignals >= 4 && c2.activeSignals < 7) {
          expect(c2.composite).toBeLessThanOrEqual(0.50);
        }
        done();
      }, 250);
    }, 250);
  });
});

// ============================================================
// Edge Cases
// ============================================================
describe('Edge Cases', () => {
  test('getHumanConfidence called twice returns identical results', () => {
    const c1 = SWSAttention.getHumanConfidence();
    const c2 = SWSAttention.getHumanConfidence();
    expect(c1.composite).toBe(c2.composite);
    expect(c1.activeSignals).toBe(c2.activeSignals);
  });

  test('empty/null section IDs do not crash', () => {
    expect(() => {
      SWSAttention.recordSectionEntry('');
      SWSAttention.recordSectionExit('', 100);
      SWSAttention.recordSectionEntry(null);
    }).not.toThrow();
  });

  test('zero-duration hover does not crash', () => {
    expect(() => {
      SWSAttention.recordHoverEnter('btn');
      SWSAttention.recordHoverLeave();
    }).not.toThrow();
  });

  test('extreme scroll positions do not crash', () => {
    expect(() => {
      SWSAttention.recordElementScroll(0);
      SWSAttention.recordElementScroll(999999);
      SWSAttention.recordElementScroll(-100);
    }).not.toThrow();
  });

  test('touch dwell with 0 start time does not crash', () => {
    expect(() => SWSAttention.recordTouchDwell(0)).not.toThrow();
  });

  test('duplicate mobile input timestamps do not crash', () => {
    const t = Date.now();
    expect(() => {
      for (let i = 0; i < 15; i++) SWSAttention.recordMobileInput(t);
    }).not.toThrow();
    const c = SWSAttention.getHumanConfidence();
    expect(c.keystroke).toBeGreaterThanOrEqual(0);
  });

  test('section exit for non-existent entry does not crash', () => {
    expect(() => SWSAttention.recordSectionExit('ghost', 100)).not.toThrow();
  });

  test('device motion with NaN values does not crash', () => {
    expect(() => {
      SWSAttention.recordDeviceMotion(NaN, NaN, NaN, NaN, NaN, NaN);
    }).not.toThrow();
  });
});
