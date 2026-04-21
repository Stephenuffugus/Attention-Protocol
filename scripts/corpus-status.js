#!/usr/bin/env node
/**
 * SWS Attention Protocol — Corpus collection status tracker
 *
 * Queries Firestore `demos` collection for sessions matching a given
 * source_type tag and prints summary stats: count, composite
 * distribution, quality-tier breakdown, environmental/composition
 * verdicts. Companion to docs/corpus-collection-kit.md.
 *
 * Setup (one-time):
 *   # Option 1 — gcloud application default credentials
 *   gcloud auth application-default login
 *
 *   # Option 2 — service account key
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *
 * Usage:
 *   node scripts/corpus-status.js <source_type>
 *   node scripts/corpus-status.js corpus_2026-04-21_batch1
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
'use strict';

const path = require('path');

// Use firebase-admin from proof/functions/node_modules since it's a peer
// dev-dep of the functions package, not the root.
const ADMIN_PATH = path.join(__dirname, '..', 'proof', 'functions', 'node_modules', 'firebase-admin');
let admin;
try {
  admin = require(ADMIN_PATH);
} catch (e) {
  console.error('firebase-admin not found at', ADMIN_PATH);
  console.error('Run `cd proof/functions && npm install` first.');
  process.exit(1);
}

const PROJECT_ID = 'sws-attention-proofs';

function pct(n, total) {
  if (!total) return '0.0%';
  return ((n / total) * 100).toFixed(1) + '%';
}

function stats(arr) {
  if (arr.length === 0) return { n: 0 };
  const sorted = [...arr].sort((a, b) => a - b);
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  return {
    n: arr.length,
    min: Math.min(...arr),
    max: Math.max(...arr),
    mean: +mean.toFixed(3),
    median: +median.toFixed(3)
  };
}

async function main() {
  const sourceType = process.argv[2];
  if (!sourceType) {
    console.error('usage: node scripts/corpus-status.js <source_type>');
    console.error('example: node scripts/corpus-status.js corpus_2026-04-21_batch1');
    process.exit(1);
  }

  admin.initializeApp({ projectId: PROJECT_ID });
  const db = admin.firestore();

  console.log('Querying demos where source_type ==', sourceType, '...\n');

  let snap;
  try {
    snap = await db.collection('demos').where('source_type', '==', sourceType).get();
  } catch (e) {
    console.error('Firestore query failed:', e.message);
    console.error('Check your credentials: gcloud auth application-default login');
    process.exit(1);
  }

  if (snap.empty) {
    console.log('No sessions found for this tag yet.');
    console.log('');
    console.log('Share the link: https://sws-attention-proofs.web.app/demo.html?source=' + sourceType);
    process.exit(0);
  }

  const sessions = [];
  snap.forEach(doc => sessions.push(doc.data()));

  const composites = sessions.map(s => Number(s.composite || 0)).filter(n => !isNaN(n));
  const durations = sessions.map(s => Number(s.duration_ms || 0) / 1000).filter(n => !isNaN(n));
  const interactions = sessions.map(s => Number(s.interaction_count || 0)).filter(n => !isNaN(n));

  const tiers = {};
  sessions.forEach(s => {
    const t = s.quality_tier || 'unknown';
    tiers[t] = (tiers[t] || 0) + 1;
  });

  const envBot = sessions.filter(s => s.environmental && s.environmental.bot === true).length;
  const envClean = sessions.filter(s => s.environmental && s.environmental.loaded === true && s.environmental.bot === false).length;
  const envUnloaded = sessions.filter(s => !s.environmental || s.environmental.loaded !== true).length;

  const ciVerdicts = {};
  sessions.forEach(s => {
    const v = (s.composition_integrity && s.composition_integrity.composition_verdict) || 'no_data';
    ciVerdicts[v] = (ciVerdicts[v] || 0) + 1;
  });

  const cleanHuman = sessions.filter(s =>
    Number(s.composite || 0) >= 0.55 &&
    ['active', 'deep'].includes(s.quality_tier) &&
    s.environmental && s.environmental.bot === false &&
    s.composition_integrity && s.composition_integrity.composition_verdict === 'authored' &&
    Number(s.interaction_count || 0) >= 30
  ).length;

  const cs = stats(composites);
  const ds = stats(durations);
  const is = stats(interactions);

  console.log('━━━ CORPUS: ' + sourceType + ' ━━━');
  console.log('Total sessions:               ', sessions.length);
  console.log('Sessions meeting "clean" bar: ', cleanHuman, '(' + pct(cleanHuman, sessions.length) + ')');
  console.log('');
  console.log('Composite score:');
  console.log('  n=' + cs.n + '  min=' + cs.min + '  mean=' + cs.mean + '  median=' + cs.median + '  max=' + cs.max);
  console.log('');
  console.log('Duration (sec):');
  console.log('  n=' + ds.n + '  min=' + ds.min.toFixed(0) + '  mean=' + ds.mean.toFixed(1) + '  max=' + ds.max.toFixed(0));
  console.log('');
  console.log('Interactions:');
  console.log('  n=' + is.n + '  min=' + is.min + '  mean=' + is.mean + '  max=' + is.max);
  console.log('');
  console.log('Quality tier breakdown:');
  for (const [tier, n] of Object.entries(tiers).sort((a, b) => b[1] - a[1])) {
    console.log('  ' + tier.padEnd(12) + n + '  ' + pct(n, sessions.length));
  }
  console.log('');
  console.log('Environmental gate:');
  console.log('  bot=false (clean)  ' + envClean + '  ' + pct(envClean, sessions.length));
  console.log('  bot=true  (flagged)' + envBot + '  ' + pct(envBot, sessions.length));
  console.log('  not loaded         ' + envUnloaded + '  ' + pct(envUnloaded, sessions.length));
  console.log('');
  console.log('Composition integrity:');
  for (const [verdict, n] of Object.entries(ciVerdicts).sort((a, b) => b[1] - a[1])) {
    console.log('  ' + verdict.padEnd(14) + n + '  ' + pct(n, sessions.length));
  }
  console.log('');
  if (cleanHuman >= 6) {
    console.log('✓ N>=6 clean humans: corpus target met. Ready to update YC app + run benchmarks.');
  } else {
    console.log('Need ' + (6 - cleanHuman) + ' more clean human sessions to hit N=6.');
  }
}

main().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
