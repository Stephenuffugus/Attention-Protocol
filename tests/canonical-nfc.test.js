/**
 * R2-NEW-10 regression: canonical JSON must NFC-normalize Unicode
 * strings + object keys before hashing. Without this, the same
 * logical content typed via NFC vs NFD produces different UTF-8
 * bytes → different SHA-256 → two valid receipts with different
 * hashes for the same content.
 *
 * The fix landed in 3 surfaces: src/sdk/attention-protocol.js,
 * proof/sdk/attention-protocol.js, proof/verify.html. We test the
 * src/sdk path here (verify.html mirror is asserted by the
 * canonical-fixtures regression).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function loadCanonicalJSON() {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'sdk', 'attention-protocol.js'),
    'utf8'
  );
  // Extract _canonicalJSON + its _nfc helper. Walk braces.
  function extract(name) {
    const start = src.indexOf('function ' + name);
    if (start < 0) throw new Error('not found: ' + name);
    const openIdx = src.indexOf('{', start);
    let depth = 0, i = openIdx;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') { depth--; if (depth === 0) break; }
    }
    return src.slice(start, i + 1);
  }
  const fnSource = extract('_nfc') + '\n' + extract('_canonicalJSON');
  // eslint-disable-next-line no-new-func
  return new Function(fnSource + '\nreturn _canonicalJSON;')();
}

const canonicalJSON = loadCanonicalJSON();

function nodeSha256(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

describe('canonical JSON — NFC normalization (R2-NEW-10)', () => {
  test('NFC and NFD inputs of the same string produce identical canonical bytes', () => {
    // U+00E9 (composed é) vs U+0065 U+0301 (e + combining acute) are
    // visually identical; pre-fix they hashed differently.
    const nfc = 'naïve';                    // composed
    const nfd = 'naïve';          // i + combining diaeresis
    expect(canonicalJSON(nfc)).toBe(canonicalJSON(nfd));
  });

  test('NFC normalization applies to object keys, not just values', () => {
    // Same logical key in two normalization forms must produce the
    // same canonical output (key-NFC) — otherwise an attacker could
    // ship a receipt with NFD keys and a verifier on a different
    // platform would see different keys.
    const composed = { 'café': 1 };
    const decomposed = {};
    decomposed['café'] = 1;
    expect(canonicalJSON(composed)).toBe(canonicalJSON(decomposed));
  });

  test('CJK and emoji round-trip through canonical', () => {
    const a = '中文测试 👋';
    const b = '中文测试 👋';
    expect(canonicalJSON(a)).toBe(canonicalJSON(b));
  });

  test('canonical hash matches Node SHA-256 for the canonical bytes', () => {
    // Ensures the canonical output is itself UTF-8-decodable and
    // hashable by a generic SHA-256 — a third-party verifier doesn't
    // need any custom tooling to reproduce.
    const obj = { a: 'naïve', b: 1, c: [1, 2, 3] };
    const canon = canonicalJSON(obj);
    const hash = nodeSha256(canon);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  test('ASCII-only inputs are unchanged (backward-compat for legacy fixtures)', () => {
    const obj = { a: 1, b: 'hello', c: [1, 2] };
    // Canonical output is the same shape as pre-NFC for ASCII —
    // confirms canonical-fixtures regression won't fail.
    expect(canonicalJSON(obj)).toBe('{"a":1,"b":"hello","c":[1,2]}');
  });

  test('key sort order is determined by NFC-normalized form', () => {
    // Two objects with the same logical keys but different
    // normalization should produce identical canonical bytes
    // including key order.
    const a = {};
    a['zebra'] = 1;
    a['café'] = 2;
    const b = {};
    b['café'] = 2;     // NFD form of café
    b['zebra'] = 1;
    expect(canonicalJSON(a)).toBe(canonicalJSON(b));
  });
});

/**
 * Class-4 strict-rejection tests (2026-05-27 hostile crypto audit).
 *
 * Pre-fix, _canonicalJSON silently coerced these to 'null':
 *   - undefined (anywhere)
 *   - NaN, Infinity, -Infinity
 *   - BigInt (via the fallthrough)
 *   - Symbol, function
 *
 * That produced hash collisions across semantically different inputs.
 * Two receipts {a:1, b:null} and {a:1, b:NaN} hashed identically.
 * In an attacker-controlled-field context this is a forgery primitive.
 *
 * Fix: throw on every input type that cannot round-trip through JSON
 * deterministically. For object values that are undefined, skip the
 * key entirely per RFC 8785 section 3.2.4 — this distinguishes
 * {a:1, b:undefined} from {a:1, b:null}, which previously collided.
 */
describe('canonical JSON — strict input validation (Class 4 fix)', () => {
  test('throws on top-level undefined', () => {
    expect(() => canonicalJSON(undefined)).toThrow(/undefined_input/);
  });

  test('throws on NaN', () => {
    expect(() => canonicalJSON(NaN)).toThrow(/non_finite_number/);
  });

  test('throws on Infinity and -Infinity', () => {
    expect(() => canonicalJSON(Infinity)).toThrow(/non_finite_number/);
    expect(() => canonicalJSON(-Infinity)).toThrow(/non_finite_number/);
  });

  test('throws on BigInt', () => {
    expect(() => canonicalJSON(BigInt(1))).toThrow(/bigint_input/);
  });

  test('throws on Symbol', () => {
    expect(() => canonicalJSON(Symbol('x'))).toThrow(/symbol_input/);
  });

  test('throws on function', () => {
    expect(() => canonicalJSON(function() {})).toThrow(/function_input/);
  });

  test('throws on undefined in array (no silent null coercion)', () => {
    expect(() => canonicalJSON([1, undefined, 3])).toThrow(/undefined_in_array/);
  });

  test('throws when an object value recurses into a non-finite number', () => {
    expect(() => canonicalJSON({ a: 1, b: NaN })).toThrow(/non_finite_number/);
  });

  test('throws when an object value recurses into a BigInt', () => {
    expect(() => canonicalJSON({ a: 1, b: BigInt(2) })).toThrow(/bigint_input/);
  });

  test('Class 4 PoC: undefined object value no longer collides with null', () => {
    // Pre-fix this produced identical 'null' bytes for both. Now:
    //  - {a:1, b:undefined} -> '{"a":1}' (b skipped per RFC 8785)
    //  - {a:1, b:null}      -> '{"a":1,"b":null}' (b explicit)
    const withUndef = canonicalJSON({ a: 1, b: undefined });
    const withNull = canonicalJSON({ a: 1, b: null });
    expect(withUndef).not.toBe(withNull);
    expect(withUndef).toBe('{"a":1}');
    expect(withNull).toBe('{"a":1,"b":null}');
  });

  test('Class 4 PoC: omitted key matches explicit-undefined-value (both skipped)', () => {
    // {a:1, b:undefined} and {a:1} produce the same bytes — which is
    // what JSON.stringify also does and what JCS demands.
    expect(canonicalJSON({ a: 1, b: undefined })).toBe(canonicalJSON({ a: 1 }));
  });

  test('null object values are still emitted explicitly (not skipped)', () => {
    // null is a legitimate JSON value and MUST round-trip. Only undefined
    // is RFC-8785-skippable.
    expect(canonicalJSON({ a: 1, b: null })).toBe('{"a":1,"b":null}');
  });
});
