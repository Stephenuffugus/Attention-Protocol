/**
 * SWS Attention Protocol — Credential Compression Test Suite
 *
 * Offline tests for the DEFLATE + base64url credential compression
 * used to fit large JWTs into QR codes.
 *
 * Covers:
 *   - Round-trip (compress → decompress) preserves the JWT exactly
 *   - Real signed-JWT samples compress by 20–60% (empirical floor 20%)
 *   - buildCredentialUrl picks compressed form above threshold
 *   - buildCredentialUrl keeps raw form below threshold
 *   - parseCredentialUrl handles all three forms:
 *       raw JWT,   full URL with #c=,   full URL with #cz=
 *   - Malformed input raises clear errors
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */

const fs = require('fs');
const path = require('path');
const c = require('../src/sdk/credential-compress');

// Use the real live humanness sample as a realistic-size JWT
const SAMPLE_JWT = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, '../proof/results/humanness-sample.json'), 'utf8'
)).signed_jwt;

// ============================================================
// ROUND-TRIP
// ============================================================

describe('credential-compress — round trip', () => {
  test('compress → decompress returns the original JWT exactly', async () => {
    const compressed = await c.compress(SAMPLE_JWT);
    const round = await c.decompress(compressed);
    expect(round).toBe(SAMPLE_JWT);
  });

  test('compress produces deterministic output for the same input', async () => {
    const a = await c.compress(SAMPLE_JWT);
    const b = await c.compress(SAMPLE_JWT);
    expect(a).toBe(b);
  });

  test('compress rejects empty / non-string input', async () => {
    await expect(c.compress('')).rejects.toThrow(/nonempty_string/);
    await expect(c.compress(null)).rejects.toThrow(/nonempty_string/);
    await expect(c.compress(undefined)).rejects.toThrow(/nonempty_string/);
  });

  test('decompress rejects empty / malformed input', async () => {
    await expect(c.decompress('')).rejects.toThrow(/nonempty_string/);
    await expect(c.decompress('not-deflate-data')).rejects.toThrow();
  });
});

// ============================================================
// SIZE REDUCTION
// ============================================================

describe('credential-compress — size reduction', () => {
  test('real signed JWT compresses by at least 20% after base64url', async () => {
    const compressed = await c.compress(SAMPLE_JWT);
    const reduction = 1 - compressed.length / SAMPLE_JWT.length;
    expect(reduction).toBeGreaterThan(0.20);
  });

  test('compressed output fits inside standard QR byte-mode limit (2953 bytes)', async () => {
    const compressed = await c.compress(SAMPLE_JWT);
    expect(compressed.length).toBeLessThan(2953);
  });

  test('compressed output is pure base64url charset', async () => {
    const compressed = await c.compress(SAMPLE_JWT);
    expect(compressed).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

// ============================================================
// buildCredentialUrl
// ============================================================

describe('credential-compress — buildCredentialUrl', () => {
  const BASE = 'https://sws-attention-proofs.web.app/prove-humanness.html';

  test('short JWT stays uncompressed (no reduction benefit)', async () => {
    const smallJwt = 'eyJhbGc.' + 'a'.repeat(500) + '.sig';
    const out = await c.buildCredentialUrl(BASE, smallJwt);
    expect(out.compressed).toBe(false);
    expect(out.url).toContain('#c=');
    expect(out.url).toContain(smallJwt);
  });

  test('real-size JWT is compressed automatically', async () => {
    const out = await c.buildCredentialUrl(BASE, SAMPLE_JWT);
    expect(out.compressed).toBe(true);
    expect(out.url).toContain('#cz=');
    expect(out.reduction_pct).toBeGreaterThan(20);
    expect(out.encoded_length).toBeLessThan(SAMPLE_JWT.length);
  });

  test('forceCompressed:true always compresses', async () => {
    const smallJwt = 'eyJhbGc.' + 'x'.repeat(500) + '.sig';
    const out = await c.buildCredentialUrl(BASE, smallJwt, { forceCompressed: true });
    expect(out.compressed).toBe(true);
    expect(out.url).toContain('#cz=');
  });
});

// ============================================================
// parseCredentialUrl
// ============================================================

describe('credential-compress — parseCredentialUrl', () => {
  const BASE = 'https://sws-attention-proofs.web.app/prove-humanness.html';

  test('parses raw JWT input', async () => {
    const round = await c.parseCredentialUrl(SAMPLE_JWT);
    expect(round).toBe(SAMPLE_JWT);
  });

  test('parses uncompressed URL form', async () => {
    const smallJwt = 'eyJhbGc.' + 'a'.repeat(500) + '.sig';
    const url = BASE + '#c=' + smallJwt;
    const round = await c.parseCredentialUrl(url);
    expect(round).toBe(smallJwt);
  });

  test('parses compressed URL form', async () => {
    const built = await c.buildCredentialUrl(BASE, SAMPLE_JWT);
    const round = await c.parseCredentialUrl(built.url);
    expect(round).toBe(SAMPLE_JWT);
  });

  test('parses a bare fragment (no scheme / host)', async () => {
    const built = await c.buildCredentialUrl(BASE, SAMPLE_JWT);
    const fragment = built.url.split('#')[1];
    const round = await c.parseCredentialUrl('#' + fragment);
    expect(round).toBe(SAMPLE_JWT);
  });

  test('handles extra URL params after the credential', async () => {
    const smallJwt = 'eyJhbGc.' + 'a'.repeat(200) + '.sig';
    const url = BASE + '#c=' + smallJwt + '&ref=twitter';
    const round = await c.parseCredentialUrl(url);
    expect(round).toBe(smallJwt);
  });

  test('throws for non-credential URL input', async () => {
    await expect(c.parseCredentialUrl('https://example.com/foo'))
      .rejects.toThrow(/no_credential/);
  });

  test('throws for non-string input', async () => {
    await expect(c.parseCredentialUrl(null))
      .rejects.toThrow(/requires_string/);
  });
});

// ============================================================
// SECURITY — zip-bomb guard on decompress() (audit Apr 21)
// ============================================================

describe('credential-compress — zip-bomb guard', () => {
  const zlib = require('zlib');

  function b64url(buf) {
    return Buffer.from(buf).toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  test('rejects a compressed payload whose inflated output exceeds the default 256 KB cap', async () => {
    // Build a ~2 MB string of zeros — DEFLATE collapses it to a few hundred bytes.
    const bigPlain = Buffer.alloc(2 * 1024 * 1024, 0);
    const bomb = zlib.deflateRawSync(bigPlain, { level: 9 });
    const b64 = b64url(bomb);
    // Sanity: confirm the bomb is actually small on the wire
    expect(b64.length).toBeLessThan(65536);
    await expect(c.decompress(b64)).rejects.toThrow();
  });

  test('honors a caller-supplied maxOutputBytes bound', async () => {
    // 16 KB input is well under the default cap but over this bound
    const plain = Buffer.alloc(16 * 1024, 'x');
    const payload = zlib.deflateRawSync(plain, { level: 9 });
    const b64 = b64url(payload);
    await expect(c.decompress(b64, { maxOutputBytes: 8192 })).rejects.toThrow();
  });

  test('accepts input within the bound (round-trip still works)', async () => {
    const plain = 'ok-' + 'a'.repeat(4000);
    const compressed = await c.compress(plain);
    const round = await c.decompress(compressed, { maxOutputBytes: 16384 });
    expect(round).toBe(plain);
  });

  test('rejects a compressed input larger than 65536 chars on its face', async () => {
    // Not even attempting inflation — oversized base64url blob is hostile.
    const huge = 'A'.repeat(70000);
    await expect(c.decompress(huge)).rejects.toThrow(/compressed_input_too_large/);
  });

  test('rejects empty / non-string input', async () => {
    await expect(c.decompress('')).rejects.toThrow(/requires_nonempty_string/);
    await expect(c.decompress(null)).rejects.toThrow(/requires_nonempty_string/);
    await expect(c.decompress(undefined)).rejects.toThrow(/requires_nonempty_string/);
  });
});
