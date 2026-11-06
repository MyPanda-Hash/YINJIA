const base = 'http://localhost:5174';
const task = await taskSpace('YINJIA 样品申请单');
const p = task.page('p1');
await p.goto(base + '/#/panelx/list/RD_SAMPLE_EXT', { timeout: 60000 });
await p.reload();
await p.waitForTimeout(7500);
const d = await p.evaluate(() => {
  const rows = [...document.querySelectorAll('.sg-table tbody tr')].filter((tr) => tr.querySelector('td'));
  return {
    docno: (document.querySelector('.sg-info-row .as-docno-input input') || {}).value || '',
    dataRows: rows.length,
    firstRowTdClasses: rows[0] ? [...rows[0].querySelectorAll('td')].map((td) => td.className) : [],
    rowdel: document.querySelectorAll('.sg-rowdel').length,
  };
});
console.log(JSON.stringify(d));
await task.finish({ keep: [] });
process.exit(0);
