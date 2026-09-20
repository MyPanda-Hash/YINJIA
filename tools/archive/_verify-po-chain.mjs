/**
 * _verify-po-chain.mjs — 采购链「采购订单号 / 采购订单行号」贯通实测(新后端实例 :8091)
 * 用法: node tools/archive/_verify-po-chain.mjs [订单号]
 * 流程:采购订单(已审核) → 生成送料暂收单 → 审核 → 生成来料检验单 → 填合格数量保存 → 审核(自动生采购入库单)
 *      逐站断言 头 采购订单号 + 行 采购订单行号 是否带得下去;最后清理探针单据。
 */
const API = 'http://127.0.0.1:8091/api';
const ORDER = process.argv[2] || 'YJ-20260915-06';
const fails = [];
const ok = (c, m, extra = '') => { console.log(`${c ? '  [PASS]' : '  [FAIL]'} ${m}${extra ? ' :: ' + extra : ''}`); if (!c) fails.push(m); };

let token = '';
const call = async (path, body, method = 'POST') => {
  const r = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token },
    body: method === 'POST' ? JSON.stringify(body || {}) : undefined,
  });
  const j = await r.json();
  if (j.code !== undefined && j.code !== 0 && j.code !== 200) throw new Error(`${path} → ${JSON.stringify(j).slice(0, 300)}`);
  return j.data !== undefined ? j.data : j;
};
const btn = (panelCode, buttonName, formData) => call('/px/callButton', { panelCode, buttonName, formData, buttonParam: {} });
const list = async (panelCode) => (await call('/px/queryFormDataList', { panelCode, condition: {}, pageNo: 1, pageSize: 500 })).list || [];
const findDoc = async (panelCode, no) => (await list(panelCode)).find((r) => String(r['编号'] || r['单据编号'] || r['单号']) === String(no));
const headOf = (d) => ({
  编号: d['编号'] || d['单据编号'] || d['单号'],
  采购订单号: d['采购订单号'] ?? '',
  供应商: d['供应商'] ?? '',
  来源单号: d['来源单号'] ?? '',
  来源单据: d['来源单据'] ?? '',
});
const linesOf = (d, seqKey = '采购订单行号') => (d.detail?.items || []).map((x) => ({
  行: x[seqKey] ?? '', 物料: x['物料编码'] || x['存货编码'] || '', 数量: x['数量'] ?? x['实收数量'] ?? x['送检数量'] ?? '',
  送检数量: x['送检数量'] ?? '', 计量单位: x['计量单位'] ?? '', 单价: x['单价'] ?? '',
}));
/** 数值化:空串/null 一律 0(注意 ?? 不跳空串) */
const n = (v) => { const x = Number(String(v ?? '').trim()); return Number.isFinite(x) ? x : 0; };

/** 清理「指定单号」的探针遗留单据(只删这几个号,绝不批量删业务单据) */
const cleanupNumbers = async (pairs) => {
  for (const [panel, no] of pairs) {
    try { await btn(panel, '弃审', { 编号: no }); } catch { /* 草稿无审核态 */ }
    try {
      await call('/px/deleteForms', { panelCode: panel, rowCodes: [no] });
      console.log(`   [清理] 删除 ${panel} ${no}`);
    } catch (e) { console.log(`   [清理] ${panel} ${no} 删除失败: ${e.message.slice(0, 100)}`); }
  }
};

const created = [];   // 探针建的单据(清理用)

(async () => {
  // ── 登录 ──
  const lr = await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  });
  const lj = await lr.json();
  token = lj?.data?.token;
  if (!token) throw new Error('登录失败:' + JSON.stringify(lj).slice(0, 200));
  console.log(`[登录] ok | 源单 = ${ORDER}`);

  // ── -1) 先清理上一轮中断留下的探针单据(仅限指定单号)──
  await cleanupNumbers([['PURCHASE_IN', 'PI-2026-09-0007'], ['QC_INSP', 'IJ-2026-09-0006'], ['SL_RECV', 'SL-2026-09-0007'],
    ['QC_INSP', 'IJ-2026-09-0005'], ['SL_RECV', 'SL-2026-09-0006']]);

  // ── 0) 链路映射配置(选单弹窗与生单共用)──
  // 注:PURCHASE_IN 的主来源(PanelConfigService.SELECT_FLOWS)= PU_ORDER(免检直入),
  //     经检验链的来源是 QC_INSP(走 PUSH_TARGETS 的审核自动生单 + 同义词表),故这里按主来源断言。
  console.log('\n=== 0) 链路映射(后端配置) ===');
  for (const [target, src] of [['SL_RECV', 'PU_ORDER'], ['QC_INSP', 'SL_RECV'], ['PURCHASE_IN', 'PU_ORDER']]) {
    const cfg = await call(`/px/getPanelConfig?panelCode=${target}`, null, 'GET');
    const sc = cfg?.metadata?.selectConfig || cfg?.selectConfig || null;
    if (!sc) { console.log(`   ${target}: 无 selectConfig(键=${Object.keys(cfg || {}).join(',')})`); continue; }
    const hm = (sc.headerMap || []).map((m) => `${m.from}→${m.to}`);
    const dm = (sc.detailMap || []).map((m) => `${m.from}→${m.to}`);
    console.log(`   ${target} ← ${sc.source} | 头映射: ${hm.join(', ')}`);
    console.log(`        行映射: ${dm.join(', ')}`);
    ok(sc.source === src, `${target} 来源面板 = ${src}`, sc.source);
  }

  // ── 1) 采购订单 → 生成送料暂收单 ──
  console.log('\n=== 1) 采购订单 → 送料暂收单 ===');
  const order = await findDoc('PU_ORDER', ORDER);
  ok(!!order, `找到源采购订单 ${ORDER}`);
  const orderLines = linesOf(order, '行号');   // 采购订单侧的订单行号字段名为「行号」
  console.log(`   订单行: ${JSON.stringify(orderLines)}`);
  const r1 = await btn('PU_ORDER', '生成送料暂收单', { 编号: ORDER });
  const slNo = r1['编号'];
  created.push(['SL_RECV', slNo]);
  console.log(`   → 送料暂收单 ${slNo}`);
  const sl = await findDoc('SL_RECV', slNo);
  const slHead = headOf(sl), slLines = linesOf(sl);
  console.log(`   头: ${JSON.stringify(slHead)}`);
  console.log(`   行: ${JSON.stringify(slLines)}`);
  ok(slHead['采购订单号'] === ORDER, 'SL_RECV 头 采购订单号 带下来了', slHead['采购订单号']);
  ok(JSON.stringify(slLines.map((l) => l.行)) === JSON.stringify(orderLines.map((l) => l.行)),
    'SL_RECV 行 采购订单行号 与订单行号一致', JSON.stringify(slLines.map((l) => l.行)));

  // ── 2) 审核送料暂收单 ──
  console.log('\n=== 2) 审核送料暂收单 ===');
  await btn('SL_RECV', '审核', { 编号: slNo });
  console.log('   已审核');

  // ── 3) 送料暂收单 → 生成来料检验单 ──
  console.log('\n=== 3) 送料暂收单 → 来料检验单 ===');
  const r3 = await btn('SL_RECV', '生成来料检验单', { 编号: slNo });
  const qcNo = r3['编号'];
  created.push(['QC_INSP', qcNo]);
  console.log(`   → 来料检验单 ${qcNo}`);
  let qc = await findDoc('QC_INSP', qcNo);
  let qcHead = headOf(qc);
  console.log(`   头: ${JSON.stringify(qcHead)}`);
  console.log(`   行: ${JSON.stringify(linesOf(qc))}`);
  ok(qcHead['采购订单号'] === ORDER, 'QC_INSP 头 采购订单号 带下来了', qcHead['采购订单号']);
  ok(JSON.stringify(linesOf(qc).map((l) => l.行)) === JSON.stringify(orderLines.map((l) => l.行)),
    'QC_INSP 行 采购订单行号 带下来了', JSON.stringify(linesOf(qc).map((l) => l.行)));

  // ── 4) 填合格数量并保存 ──
  console.log('\n=== 4) 填合格数量保存(合格=送检数量) ===');
  const items = (qc.detail?.items || []).map((it) => ({
    ...it,
    合格数量: n(it['送检数量']) || n(it['数量']),
    不合格数量: 0,
  }));
  const saveBody = { ...qc, 编号: qcNo, detail: { ...(qc.detail || {}), items } };
  delete saveBody['detail'].items?.__proto__;
  await btn('QC_INSP', '保存', saveBody);
  qc = await findDoc('QC_INSP', qcNo);
  console.log(`   保存后行: ${JSON.stringify(linesOf(qc).map((l) => ({ 行: l.行, 送检: l.送检数量, 合格: (qc.detail?.items || []).find((x) => x['采购订单行号'] === l.行)?.['合格数量'] })))}`);
  ok((qc.detail?.items || []).every((x) => n(x['合格数量']) > 0), '合格数量已写入');

  // ── 5) 审核来料检验单 → 自动生采购入库单 ──
  console.log('\n=== 5) 审核来料检验单(自动生采购入库单) ===');
  const piBefore = new Set((await list('PURCHASE_IN')).map((r) => String(r['编号'] || r['单据编号'])));
  await btn('QC_INSP', '审核', { 编号: qcNo });
  await new Promise((r) => setTimeout(r, 1500));
  const piNew = (await list('PURCHASE_IN')).filter((r) => !piBefore.has(String(r['编号'] || r['单据编号'])));
  ok(piNew.length === 1, '审核后自动生成 1 张采购入库单草稿', piNew.map((r) => r['编号'] || r['单据编号']).join(','));
  if (piNew.length) {
    const pi = piNew[0];
    const piNo = pi['编号'] || pi['单据编号'];
    created.push(['PURCHASE_IN', piNo]);
    const piHead = headOf(pi), piLines = linesOf(pi);
    console.log(`   头: ${JSON.stringify(piHead)}`);
    console.log(`   行: ${JSON.stringify(piLines)}`);
    ok(piHead['采购订单号'] === ORDER, 'PURCHASE_IN 头 采购订单号 带下来了', piHead['采购订单号']);
    ok(JSON.stringify(piLines.map((l) => l.行)) === JSON.stringify(orderLines.map((l) => l.行)),
      'PURCHASE_IN 行 采购订单行号 带下来了(=转ERP src_seq)', JSON.stringify(piLines.map((l) => l.行)));
    ok(piLines.every((l) => String(l.计量单位 || '').trim() !== ''), 'PURCHASE_IN 行 计量单位 带下来了(转ERP 换 unit_id 必需)',
      JSON.stringify(piLines.map((l) => l.计量单位)));
    ok(piLines.every((l) => n(l.单价) > 0), 'PURCHASE_IN 行 单价 带下来了', JSON.stringify(piLines.map((l) => l.单价)));
  }

  // ── 6) 清理探针单据(反序:下游先删)──
  console.log('\n=== 6) 清理探针单据 ===');
  for (const [panel, no] of created.slice().reverse()) {
    try {
      await btn(panel, '弃审', { 编号: no });
    } catch (e) { /* 草稿无审核态,忽略 */ }
    try {
      await call('/px/deleteForms', { panelCode: panel, rowCodes: [no] });
      console.log(`   已删除 ${panel} ${no}`);
    } catch (e) { console.log(`   删除 ${panel} ${no} 失败(需人工清理): ${e.message.slice(0, 120)}`); }
  }

  console.log(`\n===== 结果:${fails.length ? 'FAIL ' + fails.length + ' 项' : 'ALL PASS'} =====`);
  fails.forEach((f) => console.log('  ✗', f));
  if (fails.length) process.exitCode = 1;
})().catch((e) => { console.error('FAIL:', e.stack || e.message); process.exit(1); });
