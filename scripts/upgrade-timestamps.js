#!/usr/bin/env node
/**
 * SWS Attention Protocol — OpenTimestamps Upgrade CLI
 *
 * Sweeps proof/results/*.json for signed JWT bundles that contain pending
 * OpenTimestamps proofs, attempts to upgrade each one (which requires the
 * OTS calendar servers to have committed to Bitcoin — typically ~1–12 hrs
 * after stamping), and writes the upgraded artifacts back in place.
 *
 * Usage:
 *   node scripts/upgrade-timestamps.js               # upgrade all pending
 *   node scripts/upgrade-timestamps.js <file.json>   # upgrade one file
 *   node scripts/upgrade-timestamps.js --dry-run     # no writes
 *
 * Exit codes:
 *   0  — done (any of: all confirmed, some still pending, nothing to do)
 *   1  — hard error (bad args, cannot read dir)
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const anchor = require('../src/sdk/attention-anchor');

const RESULTS_DIR = path.resolve(__dirname, '..', 'proof', 'results');

function parseArgs(argv) {
  const args = { dryRun: false, explicitFile: null };
  for (const a of argv.slice(2)) {
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node scripts/upgrade-timestamps.js [--dry-run] [<file.json>]');
      process.exit(0);
    } else if (!a.startsWith('--')) {
      args.explicitFile = a;
    }
  }
  return args;
}

function findFiles(explicitFile) {
  if (explicitFile) {
    return [path.resolve(explicitFile)];
  }
  if (!fs.existsSync(RESULTS_DIR)) return [];
  return fs.readdirSync(RESULTS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => path.join(RESULTS_DIR, f));
}

function hasPendingOts(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (obj.ots && obj.ots.status === 'pending') return true;
  // run-bot-vs-human output shape: { naive: {ots}, jittered: {ots}, ... }
  for (const k of Object.keys(obj)) {
    if (obj[k] && typeof obj[k] === 'object' && obj[k].ots && obj[k].ots.status === 'pending') {
      return true;
    }
  }
  return false;
}

async function upgradeInPlace(fileObj) {
  const summary = { attempted: 0, bitcoin_confirmed: 0, still_pending: 0, failed: 0 };
  const targets = [];
  if (fileObj.ots && fileObj.ots.status === 'pending') targets.push(fileObj);
  for (const k of Object.keys(fileObj)) {
    if (fileObj[k] && typeof fileObj[k] === 'object' && fileObj[k].ots && fileObj[k].ots.status === 'pending') {
      targets.push(fileObj[k]);
    }
  }
  for (const t of targets) {
    summary.attempted++;
    const upgraded = await anchor.upgrade(t.ots);
    t.ots = upgraded;
    if (upgraded.status === 'bitcoin_confirmed') summary.bitcoin_confirmed++;
    else if (upgraded.status === 'pending') summary.still_pending++;
    else summary.failed++;
  }
  return summary;
}

async function main() {
  const args = parseArgs(process.argv);
  const files = findFiles(args.explicitFile);

  if (files.length === 0) {
    console.log('No result files found at ' + RESULTS_DIR);
    return;
  }

  console.log('Sweeping ' + files.length + ' file(s) for pending OpenTimestamps proofs...');
  if (args.dryRun) console.log('(--dry-run: no writes will occur)');

  const totals = { files_touched: 0, attempted: 0, bitcoin_confirmed: 0, still_pending: 0, failed: 0 };

  for (const file of files) {
    let content;
    try {
      content = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      console.log('  ✗ ' + path.basename(file) + ' — parse error: ' + e.message);
      continue;
    }
    if (!hasPendingOts(content)) continue;

    console.log('  • ' + path.basename(file));
    const s = await upgradeInPlace(content);
    console.log('      attempted=' + s.attempted +
                ', bitcoin_confirmed=' + s.bitcoin_confirmed +
                ', still_pending=' + s.still_pending +
                ', failed=' + s.failed);

    if (!args.dryRun && s.attempted > 0) {
      fs.writeFileSync(file, JSON.stringify(content, null, 2) + '\n', 'utf8');
      totals.files_touched++;
    }
    totals.attempted += s.attempted;
    totals.bitcoin_confirmed += s.bitcoin_confirmed;
    totals.still_pending += s.still_pending;
    totals.failed += s.failed;
  }

  console.log('\nDone. Summary:');
  console.log('  files touched:       ' + totals.files_touched);
  console.log('  proofs attempted:    ' + totals.attempted);
  console.log('  bitcoin_confirmed:   ' + totals.bitcoin_confirmed);
  console.log('  still_pending:       ' + totals.still_pending);
  console.log('  failed:              ' + totals.failed);
  if (totals.still_pending > 0) {
    console.log('\nTip: Bitcoin anchoring typically takes 1–12 hrs. Re-run later.');
  }
}

main().catch(e => {
  console.error('ERROR:', e && e.message);
  process.exit(1);
});
