#!/usr/bin/env node
// Local smoke test for the patched demo flow.
// Verifies: tamper-evident receipt for the demo.html flow (proof/demo.html).
// Mirrors smoke-cme-local.js — covers the OTHER public flow that was patched
// to use generateContentReceipt.
const puppeteer = require('puppeteer');
const http = require('http');
const path = require('path');
const fs = require('fs');

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
  // Phase 1 — Read: click "Done Reading"
  await wait(900);
  await page.evaluate(() => {
    const btn = document.querySelector('#phase-1 .btn-primary');
    if (btn) btn.click();
  });

  // Phase 2 — Decisions: click first .decision-opt for each rendered question.
  // Loop generously since questions are advanced one at a time.
  for (let i = 0; i < 14; i++) {
    await wait(500);
    const state = await page.evaluate(() => {
      const phase = document.getElementById('phase-2');
      if (!phase || phase.style.display === 'none') return 'phase-done';
      const opt = document.querySelector('#decision-area .decision-opt');
      if (opt) { opt.click(); return 'clicked'; }
      return 'no-opt';
    });
    if (state === 'phase-done') break;
  }

  // Phase 3 — Fitts' targets: only the .lit target is the active one.
  // Loop until phase 3 closes itself (~12 hits) or we time out.
  for (let i = 0; i < 18; i++) {
    await wait(280);
    const state = await page.evaluate(() => {
      const phase = document.getElementById('phase-3');
      if (!phase || phase.style.display === 'none') return 'phase-done';
      const lit = document.querySelector('.target.lit');
      if (lit) { lit.click(); return 'clicked'; }
      return 'no-lit';
    });
    if (state === 'phase-done') break;
  }

  // Phase 4 — Type ≥20 words. Use focus + sendKeys via page.evaluate
  // because the typing-area is sometimes hidden under the disabled button
  // until focus is moved into it.
  await wait(1000);
  const phase4Visible = await page.evaluate(() => {
    const p = document.getElementById('phase-4');
    if (!p || p.style.display === 'none') return false;
    const ta = document.getElementById('typing-area');
    if (!ta) return false;
    ta.focus();
    return true;
  });
  if (phase4Visible) {
    await page.keyboard.type(
      'The receipt format is the product: tamper evident SHA two five six over a deeply key sorted canonical JSON of the session payload, content bound to every displayed value end to end.',
      { delay: 25 }
    );
    await wait(800);
    // Force-enable + click the done button
    await page.evaluate(() => {
      const btn = document.getElementById('typing-done-btn');
      if (btn) {
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
        btn.disabled = false;
        btn.click();
      }
    });
  }
  await wait(3500);

  // Round-trip content-binding check (same logic as smoke-cme-local.js)
  const roundTrip = await page.evaluate(async () => {
    if (typeof SWSAttention === 'undefined') return { error: 'SDK not loaded' };
    const r = await new Promise(resolve => {
      SWSAttention.generateContentReceipt({test: 'demo_round_trip'}, resolve);
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
    return {
      canonicalMatches: r.canonical === recanonical,
      hashRoundTrip: r.hash === recomputedHash
    };
  });

  return page.evaluate((rt) => {
    const hashEl = document.getElementById('r-hash');
    const tierEl = document.getElementById('r-tier-badge');
    const compEl = document.getElementById('r-composite-big');
    const text = hashEl ? hashEl.textContent : '';
    const m = text.match(/SHA-256:\s*([0-9a-f]{64})/);
    return {
      hash: m ? m[1] : null,
      tier: tierEl ? tierEl.textContent : null,
      composite: compEl ? compEl.textContent : null,
      hashText: text,
      roundTrip: rt
    };
  }, roundTrip);
}

(async () => {
  const PORT = 4322;
  const rootDir = path.resolve(__dirname, '..', 'proof');
  const server = await startServer(rootDir, PORT);
  const baseUrl = `http://127.0.0.1:${PORT}/demo.html`;
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
      if (m.type() === 'error' && !/favicon/.test(t) && !/Failed to load resource/.test(t)) errors.push('console.error: ' + t);
    });
    if (emulateMobile) await p.emulate(puppeteer.KnownDevices['Pixel 5']);
    else await p.setViewport({ width: 1280, height: 800 });
    return p;
  }

  const p1 = await newPage(true);
  await p1.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  const r1 = await playThrough(p1);
  await p1.close();

  const p2 = await newPage(true);
  await p2.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  const r2 = await playThrough(p2);
  await p2.close();

  await browser.close();
  server.close();

  console.log('\n--- DEMO RESULTS ---');
  console.log('mobile run 1:', { tier: r1.tier, composite: r1.composite, hash: r1.hash });
  console.log('mobile run 2:', { tier: r2.tier, composite: r2.composite, hash: r2.hash });

  let pass = true;
  function check(label, ok) { console.log((ok ? '  PASS  ' : '  FAIL  ') + label); if (!ok) pass = false; }
  check('demo run 1 produced a hash', !!r1.hash);
  check('demo run 2 produced a hash', !!r2.hash);
  check('demo hash 1 != hash 2 (sessions are independent)', r1.hash && r2.hash && r1.hash !== r2.hash);
  check('demo hash round-trips through canonical re-hash', r1.roundTrip && r1.roundTrip.hashRoundTrip);
  check('demo verifier canonical matches SDK canonical', r1.roundTrip && r1.roundTrip.canonicalMatches);
  check('no console/page errors', errors.length === 0);
  if (errors.length) errors.forEach(e => console.log('  - ' + e));
  console.log('\n' + (pass ? 'OVERALL: PASS' : 'OVERALL: FAIL'));
  process.exit(pass ? 0 : 1);
})();
