#!/usr/bin/env node
/**
 * SWS Attention Protocol — Session Inspector
 *
 * Given a demo.html session ID, fetch the Firestore document and render
 * every attestation layer side-by-side for inspection.
 *
 * Usage:
 *   node scripts/inspect-session.js demo_1776705432_abc123
 *
 * The script anonymous-auths against the sws-attention-proofs project
 * (same auth path the live demo uses) and reads demos/{sessionId}.
 *
 * (c) 2026 SWS Strategic Media LLC. Patent Pending SWS-PROV-001.
 */
'use strict';

// Firebase Web SDK works in Node with no shims once you avoid analytics.
const { initializeApp } = require('firebase/app');
const { getAuth, signInAnonymously } = require('firebase/auth');
const { getFirestore, doc, getDoc } = require('firebase/firestore');

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDbpqisJpnoh2OUYSJIdKIo17SdF0eGPiM',
  authDomain: 'sws-attention-proofs.firebaseapp.com',
  projectId: 'sws-attention-proofs',
  storageBucket: 'sws-attention-proofs.firebasestorage.app',
  messagingSenderId: '420661886092',
  appId: '1:420661886092:web:a4c79cd07fc804428f4fa9'
};

// ---------------------------------------------------------------
// FORMATTERS
// ---------------------------------------------------------------

const COLORS = {
  dim: '\x1b[90m', green: '\x1b[32m', yellow: '\x1b[33m',
  red: '\x1b[31m', cyan: '\x1b[36m', bold: '\x1b[1m', reset: '\x1b[0m'
};

function c(color, s) { return COLORS[color] + s + COLORS.reset; }

function section(title) {
  const line = '─'.repeat(60);
  console.log('\n' + c('cyan', line));
  console.log(c('cyan', '  ' + title));
  console.log(c('cyan', line));
}

function kv(k, v, verdict) {
  const pad = k.padEnd(28);
  let val = v;
  if (verdict === 'ok') val = c('green', '✓ ' + v);
  else if (verdict === 'warn') val = c('yellow', '! ' + v);
  else if (verdict === 'bad') val = c('red', '✗ ' + v);
  else if (verdict === 'dim') val = c('dim', v);
  console.log('  ' + pad + val);
}

function render(data, sessionId) {
  section('Session ' + sessionId);
  kv('generated', data.generated || data.timestamp || '—');
  kv('duration', (data.duration_sec || '?') + ' sec');
  kv('source_type', data.source_type || data.source || '—');
  kv('uid', data.uid || '—');

  // --- Behavioral composite ---
  section('2. Behavioral composite (15 signals)');
  const s = data.signals || {};
  const composite = s.composite != null ? s.composite : null;
  const tier = data.quality_tier;
  const compVerdict = composite == null ? 'dim'
                      : composite >= 0.55 ? 'ok'
                      : composite >= 0.35 ? 'warn' : 'bad';
  kv('composite', composite != null ? composite.toFixed(3) : '—', compVerdict);
  kv('quality_tier', tier || '—', tier === 'deep' || tier === 'active' ? 'ok' : tier ? 'warn' : 'dim');
  kv('active_signals', (data.active_signals || '?') + ' / ' + (data.total_signals || '?'));
  kv('hashes_earned', data.hashes_earned || 0);
  kv('scroll_depth_pct', (data.scroll_depth_pct || 0) + '%');
  kv('typed_words', data.typed_words || 0);

  // Render the individual signal values if present
  const sigNames = ['timing', 'fitts', 'hicks', 'scroll', 'microPause', 'touch',
                    'autonomic', 'spatial', 'motor', 'typing', 'intent', 'device'];
  const presentSigs = sigNames.filter(n => typeof s[n] === 'number');
  if (presentSigs.length > 0) {
    console.log('\n  Individual signals:');
    for (const n of presentSigs) {
      const val = s[n];
      const v = val >= 0.6 ? 'ok' : val >= 0.4 ? 'warn' : 'bad';
      kv('  ' + n, val.toFixed(3), v);
    }
  }

  // --- Environmental gate ---
  section('1. Environmental gate (BotD)');
  const env = data.environmental;
  if (!env) { kv('status', 'NOT CAPTURED', 'bad'); }
  else if (!env.loaded) { kv('status', 'unknown (' + (env.error || 'n/a') + ')', 'warn'); }
  else if (env.bot) { kv('status', 'BOT DETECTED (' + env.bot_kind + ')', 'bad'); }
  else {
    kv('status', 'clean (real browser)', 'ok');
    kv('latency_ms', env.latency_ms || '—');
    kv('detector', env.detector);
  }

  // --- Composition integrity ---
  section('3. Composition integrity (Signal 21)');
  const ci = data.composition_integrity;
  if (!ci) { kv('status', 'NOT CAPTURED', 'bad'); }
  else if (ci.composition_verdict === 'unknown') {
    kv('verdict', 'unknown (insufficient data)', 'warn');
    kv('chars_observed', ci.chars_observed || 0);
  } else {
    const v = ci.composition_verdict;
    const verdictColor = v === 'authored' ? 'ok' : v === 'pasted' || v === 'mechanical' ? 'bad' : 'warn';
    kv('verdict', v, verdictColor);
    kv('score', ci.composition_integrity_score != null ? ci.composition_integrity_score.toFixed(2) : '—');
    kv('chars_typed', ci.chars_typed || 0);
    kv('chars_deleted', ci.chars_deleted || 0);
    kv('chars_pasted', ci.chars_pasted || 0);
    kv('paste_burst_count', ci.paste_burst_count || 0,
       (ci.paste_burst_count || 0) === 0 ? 'ok' : 'bad');
    kv('backspace_ratio', ci.backspace_ratio != null ? ci.backspace_ratio.toFixed(3) : '—');
    if (ci.digraph_stats) {
      kv('digraph CV', ci.digraph_stats.cv != null ? ci.digraph_stats.cv.toFixed(3) : '—');
      kv('digraph mean_ms', ci.digraph_stats.mean_ms != null ? ci.digraph_stats.mean_ms.toFixed(0) : '—');
      kv('subhuman intervals', (ci.digraph_stats.subhuman_interval_count || 0) + ' / ' + (ci.digraph_stats.total_intervals || 0));
    }
  }

  // --- Consent ---
  section('4. Consent attestation');
  const consent = data.consent;
  if (!consent) { kv('status', 'NOT CAPTURED', 'bad'); }
  else if (!consent.granted) { kv('status', 'NOT granted', 'warn'); }
  else {
    kv('status', 'granted', 'ok');
    kv('categories', (consent.categories || []).join(', ') || '—');
    kv('timestamp', consent.timestamp || '—');
    kv('version', consent.version || '—');
  }

  // --- GA4 comparison (separate) ---
  if (data.ga4_would_capture) {
    section('GA4 Comparison (what a naive tracker would see)');
    kv('events', (data.ga4_would_capture.events || []).join(', '));
    kv('engagement_time', (data.ga4_would_capture.engagement_time_sec || 0) + 's');
    kv('scroll_depth', (data.ga4_would_capture.scroll_depth_pct || 0) + '%');
    kv('crypto_receipt', data.ga4_would_capture.crypto_receipt, 'dim');
  }

  section('Assessment');
  const issues = [];
  if (!env) issues.push('environmental block missing (BotD did not run)');
  if (!ci) issues.push('composition_integrity block missing (gate did not attach)');
  if (!consent) issues.push('consent block missing (banner may not have shown)');
  if (composite != null && composite < 0.3) issues.push('composite unusually low — possible SDK regression');

  if (issues.length === 0) {
    console.log('  ' + c('green', '✓ All six-layer blocks present. SDK healthy on real hardware.'));
  } else {
    console.log('  ' + c('yellow', 'Issues to investigate:'));
    for (const i of issues) console.log('  ' + c('yellow', '  • ' + i));
  }
  console.log('');
}

// ---------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------

async function main() {
  const sessionId = process.argv[2];
  if (!sessionId) {
    console.error('Usage: node scripts/inspect-session.js <demo_session_id>');
    process.exit(1);
  }

  const app = initializeApp(FIREBASE_CONFIG);
  const auth = getAuth(app);
  const db = getFirestore(app);

  try {
    await signInAnonymously(auth);
  } catch (e) {
    console.error('Anonymous auth failed:', e.code || e.message);
    process.exit(1);
  }

  const snap = await getDoc(doc(db, 'demos', sessionId));
  if (!snap.exists()) {
    console.error(c('red', 'Session not found: ' + sessionId));
    console.error(c('dim', '  (Firestore path: demos/' + sessionId + ')'));
    process.exit(2);
  }

  render(snap.data(), sessionId);
  process.exit(0);
}

main().catch(e => { console.error('ERROR:', e && (e.stack || e.message)); process.exit(1); });
