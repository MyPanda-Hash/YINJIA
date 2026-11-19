const task = await taskSpace('instr-summary-1119');
const page = task.page('p1');
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
await page.goto('http://localhost:5173/#/panelx/list/RD_INSTR_USE', { timeout: 30000 });
await page.waitForTimeout(3500);
await page.evaluate(() => {
  const tab = [...document.querySelectorAll('.rsp-page-tab')].find((x) => (x.textContent || '').includes('使用记录汇总'));
  if (tab) tab.click();
});
await page.waitForTimeout(3000);
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(300);
} catch (e) {}
const info = await page.evaluate(() => {
  const wrap = document.querySelector('.rsp-ledger');
  const table = document.querySelector('.rsp-ledger table');
  const rows = table ? [...table.querySelectorAll('tbody tr')].map((tr) =>
    [...tr.querySelectorAll('th,td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim())) : [];
  return { tableWidth: Math.round(table?.getBoundingClientRect().width || 0), scrollW: wrap?.scrollWidth || 0, clientW: wrap?.clientWidth || 0, rows };
});
console.log(JSON.stringify(info, null, 2));
const shot = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-instr-summary-1119/round-05-vite-fit.png' });
console.log({ screenshot: shot });
