// _e2e-slrecv-step2.cjs — 看矩阵响应真实结构 + PU_ORDER 单据状态清单
const BASE = 'http://127.0.0.1:8090/api';
async function main() {
  const login = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  }).then((r) => r.json());
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token };

  const cfg = await fetch(BASE + '/px/getNewFormPermMatrix?panelCode=SL_RECV', { headers: H }).then((r) => r.json());
  const meta = cfg.data?.meta?.[0] ?? {};
  console.log('meta keys:', Object.keys(meta).join(','));
  console.log('meta.panel keys:', meta.panel ? Object.keys(meta.panel).join(',') : '(无panel)');
  if (meta.panel) console.log('panel:', JSON.stringify(meta.panel).slice(0, 400));
  console.log('toolbar:', JSON.stringify(meta.toolbar ?? meta.buttonGroups ?? meta.operations ?? []).slice(0, 800));
  console.log('selectFlow:', JSON.stringify(meta.selectFlow ?? meta.select ?? meta.selectConfig ?? null));
  console.log('disabled:', JSON.stringify(meta.disabledActions ?? meta.metadata ?? null).slice(0, 300));

  const po = await fetch(BASE + '/px/queryFormDataList', {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: 'PU_ORDER', pageNo: 1, pageSize: 20, condition: {} }),
  }).then((r) => r.json());
  for (const d of (po.data?.list ?? [])) {
    console.log('PO:', d['编号'], d['单据状态'], '行数:', d.detail?.items?.length);
  }
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
