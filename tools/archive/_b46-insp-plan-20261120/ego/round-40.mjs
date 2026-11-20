const task = await taskSpace('fill-insp-plan-b46-10-1-20261120');
const page = task.page('p1');
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find(x => (x.textContent || '').trim() === '新增');
  if (b) b.click();
});
await page.waitForTimeout(5000);
const st = await page.evaluate(() => {
  const tds = [...document.querySelectorAll('td.rs-label')];
  const td = tds.find(t => (t.textContent || '').trim() === '产品编号');
  const ref = td && td.nextElementSibling.querySelector('.rs-ref-ctl');
  const date = (() => { const d = [...document.querySelectorAll('td.rs-info-value')]; return d.map(x => { const i = x.querySelector('input'); return i ? i.value : (x.textContent || '').trim(); }); })();
  return {
    product: ref ? (ref.textContent || '').trim() : null,
    info: date,
    stage: [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && /^(草稿|审批中|已归档)$/.test((e.textContent || '').trim())).map(e => (e.textContent || '').trim()),
    msgs: [...document.querySelectorAll('.el-message, .el-notification')].map(e => (e.innerText || '').trim()),
  };
});
console.log(JSON.stringify(st, null, 1));
