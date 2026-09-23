/** 改前基线快照(修复前运行的服务):全部已审核采购订单的批次去向 → JSON,供 _verify-batch-target-void.mjs 做「改前 vs 改后」对照 */
import fs from 'node:fs';
const API = process.env.YJ_API || 'http://localhost:8090/api';
const lj = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json();
const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + lj.data.token };
const post = async (u, b) => { const j = await (await fetch(API + u, { method: 'POST', headers: H, body: JSON.stringify(b) })).json(); if (j.code !== 0 && j.code !== 200) throw new Error(u + ' → ' + JSON.stringify(j).slice(0, 200)); return j.data; };
const N = (v) => (v == null ? '' : String(v).trim());
const list = (await post('/px/queryFormDataList', { panelCode: 'PU_ORDER', pageNo: 1, pageSize: 400 })).list || [];
const out = {};
for (const r of list) {
  const po = N(r['单据编号']);
  if (N(r['单据状态']) !== '已审核') continue;
  let bs = [];
  try { bs = (await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: po })).batches || []; } catch { continue; }
  if (!bs.length) continue;
  out[po] = bs.map((b) => ({ batchId: b.batchId, batchNo: N(b.batchNo), status: N(b.status), firstTargetPanel: N(b.firstTargetPanel), firstTargetFormNo: N(b.firstTargetFormNo), targetPanel: N(b.targetPanel), targetFormNo: N(b.targetFormNo), targetHops: b.targetHops, targetInvalid: b.targetInvalid === true }));
}
const file = process.argv[2] || 'tools/archive/_v-void-before.json';
fs.writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), api: API, orders: out }, null, 1), 'utf8');
const n = Object.values(out).reduce((a, b) => a + b.length, 0);
console.log(`已写 ${file}:${Object.keys(out).length} 张订单 / ${n} 个批次行`);
console.log('YJ-20260915-11 = ' + JSON.stringify(out['YJ-20260915-11']));
