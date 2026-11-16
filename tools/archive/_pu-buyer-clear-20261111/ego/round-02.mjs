// round-02: 打开第一张采购订单 → 找「打印」按钮组 → 打开有金额打印弹窗 → 摸清两个下拉的 DOM(是否有清空按钮)
const task = await taskSpace(3);
const page = task.page('p1');
await page.waitForTimeout(500);

// 点第一行打开单据(双击/单击按列表习惯都试一次)
const rowText = await page.evaluate(() => {
  const tr = document.querySelector('tbody tr');
  if (!tr) return null;
  tr.click();
  return (tr.textContent || '').replace(/\s+/g, ' ').trim();
});
console.log('clicked row:', rowText);
await page.waitForTimeout(4000);

const st = await page.evaluate(() => ({
  hash: location.hash,
  buttons: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 80),
  hasPrintDlg: !!document.querySelector('.pup'),
}));
console.log(JSON.stringify(st, null, 2));

try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(400);
} catch (e) { console.log('restore skip: ' + e.message); }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/pu-buyer-clear-20261111/round-02-form.png' });
