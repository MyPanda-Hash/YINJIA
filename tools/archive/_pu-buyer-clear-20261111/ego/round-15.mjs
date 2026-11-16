// round-15: 用「重打」取证纸面(不新增记录):window.print 里抓 #yj-print-host 的 HTML
const task = await taskSpace(3);
const page = task.page('p1');
const open = await page.evaluate(() => !!document.querySelector('.pup'));
console.log('dialog open:', open);
await page.evaluate(() => {
  window.__paperHtml = null;
  window.print = () => {
    const host = document.getElementById('yj-print-host');
    window.__paperHtml = host ? host.innerHTML : 'no-host';
  };
});
const clicked = await page.evaluate(() => {
  const dlg = document.querySelector('.pup-rec-own') || document.querySelector('.pup-rec');
  const btn = [...document.querySelectorAll('.pup-rec button, .pup-rec-own button')].find((b) => (b.textContent || '').trim() === '重打');
  if (!btn) return 'no-btn';
  btn.click();
  return 'clicked';
});
console.log('重打:', clicked);
await page.waitForTimeout(4500);
const paper = await page.evaluate(() => {
  const html = window.__paperHtml;
  if (!html) return { paper: null };
  const div = document.createElement('div');
  div.innerHTML = html;
  return {
    title: div.querySelector('h1')?.textContent,
    boxes: [...div.querySelectorAll('.sign .box')].map((b) => b.innerHTML.replace(/\s+/g, ' ').trim()),
  };
});
console.log(JSON.stringify(paper, null, 2));
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) { console.log('restore skip: ' + e.message); }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/pu-buyer-clear-20261111/round-15-reprint-blank.png' });
