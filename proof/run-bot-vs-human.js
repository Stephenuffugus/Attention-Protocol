/**
 * SWS Attention Protocol — Live Bot vs Human Proof
 *
 * Runs one or more Puppeteer bot profiles against the live demo.html,
 * completes all 5 phases, and lets the SDK score them end-to-end.
 * Each session writes a real receipt to Firestore (demos collection)
 * with is_bot=true so we can filter them against real human sessions.
 *
 * Usage:
 *   node proof/run-bot-vs-human.js              # run all profiles once
 *   node proof/run-bot-vs-human.js naive        # run only naive bot
 *   node proof/run-bot-vs-human.js --local      # run against localhost:4000 instead of live
 *
 * Prereqs (local mode only): `npm run proof:gallery` in another terminal.
 */

const puppeteer = require('puppeteer');

const args = process.argv.slice(2);
const useLocal = args.includes('--local');
const profileFilter = args.find(a => !a.startsWith('--'));
const BASE_URL = useLocal
  ? 'http://localhost:4000'
  : 'https://sws-attention-proofs.web.app';

// ============================================================
// BOT PROFILES
// ============================================================

const profiles = {
  naive: {
    name: 'Naive Bot',
    description: 'Constant 50-100ms clicks, no variance, straight-line cursor',
    readDelayMs: 200,
    questionDelayMs: () => 80,
    targetDelayMs: () => 60,
    typeDelayMs: () => 15,
    typedText: 'a a a a a a a a a a a a a a a a a a a a a a a a a',
    mouseVariance: 0
  },
  jittered: {
    name: 'Jittered Bot',
    description: 'Random 100-300ms delays, uncorrelated with task complexity',
    readDelayMs: 500,
    questionDelayMs: () => 100 + Math.random() * 200,
    targetDelayMs: () => 100 + Math.random() * 200,
    typeDelayMs: () => 50 + Math.random() * 50,
    typedText: 'the quick brown fox jumps over the lazy dog the quick brown fox jumps over',
    mouseVariance: 2
  },
  sophisticated: {
    name: 'Sophisticated Bot',
    description: 'Attempts human-like variation, scripted pseudo-reading',
    readDelayMs: 3000,
    questionDelayMs: (optCount) => 400 + optCount * 150 + Math.random() * 400,
    targetDelayMs: () => 350 + Math.random() * 350,
    typeDelayMs: () => 80 + Math.random() * 120,
    typedText: 'attention verification receipts prove human engagement without collecting content data just behavioral shape',
    mouseVariance: 10
  }
};

// ============================================================
// RUNNER
// ============================================================

async function runProfile(browser, profile) {
  console.log(`\n━━━ ${profile.name} ━━━`);
  console.log(`   ${profile.description}`);

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // Forward page console to our terminal (muted — too noisy)
  // page.on('console', msg => console.log('  [page]', msg.text()));

  await page.goto(`${BASE_URL}/demo.html`, { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(2000); // let Firebase auth settle

  // ---- PHASE 1: READ ----
  // Scroll the reading area slowly, then click "Done Reading"
  await page.evaluate(async (ms) => {
    const area = document.querySelector('.reading-area');
    if (!area) return;
    const step = area.scrollHeight / 20;
    for (let i = 0; i < 20; i++) {
      area.scrollTop = step * i;
      await new Promise(r => setTimeout(r, ms / 20));
    }
  }, profile.readDelayMs * 10);
  await clickByText(page, 'Done Reading');
  await wait(500);

  // ---- PHASE 2: DECIDE (9 questions) ----
  for (let q = 0; q < 9; q++) {
    // Wait for options to render
    await page.waitForSelector('.decision-opt', { timeout: 5000 }).catch(() => {});
    const optCount = await page.evaluate(() => document.querySelectorAll('.decision-opt').length);
    if (optCount === 0) break;

    await wait(profile.questionDelayMs(optCount));

    // Bot picks first option every time (no comprehension)
    await page.evaluate(() => {
      const opts = document.querySelectorAll('.decision-opt');
      if (opts[0]) opts[0].click();
    });
    await wait(300);
  }

  // ---- PHASE 3: TARGETS (12 clicks) ----
  for (let t = 0; t < 12; t++) {
    await page.waitForSelector('.target.lit', { timeout: 5000 }).catch(() => {});
    await wait(profile.targetDelayMs());
    const hit = await page.evaluate(() => {
      const lit = document.querySelector('.target.lit');
      if (lit) { lit.click(); return true; }
      return false;
    });
    if (!hit) break;
    await wait(200);
  }

  // ---- PHASE 4: TYPE ----
  await page.waitForSelector('.typing-area', { timeout: 5000 }).catch(() => {});
  await page.click('.typing-area').catch(() => {});
  await page.type('.typing-area', profile.typedText, { delay: profile.typeDelayMs() });
  await wait(500);
  await clickByText(page, 'Need 20');  // button says "Need 20+ words →" or "Submit →" after threshold
  await wait(300);
  // Fallback: try the generic complete button
  await page.evaluate(() => {
    if (typeof completePhase === 'function') completePhase(4);
  });

  // ---- PHASE 5: RESULTS (wait for report + save to Firestore) ----
  await wait(3000);

  // Extract scores and receipt
  const result = await page.evaluate(() => {
    if (typeof SWSAttention === 'undefined') return null;
    const stats = SWSAttention.getStats();
    const confidence = stats.humanConfidence || SWSAttention.getHumanConfidence();
    const receiptEl = document.getElementById('r-hash');
    return {
      composite: confidence.composite,
      signals: confidence,
      totalHashes: stats.totalHashes,
      lastHash: stats.lastHash,
      receiptDisplay: receiptEl ? receiptEl.textContent : null
    };
  });

  await page.close();

  if (!result) {
    console.log('   ⚠ SDK not accessible — profile failed');
    return null;
  }

  console.log(`   composite: ${result.composite.toFixed(3)}`);
  console.log(`   hashes:    ${result.totalHashes}`);
  console.log(`   lastHash:  ${result.lastHash ? result.lastHash.substring(0, 16) + '...' : 'null'}`);
  return result;
}

// Click a button whose visible text contains the given substring
async function clickByText(page, text) {
  const clicked = await page.evaluate((t) => {
    const btns = Array.from(document.querySelectorAll('button'));
    const match = btns.find(b => b.textContent.toLowerCase().includes(t.toLowerCase()));
    if (match && !match.disabled) { match.click(); return true; }
    return false;
  }, text);
  return clicked;
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));

// ============================================================
// MAIN
// ============================================================

(async () => {
  console.log(`SWS Bot vs Human — running against ${BASE_URL}`);
  console.log(`Profiles: ${profileFilter || 'all'}\n`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const results = {};
  const toRun = profileFilter ? [profileFilter] : Object.keys(profiles);

  for (const key of toRun) {
    if (!profiles[key]) { console.log(`Unknown profile: ${key}`); continue; }
    try {
      results[key] = await runProfile(browser, profiles[key]);
    } catch (err) {
      console.log(`   ✗ Error: ${err.message}`);
      results[key] = null;
    }
  }

  await browser.close();

  // Summary
  console.log('\n━━━ SUMMARY ━━━');
  Object.entries(results).forEach(([k, r]) => {
    if (r) {
      console.log(`${profiles[k].name.padEnd(20)} composite=${r.composite.toFixed(3)} hashes=${r.totalHashes}`);
    } else {
      console.log(`${profiles[k].name.padEnd(20)} FAILED`);
    }
  });

  const real = results;
  const composites = Object.values(results).filter(r => r).map(r => r.composite);
  if (composites.length > 1) {
    const max = Math.max(...composites);
    const min = Math.min(...composites);
    console.log(`\nBot composite range: ${min.toFixed(3)} - ${max.toFixed(3)}`);
    console.log(`For comparison, a real human session (Stephen, 2026-04-20) scored 0.573`);
    console.log(`Separation vs weakest bot: ${(0.573 - min).toFixed(3)}`);
  }
})().catch(err => { console.error(err); process.exit(1); });
