/**
 * Round-6 fan-out regression test for THE WALL (R2-NEW-2).
 *
 * The pattern that has bitten 4 hostile rounds in a row: a fix lands
 * in one of N parallel implementations and the others silently fall
 * back to legacy behavior. Round-5 specifically caught the wall's
 * HTTP signReceipt endpoint signing without walledOutcome (complete
 * bypass) and demo.html missing the event-log.js script tag (silent
 * legacy escape).
 *
 * This test grep-asserts the fan-out invariants future drift would
 * violate, so CI fails BEFORE the next hostile review:
 *   1. Every signSessionReceipt call passes 4 args (the 4th being
 *      walledOutcome). Catches future signing paths that forget.
 *   2. Every HTML page loading attention-protocol.js also loads
 *      event-log.js. Catches future SDK-using surfaces that drop the
 *      recorder script.
 *   3. Every verifier surface (verify.html, prove-humanness.html,
 *      verify-offline.js) reads humanVerification.trustTier and
 *      humanVerification.serverRecompute and humanVerification.
 *      traceNovelty. Catches future verifier additions that miss the
 *      wall-outcome surface.
 *
 * Future drift fails CI rather than waiting for round 7.
 */
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');

describe('wall fan-out invariants (R6 codification of R3/R4/R5 lessons)', () => {
  test('every signSessionReceipt CALL passes 4 args (walledOutcome included)', () => {
    // Find all signSessionReceipt(...) call sites in proof/functions/.
    // The first definition is in index.js itself, so we exclude the
    // declaration line and only look at INVOCATIONS.
    const indexJs = fs.readFileSync(path.join(REPO, 'proof', 'functions', 'index.js'), 'utf8');
    // Match `signSessionReceipt(` and capture until the matching close
    // paren at the same depth. Allow multi-line.
    const callPattern = /(?<!async function |function )signSessionReceipt\s*\(/g;
    const callIndices = [];
    let m;
    while ((m = callPattern.exec(indexJs)) !== null) {
      callIndices.push(m.index);
    }
    expect(callIndices.length).toBeGreaterThanOrEqual(2); // at least HTTP + Firestore paths

    // For each call site, walk forward to the matching close paren and
    // count top-level commas — that gives the arg count.
    for (const startIdx of callIndices) {
      const openIdx = indexJs.indexOf('(', startIdx);
      let depth = 0, i = openIdx;
      let topLevelCommas = 0;
      for (; i < indexJs.length; i++) {
        const ch = indexJs[i];
        if (ch === '(' || ch === '{' || ch === '[') depth++;
        else if (ch === ')' || ch === '}' || ch === ']') {
          depth--;
          if (depth === 0) break;
        } else if (ch === ',' && depth === 1) {
          topLevelCommas++;
        }
      }
      const argCount = topLevelCommas + 1;
      const lineNo = indexJs.slice(0, startIdx).split('\n').length;
      // Expect 4 args: (clean, key, kid, walledOutcome). 3 args = the
      // round-5 CRITICAL bug pattern; future regression should fail.
      expect({ line: lineNo, argCount: argCount }).toEqual(
        expect.objectContaining({ argCount: 4 })
      );
    }
  });

  test('every HTML loading attention-protocol.js also loads event-log.js', () => {
    const proofDir = path.join(REPO, 'proof');
    const htmlFiles = fs.readdirSync(proofDir).filter(function(f) { return f.endsWith('.html'); });
    const violations = [];
    for (const f of htmlFiles) {
      const src = fs.readFileSync(path.join(proofDir, f), 'utf8');
      const loadsSDK = /sdk\/attention-protocol\.js/.test(src);
      const loadsEventLog = /sdk\/event-log\.js/.test(src);
      if (loadsSDK && !loadsEventLog) {
        violations.push(f);
      }
    }
    // Round-5 found demo.html missing event-log.js; this assertion
    // ensures any future SDK-using HTML page also loads the recorder.
    expect(violations).toEqual([]);
  });

  test('every verifier surface reads humanVerification.trustTier', () => {
    const surfaces = [
      'proof/verify.html',
      'proof/prove-humanness.html',
      'scripts/verify-offline.js'
    ];
    for (const rel of surfaces) {
      const src = fs.readFileSync(path.join(REPO, rel), 'utf8');
      // Must mention `trustTier` somewhere (consumed in verdict / banner /
      // claim-error path).
      expect({ surface: rel, mentionsTrustTier: src.includes('trustTier') })
        .toEqual(expect.objectContaining({ mentionsTrustTier: true }));
    }
  });

  test('every verifier surface reads humanVerification.serverRecompute', () => {
    const surfaces = [
      'proof/verify.html',
      'proof/prove-humanness.html',
      'scripts/verify-offline.js'
    ];
    for (const rel of surfaces) {
      const src = fs.readFileSync(path.join(REPO, rel), 'utf8');
      expect({ surface: rel, mentionsServerRecompute: src.includes('serverRecompute') })
        .toEqual(expect.objectContaining({ mentionsServerRecompute: true }));
    }
  });

  test('every verifier surface reads humanVerification.traceNovelty', () => {
    const surfaces = [
      'proof/verify.html',
      'proof/prove-humanness.html',
      'scripts/verify-offline.js'
    ];
    for (const rel of surfaces) {
      const src = fs.readFileSync(path.join(REPO, rel), 'utf8');
      expect({ surface: rel, mentionsTraceNovelty: src.includes('traceNovelty') })
        .toEqual(expect.objectContaining({ mentionsTraceNovelty: true }));
    }
  });
});
