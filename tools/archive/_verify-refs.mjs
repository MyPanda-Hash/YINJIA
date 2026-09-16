// 一次性验证:四单据参照设计 + 目标面板可达
const p = 'http://127.0.0.1:8090/api';
const lr = await fetch(p + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) }).then(r => r.json());
const t = lr.data.token;
for (const pc of ['PURCHASE_IN', 'SALE_OUT', 'SO_ORDER', 'PU_ORDER']) {
  const cfg = await fetch(p + '/px/getPanelConfig?panelCode=' + pc, { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json());
  if (cfg.code !== 200) { console.log(`[${pc}] FAIL`); continue; }
  const s = JSON.stringify(cfg.data);
  const rp = [...new Set([...s.matchAll(/refPanel":"([A-Z_]+)"/g)].map(m => m[1]))];
  const q = await fetch(p + '/px/queryFormDataList', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify({ panelCode: pc, pageNo: 1, pageSize: 1 }) }).then(r => r.json());
  console.log(`[${pc}] 参照目标=${rp.join(',')} 查询=${q.code === 200 ? 'ok' : 'FAIL'}`);
}
for (const target of ['INV', 'KHDA', 'GFDA', 'WH', 'EMP', 'DEPT']) {
  const c = await fetch(p + '/px/getPanelConfig?panelCode=' + target, { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json());
  console.log(`  目标[${target}] ${c.code === 200 ? '✓' : '✗ ' + c.message}`);
}
