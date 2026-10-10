// _e2e-probe-desc.cjs — 侦查③:getPanelConfig / getFormDescriptor 结构(下拉选项/只读标记在哪)
const BASE = 'http://127.0.0.1:8090/api';
const j = (o) => JSON.stringify(o);
async function main() {
  const loginRes = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  }).then((r) => r.json());
  const H = { Authorization: 'Bearer ' + loginRes.data.token };
  const cfg = await fetch(BASE + '/px/getPanelConfig?panelCode=QC_TC_IN', { headers: H }).then((r) => r.json());
  const c = cfg.data ?? {};
  console.log('metadata 键:', j(Object.keys(c.metadata ?? {})));
  console.log('dataSchema 键:', j(Object.keys(c.dataSchema ?? {})));
  console.log('detail 键:', j(Object.keys(c.detail ?? {})));
  console.log('metadata.formPages:', j(c.metadata?.formPages).slice(0, 1500));
  console.log('dataSchema 头字段样本:', j(c.dataSchema?.header ?? c.dataSchema?.fields ?? c.dataSchema).slice(0, 1500));

  const d = await fetch(BASE + '/px/getFormDescriptor?panelCode=QC_TC_IN&code=TCI-2026-10-0039', { headers: H }).then((r) => r.json());
  console.log('Descriptor 顶层键:', j(Object.keys(d.data ?? {})));
  console.log('Descriptor.data 键:', j(Object.keys(d.data?.data ?? {})));
  console.log('Descriptor.detailData 键:', j(Object.keys(d.data?.detailData ?? {})));
  console.log('Descriptor.data:', j(d.data?.data).slice(0, 900));
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
