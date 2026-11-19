const task = await taskSpace('first-insp-approval-20261119');
const page = task.page('p1');
const scrolled = await page.evaluate(() => {
  const req = document.querySelector('.fi-requirements');
  const foot = document.querySelector('.fi-foot');
  let el = foot || req;
  const chain = [];
  while (el && el !== document.body) {
    chain.push({ cls: (el.className || '').toString().slice(0, 40), sh: el.scrollHeight, ch: el.clientHeight });
    if (el.scrollHeight > el.clientHeight + 20) {
      el.scrollTop = el.scrollHeight;
      return { scrolled: true, cls: (el.className || '').toString().slice(0, 60), chain: chain.slice(-4) };
    }
    el = el.parentElement;
  }
  window.scrollTo(0, document.body.scrollHeight);
  return { scrolled: 'window', chain };
});
console.log('scroll:', JSON.stringify(scrolled));
await page.waitForTimeout(800);
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(400);
} catch (e) { console.log('restore skip: ' + e.message); }
const rect = await page.evaluate(() => {
  const r = document.querySelector('.fi-foot');
  const q = document.querySelector('.fi-requirements');
  const box = (el) => (el ? el.getBoundingClientRect().toJSON() : null);
  return { foot: box(r), reqs: box(q) };
});
console.log('rect:', JSON.stringify(rect));
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/first-insp-1119/ego/round-25-bottom.png' });
