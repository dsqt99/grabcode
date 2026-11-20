// HON-35 UX review: screenshots 390x844 + axe + overflow + tap targets. Usage: node uxr-shots.mjs <outdir> <path>...
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
const B = process.env.B ?? 'http://localhost:3510';
const [out, ...paths] = process.argv.slice(2);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'vi-VN' });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
const lr = await fetch('http://localhost:4000/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: process.env.EMAIL ?? 'khach@staging.grabcode.test', password: 'demo-pass-123' }) });
const [nv] = lr.headers.get('set-cookie').split(';')[0].split(/=(.*)/s);
await ctx.addCookies([{ name: nv, value: lr.headers.get('set-cookie').split(';')[0].slice(nv.length + 1), domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
for (const p of paths) {
  await page.goto(B + p, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const name = p.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home';
  await page.screenshot({ path: `${out}/${name}.png` });
  await page.screenshot({ path: `${out}/${name}-full.png`, fullPage: true });
  const m = await page.evaluate(() => {
    const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
    const small = [...document.querySelectorAll('a[href],button,[role=tab],input[type=checkbox],summary')].filter(vis).map((e) => { const r = e.getBoundingClientRect(); return { t: (e.textContent || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) }; }).filter((r) => r.h < 44 || r.w < 44);
    const cta = document.querySelector('[data-sticky-bar] button, [data-sticky-bar] p');
    const cr = cta?.getBoundingClientRect();
    return { scroll: [document.documentElement.scrollWidth, document.documentElement.clientWidth], small, cta: cr ? Math.round(cr.bottom) : null, h: document.documentElement.scrollHeight };
  });
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const contrast = axe.violations.filter((v) => v.id === 'color-contrast').flatMap((v) => v.nodes.map((n) => n.target.join(' ') + ' :: ' + (n.any[0]?.data ? `${n.any[0].data.fgColor}/${n.any[0].data.bgColor} ${n.any[0].data.contrastRatio}` : '')));
  console.log(JSON.stringify({ p, scroll: m.scroll.join('/'), pageH: m.h, ctaBottom: m.cta, contrastN: contrast.length, contrast, other: axe.violations.filter((v) => v.id !== 'color-contrast').map((v) => `${v.id}(${v.nodes.length})`), smallTaps: m.small }));
}
console.log('pageerrors', errs.join(' || '));
await browser.close();
