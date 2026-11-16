// round-07: 观察当前页面状态
const task = await taskSpace(3);
const page = task.page('p1');
const st = await page.evaluate(() => ({
  hash: location.hash,
  title: document.title,
  text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 1200),
}));
console.log(JSON.stringify(st, null, 2));
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) { console.log('restore skip: ' + e.message); }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/pu-buyer-clear-20261111/round-07-now.png' });
