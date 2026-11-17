// round-06:静态产物替换后再开一次,确认页面正常、缓存卡片仍在(中文)
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

const info = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  const cards = [...document.querySelectorAll('.ps-card')];
  const card = cards.find((c) => txt(c).includes('打印缓存'));
  if (card) card.scrollIntoView({ block: 'center' });
  return {
    title: txt(document.querySelector('.ps-title')),
    cardTitles: cards.map((c) => txt(c.querySelector('.ps-sec')).slice(0, 24)),
    cacheCard: txt(card).slice(0, 220),
  };
});
console.log(JSON.stringify(info, null, 2));
await page.waitForTimeout(600);
await page.screenshot({ path: shot + '/round-06-final.png' });
console.log('screenshot -> round-06-final.png');
