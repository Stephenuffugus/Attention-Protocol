#!/usr/bin/env node
/**
 * iPhone walkthrough harness — drives the LIVE deployed demo through all
 * 5 phases at an iPhone-14 viewport (375x852) using WebKit (the same engine
 * that powers iOS Safari). Screenshots each phase, reports where (if
 * anywhere) a real iPhone visitor would get stuck.
 *
 * Run: node scripts/iphone-walkthrough.js
 * Output: scripts/walkthrough-output/*.png + a pass/fail summary
 *
 * Why this exists: Stephen has no iPhone. Real iPhone testers (older
 * relatives) can't easily report what they see. WebKit-on-Linux is the
 * closest non-device approximation of Safari we can run in CI/Codespace.
 *
 * (c) 2026 SWS Strategic Media LLC.
 */
'use strict';

const { webkit, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL = process.argv[2] || 'https://sws-attention-proofs.web.app/demo.html?source=corpus_2026-05-06_iphone_test';
const OUT = path.join(__dirname, 'walkthrough-output');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('iPhone walkthrough — testing:', URL);
  console.log('Output dir:', OUT);
  console.log('');

  const browser = await webkit.launch({ headless: true });
  const ctx = await browser.newContext({
    ...devices['iPhone 14'],
    // iPhone 14 default = 390x844; downsize to 375x667 to match an older
    // iPhone (SE 2nd gen, 8, etc.) which is what Stephen's testers use.
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
  });
  const page = await ctx.newPage();

  const log = [];
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
    }
  });
  page.on('pageerror', err => consoleErrors.push(`[pageerror] ${err.message}`));

  function step(name, ok, detail) {
    const mark = ok ? '✓' : '✗';
    const line = `${mark} ${name}${detail ? ' — ' + detail : ''}`;
    console.log(line);
    log.push({ name, ok, detail });
  }

  try {
    // ---------- LOAD ----------
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await wait(2000); // let SDK + auth init
    await page.screenshot({ path: path.join(OUT, '01-load.png'), fullPage: true });
    step('page loads at 375x667', true);

    const sdkLoaded = await page.evaluate(() => typeof window.SWSAttention === 'object');
    step('SWSAttention SDK loaded', sdkLoaded);

    const phase1Visible = await page.evaluate(() =>
      document.getElementById('phase-1').style.display !== 'none');
    step('phase-1 visible at load', phase1Visible);

    // Detect touch-only branch is firing
    const touchOnly = await page.evaluate(() =>
      window.matchMedia('(pointer: coarse)').matches &&
      !window.matchMedia('(pointer: fine)').matches);
    step('matchMedia detects pointer:coarse (mobile branch active)', touchOnly);

    // ---------- PHASE 1: READING ----------
    // Scroll inside the reading area, then verify the inner Continue button
    // is reachable when the user reaches the end of the content.
    await page.evaluate(() => {
      const a = document.getElementById('reading-area');
      a.scrollTop = a.scrollHeight; // scroll to bottom
    });
    await wait(500);
    await page.screenshot({ path: path.join(OUT, '02-phase1-end.png'), fullPage: true });

    // The inner Continue button must be visible to the user. Find any
    // visible "Done Reading" button (we have two — inner and outer).
    const buttonVisible = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'))
        .filter(b => /Done Reading/i.test(b.textContent));
      return btns.some(b => {
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.top < window.innerHeight && r.bottom > 0;
      });
    });
    step('phase-1 Continue button reachable on 375x667', buttonVisible);

    // Click the first visible Done Reading button
    const clickedPhase1 = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'))
        .filter(b => /Done Reading/i.test(b.textContent));
      const visible = btns.find(b => {
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (visible) { visible.click(); return true; }
      return false;
    });
    step('clicked phase-1 Continue', clickedPhase1);
    await wait(1000);

    // ---------- PHASE 2: DECISIONS ----------
    const phase2Visible = await page.evaluate(() =>
      document.getElementById('phase-2').style.display !== 'none');
    step('phase-2 transitioned from phase-1', phase2Visible);
    await page.screenshot({ path: path.join(OUT, '03-phase2.png'), fullPage: true });

    // Tap through all decision questions. There's no "next" button — each
    // tap auto-advances. Loop until we land on phase-3.
    let answered = 0;
    for (let i = 0; i < 20; i++) {
      const isPhase3 = await page.evaluate(() =>
        document.getElementById('phase-3').style.display !== 'none');
      if (isPhase3) break;

      const tapped = await page.evaluate(() => {
        const opts = document.querySelectorAll('#decision-area .decision-opt');
        if (opts.length === 0) return false;
        // Tap a random option
        const opt = opts[Math.floor(Math.random() * opts.length)];
        opt.click();
        return true;
      });
      if (!tapped) break;
      answered++;
      await wait(450); // setTimeout(showQuestion, 250) + buffer
    }
    step(`phase-2 answered ${answered} questions and advanced`, answered > 0);

    // ---------- PHASE 3: TARGETS ----------
    const phase3Visible = await page.evaluate(() =>
      document.getElementById('phase-3').style.display !== 'none');
    step('phase-3 visible', phase3Visible);
    if (phase3Visible) await page.screenshot({ path: path.join(OUT, '04-phase3.png'), fullPage: true });

    // Tap each lit target until we advance to phase-4
    let targetsHit = 0;
    for (let i = 0; i < 20; i++) {
      const isPhase4 = await page.evaluate(() =>
        document.getElementById('phase-4').style.display !== 'none');
      if (isPhase4) break;

      const hit = await page.evaluate(() => {
        const lit = document.querySelector('.target.lit');
        if (lit) { lit.click(); return true; }
        return false;
      });
      if (!hit) break;
      targetsHit++;
      await wait(150);
    }
    step(`phase-3 hit ${targetsHit} targets and advanced`, targetsHit > 0);

    // ---------- PHASE 4: TYPING ----------
    const phase4Visible = await page.evaluate(() =>
      document.getElementById('phase-4').style.display !== 'none');
    step('phase-4 visible', phase4Visible);
    if (phase4Visible) await page.screenshot({ path: path.join(OUT, '05-phase4.png'), fullPage: true });

    // Type a 25-word reflection — focus textarea then type with realistic
    // per-key timing so the composition-integrity tracker sees a real stream.
    const typedText = 'The policy describes liability coverage for attention verification ' +
                      'including signal collection cryptographic hash generation and ' +
                      'tier classification across supported platforms and devices today';
    await page.focus('#typing-area');
    await page.keyboard.type(typedText, { delay: 80 });
    await wait(500);

    const typingButtonEnabled = await page.evaluate(() => {
      const btn = document.getElementById('typing-done-btn');
      return btn && btn.style.pointerEvents !== 'none';
    });
    step('typing button enabled after 20+ words', typingButtonEnabled);

    if (typingButtonEnabled) await page.click('#typing-done-btn');
    await wait(2000);

    // ---------- PHASE 5: RESULTS ----------
    const phase5Visible = await page.evaluate(() =>
      document.getElementById('phase-5').style.display !== 'none');
    step('phase-5 (results) visible', phase5Visible);
    await page.screenshot({ path: path.join(OUT, '06-phase5-results.png'), fullPage: true });

    // Wait for receipt to compute + save attempt
    await wait(8000);
    await page.screenshot({ path: path.join(OUT, '07-phase5-saved.png'), fullPage: true });

    // Read the new save-status indicator we shipped today
    const saveStatus = await page.evaluate(() => {
      const el = document.getElementById('r-save-status');
      if (!el || el.style.display === 'none') return { shown: false };
      return { shown: true, text: el.textContent, color: el.style.color };
    });
    step('save-status indicator rendered',
      saveStatus.shown,
      saveStatus.shown ? `"${saveStatus.text}"` : 'not visible');

    // Read the receipt hash text
    const hashText = await page.evaluate(() => {
      const el = document.getElementById('r-hash');
      return el ? el.textContent : null;
    });
    step('receipt hash present',
      !!hashText && /SHA-256/i.test(hashText),
      hashText ? hashText.slice(0, 80) : 'missing');

    // ---------- DONE ----------
    const passed = log.filter(s => s.ok).length;
    const failed = log.filter(s => !s.ok).length;
    console.log('');
    console.log(`━━━ ${passed} passed, ${failed} failed ━━━`);
    if (consoleErrors.length) {
      console.log('');
      console.log('Browser console errors/warnings:');
      consoleErrors.forEach(e => console.log('  ' + e));
    }
    console.log('');
    console.log('Screenshots in', OUT);
    process.exitCode = failed > 0 ? 1 : 0;
  } catch (e) {
    console.error('FATAL:', e.message);
    await page.screenshot({ path: path.join(OUT, '99-fatal.png'), fullPage: true }).catch(() => {});
    process.exitCode = 2;
  } finally {
    await browser.close();
  }
}

main();
