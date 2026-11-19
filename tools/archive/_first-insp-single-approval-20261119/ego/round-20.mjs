const task = await taskSpace('first-insp-approval-20261119');
const page = task.page('p1');
const call = (button, formData) => page.evaluate(async ({ button, formData }) => {
  const token = localStorage.getItem('mes_token');
  const r = await fetch('/api/px/callButton', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ panelCode: 'QC_FIRST_INSP', buttonName: button, formData }),
  });
  let body = null;
  try { body = await r.json(); } catch (e) { body = { parseError: String(e) }; }
  return { status: r.status, body };
}, { button, formData });

const no = 'SJ-2026-11-0013';
const sub = await call('提交审批', { 编号: no });
console.log('提交审批:', JSON.stringify(sub).slice(0, 800));
const appr = await call('审批通过', { 编号: no, 审批意见: '冒烟：单级审批' });
console.log('审批通过:', JSON.stringify(appr).slice(0, 800));
