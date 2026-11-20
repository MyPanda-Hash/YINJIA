const task = await taskSpace('first-insp-red-20261120');
const page = task.page('p1');
await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_FIRST_INSP', { timeout: 30000 });
await page.waitForTimeout(6000);
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(400);
} catch (e) { console.log('restore skip: ' + e.message); }
await page.evaluate(() => {
  document.documentElement.style.zoom = '0.62';
  const el = document.querySelector('.portal-content');
  if (el) el.scrollTop = el.scrollHeight;
});
await page.waitForTimeout(1200);
const st = await page.evaluate(() => {
  const lis = [...document.querySelectorAll('.fi-requirements li')];
  return {
    host: location.host,
    items: lis.map((li, i) => ({ n: i + 1, color: getComputedStyle(li).color, red: li.classList.contains('is-red') })),
    foot: [...document.querySelectorAll('.fi-foot th, .fi-foot td')].map((e) => (e.innerText || '').trim()),
  };
});
console.log(JSON.stringify(st, null, 2));
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/first-insp-typo/r3-red.png' });
await task.finish({ keep: [] });
