// _v-pin-bin-cell.mjs — 查 8090 下发的采购入库明细「仓位」字段元数据(前端据此决定这格能不能点选)
const BASE = 'http://127.0.0.1:8090/api';
const j = (o) => JSON.stringify(o, null, 1);

async function main() {
  const login = await (await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json();
  const H = { Authorization: 'Bearer ' + login.data.token };
  const cfg = (await (await fetch(BASE + '/px/getPanelConfig?panelCode=PURCHASE_IN', { headers: H })).json()).data;

  const tab = cfg.detail?.tabs?.[0] || {};
  console.log('明细页签 key=' + tab.key + ' 字段数=' + (tab.fields || []).length);
  console.log('dataSchema 里 detail 字段数=' + (cfg.dataSchema?.fields || []).filter((f) => String(f.place || '').includes('detail')).length);

  const binInTab = (tab.fields || []).find((f) => f.dataName === '仓位');
  console.log('\n[tabs.fields] 仓位 = ' + j(binInTab));

  const binInSchema = (cfg.dataSchema?.fields || []).find((f) => f.dataName === '仓位' && String(f.place || '').includes('detail'));
  console.log('\n[dataSchema.fields] 仓位 = ' + j(binInSchema));

  const wh = (tab.fields || []).find((f) => f.dataName === '仓库');
  console.log('\n[对照] 仓库 = ' + j(wh));

  console.log('\n明细页签名次: ' + j((tab.fields || []).map((f) => f.dataName)));
}
main().catch((e) => { console.error('FATAL', e); process.exit(1); });
