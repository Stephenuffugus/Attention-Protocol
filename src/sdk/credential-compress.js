/**
 * SWS Attention Protocol — Credential URL Compression
 *
 * SWS signed JWTs are 3–5 KB because they carry six attestation layers
 * of structured data. Standard QR codes max out at ~2.9 KB of bytes —
 * so a raw JWT doesn't fit. This module solves that by DEFLATE-
 * compressing the JWT before base64url-encoding it.
 *
 * Typical size reductions:
 *   Raw JWT:        3,660 chars
 *   DEFLATE'd:      1,400–1,700 bytes
 *   Base64url'd:    1,870–2,270 chars → fits in a standard QR
 *
 * URL format:
 *   Uncompressed:  /prove-humanness.html#c=<jwt>
 *   Compressed:    /prove-humanness.html#cz=<base64url(deflate(jwt))>
 *
 * Both are supported by prove-humanness.html. The `cz` prefix signals
 * the verifier to decompress before parsing.
 *
 * Runtimes:
 *   - Node: uses built-in `zlib.deflateRawSync` / `inflateRawSync`
 *   - Browser: uses built-in CompressionStream / DecompressionStream
 *     (Chrome 80+, Firefox 113+, Safari 16.4+). Both are standard
 *     library — zero external dependencies.
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
'use strict';

const NODE_ZLIB = (typeof require !== 'undefined')
  ? (function(){ try { return require('zlib'); } catch(e){ return null; } })()
  : null;

// ============================================================
// BASE64URL (RFC 4648 §5) — same as attention-signer
// ============================================================

function base64urlEncode(bytes) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  // Browser fallback
  let bin = '';
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(s) {
  const pad = (4 - s.length % 4) % 4;
  const b64 = (s + '='.repeat(pad)).replace(/-/g, '+').replace(/_/g, '/');
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ============================================================
// COMPRESS / DECOMPRESS
// ============================================================

/**
 * Compress a credential string with DEFLATE, return base64url.
 * @param {string} jwt
 * @returns {Promise<string>} base64url-encoded compressed payload
 */
async function compress(jwt) {
  if (typeof jwt !== 'string' || !jwt.length) {
    throw new Error('compress_requires_nonempty_string');
  }
  const inputBytes = typeof TextEncoder !== 'undefined'
    ? new TextEncoder().encode(jwt)
    : Buffer.from(jwt, 'utf8');

  // Node path
  if (NODE_ZLIB && typeof NODE_ZLIB.deflateRawSync === 'function') {
    const compressed = NODE_ZLIB.deflateRawSync(inputBytes, { level: 9 });
    return base64urlEncode(compressed);
  }

  // Browser path — CompressionStream (raw DEFLATE)
  if (typeof CompressionStream !== 'undefined') {
    const cs = new CompressionStream('deflate-raw');
    const blob = new Blob([inputBytes]);
    const compressedStream = blob.stream().pipeThrough(cs);
    const compressed = new Uint8Array(await new Response(compressedStream).arrayBuffer());
    return base64urlEncode(compressed);
  }
  throw new Error('no_compression_available');
}

/**
 * Decompress a base64url-encoded DEFLATE'd credential back to JWT.
 * @param {string} compressedB64
 * @returns {Promise<string>} original JWT
 */
async function decompress(compressedB64) {
  if (typeof compressedB64 !== 'string' || !compressedB64.length) {
    throw new Error('decompress_requires_nonempty_string');
  }
  const compressed = base64urlDecode(compressedB64);

  if (NODE_ZLIB && typeof NODE_ZLIB.inflateRawSync === 'function') {
    const inflated = NODE_ZLIB.inflateRawSync(compressed);
    return Buffer.from(inflated).toString('utf8');
  }

  if (typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('deflate-raw');
    const blob = new Blob([compressed]);
    const inflatedStream = blob.stream().pipeThrough(ds);
    const inflated = await new Response(inflatedStream).arrayBuffer();
    return new TextDecoder().decode(inflated);
  }
  throw new Error('no_decompression_available');
}

// ============================================================
// URL HELPERS
// ============================================================

const URL_PREFIX_RAW = 'c=';
const URL_PREFIX_COMPRESSED = 'cz=';

/**
 * Build a credential URL. Chooses compressed form automatically when
 * it reduces length beyond the uncompressed threshold.
 *
 * @param {string} baseUrl - e.g. "https://.../prove-humanness.html"
 * @param {string} jwt
 * @param {Object} [opts]
 * @param {boolean} [opts.forceCompressed=false]
 * @returns {Promise<{url, jwt_length, encoded_length, compressed, reduction_pct}>}
 */
async function buildCredentialUrl(baseUrl, jwt, opts) {
  opts = opts || {};
  const force = !!opts.forceCompressed;
  const uncompressedUrl = baseUrl + '#' + URL_PREFIX_RAW + jwt;

  if (!force && jwt.length < 2000) {
    // Small enough to fit as-is; no benefit from compression
    return {
      url: uncompressedUrl,
      jwt_length: jwt.length,
      encoded_length: jwt.length,
      compressed: false,
      reduction_pct: 0
    };
  }

  const encoded = await compress(jwt);
  const compressedUrl = baseUrl + '#' + URL_PREFIX_COMPRESSED + encoded;
  return {
    url: compressedUrl,
    jwt_length: jwt.length,
    encoded_length: encoded.length,
    compressed: true,
    reduction_pct: Math.round((1 - encoded.length / jwt.length) * 100)
  };
}

/**
 * Parse a credential URL back to the raw JWT (decompressing if needed).
 *
 * @param {string} urlOrFragment - full URL, fragment, or raw JWT
 * @returns {Promise<string>} original JWT
 */
async function parseCredentialUrl(urlOrFragment) {
  if (typeof urlOrFragment !== 'string') {
    throw new Error('parseCredentialUrl_requires_string');
  }
  let s = urlOrFragment.trim();

  // Pull the fragment or query from a URL if present
  const hashIdx = s.indexOf('#');
  if (hashIdx >= 0) s = s.slice(hashIdx + 1);
  else {
    const qIdx = s.indexOf('?');
    if (qIdx >= 0) s = s.slice(qIdx + 1);
  }

  // Strip leading `&` if concatenated parameter
  if (s.startsWith('&')) s = s.slice(1);

  if (s.startsWith(URL_PREFIX_COMPRESSED)) {
    const payload = s.slice(URL_PREFIX_COMPRESSED.length).split(/[?&\s]/)[0];
    return await decompress(payload);
  }
  if (s.startsWith(URL_PREFIX_RAW)) {
    return s.slice(URL_PREFIX_RAW.length).split(/[?&\s]/)[0];
  }
  // Fallback: assume the input is already a bare JWT
  if (s.split('.').length === 3) return s;
  throw new Error('url_has_no_credential');
}

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  compress,
  decompress,
  buildCredentialUrl,
  parseCredentialUrl,
  base64urlEncode,
  base64urlDecode,
  URL_PREFIX_RAW,
  URL_PREFIX_COMPRESSED
};
