const task = await taskSpace('fill-insp-plan-b46-10-1-20261120');
const page = task.page('p1');
const api = await page.evaluate(async () => {
  const r = await fetch('/api/qc/inspPlan/fromShipPlan?productCode=' + encodeURIComponent('B-46-10-1'), { credentials: 'include' });
  const t = await r.text();
  let j = null;
  try { j = JSON.parse(t); } catch (e) { }
  return { status: r.status, ct: r.headers.get('content-type'), head: t.slice(0, 300), planNo: j && j.data && j.data.planNo, rows: j && j.data && (j.data.rows || []).length };
});
console.log(JSON.stringify(api, null, 1));
