#!/usr/bin/env node
// Naive Puppeteer benchmark — no stealth, no Bezier, no 1/f. The control
// case: what does vanilla puppeteer trip in the new 7-vector env-gate?
//
// Expected: BotD baseline catches it on `headless_chrome` (suspicion goes
// straight to bot=true via the BotD path). The 6 stealth-tells vectors then
// also fire because vanilla puppeteer doesn't patch any of them. End result
// should be a strong, multi-vector positive — confirming the tier story
// (naive = caught at threshold; stealth = closer to threshold; real human =
// clean).

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
const TARGET = process.env.TARGET || 'cme-demo.html';
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log('━━━ Naive Puppeteer (no stealth) vs 7-vector env-gate ━━━');
  console.log('   Target: ' + BASE_URL + '/' + TARGET);
  console.log('   Adversary: vanilla puppeteer.launch(), no plugins, no patches');
  console.log();

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const consoleErrors = [];
  page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push('console.error: ' + m.text()); });

  await page.goto(BASE_URL + '/' + TARGET, { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(1500); // give env-gate time to run

  // Trigger user-gesture so the env-gate runs (some pages defer it until first interaction)
  await page.mouse.move(100, 100);
  await page.mouse.click(100, 100);
  await wait(2500); // env-gate is async; WebGPU adapter info may take a tick

  const result = await page.evaluate(() => {
    const env = window.__swsEnvironmental || null;
    return {
      env: env ? {
        bot: env.bot,
        bot_kind: env.bot_kind,
        botd_bot: env.botd_bot,
        botd_kind: env.botd_kind,
        stealth_suspicion: env.stealth_suspicion,
        stealth_tells: env.stealth_tells,
        detector: env.detector
      } : null
    };
  });

  console.log('   ━━━ ENVIRONMENTAL GATE OUTPUT ━━━');
  if (!result.env) {
    console.log('   (env-gate did not populate window.__swsEnvironmental — check page or wait longer)');
  } else {
    const e = result.env;
    console.log('   Detector:           ' + e.detector);
    console.log('   bot:                ' + e.bot + ' (' + (e.bot ? 'CAUGHT' : 'EVADES') + ')');
    console.log('   bot_kind:           ' + (e.bot_kind || '(none)'));
    console.log('   BotD says bot:      ' + e.botd_bot);
    console.log('   BotD botKind:       ' + (e.botd_kind || '(none)'));
    console.log('   Stealth suspicion:  ' + (e.stealth_suspicion !== undefined ? e.stealth_suspicion.toFixed(3) : 'n/a'));
    console.log();
    console.log('   ━━━ PER-VECTOR BREAKDOWN ━━━');
    const t = e.stealth_tells || {};
    if (t.webgl) console.log('   webgl:        renderer="' + t.webgl.renderer + '"  cloud_vm=' + t.webgl.cloud_vm_signature);
    if (t.webgpu) console.log('   webgpu:       ' + JSON.stringify(t.webgpu));
    if (t.fnToString) console.log('   fnToString:   suspicious=' + t.fnToString.suspicious + '  non_native_count=' + t.fnToString.non_native_count);
    if (t.iframe) console.log('   iframe:       suspicious=' + t.iframe.suspicious + '  mismatch_count=' + (t.iframe.mismatch_count !== undefined ? t.iframe.mismatch_count : 'n/a'));
    if (t.chromeRuntime) console.log('   chromeRuntime: has_chrome=' + t.chromeRuntime.has_chrome + '  has_runtime=' + t.chromeRuntime.has_runtime);
    if (t.audio) console.log('   audio:        suspicious=' + t.audio.suspicious + '  reasons=' + JSON.stringify(t.audio.reasons || []));
  }

  if (consoleErrors.length) {
    console.log();
    console.log('   Console errors:');
    consoleErrors.forEach(e => console.log('     ' + e));
  }

  await browser.close();

  const out = path.resolve(__dirname, '..', 'proof', 'results', 'naive-puppeteer-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ target: TARGET, timestamp: new Date().toISOString(), result }, null, 2));
  console.log();
  console.log('   Saved: ' + out);
})().catch(e => { console.error(e); process.exit(1); });
