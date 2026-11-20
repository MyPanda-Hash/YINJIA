// 第 23 轮:打包版(8090)复核按送样人勾选(造数已清理,现只有 1 个送样人/1 张单)
const task = await taskSpace('instr-summary-page-1120');
const page = await task.newPage();
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
await page.goto('http://127.0.0.1:8090/#/qc/inspSummary', { timeout: 30000 });
await page.waitForTimeout(4500);
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) {}
const read = () => page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const pane = document.getElementById('pane-sender');
  return {
    picked: t(document.querySelector('.iss-picked')),
    exportBtn: t(document.querySelector('.iss-export')),
    hasSelectionCol: !!pane?.querySelector('.el-table__header-wrapper .el-checkbox'),
    senderRows: pane ? pane.querySelectorAll('.el-table__body-wrapper .el-table__row').length : 0,
  };
});
console.log('初始:', JSON.stringify(await read()));
await page.click('loc=css:#pane-sender .el-table__body-wrapper .el-table__row:nth-child(1) .el-checkbox', { label: '勾送样人' });
await page.waitForTimeout(900);
console.log('勾送样人后:', JSON.stringify(await read()));
const shot = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-instr-summary-1120/round-23-8090-sender.png' });
console.log({ screenshot: shot });
