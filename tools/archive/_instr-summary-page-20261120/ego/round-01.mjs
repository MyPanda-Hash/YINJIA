// 仪器使用汇总表(2026-11-20) 第 1 轮:登录(测试库)→ 新页面 → 读表头/数据/统计条 → 截图
const task = await taskSpace('instr-summary-page-1120');
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
await page.goto('http://localhost:5173/#/rd/instrSummary', { timeout: 30000 });
await page.waitForTimeout(4000);
try {
  const w = await page.cdp('Browser.getWindowForTarget', {});
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } });
  await page.waitForTimeout(400);
} catch (e) { console.log('restore skip: ' + e.message) }

const info = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const table = document.querySelector('.isu-table');
  const headers = [...document.querySelectorAll('.isu-table .el-table__header th')].map(txt);
  const rows = [...document.querySelectorAll('.isu-table .el-table__body tr')].map((tr) => [...tr.querySelectorAll('td')].map(txt));
  const stats = [...document.querySelectorAll('.isu-stat')].map(txt);
  const btns = [...document.querySelectorAll('.isu-controls button')].map(txt);
  const menuHit = [...document.querySelectorAll('.el-menu-item')].filter((x) => txt(x).includes('仪器使用汇总表')).length;
  return {
    hash: location.hash,
    title: txt(document.querySelector('.isu-title')),
    headers,
    rowCount: rows.length,
    rows: rows.slice(0, 5),
    stats,
    btns,
    menuHit,
    tableScroll: table ? { scrollW: table.scrollWidth, clientW: table.clientWidth } : null,
    empty: txt(document.querySelector('.el-table__empty-text')),
  };
});
console.log(JSON.stringify(info, null, 2));
const shot = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-instr-summary-1120/round-01-page.png' });
console.log({ screenshot: shot });
