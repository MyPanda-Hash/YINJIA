// 一次性验证探针:面板改名后 getPanelConfig 的 panelName(中/en)+ 查询通路
const BASE = 'http://127.0.0.1:8090/api';
const PANELS = ['KHDA', 'GFDA', 'INV', 'EMP', 'DEPT', 'WH', 'UOM', 'SETTLE', 'CUSGRP', 'SUPGRP', 'MATGRP', 'CUR'];

async function main() {
  const lr = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  }).then((r) => r.json());
  if (lr.code !== 200) throw new Error('login failed');
  const token = lr.data.token;
  let fail = 0;

  for (const pc of PANELS) {
    const cfg = await fetch(`${BASE}/px/getPanelConfig?panelCode=${pc}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());
    if (cfg.code !== 200) { fail++; console.log('[%s] FAIL %s', pc, cfg.message); continue; }
    const cfgEn = await fetch(`${BASE}/px/getPanelConfig?panelCode=${pc}`, {
      headers: { Authorization: `Bearer ${token}`, 'Accept-Language': 'en' },
    }).then((r) => r.json());
    console.log('[%s] 中文名=%s | en=%s', pc, cfg.data.metadata.panelName, cfgEn.data.metadata.panelName);
  }
  // 查询通路(改名不应影响)
  for (const pc of ['KHDA', 'GFDA', 'INV', 'EMP']) {
    const q = await fetch(`${BASE}/px/queryFormDataList`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ panelCode: pc, pageNo: 1, pageSize: 5 }),
    }).then((r) => r.json());
    if (q.code !== 200) { fail++; console.log('[query %s] FAIL %s', pc, q.message); continue; }
    console.log('[query %s] ok total=%s', pc, q.data.totalSize);
  }
  console.log(fail ? 'RESULT: FAIL' : 'RESULT: ALL PASS');
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
