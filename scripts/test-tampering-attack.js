#!/usr/bin/env node
// Track C1: Tampering attack — proves the content-bound receipt's central
// security property: any modification to a displayed value invalidates the
// hash, regardless of how clever the modification is.
//
// Method: run a real CME session, capture the legitimate {payload, canonical, hash}.
// Then run 100 random tampering operations on copies of the payload — change a
// signal, flip a verdict, increase the composite, replace words_typed, etc.
// For each tampered payload, recompute SHA-256 over its canonical and verify
// the hash MISMATCHES the original.
//
// Pass criterion: 100% rejection. A single false-positive (tamper that didn't
// change the hash) is a security flaw — the canonical-JSON algorithm has a bug.

const puppeteer = require('puppeteer');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const wait = ms => new Promise(r => setTimeout(r, ms));

function startServer(rootDir, port) {
  const mime = {
    '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg'
  };
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let urlPath = req.url.split('?')[0];
      if (urlPath === '/') urlPath = '/index.html';
      const filePath = path.join(rootDir, urlPath);
      if (!filePath.startsWith(rootDir)) { res.writeHead(403); res.end(); return; }
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('not found'); return; }
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(port, () => resolve(server));
  });
}

// Mirror SDK's _canonicalJSON exactly
function canonicalJSON(obj) {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj === 'number') return Number.isFinite(obj) ? String(obj) : 'null';
  if (typeof obj === 'boolean') return obj ? 'true' : 'false';
  if (typeof obj === 'string') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalJSON).join(',') + ']';
  if (typeof obj === 'object') {
    const keys = Object.keys(obj).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalJSON(obj[k])).join(',') + '}';
  }
  return 'null';
}

function sha256Hex(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

// Generate a random tamper operation against a receipt payload
function generateTamper(payload, rng) {
  const ops = [
    // Composite-tier tampers — most-likely real attacker target
    () => { const p = clone(payload); p.extras.composite_cme = 0.9; return ['boost composite_cme to 0.9', p]; },
    () => { const p = clone(payload); p.extras.composite_cme = (p.extras.composite_cme || 0) + 0.001; return ['composite_cme +0.001', p]; },
    () => { const p = clone(payload); p.extras.verdict = 'pass'; return ['flip verdict to pass', p]; },
    () => { const p = clone(payload); p.signals.composite = 1.0; return ['signals.composite = 1.0', p]; },
    () => { const p = clone(payload); p.quality_tier = 'deep_focus'; return ['quality_tier → deep_focus', p]; },
    // Signal tampers
    () => { const p = clone(payload); p.signals.timing = 0.99; return ['signals.timing = 0.99', p]; },
    () => { const p = clone(payload); p.signals.fitts = 0.99; return ['signals.fitts = 0.99', p]; },
    () => { const p = clone(payload); p.signals.touch = 0.99; return ['signals.touch = 0.99', p]; },
    () => { const p = clone(payload); p.signals.readingSpeed = 0.99; return ['signals.readingSpeed = 0.99', p]; },
    () => { const p = clone(payload); p.signals.crossCorrelation = 0.99; return ['signals.crossCorrelation = 0.99', p]; },
    // Metadata tampers
    () => { const p = clone(payload); p.session_id = 'cme_attacker_session'; return ['rewrite session_id', p]; },
    () => { const p = clone(payload); p.duration_ms = (p.duration_ms || 0) + 60000; return ['add 60s to duration', p]; },
    () => { const p = clone(payload); p.extras.words_typed = 100; return ['fake 100 words_typed', p]; },
    () => { const p = clone(payload); p.protocol = 'SWS-AP-v3-fake'; return ['change protocol', p]; },
    () => { const p = clone(payload); p.entity = 'Attacker LLC'; return ['change entity', p]; },
    // Subtle tampers (single bit, single char)
    () => { const p = clone(payload); const orig = p.signals.timing; p.signals.timing = orig + 0.0001; return ['timing +0.0001', p]; },
    () => { const p = clone(payload); p.session_id = p.session_id + ' '; return ['append space to session_id', p]; },
    () => { const p = clone(payload); p.signals.activeSignals = (p.signals.activeSignals || 0) + 1; return ['activeSignals +1', p]; },
    // Whole-block tampers
    () => { const p = clone(payload); p.extras = {}; return ['empty extras', p]; },
    () => { const p = clone(payload); p.signals = {}; return ['empty signals', p]; },
    // Adding fields
    () => { const p = clone(payload); p.extras.fake_certification = true; return ['inject fake_certification', p]; },
    () => { const p = clone(payload); p.signals.fake_signal = 0.99; return ['inject fake_signal', p]; },
    // Removing fields
    () => { const p = clone(payload); delete p.signals.timing; return ['delete signals.timing', p]; },
    () => { const p = clone(payload); delete p.nonce; return ['delete nonce', p]; },
    // Reordering attempts (canonical-JSON should defeat these — this is the "did our deep-sort actually work" test)
    () => {
      const p = clone(payload);
      // Manually replace the signals object with one that has different key insertion order
      const reordered = {};
      const keys = Object.keys(p.signals).reverse();
      for (const k of keys) reordered[k] = p.signals[k];
      p.signals = reordered;
      return ['reorder signals keys (reverse) — must NOT change hash', p];
    },
    () => {
      const p = clone(payload);
      const reordered = {};
      const keys = Object.keys(p).sort().reverse();
      for (const k of keys) reordered[k] = p[k];
      return ['reorder top-level keys (reverse) — must NOT change hash', reordered];
    },
  ];
  const op = ops[Math.floor(rng() * ops.length)];
  return op();
}

function clone(o) { return JSON.parse(JSON.stringify(o)); }

// Seeded RNG so test is reproducible
function mulberry32(seed) {
  let a = seed;
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

async function captureLegitimateReceipt(page) {
  // Generate a receipt via the SDK with realistic extras
  return page.evaluate(async () => {
    return await new Promise(resolve => {
      SWSAttention.generateContentReceipt({
        source: 'tampering_test',
        composite_cme: 0.71,
        verdict: 'pass',
        words_typed: 25,
        device_type: 'desktop'
      }, resolve);
    });
  });
}

(async () => {
  const PORT = 4000;
  // Server already up from earlier
  const baseUrl = `http://127.0.0.1:${PORT}/cme-demo.html`;
  console.log('Tampering attack vs', baseUrl);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1500);

  const receipt = await captureLegitimateReceipt(page);
  console.log('\nLegitimate receipt captured:');
  console.log('  hash:      ' + receipt.hash);
  console.log('  canonical: ' + receipt.canonical.length + ' bytes');
  console.log('  payload keys:', Object.keys(receipt.payload).sort().join(', '));

  // Verify the legitimate canonical re-hashes correctly (sanity check)
  const recomputed = sha256Hex(canonicalJSON(receipt.payload));
  if (recomputed !== receipt.hash) {
    console.error('\n✗ FATAL: legitimate canonical does not re-hash to the claimed hash.');
    console.error('  Claimed:    ' + receipt.hash);
    console.error('  Recomputed: ' + recomputed);
    console.error('  This is a canonicalization bug — fix before continuing.');
    await browser.close();
    process.exit(2);
  }
  console.log('\n✓ Sanity check: legitimate canonical re-hashes to the claimed hash.');

  // Run 100 tamper variations
  const N = 100;
  const rng = mulberry32(42);
  let tampered_detected = 0;
  let tampered_missed = 0;
  const misses = [];
  const reorderResults = [];

  console.log('\nRunning ' + N + ' tamper variations...\n');
  let attempts = 0;
  const maxAttempts = N * 4;
  let i = 0;
  while (i < N && attempts < maxAttempts) {
    attempts++;
    const [label, tamperedPayload] = generateTamper(receipt.payload, rng);
    const tamperedCanonical = canonicalJSON(tamperedPayload);
    const isReorderTest = label.includes('reorder');

    // Skip no-op tampers (operation didn't actually change the canonical form).
    // These are test artifacts — e.g., "flip verdict to pass" when verdict is
    // already pass — not security failures.
    if (!isReorderTest && tamperedCanonical === receipt.canonical) {
      continue; // try a different tamper
    }
    i++;

    const tamperedHash = sha256Hex(tamperedCanonical);

    if (isReorderTest) {
      // Reorder tests EXPECT the hash to match (canonical-JSON should normalize)
      const same = tamperedHash === receipt.hash;
      reorderResults.push({ label, same });
      console.log((same ? '  ✓' : '  ✗') + ' ' + label + ' — hash ' + (same ? 'PRESERVED (correct)' : 'CHANGED (canonical bug)'));
      if (!same) tampered_missed++;  // Reorder changing hash = canonical bug
      else tampered_detected++;      // Reorder preserving hash = correct
    } else {
      // Real tamper: hash MUST differ
      if (tamperedHash !== receipt.hash) {
        tampered_detected++;
      } else {
        tampered_missed++;
        misses.push({ label, tamperedHash });
        console.log('  ✗ MISS: ' + label + ' produced same hash');
      }
    }
  }

  console.log('\n━━━ TAMPERING ATTACK RESULTS ━━━');
  console.log('  Total tampers attempted:  ' + N);
  console.log('  Detected (hash differed): ' + tampered_detected);
  console.log('  Missed:                   ' + tampered_missed);
  console.log('  Detection rate:           ' + (100 * tampered_detected / N).toFixed(1) + '%');

  console.log('\n━━━ KEY-ORDER NORMALIZATION ━━━');
  reorderResults.forEach(r => console.log('  ' + (r.same ? '✓' : '✗') + ' ' + r.label));

  if (misses.length === 0 && reorderResults.every(r => r.same)) {
    console.log('\n✓ PASS — content-binding holds against all 100 tamper variations + key-reorder tests.');
  } else {
    console.log('\n✗ FAIL — found ' + misses.length + ' undetected tampers and ' + reorderResults.filter(r => !r.same).length + ' canonical bugs.');
    misses.forEach(m => console.log('  - ' + m.label));
  }

  await browser.close();
  process.exit(tampered_missed === 0 && reorderResults.every(r => r.same) ? 0 : 1);
})();
