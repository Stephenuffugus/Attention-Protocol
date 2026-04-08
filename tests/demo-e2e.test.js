/**
 * Live Demo — End-to-End Browser Test
 *
 * Simulates a real user going through the demo page:
 *   Phase 1: Read the policy (scroll through content)
 *   Phase 2: Answer questions (Hick's Law)
 *   Phase 3: Click targets (Fitts' Law)
 *   Phase 4: Verify results appear with all signals
 *
 * This is the test that proves Jessie's experience will work.
 *
 * (c) 2026 SWS Strategic Media LLC.
 */

const puppeteer = require('puppeteer');
const express = require('express');
const path = require('path');

let browser;
let staticServer;
const PORT = 9877;
const BASE = `http://localhost:${PORT}`;
const wait = (ms) => new Promise(r => setTimeout(r, ms));

beforeAll(async () => {
  // Serve the proof directory (includes sdk/ subfolder)
  const app = express();
  app.use(express.static(path.resolve(__dirname, '../proof')));
  // Also serve src/sdk for local dev path
  app.use('/src/sdk', express.static(path.resolve(__dirname, '../src/sdk')));
  staticServer = app.listen(PORT);

  browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
}, 30000);

afterAll(async () => {
  if (browser) await browser.close();
  if (staticServer) staticServer.close();
});

describe('Live Demo — Full User Flow', () => {

  test('demo page loads and SDK initializes', async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/demo.html`, { waitUntil: 'networkidle0' });
    await wait(1000);

    const hasSDK = await page.evaluate(() => typeof SWSAttention === 'object');
    expect(hasSDK).toBe(true);

    // Phase 1 should be visible
    const phase1Visible = await page.evaluate(() => {
      return document.getElementById('phase-1').style.display !== 'none';
    });
    expect(phase1Visible).toBe(true);

    // Live panel should show initial values
    const composite = await page.evaluate(() => {
      return document.getElementById('live-composite').textContent;
    });
    expect(composite).toBeDefined();

    await page.close();
  }, 15000);

  test('Phase 1: Reading — scroll and complete', async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/demo.html`, { waitUntil: 'networkidle0' });
    await wait(500);

    // Scroll through reading area
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => {
        var el = document.getElementById('reading-area');
        if (el) el.scrollTop += 60;
      });
      await wait(800);
    }

    // Click "Done Reading" button
    await page.click('.btn-primary');
    await wait(500);

    // Phase 2 should now be visible
    const phase2Visible = await page.evaluate(() => {
      return document.getElementById('phase-2').style.display !== 'none';
    });
    expect(phase2Visible).toBe(true);

    await page.close();
  }, 20000);

  test('Phase 2: Decisions — answer all questions', async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/demo.html`, { waitUntil: 'networkidle0' });
    await wait(500);

    // Complete phase 1
    await page.click('.btn-primary');
    await wait(500);

    // Answer 3 questions with human-like timing
    for (let q = 0; q < 3; q++) {
      await wait(600 + Math.random() * 800); // Think time
      // Click first option
      const opts = await page.$$('.decision-opt');
      if (opts.length > 0) {
        await opts[0].click();
      }
      await wait(400);
    }
    await wait(500);

    // Phase 3 should now be visible
    const phase3Visible = await page.evaluate(() => {
      return document.getElementById('phase-3').style.display !== 'none';
    });
    expect(phase3Visible).toBe(true);

    await page.close();
  }, 25000);

  test('Full flow: all 3 phases → results with signals', async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/demo.html`, { waitUntil: 'networkidle0' });
    await wait(500);

    // Phase 1: Read and complete
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => {
        var el = document.getElementById('reading-area');
        if (el) el.scrollTop += 70;
      });
      await wait(600);
    }
    await page.click('.btn-primary');
    await wait(500);

    // Phase 2: Answer questions
    for (let q = 0; q < 3; q++) {
      await wait(500 + Math.random() * 500);
      const opts = await page.$$('.decision-opt');
      if (opts.length > 0) {
        await opts[Math.min(1, opts.length - 1)].click();
      }
      await wait(400);
    }
    await wait(500);

    // Phase 3: Click targets
    for (let t = 0; t < 8; t++) {
      await wait(200);
      const lit = await page.$('.target.lit');
      if (lit) {
        await lit.click();
        await wait(300);
      }
    }
    await wait(1000);

    // Phase 4: Results should be visible
    const phase4Visible = await page.evaluate(() => {
      return document.getElementById('phase-4').style.display !== 'none';
    });
    expect(phase4Visible).toBe(true);

    // Check that signals are populated
    const composite = await page.evaluate(() => {
      return document.getElementById('r-composite').textContent;
    });
    expect(composite).not.toBe('--');
    expect(parseFloat(composite)).toBeGreaterThan(0);

    const hicks = await page.evaluate(() => {
      return document.getElementById('r-hicks').textContent;
    });
    expect(hicks).not.toBe('--');

    const duration = await page.evaluate(() => {
      return document.getElementById('r-duration').textContent;
    });
    expect(duration).toMatch(/\d+s/);

    // GA4 comparison should show engagement time
    const ga4Time = await page.evaluate(() => {
      return document.getElementById('r-ga4-time').textContent;
    });
    expect(ga4Time).toMatch(/\d+s/);

    console.log('\n  === DEMO E2E RESULTS ===');
    console.log('  Composite:', composite);
    console.log('  Hick\'s:', hicks);
    console.log('  Duration:', duration);
    console.log('  GA4 Time:', ga4Time);
    console.log('  =========================\n');

    await page.close();
  }, 45000);

  test('gallery page loads with data', async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/gallery.html`, { waitUntil: 'networkidle0' });
    await wait(2000);

    // Check that verticals rendered
    const cardCount = await page.evaluate(() => {
      return document.querySelectorAll('.vertical-card').length;
    });
    expect(cardCount).toBeGreaterThanOrEqual(7);

    // Check run status shows
    const status = await page.evaluate(() => {
      return document.getElementById('run-status').textContent;
    });
    expect(status).toMatch(/\d+\/\d+ Verticals Passed/);

    console.log('  Gallery: ' + cardCount + ' verticals rendered, status: ' + status);

    await page.close();
  }, 15000);

  test('compliance report page loads', async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/compliance-report.html`, { waitUntil: 'networkidle0' });
    await wait(500);

    const title = await page.evaluate(() => {
      return document.querySelector('.letterhead h1').textContent;
    });
    expect(title).toContain('COMPLIANCE REPORT');

    await page.close();
  }, 10000);

  test('landing page loads with links', async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle0' });
    await wait(500);

    const h1 = await page.evaluate(() => {
      return document.querySelector('.hero h1').textContent;
    });
    expect(h1).toContain('Proof of Attention');

    // Check demo link exists
    const demoLink = await page.evaluate(() => {
      return document.querySelector('a[href="demo.html"]') !== null;
    });
    expect(demoLink).toBe(true);

    await page.close();
  }, 10000);
});
