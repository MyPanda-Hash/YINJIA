const task = await taskSpace(19);
const page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page));

await page.goto('http://localhost:5173/#/panelx/list/MOBILE_PICK/doc?id=863', { timeout: 30000 });
await page.waitForTimeout(3000);

const head = await page.evaluate(() => ({
  hash: location.hash,
  title: document.querySelector('.mp-title')?.textContent || '',
  sub: document.querySelector('.mp-sub2')?.textContent || '',
  scanBar: !!document.querySelector('.mp-row input'),
}));
console.log('head=' + JSON.stringify(head, null, 2));

// 扫物料码 YJ-XH-001(该单第 1 行,需求 76)
await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    s.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const input = document.querySelector('.mp-row input');
  if (input) setVal(input, 'YJ-XH-001');
  const btn = [...document.querySelectorAll('.mp-row button')].find((b) => (b.textContent || '').includes('查询'));
  if (btn) btn.click();
});
await page.waitForTimeout(2500);

const readBatch = () => page.evaluate(() => ({
  mat: document.querySelector('.mp-mat-name')?.textContent || '',
  qty: (document.querySelector('.mp-qty input') || {}).value,
  rows: [...document.querySelectorAll('.mp-batch-row')].map((el) => ({
    text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
    checked: !!el.querySelector('.el-checkbox.is-checked'),
  })),
  warn: [...document.querySelectorAll('.mp-warn')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
}));

console.log('① 扫完默认\n' + JSON.stringify(await readBatch(), null, 2));

// ② 取消勾选 PC0000(数量不变)⇒ 缺口 10
await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.mp-batch-row')];
  const row = rows.find((el) => (el.textContent || '').includes('PC0000'));
  const box = row && row.querySelector('.el-checkbox input');
  if (box) box.click();
});
await page.waitForTimeout(800);
console.log('② 取消 PC0000\n' + JSON.stringify(await readBatch(), null, 2));

// ③ 表头全选 ⇒ 全部勾上,按顺序扣
await page.evaluate(() => {
  const head = document.querySelector('.mp-batches-head .el-checkbox input');
  if (head) head.click();
});
await page.waitForTimeout(800);
console.log('③ 表头全选\n' + JSON.stringify(await readBatch(), null, 2));

try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) { console.log('restore skip: ' + e.message); }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/scan-out-batch-20261128/round-05.png' });
