const puppeteer = require('puppeteer');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.goto('https://sws-attention-proofs.web.app/cme-demo.html', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(3000);

  // Dwell on each section for ~10s (simulates careful reading)
  for (let s = 1; s <= 4; s++) {
    await wait(10000);
    // Simulate some mouse activity during reading
    for (let i = 0; i < 8; i++) {
      await page.mouse.move(400 + i * 40, 300 + i * 15);
      await wait(150);
    }
    await page.evaluate((sn) => {
      const btns = document.querySelectorAll('#section-' + sn + ' .btn-primary');
      if (btns[0]) btns[0].click();
    }, s);
    await wait(500);
  }

  // Thoughtful delay before each question, correct answers
  const correctAnswers = ['thiazide', 'acei', '50'];
  for (let q = 0; q < 3; q++) {
    await wait(3500 + Math.random() * 1500);
    await page.evaluate((qi, ans) => {
      const opts = document.querySelectorAll('.opt[data-q="' + qi + '"]');
      for (const o of opts) { if (o.dataset.ans === ans) { o.click(); return; } }
    }, q, correctAnswers[q]);
    await wait(600);
  }

  // Realistic reflection typing — with natural timing variance
  await page.focus('#reflection');
  await page.type('#reflection',
    'I will ask every newly diagnosed Stage 1 hypertension patient to confirm their reading via a one-week home blood pressure log before starting therapy, and I will schedule a 90-day adherence call for everyone I start on a new regimen this quarter.',
    { delay: 85 + Math.random() * 40 });
  await wait(800);

  await page.evaluate(() => { document.getElementById('submit-btn').click(); });
  await wait(3000);

  const result = await page.evaluate(() => {
    const tierEl = document.getElementById('tier-pill');
    const compEl = document.getElementById('composite-big');
    const narrEl = document.getElementById('narr-content');
    const narrP = narrEl ? narrEl.querySelectorAll('p').length : 0;
    return {
      tier: tierEl ? tierEl.textContent : null,
      composite: compEl ? compEl.textContent : null,
      narrativeParagraphs: narrP
    };
  });
  console.log('tier     :', result.tier);
  console.log('composite:', result.composite);
  console.log('narrative paragraphs:', result.narrativeParagraphs);
  await browser.close();
})();
