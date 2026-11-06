const base = 'http://localhost:5174';
const task = await taskSpace('YINJIA 样品申请单');
const p = task.page('p1');
await p.goto(base + '/#/panelx/list/RD_SAMPLE_EXT', { timeout: 60000 });
await p.reload();
await p.waitForTimeout(7500);
const d = await p.evaluate(() => {
  const rows = [...document.querySelectorAll('.sg-table tbody tr')];
  return rows.map((tr) => ({ cls: tr.className, cells: [...tr.children].map((c) => c.tagName + '.' + c.className).slice(0, 3), n: tr.children.length }));
});
console.log(JSON.stringify(d, null, 1));
await task.finish({ keep: [] });
process.exit(0);
