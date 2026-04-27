#!/usr/bin/env node
// Full-flow regression test for cme-demo.html's narrative panel.
// Walks the CME demo end-to-end under three variants (paste, human, bot)
// and asserts the rendered verdict pill + narrative title + narrative body
// match what the system should say for each variant.
//
// This is the test that would have caught the original bug — the explanation
// panel said "Why this score reflects biologically human attention" regardless
// of whether the verdict was PASS, MARGINAL, or FAIL. Now: PASS branch keeps
// that copy; MARGINAL/FAIL branches name triggered gates explicitly.
//
// Usage:
//   node scripts/test-cme-flow-narrative.js                    # default: paste
//   node scripts/test-cme-flow-narrative.js --variant=human
//   node scripts/test-cme-flow-narrative.js --variant=bot
//   node scripts/test-cme-flow-narrative.js --variant=all      # all three sequentially
//
// Exits 0 on pass, 1 on any failure.

const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Mirror the SDK's _canonicalJSON exactly. Identical to verify.html's
// implementation and scripts/test-tampering-attack.js — divergence here
// would silently break re-verification, so this is a verbatim copy.
function canonicalJSON(obj) {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj === 'number') return Number.isFinite(obj) ? String(obj) : 'null';
  if (typeof obj === 'boolean') return obj ? 'true' : 'false';
  if (typeof obj === 'string') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalJSON).join(',') + ']';
  if (typeof obj === 'object') {
    const keys = Object.keys(obj).sort();
    return '{' + keys.map(function(k) { return JSON.stringify(k) + ':' + canonicalJSON(obj[k]); }).join(',') + '}';
  }
  return 'null';
}
function sha256Hex(s) { return crypto.createHash('sha256').update(s, 'utf8').digest('hex'); }

// Industry-standard latency budget — submit-click to receipt-rendered
// (the user-perceived "did my click do anything" interval). Empirical
// baseline 2026-04-27: 100-290 ms across paste/human/bot variants on
// the local server. 2000 ms catches a 7-10x regression with comfortable
// headroom for slower CI runners. Tighten if the baseline drops.
const LATENCY_BUDGET_MS = 2000;

const argVariant = (process.argv.find(function(a) { return a.indexOf('--variant=') === 0; }) || '').split('=')[1];
const VARIANT = argVariant || 'paste';
const PROOF_DIR = path.join(__dirname, '..', 'proof');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PORT = 4567;
const BASE_URL = 'http://localhost:' + PORT;

const sleep = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };

// ---------- minimal static server ----------
// Path-traversal hardened: every resolved file path must lie inside one of the
// two allowed roots. Without this guard a request like GET /../../etc/passwd
// would resolve outside the proof tree. Even in a test-only context this
// matters because (a) tests run on shared CI runners and (b) the snippet is
// the kind of thing that gets copy-pasted into a quick demo server later.
function startStatic() {
  const types = {
    '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png'
  };
  const PROOF_ROOT = path.resolve(PROOF_DIR);
  const PUBLIC_ROOT = path.resolve(PUBLIC_DIR);
  return new Promise(function(resolve) {
    const server = http.createServer(function(req, res) {
      var url = req.url.split('?')[0];
      if (url === '/' || url === '') url = '/index.html';
      var unsafeFilePath;
      var allowedRoot;
      if (url.indexOf('/.well-known/') === 0) {
        unsafeFilePath = path.join(PUBLIC_DIR, url);
        allowedRoot = PUBLIC_ROOT;
      } else {
        unsafeFilePath = path.join(PROOF_DIR, url);
        allowedRoot = PROOF_ROOT;
      }
      // Resolve symlinks + ".." segments + redundant separators, then verify
      // the result is contained by the allowed root. Reject everything else.
      const resolved = path.resolve(unsafeFilePath);
      if (resolved !== allowedRoot && !resolved.startsWith(allowedRoot + path.sep)) {
        res.writeHead(403); res.end('403 forbidden'); return;
      }
      fs.readFile(resolved, function(err, data) {
        if (err) { res.writeHead(404); res.end('404 ' + url); return; }
        const ext = path.extname(resolved).toLowerCase();
        res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
        res.end(data);
      });
    });
    server.listen(PORT, function() { resolve(server); });
  });
}

// ---------- variant content ----------
const PASTE_TEXT = 'Hypertension management requires individualized treatment plans considering patient-specific factors such as age, comorbidities, and medication tolerance. Recent guidelines emphasize lifestyle modifications including dietary changes, physical activity, and stress management as cornerstone interventions. Pharmacotherapy decisions should be guided by blood pressure stage, compelling indications, and risk of adverse drug reactions to achieve target blood pressure goals while minimizing side effects.';
const HUMAN_TEXT = 'Hypertension treatment must be tailored to the individual patient given the wide range of comorbidities and side effect profiles encountered in primary care every single day across many older adult populations.';
const BOT_TEXT = 'hypertension treatment must be tailored to the individual patient considering comorbidities and side effects in clinical practice for older adults.';

// ---------- flow walker ----------
async function walkFlow(page, variant) {
  // Click through 4 reading sections by calling the page's nextSection() directly
  // — this avoids needing to scroll to find the button on smaller viewports
  // and exercises the same code path the user click triggers.
  for (var i = 1; i <= 4; i++) {
    if (variant === 'human') {
      // Realistic reading time + scroll activity to feed scroll-saccade signal
      await sleep(2200 + Math.random() * 800);
      await page.evaluate(function() {
        window.scrollBy({ top: 200 + Math.random() * 100, behavior: 'smooth' });
      });
      await sleep(500);
      await page.evaluate(function() {
        window.scrollBy({ top: 150, behavior: 'smooth' });
      });
      await sleep(400);
    } else {
      await sleep(150);
    }
    await page.evaluate(function(sec) { window.nextSection(sec); }, i);
  }

  await page.waitForSelector('#assessment', { visible: true, timeout: 5000 });

  // Click the correct answers (this is the key answers from the page itself)
  const correct = ['thiazide', 'acei', '50', 'true', 'lifestyle'];
  for (var q = 0; q < correct.length; q++) {
    if (variant === 'human') await sleep(1400 + Math.random() * 1000);
    else await sleep(80);
    await page.evaluate(function(payload) {
      var sel = '.opt[data-q="' + payload.q + '"][data-ans="' + payload.ans + '"]';
      var el = document.querySelector(sel);
      if (el) el.click();
    }, { q: q, ans: correct[q] });
  }

  // Reflection input — variant-specific
  if (variant === 'paste') {
    // Synthesize a paste event the way the SDK distinguishes it from typing:
    // single inputType=insertFromPaste with the full text, no per-key events.
    await page.evaluate(function(text) {
      var ta = document.getElementById('reflection');
      ta.focus();
      ta.value = text;
      ta.dispatchEvent(new InputEvent('input', {
        bubbles: true, inputType: 'insertFromPaste', data: text
      }));
      try {
        var dt = new DataTransfer();
        dt.setData('text/plain', text);
        ta.dispatchEvent(new ClipboardEvent('paste', {
          bubbles: true, cancelable: true, clipboardData: dt
        }));
      } catch (e) { /* DataTransfer may not construct in headless */ }
    }, PASTE_TEXT);
  } else if (variant === 'human') {
    // Type char-by-char with realistic inter-key timing (60-180ms range)
    await page.focus('#reflection');
    for (var ci = 0; ci < HUMAN_TEXT.length; ci++) {
      await page.keyboard.type(HUMAN_TEXT[ci]);
      await sleep(60 + Math.random() * 120);
    }
  } else {
    // Bot: type with constant-velocity timing (zero CV) — what mechanical
    // typing detection should catch. Plus a single-burst approach.
    await page.focus('#reflection');
    for (var bi = 0; bi < BOT_TEXT.length; bi++) {
      await page.keyboard.type(BOT_TEXT[bi]);
      await sleep(35); // constant interval — zero CV
    }
  }

  // Wait for submit button to enable
  await page.waitForFunction(
    function() { return !document.getElementById('submit-btn').disabled; },
    { timeout: 8000 }
  );

  // Performance budget measures user-perceived latency: from when the user
  // commits (clicks Submit) to when the verifiable receipt is on screen.
  // The reading/typing time before Submit is the user's choice and not the
  // system's responsibility, so it doesn't count against the budget.
  var submitStart = Date.now();
  await page.click('#submit-btn');

  // Wait for results panel
  await page.waitForSelector('#results', { visible: true, timeout: 8000 });

  // Wait until the receipt hash is actually computed and stamped (the
  // hash-box starts as a placeholder, then async resolves to the real hash).
  // This is the right "render is done" boundary for a latency budget.
  await page.waitForFunction(function() {
    var hb = document.getElementById('hash-box');
    return hb && /Receipt:\s*[0-9a-f]{64}/.test(hb.textContent || '');
  }, { timeout: 8000 });
  var submitToReceiptMs = Date.now() - submitStart;
  // Stash on the page so the capture phase can read it back to the runner
  await page.evaluate(function(ms) { window.__swsSubmitToReceiptMs = ms; }, submitToReceiptMs);

  // Capture rendered values + the receipt hash + the canonical. The verify
  // link now stores the canonical in sessionStorage when it exceeds the
  // fragment budget (T2-6, 2026-04-27), so we read sessionStorage first and
  // only fall back to fragment-decode if needed.
  return await page.evaluate(function() {
    function txt(id) {
      var el = document.getElementById(id);
      return el ? (el.textContent || '').trim() : '';
    }
    var hashBox = txt('hash-box');
    var hashMatch = hashBox.match(/Receipt:\s*([0-9a-f]{64})/);
    var verifyHref = (function() {
      var a = document.getElementById('verify-link');
      return a ? a.getAttribute('href') : '';
    })();
    var hashFragMatch = verifyHref.match(/[#&]hash=([0-9a-f]{64})/);
    var canonical = '';
    var receiptHash = hashMatch ? hashMatch[1] : '';
    // sessionStorage is the new primary path
    if (receiptHash) {
      try { canonical = sessionStorage.getItem('sws_receipt_' + receiptHash) || ''; } catch (e) {}
    }
    // Legacy fragment fallback (still supported for old verify-links)
    if (!canonical) {
      var canonicalMatch = verifyHref.match(/canonical=([^&]+)/);
      if (canonicalMatch) {
        try { canonical = decodeURIComponent(escape(atob(canonicalMatch[1]))); } catch (e) {}
      }
    }
    return {
      verdictPill: txt('tier-pill'),
      narrTitle: txt('narr-title'),
      narrBody: txt('narr-content'),
      composite: txt('composite-big'),
      pHuman: txt('conformal-phuman'),
      hashBox: hashBox,
      receiptHash: receiptHash,
      verifyLinkHash: hashFragMatch ? hashFragMatch[1] : '',
      canonical: canonical,
      verifyHrefLength: verifyHref.length,
      submitToReceiptMs: window.__swsSubmitToReceiptMs || 0
    };
  });
}

// ---------- per-variant expectations ----------
const EXPECTATIONS = {
  paste: {
    desc: 'paste from ChatGPT-style text into reflection',
    verdictRegex: /MARGINAL|NOT COMPLETED/i,
    titleRegex: /flagged for additional review|did not meet/i,
    bodyRegex: /paste|clipboard|capped/i,
    bodyMustNotMatch: /Three signals in your session match peer-reviewed biological signatures/i,
    titleMustNotMatch: /reflects biologically human attention/i
  },
  human: {
    desc: 'realistic reading + thoughtful answers + typed reflection',
    // In headless Chrome, BotD will (correctly) detect automation regardless of
    // realistic timing — so we can't reliably reach a PASS verdict here, and we
    // shouldn't try to "evade our own defense" inside our own regression test.
    // The contract this assertion guards is: whatever verdict the system gives,
    // the narrative title must match it. That's the bug we just fixed; that's
    // what the test must defend. Run with HEADED=1 (a real Chromium) if you
    // want to test the PASS branch end-to-end as an actual human.
    coherenceCheck: true
  },
  bot: {
    desc: 'constant-velocity typing + minimal interaction',
    verdictRegex: /MARGINAL|NOT COMPLETED/i,
    titleRegex: /flagged|did not meet/i,
    titleMustNotMatch: /reflects biologically human attention/i
  }
};

// ---------- single-variant runner ----------
async function runVariant(variant) {
  const exp = EXPECTATIONS[variant];
  if (!exp) {
    console.log('[error] unknown variant: ' + variant);
    return false;
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Variant: ' + variant + ' — ' + exp.desc);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const browser = await puppeteer.launch({
    headless: process.env.HEADED === '1' ? false : 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // Surface page errors
  page.on('pageerror', function(err) { console.log('[page error]', err.message); });

  var captured;
  try {
    await page.goto(BASE_URL + '/cme-demo.html', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(800);
    captured = await walkFlow(page, variant);
  } catch (e) {
    console.log('[walk error]', e.message);
    await browser.close();
    return false;
  }
  await browser.close();

  var latencyMs = captured.submitToReceiptMs || 0;

  console.log('[capture]');
  console.log('  verdict pill : ' + JSON.stringify(captured.verdictPill));
  console.log('  narr title   : ' + JSON.stringify(captured.narrTitle));
  console.log('  composite    : ' + captured.composite);
  console.log('  P(human)     : ' + captured.pHuman);
  console.log('  body (first 200): ' + JSON.stringify(captured.narrBody.slice(0, 200)));
  console.log('  receipt hash : ' + (captured.receiptHash || '(not rendered)'));
  console.log('  canonical    : ' + (captured.canonical ? captured.canonical.length + ' bytes' : '(not extracted)'));
  console.log('  submit→receipt latency: ' + latencyMs + ' ms (budget ' + LATENCY_BUDGET_MS + ' ms)');

  const checks = [];
  if (exp.verdictRegex) checks.push({ name: 'verdict pill matches ' + exp.verdictRegex, ok: exp.verdictRegex.test(captured.verdictPill) });
  if (exp.titleRegex) checks.push({ name: 'narrative title matches ' + exp.titleRegex, ok: exp.titleRegex.test(captured.narrTitle) });
  if (exp.bodyRegex) checks.push({ name: 'narrative body matches ' + exp.bodyRegex, ok: exp.bodyRegex.test(captured.narrBody) });
  if (exp.bodyMustNotMatch) checks.push({ name: 'narrative body must NOT contain old "biological signatures" copy', ok: !exp.bodyMustNotMatch.test(captured.narrBody) });
  if (exp.titleMustNotMatch) checks.push({ name: 'narrative title must NOT be the PASS-only copy', ok: !exp.titleMustNotMatch.test(captured.narrTitle) });
  if (exp.coherenceCheck) {
    // Title must match verdict semantically
    var v = captured.verdictPill;
    var t = captured.narrTitle;
    var coherent = false;
    if (/CREDIT AWARDED/i.test(v)) coherent = /biologically human/i.test(t);
    else if (/MARGINAL/i.test(v)) coherent = /flagged for additional review/i.test(t);
    else if (/NOT COMPLETED/i.test(v)) coherent = /did not meet/i.test(t);
    checks.push({ name: 'verdict ↔ narrative title coherence', ok: coherent });
  }

  // Industry-standard receipt-integrity check: the rendered hash must match a
  // node-side recomputation of SHA-256 over the canonical we extracted from
  // the verify-link fragment. This is the same check verify.html performs
  // when a customer clicks "Verify This Receipt" — we assert it succeeds
  // here so the visible flow can never silently produce an unverifiable
  // receipt. Catches: a future change that breaks _canonicalJSON, a build
  // that drops fields, or a hash-render race condition.
  if (captured.receiptHash && captured.canonical) {
    var rehash = sha256Hex(captured.canonical);
    checks.push({
      name: 'receipt hash re-derives from canonical (content-binding holds)',
      ok: rehash === captured.receiptHash
    });
    if (rehash !== captured.receiptHash) {
      console.log('  rehash mismatch: claimed=' + captured.receiptHash + ' rehashed=' + rehash);
    }
  } else {
    checks.push({
      name: 'receipt hash + canonical successfully extracted',
      ok: false
    });
  }
  if (captured.verifyLinkHash) {
    checks.push({
      name: 'verify-link hash matches displayed hash',
      ok: captured.verifyLinkHash === captured.receiptHash
    });
  }
  checks.push({
    name: 'submit→receipt latency under ' + LATENCY_BUDGET_MS + ' ms (was ' + latencyMs + ' ms)',
    ok: latencyMs > 0 && latencyMs <= LATENCY_BUDGET_MS
  });

  console.log('[asserts]');
  var allPass = true;
  for (var i = 0; i < checks.length; i++) {
    console.log('  ' + (checks[i].ok ? '✓' : '✗') + ' ' + checks[i].name);
    if (!checks[i].ok) allPass = false;
  }
  console.log(allPass ? '  → variant ' + variant + ' PASS' : '  → variant ' + variant + ' FAIL');
  return allPass;
}

// ---------- main ----------
(async function() {
  const server = await startStatic();
  console.log('[setup] static server on :' + PORT);
  console.log('[setup] serving from: ' + PROOF_DIR);
  console.log('');

  var variants;
  if (VARIANT === 'all') variants = ['paste', 'human', 'bot'];
  else variants = [VARIANT];

  var allPassed = true;
  for (var i = 0; i < variants.length; i++) {
    var ok = await runVariant(variants[i]);
    if (!ok) allPassed = false;
    console.log('');
  }

  server.close();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(allPassed ? '✓ ALL VARIANTS PASSED' : '✗ SOME VARIANTS FAILED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(allPassed ? 0 : 1);
})().catch(function(e) {
  console.error('[fatal]', e);
  process.exit(1);
});
