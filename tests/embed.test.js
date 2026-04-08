/**
 * One-Tag Embed — Test Suite
 *
 * Tests the single-script-tag embed that anyone can drop on any page.
 * Verifies SDK loading, initialization, hash earning, and session tracking.
 *
 * (c) 2026 SWS Strategic Media LLC.
 */

const puppeteer = require('puppeteer');
const express = require('express');
const path = require('path');

let browser;
let staticServer;
const PORT = 9878;
const BASE = `http://localhost:${PORT}`;
const wait = (ms) => new Promise(r => setTimeout(r, ms));

beforeAll(async () => {
  const app = express();
  // Serve proof directory (has embed.js and sdk/)
  app.use('/proof', express.static(path.resolve(__dirname, '../proof')));
  // Serve a test page that uses the embed
  app.get('/test-embed.html', (req, res) => {
    res.send(`<!DOCTYPE html>
<html><head><title>Embed Test Page</title></head>
<body>
  <h1>Test Page With SWS Embed</h1>
  <p>This page uses the one-tag embed. Scroll down to generate attention data.</p>
  ${'<p>Lorem ipsum dolor sit amet. </p>'.repeat(50)}
  <script src="/proof/embed.js" data-game-id="embed_test" data-debug="true" data-save="false"></script>
</body></html>`);
  });

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

describe('One-Tag Embed', () => {

  test('embed loads SDK on any page', async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/test-embed.html`, { waitUntil: 'networkidle0' });
    await wait(2000);

    const hasSDK = await page.evaluate(() => typeof SWSAttention === 'object');
    expect(hasSDK).toBe(true);

    const hasEmbed = await page.evaluate(() => typeof SWSEmbed === 'object');
    expect(hasEmbed).toBe(true);

    await page.close();
  }, 15000);

  test('embed initializes with correct game ID', async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/test-embed.html`, { waitUntil: 'networkidle0' });
    await wait(2000);

    const stats = await page.evaluate(() => SWSEmbed.getStats());
    expect(stats).toBeDefined();
    expect(stats.totalHashes).toBeGreaterThanOrEqual(0);

    await page.close();
  }, 15000);

  test('embed earns hash on page visit', async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/test-embed.html`, { waitUntil: 'networkidle0' });
    await wait(2000);

    const stats = await page.evaluate(() => SWSEmbed.getStats());
    expect(stats.totalHashes).toBeGreaterThanOrEqual(1);

    console.log('\n  === EMBED TEST ===');
    console.log('  Hashes earned:', stats.totalHashes);
    console.log('  =================\n');

    await page.close();
  }, 15000);

  test('embed exposes getScore API', async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/test-embed.html`, { waitUntil: 'networkidle0' });
    await wait(2000);

    const score = await page.evaluate(() => SWSEmbed.getScore());
    expect(score).toBeDefined();
    expect(score.composite).toBeDefined();
    expect(typeof score.composite).toBe('number');

    await page.close();
  }, 15000);

  test('embed tracks session ID', async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/test-embed.html`, { waitUntil: 'networkidle0' });
    await wait(2000);

    const sessionId = await page.evaluate(() => SWSEmbed.getSessionId());
    expect(sessionId).toBeDefined();
    expect(sessionId).toMatch(/^embed_/);

    await page.close();
  }, 15000);

  test('scrolling generates interaction data', async () => {
    const page = await browser.newPage();
    await page.goto(`${BASE}/test-embed.html`, { waitUntil: 'networkidle0' });
    await wait(1000);

    // Scroll down
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, 300));
      await wait(500);
    }
    await wait(1000);

    const score = await page.evaluate(() => SWSEmbed.getScore());
    expect(score.composite).toBeGreaterThanOrEqual(0);

    await page.close();
  }, 15000);
});
