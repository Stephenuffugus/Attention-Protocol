#!/usr/bin/env node
/**
 * Minimal pre-flight check: does a live demo.html session save to Firestore?
 *
 * Drives a single fast session through the DEPLOYED site and captures all
 * console messages. Looks for "SESSION SAVED to Firestore" (success) or any
 * "Save failed" message (failure). Prints the verdict + details.
 *
 * Run: node scripts/verify-live-save.js
 */
'use strict';
const puppeteer = require('puppeteer');

const URL = 'https://sws-attention-proofs.web.app/demo.html';
const wait = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const logs = [];
  page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => logs.push({ type: 'pageerror', text: err.message }));

  console.log('Loading ' + URL + ' …');
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(3000); // firebase auth settle

  // Phase 1: scroll + done reading
  await page.evaluate(async () => {
    const area = document.querySelector('.reading-area');
    if (!area) return;
    const step = area.scrollHeight / 10;
    for (let i = 0; i < 10; i++) {
      area.scrollTop = step * i;
      await new Promise(r => setTimeout(r, 200));
    }
  });
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.toLowerCase().includes('done reading'));
    if (b) b.click();
  });
  await wait(600);

  // Phase 2: click first option 9 times
  for (let q = 0; q < 9; q++) {
    await page.waitForSelector('.decision-opt', { timeout: 3000 }).catch(() => {});
    await wait(450);
    await page.evaluate(() => {
      const opts = document.querySelectorAll('.decision-opt');
      if (opts[0]) opts[0].click();
    });
    await wait(300);
  }

  // Phase 3: click lit targets
  for (let t = 0; t < 12; t++) {
    await page.waitForSelector('.target.lit', { timeout: 3000 }).catch(() => {});
    await wait(350);
    const hit = await page.evaluate(() => {
      const lit = document.querySelector('.target.lit');
      if (lit) { lit.click(); return true; }
      return false;
    });
    if (!hit) break;
    await wait(200);
  }

  // Phase 4: type + complete
  await page.waitForSelector('.typing-area', { timeout: 3000 }).catch(() => {});
  await page.click('.typing-area').catch(() => {});
  await page.type('.typing-area',
    'this is a live save path validation test for the sws attention protocol pre flight verification',
    { delay: 80 });
  await wait(400);
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.toLowerCase().includes('need 20') || x.textContent.toLowerCase().includes('submit') || x.textContent.toLowerCase().includes('done typing'));
    if (b && !b.disabled) b.click();
  });
  await wait(500);
  await page.evaluate(() => { if (typeof completePhase === 'function') completePhase(4); });

  // Phase 5: wait for save to Firestore
  await wait(6000);

  const saved = logs.some(l => /SESSION SAVED to Firestore/i.test(l.text));
  const failed = logs.some(l => /Save failed|permission-denied|firestore/i.test(l.text) && /fail|error|denied/i.test(l.text));

  const sessionId = await page.evaluate(() => {
    const el = document.getElementById('r-hash');
    return el ? el.textContent : '';
  });

  const composite = await page.evaluate(() => {
    if (typeof SWSAttention === 'undefined') return null;
    return SWSAttention.getHumanConfidence().composite;
  });

  console.log('\n━━━ LIVE SAVE-PATH VERDICT ━━━');
  console.log('composite    :', composite);
  console.log('r-hash line  :', sessionId);
  console.log('saved log    :', saved ? '✓ "SESSION SAVED to Firestore"' : '✗ not observed');
  console.log('error log    :', failed ? '✗ save error observed' : '✓ none');

  if (!saved && !failed) {
    console.log('\nNOTE: no explicit save log captured. Dumping relevant lines:');
    logs.filter(l => /firestore|save|error|warn/i.test(l.text)).slice(-20).forEach(l =>
      console.log('  [' + l.type + ']', l.text.slice(0, 160)));
  }

  await browser.close();
  process.exit(saved && !failed ? 0 : 1);
})().catch(err => { console.error('fatal:', err.message); process.exit(2); });
