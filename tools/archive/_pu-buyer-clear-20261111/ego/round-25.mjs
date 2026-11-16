// round-25: 收尾——作废我在测试库留下的报表打印记录(本版式已打印 回到 0)
const task = await taskSpace(3);
const page = task.page('p1');
const before = await page.evaluate(() => [...document.querySelectorAll('.pup-rec .el-table__row')].map((r) => (r.textContent || '').replace(/\s+/g, ' ').trim()));
console.log('records before:', JSON.stringify(before));

const clicked = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.pup-rec button')].find((b) => (b.textContent || '').trim() === '作废');
  if (!btn) return 'no-btn';
  btn.click();
  return 'ok';
});
console.log('作废 click:', clicked);
await page.waitForTimeout(1200);
// 确认框
const confirmed = await page.evaluate(() => {
  const box = document.querySelector('.el-message-box');
  if (!box) return 'no-box';
  const ok = [...box.querySelectorAll('button')].find((b) => /确定|OK/.test((b.textContent || '').trim()));
  if (!ok) return 'no-ok';
  ok.click();
  return 'ok';
});
console.log('confirm:', confirmed);
await page.waitForTimeout(3000);
const after = await page.evaluate(() => ({
  records: [...document.querySelectorAll('.pup-rec .el-table__row')].map((r) => (r.textContent || '').replace(/\s+/g, ' ').trim()),
  counts: [...document.querySelectorAll('.pup-rec-count')].map((e) => (e.textContent || '').trim()),
}));
console.log('records after:', JSON.stringify(after));
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) { console.log('restore skip: ' + e.message); }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/pu-buyer-clear-20261111/round-25-void.png' });
