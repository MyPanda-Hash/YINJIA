// round-26: 切英文走查新增文案(需方联系人这一排),再切回中文
const task = await taskSpace(3);
const page = task.page('p1');
const state = await page.evaluate(() => ({ open: !!document.querySelector('.pup'), hash: location.hash }));
console.log('state:', JSON.stringify(state));

// 打开语言菜单(头部「中」)
const langBtn = await page.evaluate(() => {
  const el = [...document.querySelectorAll('span,div,button')].find((e) => (e.textContent || '').trim() === '中' && e.getBoundingClientRect().width < 40);
  if (!el) return 'no-el';
  const b = el.getBoundingClientRect();
  return { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
});
console.log('lang btn:', JSON.stringify(langBtn));
if (langBtn !== 'no-el') {
  await page.mouse.click(langBtn.x, langBtn.y, { label: '打开语言菜单' });
  await page.waitForTimeout(900);
  const picked = await page.evaluate(() => {
    const item = [...document.querySelectorAll('li, .el-dropdown-menu__item')].find((e) => /English/.test(e.textContent || ''));
    if (!item) return 'no-item';
    item.click();
    return (item.textContent || '').trim();
  });
  console.log('picked:', picked);
  await page.waitForTimeout(2500);
}

// 重开弹窗看英文
await page.evaluate(() => {
  const close = document.querySelector('.el-dialog__headerbtn');
  if (close) close.click();
});
await page.waitForTimeout(1200);
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.tb-main')].find((e) => (e.textContent || '').trim() === 'Print' || (e.textContent || '').trim() === '打印');
  if (el) el.click();
});
await page.waitForTimeout(5000);
const en = await page.evaluate(() => {
  const row = document.querySelector('.pup-buyer');
  return {
    dialogOpen: !!document.querySelector('.pup'),
    row: row ? (row.innerText || '').replace(/\s+/g, ' ').trim() : null,
    buttons: [...document.querySelectorAll('.pup-buyer button')].map((b) => (b.textContent || '').trim()),
  };
});
console.log('EN row:', JSON.stringify(en, null, 2));
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) { console.log('restore skip: ' + e.message); }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/pu-buyer-clear-20261111/round-26-en.png' });
