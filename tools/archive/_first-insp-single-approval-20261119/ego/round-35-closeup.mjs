const task = await taskSpace('first-insp-partial-red-shot-20261120');
const page = task.page('p1');
await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_FIRST_INSP', { timeout: 30000 });
await page.waitForTimeout(6000);
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(400);
} catch (e) { console.log('restore skip: ' + e.message); }
await page.evaluate(() => {
  document.body.classList.add('approval-printing');
  document.documentElement.style.zoom = '0.9';
  const el = document.querySelector('.portal-content');
  if (el) el.scrollTop = el.scrollHeight;
});
await page.waitForTimeout(1500);
const box = await page.evaluate(() => {
  const r = document.querySelector('.fi-requirements').getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
});
console.log('req box:', JSON.stringify(box));
try {
  await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/first-insp-typo/r8-reqs.png', clip: box });
  console.log('clip screenshot ok');
} catch (e) {
  console.log('clip failed: ' + e.message);
  await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/first-insp-typo/r8-reqs.png' });
}
await page.evaluate(() => { document.documentElement.style.zoom = ''; document.body.classList.remove('approval-printing'); });
await task.finish({ keep: [] });
