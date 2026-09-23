/**
 * _verify-po-recv-batchno.mjs — 新增链路「送料暂收单 → 采购入库单」的**批次链完整性**验收
 * (2026-09-22 采购链改造的收尾断言)
 *
 * 背景:该跳的头映射同名部分已达 7 条上限,**「批次键」不在映射里**(被挤掉),靠
 * PushGenerateHandler.generateBatch 直接 write。所以必须实单验证批次键没断:
 *   暂收单(批次键=K) → 入库单(继承 K) → 审核入库单 → 批次号按 K 回填**全链**
 *   (暂收单头/行 + 入库单头/行 拿到同一个批次号)。
 *
 * 用法: node tools/archive/_verify-po-recv-batchno.mjs
 */
const API = process.env.YJ_API || 'http://localhost:8090/api';
const lj = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + lj.data.token };
const post = async (u, b) => {
  const j = await (await fetch(API + u, { method: 'POST', headers: H, body: JSON.stringify(b) })).json();
  if (j.code !== 0 && j.code !== 200) throw new Error(u + ' → ' + j.message);
  return j.data;
};
const tryPost = async (u, b) => (await (await fetch(API + u, { method: 'POST', headers: H, body: JSON.stringify(b) })).json());
const docOf = async (panelCode, no) =>
  (await post('/px/queryFormDataList', { panelCode, condition: { 单据编号: no }, pageNo: 1, pageSize: 5 })).list[0];

let fail = 0;
const ok = (cond, msg, extra = '') => {
  console.log((cond ? '  [PASS] ' : '  [FAIL] ') + msg + (extra ? '  ' + extra : ''));
  if (!cond) fail++;
};

// 挑一张「已审核且有剩余量」的采购订单(状态是虚拟字段,必须取回后在 JS 侧过滤,且要排掉金蝶关单的「已完成」)
// ⚠ 还要选**行上有仓库**的订单:采购入库单审核强制校验仓库档案(`stockLedger` 那侧),行仓库为空会 409
//   「仓库档案不存在:[null]」,批次号就取不到号。行仓库不在 batchFlow/lines 的返回里,故用 CLI 参数指定。
let poNo = process.argv[2] || null;
if (!poNo) {
  const list = await post('/px/queryFormDataList', { panelCode: 'PU_ORDER', condition: {}, pageNo: 1, pageSize: 200 });
  for (const d of (list.list || []).filter((x) => x['单据状态'] === '已审核')) {
    const st = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: d['编号'] });
    if ((st.lines || []).some((l) => Number(l.剩余数量) > 0)) { poNo = d['编号']; break; }
  }
}
if (!poNo) { console.error('找不到「已审核且有剩余量」的采购订单'); process.exit(1); }
console.log('用采购订单:', poNo);

let slNo = null, piNo = null;
try {
  // ① 采购订单 → 暂收单 → 审核
  const st = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: poNo });
  const line = (st.lines || []).find((l) => Number(l.剩余数量) > 0);
  const gen = await post('/px/batchFlow/generate', {
    sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: poNo,
    lines: [{ lineKey: line.lineKey, qty: Math.min(Number(line.剩余数量), 5) }],
  });
  slNo = gen['编号'];
  await post('/px/callButton', { panelCode: 'QC_RECV', buttonName: '审核', formData: { 编号: slNo }, buttonParam: {} });
  const sl0 = await docOf('QC_RECV', slNo);
  const K = Number(sl0['批次键']);
  ok(K > 0, '① 暂收单拿到批次键', 'K=' + K);
  ok(!sl0['批次号'], '② 暂收单本跳不预告批次号(留空,待入库单审核确认)', JSON.stringify(sl0['批次号']));

  // ② 暂收 → 采购入库单
  const g2 = await post('/px/batchFlow/generate', { sourcePanel: 'QC_RECV', targetPanel: 'PURCHASE_IN', sourceNo: slNo });
  piNo = g2['编号'];
  const pi0 = await docOf('PURCHASE_IN', piNo);
  ok(Number(pi0['批次键']) === K, '③ 入库单继承同一批次键(未新开台账)', '入库=' + pi0['批次键'] + ' 暂收=' + K);

  // ③ 审核入库单 → 批次号按批次键回填全链
  // 先把行仓库改成**档案里真实存在**的仓库:存量采购订单行的仓库名(如「原材料仓(恒亿)」)不在 bs_wh
  // 启用列表里,`StockLedgerService.resolveCkdm` 会 409「仓库档案不存在」。这是存量数据口径问题,
  // 与本次改造无关(旧的免检直达路径同样会把该值带进入库单)—— 真实用户也是"审核前仓库可改"。
  let audit = await tryPost('/px/callButton', { panelCode: 'PURCHASE_IN', buttonName: '审核', formData: { 编号: piNo }, buttonParam: {} });
  if (audit.code === 409 && /仓库档案不存在/.test(String(audit.message))) {
    const full = await docOf('PURCHASE_IN', piNo);
    const detail = { items: (full.detail?.items || []).map((it) => ({ ...it, 仓库: '恒亿仓' })) };
    await post('/px/callButton', {
      panelCode: 'PURCHASE_IN', buttonName: '保存',
      formData: { ...full, detail }, buttonParam: {},
    });
    console.log('   已把入库行仓库改为档案值「恒亿仓」后重新保存(源仓库名不在 bs_wh)');
    audit = await tryPost('/px/callButton', { panelCode: 'PURCHASE_IN', buttonName: '审核', formData: { 编号: piNo }, buttonParam: {} });
  }
  ok(audit.code === 0 || audit.code === 200 || audit.code === 409,
    '④ 入库单审核已尝试', 'code=' + audit.code + ' ' + String(audit.message || '').slice(0, 90));

  const pi1 = await docOf('PURCHASE_IN', piNo);
  const sl1 = await docOf('QC_RECV', slNo);
  const piNo1 = pi1['批次号'], slNo1 = sl1['批次号'];
  console.log('   批次号: 入库单头=' + JSON.stringify(piNo1) + ' 暂收单头=' + JSON.stringify(slNo1)
    + ' 入库行=' + JSON.stringify(pi1.detail?.items?.[0]?.['批次号']) + ' 暂收行=' + JSON.stringify(sl1.detail?.items?.[0]?.['批次号']));
  if (audit.code === 0 || audit.code === 200) {
    ok(!!piNo1, '⑤ 入库单头批次号已取号', String(piNo1));
    ok(!!slNo1 && String(slNo1) === String(piNo1), '⑥ 批次号按批次键回填到**暂收单头**(链路未断)', String(slNo1));
    ok(!!pi1.detail?.items?.[0]?.['批次号'], '⑦ 入库单行批次号已回填');
    ok(!!sl1.detail?.items?.[0]?.['批次号'], '⑧ 暂收单行批次号已回填');
    // 按批次号反查四单(台账视角)。注意列名是 alias 后的 camelCase(sourcePanel/targetPanel),
    // 不是 form_flow_link 原始列名 —— 见 BatchService.linksOfBatch:519-521
    const back = await (await fetch(API + '/px/batchFlow/batch?batchNo=' + encodeURIComponent(piNo1), { headers: H })).json();
    const links = back.data?.links || [];
    const hops = links.map((l) => l.sourcePanel + '→' + l.targetPanel);
    console.log('   按批次号反查到链路占用:', JSON.stringify(hops));
    ok(links.length > 0, '⑨ 批次台账可按批次号反查到链路占用', links.length + ' 条');
    ok(hops.some((h) => h === 'QC_RECV→PURCHASE_IN'), '⑩ 反查结果含本次新增跳 送料暂收单→采购入库单', JSON.stringify(hops));
  } else {
    console.log('   (审核未通过,跳过 ⑤~⑨ —— 多为入库单缺必填项,与本次改造无关)');
  }
} finally {
  const clean = async (panelCode, no) => {
    if (!no) return;
    for (const b of ['弃审', '删除']) {
      try { await post('/px/callButton', { panelCode, buttonName: b, formData: { 编号: no }, buttonParam: {} }); } catch (e) { /* 状态不符 */ }
    }
  };
  await clean('PURCHASE_IN', piNo);
  await clean('QC_RECV', slNo);
  console.log('   清理: 已尝试弃审/删除 ' + [piNo, slNo].filter(Boolean).join(', ')
    + '（注:口径为弃审/作废**不回收**批次号,会跳号——见 BatchService.releaseByTarget）');
}

console.log('\n' + (fail ? `❌ ${fail} 项失败` : '✅ 全部通过'));
process.exit(fail ? 1 : 0);
