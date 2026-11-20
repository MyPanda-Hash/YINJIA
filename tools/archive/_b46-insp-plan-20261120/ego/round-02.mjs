const task = await taskSpace('fill-insp-plan-b46-10-1-20261120');
const page = task.page('p1');
await page.goto('http://localhost:5173/#/panelx/list/RD_INSP_PLAN', { timeout: 30000 });
await page.waitForTimeout(4000);
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(500);
} catch (e) { console.log('restore skip: ' + e.message); }
console.log(JSON.stringify(await page.evaluate(() => ({ hash: location.hash }))));
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/b46/ego/r02-list.png' });
console.log(await page.snapshot());
