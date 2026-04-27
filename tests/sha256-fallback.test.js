/**
 * Round-2 R2-NEW-9 regression test: pure-JS SHA-256 fallback in
 * src/sdk/attention-receipts.js correctly handles non-ASCII input.
 *
 * Pre-fix: charCodeAt() returned UTF-16 code units; any code unit > 0xFF
 * tripped `if (j >> 8) return ''` and the function silently returned
 * an empty hash. Two non-ASCII inputs would collide on '' — trivial.
 *
 * Post-fix: input is UTF-8 encoded via TextEncoder before processing.
 * Hashes match the canonical Node `crypto.createHash('sha256')` output.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// The module is browser-only ((function(window){...})(window)), so we
// extract the function source and eval it in a sandbox that provides
// the minimal globals it needs.
function loadSha256Pure() {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'sdk', 'attention-receipts.js'),
    'utf8'
  );
  // Match `function _sha256Pure(str) { ... }` — the function spans many
  // lines; rather than regex, evaluate the whole module under a fake
  // window and capture the function via the exported namespace.
  const sandbox = {
    window: {},
    TextEncoder: typeof TextEncoder !== 'undefined' ? TextEncoder : require('util').TextEncoder,
    crypto: { subtle: null },  // force the pure path
    Math, Date, console
  };
  // eslint-disable-next-line no-new-func
  const factory = new Function('window', 'TextEncoder', 'crypto', 'Math', 'Date', 'console',
    src + '\nreturn window.SWSAttentionReceipts;');
  const ns = factory(sandbox.window, sandbox.TextEncoder, sandbox.crypto, Math, Date, console);
  // _sha256Pure isn't exported. We re-expose it via a small trick: the
  // generateReceipt path calls _sha256Pure synchronously when no
  // crypto.subtle is available. Simpler: patch the module factory to
  // expose the internal symbol.
  // Patched approach: extract function source by string-search.
  const fnStart = src.indexOf('function _sha256Pure');
  // Find matching close brace by walking depth from the first `{`.
  const openIdx = src.indexOf('{', fnStart);
  let depth = 0;
  let i = openIdx;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  const fnSource = src.slice(fnStart, i + 1);
  // eslint-disable-next-line no-new-func
  return new Function('TextEncoder', fnSource + '; return _sha256Pure;')(sandbox.TextEncoder);
}

const sha256Pure = loadSha256Pure();

function nodeSha256(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

describe('sha256 pure-JS fallback (R2-NEW-9 regression)', () => {
  test('ASCII matches canonical', () => {
    const s = 'hello world';
    expect(sha256Pure(s)).toBe(nodeSha256(s));
  });

  test('empty string matches canonical', () => {
    expect(sha256Pure('')).toBe(nodeSha256(''));
  });

  test('non-ASCII (smart quote) matches canonical — was returning empty pre-fix', () => {
    const s = 'café'; // café
    const got = sha256Pure(s);
    expect(got).not.toBe('');
    expect(got).toBe(nodeSha256(s));
  });

  test('non-ASCII (em-dash + quote) matches canonical', () => {
    const s = 'human — “test”';
    expect(sha256Pure(s)).toBe(nodeSha256(s));
  });

  test('UTF-8 multi-byte (BMP) matches canonical', () => {
    const s = 'naïve résumé naïveté';
    expect(sha256Pure(s)).toBe(nodeSha256(s));
  });

  test('CJK characters match canonical', () => {
    const s = '中文测试'; // "中文测试"
    expect(sha256Pure(s)).toBe(nodeSha256(s));
  });

  test('emoji (surrogate pair) matches canonical', () => {
    const s = 'hello 👋 world'; // 👋
    expect(sha256Pure(s)).toBe(nodeSha256(s));
  });

  test('mixed ASCII + non-ASCII receipt-shaped JSON matches canonical', () => {
    const s = JSON.stringify({
      session_id: 'cme_demo_naïve_user',
      reflection_words: 'café',
      verdict: 'pass',
      composite: 0.573
    });
    expect(sha256Pure(s)).toBe(nodeSha256(s));
  });
});
