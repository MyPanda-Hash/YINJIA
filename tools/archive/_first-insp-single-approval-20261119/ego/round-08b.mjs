const task = await taskSpace('first-insp-approval-20261119');
const page = task.page('p1');
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) { console.log('restore skip: ' + e.message); }

// 1) 填 3# 外径 = 34.25
const typed = await page.evaluate(() => {
  const heads = [...document.querySelectorAll('.fi-sheet thead tr:nth-child(2) th .fi-colhead-text')]
    .map((s) => (s.innerText || '').trim());
  const ci = heads.findIndex((t) => t.includes('外径'));
  const row = [...document.querySelectorAll('.fi-sheet tr.sample-row')][2];
  const td = [...row.querySelectorAll('td')][ci];
  const inp = td ? td.querySelector('input') : null;
  if (!inp) return { ok: false, ci, heads, rowLabel: row.querySelector('th').innerText, tdCount: row.querySelectorAll('td').length };
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  inp.focus();
  set.call(inp, '34.25');
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  inp.dispatchEvent(new Event('change', { bubbles: true }));
  return { ok: true, ci, head: heads[ci], rowLabel: row.querySelector('th').innerText };
});
console.log('typed:', JSON.stringify(typed));
await page.waitForTimeout(300);
await page.click('.fi-header', { position: { x: 20, y: 10 } }).catch(() => {});
await page.waitForTimeout(1200);
const afterBlur = await page.evaluate(() => {
  const heads = [...document.querySelectorAll('.fi-sheet thead tr:nth-child(2) th .fi-colhead-text')].map((s) => (s.innerText || '').trim());
  const ci = heads.findIndex((t) => t.includes('外径'));
  const row = [...document.querySelectorAll('.fi-sheet tr.sample-row')][2];
  const inp = [...row.querySelectorAll('td')][ci].querySelector('input');
  const toasts = [...document.querySelectorAll('.el-message')].map((x) => (x.innerText || '').trim());
  return { value: inp ? inp.value : null, toasts };
});
console.log('after blur:', JSON.stringify(afterBlur));

// 2) 总结论 = 合格
await page.evaluate(() => {
  const th = [...document.querySelectorAll('.fi-foot th')].find((x) => (x.innerText || '').includes('检验结果'));
  const inp = th && th.nextElementSibling && th.nextElementSibling.querySelector('input');
  if (!inp) return;
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  set.call(inp, '合格');
  inp.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.waitForTimeout(600);
await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/first-insp-1119/ego/round-08b-filled.png', fullPage: true });
console.log('shot round-08b');
