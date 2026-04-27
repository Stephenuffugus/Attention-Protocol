#!/usr/bin/env node
// Tests verify.html Section A (paste-canonical mode) on the live site.
//
// Round-trip: generate a content-bound receipt via the live cme-demo,
// then literally paste the canonical + hash into verify.html's Section A
// textareas and click "Verify content binding" — the path an auditor
// without the URL fragment would take.
//
// This complements scripts/test-live-roundtrip.js which exercises
// Section A via URL-fragment auto-prefill.

const puppeteer = require('puppeteer');

const BASE = process.env.BASE_URL || 'https://sws-attention-proofs.web.app';
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log('━━━ Paste-canonical verify.html test (live site) ━━━');
  console.log('   Site:', BASE);
  console.log();

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  console.log('   1. Generating a content-bound receipt via SDK...');
  await page.goto(BASE + '/cme-demo.html', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(2500);

  const receipt = await page.evaluate(() => {
    return new Promise(resolve => {
      // Drive some events so signals have data
      for (let i = 0; i < 60; i++) {
        window.dispatchEvent(new MouseEvent('mousemove', {
          clientX: 100 + i * 5, clientY: 200 + Math.sin(i / 4) * 30, bubbles: true
        }));
      }
      for (let i = 0; i < 20; i++) {
        window.dispatchEvent(new Event('scroll', { bubbles: true }));
      }
      if (!window.SWSAttention || !window.SWSAttention.generateContentReceipt) {
        return resolve({ error: 'SDK missing' });
      }
      window.SWSAttention.generateContentReceipt({ source: 'paste_canonical_test' }, function(r) {
        resolve({ canonical: r.canonical, hash: r.hash });
      });
      setTimeout(() => resolve({ error: 'timeout' }), 8000);
    });
  });

  if (receipt.error) {
    console.log('   ✗', receipt.error);
    await browser.close();
    process.exit(1);
  }
  console.log('     canonical bytes:', receipt.canonical.length);
  console.log('     hash:           ', receipt.hash);
  console.log();

  console.log('   2. Opening verify.html cold (no URL fragment)...');
  const verifyPage = await browser.newPage();
  await verifyPage.goto(BASE + '/verify.html', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(2000);

  console.log('   3. Pasting canonical into Section A textarea...');
  await verifyPage.evaluate((c, h) => {
    const ca = document.getElementById('content-input');
    const ha = document.getElementById('content-hash-input');
    if (!ca || !ha) throw new Error('Section A textareas not found');
    ca.value = c;
    ca.dispatchEvent(new Event('input', { bubbles: true }));
    ha.value = h;
    ha.dispatchEvent(new Event('input', { bubbles: true }));
  }, receipt.canonical, receipt.hash);

  console.log('   4. Clicking "Verify content binding"...');
  await verifyPage.click('#content-verify-btn');
  await wait(1500);

  console.log('   5. Reading the verdict...');
  const verdict = await verifyPage.evaluate(() => {
    const slot = document.getElementById('content-verdict-slot');
    if (!slot) return { found: false };
    const ok = slot.querySelector('.ok, .verify-result.ok');
    const bad = slot.querySelector('.bad, .verify-result.bad');
    return {
      found: true,
      ok: !!ok,
      bad: !!bad,
      successText: ok ? ok.textContent.substring(0, 200) : null,
      failText: bad ? bad.textContent.substring(0, 200) : null,
      raw: slot.textContent.substring(0, 300)
    };
  });

  console.log();
  console.log('━━━ RESULT ━━━');
  if (!verdict.found) {
    console.log('   ✗ Verdict slot not found in DOM');
  } else if (verdict.ok && !verdict.bad) {
    console.log('   ✓ PASS — content-binding verified locally on live verify.html');
    console.log('     Verdict text:', verdict.successText);
  } else if (verdict.bad) {
    console.log('   ✗ FAIL — verdict reports failure');
    console.log('     Failure text:', verdict.failText);
  } else {
    console.log('   ? UNCLEAR — neither ok nor bad result element found');
    console.log('     Raw verdict slot:', verdict.raw);
  }

  // Bonus check: tamper with one byte of the canonical and confirm verify
  // detects it (the same paste-canonical mode should catch the mod)
  console.log();
  console.log('   6. Tamper test — modify one digit of composite, re-verify...');
  const tampered = receipt.canonical.replace(/(0\.[0-9])([0-9])/, (m, p, q) => p + ((parseInt(q) + 1) % 10));
  if (tampered === receipt.canonical) {
    console.log('     (skipped — could not find a mutable digit)');
  } else {
    await verifyPage.evaluate(c => {
      const ca = document.getElementById('content-input');
      ca.value = c;
      ca.dispatchEvent(new Event('input', { bubbles: true }));
    }, tampered);
    await verifyPage.click('#content-verify-btn');
    await wait(1500);
    const tamperVerdict = await verifyPage.evaluate(() => {
      const slot = document.getElementById('content-verdict-slot');
      const ok = slot.querySelector('.ok, .verify-result.ok');
      const bad = slot.querySelector('.bad, .verify-result.bad');
      return { ok: !!ok, bad: !!bad };
    });
    if (tamperVerdict.bad && !tamperVerdict.ok) {
      console.log('     ✓ Tamper correctly detected');
    } else {
      console.log('     ✗ Tamper NOT detected (this would be a bug)');
    }
  }

  await browser.close();
  process.exit(verdict.ok && !verdict.bad ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
