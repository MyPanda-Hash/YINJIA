const task = await taskSpace('fill-insp-plan-b46-10-1-20261120');
const page = task.page('p1');
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find(x => (x.textContent || '').trim() === '保存');
  if (b) b.click();
});
await page.waitForTimeout(5000);
const after = await page.evaluate(() => ({
  msgs: [...document.querySelectorAll('.el-message, .el-notification')].map(e => (e.innerText || '').trim()),
  stage: [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && /^(草稿|已保存|已审核|审批中)$/.test((e.textContent || '').trim())).map(e => (e.textContent || '').trim()),
}));
console.log(JSON.stringify(after, null, 1));
const api = await page.evaluate(async () => {
  const r = await fetch('/api/qc/inspPlan/fromShipPlan?productCode=' + encodeURIComponent('B-46-10-1'), { credentials: 'include' });
  const j = await r.json();
  return { status: r.status, planNo: j.planNo, title: j.title, version: j.version, rowCount: (j.rows || []).length, first: (j.rows || [])[0] };
});
console.log(JSON.stringify(api, null, 1).slice(0, 1500));
