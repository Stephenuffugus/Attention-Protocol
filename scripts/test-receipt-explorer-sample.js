#!/usr/bin/env node
// Validate the receipt-explorer page's "Load sample receipt" button
// renders the updated 23-signal sample correctly on the live site.
//
// Specifically checks:
//   - clicking "Load sample receipt" populates the textarea
//   - clicking "Render & verify" produces a verification result
//   - all 23 signals render in the signal grid (including microsaccades
//     and submovementCount that were missing from the old sample)
//   - the content-binding re-hash matches the embedded SAMPLE_HASH
//     (34c1546a...) — i.e. the new hash was correctly computed

const puppeteer = require('puppeteer');

const BASE = process.env.BASE_URL || 'https://sws-attention-proofs.web.app';
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log('━━━ Receipt-explorer sample-load validation ━━━');
  console.log('   Site:', BASE);
  console.log();

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  await page.goto(BASE + '/receipt-explorer.html', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1500);

  console.log('   1. Clicking "Load sample receipt"...');
  await page.click('#sample-btn');
  await wait(1500);

  console.log('   2. Clicking "Render & verify"...');
  await page.click('#render-btn');
  await wait(2500);

  console.log('   3. Inspecting rendered output...');
  const result = await page.evaluate(() => {
    const out = document.getElementById('output');
    if (!out) return { error: 'output slot missing' };
    const cards = out.querySelectorAll('.card');
    const signals = out.querySelectorAll('.signal-grid .signal');
    const verifyOk = out.querySelector('.verify-result.ok, .ok');
    const verifyBad = out.querySelector('.verify-result.bad, .bad');
    const conformal = out.querySelector('.conformal');
    const signalNames = Array.from(signals).map(s => {
      const n = s.querySelector('.name');
      return n ? n.textContent.trim() : null;
    }).filter(Boolean);
    return {
      card_count: cards.length,
      signal_count: signals.length,
      signal_names: signalNames,
      verify_ok: !!verifyOk,
      verify_bad: !!verifyBad,
      verify_text: verifyOk ? verifyOk.textContent.substring(0, 200) : (verifyBad ? verifyBad.textContent.substring(0, 200) : null),
      has_conformal: !!conformal,
      conformal_text: conformal ? conformal.textContent.substring(0, 200) : null
    };
  });

  await browser.close();

  console.log();
  console.log('━━━ RESULT ━━━');
  console.log('   Cards rendered:        ', result.card_count);
  console.log('   Signal rows rendered:  ', result.signal_count);
  console.log('   Has conformal panel:   ', result.has_conformal);
  console.log('   Verification ok:       ', result.verify_ok);
  console.log('   Verification bad:      ', result.verify_bad);
  console.log();
  console.log('   Signal names rendered:');
  result.signal_names.forEach(n => console.log('     -', n));
  console.log();

  // Specifically check for the new signals
  const has_microsaccades = result.signal_names.some(n => /microsaccade/i.test(n));
  const has_submovement = result.signal_names.some(n => /submovement/i.test(n));
  console.log('   Microsaccades present:    ', has_microsaccades ? '✓' : '✗');
  console.log('   Submovement Count present:', has_submovement ? '✓' : '✗');

  console.log();
  if (result.verify_ok && !result.verify_bad) {
    console.log('   Verify text:', result.verify_text);
  } else {
    console.log('   ✗ Sample receipt did not verify');
    console.log('     Verify text:', result.verify_text || '(no result)');
  }

  const allOk = result.verify_ok && !result.verify_bad &&
                has_microsaccades && has_submovement &&
                result.signal_count >= 23;
  console.log();
  console.log('   Overall:', allOk ? '✓ PASS' : '✗ FAIL');
  process.exit(allOk ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
