const API = (process.argv[2] || 'http://127.0.0.1:8091') + '/api';
const ok = (m) => console.log('✅ ' + m);
const bad = (m) => { console.log('❌ ' + m); process.exitCode = 1; };
(async () => {
  const t = (await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()).data.token;
  const call = (b) => fetch(API + '/px/callButton', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(b) }).then(async (r) => ({ s: r.status, j: await r.json() }));
  // 无生产线 → 指引回面板填写
  let r = await call({ panelCode: 'MANU_ORDER', buttonName: '排产', formData: { 编号: 'MO-2026-09-0030' }, buttonParam: {} });
  (r.j.message || '').includes('填写「生产线」') ? ok('无产线指引正确(先在加工单面板填产线)') : bad('无产线分支: ' + JSON.stringify(r.j).slice(0, 150));
  // 已排产单(用户数据) → 排产幂等成功 + 跳转面板
  const list = await (await fetch(API + '/px/queryFormDataList', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ panelCode: 'MANU_SCHEDULE', page: 1, pageSize: 5 }) })).json();
  const no = process.argv[3] || (list.data?.list?.[0]?.detail?.items?.[0]?.加工单号 || list.data?.rows?.[0]?.加工单号);
  console.log('已排产单(用户数据): ' + no);
  if (no) {
    r = await call({ panelCode: 'MANU_ORDER', buttonName: '排产', formData: { 编号: no }, buttonParam: {} });
    r.s === 200 && r.j.data?.gotoPanel === 'MANU_SCHEDULE'
      ? ok('排产成功 → gotoPanel=MANU_SCHEDULE (产线=' + r.j.data.生产线 + ')')
      : bad('排产失败: ' + JSON.stringify(r.j).slice(0, 200));
  }
  for (const pc of ['LINE_CAP', 'LINE_LOAD', 'MANU_SCHEDULE']) {
    const q = await (await fetch(API + '/px/queryFormDataList', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ panelCode: pc, page: 1, pageSize: 5 }) })).json();
    q.code === 200 ? ok(pc + ' 面板取数 OK') : bad(pc + ': ' + JSON.stringify(q).slice(0, 120));
  }
  console.log(process.exitCode ? '=== 存在失败项 ===' : '=== 面板化流转探针全部通过 ===');
})();
