const task = await taskSpace('first-insp-partial-red-20261120');
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
const st = await page.evaluate(() => [...document.querySelectorAll('.fi-requirements li')].map((li, i) => ({
  n: i + 1,
  spans: [...li.querySelectorAll('span')].map((s) => ({ t: (s.textContent || '').trim(), color: getComputedStyle(s).color, red: s.classList.contains('is-red') })),
})));
console.log(JSON.stringify(st, null, 1));
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/first-insp-typo/r7-partial.png' });
await task.finish({ keep: [] });
