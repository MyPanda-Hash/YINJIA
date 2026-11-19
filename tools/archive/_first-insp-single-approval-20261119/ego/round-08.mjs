const task = await taskSpace('first-insp-approval-20261119');
const page = task.page('p1');
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) { console.log('restore skip: ' + e.message); }

const clickRail = async (label) => {
  await page.evaluate((l) => {
    const el = [...document.querySelectorAll('.as-side-btn')]
      .find((x) => (x.textContent || '').replace(/\s+/g, ' ').trim() === l);
    if (!el) throw new Error('侧栏没有按钮：' + l);
    el.click();
  }, label);
  await page.waitForTimeout(2500);
};

// 1) 新增
await clickRail('新增');
const afterNew = await page.evaluate(() => ({
  docNo: (document.body.innerText.match(/SJ[-\w]+/) || [''])[0],
  editable: document.querySelectorAll('.fi-sheet input').length,
  sampleRows: document.querySelectorAll('.fi-sheet tr.sample-row').length,
  colHeads: [...document.querySelectorAll('.fi-sheet thead tr:nth-child(2) th')].map((th) => (th.innerText || '').replace(/\s+/g, ' ').trim()),
}));
console.log('after 新增:', JSON.stringify(afterNew));

// 2) 填 3# 外径 = 34.25(两位小数,旧规则会取整成 34.3)
const typed = await page.evaluate(() => {
  const heads = [...document.querySelectorAll('.fi-sheet thead tr:nth-child(2) th')];
  const ci = heads.findIndex((th) => (th.innerText || '').includes('外径'));
  const rows = [...document.querySelectorAll('.fi-sheet tr.sample-row')];
  const row = rows[2]; // 3#
  const tds = [...row.querySelectorAll('td')];
  const td = tds[ci];
  const inp = td.querySelector('input');
  if (!inp) return { ok: false, ci, rowLabel: row.querySelector('th').innerText };
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  inp.focus();
  set.call(inp, '34.25');
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  inp.dispatchEvent(new Event('change', { bubbles: true }));
  return { ok: true, ci, rowLabel: row.querySelector('th').innerText, colHead: heads[ci].innerText };
});
console.log('typed:', JSON.stringify(typed));
await page.waitForTimeout(300);
// 失焦(点纸张标题),等取整逻辑若存在会触发
await page.click('.fi-header', { position: { x: 20, y: 10 } }).catch(() => {});
await page.waitForTimeout(1200);
const afterBlur = await page.evaluate(() => {
  const heads = [...document.querySelectorAll('.fi-sheet thead tr:nth-child(2) th')];
  const ci = heads.findIndex((th) => (th.innerText || '').includes('外径'));
  const row = [...document.querySelectorAll('.fi-sheet tr.sample-row')][2];
  const inp = [...row.querySelectorAll('td')][ci].querySelector('input');
  const toasts = [...document.querySelectorAll('.el-message, .el-message__content')].map((x) => (x.innerText || '').trim());
  return { value: inp ? inp.value : null, toasts };
});
console.log('after blur:', JSON.stringify(afterBlur));

// 3) 总结论 = 合格
await page.evaluate(() => {
  const th = [...document.querySelectorAll('.fi-foot th')].find((x) => (x.innerText || '').includes('检验结果'));
  const inp = th && th.nextElementSibling && th.nextElementSibling.querySelector('input');
  if (!inp) return;
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  set.call(inp, '合格');
  inp.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.waitForTimeout(600);

await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/first-insp-1119/ego/round-08-filled.png', fullPage: true });
console.log('shot round-08');
