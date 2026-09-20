/**
 * _verify-batch-p0-api.mjs — 分批送料 P0 后端链路验证(API 级):
 *   ① 行状态接口:订单量/已送/已退回/剩余/可送上限 + 下一批次号
 *   ② 分批生单:送一部分 → 生成暂收单草稿 + 批次号 + 台账 + 按量占用
 *   ③ 剩余量随批次递减;超量(超比例)被拒
 *   ④ 删除草稿 → 批次序号回收(下一批次号回到被回收的号)+ 剩余量还原
 *   ⑤ 选单 sources:剩余数量 = 订单量 − Σ批次量 + Σ退货(回冲)
 * 用法: node tools/archive/_verify-batch-p0-api.mjs [采购订单号]
 */
const API = process.env.YJ_API || 'http://localhost:8090/api';
const PO = process.argv[2] || 'YJ-20260916-01';

const login = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
const token = login?.data?.token;
if (!token) { console.error('登录失败'); process.exit(1); }
const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token };
const post = async (url, body) => {
  const r = await fetch(API + url, { method: 'POST', headers: H, body: JSON.stringify(body) });
  const j = await r.json();
  if (j.code !== 0 && j.code !== 200) throw new Error(`${url} → ${JSON.stringify(j).slice(0, 300)}`);
  return j.data;
};
let fails = 0;
const ok = (c, msg) => { console.log(`  ${c ? '[PASS]' : '[FAIL]'} ${msg}`); if (!c) fails++; };

console.log(`\n=== ① 行状态 POST /px/batchFlow/lines (${PO}) ===`);
const st = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'SL_RECV', sourceNo: PO });
console.log('  超送比例=', st.overRatio, ' 下一批次号=', st.nextBatchNo, ' 已有批次=', JSON.stringify(st.batches));
for (const l of st.lines) console.log(`   行${l.行号} ${l.物料编码} 订单${l.数量} 已送${l.已送数量} 退回${l.已退回数量} 剩余${l.剩余数量} 上限${l.可送上限} ${l.计量单位}`);
ok(st.lines.length > 0, `取到 ${st.lines.length} 行订单明细`);
const line1 = st.lines.find((l) => Number(l.剩余数量) > 0);
if (!line1) {
  console.log('  [SKIP] 该订单各明细行均已送满 —— 换一张订单再跑(如 YJ-20260916-01)');
  process.exit(0);
}
console.log(`  首批次号 = ${st.nextBatchNo};测试行 = 行${line1.行号} 订单${line1.数量} 已送${line1.已送数量} 剩余${line1.剩余数量}`);
ok(Number(line1.剩余数量) > 0, `第 ${line1.行号} 行还有剩余 ${line1.剩余数量} 可送`);

console.log('\n=== ② 分批生单:第 1 行送 400(订单剩余内) ===');
const firstBatchNo = st.nextBatchNo;
const sendQty = Math.min(400, Number(line1.剩余数量));
const gen = await post('/px/batchFlow/generate', {
  sourcePanel: 'PU_ORDER', targetPanel: 'SL_RECV', sourceNo: PO,
  lines: [{ lineKey: line1.lineKey, qty: sendQty }],
});
console.log('  生成:', JSON.stringify(gen));
ok(!!gen['编号'] && String(gen['编号']).startsWith('SL-'), `生成送料暂收单草稿 ${gen['编号']}`);
ok(gen['批次号'] === firstBatchNo, `批次号 = ${firstBatchNo}(与预估一致)`);
ok(Number(gen['本次送料合计']) === sendQty, `本次送料合计 = ${gen['本次送料合计']}`);

console.log('\n=== ②b 生成的暂收单内容(头批次号/采购订单号 + 行数量/采购订单行号/批次号) ===');
const docRes = await post('/px/queryFormDataList', { panelCode: 'SL_RECV', condition: { 单据编号: gen['编号'] }, pageNo: 1, pageSize: 5 });
const doc = (docRes.list || [])[0];
if (!doc) {
  ok(false, '查不到刚生成的暂收单');
} else {
  console.log(`  头: 单据编号=${doc['单号'] || doc['编号']} 批次号=${doc['批次号']} 采购订单号=${doc['采购订单号']} 供应商=${doc['供应商']}`);
  const items = doc.detail?.items || [];
  for (const it of items) console.log(`  行${it['采购订单行号']} ${it['物料编码']} 数量=${it['数量']} 批次号=${it['批次号']}`);
  ok(String(doc['批次号']) === firstBatchNo, '暂收单头已带批次号');
  ok(String(doc['采购订单号']) === PO, '暂收单头已带采购订单号');
  ok(items.length === 1 && Number(items[0]['数量']) === sendQty, `暂收单行数量 = 本次送料量 ${sendQty}`);
  ok(String(items[0]['采购订单行号']) === String(line1.行号), `行已带采购订单行号 ${line1.行号}`);
  ok(String(items[0]['批次号']) === firstBatchNo, '行已带批次号');
}

console.log('\n=== ③ 剩余量递减 + 超量被拒 ===');
const st2 = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'SL_RECV', sourceNo: PO });
const line1b = st2.lines.find((l) => l.lineKey === line1.lineKey);
console.log(`   行${line1b.行号}: 已送 ${line1b.已送数量}(原 ${line1.已送数量}) 剩余 ${line1b.剩余数量}(原 ${line1.剩余数量})`);
ok(Math.abs((line1b.已送数量 - line1.已送数量) - sendQty) < 0.001, `已送量按本次量累加(${sendQty})`);
ok(Math.abs((line1.剩余数量 - line1b.剩余数量) - sendQty) < 0.001, '剩余量同步递减');
// 超量:超过 剩余×(1+比例)
const over = Number(line1b.剩余数量) * (1 + Number(st.overRatio)) + 1000;
let overErr = '';
try {
  await post('/px/batchFlow/generate', { sourcePanel: 'PU_ORDER', targetPanel: 'SL_RECV', sourceNo: PO, lines: [{ lineKey: line1.lineKey, qty: over }] });
} catch (e) { overErr = e.message; }
console.log('  超量尝试:', overErr ? overErr.slice(0, 160) : '(未被拒!)');
ok(/超出允许上限/.test(overErr), '超出允许超送比例被拒');

console.log('\n=== ④ 删除草稿 → 批次序号回收 ===');
await post('/px/deleteForms', { panelCode: 'SL_RECV', rowCodes: [gen['编号']] });
const st3 = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'SL_RECV', sourceNo: PO });
// 台账留痕走"按批次反查"接口(分批对话框的 batches 只列有效批次)
const back = await (await fetch(`${API}/px/batchFlow/batch?batchNo=${encodeURIComponent(firstBatchNo)}`, { headers: H })).json();
const released = back?.data?.batch;
console.log('  删除后 下一批次号=', st3.nextBatchNo, ' 台账该批次=', JSON.stringify(released));
const line1c = st3.lines.find((l) => l.lineKey === line1.lineKey);
ok(st3.nextBatchNo === firstBatchNo, `序号回收:下一批次号回到 ${firstBatchNo}`);
ok(released && released.status === 'RELEASED', `台账留痕:该批次状态 = RELEASED(实得 ${released?.status})`);
ok((st3.batches || []).every((b) => b.batchNo !== firstBatchNo || b.status === 'ACTIVE'),
  '分批对话框只列有效批次(释放批次不入列表)');
ok(Math.abs(line1c.已送数量 - line1.已送数量) < 0.001, `剩余量还原:已送回到 ${line1c.已送数量}`);

console.log('\n=== ⑤ 选单 sources 剩余量口径 ===');
const src = await post('/px/voucherFlow/sources', { sourcePanel: 'PU_ORDER', targetPanel: 'SL_RECV', condition: { 单据编号: PO }, pageNo: 1, pageSize: 5 });
const srcDoc = (src.list || [])[0];
if (!srcDoc) {
  console.log('  (该订单当前已无剩余行,属正常:已送满)');
} else {
  for (const it of srcDoc.detail.items) console.log(`   行${it.行号} 订单${it.数量} 已生单${it.已生单数量} 已退回${it.已退回数量} 剩余${it.剩余数量} 可送上限${it.可送上限}`);
  ok(srcDoc.detail.items.every((it) => Number(it.剩余数量) >= 0 && it.可送上限 !== undefined), '选单来源已带 剩余数量/可送上限/已退回数量');
}

console.log(fails ? `\n${fails} 项失败` : '\n全部通过');
process.exit(fails ? 1 : 0);
