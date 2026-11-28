const task = await taskSpace(19);
const page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page));

await page.goto('http://localhost:5173/#/panelx/list/MOBILE_OTHER_PICK', { timeout: 30000 });
await page.waitForTimeout(2500);
await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    s.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const input = document.querySelector('.mo-scanbar input');
  if (input) setVal(input, 'YJ-XH-001');
  const btn = [...document.querySelectorAll('.mo-scanbar button')].find((b) => (b.textContent || '').includes('查询'));
  if (btn) btn.click();
});
await page.waitForTimeout(2500);
await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.mo-batch-row')];
  for (const lot of ['XH-20260904', 'XH-20260914']) {
    const row = rows.find((el) => (el.textContent || '').includes(lot));
    const box = row && row.querySelector('.el-checkbox input');
    if (box && !row.querySelector('.el-checkbox.is-checked')) box.click();
  }
});
await page.waitForTimeout(500);
await page.evaluate(() => {
  const input = document.querySelector('.mo-qty input');
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  s.call(input, '55');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.blur();
});
await page.waitForTimeout(800);
console.log(JSON.stringify(await page.evaluate(() => ({
  mat: document.querySelector('.mo-mat')?.textContent?.replace(/\s+/g, ' ').trim(),
  rows: [...document.querySelectorAll('.mo-batch-row')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
  qty: (document.querySelector('.mo-qty input') || {}).value,
})), null, 2));

try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) { console.log('restore skip: ' + e.message); }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/scan-out-batch-20261128/round-09.png' });
