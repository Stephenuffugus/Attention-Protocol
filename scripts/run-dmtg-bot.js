#!/usr/bin/env node
// DMTG-class adversarial bot — approximates the strongest published mouse-bot
// (Liu, Cui, Ge, Zhan; Tsinghua, arXiv:2410.18233, Oct 2024). DMTG uses
// entropy-controlled diffusion networks to generate per-user, per-page mouse
// trajectories. We don't reimplement the diffusion model (overkill for harness
// purposes); we approximate the most discriminating elements:
//
//   1. puppeteer-extra-stealth env-gate evasion (defeats BotD baseline)
//   2. Bezier-curve mousemove synthesis between targets (vs straight-line clicks)
//   3. Gaussian jerk perturbation along the path (vs perfectly smooth Bezier)
//   4. 1/f-distributed (Voss-McCartney) inter-action delays — counters our
//      cross-channel 1/f coherence signal (Gilden 2001) which catches bots
//      that synthesize each channel with independent jitter
//   5. Variable per-section reading dwell with tail-heavy distribution
//   6. Realistic typing cadence (60-200ms variable per char)
//
// If our 21-signal gated composite holds against THIS bot, the published
// "0.273 gated gap" claim is defensible against the actual SOTA adversary.

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const wait = ms => new Promise(r => setTimeout(r, ms));
const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
const TARGET = process.env.TARGET || 'cme';

// ============================================================
// 1/f noise generator (Voss-McCartney algorithm)
// ============================================================
function makeOneOverFGenerator(N) {
  N = N || 6;
  const counters = new Array(N).fill(0);
  let counter = 0;
  return function() {
    counter++;
    let sum = 0;
    for (let i = 0; i < N; i++) {
      const period = 1 << i;
      if (counter % period === 0) counters[i] = Math.random() - 0.5;
      sum += counters[i];
    }
    return sum / N; // approximately in [-0.5, 0.5] with 1/f spectrum
  };
}

// CRITICAL: real DMTG-class adversary uses INDEPENDENT generators per channel
// (their diffusion model is trained ONLY on mouse trajectories; keystroke
// timing, scroll timing, decision RT use independent jitter sources). This
// mirrors the actual published threat model and is exactly the regime our
// 1/f cross-channel coherence signal (Gilden 2001) is designed to catch.
const mouseOneOverF       = makeOneOverFGenerator(6);
const keystrokeOneOverF   = makeOneOverFGenerator(6);  // independent
const scrollOneOverF      = makeOneOverFGenerator(6);  // independent
const decisionOneOverF    = makeOneOverFGenerator(6);  // independent

function delayFromGen(gen, meanMs, sdMs) {
  const u = gen();
  const delay = meanMs + sdMs * u * 4 + (Math.random() < 0.05 ? meanMs * 1.5 : 0);
  return Math.max(50, Math.round(delay));
}
const delayMouse     = (m, s) => delayFromGen(mouseOneOverF, m, s);
const delayKeystroke = (m, s) => delayFromGen(keystrokeOneOverF, m, s);
const delayScroll    = (m, s) => delayFromGen(scrollOneOverF, m, s);
const delayDecision  = (m, s) => delayFromGen(decisionOneOverF, m, s);

// ============================================================
// Bezier-curve mousemove synthesis
// ============================================================
async function bezierMouseMove(page, fromX, fromY, toX, toY, options) {
  options = options || {};
  const steps = options.steps || 25;
  const jitterPx = options.jitterPx || 3;

  // Cubic Bezier: random control points biased toward the path
  const dx = toX - fromX;
  const dy = toY - fromY;
  const cp1x = fromX + dx * 0.3 + (Math.random() - 0.5) * 80;
  const cp1y = fromY + dy * 0.3 + (Math.random() - 0.5) * 80;
  const cp2x = fromX + dx * 0.7 + (Math.random() - 0.5) * 80;
  const cp2y = fromY + dy * 0.7 + (Math.random() - 0.5) * 80;

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const omt = 1 - t;
    const x = omt*omt*omt * fromX + 3*omt*omt*t * cp1x + 3*omt*t*t * cp2x + t*t*t * toX;
    const y = omt*omt*omt * fromY + 3*omt*omt*t * cp1y + 3*omt*t*t * cp2y + t*t*t * toY;
    // Gaussian jerk perturbation
    const jx = x + (Math.random() - 0.5) * jitterPx;
    const jy = y + (Math.random() - 0.5) * jitterPx;
    await page.mouse.move(jx, jy);
    await wait(16 + Math.random() * 8); // ~50-60Hz with variation
  }
}

// ============================================================
// Click via Bezier mousemove + small dwell
// ============================================================
async function bezierClick(page, lastPos, selector) {
  const target = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, selector);
  if (!target) return lastPos;
  const tx = target.x + (Math.random() - 0.5) * 8; // small click-scatter
  const ty = target.y + (Math.random() - 0.5) * 8;
  await bezierMouseMove(page, lastPos.x, lastPos.y, tx, ty, { steps: 18 + Math.floor(Math.random() * 12) });
  await wait(80 + Math.random() * 100); // dwell on target before click
  await page.mouse.click(tx, ty);
  return { x: tx, y: ty };
}

(async () => {
  console.log('━━━ DMTG-class Adversarial Bot vs ' + TARGET.toUpperCase() + ' ━━━');
  console.log('   Adversary: puppeteer-extra-stealth + Bezier mousemove + 1/f timing + click scatter');
  console.log('   Target: ' + BASE_URL + '/' + (TARGET === 'cme' ? 'cme-demo.html' : 'demo.html'));
  console.log();

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-blink-features=AutomationControlled']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  const consoleErrors = [];
  page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));

  const url = BASE_URL + (TARGET === 'cme' ? '/cme-demo.html' : '/demo.html');
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(delayMouse(2500, 800));

  let pos = { x: 640, y: 100 };

  if (TARGET === 'cme') {
    for (let s = 1; s <= 4; s++) {
      for (let m = 0; m < 5 + Math.floor(Math.random() * 5); m++) {
        const dx = pos.x + (Math.random() - 0.5) * 200;
        const dy = pos.y + (Math.random() - 0.5) * 150;
        await bezierMouseMove(page, pos.x, pos.y, dx, dy, { steps: 8 + Math.floor(Math.random() * 6) });
        pos = { x: dx, y: dy };
        await wait(delayMouse(800, 400));
      }
      await page.evaluate(() => window.scrollBy(0, 150 + Math.random() * 100));
      await wait(delayScroll(400, 200));
      await page.evaluate(() => window.scrollBy(0, 150 + Math.random() * 100));
      await wait(delayScroll(400, 200));
      await page.evaluate((sn) => {
        const sec = document.getElementById('section-' + sn);
        if (sec) sec.scrollIntoView({ behavior: 'instant', block: 'end' });
      }, s);
      await wait(300);
      pos = await bezierClick(page, pos, '#section-' + s + ' .btn-primary');
      await wait(delayMouse(1500, 600));
    }
    await page.waitForFunction(
      () => document.getElementById('assessment') && document.getElementById('assessment').style.display === 'block',
      { timeout: 5000 }
    ).catch(() => {});
    await wait(delayMouse(1200, 500));

    for (let q = 0; q < 5; q++) {
      const optCount = await page.evaluate((qq) => document.querySelectorAll('.opt[data-q="' + qq + '"]').length, q);
      const hickMean = 600 + 250 * Math.log2(optCount + 1);
      await wait(delayDecision(hickMean, hickMean * 0.4));
      pos = await bezierClick(page, pos, '.opt[data-q="' + q + '"]');
    }

    pos = await bezierClick(page, pos, '#reflection');
    await wait(delayMouse(400, 200));
    const reflection = 'I will incorporate home blood pressure monitoring before initiating pharmacotherapy and reinforce adherence counseling at every clinic visit, particularly for newly diagnosed Stage one patients without ASCVD risk who may respond to lifestyle modification first before drug therapy is considered.';
    for (let i = 0; i < reflection.length; i++) {
      await page.keyboard.type(reflection[i]);
      await wait(delayKeystroke(110, 50));
    }
    await wait(delayMouse(800, 400));

    // Robust submit: wait for enabled, click directly via JS (Bezier click
    // sometimes misses if button moves; this guarantees the trigger).
    await page.waitForFunction(() => {
      const b = document.getElementById('submit-btn');
      return b && !b.disabled;
    }, { timeout: 5000 }).catch(() => {});
    await page.evaluate(() => { document.getElementById('submit-btn').click(); });
    await wait(5000);
  }

  // Extract results
  const result = await page.evaluate((isCme) => {
    const c = window.SWSAttention ? window.SWSAttention.getHumanConfidence() : null;
    const env = window.__swsEnvironmental || null;
    const composition = window.SWSCompositionIntegrity ?
      window.SWSCompositionIntegrity.readSnapshot({ scopeId: isCme ? 'cme' : 'demo' }) : null;
    let cmeComposite = null, cmeVerdict = null;
    if (isCme) {
      const tierEl = document.getElementById('tier-pill');
      const compEl = document.getElementById('composite-big');
      cmeComposite = compEl ? parseFloat(compEl.textContent) : null;
      cmeVerdict = tierEl ? tierEl.textContent : null;
    }
    const hashEl = document.getElementById(isCme ? 'hash-box' : 'r-hash');
    const hashText = hashEl ? hashEl.textContent : '';
    const hashMatch = hashText.match(/[0-9a-f]{64}/);
    return {
      behavioral_composite: c ? c.composite : null,
      cmeComposite, cmeVerdict,
      hash: hashMatch ? hashMatch[0] : null,
      env: env ? { bot: env.bot, bot_kind: env.bot_kind, stealth_suspicion: env.stealth_suspicion, stealth_tells: env.stealth_tells } : null,
      composition: composition ? { verdict: composition.verdict, score: composition.score } : null,
      activeSignals: c ? c.activeSignals : null,
      totalSignals: c ? c.totalSignals : null,
      // Show per-signal scores so we can see which ones the bot DID fool
      signal_scores: c ? {
        timing: c.timing, fitts: c.fitts, hicks: c.hicks, scroll: c.scroll,
        microPause: c.microPause, touch: c.touch, keystroke: c.keystroke,
        readingSpeed: c.readingSpeed, hoverDwell: c.hoverDwell,
        tabVisibility: c.tabVisibility, inactivity: c.inactivity,
        rtVariability: c.rtVariability, scrollBacktrack: c.scrollBacktrack,
        fractalScaling: c.fractalScaling, crossCorrelation: c.crossCorrelation,
        oneOverFCoherence: c.oneOverFCoherence, // The new defense signal
        microsaccades: c.microsaccades, // NEW v22 signal — catches Bezier bots without idle tremor
        submovementCount: c.submovementCount, // NEW v23 signal — Meyer 1988 corrective-submovement detection
        curvatureIndex: c.curvatureIndex, cursorJerk: c.cursorJerk,
        velocityProfile: c.velocityProfile, twoThirdsPower: c.twoThirdsPower,
        deviceMotion: c.deviceMotion
      } : null,
      oneOverFDetail: c ? c.oneOverFDetail : null,
      signalActive: c ? c.signalActive : null
    };
  }, TARGET === 'cme');

  console.log('   ━━━ DMTG-CLASS BOT RESULTS ━━━');
  console.log('   Behavioral composite:  ' + (result.behavioral_composite !== null ? result.behavioral_composite.toFixed(3) : 'null'));
  if (TARGET === 'cme') {
    console.log('   CME composite:         ' + (result.cmeComposite !== null ? result.cmeComposite.toFixed(3) : 'null'));
    console.log('   CME verdict:           ' + result.cmeVerdict);
  }
  console.log('   Active signals:        ' + result.activeSignals + '/' + result.totalSignals);
  console.log('   Hash:                  ' + (result.hash ? result.hash.substring(0, 16) + '...' : 'null'));
  console.log('   Environmental gate:    ' + JSON.stringify(result.env));
  console.log('   Composition integrity: ' + JSON.stringify(result.composition));
  console.log();
  console.log('   ━━━ PER-SIGNAL BREAKDOWN ━━━');
  if (result.signal_scores) {
    Object.keys(result.signal_scores).forEach(k => {
      const v = result.signal_scores[k];
      const active = result.signalActive ? result.signalActive[k] : true;
      const display = active ? (typeof v === 'number' ? v.toFixed(3) : String(v)) : 'N/A';
      console.log('     ' + k.padEnd(22) + ' = ' + display);
    });
  }
  if (result.oneOverFDetail) {
    console.log();
    console.log('   ━━━ 1/f COHERENCE DIAGNOSTIC (the new white-space defense) ━━━');
    console.log('     mean α:  ' + result.oneOverFDetail.mean_alpha.toFixed(3));
    console.log('     SD α:    ' + result.oneOverFDetail.sd_alpha.toFixed(3));
    console.log('     score:   ' + result.oneOverFDetail.score.toFixed(3));
    result.oneOverFDetail.channels.forEach(c => {
      console.log('     channel ' + c.channel.padEnd(12) + ' α=' + c.alpha.toFixed(3) + ' R²=' + c.r2.toFixed(3) + ' (n=' + c.n + ')');
    });
  }

  if (consoleErrors.length) console.log('\n   Console errors:'), consoleErrors.forEach(e => console.log('     ' + e));

  await browser.close();

  const out = path.resolve(__dirname, '..', 'proof', 'results', 'dmtg-bot-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ target: TARGET, timestamp: new Date().toISOString(), result }, null, 2));
  console.log('\n   Saved: ' + out);
})().catch(e => { console.error(e); process.exit(1); });
