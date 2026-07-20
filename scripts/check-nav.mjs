import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'http://localhost:4322/iu_theory_website';

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
let fail = 0;
// Recorded from the desktop pass and reused as the expected count in the no-JS pass.
let navLinkCount = 0;
const check = (label, cond, detail = '') => {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!cond) fail++;
};

const visible = (page, sel) =>
  page.$eval(sel, (el) => {
    const s = getComputedStyle(el);
    const b = el.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && b.height > 0;
  });

// ---------- mobile ----------
console.log('\n[390px — mobile]');
{
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });

  check('hamburger button visible', await visible(page, '.nav-toggle'));
  check('nav hidden initially', !(await visible(page, '#site-nav')));
  check(
    'aria-expanded=false initially',
    (await page.$eval('.nav-toggle', (el) => el.getAttribute('aria-expanded'))) === 'false',
  );

  const btn = await page.$('.nav-toggle');
  const box = await btn.boundingBox();
  check('button hit area >=44px', box.width >= 44 && box.height >= 44, `${Math.round(box.width)}x${Math.round(box.height)}`);

  await btn.click();
  check('nav visible after click', await visible(page, '#site-nav'));
  check(
    'aria-expanded=true after click',
    (await page.$eval('.nav-toggle', (el) => el.getAttribute('aria-expanded'))) === 'true',
  );

  const linkH = await page.$$eval('#site-nav a', (els) =>
    els.map((e) => Math.round(e.getBoundingClientRect().height)),
  );
  check('open nav links >=44px tall', Math.min(...linkH) >= 44, `min ${Math.min(...linkH)}px`);

  const noOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth === document.documentElement.clientWidth,
  );
  check('no horizontal overflow with menu open', noOverflow);

  await page.keyboard.press('Escape');
  check('Escape closes nav', !(await visible(page, '#site-nav')));
  check(
    'focus returns to button after Escape',
    await page.evaluate(() => document.activeElement?.classList.contains('nav-toggle')),
  );

  await btn.click();
  await page.mouse.click(200, 700); // tap page body, outside the header
  check('outside click closes nav', !(await visible(page, '#site-nav')));

  // Keyboard operability
  await page.evaluate(() => document.querySelector('.nav-toggle').focus());
  await page.keyboard.press('Enter');
  check('Enter key opens nav', await visible(page, '#site-nav'));

  await page.close();
}

// ---------- desktop ----------
console.log('\n[1024px — desktop]');
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 800 });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
  check('hamburger hidden', !(await visible(page, '.nav-toggle')));
  check('nav visible inline', await visible(page, '#site-nav'));
  const { rows, count } = await page.$$eval('#site-nav a', (els) => ({
    rows: new Set(els.map((e) => Math.round(e.getBoundingClientRect().top))).size,
    count: els.length,
  }));
  navLinkCount = count;
  check('nav renders on one row', rows === 1, `${rows} row(s), ${count} links`);
  await page.close();
}

// ---------- resize with menu open ----------
console.log('\n[resize 390 -> 1024 while open]');
{
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
  await page.click('.nav-toggle');
  await page.setViewport({ width: 1024, height: 800 });
  check('nav visible after growing to desktop', await visible(page, '#site-nav'));
  check(
    'aria-expanded reset to false',
    (await page.$eval('.nav-toggle', (el) => el.getAttribute('aria-expanded'))) === 'false',
  );
  await page.close();
}

// ---------- no-JS fallback ----------
console.log('\n[390px — JavaScript disabled]');
{
  const page = await browser.newPage();
  await page.setJavaScriptEnabled(false);
  await page.setViewport({ width: 390, height: 844, isMobile: true });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
  check('nav still reachable without JS', await visible(page, '#site-nav'));
  const n = await page.$$eval('#site-nav a', (els) => els.length);
  // Compare against the JS-enabled count rather than a hardcoded number, so adding a
  // nav item doesn't fail this check spuriously.
  check('all nav links present without JS', n === navLinkCount, `${n} of ${navLinkCount}`);
  await page.close();
}

console.log(`\n${fail === 0 ? 'ALL NAV CHECKS PASSED' : `${fail} CHECK(S) FAILED`}`);
await browser.close();
process.exit(fail === 0 ? 0 : 1);
