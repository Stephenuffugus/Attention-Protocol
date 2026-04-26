#!/usr/bin/env node
// Sanity-check the CDP Runtime.enable detector against three browser modes:
// 1. Naive Puppeteer (no stealth) — detector MUST fire
// 2. puppeteer-extra-stealth — detector behavior depends on stealth version
// 3. Several detector variants in case console.debug isn't the trigger that fires

const puppeteerNaive = require('puppeteer');
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteerExtra.use(StealthPlugin());

// Multiple detector variants — different inspector-serialization triggers
const DETECTOR_SCRIPT = `
(() => {
  const results = {};

  // Variant A: console.debug
  try {
    let detected = false;
    const e = new Error();
    Object.defineProperty(e, 'stack', {
      configurable: false,
      get: () => { detected = true; return ''; }
    });
    console.debug(e);
    results.console_debug = detected;
  } catch (err) { results.console_debug = 'err:' + err.message; }

  // Variant B: console.log
  try {
    let detected = false;
    const e = new Error();
    Object.defineProperty(e, 'stack', {
      configurable: false,
      get: () => { detected = true; return ''; }
    });
    console.log(e);
    results.console_log = detected;
  } catch (err) { results.console_log = 'err:' + err.message; }

  // Variant C: console.table
  try {
    let detected = false;
    const e = new Error();
    Object.defineProperty(e, 'stack', {
      configurable: false,
      get: () => { detected = true; return ''; }
    });
    console.table(e);
    results.console_table = detected;
  } catch (err) { results.console_table = 'err:' + err.message; }

  // Variant D: console.dir (often used by inspector)
  try {
    let detected = false;
    const e = new Error();
    Object.defineProperty(e, 'stack', {
      configurable: false,
      get: () => { detected = true; return ''; }
    });
    console.dir(e);
    results.console_dir = detected;
  } catch (err) { results.console_dir = 'err:' + err.message; }

  // Variant E: throw + catch — catch handler may serialize
  try {
    let detected = false;
    const e = new Error();
    Object.defineProperty(e, 'stack', {
      configurable: false,
      get: () => { detected = true; return ''; }
    });
    try { throw e; } catch (caught) {}
    results.throw_catch = detected;
  } catch (err) { results.throw_catch = 'err:' + err.message; }

  // Variant F: known navigator.webdriver tell
  results.navigator_webdriver = !!navigator.webdriver;

  // Variant G: Chrome plugins length (real Chrome non-zero)
  results.plugins_length = navigator.plugins ? navigator.plugins.length : 0;

  // Variant H: Permissions API (headless behaves differently)
  return navigator.permissions.query({ name: 'notifications' })
    .then(p => {
      results.notif_perm = p.state;
      results.notif_match = (Notification.permission === 'denied' && p.state === 'prompt');
      return results;
    })
    .catch(e => { results.notif_perm = 'err'; return results; });
})();
`;

async function testMode(name, browser) {
  const page = await browser.newPage();
  await page.goto('about:blank');
  const result = await page.evaluate(DETECTOR_SCRIPT);
  console.log('\n' + name + ':');
  Object.keys(result).forEach(k => console.log('  ' + k.padEnd(22) + ' → ' + JSON.stringify(result[k])));
  await page.close();
  return result;
}

(async () => {
  console.log('━━━ CDP Detector Sanity Check ━━━\n');

  const naive = await puppeteerNaive.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const naiveResult = await testMode('1. Naive Puppeteer (headless)', naive);
  await naive.close();

  const stealth = await puppeteerExtra.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const stealthResult = await testMode('2. puppeteer-extra-stealth (headless)', stealth);
  await stealth.close();

  const naiveHeaded = await puppeteerNaive.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  }).catch(e => null);
  if (naiveHeaded) {
    const naiveHeadedResult = await testMode('3. Naive Puppeteer (HEADED)', naiveHeaded);
    await naiveHeaded.close();
  } else {
    console.log('\n3. Naive Puppeteer (HEADED) — skipped (no display)');
  }

  console.log('\n━━━ ANALYSIS ━━━');
  console.log('Detector signals that fired in naive but NOT stealth = our best CDP detector candidates.');
  console.log('navigator.webdriver should be true in naive, false in stealth (stealth patches it).');
})();
