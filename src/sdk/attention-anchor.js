/**
 * SWS Attention Protocol — Bitcoin Anchoring (OpenTimestamps)
 *
 * Anchors a receipt's SHA-256 hash into the Bitcoin blockchain via
 * OpenTimestamps (OTS). Provides the strongest available proof of
 * "this receipt existed on or before time T" — irrefutable even by us.
 *
 * Flow:
 *   1. stamp(hash)    → hits public OTS calendar servers, returns a
 *                       "pending" proof. Takes ~2–10s over the network.
 *                       Proof contains cryptographic commitments to the
 *                       calendar. Not yet Bitcoin-anchored.
 *   2. [wait ~12 hrs] → calendar servers aggregate batches into a
 *                       Merkle tree and commit the root to the Bitcoin
 *                       blockchain (typically in block every 1–12 hrs).
 *   3. upgrade(proof) → pulls the Bitcoin attestation from the calendar
 *                       servers. Result is a self-contained proof: given
 *                       only the original hash + this upgraded proof, any
 *                       third party can prove the hash existed at or
 *                       before Bitcoin block N's timestamp.
 *   4. verify(hash, proof) → offline verification (no calendar server
 *                       needed once upgraded). Returns block height + time.
 *
 * Security properties:
 *   - SWS cannot backdate an OTS proof. Doing so would require re-mining
 *     the Bitcoin blockchain from the target height forward.
 *   - OTS proofs are self-authenticating given the original hash. Swap
 *     a proof between two receipts with different hashes and verify fails.
 *
 * Network policy:
 *   - stamp() and upgrade() require network. Fail-to-unknown on error
 *     (returns {status: 'failed', error: '...'}). Never throws.
 *   - verify() is fully offline (no network).
 *
 * Privacy:
 *   - Only the 32-byte receipt hash leaves the machine. No PII.
 *     The receipt content itself is never sent to calendar servers.
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
'use strict';

const OTS = require('javascript-opentimestamps');

const DETECTOR = 'opentimestamps-v1';

// ============================================================
// STAMP
// ============================================================

/**
 * Stamp a SHA-256 hash with OpenTimestamps.
 * Hits public calendar servers. Returns a pending proof.
 *
 * @param {string|Buffer|Uint8Array} hashHexOrBytes - 32-byte SHA-256
 * @param {Object} [opts]
 * @param {number} [opts.timeoutMs=15000] - max time to wait for calendar servers
 * @returns {Promise<StampResult>}
 */
async function stamp(hashHexOrBytes, opts) {
  opts = opts || {};
  const timeoutMs = typeof opts.timeoutMs === 'number' ? opts.timeoutMs : 15000;

  let hashBytes;
  try {
    hashBytes = _toBytes(hashHexOrBytes);
    if (hashBytes.length !== 32) {
      return _failed('hash_must_be_32_bytes');
    }
  } catch (e) {
    return _failed('invalid_hash: ' + (e && e.message));
  }

  try {
    const op = new OTS.Ops.OpSHA256();
    const file = OTS.DetachedTimestampFile.fromHash(op, Buffer.from(hashBytes));

    await _withTimeout(OTS.stamp(file), timeoutMs, 'stamp_timeout');

    const proofBytes = file.serializeToBytes();
    return {
      detector: DETECTOR,
      status: 'pending',
      proof_b64: Buffer.from(proofBytes).toString('base64'),
      hash_hex: _bytesToHex(hashBytes),
      stamped_at: new Date().toISOString(),
      bitcoin_block_height: null,
      bitcoin_block_time: null,
      last_upgrade_check: null,
      note: 'Pending Bitcoin attestation. Run upgrade() after ~12 hrs.'
    };
  } catch (e) {
    return _failed('stamp_error: ' + (e && e.message));
  }
}

// ============================================================
// UPGRADE
// ============================================================

/**
 * Try to upgrade a pending proof to a Bitcoin-anchored proof.
 * Hits calendar servers. Returns the same shape as stamp() but
 * potentially with status='bitcoin_confirmed' and block info.
 *
 * @param {Object} stamped - prior stamp() result
 * @param {Object} [opts]
 * @param {number} [opts.timeoutMs=15000]
 * @returns {Promise<StampResult>}
 */
async function upgrade(stamped, opts) {
  opts = opts || {};
  const timeoutMs = typeof opts.timeoutMs === 'number' ? opts.timeoutMs : 15000;

  if (!stamped || !stamped.proof_b64) {
    return _failed('missing_proof');
  }

  try {
    const proofBytes = Buffer.from(stamped.proof_b64, 'base64');
    const file = OTS.DetachedTimestampFile.deserialize(proofBytes);

    await _withTimeout(OTS.upgrade(file), timeoutMs, 'upgrade_timeout');

    const upgradedBytes = file.serializeToBytes();
    const verifyResult = _tryVerify(file);

    const base = Object.assign({}, stamped, {
      proof_b64: Buffer.from(upgradedBytes).toString('base64'),
      last_upgrade_check: new Date().toISOString()
    });

    if (verifyResult && verifyResult.bitcoin) {
      base.status = 'bitcoin_confirmed';
      base.bitcoin_block_height = verifyResult.bitcoin.height;
      base.bitcoin_block_time = verifyResult.bitcoin.timestamp
        ? new Date(verifyResult.bitcoin.timestamp * 1000).toISOString()
        : null;
      base.note = 'Receipt hash anchored to Bitcoin block #' + verifyResult.bitcoin.height + '.';
    } else {
      base.status = 'pending';
      base.note = 'Calendar commit received but Bitcoin attestation not yet in proof. Retry later.';
    }
    return base;
  } catch (e) {
    return Object.assign({}, stamped, {
      last_upgrade_check: new Date().toISOString(),
      status: stamped.status || 'pending',
      upgrade_error: (e && e.message) ? e.message : String(e)
    });
  }
}

// ============================================================
// VERIFY (fully offline once Bitcoin-anchored)
// ============================================================

/**
 * Verify a proof against an original hash. No network required.
 * @param {string|Buffer|Uint8Array} hashHexOrBytes
 * @param {string} proofB64
 * @returns {Promise<{valid, bitcoin_block_height, bitcoin_block_time, error?}>}
 */
async function verify(hashHexOrBytes, proofB64) {
  try {
    const hashBytes = _toBytes(hashHexOrBytes);
    if (hashBytes.length !== 32) {
      return { valid: false, error: 'hash_must_be_32_bytes' };
    }
    if (typeof proofB64 !== 'string' || proofB64.length === 0) {
      return { valid: false, error: 'missing_proof' };
    }
    const proofBytes = Buffer.from(proofB64, 'base64');
    const file = OTS.DetachedTimestampFile.deserialize(proofBytes);

    // Check the proof commits to the hash we're claiming.
    const digestInProof = file.fileDigest();
    if (!_buffersEqual(digestInProof, hashBytes)) {
      return { valid: false, error: 'hash_mismatch_with_proof' };
    }

    const v = _tryVerify(file);
    if (!v) {
      return { valid: false, error: 'proof_not_bitcoin_anchored_yet' };
    }
    if (v.bitcoin) {
      return {
        valid: true,
        bitcoin_block_height: v.bitcoin.height,
        bitcoin_block_time: v.bitcoin.timestamp
          ? new Date(v.bitcoin.timestamp * 1000).toISOString()
          : null
      };
    }
    return { valid: false, error: 'no_bitcoin_attestation' };
  } catch (e) {
    return { valid: false, error: 'exception: ' + ((e && e.message) || String(e)) };
  }
}

// ============================================================
// INTERNAL HELPERS
// ============================================================

function _failed(msg) {
  return {
    detector: DETECTOR,
    status: 'failed',
    proof_b64: null,
    hash_hex: null,
    stamped_at: new Date().toISOString(),
    bitcoin_block_height: null,
    bitcoin_block_time: null,
    last_upgrade_check: null,
    error: msg
  };
}

function _tryVerify(file) {
  // OTS.verify returns { bitcoin: { height, timestamp } } when anchored.
  // Some versions throw on un-anchored proofs; guard both paths.
  try {
    const result = OTS.verify(file);
    if (result && typeof result === 'object') return result;
    return null;
  } catch (e) {
    return null;
  }
}

function _toBytes(input) {
  if (input == null) throw new Error('null_hash_input');
  if (Buffer.isBuffer(input)) return new Uint8Array(input);
  if (input instanceof Uint8Array) return input;
  if (Array.isArray(input)) return new Uint8Array(input);
  if (typeof input === 'string') {
    if (!/^[0-9a-fA-F]*$/.test(input)) throw new Error('non_hex_string');
    if (input.length % 2 !== 0) throw new Error('odd_length_hex');
    const out = new Uint8Array(input.length / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = parseInt(input.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
  }
  throw new Error('unsupported_hash_input_type');
}

function _bytesToHex(bytes) {
  return Buffer.from(bytes).toString('hex');
}

function _buffersEqual(a, b) {
  const ab = _toBytes(a);
  const bb = _toBytes(b);
  if (ab.length !== bb.length) return false;
  for (let i = 0; i < ab.length; i++) if (ab[i] !== bb[i]) return false;
  return true;
}

function _withTimeout(promise, ms, label) {
  let timer;
  const t = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(label + '_after_' + ms + 'ms')), ms);
  });
  return Promise.race([promise, t]).finally(() => { if (timer) clearTimeout(timer); });
}

module.exports = {
  stamp: stamp,
  upgrade: upgrade,
  verify: verify,
  DETECTOR: DETECTOR,
  _toBytes: _toBytes,
  _bytesToHex: _bytesToHex
};
