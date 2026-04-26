#!/usr/bin/env node
// Track B1: puppeteer-extra-stealth bot vs the deployed Attention Protocol.
// Tests whether the system holds up against an adversary that has explicitly
// patched the env-gate's known tells (webdriver flag, ChromeDriver markers,
// missing-API heuristics, headless detection). This is the most realistic
// real-world bot since the stealth plugin is open-source and widely-used by
// scrapers/bots in production.
//
// Output: behavioral composite + which layers caught it + gated composite.
// Compares against the earlier non-stealth Puppeteer harness numbers.

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const wait = ms => new Promise(r => setTimeout(r, ms));
const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
const TARGET = process.env.TARGET || 'cme';

async function runStealthBot() {
  console.log('━━━ Stealth Bot vs ' + TARGET.toUpperCase() + ' ━━━');
  console.log('   Adversary: puppeteer-extra-stealth (patches webdriver, CDP, navigator quirks)');
  console.log('   Target: ' + BASE_URL + '/' + (TARGET === 'cme' ? 'cme-demo.html' : 'demo.html'));
  console.log();

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled'
    ]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  const consoleErrors = [];
  page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

  const url = BASE_URL + (TARGET === 'cme' ? '/cme-demo.html' : '/demo.html');
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(2500); // let environmental gate run

  // Capture environmental verdict early — the system runs BotD on init
  const envEarly = await page.evaluate(() => window.__swsEnvironmental || null);
  console.log('   Environmental gate (post-load): ' + JSON.stringify(envEarly));

  if (TARGET === 'cme') {
    // Walk through 4 sections with 30-50s reading-like dwell each
    for (let s = 1; s <= 4; s++) {
      await wait(2500 + Math.random() * 1500);
      const advanced = await page.evaluate((sn) => {
        const sec = document.getElementById('section-' + sn);
        if (!sec || sec.style.display === 'none') return false;
        const btns = sec.querySelectorAll('.btn-primary');
        if (btns[0]) { btns[0].click(); return true; }
        return false;
      }, s);
      if (!advanced) break;
    }
    // Wait for assessment
    await page.waitForFunction(
      () => document.getElementById('assessment') && document.getElementById('assessment').style.display === 'block',
      { timeout: 5000 }
    ).catch(() => {});
    // Answer 5 quiz questions, varying delays per question
    await wait(1500);
    for (let q = 0; q < 5; q++) {
      await wait(800 + Math.random() * 1200);
      await page.evaluate((qq) => {
        const opts = document.querySelectorAll('.opt[data-q="' + qq + '"]');
        if (opts[0]) opts[0].click();
      }, q);
    }
    await wait(800);
    // Type a plausible reflection
    await page.click('#reflection');
    await page.type('#reflection',
      'I will incorporate home blood pressure monitoring before initiating pharmacotherapy and reinforce adherence counseling at every clinic visit, especially for newly diagnosed Stage one patients without ASCVD risk who may respond to lifestyle modification first.',
      { delay: 70 + Math.random() * 50 }
    );
    await wait(1000);
    await page.evaluate(() => { document.getElementById('submit-btn').click(); });
    await wait(4000);
  } else {
    // Demo flow
    await wait(3500);
    await page.evaluate(() => {
      const btn = document.querySelector('#phase-1 .btn-primary');
      if (btn) btn.click();
    });
    for (let q = 0; q < 14; q++) {
      await wait(900 + Math.random() * 1100);
      const state = await page.evaluate(() => {
        const phase = document.getElementById('phase-2');
        if (!phase || phase.style.display === 'none') return 'phase-done';
        const opt = document.querySelector('#decision-area .decision-opt');
        if (opt) { opt.click(); return 'clicked'; }
        return 'no-opt';
      });
      if (state === 'phase-done') break;
    }
    for (let i = 0; i < 18; i++) {
      await wait(400 + Math.random() * 400);
      const state = await page.evaluate(() => {
        const phase = document.getElementById('phase-3');
        if (!phase || phase.style.display === 'none') return 'phase-done';
        const lit = document.querySelector('.target.lit');
        if (lit) { lit.click(); return 'clicked'; }
        return 'no-lit';
      });
      if (state === 'phase-done') break;
    }
    await wait(1500);
    await page.evaluate(() => {
      const ta = document.getElementById('typing-area');
      if (ta) ta.focus();
    });
    await page.keyboard.type(
      'The receipt format is the product. Tamper evident SHA two five six over a deeply key sorted canonical JSON of the session payload. Content bound to every displayed value end to end.',
      { delay: 50 + Math.random() * 30 }
    );
    await wait(1000);
    await page.evaluate(() => {
      const btn = document.getElementById('typing-done-btn');
      if (btn) { btn.style.opacity = '1'; btn.style.pointerEvents = 'auto'; btn.disabled = false; btn.click(); }
    });
    await wait(4000);
  }

  // Extract verdict + signals + receipt from the page
  const result = await page.evaluate((isCme) => {
    const c = window.SWSAttention ? window.SWSAttention.getHumanConfidence() : null;
    const env = window.__swsEnvironmental || null;
    const composition = window.SWSCompositionIntegrity ?
      window.SWSCompositionIntegrity.readSnapshot({ scopeId: isCme ? 'cme' : 'demo' }) : null;
    let cmeComposite = null, cmeVerdict = null, demoTier = null, demoComposite = null;
    if (isCme) {
      const tierEl = document.getElementById('tier-pill');
      const compEl = document.getElementById('composite-big');
      cmeComposite = compEl ? parseFloat(compEl.textContent) : null;
      cmeVerdict = tierEl ? tierEl.textContent : null;
    } else {
      const tierEl = document.getElementById('r-tier-badge');
      const compEl = document.getElementById('r-composite-big');
      demoTier = tierEl ? tierEl.textContent : null;
      demoComposite = compEl ? parseFloat(compEl.textContent) : null;
    }
    const hashEl = document.getElementById(isCme ? 'hash-box' : 'r-hash');
    const hashText = hashEl ? hashEl.textContent : '';
    const hashMatch = hashText.match(/[0-9a-f]{64}/);
    return {
      behavioral_composite: c ? c.composite : null,
      cmeComposite, cmeVerdict,
      demoComposite, demoTier,
      hash: hashMatch ? hashMatch[0] : null,
      env: env ? { bot: env.bot, botKind: env.botKind, detector: env.detector } : null,
      composition: composition ? { verdict: composition.verdict, score: composition.score } : null,
      activeSignals: c ? c.activeSignals : null,
      totalSignals: c ? c.totalSignals : null
    };
  }, TARGET === 'cme');

  console.log();
  console.log('   ━━━ STEALTH BOT RESULTS ━━━');
  console.log('   Behavioral composite:  ' + (result.behavioral_composite !== null ? result.behavioral_composite.toFixed(3) : 'null'));
  if (TARGET === 'cme') {
    console.log('   CME composite:         ' + (result.cmeComposite !== null ? result.cmeComposite.toFixed(3) : 'null'));
    console.log('   CME verdict:           ' + result.cmeVerdict);
  } else {
    console.log('   Demo composite:        ' + (result.demoComposite !== null ? result.demoComposite.toFixed(3) : 'null'));
    console.log('   Demo tier:             ' + result.demoTier);
  }
  console.log('   Active signals:        ' + result.activeSignals + '/' + result.totalSignals);
  console.log('   Hash:                  ' + (result.hash ? result.hash.substring(0, 16) + '...' : 'null'));
  console.log('   Environmental gate:    ' + JSON.stringify(result.env));
  console.log('   Composition integrity: ' + JSON.stringify(result.composition));
  console.log();

  // Defense-in-depth analysis
  console.log('   ━━━ DEFENSE-IN-DEPTH ANALYSIS ━━━');
  const envCaught = result.env && result.env.bot === true;
  const compCaught = result.composition && (result.composition.verdict === 'mechanical' || result.composition.verdict === 'pasted');
  console.log('   Environmental gate caught it?    ' + (envCaught ? 'YES (' + result.env.botKind + ')' : 'NO ← stealth defeated env-gate'));
  console.log('   Composition integrity caught it? ' + (compCaught ? 'YES (' + result.composition.verdict + ')' : 'NO'));
  if (!envCaught && !compCaught) {
    console.log('   ⚠ STEALTH BOT NOT CAUGHT BY ANY NON-BEHAVIORAL LAYER. Behavioral composite alone must hold.');
  } else {
    console.log('   ✓ Caught by ' + [envCaught && 'env', compCaught && 'composition'].filter(Boolean).join(' + ') + ' — gated composite would cap at PASSIVE (~0.30).');
  }

  if (consoleErrors.length) {
    console.log();
    console.log('   Console errors:');
    consoleErrors.forEach(e => console.log('     - ' + e));
  }

  await browser.close();

  // Save results to a file for follow-up analysis
  const out = path.resolve(__dirname, '..', 'proof', 'results', 'stealth-bot-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({
    target: TARGET,
    timestamp: new Date().toISOString(),
    result,
    envCaught,
    compCaught
  }, null, 2));
  console.log();
  console.log('   Saved: ' + out);
}

runStealthBot().catch(e => {
  console.error(e);
  process.exit(1);
});
