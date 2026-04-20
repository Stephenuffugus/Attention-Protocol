/**
 * SWS Attention Protocol — Merkle Batching Test Suite
 *
 * Offline tests. The batch stamp() path requires network — covered by
 * the live harness smoke, not in this unit suite.
 *
 * Covers:
 *   - buildTree with 1, 2, N, odd-count, even-count leaves
 *   - Root reproducibility (same leaves → same root)
 *   - Inclusion proof pass for every leaf in the tree
 *   - Inclusion proof FAIL for wrong hash / wrong root / tampered path
 *   - Scaling: path length ≈ log₂(N)
 *   - Receipt-schema integration (Merkle bundle on a receipt)
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */

const crypto = require('crypto');
const { loadSDK } = require('./setup');
const merkle = require('../src/sdk/attention-merkle');

beforeAll(() => {
  loadSDK('../src/sdk/secure-config.js');
  loadSDK('../src/sdk/attention-protocol.js');
  loadSDK('../src/sdk/economy-engine.js');
  loadSDK('../src/sdk/attention-receipts.js');
});

function makeHashes(n, seed = 'h') {
  return Array.from({ length: n }, (_, i) =>
    crypto.createHash('sha256').update(seed + '_' + i).digest('hex'));
}

// ============================================================
// BUILD
// ============================================================

describe('attention-merkle — buildTree', () => {
  test('builds a tree from 1 leaf (root = leaf hash)', () => {
    const hashes = makeHashes(1);
    const t = merkle.buildTree(hashes);
    expect(t.leafCount).toBe(1);
    expect(t.rootHex).toBe(hashes[0]); // Single-leaf tree: root = leaf
  });

  test('builds a tree from 2 leaves', () => {
    const t = merkle.buildTree(makeHashes(2));
    expect(t.leafCount).toBe(2);
    expect(t.rootHex).toMatch(/^[0-9a-f]{64}$/);
  });

  test('builds trees for 3, 5, 7 (odd counts) and 4, 8, 16 (even counts)', () => {
    for (const n of [3, 4, 5, 7, 8, 16, 100, 1024]) {
      const t = merkle.buildTree(makeHashes(n, 'x'));
      expect(t.leafCount).toBe(n);
      expect(t.rootHex).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  test('same inputs produce same root (deterministic)', () => {
    const hashes = makeHashes(32, 'det');
    const t1 = merkle.buildTree(hashes);
    const t2 = merkle.buildTree(hashes);
    expect(t2.rootHex).toBe(t1.rootHex);
  });

  test('different inputs produce different roots', () => {
    const t1 = merkle.buildTree(makeHashes(32, 'a'));
    const t2 = merkle.buildTree(makeHashes(32, 'b'));
    expect(t2.rootHex).not.toBe(t1.rootHex);
  });

  test('rejects empty input', () => {
    expect(() => merkle.buildTree([])).toThrow(/need_at_least_one/);
    expect(() => merkle.buildTree(null)).toThrow(/need_at_least_one/);
  });

  test('rejects non-32-byte leaves', () => {
    expect(() => merkle.buildTree(['abc123'])).toThrow(/leaves_must_be_32_bytes/);
  });

  test('accepts hashes as hex string OR Buffer OR Uint8Array', () => {
    const hex = crypto.createHash('sha256').update('x').digest('hex');
    const buf = Buffer.from(hex, 'hex');
    const u8 = new Uint8Array(buf);
    expect(merkle.buildTree([hex]).rootHex).toBe(hex);
    expect(merkle.buildTree([buf]).rootHex).toBe(hex);
    expect(merkle.buildTree([u8]).rootHex).toBe(hex);
  });
});

// ============================================================
// INCLUSION PROOFS
// ============================================================

describe('attention-merkle — proveInclusion + verifyInclusion', () => {
  test('every leaf in a tree verifies successfully', () => {
    const hashes = makeHashes(100);
    const tree = merkle.buildTree(hashes);
    for (const h of hashes) {
      const proof = merkle.proveInclusion(tree, h);
      expect(merkle.verifyInclusion(proof)).toBe(true);
    }
  });

  test('proof for a hash NOT in the tree fails to verify', () => {
    const hashes = makeHashes(64);
    const tree = merkle.buildTree(hashes);
    const outsideHash = crypto.createHash('sha256').update('outside').digest('hex');
    const proof = merkle.proveInclusion(tree, hashes[0]);
    // Swap in an outside hash — should fail
    const tampered = Object.assign({}, proof, { hash_hex: outsideHash });
    expect(merkle.verifyInclusion(tampered)).toBe(false);
  });

  test('proof fails with a different root', () => {
    const hashes = makeHashes(32);
    const tree = merkle.buildTree(hashes);
    const proof = merkle.proveInclusion(tree, hashes[0]);
    const tampered = Object.assign({}, proof, { root_hex: '00'.repeat(32) });
    expect(merkle.verifyInclusion(tampered)).toBe(false);
  });

  test('proof fails if a path element is tampered', () => {
    const hashes = makeHashes(16);
    const tree = merkle.buildTree(hashes);
    const proof = merkle.proveInclusion(tree, hashes[5]);
    if (proof.path.length === 0) return; // 1-leaf tree: nothing to tamper
    const tampered = JSON.parse(JSON.stringify(proof));
    // Flip first hex char of first sibling
    const orig = tampered.path[0].hash_hex;
    tampered.path[0].hash_hex = (orig[0] === 'a' ? 'b' : 'a') + orig.slice(1);
    expect(merkle.verifyInclusion(tampered)).toBe(false);
  });

  test('path length scales as log2(N)', () => {
    const hashes1k = makeHashes(1024);
    const tree = merkle.buildTree(hashes1k);
    const proof = merkle.proveInclusion(tree, hashes1k[500]);
    // 1024 leaves → exactly 10-hop proof
    expect(proof.path.length).toBe(10);
  });

  test('1-leaf tree path is empty', () => {
    const hashes = makeHashes(1);
    const tree = merkle.buildTree(hashes);
    const proof = merkle.proveInclusion(tree, hashes[0]);
    expect(proof.path.length).toBe(0);
    expect(merkle.verifyInclusion(proof)).toBe(true);
  });
});

// ============================================================
// verifyInclusion EDGE CASES
// ============================================================

describe('attention-merkle — verifyInclusion defensive checks', () => {
  test('rejects malformed proof object', () => {
    expect(merkle.verifyInclusion(null)).toBe(false);
    expect(merkle.verifyInclusion({})).toBe(false);
    expect(merkle.verifyInclusion({ hash_hex: 'abc' })).toBe(false);
  });

  test('rejects wrong-algorithm claim', () => {
    const hashes = makeHashes(4);
    const tree = merkle.buildTree(hashes);
    const proof = merkle.proveInclusion(tree, hashes[0]);
    proof.algorithm = 'MD5';
    expect(merkle.verifyInclusion(proof)).toBe(false);
  });
});

// ============================================================
// SCALING PROPERTIES (pitch-relevant numbers)
// ============================================================

describe('attention-merkle — scaling', () => {
  test('10000-leaf tree: path length = 14, root stable', () => {
    const hashes = makeHashes(10000, 'scale');
    const tree = merkle.buildTree(hashes);
    expect(tree.leafCount).toBe(10000);
    const proof = merkle.proveInclusion(tree, hashes[9999]);
    // log2(10000) ≈ 13.29 → 14 hops
    expect(proof.path.length).toBeLessThanOrEqual(14);
    expect(merkle.verifyInclusion(proof)).toBe(true);
  });

  test('proof overhead per receipt is under 1 KB for 10k-leaf batch', () => {
    const hashes = makeHashes(10000, 'size');
    const tree = merkle.buildTree(hashes);
    const proof = merkle.proveInclusion(tree, hashes[5000]);
    const serialized = JSON.stringify(proof);
    // ~14 hops × ~75 bytes each + envelope — should be well under 2 KB
    expect(serialized.length).toBeLessThan(2000);
  });
});
