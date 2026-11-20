// Screenshots + checks for HON-52. Usage: node /tmp/shot.cjs <outDir> [filter]
const { chromium } = require('/paperclip/mcp-playwright/node_modules/playwright-core');
const fs = require('fs');
const AXE = fs.readFileSync('/app/node_modules/.pnpm/axe-core@4.13.0/node_modules/axe-core/axe.min.js', 'utf8');
const OUT = process.argv[2];
const FILTER = process.argv[3];
const WEB = 'http://localhost:3000';
const API = 'http://localhost:4010';

const S = [
  { name: '01-trang-chu', path: '/' },
  { name: '02-dang-nhap', path: '/login', anon: true },
  { name: '03-dat-don', path: '/order/new?item=BOOKING&prompt=' + encodeURIComponent('Dựng web đặt phòng homestay có thanh toán VietQR'), wait: 'Đặc tả đã soạn' },
  { name: '04-don-cua-toi', path: '/orders' },
  { name: '10-cho-bao-gia-GC-2001', path: '/order/GC-2001', wait: 'Tiếp theo' },
  { name: '11-vietqr-GC-2002', path: '/order/GC-2002', wait: 'Cách 2' },
  { name: '12-tim-coder-GC-2003', path: '/order/GC-2003' },
  { name: '13-moc-cho-duyet-GC-2004', path: '/order/GC-2004' },
  { name: '14-dang-lam-GC-2005', path: '/order/GC-2005' },
  { name: '15-da-ban-giao-GC-2006', path: '/order/GC-2006' },
  { name: '16-hoan-tat-GC-2007', path: '/order/GC-2007' },
  { name: '17-tranh-chap-GC-2008', path: '/order/GC-2008' },
  { name: '18-da-xu-ly-GC-2009', path: '/order/GC-2009' },
  { name: '19-da-huy-GC-2010', path: '/order/GC-2010' },
  { name: '20-moc-cuoi-qa-loi-GC-2011', path: '/order/GC-2011' },
  { name: '30-sheet-duyet-moc-GC-2004', path: '/order/GC-2004', click: /Duyệt & trả/ },
  { name: '31-sheet-yeu-cau-sua-moc-GC-2004', path: '/order/GC-2004', click: /^Yêu cầu sửa$/ },
  { name: '32-sheet-nghiem-thu-GC-2006', path: '/order/GC-2006', click: /^Nghiệm thu đơn$/ },
  { name: '33-sheet-yeu-cau-sua-don-GC-2006', path: '/order/GC-2006', click: /^Yêu cầu sửa$/ },
  { name: '34-sheet-tranh-chap-GC-2004', path: '/order/GC-2004', click: /^Mở tranh chấp$/ },
  { name: '35-sheet-nhan-repo-GC-2007', path: '/order/GC-2007', click: /Nhận repo/ },
  { name: '36-sheet-duyet-moc-cuoi-GC-2011', path: '/order/GC-2011', click: /Duyệt mốc cuối/, force: true },
  { name: '40-ho-so', path: '/profile' },
  { name: '41-dieu-khoan', path: '/dieu-khoan' },
];

(async () => {
  const browser = await chromium.launch({ executablePath: '/paperclip/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell', env: { ...process.env, LD_LIBRARY_PATH: '/tmp/chromeroot/usr/lib/x86_64-linux-gnu', FONTCONFIG_FILE: '/tmp/fonts.conf' } });
  const report = [];
  for (const vp of [{ w: 390, h: 844, tag: '390', mobile: true }, { w: 1280, h: 800, tag: '1280', mobile: false }]) {
    for (const s of S.filter((s) => !FILTER || s.name.includes(FILTER))) {
      await fetch(`${API}/__anon?on=${s.anon ? 1 : 0}`, { method: 'POST' });
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: vp.mobile, hasTouch: vp.mobile, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(WEB + s.path, { waitUntil: 'networkidle' });
      if (s.wait) await page.getByText(s.wait).first().waitFor({ timeout: 15000 }).catch(() => errors.push('wait timeout ' + s.wait));
      await page.waitForTimeout(800);
      await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
      if (s.click) {
        const btn = page.getByRole('button', { name: s.click }).filter({ visible: true }).first();
        await btn.click({ force: !!s.force, timeout: 5000 }).catch((e) => errors.push('click ' + e.message.split('\n')[0]));
        await page.waitForTimeout(500);
      }
      const file = `${OUT}/${s.name}-${vp.tag}`;
      await page.screenshot({ path: `${file}.png` });
      if (!s.click) await page.screenshot({ path: `${file}-full.png`, fullPage: true });
      await page.addScriptTag({ content: AXE });
      const m = await page.evaluate(async (vw) => {
        const r = await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] });
        const small = [];
        for (const el of document.querySelectorAll('a[href],button,input,select,textarea,summary,[role=tab]')) {
          const b = el.getBoundingClientRect();
          if (!b.width || !b.height || getComputedStyle(el).visibility === 'hidden') continue;
          if (el.type === 'checkbox' || el.type === 'radio') continue; // the whole label row is the target
          const inText = el.tagName === 'A' && el.closest('p,li') && el.parentElement.textContent.trim().length > el.textContent.trim().length + 2;
          if ((b.height < 44 || b.width < 44) && !inText) small.push(`${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent).trim().slice(0, 40)}" ${Math.round(b.width)}x${Math.round(b.height)}`);
        }
        const bodyText = document.body.innerText;
        return {
          scrollX: document.documentElement.scrollWidth > vw || window.innerWidth > vw,
          violations: r.violations.map((v) => `${v.id}(${v.nodes.length}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`),
          small: [...new Set(small)],
          banned: /cuốc|tài xế|shipper|delivery_dining|restaurant_menu/i.test(bodyText),
          height: document.documentElement.scrollHeight,
        };
      }, vp.w);
      report.push({ name: s.name, vp: vp.tag, errors, ...m });
      console.log(vp.tag, s.name, m.scrollX ? 'SCROLLX' : '', m.violations.length ? m.violations : '', errors.length ? errors : '', m.banned ? 'BANNED' : '');
      await ctx.close();
    }
  }
  fs.writeFileSync(`${OUT}/../checks${FILTER ? '-' + FILTER : ''}.json`, JSON.stringify(report, null, 1));
  await browser.close();
})();
