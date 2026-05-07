#!/usr/bin/env node
/**
 * Recorded-replay empirical test (Gap 2 from adversary-analysis-2026-05-07).
 *
 * Tests the trace-novelty fingerprint defense (R2-NEW-2b):
 *   1. Generate one synthetic event_log
 *   2. Write 5 sessions with the SAME event_log under DIFFERENT uids
 *   3. Wait for Firestore trigger to run on each
 *   4. Check trust_tier + bounds_violations on each
 *
 * Expected: first session passes clean (no prior fingerprint to match);
 * subsequent sessions get flagged with trace_novelty_low.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=$PWD/.gcp-key.json node scripts/test-replay-attack.js
 */
'use strict';

const path = require('path');
const ADMIN_PATH = path.join(process.cwd(), 'proof', 'functions', 'node_modules', 'firebase-admin');
const admin = require(ADMIN_PATH);
admin.initializeApp({ projectId: 'sws-attention-proofs' });
const db = admin.firestore();

function buildSyntheticEventLog() {
  // ~200 events spanning 120 seconds, mix of mouse moves and keystrokes
  const events = [];
  let t = 0;
  for (let i = 0; i < 200; i++) {
    const dt = 400 + Math.floor(Math.random() * 200);
    t += dt;
    if (i % 5 === 0) {
      events.push({ type: 'kd', t: t, key: 'a' });
    } else {
      events.push({ type: 'mm', t: t, x: 100 + (i * 3) % 800, y: 100 + (i * 7) % 600 });
    }
  }
  return {
    events: events,
    duration_ms: t
  };
}

function buildSessionWithEventLog(idx, eventLog, durationSec) {
  const sessionId = 'replay_test_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).slice(2, 8);
  return {
    session_id: sessionId,
    timestamp: Date.now(),
    composite: 0.62,
    signals: {
      composite: 0.62,
      timing: 0.6, hicks: 0.6, fitts: 0.6, scroll: 0.6, microPause: 0.6,
      touch: 0, keystroke: 0.6, readingSpeed: 0.6, hoverDwell: 0.6,
      tabVisibility: 0.95, inactivity: 0.6, rtVariability: 0.6,
      scrollBacktrack: 0.6, fractalScaling: 0.6, crossCorrelation: 0.6,
      curvatureIndex: 0.6, cursorJerk: 0.6, velocityProfile: 0.6,
      twoThirdsPower: 0.6, deviceMotion: 0, signalActive: 19
    },
    duration_sec: durationSec,
    hashes_earned: 5,
    quality_tier: 'active',
    user_agent: 'Mozilla/5.0 (X11; Linux x86_64) ReplayTest',
    source_type: 'replay_attack_test_2026-05-07',
    consent: { accepted: true, version: '2026-04' },
    composition_integrity: { mechanical: false, pasted: false, paste_count: 0 },
    environmental: { headless: false, automation_flags: [] },
    event_log: eventLog,
    uid: 'replay-attacker-' + idx
  };
}

(async () => {
  const N = 5;
  console.log('Replay-attack test: generating ONE synthetic event_log, writing ' + N + ' sessions under different uids...');
  const eventLog = buildSyntheticEventLog();
  const durationSec = Math.floor(eventLog.duration_ms / 1000);
  console.log('Event log: ' + eventLog.events.length + ' events, duration ' + durationSec + 's');

  const sessionIds = [];
  for (let i = 0; i < N; i++) {
    const session = buildSessionWithEventLog(i, eventLog, durationSec);
    sessionIds.push(session.session_id);
    await db.collection('demos').doc(session.session_id).set(session);
    console.log('  wrote session ' + (i + 1) + '/' + N + ' (uid: replay-attacker-' + i + ')');
    // Small delay between writes so triggers run sequentially and earlier
    // fingerprints are written before later ones run their lookup.
    await new Promise(r => setTimeout(r, 3000));
  }
  console.log('All written. Waiting 20 seconds for triggers to complete on the last one...');
  await new Promise(r => setTimeout(r, 20000));

  console.log('\n=== REPLAY-ATTACK TEST RESULTS ===');
  let cleanCount = 0;
  let flaggedCount = 0;
  let signedCount = 0;
  let unsignedCount = 0;
  for (let i = 0; i < N; i++) {
    const doc = await db.collection('demos').doc(sessionIds[i]).get();
    const d = doc.data();
    const trustTier = d.trust_tier || '(none)';
    const violations = (d.bounds_violations || []).join(', ');
    const signed = !!d.signed_jwt;
    if (signed) signedCount++; else unsignedCount++;
    const flagged = (d.bounds_violations || []).some(v => v.indexOf('trace_novelty_low') === 0);
    if (flagged) flaggedCount++; else cleanCount++;
    console.log('  Session ' + (i + 1) + ': trust_tier=' + trustTier +
                ' | violations=[' + violations + ']' +
                ' | signed=' + signed +
                ' | flagged_by_trace_novelty=' + flagged);
  }

  console.log('\n=== SUMMARY ===');
  console.log('Total replays: ' + N);
  console.log('  Signed:                 ' + signedCount);
  console.log('  Flagged by trace-novelty: ' + flaggedCount);
  console.log('  Clean (no flag):          ' + cleanCount);
  console.log('');
  if (flaggedCount >= N - 1) {
    console.log('PASS: trace-novelty defense caught ' + flaggedCount + '/' + (N - 1) + ' replays after the first.');
  } else if (flaggedCount === 0) {
    console.log('FAIL: trace-novelty did NOT flag any replays. Defense is not running or fingerprint logic is wrong.');
  } else {
    console.log('PARTIAL: trace-novelty flagged ' + flaggedCount + '/' + (N - 1) + ' — investigate timing or lookup window.');
  }
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
