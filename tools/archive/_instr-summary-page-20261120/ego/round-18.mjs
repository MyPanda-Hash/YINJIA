// 第 18 轮(诊断):展开送样人后,子表到底渲染了什么
const task = await taskSpace('instr-summary-page-1120');
const page = task.page('p1');
await page.goto('http://localhost:5173/#/qc/inspSummary', { timeout: 30000 });
await page.waitForTimeout(2000);
await page.reload();
await page.waitForTimeout(4500);
await page.click('loc=css:#pane-sender .el-table__body > tbody > tr.el-table__row:nth-child(1) .el-checkbox', { label: '勾送样人' });
await page.waitForTimeout(700);
await page.click('loc=css:#pane-sender .el-table__body > tbody > tr.el-table__row:nth-child(1) .el-table__expand-icon', { label: '展开' });
await page.waitForTimeout(1500);
const info = await page.evaluate(() => {
  const t = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const pane = document.getElementById('pane-sender');
  const sub = pane.querySelector('.iss-subtable');
  const expanded = pane.querySelector('.iss-expand');
  return {
    subTables: pane.querySelectorAll('.iss-subtable').length,
    subDataRows: sub ? [...sub.querySelectorAll('.el-table__body tr')].map((tr) => ({ cls: tr.className, txt: t(tr), tds: tr.querySelectorAll('td').length })) : [],
    subEmpty: sub ? t(sub.querySelector('.el-table__empty-text')) : null,
    expandedHtml: expanded ? expanded.outerHTML.slice(0, 1200) : null,
    picked: t(document.querySelector('.iss-picked')),
    subChecked: pane.querySelectorAll('.iss-subtable .el-checkbox.is-checked').length,
  };
});
console.log(JSON.stringify(info, null, 2));
