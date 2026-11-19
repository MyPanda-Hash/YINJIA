const task = await taskSpace('first-insp-approval-20261119');
const page = task.page('p1');
await page.evaluate(() => {
  document.documentElement.style.zoom = '0.62';
  const el = document.querySelector('.portal-content');
  if (el) el.scrollTop = el.scrollHeight;
  const h = document.querySelector('.as-sheet-scroll, .approval-sheet, .fi-sheet');
  if (h) h.scrollLeft = h.scrollWidth;
});
await page.waitForTimeout(1200);
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(400);
} catch (e) { console.log('restore skip: ' + e.message); }
const st = await page.evaluate(() => {
  const t = (el) => (el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  return {
    foot: [...document.querySelectorAll('.fi-foot th, .fi-foot td')].map(t),
    reqCount: document.querySelectorAll('.fi-requirements li').length,
    bodyHasApprover: (document.body.innerText || '').includes('批准'),
  };
});
console.log(JSON.stringify(st));
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/first-insp-1119/ego/round-26-paper-bottom.png' });
