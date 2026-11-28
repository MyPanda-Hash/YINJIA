/**
 * 只读探针(2026-11-28):**生产服务器**上「已审核 + 未转ERP」的采购入库单到底有几张、是哪几张。
 * 只调 /api/auth/login 与 /api/px/queryFormDataList(只读),不点保存/审核/转ERP。
 *
 * 用法:node tools/archive/_erp-guard-20261128/_q-server-pending.mjs [panelCode]
 * 环境变量:YJ_MES_BASE / YJ_MES_USER / YJ_MES_PASS / YJ_MES_FACTORY(默认正式账套 YJ)
 */
const BASE = process.env.YJ_MES_BASE || 'http://36.140.66.163:8090';
const USER = process.env.YJ_MES_USER || 'admin';
const PASS = process.env.YJ_MES_PASS || '123456';
const FACTORY = process.env.YJ_MES_FACTORY || 'YJ';
const PANEL = process.argv[2] || 'PURCHASE_IN';

const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: USER, password: PASS, factory: FACTORY }),
})).json();
if (!login?.data?.token) { console.log('[login] 失败', JSON.stringify(login).slice(0, 200)); process.exit(1); }
const H = { Authorization: 'Bearer ' + login.data.token, 'Content-Type': 'application/json' };
console.log(`[login] ok factory=${login.data.user?.factory || FACTORY}`);

const rows = [];
for (let page = 1; page <= 20; page++) {
  const r = await (await fetch(BASE + '/api/px/queryFormDataList', {
    method: 'POST', headers: H,
    body: JSON.stringify({ panelCode: PANEL, keyword: '', pageNo: page, pageSize: 100 }),
  })).json();
  const list = r.data?.list || [];
  rows.push(...list);
  if (rows.length >= (r.data?.totalSize || 0) || list.length === 0) break;
}
console.log(`[列表] ${PANEL} 共取到 ${rows.length} 张`);

const pending = rows.filter((x) => {
  const pushed = String(x['是否已转ERP'] ?? '').trim();
  const st = String(x['单据状态'] ?? '').trim();
  return pushed !== '是' && st === '已审核';
});
console.log(`[已审核 + 未转ERP] ${pending.length} 张:`);
for (const x of pending) {
  console.log(`  ${x['单据编号']} | ${String(x['单据日期']).slice(0, 10)} | ${x['供应商'] || ''}`
    + ` | 采购订单号=${x['采购订单号'] || '(空)'} | 已转=${x['是否已转ERP'] || '(空)'}`);
}
