/** 临时:当前运行服务的批次去向 + 退料单面板可见性 快照(改前基线) */
const API = process.env.YJ_API || 'http://localhost:8090/api';
const lj = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json();
const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + lj.data.token };
const post = async (u, b) => { const j = await (await fetch(API + u, { method: 'POST', headers: H, body: JSON.stringify(b) })).json(); if (j.code !== 0 && j.code !== 200) throw new Error(u + ' → ' + JSON.stringify(j).slice(0, 200)); return j.data; };
const N = (v) => (v == null ? '' : String(v).trim());

const list = (await post('/px/queryFormDataList', { panelCode: 'PU_ORDER', pageNo: 1, pageSize: 400 })).list || [];
const orders = list.filter((r) => N(r['单据状态']) === '已审核').map((r) => N(r['单据编号']));
console.log('已审核采购订单 ' + orders.length + ' 张');
for (const po of orders) {
  let bs = [];
  try { bs = (await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: po })).batches || []; } catch (e) { console.log(po + ' 取批次失败:' + e.message); continue; }
  if (!bs.length) continue;
  console.log('\n【' + po + '】');
  for (const b of bs) {
    console.log(`  batchId=${b.batchId} ${N(b.batchNo) || '(待编号)'} ${N(b.status)} 起点=${N(b.firstTargetPanel)}/${N(b.firstTargetFormNo)} 去向=${N(b.targetPanel)}/${N(b.targetFormNo)} hops=${b.targetHops}`);
  }
}
console.log('\n=== QC_RETURN 面板列表行 ===');
const rl = (await post('/px/queryFormDataList', { panelCode: 'QC_RETURN', pageNo: 1, pageSize: 200 })).list || [];
console.log('行数=' + rl.length);
for (const r of rl) console.log('  ' + N(r['单据编号']) + ' 状态=' + N(r['单据状态']) + ' 检验单号=' + N(r['检验单号']));
console.log('\n=== QC_RECV 面板列表行(前 60) ===');
const sl = (await post('/px/queryFormDataList', { panelCode: 'QC_RECV', pageNo: 1, pageSize: 300 })).list || [];
console.log('行数=' + sl.length);
for (const r of sl.slice(0, 60)) console.log('  ' + N(r['单据编号']) + ' 状态=' + N(r['单据状态']));
