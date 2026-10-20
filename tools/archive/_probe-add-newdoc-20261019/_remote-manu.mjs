/**
 * 远程 生产工单 体检:列表总数 / 关键字 GD 命中 / 单据字段,判断服务器上这张面板到底有没有数据、
 * 号池是否还在重发(2026-10-19)。
 * 用法:node _remote-manu.mjs [host:port]
 */
const host = process.argv[2] || '36.140.66.163:8090';
const API = `http://${host}/api`;
const login = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token };

async function q(body) {
  const r = await fetch(API + '/px/queryFormDataList', {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: 'MANU_ORDER', pageNo: 1, pageSize: 100, condition: {}, ...body }),
  });
  return r.json();
}
const all = await q({});
console.log(`total=${all?.data?.totalSize} rows=${(all?.data?.list || []).length}`);
for (const r of (all?.data?.list || []).slice(0, 10)) {
  console.log('  ', JSON.stringify({ 编号: r['编号'], 单据日期: r['单据日期'], 状态: r['单据状态'], 客户: r['客户'], 批号: r['批号'] }));
}
const kw = await q({ keyword: 'GD-' });
console.log(`keyword=GD- total=${kw?.data?.totalSize}`);
for (const r of (kw?.data?.list || []).slice(0, 6)) {
  console.log('  kw', JSON.stringify({ 编号: r['编号'], 单据日期: r['单据日期'], 状态: r['单据状态'] }));
}
const cfg = await (await fetch(API + '/px/getPanelConfig?panelCode=MANU_ORDER', { headers: H })).json();
const meta = cfg?.data?.metadata || {};
const heads = (cfg?.data?.dataSchema?.fields || []).filter((f) => String(f.place || '').includes('header')).slice(0, 8)
  .map((f) => f.label);
console.log('表头字段前 8 个:', heads.join(' | '));
