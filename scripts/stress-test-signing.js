#!/usr/bin/env node
/**
 * Production signing stress test — May 7 post-fix
 *
 * Fires N synthetic sessions through the Firestore trigger, waits,
 * measures signing success rate, verifies each signed JWT against
 * the live JWKS.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=$PWD/.gcp-key.json node scripts/stress-test-signing.js [N]
 *
 * Default N=50. Each session is tagged source_type=stress_test_2026-05-07.
 */
'use strict';

const path = require('path');
const https = require('https');
const crypto = require('crypto');
const ADMIN_PATH = path.join(process.cwd(), 'proof', 'functions', 'node_modules', 'firebase-admin');
const admin = require(ADMIN_PATH);
admin.initializeApp({ projectId: 'sws-attention-proofs' });
const db = admin.firestore();

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

function buildSession(i) {
  const variants = [
    { composite: 0.55 + Math.random() * 0.15, ua: 'Mozilla/5.0 (X11; Linux) StressTest', device: 'desktop' },
    { composite: 0.45 + Math.random() * 0.15, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)', device: 'mobile-ios' },
    { composite: 0.50 + Math.random() * 0.15, ua: 'Mozilla/5.0 (Linux; Android 14)', device: 'mobile-android' },
    { composite: 0.30 + Math.random() * 0.10, ua: 'HeadlessChrome/120.0 Puppeteer', device: 'headless' },
    { composite: 0.95 + Math.random() * 0.04, ua: 'Mozilla/5.0 (Windows NT 10.0)', device: 'desktop-high' }
  ];
  const v = variants[i % variants.length];
  const sessionId = 'stress_' + Date.now() + '_' + i + '_' + Math.random().toString(36).slice(2, 8);
  return {
    session_id: sessionId,
    timestamp: Date.now(),
    composite: v.composite,
    signals: {
      composite: v.composite,
      timing: 0.4 + Math.random() * 0.4, hicks: 0.4 + Math.random() * 0.4,
      fitts: 0.4 + Math.random() * 0.4, scroll: 0.4 + Math.random() * 0.4,
      microPause: 0.4 + Math.random() * 0.4, touch: v.device.startsWith('mobile') ? 0.4 + Math.random() * 0.3 : 0,
      keystroke: 0.4 + Math.random() * 0.4, readingSpeed: 0.4 + Math.random() * 0.4,
      hoverDwell: 0.4 + Math.random() * 0.4, tabVisibility: 0.8 + Math.random() * 0.2,
      inactivity: 0.4 + Math.random() * 0.4, rtVariability: 0.4 + Math.random() * 0.4,
      scrollBacktrack: 0.4 + Math.random() * 0.4, fractalScaling: 0.4 + Math.random() * 0.4,
      crossCorrelation: 0.4 + Math.random() * 0.4,
      curvatureIndex: v.device === 'desktop' ? 0.4 + Math.random() * 0.4 : 0,
      cursorJerk: v.device === 'desktop' ? 0.4 + Math.random() * 0.4 : 0,
      velocityProfile: v.device === 'desktop' ? 0.4 + Math.random() * 0.4 : 0,
      twoThirdsPower: v.device === 'desktop' ? 0.4 + Math.random() * 0.4 : 0,
      deviceMotion: v.device.startsWith('mobile') ? 0.3 + Math.random() * 0.3 : 0,
      signalActive: v.device === 'desktop' ? 19 : 16
    },
    duration_sec: 60 + Math.floor(Math.random() * 240),
    hashes_earned: Math.floor(Math.random() * 10),
    quality_tier: v.composite > 0.55 ? 'active' : 'passive',
    user_agent: v.ua,
    source_type: 'stress_test_2026-05-07',
    consent: { accepted: true, version: '2026-04' },
    composition_integrity: { mechanical: false, pasted: false, paste_count: 0 },
    environmental: { headless: v.device === 'headless', automation_flags: [] },
    uid: 'stress-test-' + i
  };
}

async function verifyJwt(jwt, jwks) {
  const [headerB64, payloadB64, sigB64] = jwt.split('.');
  const fromB64Url = s => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const header = JSON.parse(fromB64Url(headerB64).toString('utf8'));
  const key = jwks.keys.find(k => k.kid === header.kid);
  if (!key) return { valid: false, reason: 'no_matching_kid' };
  const xBytes = fromB64Url(key.x);
  const SPKI_ED25519_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
  const spki = Buffer.concat([SPKI_ED25519_PREFIX, xBytes]);
  const publicKey = crypto.createPublicKey({ key: spki, format: 'der', type: 'spki' });
  const signingInput = Buffer.from(headerB64 + '.' + payloadB64, 'utf8');
  const sig = fromB64Url(sigB64);
  const valid = crypto.verify(null, signingInput, publicKey, sig);
  return { valid, kid: header.kid };
}

(async () => {
  const N = parseInt(process.argv[2] || '50', 10);
  console.log('Stress test: writing ' + N + ' synthetic sessions...');
  const sessionIds = [];
  for (let i = 0; i < N; i++) {
    const session = buildSession(i);
    sessionIds.push(session.session_id);
    await db.collection('demos').doc(session.session_id).set(session);
    if ((i + 1) % 10 === 0) console.log('  wrote ' + (i + 1) + '/' + N);
  }
  console.log('All written at: ' + new Date().toISOString());
  console.log('Waiting 60 seconds for triggers to complete...');
  await new Promise(r => setTimeout(r, 60000));

  console.log('Fetching results + JWKS...');
  const jwks = await fetchJson('https://sws-attention-proofs.web.app/.well-known/attention-pubkey.json');
  let signed = 0;
  let failed = 0;
  let pending = 0;
  let verifyOk = 0;
  let verifyFail = 0;
  const failureReasons = {};

  for (const sid of sessionIds) {
    const doc = await db.collection('demos').doc(sid).get();
    const d = doc.data();
    if (d.signed_jwt) {
      signed++;
      const v = await verifyJwt(d.signed_jwt, jwks);
      if (v.valid) verifyOk++;
      else {
        verifyFail++;
        failureReasons['verify_' + (v.reason || 'invalid')] = (failureReasons['verify_' + (v.reason || 'invalid')] || 0) + 1;
      }
    } else if (d.signing_error) {
      failed++;
      failureReasons['sign_' + d.signing_error] = (failureReasons['sign_' + d.signing_error] || 0) + 1;
    } else {
      pending++;
    }
  }

  console.log('\n=== STRESS TEST RESULTS ===');
  console.log('Total: ' + N);
  console.log('  Signed:    ' + signed + ' (' + ((signed / N) * 100).toFixed(1) + '%)');
  console.log('  Failed:    ' + failed + ' (' + ((failed / N) * 100).toFixed(1) + '%)');
  console.log('  Pending:   ' + pending + ' (' + ((pending / N) * 100).toFixed(1) + '%) — trigger may still be running');
  console.log('Verification:');
  console.log('  JWTs that verify against live JWKS: ' + verifyOk + ' / ' + signed);
  console.log('  JWTs that fail verification:        ' + verifyFail + ' / ' + signed);
  if (Object.keys(failureReasons).length) {
    console.log('Failure reasons:');
    Object.entries(failureReasons).forEach(([k, v]) => console.log('  [' + v + '] ' + k));
  }
  console.log('\n=== FINAL POST-FIX SIGNING SUCCESS RATE: ' + ((verifyOk / N) * 100).toFixed(1) + '% (' + verifyOk + '/' + N + ' sessions produced verifiable signed JWTs) ===');
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
