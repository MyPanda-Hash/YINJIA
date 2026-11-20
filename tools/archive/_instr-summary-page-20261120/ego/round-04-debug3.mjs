// 调试3:点「查询」看是否出数据(判断是首屏竞态还是取数口径问题)
const task = await taskSpace('instr-summary-page-1120');
const page = task.page('p1');
await page.goto('http://localhost:5173/#/qc/inspSummary', { timeout: 30000 });
await page.waitForTimeout(4000);
const read = () => page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  return {
    stats: [...document.querySelectorAll('.iss-stat')].map(t),
    dates: [...document.querySelectorAll('.iss-range input')].map((i) => i.value),
    msgs: [...document.querySelectorAll('.el-message')].map(t),
    loading: !!document.querySelector('.iss-table .el-loading-mask'),
    panes: [...document.querySelectorAll('.el-tab-pane')].map((p) => p.querySelectorAll('.el-table__body tr').length),
  };
});
console.log('首屏:', JSON.stringify(await read()));
await page.click('loc=css:.iss-controls button.el-button--primary', { label: '点查询' });
await page.waitForTimeout(3000);
console.log('点查询后:', JSON.stringify(await read()));
await page.click('loc=css:#pane-doc', { label: '切到按委托单' }).catch((e) => console.log('tab click:', e.message));
await page.waitForTimeout(1500);
const after = await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const pane = document.getElementById('pane-doc');
  return {
    active: pane ? pane.offsetParent !== null : null,
    headers: pane ? [...pane.querySelectorAll('.el-table__header th')].map(t) : [],
    rows: pane ? [...pane.querySelectorAll('.el-table__body tr')].map((tr) => [...tr.querySelectorAll('td')].map(t)) : [],
    checkboxes: pane ? pane.querySelectorAll('.el-table__body .el-checkbox').length : 0,
  };
});
console.log('按委托单页:', JSON.stringify(after, null, 2));
const shot = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-instr-summary-1120/round-04-debug3.png' });
console.log({ screenshot: shot });
