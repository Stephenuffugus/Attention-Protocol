const puppeteer = require('puppeteer');
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
  await page.goto('https://sws-attention-proofs.web.app/cme-demo.html', { waitUntil: 'networkidle2', timeout: 30000 });
  await wait(2000);

  // Click through 4 sections with brief dwell each
  for (let s = 1; s <= 4; s++) {
    await wait(1200);
    await page.evaluate((sn) => {
      const btns = document.querySelectorAll('#section-' + sn + ' .btn-primary');
      if (btns[0]) btns[0].click();
    }, s);
    await wait(400);
  }

  // Answer all 3 quiz questions (pick first option each — intentionally wrong)
  await wait(800);
  await page.evaluate(() => {
    [0, 1, 2].forEach(q => {
      const opts = document.querySelectorAll('.opt[data-q="' + q + '"]');
      if (opts[0]) opts[0].click();
    });
  });
  await wait(400);

  // Type reflection
  await page.type('#reflection', 'I will update my clinical practice by adopting home blood pressure monitoring before initiating therapy for any newly diagnosed Stage 1 hypertension case and reinforcing adherence counseling at every visit.', { delay: 60 });
  await wait(400);

  // Submit
  await page.evaluate(() => { document.getElementById('submit-btn').click(); });
  await wait(3000);

  const result = await page.evaluate(() => {
    const tierEl = document.getElementById('tier-pill');
    const compEl = document.getElementById('composite-big');
    const narrEl = document.getElementById('narr-content');
    return {
      tier: tierEl ? tierEl.textContent : null,
      composite: compEl ? compEl.textContent : null,
      narrativeLength: narrEl ? narrEl.innerHTML.length : 0,
      hashBoxShown: !!document.getElementById('hash-box'),
    };
  });
  console.log('tier     :', result.tier);
  console.log('composite:', result.composite);
  console.log('narrative chars:', result.narrativeLength);
  console.log('hash box visible:', result.hashBoxShown);
  if (errors.length) {
    console.log('\n✗ Console/page errors:');
    errors.forEach(e => console.log('  ' + e));
  } else {
    console.log('\n✓ No console errors');
  }
  await browser.close();
})();
