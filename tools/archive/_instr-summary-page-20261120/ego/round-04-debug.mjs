// 调试:样品检验汇总表页面 DOM 实况(哪个页签激活、表头/行数、是否有错误提示)
const task = await taskSpace('instr-summary-page-1120');
const page = task.page('p1');
await page.goto('http://localhost:5173/#/qc/inspSummary', { timeout: 30000 });
await page.waitForTimeout(5000);
const info = await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const panes = [...document.querySelectorAll('.el-tab-pane')].map((p) => ({
    id: p.id, active: p.offsetParent !== null, rows: p.querySelectorAll('.el-table__body tr').length,
  }));
  const activePane = [...document.querySelectorAll('.el-tab-pane')].find((p) => p.offsetParent !== null);
  return {
    hash: location.hash,
    title: t(document.querySelector('.iss-title')),
    stats: [...document.querySelectorAll('.iss-stat')].map(t),
    panes,
    activeHeaders: activePane ? [...activePane.querySelectorAll('.el-table__header th')].map(t) : [],
    activeRows: activePane ? [...activePane.querySelectorAll('.el-table__body tr')].map((tr) => [...tr.querySelectorAll('td')].map(t)) : [],
    error: t(document.querySelector('.iss-alert')),
  };
});
console.log(JSON.stringify(info, null, 2));
const shot = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-instr-summary-1120/round-04-debug.png' });
console.log({ screenshot: shot });
