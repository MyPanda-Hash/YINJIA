/**
 * 验证(2026-11-28):生单候选行上的「已完成」标记 + 已完成行不可再送。
 *   ① /api/px/push/lines      (生单页面:分批/普通两条链路的候选行)
 *   ② /api/px/voucherFlow/sources (合单选单弹窗的候选单据)
 * 用法:node tools\archive\_erp-guard-20261128\_verify-done-flag.mjs
 * 目标:测试账套(登录工厂 YJ_TEST)→ 本地临时实例 8091;**只读接口**(lines/sources)。
 */
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8091';
const ORDERS = (process.env.ORDERS || 'YJ-20260909-01,CGDD-20260920-00001').split(',');

const jpost = async (path, body, token) => {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch { /* noop */ }
  return { status: r.status, json, text };
};

const lr = await jpost('/api/auth/login', { userName: 'admin', password: '123456', factory: 'YJ_TEST' });
const token = lr.json?.data?.token;
if (!token) { console.log('[login] FAILED', lr.text.slice(0, 300)); process.exit(1); }
console.log('[login] ok');

// ① 生单行候选(push/lines)
const lines = await jpost('/api/px/push/lines', {
  panelCode: 'PU_ORDER', action: '生成送料暂收单', sourceNos: ORDERS,
}, token);
console.log(`\n[push/lines] status=${lines.status}`);
const docs = lines.json?.data?.docs || [];
for (const d of docs) {
  console.log(`  ${d.sourceNo} 行数=${(d.lines || []).length}`);
  for (const r of d.lines || []) {
    console.log(`    行${r['行号']} ${r['物料编码']} 数量=${r['数量']} 剩余=${r['剩余数量']}`
      + ` 可送上限=${r['可送上限']} 金蝶未入库=${r['金蝶未入库数量']}`
      + ` 已完成=${r['已完成']} 行状态=${r['行状态'] || '-'}`);
  }
}

// ② 合单选单候选(voucherFlow/sources)
const src = await jpost('/api/px/voucherFlow/sources', {
  sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', pageNo: 1, pageSize: 50, condition: {},
}, token);
console.log(`\n[voucherFlow/sources] status=${src.status}`);
const list = src.json?.data?.list || [];
console.log(`  单据 ${list.length} 张`);
for (const doc of list) {
  if (!ORDERS.includes(String(doc['编号']))) continue;
  console.log(`  ${doc['编号']}:`);
  for (const it of doc.detail?.items || []) {
    console.log(`    行${it['行号']} ${it['物料编码']} 剩余=${it['剩余数量']} 可送上限=${it['可送上限']}`
      + ` 已完成=${it['已完成']} 行状态=${it['行状态'] || '-'}`);
  }
}
