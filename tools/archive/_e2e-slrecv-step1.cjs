// _e2e-slrecv-step1.cjs — 送料暂收单 E2E 第一步:登录+面板配置+选单来源+列表
const BASE = 'http://127.0.0.1:8090/api';
async function main() {
  const login = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  }).then((r) => r.json());
  const token = login.data.token;
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };
  console.log('login:', login.code, 'user:', login.data.user?.userName ?? login.data?.userName);

  // 1) 面板配置:按钮组/字段/选单链路
  const cfg = await fetch(BASE + '/px/getNewFormPermMatrix?panelCode=SL_RECV', { headers: H }).then((r) => r.json());
  if (cfg.code !== 200) { console.log('matrix FAIL', JSON.stringify(cfg).slice(0, 500)); return; }
  const meta = cfg.data?.meta?.[0] ?? {};
  console.log('panelName:', meta.panelName ?? cfg.data?.meta?.map?.((m) => m.panelName).join(','));
  const groups = meta.groups ?? meta.buttons ?? [];
  console.log('groups:', JSON.stringify(groups));
  console.log('selectConfig.source:', meta.selectConfig?.source, '| headerMap:', JSON.stringify(meta.selectConfig?.headerMap));
  const heads = (meta.dataSchema?.fields ?? []).filter((f) => (f.place ?? '').includes('header')).map((f) => f.dataName);
  console.log('headerFields:', heads.join(','));
  const detailCols = (meta.detail?.tabs?.[0]?.columns ?? meta.detail?.tabs?.[0]?.fields ?? []).map((c) => c.dataName ?? c.label);
  console.log('detailCols:', detailCols.join(','));

  // 2) 列表查询
  const list = await fetch(BASE + '/px/queryFormDataList', {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: 'SL_RECV', pageNo: 1, pageSize: 20, condition: {} }),
  }).then((r) => r.json());
  console.log('queryFormDataList:', list.code, 'total:', list.data?.totalSize ?? list.data?.total);

  // 3) 选单来源(PU_ORDER 已审核单)
  const src = await fetch(BASE + '/px/voucherFlow/sources', {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: 'SL_RECV', sourcePanel: 'PU_ORDER', condition: {}, pageNo: 1, pageSize: 5 }),
  }).then((r) => r.json());
  console.log('sources:', src.code, 'total:', src.data?.totalSize);
  for (const d of (src.data?.list ?? []).slice(0, 5)) {
    console.log('  PO:', d['编号'], d['单据状态'], '行数:', d.detail?.items?.length, '首行物料:', d.detail?.items?.[0]?.['物料编码'], d.detail?.items?.[0]?.['数量']);
  }
  // 4) PU_ORDER 生单按钮里应有 生成送料暂收单
  const po = await fetch(BASE + '/px/getNewFormPermMatrix?panelCode=PU_ORDER', { headers: H }).then((r) => r.json());
  const poMeta = po.data?.meta?.[0] ?? {};
  const poDisabled = poMeta.metadata?.disabledActions ?? poMeta.disabledActions ?? [];
  console.log('PU_ORDER groups:', JSON.stringify(poMeta.groups ?? poMeta.buttons ?? []));
  console.log('PU_ORDER disabledActions:', JSON.stringify(poDisabled));
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
