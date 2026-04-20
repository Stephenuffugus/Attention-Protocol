/**
 * SWS Attention Protocol — Merkle Batching
 *
 * Aggregate N receipt hashes into a single Merkle root, stamp that root
 * once to OpenTimestamps/Bitcoin, then emit per-receipt inclusion proofs.
 *
 * Why this matters:
 *   - One Bitcoin anchor → thousands of receipts. Linear scaling stops
 *     at the moment you ingest a million sessions per day.
 *   - Each receipt carries a compact inclusion proof (log₂N sibling
 *     hashes + the anchored root). Verification is O(log N) bytes.
 *   - Tampering with ANY receipt's hash invalidates its Merkle path
 *     under the published root. The root is Bitcoin-anchored; you
 *     cannot substitute a different root without re-mining Bitcoin.
 *
 * Construction:
 *   - Binary Merkle tree over SHA-256 leaves. Odd-level duplication
 *     (as in Bitcoin itself) when a level has an odd count.
 *   - No leaf sorting (sorted trees are used where leaf order is
 *     untrusted, e.g., certificate transparency; our leaves are
 *     deterministically produced by the issuer).
 *
 * Uses `merkletreejs` for the tree construction + proofs (battle-tested
 * library used by EthereumFoundation, OpenZeppelin, etc.).
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
'use strict';

const crypto = require('crypto');
const { MerkleTree } = require('merkletreejs');

const DETECTOR = 'sws-merkle-v1';
const HASH_ALG = 'SHA-256';

// ============================================================
// HELPERS
// ============================================================

function _sha256(input) {
  return crypto.createHash('sha256').update(input).digest();
}

function _toBuffer(h) {
  if (Buffer.isBuffer(h)) return h;
  if (h instanceof Uint8Array) return Buffer.from(h);
  if (typeof h === 'string') {
    if (!/^[0-9a-fA-F]*$/.test(h) || h.length % 2 !== 0) {
      throw new Error('invalid_hex_hash');
    }
    return Buffer.from(h, 'hex');
  }
  throw new Error('unsupported_hash_input');
}

// ============================================================
// BUILD
// ============================================================

/**
 * Build a Merkle tree from N receipt hashes.
 * @param {Array<string|Buffer|Uint8Array>} hashes - at least 1
 * @returns {{ tree: MerkleTree, root: Buffer, rootHex: string, leafCount: number }}
 */
function buildTree(hashes) {
  if (!Array.isArray(hashes) || hashes.length === 0) {
    throw new Error('need_at_least_one_hash');
  }
  const leaves = hashes.map(_toBuffer);
  for (const l of leaves) {
    if (l.length !== 32) throw new Error('leaves_must_be_32_bytes');
  }
  const tree = new MerkleTree(leaves, _sha256, { sortPairs: false });
  const root = tree.getRoot();
  return {
    tree: tree,
    root: root,
    rootHex: root.toString('hex'),
    leafCount: leaves.length
  };
}

// ============================================================
// PER-LEAF INCLUSION PROOF
// ============================================================

/**
 * Produce an inclusion proof for one leaf.
 * @param {object} treeWrap - return of buildTree()
 * @param {string|Buffer|Uint8Array} hash - the leaf to prove
 * @returns {{ hash_hex, root_hex, path, leaf_count, algorithm, detector }}
 *   path is an array of { position: 'left'|'right', hash_hex }
 */
function proveInclusion(treeWrap, hash) {
  const leaf = _toBuffer(hash);
  const proof = treeWrap.tree.getProof(leaf);
  return {
    hash_hex: leaf.toString('hex'),
    root_hex: treeWrap.rootHex,
    path: proof.map(p => ({
      position: p.position,
      hash_hex: Buffer.from(p.data).toString('hex')
    })),
    leaf_count: treeWrap.leafCount,
    algorithm: HASH_ALG,
    detector: DETECTOR
  };
}

// ============================================================
// OFFLINE VERIFICATION
// ============================================================

/**
 * Verify an inclusion proof against a claimed root, with no tree object
 * (caller has only the proof + the receipt hash + the public root).
 *
 * @param {{ hash_hex, root_hex, path, algorithm }} proof
 * @returns {boolean}
 */
function verifyInclusion(proof) {
  if (!proof || !proof.hash_hex || !proof.root_hex) return false;
  if (proof.algorithm && proof.algorithm !== HASH_ALG) return false;
  const leaf = Buffer.from(proof.hash_hex, 'hex');
  const pathBuf = (proof.path || []).map(p => ({
    position: p.position,
    data: Buffer.from(p.hash_hex, 'hex')
  }));
  const recomputed = MerkleTree.verify(pathBuf, leaf, Buffer.from(proof.root_hex, 'hex'), _sha256, { sortPairs: false });
  return !!recomputed;
}

// ============================================================
// BATCH STAMP (Merkle root + OpenTimestamps)
// ============================================================

/**
 * Build a Merkle root from N hashes, stamp the root with OpenTimestamps,
 * and return a per-hash bundle: { hash, proof, root_ots }.
 *
 * A downstream verifier checks:
 *   (1) The Merkle path proves the hash is included under the root
 *   (2) The OTS proof proves the root existed at or before a Bitcoin block
 * With both, the hash is transitively anchored.
 *
 * @param {Array<string|Buffer|Uint8Array>} hashes
 * @param {object} [opts] - passed to attention-anchor.stamp
 * @returns {Promise<{root_hex, root_ots, leaves: Array<{hash_hex, path, leaf_count}>}>}
 */
async function stampBatch(hashes, opts) {
  const anchor = require('./attention-anchor');
  const treeWrap = buildTree(hashes);
  const rootOts = await anchor.stamp(Buffer.from(treeWrap.rootHex, 'hex'), opts);
  const leaves = treeWrap.tree.getLeaves().map(l => {
    const p = proveInclusion(treeWrap, l);
    return { hash_hex: p.hash_hex, path: p.path, leaf_count: p.leaf_count };
  });
  return {
    detector: DETECTOR,
    status: rootOts.status,
    root_hex: treeWrap.rootHex,
    leaf_count: treeWrap.leafCount,
    root_ots: rootOts,
    leaves: leaves,
    note: 'Merkle-batched anchor. Verify a single receipt by (1) checking its path/root via attention-merkle.verifyInclusion(), then (2) checking root via attention-anchor.verify(root_hex, root_ots.proof_b64).'
  };
}

// ============================================================
// SINGLE-RECEIPT VERIFICATION PATH
// ============================================================

/**
 * Full two-step verification for one receipt in a batch:
 *   1. Inclusion proof links hash → root
 *   2. OTS proof anchors root to Bitcoin
 *
 * @param {string} hashHex - the receipt hash being verified
 * @param {object} proof - from proveInclusion() — path + root_hex
 * @param {string} rootOtsProofB64 - the batch-level OTS proof_b64
 * @returns {Promise<{valid, bitcoin_block_height?, bitcoin_block_time?, error?}>}
 */
async function verifyBatched(hashHex, proof, rootOtsProofB64) {
  if (!verifyInclusion(proof)) {
    return { valid: false, error: 'merkle_inclusion_failed' };
  }
  const anchor = require('./attention-anchor');
  const otsResult = await anchor.verify(proof.root_hex, rootOtsProofB64);
  if (!otsResult.valid) {
    return { valid: false, error: 'ots_not_bitcoin_confirmed: ' + otsResult.error };
  }
  return {
    valid: true,
    bitcoin_block_height: otsResult.bitcoin_block_height,
    bitcoin_block_time: otsResult.bitcoin_block_time
  };
}

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  buildTree,
  proveInclusion,
  verifyInclusion,
  stampBatch,
  verifyBatched,
  DETECTOR,
  HASH_ALG
};
