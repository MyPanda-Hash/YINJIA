// round-04:把缓存卡片滚到可见处截图;再切 English 复核译文(AGENTS:切换 en 后走查新增页面)
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

// 1) 滚到缓存卡片
const scrolled = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  const card = [...document.querySelectorAll('.ps-card')].find((c) => txt(c).includes('打印缓存'));
  if (!card) return false;
  card.scrollIntoView({ block: 'center' });
  return true;
});
console.log('scrolled to cache card: ' + scrolled);
await page.waitForTimeout(800);
await page.screenshot({ path: shot + '/round-04-cache-card-zh.png' });
console.log('screenshot -> round-04-cache-card-zh.png');

// 2) 切英语:header 里那个「中 ▾」下拉
const langOpen = await page.evaluate(() => {
  const cands = [...document.querySelectorAll('header *, .el-header *')];
  const el = cands.find((e) => (e.textContent || '').trim() === '中');
  if (!el) return false;
  (el.closest('div') || el).click();
  return true;
});
console.log('language dropdown opened: ' + langOpen);
await page.waitForTimeout(1200);

const opts = await page.evaluate(() => [...document.querySelectorAll('.el-dropdown-menu__item, .el-select-dropdown__item, li')]
  .map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 20));
console.log('dropdown options: ' + JSON.stringify(opts));

const picked = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-dropdown-menu__item, .el-select-dropdown__item, li')];
  const en = items.find((e) => /English/i.test(e.textContent || ''));
  if (!en) return 'not-found';
  en.click();
  return (en.textContent || '').trim();
});
console.log('picked language: ' + picked);
await page.waitForTimeout(2500);

const en = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  const card = [...document.querySelectorAll('.ps-card')].find((c) => txt(c).includes('Print cache'));
  return { cardText: txt(card) || '(card not found in English)', rows: [...(card ? card.querySelectorAll('.ps-cache') : [])].map((r) => txt(r)) };
});
console.log(JSON.stringify(en, null, 2));
await page.screenshot({ path: shot + '/round-04-cache-card-en.png' });
console.log('screenshot -> round-04-cache-card-en.png');
