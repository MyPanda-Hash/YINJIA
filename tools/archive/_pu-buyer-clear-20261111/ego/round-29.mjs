// round-29: 8090(新 jar) 英文复验按钮文案 + 切回中文
const task = await taskSpace(3);
const page = task.page('p1');
await page.goto('http://127.0.0.1:8090/#/panelx/list/PU_ORDER', { timeout: 40000 });
await page.waitForTimeout(5000);

const langNow = await page.evaluate(() => {
  const el = [...document.querySelectorAll('span,div,button')].find((e) => ['中', 'EN'].includes((e.textContent || '').trim()) && e.getBoundingClientRect().width < 40);
  return el ? (el.textContent || '').trim() : null;
});
console.log('lang button:', langNow);

async function pickLang(label) {
  const pos = await page.evaluate(() => {
    const el = [...document.querySelectorAll('span,div,button')].find((e) => ['中', 'EN'].includes((e.textContent || '').trim()) && e.getBoundingClientRect().width < 40);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
  });
  if (!pos) return 'no-btn';
  await page.mouse.click(pos.x, pos.y, { label: '打开语言菜单' });
  await page.waitForTimeout(900);
  const picked = await page.evaluate((want) => {
    const item = [...document.querySelectorAll('li, .el-dropdown-menu__item')].find((e) => (e.textContent || '').includes(want));
    if (!item) return 'no-item';
    item.click();
    return (item.textContent || '').trim();
  }, label);
  await page.waitForTimeout(2500);
  return picked;
}

if (langNow !== 'EN') console.log('switch EN:', await pickLang('English'));
else console.log('already EN');

await page.dblclick('tbody tr:has-text("PO-2026-11-0012")', { label: '打开采购订单' });
await page.waitForTimeout(4500);
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.tb-main')].find((e) => /Print/i.test((e.textContent || '').trim()));
  if (el) el.click();
});
await page.waitForTimeout(5000);
const en = await page.evaluate(() => ({
  open: !!document.querySelector('.pup'),
  row: (document.querySelector('.pup-buyer')?.innerText || '').replace(/\s+/g, ' ').trim(),
  buttons: [...document.querySelectorAll('.pup-buyer button')].map((b) => (b.textContent || '').trim()),
}));
console.log('EN row:', JSON.stringify(en, null, 2));
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) { console.log('restore skip: ' + e.message); }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/pu-buyer-clear-20261111/round-29-8090-en.png' });

// 收尾:切回中文,并关掉弹窗(把界面还给用户时是中文)
await page.evaluate(() => {
  const close = document.querySelector('.el-dialog__headerbtn');
  if (close) close.click();
});
await page.waitForTimeout(1200);
console.log('switch back zh:', await pickLang('简体中文'));
const back = await page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 60));
console.log('header now:', back);
await page.screenshot({ path: 'C:/Users/Lenovo/ego/pu-buyer-clear-20261111/round-29-8090-zh.png' });
