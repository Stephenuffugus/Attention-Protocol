/**
 * Tests for the WALL outcome embedded into the signed credential.
 *
 * proof/functions/index.js#buildCredential now accepts an optional
 * `walledOutcome` argument from onSessionWritten and embeds:
 *   - humanVerification.trustTier
 *   - humanVerification.serverRecompute
 *   - humanVerification.boundsViolations
 *
 * These are the fields verify.html / prove-humanness.html / verify-
 * offline.js consume to surface the wall's verdict to a downstream
 * verifier without needing the Firestore doc.
 *
 * The buildCredential function isn't directly exported (it's inside
 * the Cloud Functions module that loads firebase-functions). To test
 * it here, we extract the function source and eval it in a sandbox —
 * matches the pattern used by tests/sha256-fanout.test.js.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function loadBuildCredential() {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'proof', 'functions', 'index.js'),
    'utf8'
  );
  const start = src.indexOf('function buildCredential');
  if (start < 0) throw new Error('buildCredential not found');
  const openIdx = src.indexOf('{', start);
  let depth = 0, i = openIdx;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  const fnSource = src.slice(start, i + 1);
  // eslint-disable-next-line no-new-func
  return new Function('crypto', fnSource + '\nreturn buildCredential;')(crypto);
}

const buildCredential = loadBuildCredential();

const baseSession = {
  session_id: 'test_sess_001',
  uid: 'test_user',
  composite: 0.65,
  duration_ms: 180000,
  signals: { composite: 0.65, timing: 0.7 },
  environmental: { loaded: true, bot: false },
  composition_integrity: { verdict: 'authored', score: 0.85 }
};

describe('buildCredential — walledOutcome embedding', () => {
  test('without walledOutcome: humanVerification has no trust fields', () => {
    const cred = buildCredential(baseSession);
    const hv = cred.credentialSubject.humanVerification;
    expect(hv).toBeDefined();
    expect(hv.trustTier).toBeUndefined();
    expect(hv.serverRecompute).toBeUndefined();
    expect(hv.boundsViolations).toBeUndefined();
  });

  test('with server_attested outcome: all fields embedded', () => {
    const cred = buildCredential(baseSession, {
      trust_tier: 'server_attested',
      server_recompute: {
        server_composite: 0.62,
        divergence: 0.03,
        divergent: false,
        threshold: 0.20,
        version: 'server-scorer-v1'
      },
      bounds_violations: []
    });
    const hv = cred.credentialSubject.humanVerification;
    expect(hv.trustTier).toBe('server_attested');
    expect(hv.serverRecompute.server_composite).toBe(0.62);
    expect(hv.serverRecompute.divergent).toBe(false);
    // Empty bounds_violations array → field omitted (cleaner JSON).
    expect(hv.boundsViolations).toBeUndefined();
  });

  test('with bounds_violated outcome: violations array embedded', () => {
    const cred = buildCredential(baseSession, {
      trust_tier: 'client_attested_bounds_violated',
      server_recompute: {
        server_composite: 0.30,
        divergence: 0.65,
        divergent: true,
        threshold: 0.20,
        version: 'server-scorer-v1'
      },
      bounds_violations: ['high_composite_short_session_5s', 'server_recompute_divergent:client=0.95,server=0.30']
    });
    const hv = cred.credentialSubject.humanVerification;
    expect(hv.trustTier).toBe('client_attested_bounds_violated');
    expect(hv.serverRecompute.divergent).toBe(true);
    expect(hv.boundsViolations).toHaveLength(2);
    expect(hv.boundsViolations[0]).toMatch(/high_composite/);
  });

  test('with no_event_log tier: legacy SDK path tagged correctly', () => {
    const cred = buildCredential(baseSession, {
      trust_tier: 'client_attested_no_event_log',
      server_recompute: { ok: false, reason: 'event_log_absent' },
      bounds_violations: ['event_log_absent']
    });
    const hv = cred.credentialSubject.humanVerification;
    expect(hv.trustTier).toBe('client_attested_no_event_log');
    expect(hv.serverRecompute.ok).toBe(false);
    expect(hv.boundsViolations).toEqual(['event_log_absent']);
  });

  test('canonical receipt-hash differs between with/without walledOutcome', () => {
    // The receipt-hash is computed inside buildCredential; embedding
    // the wall outcome SHOULD change the hash (the outcome is now part
    // of the receipt's evidence). Confirms the wall is content-bound.
    const credPlain = buildCredential(baseSession);
    const credWalled = buildCredential(baseSession, {
      trust_tier: 'server_attested',
      server_recompute: { server_composite: 0.62, divergent: false }
    });
    expect(credPlain.proof.receiptHash).not.toBe(credWalled.proof.receiptHash);
  });
});
