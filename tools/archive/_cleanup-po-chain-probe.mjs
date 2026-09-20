/**
 * _cleanup-po-chain-probe.mjs — 清理链路实测产生的探针单据(仅限显式列出的单号)
 * 用法: node tools/archive/_cleanup-po-chain-probe.mjs
 * 顺序:先下游后上游(采购入库 → 来料检验 → 送料暂收);每张先弃审再删除(删除=软删 canceled='Y')。
 */
const API = 'http://127.0.0.1:8091/api';
const NUMBERS = [
  ['PURCHASE_IN', ['PI-2026-09-0008', 'PI-2026-09-0007']],
  ['QC_INSP', ['IJ-2026-09-0008', 'IJ-2026-09-0007', 'IJ-2026-09-0006', 'IJ-2026-09-0005']],
  ['SL_RECV', ['SL-2026-09-0009', 'SL-2026-09-0008', 'SL-2026-09-0007', 'SL-2026-09-0006']],
];
let token = '';
const call = async (path, body) => {
  const r = await fetch(API + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body || {}),
  });
  return r.json();
};
(async () => {
  const lj = await (await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json();
  token = lj?.data?.token;
  if (!token) throw new Error('登录失败');
  for (const [panel, nos] of NUMBERS) {
    for (const no of nos) {
      const u = await call('/px/callButton', { panelCode: panel, buttonName: '弃审', formData: { 编号: no }, buttonParam: {} });
      const d = await call('/px/deleteForms', { panelCode: panel, rowCodes: [no] });
      console.log(`${panel} ${no}: 弃审=${u.code === 0 || u.code === 200 ? 'ok' : (u.message || '').slice(0, 40)} 删除=${d.code === 0 || d.code === 200 ? 'ok' : (d.message || '').slice(0, 60)}`);
    }
  }
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
