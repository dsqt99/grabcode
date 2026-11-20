// HON-35: Màn A/C interactions at 390x844 (sheets, copy, report). Non-destructive except "report" on GC-1005.
import { chromium } from 'playwright';
const B = 'http://localhost:3510', out = process.env.OUT ?? '/tmp/uxr-shots';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'vi-VN' });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: B });
const lr = await fetch('http://localhost:4000/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'khach@staging.grabcode.test', password: 'demo-pass-123' }) });
const c = lr.headers.get('set-cookie').split(';')[0]; const i = c.indexOf('=');
await ctx.addCookies([{ name: c.slice(0, i), value: c.slice(i + 1), domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' }]);
const page = await ctx.newPage();
const go = async (p) => { await page.goto(B + p, { waitUntil: 'networkidle' }); await page.waitForTimeout(2000); };
const focusInfo = () => page.evaluate(() => { const a = document.activeElement; return a ? `${a.tagName} "${(a.textContent || a.getAttribute('aria-label') || '').trim().slice(0, 40)}"` : null; });
const shot = (n) => page.screenshot({ path: `${out}/${n}.png` });

// Màn A: payment panel scrolled into view, copy states, report
await go('/order/GC-1005');
await page.getByText('Số tiền cần chuyển').scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, -80));
await shot('A-amount-qr');
await page.getByRole('button', { name: 'Sao chép số tiền' }).click();
await page.waitForTimeout(200);
console.log('copy amount ->', await page.evaluate(() => navigator.clipboard.readText()), '| label', await page.getByRole('button', { name: 'Sao chép số tiền' }).innerText());
await page.getByRole('button', { name: 'Sao chép số tài khoản' }).click(); await page.waitForTimeout(200);
console.log('copy stk ->', await page.evaluate(() => navigator.clipboard.readText()));
await page.getByRole('button', { name: 'Sao chép nội dung chuyển khoản' }).click(); await page.waitForTimeout(200);
console.log('copy content ->', await page.evaluate(() => navigator.clipboard.readText()));
await page.getByText('Hoặc chuyển khoản tay').scrollIntoViewIfNeeded();
await shot('A-manual');
const qr = await page.locator('img[alt^="Mã VietQR"]').boundingBox();
console.log('QR box', JSON.stringify(qr));
await page.getByRole('button', { name: 'Tôi đã chuyển khoản' }).click();
await page.waitForTimeout(1500);
await shot('A-reported');
console.log('reported text', await page.getByText('Đã báo, chờ đối soát').count());

// Màn C1: approve milestone
await go('/order/GC-1003');
const opener = page.getByRole('button', { name: 'Xem & duyệt M1' });
await opener.click(); await page.waitForTimeout(500);
console.log('C1 focus on open', await focusInfo());
await shot('C1-approve');
const confirm = page.locator('dialog button').last();
console.log('C1 confirm disabled before tick', await confirm.isDisabled(), await confirm.innerText());
await page.locator('dialog input[type=checkbox]').check();
console.log('C1 confirm disabled after tick', await confirm.isDisabled());
await shot('C1-approve-ticked');
const tabs = []; for (let k = 0; k < 8; k++) { await page.keyboard.press('Tab'); tabs.push(await focusInfo()); }
console.log('C1 tab order', tabs.join(' > '));
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
console.log('C1 after Esc open?', await page.locator('dialog[open]').count(), 'focus', await focusInfo());
// C2 reject (from milestone card)
await page.getByRole('button', { name: 'Yêu cầu sửa' }).first().click(); await page.waitForTimeout(400);
await shot('C2-reject');
await page.locator('dialog textarea').fill('Sửa giúp');
console.log('C2 confirm disabled at 8 chars', await page.locator('dialog button').last().isDisabled());
await page.keyboard.press('Escape');
// C4 dispute
await page.getByRole('button', { name: 'Mở tranh chấp' }).first().click(); await page.waitForTimeout(400);
await shot('C4-dispute');
await page.keyboard.press('Escape');

// C3 accept + revise on DELIVERED
await go('/order/GC-1002');
await shot('B-delivered');
await page.getByRole('button', { name: 'Nghiệm thu đơn' }).click(); await page.waitForTimeout(400);
await shot('C3-accept');
console.log('C3 confirm label', await page.locator('dialog button').last().innerText());
await page.keyboard.press('Escape');
await page.getByRole('button', { name: 'Yêu cầu sửa' }).first().click(); await page.waitForTimeout(400);
await shot('C2-revise-order');
await page.keyboard.press('Escape');

// C5 repo on ACCEPTED (if offered)
await go('/order/GC-1001');
await shot('B-accepted');
console.log('repo claim offered', await page.getByRole('button', { name: /Nhận repo/ }).count());
await go('/order/GC-1004'); await shot('B-funded');
await go('/order/GC-1006'); await shot('B-draft-unquoted');
await go('/order/KHONG-CO'); await shot('B-404');
await browser.close();
