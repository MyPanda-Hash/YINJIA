// round-14: 清空状态下点「确定并打印」→ 读纸面需方框(应为空)
const task = await taskSpace(3);
const page = task.page('p1');
await page.evaluate(() => {
  window.__printed = 0;
  window.print = () => { window.__printed += 1; };
});
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('确定并打印'));
  if (btn) btn.click();
});
await page.waitForTimeout(4500);
const paper = await page.evaluate(() => {
  const host = document.getElementById('yj-print-host');
  if (!host) return { host: false };
  const boxes = [...host.querySelectorAll('.sign .box')].map((b) => b.innerHTML.replace(/\s+/g, ' ').trim());
  return { host: true, printed: window.__printed || 0, title: host.querySelector('h1')?.textContent, boxes };
});
console.log(JSON.stringify(paper, null, 2));

const rec = await page.evaluate(() => ({
  recRows: [...document.querySelectorAll('.pup-rec .el-table__row')].map((r) => (r.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 6),
}));
console.log(JSON.stringify(rec, null, 2));
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) { console.log('restore skip: ' + e.message); }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/pu-buyer-clear-20261111/round-14-print-blank.png' });
