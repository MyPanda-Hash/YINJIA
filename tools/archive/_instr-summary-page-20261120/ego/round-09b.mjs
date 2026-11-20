const task = await taskSpace('instr-summary-page-1120');
const page = task.page('p1');
await page.goto('http://localhost:5173/#/rd/instrSummary', { timeout: 30000 });
await page.waitForTimeout(3500);
const dump = await page.evaluate(() => {
  const all = [...document.querySelectorAll('*')].filter((el) => el.children.length === 0 && (el.textContent || '').trim() === '仪器使用汇总表');
  return {
    count: all.length,
    els: all.slice(0, 5).map((el) => ({ tag: el.tagName, cls: el.className, parentCls: el.parentElement?.className })),
    sidebarSample: [...document.querySelectorAll('aside *, .el-menu *, .sidebar *, .nav *')].slice(0, 0).length,
    texts: [...new Set([...document.querySelectorAll('*')].filter((el) => el.children.length === 0).map((el) => (el.textContent || '').trim()).filter((s) => s.includes('仪器')))],
  };
});
console.log(JSON.stringify(dump, null, 2));
const shot = await page.screenshot({ path: 'D:/workspace/yinjia/_scratch/ego-instr-summary-1120/round-09b-menu.png' });
console.log({ screenshot: shot });
