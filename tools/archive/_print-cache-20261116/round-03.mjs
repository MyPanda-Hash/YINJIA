// round-03:面板「打印缓存」卡片 —— 有 1 条待补打时截图,并点一次「补打」验证反馈
const shot = 'C:/Users/Lenovo/ego/print-cache-offline-20261116';
const task = await taskSpace('print-cache-offline-20261116');
const page = task.page('p1');

await page.goto('http://127.0.0.1:8091/#/sys/printStation', { timeout: 30000 });
await page.waitForTimeout(6000);

try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(400);
} catch (e) { console.log('restore skip: ' + e.message); }

const before = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  const card = [...document.querySelectorAll('.ps-card')].find((c) => txt(c).includes('打印缓存'));
  return {
    cardText: txt(card),
    rows: [...(card ? card.querySelectorAll('.ps-cache') : [])].map((r) => txt(r)),
    selects: [...document.querySelectorAll('.el-select')].map((s) => txt(s)).slice(0, 8),
  };
});
console.log(JSON.stringify(before, null, 2));

await page.screenshot({ path: shot + '/round-03-cache-with-item.png', fullPage: true });
console.log('screenshot -> round-03-cache-with-item.png');

// 点「补打」(可回退:只是把 delivered 清空,再排一次队)
const clicked = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  const card = [...document.querySelectorAll('.ps-card')].find((c) => txt(c).includes('打印缓存'));
  const btn = [...(card ? card.querySelectorAll('button') : [])].find((b) => txt(b) === '补打');
  if (!btn) return false;
  btn.click();
  return true;
});
console.log('clicked 补打: ' + clicked);
await page.waitForTimeout(2500);

const after = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  const card = [...document.querySelectorAll('.ps-card')].find((c) => txt(c).includes('打印缓存'));
  return {
    toast: txt(document.querySelector('.el-message')),
    cardText: txt(card).slice(0, 160),
    rows: [...(card ? card.querySelectorAll('.ps-cache') : [])].length,
  };
});
console.log(JSON.stringify(after, null, 2));
await page.screenshot({ path: shot + '/round-03-after-retry.png', fullPage: true });
console.log('screenshot -> round-03-after-retry.png');
