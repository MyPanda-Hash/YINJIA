const task = await taskSpace('fill-insp-plan-b46-10-1-20261120');
const page = task.page('p1');
const st = await page.evaluate(() => {
  const addBtn = [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && (e.textContent || '').trim().includes('新增数据记录行'));
  const tbls = [...document.querySelectorAll('table')].map(t => ({
    cls: t.className,
    rows: t.querySelectorAll('tbody tr').length,
    firstRow: t.querySelector('tbody tr') ? t.querySelector('tbody tr').outerHTML.slice(0, 900) : '',
  }));
  return {
    addBtn: addBtn.map(e => ({ tag: e.tagName, cls: e.className, parent: e.parentElement.className })),
    tables: tbls.filter(t => t.cls),
  };
});
console.log(JSON.stringify(st, null, 1).slice(0, 4000));
