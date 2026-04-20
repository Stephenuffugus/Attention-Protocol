/**
 * SWS Attention Protocol — RFC 3161 Timestamp Authority Client
 *
 * An alternative timestamp anchor to OpenTimestamps/Bitcoin. Issues the
 * receipt's hash to a CAB-Forum-accredited Timestamp Authority (TSA)
 * and stores the returned TimeStampToken alongside the receipt.
 *
 * This is the timestamp-authority format that regulated industries
 * already recognize:
 *   - Microsoft Authenticode code-signing
 *   - Adobe Acrobat PAdES-LTV signatures
 *   - eIDAS qualified electronic timestamps (EU)
 *   - FDA 21 CFR Part 11 electronic-records implementations
 *
 * Standards:
 *   - RFC 3161 — Internet X.509 PKI TSP
 *   - RFC 5816 — ESSCertIDv2 updates
 *
 * Defaults to FreeTSA.org (free, publicly operated, no registration).
 * Enterprise pilots can point at DigiCert, Sectigo, GlobalSign, Entrust,
 * or a self-hosted TSA by overriding `opts.tsaUrl`.
 *
 * Known public TSA endpoints (all accept SHA-256):
 *   - https://freetsa.org/tsr                    (free, community)
 *   - http://timestamp.digicert.com              (free, commercial-grade)
 *   - http://timestamp.sectigo.com               (free, commercial-grade)
 *   - http://timestamp.globalsign.com/tsa/r6advanced1 (free)
 *   - http://tsa.starfieldtech.com               (free)
 *
 * Fail-to-unknown on network / TSA errors. Never throws.
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
'use strict';

const https = require('https');
const http = require('http');
const url = require('url');
const { TimeStampReq, TimeStampResp, MessageImprint, TSTInfo } = require('@peculiar/asn1-tsp');
const { AsnConvert, OctetString } = require('@peculiar/asn1-schema');
const { AlgorithmIdentifier } = require('@peculiar/asn1-x509');
const { SignedData } = require('@peculiar/asn1-cms');

const DETECTOR = 'rfc3161-tsa-v1';
const DEFAULT_TSA_URL = 'https://freetsa.org/tsr';
const SHA256_OID = '2.16.840.1.101.3.4.2.1';

// ============================================================
// STAMP
// ============================================================

/**
 * Submit a SHA-256 hash to an RFC 3161 Timestamp Authority.
 *
 * @param {string|Buffer|Uint8Array} hashHexOrBytes - 32-byte SHA-256
 * @param {Object} [opts]
 * @param {string} [opts.tsaUrl]      - override default TSA endpoint
 * @param {string} [opts.tsaName]     - friendly name recorded on the receipt
 * @param {number} [opts.timeoutMs=15000]
 * @param {boolean} [opts.certReq=true] - request TSA's cert in the response
 * @returns {Promise<StampResult>}
 */
async function stamp(hashHexOrBytes, opts) {
  opts = opts || {};
  const tsaUrl = opts.tsaUrl || DEFAULT_TSA_URL;
  const tsaName = opts.tsaName || _deriveTsaName(tsaUrl);
  const timeoutMs = typeof opts.timeoutMs === 'number' ? opts.timeoutMs : 15000;
  const wantCert = opts.certReq !== false;

  let hashBuf;
  try {
    hashBuf = _toBuffer(hashHexOrBytes);
    if (hashBuf.length !== 32) return _failed('hash_must_be_32_bytes', tsaName);
  } catch (e) {
    return _failed('invalid_hash: ' + (e && e.message), tsaName);
  }

  try {
    // Build TimeStampReq DER
    const req = new TimeStampReq({
      version: 1,
      messageImprint: new MessageImprint({
        hashAlgorithm: new AlgorithmIdentifier({ algorithm: SHA256_OID }),
        hashedMessage: new OctetString(hashBuf.buffer.slice(
          hashBuf.byteOffset, hashBuf.byteOffset + hashBuf.byteLength
        ))
      }),
      certReq: wantCert
    });
    const reqDer = Buffer.from(AsnConvert.serialize(req));

    const respBytes = await _postWithTimeout(tsaUrl, reqDer, timeoutMs);

    // Parse TimeStampResp
    const resp = AsnConvert.parse(respBytes, TimeStampResp);
    if (resp.status.status !== 0 && resp.status.status !== 1) {
      // 0 = granted, 1 = grantedWithMods (still OK)
      return _failed('tsa_rejected_status_' + resp.status.status, tsaName);
    }

    if (!resp.timeStampToken) {
      return _failed('tsa_returned_no_token', tsaName);
    }

    // Extract TSTInfo → genTime, policy, serial
    const sd = AsnConvert.parse(resp.timeStampToken.content, SignedData);
    const tstBytes = sd.encapContentInfo.eContent.single.buffer;
    const tst = AsnConvert.parse(tstBytes, TSTInfo);

    const storedHashBytes = tst.messageImprint.hashedMessage.buffer
      || tst.messageImprint.hashedMessage;
    const storedHashHex = Buffer.from(new Uint8Array(storedHashBytes)).toString('hex');
    const inputHashHex = hashBuf.toString('hex');
    if (storedHashHex !== inputHashHex) {
      return _failed('tsa_returned_wrong_hash', tsaName);
    }

    return {
      detector: DETECTOR,
      status: 'signed',
      tsa_url: tsaUrl,
      tsa_name: tsaName,
      tsa_policy_oid: tst.policy || null,
      serial_hex: Buffer.from(new Uint8Array(tst.serialNumber)).toString('hex'),
      gen_time: tst.genTime.toISOString(),
      hash_hex: inputHashHex,
      hash_alg_oid: SHA256_OID,
      token_b64: Buffer.from(respBytes).toString('base64'),
      stamped_at: new Date().toISOString(),
      note: 'RFC 3161 TimeStampToken from ' + tsaName + '. Verify independently with openssl ts -verify or any standards-compliant TSA client.'
    };
  } catch (e) {
    return _failed('stamp_error: ' + (e && e.message), tsaName);
  }
}

// ============================================================
// VERIFY (structural — full cert-chain verify is a separate step)
// ============================================================

/**
 * Structural verification of a TimeStampToken: recovers the genTime and
 * confirms the token commits to the same hash we're claiming.
 *
 * Full cryptographic verification of the TSA's signature against the TSA
 * certificate chain is deferred to the caller (use openssl ts -verify, or
 * run the chain through @peculiar/x509 or node-forge if required).
 *
 * @param {string|Buffer|Uint8Array} hashHexOrBytes
 * @param {string} tokenB64 - base64 of the full TimeStampResp DER
 * @returns {Promise<{valid, gen_time, tsa_policy_oid, serial_hex, error?}>}
 */
async function verify(hashHexOrBytes, tokenB64) {
  try {
    const hashBuf = _toBuffer(hashHexOrBytes);
    if (hashBuf.length !== 32) return { valid: false, error: 'hash_must_be_32_bytes' };
    if (typeof tokenB64 !== 'string' || !tokenB64.length) {
      return { valid: false, error: 'missing_token' };
    }
    const respBytes = Buffer.from(tokenB64, 'base64');
    const resp = AsnConvert.parse(respBytes, TimeStampResp);
    if (resp.status.status !== 0 && resp.status.status !== 1) {
      return { valid: false, error: 'tsa_status_not_granted' };
    }
    if (!resp.timeStampToken) return { valid: false, error: 'no_token_in_response' };

    const sd = AsnConvert.parse(resp.timeStampToken.content, SignedData);
    const tstBytes = sd.encapContentInfo.eContent.single.buffer;
    const tst = AsnConvert.parse(tstBytes, TSTInfo);

    const storedBytes = tst.messageImprint.hashedMessage.buffer
      || tst.messageImprint.hashedMessage;
    const storedHex = Buffer.from(new Uint8Array(storedBytes)).toString('hex');
    const inputHex = hashBuf.toString('hex');
    if (storedHex !== inputHex) {
      return { valid: false, error: 'hash_mismatch_with_token', expected: inputHex, found: storedHex };
    }

    return {
      valid: true,
      gen_time: tst.genTime.toISOString(),
      tsa_policy_oid: tst.policy || null,
      serial_hex: Buffer.from(new Uint8Array(tst.serialNumber)).toString('hex'),
      note: 'Structural check passed. Run openssl ts -verify for full signature-chain validation.'
    };
  } catch (e) {
    return { valid: false, error: 'exception: ' + ((e && e.message) || String(e)) };
  }
}

// ============================================================
// INTERNAL HELPERS
// ============================================================

function _failed(msg, tsaName) {
  return {
    detector: DETECTOR,
    status: 'failed',
    tsa_name: tsaName || null,
    stamped_at: new Date().toISOString(),
    error: msg
  };
}

function _toBuffer(input) {
  if (input == null) throw new Error('null_hash_input');
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) return Buffer.from(input);
  if (Array.isArray(input)) return Buffer.from(input);
  if (typeof input === 'string') {
    if (!/^[0-9a-fA-F]*$/.test(input)) throw new Error('non_hex_string');
    if (input.length % 2 !== 0) throw new Error('odd_length_hex');
    return Buffer.from(input, 'hex');
  }
  throw new Error('unsupported_hash_input_type');
}

function _deriveTsaName(tsaUrl) {
  try {
    const u = new url.URL(tsaUrl);
    return u.hostname;
  } catch (e) { return tsaUrl; }
}

function _postWithTimeout(tsaUrl, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const u = new url.URL(tsaUrl);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request({
      method: 'POST',
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + (u.search || ''),
      headers: {
        'Content-Type': 'application/timestamp-query',
        'Content-Length': body.length,
        'User-Agent': 'sws-attention-tsa/1.0'
      },
      timeout: timeoutMs
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error('http_' + res.statusCode));
          return;
        }
        resolve(Buffer.concat(chunks));
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('tsa_timeout_' + timeoutMs + 'ms')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  stamp: stamp,
  verify: verify,
  DETECTOR: DETECTOR,
  DEFAULT_TSA_URL: DEFAULT_TSA_URL,
  SHA256_OID: SHA256_OID,
  // Exposed for pilots who want to test alternate TSAs
  PUBLIC_TSAS: {
    freetsa:    'https://freetsa.org/tsr',
    digicert:   'http://timestamp.digicert.com',
    sectigo:    'http://timestamp.sectigo.com',
    globalsign: 'http://timestamp.globalsign.com/tsa/r6advanced1',
    starfield:  'http://tsa.starfieldtech.com'
  }
};
