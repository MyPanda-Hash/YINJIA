// _e2e-slrecv-step3.cjs — 矩阵顶层结构 + 取 PO-2026-08-0002 明细做测试素材
const BASE = 'http://127.0.0.1:8090/api';
async function main() {
  const login = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  }).then((r) => r.json());
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token };
  const cfg = await fetch(BASE + '/px/getNewFormPermMatrix?panelCode=SL_RECV', { headers: H }).then((r) => r.json());
  console.log('data keys:', Object.keys(cfg.data ?? {}).join(','));
  for (const k of Object.keys(cfg.data ?? {})) {
    const v = cfg.data[k];
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) console.log(' ', k, 'keys:', Object.keys(v).join(',').slice(0, 300));
  }
  const po = await fetch(BASE + '/px/queryFormDataList', {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: 'PU_ORDER', pageNo: 1, pageSize: 5, condition: { 编号: 'PO-2026-08-0002' } }),
  }).then((r) => r.json());
  const doc = po.data?.list?.[0];
  console.log('PO-2026-08-0002 head 供应商:', doc?.['供应商'], '| items:');
  for (const it of doc?.detail?.items ?? []) console.log('  ', JSON.stringify(it));
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
