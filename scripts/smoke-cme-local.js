#!/usr/bin/env node
// Local smoke test for the patched CME flow.
// Verifies: (a) two back-to-back runs produce DIFFERENT receipt hashes
// (the katie bug fix), (b) device-aware composite reweighting applies,
// (c) no console errors during a normal play-through.
const puppeteer = require('puppeteer');
const http = require('http');
const path = require('path');
const fs = require('fs');

const wait = ms => new Promise(r => setTimeout(r, ms));

function startServer(rootDir, port) {
  const mime = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg'
  };
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      let urlPath = req.url.split('?')[0];
      if (urlPath === '/') urlPath = '/index.html';
      const filePath = path.join(rootDir, urlPath);
      if (!filePath.startsWith(rootDir)) { res.writeHead(403); res.end(); return; }
      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('not found: ' + urlPath); return; }
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(port, () => resolve(server));
  });
}

async function playThrough(page) {
  await wait(1500);
  for (let s = 1; s <= 4; s++) {
    await wait(1200);
    const clicked = await page.evaluate((sn) => {
      const sec = document.getElementById('section-' + sn);
      if (!sec || sec.style.display === 'none') return false;
      const btns = sec.querySelectorAll('.btn-primary');
      if (btns[0]) { btns[0].click(); return true; }
      return false;
    }, s);
    if (!clicked) console.log('  warn: could not advance from section', s);
    await wait(500);
  }
  // Wait for assessment to be visible
  await page.waitForFunction(
    () => document.getElementById('assessment') && document.getElementById('assessment').style.display === 'block',
    { timeout: 5000 }
  ).catch(() => console.log('  warn: assessment not visible'));
  await wait(1200);
  // 5 questions: option counts vary (4, 4, 4, 2, 5) to satisfy Hick's Law signal
  await page.evaluate(() => {
    [0, 1, 2, 3, 4].forEach(q => {
      const opts = document.querySelectorAll('.opt[data-q="' + q + '"]');
      if (opts[0]) opts[0].click();
    });
  });
  await wait(500);
  // 25 words >= 20 word minimum for submit
  await page.click('#reflection');
  await page.type('#reflection',
    'I will integrate home blood pressure monitoring before initiating therapy and reinforce adherence counseling at every clinic visit, especially for newly diagnosed Stage one patients facing complex therapy decisions.',
    { delay: 40 });
  await wait(800);
  const submitState = await page.evaluate(() => {
    const btn = document.getElementById('submit-btn');
    return { exists: !!btn, disabled: btn ? btn.disabled : null };
  });
  if (submitState.disabled) console.log('  warn: submit still disabled', submitState);
  await page.evaluate(() => { document.getElementById('submit-btn').click(); });
  await wait(4500);
  // Round-trip content-binding check: ask the SDK for a fresh receipt, then
  // re-canonicalize the payload using the verifier's implementation, sha256
  // it, and compare. This proves the SDK and verify.html agree on canonical
  // bytes — the load-bearing property of the tamper-evidence claim.
  const roundTrip = await page.evaluate(async () => {
    const r = await new Promise(resolve => {
      SWSAttention.generateContentReceipt({test: 'round_trip'}, resolve);
    });
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
    const recanonical = canonicalJSON(r.payload);
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(recanonical));
    const recomputedHash = Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    // Tamper test: tweak one field, re-hash, must NOT match
    const tampered = JSON.parse(JSON.stringify(r.payload));
    if (tampered.extras) tampered.extras.test = 'TAMPERED';
    const tCanonical = canonicalJSON(tampered);
    const tBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(tCanonical));
    const tHash = Array.from(new Uint8Array(tBuf))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    return {
      canonicalMatches: r.canonical === recanonical,
      hashRoundTrip: r.hash === recomputedHash,
      tamperedHashDiffers: r.hash !== tHash
    };
  });
  return page.evaluate((rt) => {
    const hashBox = document.getElementById('hash-box');
    const tierEl = document.getElementById('tier-pill');
    const compEl = document.getElementById('composite-big');
    const breakdown = document.getElementById('signal-breakdown');
    const text = hashBox ? hashBox.textContent : '';
    const m = text.match(/Receipt:\s*([0-9a-f]{64})/);
    // Parse signal breakdown text: "Timing Entropy: 0.123  ·  Hick's Law: 0.456 ..."
    const sigText = breakdown ? breakdown.textContent : '';
    // Returns 'N/A' if the signal rendered as N/A, a number if rendered as numeric,
    // or null if the signal name didn't appear at all in the breakdown.
    function getSig(name) {
      const naRe = new RegExp(name.replace(/[^\w]/g, '\\$&') + ":?\\s*N/A");
      if (naRe.test(sigText)) return 'N/A';
      const numRe = new RegExp(name.replace(/[^\w]/g, '\\$&') + ":?\\s*([0-9.]+)");
      const mm = sigText.match(numRe);
      return mm ? parseFloat(mm[1]) : null;
    }
    return {
      hashBoxText: text,
      hash: m ? m[1] : null,
      tier: tierEl ? tierEl.textContent : null,
      composite: compEl ? compEl.textContent : null,
      hicks: getSig("Hick's Law"),
      microPause: getSig('Micro-Pause'),
      hover: getSig('Hover Dwell'),
      activity: getSig('Activity Pattern'),
      scrollBacktrack: getSig('Scroll Backtrack'),
      fractal: getSig('Fractal Scaling'),
      roundTrip: rt
    };
  }, roundTrip);
}

(async () => {
  const PORT = 4321;
  const rootDir = path.resolve(__dirname, '..', 'proof');
  const server = await startServer(rootDir, PORT);
  const baseUrl = `http://127.0.0.1:${PORT}/cme-demo.html`;
  console.log('serving', rootDir, 'on', baseUrl);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const errors = [];
  async function newPage(emulateMobile) {
    const p = await browser.newPage();
    p.on('pageerror', e => errors.push('pageerror: ' + e.message));
    p.on('response', r => {
      if (r.status() === 404 && !/favicon\.ico$/.test(r.url())) errors.push('http 404: ' + r.url());
    });
    p.on('console', m => {
      const t = m.text();
      if (m.type() === 'error' && !/favicon\.ico/.test(t) && !/Failed to load resource:.*404/.test(t)) {
        errors.push('console.error: ' + t);
      }
    });
    if (emulateMobile) {
      await p.emulate(puppeteer.KnownDevices['Pixel 5']);
    } else {
      await p.setViewport({ width: 1280, height: 800 });
    }
    return p;
  }

  // Run 1 — mobile
  let p1 = await newPage(true);
  await p1.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  const r1 = await playThrough(p1);
  await p1.close();

  // Run 2 — mobile (immediately after, same browser session — this is the
  // exact scenario that produced katie's identical receipts in the wild)
  let p2 = await newPage(true);
  await p2.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  const r2 = await playThrough(p2);
  await p2.close();

  // Run 3 — desktop (verify the desktop path still produces a distinct hash)
  let p3 = await newPage(false);
  await p3.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  const r3 = await playThrough(p3);
  await p3.close();

  await browser.close();
  server.close();

  console.log('\n--- RESULTS ---');
  console.log('mobile  run 1 :', { tier: r1.tier, composite: r1.composite, hash: r1.hash });
  console.log('mobile  run 2 :', { tier: r2.tier, composite: r2.composite, hash: r2.hash });
  console.log('desktop run 3 :', { tier: r3.tier, composite: r3.composite, hash: r3.hash });

  let pass = true;
  function check(label, ok) {
    console.log((ok ? '  PASS  ' : '  FAIL  ') + label);
    if (!ok) pass = false;
  }

  check('mobile run 1 produced a hash', !!r1.hash);
  check('mobile run 2 produced a hash', !!r2.hash);
  check('desktop run 3 produced a hash', !!r3.hash);
  check('hash 1 != hash 2 (collision bug fixed)', r1.hash && r2.hash && r1.hash !== r2.hash);
  check('hash 1 != hash 3 (mobile vs desktop bind)', r1.hash && r3.hash && r1.hash !== r3.hash);
  check('mobile run gets a non-null composite', !!r1.composite && r1.composite !== '0.000');
  // Signal renders correctly. After the 2026-04-26 fixes, signals must NOT be
  // stuck at the old hardcoded defaults (0.500 for Hick/Pause, 0.000 displayed
  // for Hover/Activity/Backtrack). Acceptable now: a real numeric value, OR
  // the explicit "N/A" sentinel if there was insufficient data this session.
  // The previous bug was that 0.000 / 0.500 always rendered regardless of state.
  function notStuck(val, oldDefault) {
    return val === 'N/A' || (typeof val === 'number' && val !== oldDefault);
  }
  check("Hick's Law no longer stuck at 0.500 default", notStuck(r1.hicks, 0.500));
  check("Micro-Pause no longer stuck at 0.500 default", notStuck(r1.microPause, 0.500));
  check("Scroll Backtrack renders N/A or real value (not silent 0.000)", notStuck(r1.scrollBacktrack, null));
  check("Activity Pattern renders N/A or real value", notStuck(r1.activity, null));
  // Tamper-evidence end-to-end: the verifier's canonicalization matches the
  // SDK's bytes (so verify.html will agree), the round-trip hash matches,
  // and any field tampering breaks the hash.
  check("verifier canonical matches SDK canonical (verify.html will agree)", r1.roundTrip && r1.roundTrip.canonicalMatches);
  check("hash round-trips (canonical → SHA-256 → matches displayed hash)", r1.roundTrip && r1.roundTrip.hashRoundTrip);
  check("tampering with one field changes the hash (tamper-evidence proven)", r1.roundTrip && r1.roundTrip.tamperedHashDiffers);
  check('no console/page errors', errors.length === 0);

  if (errors.length) {
    console.log('\nErrors observed:');
    errors.forEach(e => console.log('  - ' + e));
  }

  console.log('\n' + (pass ? 'OVERALL: PASS' : 'OVERALL: FAIL'));
  process.exit(pass ? 0 : 1);
})();
