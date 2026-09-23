/**
 * _verify-recv-two-exits.mjs — 送料暂收单两个去向按钮的**互斥性**验收(2026-09-22 采购链改造)
 *
 * 改造后 QC_RECV 的「生单」组有两个去向:生成来料检验单 / 生成采购入库单。
 * 两条路都是 generateBatch(sourcePanel='QC_RECV'),共用 `sentByLineKey('QC_RECV', 暂收单号)`
 * 这同一本行级剩余量账 —— 所以一行**只能走一条**。本探针把这句话验成断言:
 *   ① 暂收单A 走「生成来料检验单」→ 检验行 送检数量 = 暂收数量、批次键继承
 *   ② 同一张 A 再走「生成采购入库单」→ 必须被拒(且是「已无剩余可送」,不是别的错)
 *   ③ 暂收单B 走「生成采购入库单」→ 成功
 *   ④ 同一张 B 再走「生成来料检验单」→ 必须被拒(反向互斥,防止检验绕开暂收)
 *
 * 用法: node tools/archive/_verify-recv-two-exits.mjs [采购订单号]
 */
const API = process.env.YJ_API || 'http://localhost:8090/api';
const lj = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
if (lj.code !== 200) { console.error('登录失败:', lj.message); process.exit(1); }
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
/** 造一张已审核的暂收单;返回 {slNo, lineQty} */
const makeRecv = async (poNo) => {
  const st = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: poNo });
  const line = (st.lines || []).find((l) => Number(l.剩余数量) > 0);
  if (!line) throw new Error('订单无可送行: ' + poNo);
  const qty = Math.min(Number(line.剩余数量), 4);
  const gen = await post('/px/batchFlow/generate', {
    sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: poNo,
    lines: [{ lineKey: line.lineKey, qty }],
  });
  await post('/px/callButton', { panelCode: 'QC_RECV', buttonName: '审核', formData: { 编号: gen['编号'] }, buttonParam: {} });
  return { slNo: gen['编号'], lineQty: qty };
};

let poNo = process.argv[2] || null;
if (!poNo) {
  const list = await post('/px/queryFormDataList', { panelCode: 'PU_ORDER', condition: {}, pageNo: 1, pageSize: 200 });
  for (const d of (list.list || []).filter((x) => x['单据状态'] === '已审核')) {
    const st = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: d['编号'] });
    // 需要**两行都有剩余**,才能在一张订单上造出 A/B 两张暂收单
    if ((st.lines || []).filter((l) => Number(l.剩余数量) > 0).length >= 2) { poNo = d['编号']; break; }
  }
  if (!poNo) {  // 退而求其次:同一条剩余行分两次送(行级剩余量够即可)
    for (const d of (list.list || []).filter((x) => x['单据状态'] === '已审核')) {
      const st = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: d['编号'] });
      if ((st.lines || []).some((l) => Number(l.剩余数量) >= 8)) { poNo = d['编号']; break; }
    }
  }
}
if (!poNo) { console.error('找不到能造两张暂收单的采购订单,请显式传单号'); process.exit(1); }
console.log('用采购订单:', poNo);

const created = [];
try {
  // ═══ A 组:走检验 → 入库必须被拒 ═══
  console.log('\n=== A. 暂收单A 走「生成来料检验单」后,「生成采购入库单」必须被拒 ===');
  const A = await makeRecv(poNo); created.push(['QC_RECV', A.slNo]);
  const insp = await post('/px/callButton', { panelCode: 'QC_RECV', buttonName: '生成来料检验单', formData: { 编号: A.slNo }, buttonParam: {} });
  created.push(['QC_INSP', insp['编号']]);
  ok(!!insp['编号'], 'A1 暂收单A → 来料检验单', insp['编号']);
  const inspDoc = await docOf('QC_INSP', insp['编号']);
  const inspLine = inspDoc.detail?.items?.[0] || {};
  ok(Number(inspLine['送检数量']) === A.lineQty, 'A2 检验行 送检数量 = 暂收数量', inspLine['送检数量'] + ' vs ' + A.lineQty);
  const slA = await docOf('QC_RECV', A.slNo);
  ok(Number(inspDoc['批次键']) === Number(slA['批次键']) && Number(slA['批次键']) > 0,
    'A3 检验单继承暂收单批次键(同一台账)', '检验=' + inspDoc['批次键'] + ' 暂收=' + slA['批次键']);
  const crossA = await tryPost('/px/batchFlow/generate', { sourcePanel: 'QC_RECV', targetPanel: 'PURCHASE_IN', sourceNo: A.slNo });
  ok(crossA.code !== 0 && crossA.code !== 200 && /已无剩余可送/.test(String(crossA.message)),
    'A4 已送检的暂收单不能再生入库单(互斥)', String(crossA.message).slice(0, 60));

  // A5/A6 审核检验单 → 审核钩子 `inspAutoPurchaseIn` 自动生采购入库单(既有链路,本次未改;
  // 在此一并回归,证明「暂收后走检验」这条岔路仍能一路走到入库单)。
  // ⚠ 不能用 condition:{来源单号} 去查 —— PURCHASE_IN 根本没有「来源单号」字段,查询层会**静默忽略**
  //   该条件、回一页默认单据,断言会撞上历史单而假通过(踩过)。改为审核前后快照差集。
  const snap = async () => new Set(((await post('/px/queryFormDataList',
    { panelCode: 'PURCHASE_IN', condition: {}, pageNo: 1, pageSize: 500 })).list || []).map((d) => d['编号']));
  const before = await snap();

  // 先填检验结果:inspAutoPurchaseIn 只对「合格数量 > 0」的行生单(:1544-1546,合格数量为 0 就
  // 静默 return —— 首次跑这里没填,断言"未新增"才是**真**结果,不是探针坏了)。
  {
    const full = await docOf('QC_INSP', insp['编号']);
    await post('/px/callButton', {
      panelCode: 'QC_INSP', buttonName: '保存',
      formData: {
        ...full,
        detail: {
          items: (full.detail?.items || []).map((it) => ({ ...it, 合格数量: it['送检数量'] })),
        },
      },
      buttonParam: {},
    });
  }
  // 仓库自愈理由同 _verify-po-recv-batchno.mjs:存量采购订单行的仓库名不在 bs_wh,
  // 审核会被 StockLedgerService 挡下,与本次改造无关。
  let inspAudit = await tryPost('/px/callButton', { panelCode: 'QC_INSP', buttonName: '审核', formData: { 编号: insp['编号'] }, buttonParam: {} });
  if (inspAudit.code === 409 && /仓库档案不存在/.test(String(inspAudit.message))) {
    const full = await docOf('QC_INSP', insp['编号']);
    await post('/px/callButton', {
      panelCode: 'QC_INSP', buttonName: '保存',
      formData: { ...full, detail: { items: (full.detail?.items || []).map((it) => ({ ...it, 仓库: '恒亿仓' })) } },
      buttonParam: {},
    });
    inspAudit = await tryPost('/px/callButton', { panelCode: 'QC_INSP', buttonName: '审核', formData: { 编号: insp['编号'] }, buttonParam: {} });
  }
  ok(inspAudit.code === 0 || inspAudit.code === 200, 'A5 检验单审核通过', 'code=' + inspAudit.code + ' ' + String(inspAudit.message || '').slice(0, 70));
  const after = await snap();
  const newNos = [...after].filter((n) => !before.has(n));
  const autoIn = newNos.length ? await docOf('PURCHASE_IN', newNos[0]) : null;
  if (autoIn) created.push(['PURCHASE_IN', autoIn['编号']]);
  ok(!!autoIn, 'A6 检验单审核 → 自动生成采购入库单(审核钩子)', autoIn ? autoIn['编号'] : '未新增(新增=' + JSON.stringify(newNos) + ')');
  if (autoIn) {
    const autoLine = autoIn.detail?.items?.[0] || {};
    ok(autoLine['是否来料检验'] === '是', 'A7 自动入库单行 是否来料检验 = 是(与免检直达的「否」区分)', String(autoLine['是否来料检验']));
  }

  // ═══ B 组:走入库 → 检验必须被拒 ═══
  console.log('\n=== B. 暂收单B 走「生成采购入库单」后,「生成来料检验单」必须被拒 ===');
  const B = await makeRecv(poNo); created.push(['QC_RECV', B.slNo]);
  const pin = await post('/px/batchFlow/generate', { sourcePanel: 'QC_RECV', targetPanel: 'PURCHASE_IN', sourceNo: B.slNo });
  created.push(['PURCHASE_IN', pin['编号']]);
  ok(!!pin['编号'], 'B1 暂收单B → 采购入库单', pin['编号']);
  const crossB = await tryPost('/px/callButton', { panelCode: 'QC_RECV', buttonName: '生成来料检验单', formData: { 编号: B.slNo }, buttonParam: {} });
  ok(crossB.code !== 0 && crossB.code !== 200 && /已无剩余可送/.test(String(crossB.message)),
    'B2 已生入库单的暂收单不能再送检(反向互斥)', String(crossB.message).slice(0, 60));
} finally {
  // 倒序清理(下游先撤),每步都吞异常:状态不符属正常
  for (const [panel, no] of created.reverse()) {
    for (const b of ['弃审', '删除']) {
      try { await post('/px/callButton', { panelCode: panel, buttonName: b, formData: { 编号: no }, buttonParam: {} }); } catch (e) { /* 未审核/已删 */ }
    }
  }
  console.log('\n   清理: 已尝试作废/删除 ' + created.map(([, n]) => n).join(', ')
    + '（注:弃审/作废**不回收**批次号,会跳号 —— 见 BatchService.releaseByTarget）');
}

console.log('\n' + (fail ? `❌ ${fail} 项失败` : '✅ 全部通过'));
process.exit(fail ? 1 : 0);
