// 干净验证:新开 Page(独立文档)→ 登录 → 直接进样品检验汇总表 → 首屏读数 → 再点查询对照
const task = await taskSpace('instr-summary-page-1120');
const page = await task.newPage();
console.log('new page:', page.label);
await page.goto('http://localhost:5173/#/login', { timeout: 30000 });
await page.waitForTimeout(2500);
if (await page.evaluate(() => !!document.querySelector('input[placeholder*="登录账号"]'))) {
  await page.evaluate(() => { [...document.querySelectorAll('.el-select')][1].click(); });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const t = [...document.querySelectorAll('.el-select-dropdown__item')].find((x) => (x.textContent || '').includes('测试库'));
    if (t) t.click();
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const ins = [...document.querySelectorAll('input')];
    setVal(ins.find((i) => (i.placeholder || '').includes('登录账号')), 'admin');
    setVal(ins.find((i) => (i.placeholder || '').includes('登录密码')), '123456');
    [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))?.click();
  });
  await page.waitForTimeout(5000);
}
await page.goto('http://localhost:5173/#/qc/inspSummary', { timeout: 30000 });
await page.waitForTimeout(4500);
const read = () => page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const pane = document.getElementById('pane-doc');
  return {
    stats: [...document.querySelectorAll('.iss-stat')].map(t),
    dates: [...document.querySelectorAll('.iss-range input')].map((i) => i.value),
    msgs: [...document.querySelectorAll('.el-message')].map(t),
    docRows: pane ? pane.querySelectorAll('.el-table__body tr').length : -1,
    checkboxes: pane ? pane.querySelectorAll('.el-table__body .el-checkbox').length : -1,
  };
});
console.log('首屏:', JSON.stringify(await read()));
await page.click('loc=css:#pane-doc', { label: '切到按委托单' }).catch((e) => console.log('tab:', e.message));
await page.waitForTimeout(800);
await page.click('loc=css:#pane-doc .iss-table .el-table__body tr:nth-child(1) .el-checkbox', { label: '勾选第1张委托单' })
  .catch((e) => console.log('checkbox:', e.message));
await page.waitForTimeout(800);
const after = await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  return { picked: t(document.querySelector('.iss-picked')), exportBtn: t(document.querySelector('.iss-export')), checked: document.querySelectorAll('#pane-doc .el-table__body .el-checkbox.is-checked').length };
});
console.log('勾选后:', JSON.stringify(after));
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) {}
const shot = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-instr-summary-1120/round-04-clean.png' });
console.log({ screenshot: shot });
