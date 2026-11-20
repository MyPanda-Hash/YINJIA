// 第 16 轮:打包版(8090,换新 jar 后)复核——新页面 + 勾选导出 + 记录表单页(测试库)
const task = await taskSpace('instr-summary-page-1120');
const page = await task.newPage();
console.log('page:', page.label);
await page.goto('http://127.0.0.1:8090/#/login', { timeout: 30000 });
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
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) {}

// ① 仪器使用汇总表(打包版):标题/表头/空态
await page.goto('http://127.0.0.1:8090/#/rd/instrSummary', { timeout: 30000 });
await page.waitForTimeout(4500);
const pageInfo = await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  return {
    title: t(document.querySelector('.isu-title')),
    headers: [...document.querySelectorAll('.isu-table .el-table__header th')].map(t),
    stats: [...document.querySelectorAll('.isu-stat')].map(t),
    empty: t(document.querySelector('.el-table__empty-text')),
    exportBtn: t(document.querySelector('.isu-export')),
  };
});
console.log('8090 仪器使用汇总表:', JSON.stringify(pageInfo, null, 2));
const shot1 = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-instr-summary-1120/round-16-8090-instr.png' });

// ② 样品检验汇总表(打包版):勾选一张委托单
await page.goto('http://127.0.0.1:8090/#/qc/inspSummary', { timeout: 30000 });
await page.waitForTimeout(4500);
await page.click('loc=css:#tab-doc', { label: '切到按委托单页签' });
await page.waitForTimeout(1000);
await page.click('loc=css:#pane-doc .el-table__body tr:nth-child(1) .el-checkbox', { label: '勾选第1张委托单' });
await page.waitForTimeout(900);
const inspInfo = await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  return { picked: t(document.querySelector('.iss-picked')), exportBtn: t(document.querySelector('.iss-export')) };
});
console.log('8090 样品检验汇总表勾选:', JSON.stringify(inspInfo));
const shot2 = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-instr-summary-1120/round-16-8090-insp.png' });

// ③ 仪器使用记录表(打包版):确认没有「使用记录汇总」页签
await page.goto('http://127.0.0.1:8090/#/panelx/list/RD_INSTR_USE', { timeout: 30000 });
await page.waitForTimeout(4000);
const sheetInfo = await page.evaluate(() => ({
  pageTabs: [...document.querySelectorAll('.rsp-page-tab')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
  ledger: document.querySelectorAll('.rsp-ledger').length,
}));
console.log('8090 仪器使用记录表:', JSON.stringify(sheetInfo));
console.log({ screenshots: [shot1, shot2] });
