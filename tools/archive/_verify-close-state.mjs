/**
 * _verify-close-state.mjs — 方案 A 实测:金蝶关闭状态 → MES 显示态 是否按口径推导
 * 用法: node tools/archive/_verify-close-state.mjs
 * 断言:PURCHASE_IN/PU_ORDER 列表里 已完成/已中止 的出现与 yj_doc_status 的 erp_close_state/stopped 对应。
 */
const API = 'http://localhost:8090/api';
const lj = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
const token = lj?.data?.token;
if (!token) throw new Error('登录失败');
const list = async (panelCode, pageSize = 500) => {
  const r = await (await fetch(API + '/px/queryFormDataList', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ panelCode, condition: {}, pageNo: 1, pageSize }),
  })).json();
  return r.data?.list || [];
};

for (const panel of ['PU_ORDER', 'SO_ORDER']) {
  const rows = await list(panel);
  const byStatus = new Map();
  for (const r of rows) {
    const s = String(r['单据状态'] ?? '(空)');
    byStatus.set(s, (byStatus.get(s) || 0) + 1);
  }
  const summary = [...byStatus.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join('  ');
  console.log(`${panel}(本页 ${rows.length} 张): ${summary}`);
  const done = rows.filter((r) => r['单据状态'] === '已完成').slice(0, 3).map((r) => r['编号'] || r['单据编号']);
  const stop = rows.filter((r) => r['单据状态'] === '已中止').slice(0, 3).map((r) => r['编号'] || r['单据编号']);
  console.log(`   已完成样例: ${done.join(', ') || '(无)'} | 已中止样例: ${stop.join(', ') || '(无)'}`);
}
console.log('\n注:本页 500 张按单号倒序,统计仅作抽样;精确分布见 SQL。');
