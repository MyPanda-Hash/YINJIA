// _v-whloc-shape.mjs — 查 WHLOC(仓位档案)在 queryFormDataList 里到底长什么样(参照弹窗取数靠它)
const BASE = 'http://127.0.0.1:8090/api';
const j = (o) => JSON.stringify(o);

async function main() {
  const login = await (await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })).json();
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token };

  const cfg = await (await fetch(BASE + '/px/getPanelConfig?panelCode=WHLOC', { headers: H })).json();
  console.log('WHLOC metadata: mode=' + cfg.data?.metadata?.panelState?.mode + ' singleDoc=' + cfg.data?.metadata?.singleDoc
    + ' detailKey=' + j(Object.keys(cfg.data?.detail?.tabs?.[0] || {})) + ' tabKey=' + cfg.data?.detail?.tabs?.[0]?.key);

  const noCond = await (await fetch(BASE + '/px/queryFormDataList', {
    method: 'POST', headers: H, body: JSON.stringify({ panelCode: 'WHLOC', pageNo: 1, pageSize: 3, condition: {} }),
  })).json();
  console.log('\n无条件: total=' + noCond.data?.totalSize + ' list.length=' + (noCond.data?.list?.length ?? 0));
  console.log('首行键: ' + j(Object.keys(noCond.data?.list?.[0] || {})));
  console.log('首行: ' + j(noCond.data?.list?.[0]).slice(0, 700));

  const withWh = await (await fetch(BASE + '/px/queryFormDataList', {
    method: 'POST', headers: H, body: JSON.stringify({ panelCode: 'WHLOC', pageNo: 1, pageSize: 3, condition: { 仓库: 'A仓' } }),
  })).json();
  console.log('\ncondition {仓库:A仓}: total=' + withWh.data?.totalSize + ' list.length=' + (withWh.data?.list?.length ?? 0));
  console.log('首行: ' + j(withWh.data?.list?.[0]).slice(0, 500));

  // 参照弹窗实际调的接口:refColumns/refPanelName 之后的 queryFormDataList —— 用 refField 视角再看一遍
  const refLike = await (await fetch(BASE + '/px/queryFormDataList', {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: 'WHLOC', pageNo: 1, pageSize: 5, condition: { 仓库: 'A仓' }, keyword: '' }),
  })).json();
  const l = refLike.data?.list?.[0] || {};
  console.log('\n[A仓] 首行 仓库=' + j(l['仓库']) + ' 仓位编码=' + j(l['仓位编码']) + ' 大区=' + j(l['大区']) + ' 停用=' + j(l['停用']));
  console.log('行数=' + (refLike.data?.list?.length ?? 0) + ' total=' + refLike.data?.totalSize);
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
