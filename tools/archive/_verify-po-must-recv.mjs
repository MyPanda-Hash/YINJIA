/**
 * _verify-po-must-recv.mjs — 「所有采购订单必须先到送料暂收单」验收探针(2026-09-22 用户口径)
 *
 * 断言两块:
 *   A. 配置层(不落库):采购订单不再有「生成采购入库单」出口;送料暂收单有两个去向按钮;
 *      采购入库单选单来源 = 送料暂收单、主按钮仍是「选单」;头行映射关键字段齐(7/14 上限没挤丢)。
 *   B. 行为层(真实落库,收尾清理):暂收单「生成采购入库单」→ 头采购订单号/供应商编码、行实收数量/
 *      采购订单行号/是否来料检验、批次键继承;再点一次被拒(无剩余可送);链路占用落 form_flow_link。
 *
 * 用法: node tools/archive/_verify-po-must-recv.mjs [采购订单号]
 *   (不给订单号则自动挑一张「已审核且有剩余量」的采购订单)
 */
const API = process.env.YJ_API || 'http://localhost:8090/api';
const lj = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
if (lj.code !== 200) { console.error('登录失败:', lj.message); process.exit(1); }
const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + lj.data.token };
const get = async (u) => (await (await fetch(API + u, { headers: H })).json()).data;
const post = async (u, b) => {
  const j = await (await fetch(API + u, { method: 'POST', headers: H, body: JSON.stringify(b) })).json();
  if (j.code !== 0 && j.code !== 200) throw new Error(u + ' → ' + j.message);
  return j.data;
};
/** 调按钮但**允许失败**(用于断言"应被拒") */
const tryPost = async (u, b) => (await (await fetch(API + u, { method: 'POST', headers: H, body: JSON.stringify(b) })).json());

let fail = 0;
const ok = (cond, msg, extra = '') => {
  console.log((cond ? '  [PASS] ' : '  [FAIL] ') + msg + (extra ? '  ' + extra : ''));
  if (!cond) fail++;
};
const groups = (cfg, name) => (cfg.metadata?.buttonGroups || []).find((g) => g.name === name)?.actions || [];

// ════════════════ A. 配置层 ════════════════
console.log('=== A. 配置层断言 ===');
const po = await get('/px/getPanelConfig?panelCode=PU_ORDER');
const poPush = Object.keys(po.metadata?.pushTargets || {});
ok(!poPush.includes('生成采购入库单'), 'A1 采购订单无「生成采购入库单」出口(pushTargets=' + JSON.stringify(poPush) + ')');
ok(poPush.includes('生成送料暂收单'), 'A2 采购订单仍有「生成送料暂收单」出口');
const poGen = groups(po, '生单');
ok(!poGen.includes('生成采购入库单') && poGen.includes('生成送料暂收单'), 'A3 采购订单生单按钮组已收敛', JSON.stringify(poGen));

const qr = await get('/px/getPanelConfig?panelCode=QC_RECV');
const qrPush = Object.keys(qr.metadata?.pushTargets || {});
ok(qrPush.includes('生成来料检验单') && qrPush.includes('生成采购入库单'), 'A4 暂收单两个去向都可用', JSON.stringify(qrPush));
const qrGen = groups(qr, '生单');
ok(qrGen[0] === '生成来料检验单' && qrGen.includes('生成采购入库单'), 'A5 暂收单生单组=检验为主 + 入库在 ▼', JSON.stringify(qrGen));

const pi = await get('/px/getPanelConfig?panelCode=PURCHASE_IN');
ok(pi.selectConfig?.source === 'QC_RECV', 'A6 入库单选单来源 = 送料暂收单', 'source=' + pi.selectConfig?.source);
const piSel = groups(pi, '选单');
ok(piSel[0] === '选单', 'A7 入库单选单主按钮仍是「选单」(否则变死键)', JSON.stringify(piSel));
ok(piSel.join('|').includes('选送料暂收单'), 'A8 入库单选单里有「选送料暂收单」');
const hFrom = (pi.selectConfig?.headerMap || []).map((m) => m.from + '→' + m.to);
const dFrom = (pi.selectConfig?.detailMap || []).map((m) => m.from + '→' + m.to);
ok(hFrom.some((s) => s === '采购订单号→采购订单号'), 'A9 头映射带 采购订单号(转ERP src_bill_no)', JSON.stringify(hFrom));
ok(hFrom.some((s) => s === '供应商代码→供应商编码'), 'A10 头映射带 供应商代码→供应商编码');
ok(dFrom.some((s) => s === '数量→实收数量'), 'A11 行映射带 数量→实收数量');
ok(dFrom.some((s) => s === '物料编码→存货编码'), 'A12 行映射带 物料编码→存货编码');
ok(dFrom.some((s) => s === '采购订单行号→采购订单行号'), 'A13 行映射带 采购订单行号(转ERP src_seq)');
console.log('   头映射(' + hFrom.length + '): ' + hFrom.join(' | '));
console.log('   行映射(' + dFrom.length + '): ' + dFrom.join(' | '));

// ════════════════ B. 行为层 ════════════════
console.log('\n=== B. 行为层断言(真实落库, 结束自动清理) ===');
let poNo = process.argv[2];
if (!poNo) {
  // 单据状态是推导出来的虚拟字段,不能进 SQL 条件(见 VoucherFlowService.sources)—— 必须取回后在 JS 侧过滤。
  // 尤其要排掉「已完成」:那是金蝶自动关单的订单,generateBatch 只认「已审核」。
  const list = await post('/px/queryFormDataList', { panelCode: 'PU_ORDER', condition: {}, pageNo: 1, pageSize: 200 });
  for (const d of (list.list || []).filter((x) => x['单据状态'] === '已审核')) {
    const st = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: d['编号'] });
    if ((st.lines || []).some((l) => Number(l.剩余数量) > 0)) { poNo = d['编号']; break; }
  }
}
if (!poNo) { console.error('找不到「已审核且有剩余量」的采购订单,请显式传单号'); process.exit(1); }
console.log('   用采购订单:', poNo);

let slNo = null, piNo = null, piDoc = null;
try {
  const st = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: poNo });
  const line = (st.lines || []).find((l) => Number(l.剩余数量) > 0);
  if (!line) throw new Error('该订单无可送行');
  const gen = await post('/px/batchFlow/generate', {
    sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: poNo,
    lines: [{ lineKey: line.lineKey, qty: Math.min(Number(line.剩余数量), 10) }],
  });
  slNo = gen['编号'];
  ok(!!slNo, 'B1 采购订单 → 送料暂收单', slNo);
  await post('/px/callButton', { panelCode: 'QC_RECV', buttonName: '审核', formData: { 编号: slNo }, buttonParam: {} });
  const slDoc = (await post('/px/queryFormDataList', { panelCode: 'QC_RECV', condition: { 单据编号: slNo }, pageNo: 1, pageSize: 5 })).list[0];
  ok(slDoc['单据状态'] === '已审核', 'B2 暂收单已审核', slDoc['单据状态']);
  const slKey = slDoc['批次键'];

  // ① 暂收 → 采购入库单(免检直达)
  const g = await post('/px/batchFlow/generate', { sourcePanel: 'QC_RECV', targetPanel: 'PURCHASE_IN', sourceNo: slNo });
  piNo = g['编号'];
  ok(!!piNo, 'B3 暂收单「生成采购入库单」成功', piNo);
  ok(Number(g['批次键']) === Number(slKey), 'B4 批次键继承暂收单(不新开台账)', '暂收=' + slKey + ' 入库=' + g['批次键']);
  piDoc = (await post('/px/queryFormDataList', { panelCode: 'PURCHASE_IN', condition: { 单据编号: piNo }, pageNo: 1, pageSize: 5 })).list[0];
  const piLine = piDoc.detail?.items?.[0] || {};
  ok(String(piDoc['采购订单号']) === String(poNo), 'B5 入库单头 采购订单号 = 原订单号(转ERP src_bill_no)', piDoc['采购订单号']);
  ok(!!piDoc['供应商编码'], 'B6 入库单头 供应商编码 非空(异名同义词生效)', String(piDoc['供应商编码']));
  ok(Number(piDoc['批次键']) === Number(slKey), 'B7 入库单头 批次键 落库', String(piDoc['批次键']));
  const slQty = Number(slDoc.detail?.items?.[0]?.['数量']);
  ok(Number(piLine['实收数量']) === slQty, 'B8 入库行 实收数量 = 暂收数量', piLine['实收数量'] + ' vs ' + slQty);
  ok(!!piLine['采购订单行号'], 'B9 入库行 采购订单行号 非空(转ERP src_seq)', String(piLine['采购订单行号']));
  ok(piLine['是否来料检验'] === '否', 'B10 入库行 是否来料检验 = 否(免检直达)', String(piLine['是否来料检验']));

  // ② 再点一次应被拒
  const dup = await tryPost('/px/batchFlow/generate', { sourcePanel: 'QC_RECV', targetPanel: 'PURCHASE_IN', sourceNo: slNo });
  ok(dup.code !== 0 && dup.code !== 200 && /已无剩余可送/.test(String(dup.message)), 'B11 重复生单被拒(行级剩余量核减)', String(dup.message).slice(0, 60));
} finally {
  const clean = async (panelCode, no) => {
    if (!no) return;
    for (const b of ['弃审', '删除']) {
      try { await post('/px/callButton', { panelCode, buttonName: b, formData: { 编号: no }, buttonParam: {} }); } catch (e) { /* 未审核/已删 */ }
    }
  };
  await clean('PURCHASE_IN', piNo);
  await clean('QC_RECV', slNo);
  console.log('   清理: 已尝试作废/删除 ' + [piNo, slNo].filter(Boolean).join(', '));
  // 注:弃审/作废不回收批次号(会跳号),故不再复用该批次
}

console.log('\n' + (fail ? `❌ ${fail} 项失败` : '✅ 全部通过'));
process.exit(fail ? 1 : 0);
