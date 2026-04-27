/**
 * SWS Attention Protocol — Receipt-wide Gated Composite Test Suite
 *
 * Verifies:
 *   - No-gate path: final == behavioral when no layer flags
 *   - Environmental gate caps on bot detection
 *   - Composition gates: pasted, mechanical, suspicious
 *   - Honeypot gate caps on canary trip
 *   - Multiple gates compose via min-cap (no double-penalty stacking)
 *   - Input defensiveness: missing/null/NaN behavioral, partial inputs
 *   - Authored + not-bot + not-tripped leaves final unchanged
 *   - Gates-applied provenance is accurate
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */

const { computeFinalComposite, tierForScore, DEFAULT_GATES, VERSION } =
  require('../src/sdk/receipt-composite');

describe('receipt-composite — no gates triggered', () => {
  test('no layers → final equals behavioral', () => {
    const r = computeFinalComposite({ behavioralComposite: 0.62 });
    expect(r.finalComposite).toBeCloseTo(0.62, 10);
    expect(r.behavioralComposite).toBeCloseTo(0.62, 10);
    expect(r.gatesApplied).toEqual([]);
    expect(r.tierFinal).toBe('active');
    expect(r.version).toBe(VERSION);
  });

  test('environmental.bot=false + authored + honeypot not tripped → no gate', () => {
    const r = computeFinalComposite({
      behavioralComposite: 0.573,
      environmental: { loaded: true, bot: false, detector: 'botd@v2' },
      compositionIntegrity: { verdict: 'authored', score: 0.92 },
      honeypot: { tripped: false }
    });
    expect(r.finalComposite).toBeCloseTo(0.573, 10);
    expect(r.gatesApplied).toEqual([]);
    expect(r.tierFinal).toBe('active');
  });

  test('environmental explicitly unresolved → unresolved cap fires (round-2 hardening)', () => {
    // Round-2 hostile-review finding: an attacker who monkey-patches
    // SWSEnvironmentalGate.check() to return {loaded:false, error:...}
    // previously evaded the cap because the gate only fired on
    // affirmative bot===true. cme-demo.html had its own
    // 'environmental:unresolved' branch (commit fef4c20) but the shared
    // SDK module did not. Now the module fires the same defense.
    // Distinct from absence-of-env (caller didn't integrate env at all),
    // which remains uncapped — see the next test.
    const r = computeFinalComposite({
      behavioralComposite: 0.70,
      environmental: { loaded: false, bot: null, error: 'lib_missing' }
    });
    expect(r.finalComposite).toBeCloseTo(0.30, 10);
    expect(r.gatesApplied).toHaveLength(1);
    expect(r.gatesApplied[0].layer).toBe('environmental');
    expect(r.gatesApplied[0].reason).toBe('unresolved:error');
    expect(r.gatesApplied[0].cap).toBeCloseTo(0.30, 10);
  });

  test('environmental absent (caller did not integrate) → no gate', () => {
    // Distinct from the unresolved case above: when env is null /
    // undefined the caller deliberately did not integrate the env-gate
    // (e.g., a vertical that is inherently human-only or runs in an
    // environment where BotD cannot be loaded). No cap fires.
    const r = computeFinalComposite({
      behavioralComposite: 0.70,
      environmental: null
    });
    expect(r.finalComposite).toBeCloseTo(0.70, 10);
    expect(r.gatesApplied).toEqual([]);
  });

  test('composition verdict unknown → no gate', () => {
    const r = computeFinalComposite({
      behavioralComposite: 0.65,
      compositionIntegrity: { verdict: 'unknown' }
    });
    expect(r.finalComposite).toBeCloseTo(0.65, 10);
    expect(r.gatesApplied).toEqual([]);
  });
});

describe('receipt-composite — single gate triggers', () => {
  test('environmental bot flagged → final <= 0.30', () => {
    const r = computeFinalComposite({
      behavioralComposite: 0.569,
      environmental: { loaded: true, bot: true, botKind: 'headless_chrome' }
    });
    expect(r.finalComposite).toBeCloseTo(0.30, 10);
    expect(r.behavioralComposite).toBeCloseTo(0.569, 10);
    expect(r.gatesApplied).toHaveLength(1);
    expect(r.gatesApplied[0].layer).toBe('environmental');
    expect(r.gatesApplied[0].reason).toBe('bot_detected:headless_chrome');
    expect(r.gatesApplied[0].cap).toBe(DEFAULT_GATES.environmentalBot);
    expect(r.tierFinal).toBe('passive');
  });

  test('composition pasted → final <= 0.40', () => {
    const r = computeFinalComposite({
      behavioralComposite: 0.55,
      compositionIntegrity: { verdict: 'pasted', score: 0.40 }
    });
    expect(r.finalComposite).toBeCloseTo(0.40, 10);
    expect(r.gatesApplied).toHaveLength(1);
    expect(r.gatesApplied[0].reason).toBe('pasted');
  });

  test('composition mechanical → final <= 0.40', () => {
    const r = computeFinalComposite({
      behavioralComposite: 0.50,
      compositionIntegrity: { verdict: 'mechanical', score: 0.25 }
    });
    expect(r.finalComposite).toBeCloseTo(0.40, 10);
    expect(r.gatesApplied[0].reason).toBe('mechanical');
  });

  test('composition suspicious → final <= 0.50', () => {
    const r = computeFinalComposite({
      behavioralComposite: 0.72,
      compositionIntegrity: { verdict: 'suspicious' }
    });
    expect(r.finalComposite).toBeCloseTo(0.50, 10);
    expect(r.gatesApplied[0].reason).toBe('suspicious');
  });

  test('honeypot tripped → final <= 0.25', () => {
    const r = computeFinalComposite({
      behavioralComposite: 0.80,
      honeypot: { tripped: true, strategiesUsed: ['css_hidden', 'html_comment'] }
    });
    expect(r.finalComposite).toBeCloseTo(0.25, 10);
    expect(r.gatesApplied[0].layer).toBe('honeypot');
    expect(r.gatesApplied[0].reason).toBe('canary_tripped');
    expect(r.tierFinal).toBe('background');
  });

  test('behavioral already below cap → final == behavioral (cap does not raise)', () => {
    const r = computeFinalComposite({
      behavioralComposite: 0.15,
      environmental: { loaded: true, bot: true, botKind: 'headless_chrome' }
    });
    expect(r.finalComposite).toBeCloseTo(0.15, 10);
    expect(r.gatesApplied).toHaveLength(1);
  });
});

describe('receipt-composite — multi-gate composition', () => {
  test('env bot + composition pasted + honeypot tripped → min-cap wins (honeypot 0.25)', () => {
    const r = computeFinalComposite({
      behavioralComposite: 0.90,
      environmental: { loaded: true, bot: true, botKind: 'headless_chrome' },
      compositionIntegrity: { verdict: 'pasted' },
      honeypot: { tripped: true }
    });
    expect(r.finalComposite).toBeCloseTo(0.25, 10);
    expect(r.gatesApplied).toHaveLength(3);
    const reasons = r.gatesApplied.map(g => g.reason).sort();
    expect(reasons).toEqual(['canary_tripped', 'bot_detected:headless_chrome', 'pasted'].sort());
  });

  test('env bot + composition authored → only env gate applies', () => {
    const r = computeFinalComposite({
      behavioralComposite: 0.55,
      environmental: { loaded: true, bot: true, botKind: 'headless_chrome' },
      compositionIntegrity: { verdict: 'authored' }
    });
    expect(r.finalComposite).toBeCloseTo(0.30, 10);
    expect(r.gatesApplied).toHaveLength(1);
    expect(r.gatesApplied[0].layer).toBe('environmental');
  });
});

describe('receipt-composite — input defensiveness', () => {
  test('empty inputs → final 0, no gates, tier background', () => {
    const r = computeFinalComposite({});
    expect(r.finalComposite).toBe(0);
    expect(r.behavioralComposite).toBe(0);
    expect(r.gatesApplied).toEqual([]);
    expect(r.tierFinal).toBe('background');
  });

  test('NaN behavioral clamps to 0', () => {
    const r = computeFinalComposite({ behavioralComposite: NaN });
    expect(r.finalComposite).toBe(0);
    expect(r.behavioralComposite).toBe(0);
  });

  test('behavioral > 1 clamps to 1', () => {
    const r = computeFinalComposite({ behavioralComposite: 1.5 });
    expect(r.behavioralComposite).toBe(1);
    expect(r.finalComposite).toBe(1);
  });

  test('behavioral < 0 clamps to 0', () => {
    const r = computeFinalComposite({ behavioralComposite: -0.2 });
    expect(r.behavioralComposite).toBe(0);
    expect(r.finalComposite).toBe(0);
  });

  test('null inputs for optional fields → no gates', () => {
    const r = computeFinalComposite({
      behavioralComposite: 0.50,
      environmental: null,
      compositionIntegrity: null,
      honeypot: null
    });
    expect(r.finalComposite).toBeCloseTo(0.50, 10);
    expect(r.gatesApplied).toEqual([]);
  });

  test('no arguments → empty-inputs behavior', () => {
    const r = computeFinalComposite();
    expect(r.finalComposite).toBe(0);
    expect(r.behavioralComposite).toBe(0);
  });

  test('custom gate override respected', () => {
    const r = computeFinalComposite({
      behavioralComposite: 0.90,
      environmental: { loaded: true, bot: true, botKind: 'x' },
      gates: { environmentalBot: 0.15 }
    });
    expect(r.finalComposite).toBeCloseTo(0.15, 10);
  });

  test('gates_overridden surfaced in result when caller passes gates (round-2 hardening)', () => {
    // Round-2 finding: caller-supplied gates override defaults silently.
    // Now the result advertises gatesOverridden=true so a decision-grade
    // verifier can reject. Mirrors calibration_override pattern.
    const overridden = computeFinalComposite({
      behavioralComposite: 0.90,
      environmental: { loaded: true, bot: false },
      gates: { environmentalBot: 0.15 }
    });
    expect(overridden.gatesOverridden).toBe(true);

    const defaulted = computeFinalComposite({
      behavioralComposite: 0.90,
      environmental: { loaded: true, bot: false }
    });
    expect(defaulted.gatesOverridden).toBe(false);
  });
});

describe('tierForScore — threshold boundaries (match attention-protocol.js#getMaxTier)', () => {
  test('score > 0.75 → deep', () => {
    expect(tierForScore(0.80)).toBe('deep');
    expect(tierForScore(0.76)).toBe('deep');
  });
  test('0.50 < score <= 0.75 → active', () => {
    expect(tierForScore(0.75)).toBe('active');
    expect(tierForScore(0.573)).toBe('active');
    expect(tierForScore(0.51)).toBe('active');
  });
  test('0.25 < score <= 0.50 → passive', () => {
    expect(tierForScore(0.50)).toBe('passive');
    expect(tierForScore(0.30)).toBe('passive');
    expect(tierForScore(0.26)).toBe('passive');
  });
  test('score <= 0.25 → background', () => {
    expect(tierForScore(0.25)).toBe('background');
    expect(tierForScore(0.10)).toBe('background');
    expect(tierForScore(0)).toBe('background');
  });
  test('non-number → unknown', () => {
    expect(tierForScore(null)).toBe('unknown');
    expect(tierForScore(undefined)).toBe('unknown');
    expect(tierForScore(NaN)).toBe('unknown');
    expect(tierForScore('high')).toBe('unknown');
  });
});

describe('receipt-composite — Apr 21 bot-harness scenario regression', () => {
  test('LLM Paster: behavioral 0.569 + env bot + composition pasted → final 0.30', () => {
    const r = computeFinalComposite({
      behavioralComposite: 0.569,
      environmental: { loaded: true, bot: true, botKind: 'headless_chrome' },
      compositionIntegrity: { verdict: 'pasted', score: 0.40 }
    });
    expect(r.finalComposite).toBeCloseTo(0.30, 10);
    expect(r.tierFinal).toBe('passive');
  });

  test('Stephen (human): behavioral 0.573 + env human + composition authored → final 0.573', () => {
    const r = computeFinalComposite({
      behavioralComposite: 0.573,
      environmental: { loaded: true, bot: false },
      compositionIntegrity: { verdict: 'authored', score: 0.92 }
    });
    expect(r.finalComposite).toBeCloseTo(0.573, 10);
    expect(r.tierFinal).toBe('active');
  });

  test('gap between LLM Paster and human is 0.273 (was 0.004 pre-gate)', () => {
    const bot = computeFinalComposite({
      behavioralComposite: 0.569,
      environmental: { loaded: true, bot: true, botKind: 'headless_chrome' },
      compositionIntegrity: { verdict: 'pasted' }
    });
    const human = computeFinalComposite({
      behavioralComposite: 0.573,
      environmental: { loaded: true, bot: false },
      compositionIntegrity: { verdict: 'authored' }
    });
    const gap = human.finalComposite - bot.finalComposite;
    expect(gap).toBeCloseTo(0.273, 3);
  });
});
