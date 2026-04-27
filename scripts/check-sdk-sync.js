#!/usr/bin/env node
/**
 * SDK sync check — round-3 R3-NEW-9 / round-4 / round-5 / round-6
 * fan-out finding: src/sdk/* and proof/sdk/* are two parallel copies
 * of the browser SDK. Drift between them has caused recurring
 * security findings (the round-3 SHA-256 UTF-8 fix landed in src/sdk
 * but not proof/sdk, leaving cme-demo.html still vulnerable; round-4
 * caught the same pattern with three more files). This script asserts
 * the files that MUST mirror are byte-identical and exits non-zero
 * (failing CI) when they drift.
 *
 * Files NOT required to mirror are noted as "intentional divergence"
 * with a reason.
 *
 * Usage: node scripts/check-sdk-sync.js
 *        node scripts/check-sdk-sync.js --fix    # copy src/sdk → proof/sdk
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO = path.join(__dirname, '..');
const SRC = path.join(REPO, 'src', 'sdk');
const PROOF = path.join(REPO, 'proof', 'sdk');

// The rule: every file that exists in BOTH src/sdk/ and proof/sdk/
// must be byte-identical. Files only in one or the other are by
// design (Node-side modules in src/sdk; page-specific modules in
// proof/sdk). Drift between paired files has caused recurring
// security findings (round-3 SHA-256 fix landed in one only;
// round-4 caught the same pattern with three more files).
//
// Files explicitly ALLOWED to diverge (must be in exactly one dir).
const PROOF_ONLY = ['composition-integrity.js', 'honeypot-canary.js'];
const SRC_ONLY_NODE = [
  'attention-anchor.js', 'attention-merkle.js', 'attention-receipts.js',
  'attention-signer.js', 'attention-tsa.js', 'baseline-profiler.js',
  'content-attention-tracker.js', 'credential-compress.js',
  'device-binding.js', 'differential-privacy.js', 'firestore-sync-fix.js',
  'firestore.rules', 'ga4-bridge.js', 'integration-examples.js',
  'medical-shift-monitor.js', 'military-readiness.js', 'movement-fitness.js',
  'notifications.js', 'open-badge.js', 'receipt-composite.js',
  'session-integrity-validator.js', 'share-to-earn.js',
  'temporal-session-analyzer.js', 'verifiable-credentials.js',
  'vertical-scoring-profiles.js', 'video-attention-tracker.js',
  'xapi-adapter.js'
];

// Currently-known divergent files between src/sdk and proof/sdk.
// Documented reasons; eventual goal is to delete this list as the
// build pipeline is unified.
const KNOWN_DIVERGENCE = {
  'attention-protocol.js': 'proof/sdk has consent-poll wiring (round-6 R5-NEW-5) for browser; src/sdk is cleaner for npm. Both have the round-3+4 UTF-8 SHA-256 fix. Function-level diff should be limited to integration glue. TODO: move to single-source via build step (T2-11).',
  'privacy-compliance.js': 'proof/sdk is older. Sync planned in T2-11.'
};

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function listSdkFiles(dir) {
  return fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort();
}

function main() {
  const fix = process.argv.includes('--fix');
  const srcFiles = new Set(listSdkFiles(SRC));
  const proofFiles = new Set(listSdkFiles(PROOF));
  const intersection = [...srcFiles].filter(f => proofFiles.has(f)).sort();

  const violations = [];
  const inSync = [];
  const allowedDivergent = [];

  for (const f of intersection) {
    if (sha256(path.join(SRC, f)) === sha256(path.join(PROOF, f))) {
      inSync.push(f);
    } else if (f in KNOWN_DIVERGENCE) {
      allowedDivergent.push(f);
    } else {
      violations.push(`${f}: src/sdk and proof/sdk DIFFER (drift not in KNOWN_DIVERGENCE)`);
      if (fix) {
        fs.copyFileSync(path.join(SRC, f), path.join(PROOF, f));
        console.log(`  --fix: src/sdk/${f} → proof/sdk/${f}`);
      }
    }
  }

  console.log(`SDK sync report:`);
  console.log(`  In sync: ${inSync.length}/${intersection.length} paired files`);
  if (inSync.length) console.log(`    ✓ ${inSync.join(', ')}`);
  if (allowedDivergent.length) {
    console.log(`  Known-divergent (documented): ${allowedDivergent.length}`);
    for (const f of allowedDivergent) {
      console.log(`    ⚠ ${f}: ${KNOWN_DIVERGENCE[f].slice(0, 100)}...`);
    }
  }
  console.log(`  src/sdk-only (Node modules): ${srcFiles.size - intersection.length}`);
  console.log(`  proof/sdk-only (page-specific): ${proofFiles.size - intersection.length}`);

  if (violations.length) {
    console.log(`\n✗ ${violations.length} drift violation(s):`);
    for (const v of violations) console.log(`  - ${v}`);
    if (!fix) {
      console.log(`\nRe-run with --fix to copy src/sdk → proof/sdk, OR add the file to KNOWN_DIVERGENCE with a documented reason.`);
      process.exit(1);
    }
  } else {
    console.log(`\n✓ All paired SDK files are in sync OR documented in KNOWN_DIVERGENCE.`);
  }
}

main();
