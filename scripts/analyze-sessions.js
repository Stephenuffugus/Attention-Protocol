#!/usr/bin/env node
/**
 * Multi-session analysis tool — pulls recent demo sessions from Firestore
 * and produces a distribution summary: per-signal mean/p50/p95, by-device
 * breakdown, and human-vs-bot separation stats.
 *
 * Usage:
 *   node scripts/analyze-sessions.js                       # last 50 sessions
 *   node scripts/analyze-sessions.js 100                   # last 100
 *   node scripts/analyze-sessions.js --since 2026-04-24    # all since date
 *
 * Output is buyer-ready. Numbers are reproducible by re-running.
 */
'use strict';

const { initializeApp } = require('firebase/app');
const { getAuth, signInAnonymously } = require('firebase/auth');
const {
  getFirestore, collection, query, orderBy, limit, getDocs, where
} = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyDbpqisJpnoh2OUYSJIdKIo17SdF0eGPiM',
  authDomain: 'sws-attention-proofs.firebaseapp.com',
  projectId: 'sws-attention-proofs',
  storageBucket: 'sws-attention-proofs.firebasestorage.app',
  messagingSenderId: '420661886092',
  appId: '1:420661886092:web:placeholder'
};

const ALL_SIGNAL_KEYS = [
  'timing', 'hicks', 'fitts', 'scroll', 'microPause', 'touch',
  'keystroke', 'readingSpeed', 'hoverDwell', 'tabVisibility', 'inactivity',
  'rtVariability', 'scrollBacktrack', 'fractalScaling', 'crossCorrelation',
  'curvatureIndex', 'cursorJerk', 'velocityProfile', 'twoThirdsPower', 'deviceMotion'
];

function classifyDevice(session) {
  const ua = (session.user_agent || '').toLowerCase();
  if (ua.indexOf('mobile') > -1 || ua.indexOf('android') > -1 || ua.indexOf('iphone') > -1) return 'mobile';
  return 'desktop';
}

function stats(arr) {
  if (arr.length === 0) return { n: 0, mean: null, p50: null, p95: null, min: null, max: null };
  const sorted = arr.slice().sort((a, b) => a - b);
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  return { n: arr.length, mean, p50, p95, min: sorted[0], max: sorted[sorted.length - 1] };
}

function fmt(n, digits) {
  if (n == null) return '   — ';
  return n.toFixed(digits == null ? 3 : digits).padStart(6);
}

(async () => {
  const args = process.argv.slice(2);
  let n = 50;
  let sinceDate = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--since' && args[i + 1]) {
      sinceDate = new Date(args[i + 1]).getTime();
      i++;
    } else if (/^\d+$/.test(args[i])) {
      n = parseInt(args[i], 10);
    }
  }

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  await signInAnonymously(auth);
  const db = getFirestore(app);

  let q;
  if (sinceDate) {
    q = query(collection(db, 'demos'), where('timestamp', '>=', sinceDate), orderBy('timestamp', 'desc'));
  } else {
    q = query(collection(db, 'demos'), orderBy('timestamp', 'desc'), limit(n));
  }
  const snap = await getDocs(q);
  const sessions = [];
  snap.forEach(d => sessions.push({ id: d.id, ...d.data() }));

  if (sessions.length === 0) {
    console.log('No sessions found.');
    process.exit(0);
  }

  const desktop = sessions.filter(s => classifyDevice(s) === 'desktop');
  const mobile = sessions.filter(s => classifyDevice(s) === 'mobile');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  SWS SESSION ANALYSIS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Total sessions:      ' + sessions.length);
  console.log('  Desktop:             ' + desktop.length);
  console.log('  Mobile:              ' + mobile.length);
  const oldest = new Date(Math.min(...sessions.map(s => s.timestamp || 0)));
  const newest = new Date(Math.max(...sessions.map(s => s.timestamp || 0)));
  console.log('  Time range:          ' + oldest.toISOString().slice(0, 19) + '  →  ' + newest.toISOString().slice(0, 19));
  console.log();

  function summarize(group, label) {
    if (group.length === 0) return;
    console.log('  ' + label + ' (' + group.length + ' sessions)');
    console.log('  ' + '-'.repeat(75));
    const composites = group.map(s => (s.signals && s.signals.composite) || 0);
    const cs = stats(composites);
    console.log('  composite     :   mean=' + fmt(cs.mean) + '  p50=' + fmt(cs.p50) + '  p95=' + fmt(cs.p95) + '  min=' + fmt(cs.min) + '  max=' + fmt(cs.max));
    const durations = group.map(s => s.duration_sec || 0);
    const ds = stats(durations);
    console.log('  duration_sec  :   mean=' + fmt(ds.mean, 0) + '  p50=' + fmt(ds.p50, 0) + '  p95=' + fmt(ds.p95, 0));
    const actives = group.map(s => s.active_signals || 0);
    const as = stats(actives);
    console.log('  active/20     :   mean=' + fmt(as.mean, 1) + '  p50=' + fmt(as.p50, 1));
    const tiers = {};
    group.forEach(s => { tiers[s.quality_tier || '?'] = (tiers[s.quality_tier || '?'] || 0) + 1; });
    console.log('  tier mix      :   ' + Object.entries(tiers).map(([k, v]) => k + '=' + v).join(', '));
    console.log();

    console.log('  per-signal distribution (mean / p50 / p95)');
    console.log('  ' + '-'.repeat(75));
    ALL_SIGNAL_KEYS.forEach(key => {
      const vals = group.map(s => (s.signals && s.signals[key]) || 0);
      const st = stats(vals);
      const label = key.padEnd(20);
      const activeN = vals.filter(v => v > 0).length;
      console.log('  ' + label + ':   mean=' + fmt(st.mean) + '  p50=' + fmt(st.p50) + '  p95=' + fmt(st.p95) +
        '   active=' + String(activeN).padStart(3) + '/' + String(vals.length));
    });
    console.log();
  }

  summarize(desktop, 'DESKTOP');
  summarize(mobile, 'MOBILE');

  // Bot reference (from the bot-harness Puppeteer runs that also write to demos/)
  // Harness runs are tagged source=harness_test; older runs may be in proof_gallery
  // pre-fix and identifiable by HeadlessChrome user_agent.
  const botSessions = sessions.filter(s => {
    const src = s.source_type || '';
    if (src.indexOf('bot') !== -1 || src === 'harness_test') return true;
    if (s.environmental && s.environmental.bot) return true;
    if (s.user_agent && /HeadlessChrome/i.test(s.user_agent)) return true;
    return false;
  });
  if (botSessions.length > 0) {
    const humanSessions = sessions.filter(s => !botSessions.includes(s));
    const botComposites = botSessions.map(s => (s.signals && s.signals.composite) || 0);
    const humanComposites = humanSessions.map(s => (s.signals && s.signals.composite) || 0);
    const bs = stats(botComposites);
    const hs = stats(humanComposites);
    console.log('  HUMAN vs BOT SEPARATION (derived from this dataset)');
    console.log('  ' + '-'.repeat(75));
    console.log('  bot composite    :   n=' + bs.n + '  mean=' + fmt(bs.mean) + '  p95=' + fmt(bs.p95));
    console.log('  human composite  :   n=' + hs.n + '  mean=' + fmt(hs.mean) + '  p50=' + fmt(hs.p50) + '  min=' + fmt(hs.min));
    if (bs.mean != null && hs.mean != null) {
      console.log('  gap (mean)       :   ' + fmt(hs.mean - bs.mean));
      console.log('  gap (min-human vs max-bot):  ' + fmt((hs.min || 0) - (bs.max || 0)));
    }
  }

  console.log();
  console.log('  Session IDs (for spot-checking):');
  sessions.slice(0, 12).forEach(s => {
    const device = classifyDevice(s);
    const comp = (s.signals && s.signals.composite) || 0;
    console.log('    ' + s.id + '   ' + device.padEnd(7) + ' composite=' + comp.toFixed(3));
  });

  process.exit(0);
})().catch(err => { console.error('fatal:', err.message); process.exit(1); });
