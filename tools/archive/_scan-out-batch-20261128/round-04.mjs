const task = await taskSpace(19);
const page = (await task.pages())[0] ?? (await task.adopt((await task.tabs())[0].page));

const readRows = () => page.evaluate(() => ({
  rows: [...document.querySelectorAll('.mo-batch-row')].map((el) => ({
    text: (el.textContent || '').replace(/\s+/g, ' ').trim(),
    checked: !!el.querySelector('.el-checkbox.is-checked'),
  })),
  qty: (document.querySelector('.mo-qty input') || {}).value,
  hint: (document.querySelector('.mo-qty-hint') || {}).textContent || '',
  lines: [...document.querySelectorAll('.mo-line')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
}));

// ① 勾上 0904 / 0914,数量 55 ⇒ PC0000 10 + 0904 20 + 0914 25
const clickChecks = (lots) => page.evaluate((want) => {
  const rows = [...document.querySelectorAll('.mo-batch-row')];
  for (const lot of want) {
    const row = rows.find((el) => (el.textContent || '').includes(lot));
    if (!row) continue;
    const box = row.querySelector('.el-checkbox input');
    if (box && !row.querySelector('.el-checkbox.is-checked')) box.click();
  }
}, lots);

const setQty = (v) => page.evaluate((val) => {
  const input = document.querySelector('.mo-qty input');
  if (!input) return false;
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  s.call(input, String(val));
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.blur();
  return true;
}, v);

await clickChecks(['XH-20260904', 'XH-20260914']);
await page.waitForTimeout(600);
await setQty(55);
await page.waitForTimeout(800);
console.log('① 勾 0904+0914,数量 55\n' + JSON.stringify(await readRows(), null, 2));

// ② 取消勾选 PC0000 ⇒ 缺口提示出现
await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.mo-batch-row')];
  const row = rows.find((el) => (el.textContent || '').includes('PC0000'));
  const box = row && row.querySelector('.el-checkbox input');
  if (box) box.click();
});
await page.waitForTimeout(800);
console.log('② 取消 PC0000\n' + JSON.stringify(await readRows(), null, 2));

// ③ 加入清单 ⇒ 按批次拆多行
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.mo-qty button')].find((b) => (b.textContent || '').includes('加入清单'));
  if (btn) btn.click();
});
await page.waitForTimeout(1200);
console.log('③ 加入清单\n' + JSON.stringify(await readRows(), null, 2));

try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) { console.log('restore skip: ' + e.message); }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/scan-out-batch-20261128/round-04.png' });
