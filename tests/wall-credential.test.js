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

/**
 * Gate-0 hash-coverage tests (Class 5 + Class 10 from 2026-05-27 audit).
 *
 * Prior to the fix, the receiptHash input was {session_id, engagement, hv,
 * at}. That excluded subject, environmental, composition_integrity, consent,
 * and issuer — fields that appear in the signed credentialSubject and that
 * the buyer-facing story treats as "tamper-evident." An external audit
 * produced a working PoC showing two receipts with swapped uid + flipped
 * bot + flipped verdict + revoked consent producing IDENTICAL receiptHash.
 *
 * Additionally, walledOutcome used truthy-guards inside hv, so an empty-
 * shape walledOutcome ({trust_tier:null, server_recompute:null,
 * bounds_violations:[], trace_novelty:null}) collided with walledOutcome=
 * undefined — a "we ran the wall and it was clean" claim was hash-
 * indistinguishable from "we never ran the wall."
 *
 * Both classes fixed by extending the receiptHash JSON input to cover every
 * credentialSubject layer plus an explicit wallOutcomePresent boolean inside
 * hv. Tests below pin the fix.
 */
describe('buildCredential — receipt-hash content coverage (Class 5 + 10 fix)', () => {
  test('Class 10: empty-shape walledOutcome produces different hash than absent walledOutcome', () => {
    const credAbsent = buildCredential(baseSession);
    const credEmpty = buildCredential(baseSession, {
      trust_tier: null,
      server_recompute: null,
      bounds_violations: [],
      trace_novelty: null
    });
    expect(credAbsent.proof.receiptHash).not.toBe(credEmpty.proof.receiptHash);
  });

  test('Class 5: different uid (different subjectDid) produces different hash', () => {
    const credA = buildCredential({ ...baseSession, uid: 'alice' });
    const credB = buildCredential({ ...baseSession, uid: 'bob' });
    expect(credA.credentialSubject.id).not.toBe(credB.credentialSubject.id);
    expect(credA.proof.receiptHash).not.toBe(credB.proof.receiptHash);
  });

  test('Class 5: flipping environmental.bot produces different hash', () => {
    const credClean = buildCredential({
      ...baseSession,
      environmental: { loaded: true, bot: false }
    });
    const credBot = buildCredential({
      ...baseSession,
      environmental: { loaded: true, bot: true }
    });
    expect(credClean.proof.receiptHash).not.toBe(credBot.proof.receiptHash);
  });

  test('Class 5: flipping composition_integrity.verdict produces different hash', () => {
    const credAuthored = buildCredential({
      ...baseSession,
      composition_integrity: { verdict: 'authored', score: 0.85 }
    });
    const credPasted = buildCredential({
      ...baseSession,
      composition_integrity: { verdict: 'pasted', score: 0.20 }
    });
    expect(credAuthored.proof.receiptHash).not.toBe(credPasted.proof.receiptHash);
  });

  test('Class 5: adding consent produces different hash than no consent', () => {
    const credNoConsent = buildCredential(baseSession);
    const credWithConsent = buildCredential({
      ...baseSession,
      consent: {
        granted: true,
        categories: ['behavioral'],
        timestamp: '2026-05-27T00:00:00Z',
        version: 'v1'
      }
    });
    expect(credNoConsent.proof.receiptHash).not.toBe(credWithConsent.proof.receiptHash);
  });

  test('Full-tamper PoC (uid + bot + verdict + consent all flipped): hashes differ', () => {
    // This is the audit PoC. Before the fix, both produced identical
    // receiptHash 36a8806…1f31398.
    const credClean = buildCredential({
      ...baseSession,
      uid: 'alice',
      environmental: { loaded: true, bot: false },
      composition_integrity: { verdict: 'authored', score: 0.85 },
      consent: {
        granted: true,
        categories: ['behavioral'],
        timestamp: '2026-05-27T00:00:00Z',
        version: 'v1'
      }
    });
    const credTampered = buildCredential({
      ...baseSession,
      uid: 'mallory',
      environmental: { loaded: true, bot: true },
      composition_integrity: { verdict: 'pasted', score: 0.10 },
      consent: null
    });
    expect(credClean.proof.receiptHash).not.toBe(credTampered.proof.receiptHash);
  });

  test('hv.wallOutcomePresent flag tracks whether walledOutcome was passed', () => {
    const credAbsent = buildCredential(baseSession);
    const credEmpty = buildCredential(baseSession, {});
    const credFull = buildCredential(baseSession, {
      trust_tier: 'server_attested',
      server_recompute: { server_composite: 0.62, divergent: false }
    });
    expect(credAbsent.credentialSubject.humanVerification.wallOutcomePresent).toBe(false);
    expect(credEmpty.credentialSubject.humanVerification.wallOutcomePresent).toBe(true);
    expect(credFull.credentialSubject.humanVerification.wallOutcomePresent).toBe(true);
  });
});
