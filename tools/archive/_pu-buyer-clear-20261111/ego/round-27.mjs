// round-27: 英文界面下重新打开打印弹窗,读新增文案
const task = await taskSpace(3);
const page = task.page('p1');
const btns = await page.evaluate(() => [...document.querySelectorAll('.tb-main')].map((e) => (e.textContent || '').trim()));
console.log('toolbar:', JSON.stringify(btns));
const clicked = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.tb-main')].find((e) => /Print/i.test((e.textContent || '').trim()));
  if (!el) return 'no-btn';
  const t = (el.textContent || '').trim();
  el.click();
  return t;
});
console.log('clicked:', clicked);
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
await page.screenshot({ path: 'C:/Users/Lenovo/ego/pu-buyer-clear-20261111/round-27-en.png' });
