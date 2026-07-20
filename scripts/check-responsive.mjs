import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'http://localhost:4322/iu_theory_website';
const OUT = process.argv[2];

const PAGES = [
  ['home', '/'],
  ['people', '/people/'],
  ['bio', '/people/mayhall/'],
  ['bio-rag', '/people/raghavachari/'],
  ['research', '/research/'],
  ['pubs', '/publications/'],
  ['history', '/history/'],
  ['join', '/join/'],
];
const WIDTHS = [320, 375, 390, 414, 768, 1024];

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
let problems = 0;
const tapIssues = new Set();
const brokenImages = new Set();

for (const width of WIDTHS) {
  const results = [];
  for (const [name, path] of PAGES) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 844, deviceScaleFactor: 1, isMobile: width < 768 });
    await page.goto(BASE + path, { waitUntil: 'networkidle0' });

    const r = await page.evaluate(() => {
      const de = document.documentElement;
      const vw = de.clientWidth;
      const offenders = [];
      for (const el of document.querySelectorAll('body *')) {
        const b = el.getBoundingClientRect();
        if (b.width === 0 && b.height === 0) continue;
        if (b.right > vw + 1) {
          offenders.push(
            `${el.tagName.toLowerCase()}.${String(el.className || '').split(' ')[0]}` +
              ` (w=${Math.round(b.width)} right=${Math.round(b.right)})`,
          );
        }
      }
      // Tap targets. Measure the EFFECTIVE hit area, not the element box: a link may
      // legitimately expand its touch area with an ::after overlay (nav links) or a
      // stretched-link overlay covering a card. Probe upward and downward from the
      // element's center with elementFromPoint and see how far the link still responds.
      const small = [];
      for (const el of document.querySelectorAll('a, button')) {
        if (el.getBoundingClientRect().height === 0) continue;
        // elementFromPoint only hit-tests inside the viewport, so anything below the
        // fold would falsely report no expansion. Bring it into view first.
        el.scrollIntoView({ block: 'center' });
        const b = el.getBoundingClientRect();
        const cx = Math.min(Math.max(b.left + b.width / 2, 1), vw - 1);
        const hits = (y) => {
          if (y < 0 || y > window.innerHeight) return false;
          const hit = document.elementFromPoint(cx, y);
          return !!hit && (hit === el || el.contains(hit) || hit.contains(el));
        };
        let top = b.top;
        let bottom = b.bottom;
        for (let i = 1; i <= 24 && hits(top - 1); i++) top -= 1;
        for (let i = 1; i <= 24 && hits(bottom + 1); i++) bottom += 1;
        const effective = bottom - top;
        if (effective < 32) {
          small.push(
            `${el.textContent.trim().slice(0, 24)} (box ${Math.round(b.height)}px, effective ${Math.round(effective)}px)`,
          );
        }
      }
      // A malformed SVG still builds and still returns HTTP 200 — it only fails at
      // decode time, showing as a broken image. naturalWidth catches that.
      //
      // "Broken" = the load FINISHED and produced no pixels (complete && naturalWidth
      // 0). A lazy below-the-fold image that hasn't started loading has complete ===
      // false and is correctly excluded — that is not-yet-loaded, not broken.
      //
      // Do NOT filter by display: the light/dark logo variants are BOTH in the DOM and
      // both load regardless of visibility, and the headless browser only renders one
      // colour scheme at a time. Filtering out display:none would skip the hidden
      // variant, so a broken logo in the non-active theme would go undetected.
      const brokenImages = [...document.querySelectorAll('img')]
        .filter((el) => el.complete && el.naturalWidth === 0)
        .map((el) => el.currentSrc.split('/').pop() || el.getAttribute('src'));

      return { vw, scrollW: de.scrollWidth, offenders: offenders.slice(0, 4), small, brokenImages };
    });

    const over = r.scrollW - r.vw;
    if (over > 0) problems++;
    if (width <= 414) r.small.forEach((s) => tapIssues.add(s));
    if (r.brokenImages.length) {
      problems++;
      r.brokenImages.forEach((b) => brokenImages.add(`${name}: ${b}`));
    }
    results.push(
      `  ${name.padEnd(9)} scrollW=${String(r.scrollW).padEnd(5)} ` +
        (over > 0 ? `OVERFLOW +${over}px :: ${r.offenders.join(', ')}` : 'ok') +
        (r.brokenImages.length ? `  BROKEN IMAGE: ${r.brokenImages.join(', ')}` : ''),
    );
    await page.close();
  }
  console.log(`\n--- ${width}px ---\n${results.join('\n')}`);
}

if (OUT) {
  for (const [name, path] of [
    ['home', '/'],
    ['people', '/people/'],
    ['bio', '/people/mayhall/'],
    ['history', '/history/'],
  ]) {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 2, isMobile: true });
    await page.goto(BASE + path, { waitUntil: 'networkidle0' });
    await page.screenshot({ path: `${OUT}/fold_${name}.png` }); // viewport-only = top of page
    await page.close();
  }
}

console.log(
  `\n${problems === 0 ? 'PASS: no horizontal overflow, no broken images' : `FAIL: ${problems} problem(s)`}`,
);
if (brokenImages.size) {
  console.log('\nBroken images:');
  [...brokenImages].forEach((b) => console.log(`  ${b}`));
}
if (tapIssues.size) {
  console.log(`\nSmall tap targets (<32px tall) at mobile widths:`);
  [...tapIssues].slice(0, 12).forEach((t) => console.log(`  ${t}`));
}

await browser.close();
