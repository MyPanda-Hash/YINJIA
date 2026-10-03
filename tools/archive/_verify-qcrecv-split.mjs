/**
 * _verify-qcrecv-split.mjs — 送料暂收单「生单」按商品基本档案「来料检验」分流 的端到端验收
 * (2026-10-05 用户口径:不再两个按钮,一个「生单」;同一张单 一是一否 ⇒ 分别出检验单与入库单)。
 *
 * 断言:
 *   ① 面板元数据:生单组**只剩一个**动作「生成检验或入库单」,旧的「生成来料检验单/生成采购入库单」已下架,
 *      且该动作未进 disabledActions(按钮亮)、pushTargets 里有它;
 *   ② 同一张暂收单,行1 商品=来料检验「是」、行2 商品=「否」→ 一次生单同时产出
 *      **来料检验单**(只含行1)与**采购入库单**(只含行2);
 *   ③ 检验行 送检数量 = 该行暂收数量,批次号/批次键继承暂收单;
 *   ④ 入库行 是否来料检验 = 否(免检直达),数量 = 该行暂收数量;
 *   ⑤ 再点一次 → 被拒「已无剩余可生单」(行级占用已记账,不会重复生单)。
 *
 * 在**测试账套**(factory=YJ_TEST)里跑,造的数据用完即删 —— 正式库只录真实业务。
 * 用法: node tools/archive/_verify-qcrecv-split.mjs [--keep] [采购订单号]
 */
const API = process.env.YJ_API || 'http://localhost:8090/api';
/** 测试账套(ADR-0003):访问正式库会污染真实账,**必须**显式指定 */
const FACTORY = process.env.YJ_FACTORY || 'YJ_TEST';
const KEEP = process.argv.includes('--keep');
const INS_CODE = 'YJ-XH-001';          // 测试账套里 来料检验 = 是 的商品(鑫恒 80-250)

const lj = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }),
})).json();
if (lj.code !== 200) { console.error('登录失败:', lj.message); process.exit(1); }
if (lj.data.user?.factory !== FACTORY) { console.error('账套不符:', lj.data.user?.factory); process.exit(1); }
const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + lj.data.token };
const post = async (u, b) => {
  const j = await (await fetch(API + u, { method: 'POST', headers: H, body: JSON.stringify(b) })).json();
  if (j.code !== 0 && j.code !== 200) throw new Error(u + ' → ' + j.message);
  return j.data;
};
const tryPost = async (u, b) =>
  (await (await fetch(API + u, { method: 'POST', headers: H, body: JSON.stringify(b) })).json());
const get = async (u) => (await (await fetch(API + u, { headers: H })).json());
const docOf = async (panelCode, no) =>
  (await post('/px/queryFormDataList', { panelCode, condition: { 单据编号: no }, pageNo: 1, pageSize: 5 })).list[0];
/** 完整单据描述(表头字段全量 —— queryFormDataList 只回列表列,「暂收单号」这类不在其中) */
const descOf = async (panelCode, code) => {
  const j = await get(`/px/getFormDescriptor?panelCode=${encodeURIComponent(panelCode)}&code=${encodeURIComponent(code)}`);
  return j.data || {};
};

let fail = 0;
const ok = (cond, msg, extra = '') => {
  console.log((cond ? '  [PASS] ' : '  [FAIL] ') + msg + (extra ? '  ' + extra : ''));
  if (!cond) fail++;
};
const created = [];

// ═══ ① 面板元数据:生单组只剩一个动作 ═══
console.log('=== ① 面板元数据(QC_RECV 生单组) ===');
{
  const cfg = await get('/px/getPanelConfig?panelCode=QC_RECV');
  const md = cfg.data?.metadata || {};
  const group = (md.buttonGroups || []).find((g) => g.name === '生单');
  const acts = group?.actions || [];
  ok(JSON.stringify(acts) === JSON.stringify(['生成检验或入库单']),
    '生单组只有一个动作「生成检验或入库单」', JSON.stringify(acts));
  ok(!(md.disabledActions || []).includes('生成检验或入库单'), '该动作未进 disabledActions(按钮亮)',
    JSON.stringify(md.disabledActions || []));
  ok(md.pushTargets?.['生成检验或入库单'] === 'QC_INSP', 'pushTargets 登记了该动作(路由标记 QC_INSP)',
    JSON.stringify(md.pushTargets || {}));
  ok(!(md.pushTargets || {})['生成来料检验单'] && !(md.pushTargets || {})['生成采购入库单'],
    '旧的两个生单动作已下架');
  // 动作名以「生成」开头 → 前端 isDisabled 自动按"仅已审核可生单"置灰(与既有生单按钮同口径)
  ok(acts[0].startsWith('生成'), '动作名以「生成」开头(前端按已审核态置灰的口径依赖它)');
}

// ═══ 造一张两行的已审核暂收单 ═══
let poNo = process.argv.filter((a) => !a.startsWith('--'))[2] || null;
const findPo = async () => {
  const list = await post('/px/queryFormDataList', { panelCode: 'PU_ORDER', condition: {}, pageNo: 1, pageSize: 200 });
  for (const d of (list.list || []).filter((x) => x['单据状态'] === '已审核')) {
    const st = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: d['编号'] });
    const usable = (st.lines || []).filter((l) => Number(l.剩余数量) >= 2);
    if (usable.length >= 2) return { poNo: d['编号'], lines: usable.slice(0, 2) };
  }
  return null;
};
const pick = poNo ? null : await findPo();
if (poNo) { console.error('指定订单的自动取行未实现,请省略参数由脚本自选'); process.exit(1); }
if (!pick) { console.error('测试账套里找不到"两行都有剩余"的已审核采购订单'); process.exit(1); }
poNo = pick.poNo;
console.log('\n=== 造数:采购订单 ' + poNo + ' 两行各送 2 ===');

const gen = await post('/px/batchFlow/generate', {
  sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: poNo,
  lines: pick.lines.map((l) => ({ lineKey: l.lineKey, qty: Math.min(Number(l.剩余数量), 2) })),
});
created.push(['QC_RECV', gen['编号']]);
console.log('  暂收单 ' + gen['编号'] + '(批次号 ' + gen['批次号'] + ')');

// 把第 1 行改成「来料检验 = 是」的商品,第 2 行保持原样(测试账套里都=否)⇒ 一是一否
{
  const full = await docOf('QC_RECV', gen['编号']);
  const items = full.detail?.items || [];
  if (items.length < 2) { console.error('暂收单只落了 ' + items.length + ' 行,无法做混合分流'); process.exit(1); }
  items[0]['物料编码'] = INS_CODE;
  items[0]['物料名称'] = '鑫恒（80-250）';
  await post('/px/callButton', {
    panelCode: 'QC_RECV', buttonName: '保存',
    formData: { ...full, detail: { items } }, buttonParam: {},
  });
  const back = await docOf('QC_RECV', gen['编号']);
  console.log('  行1 物料编码 → ' + back.detail.items[0]['物料编码'] + ' / 行2 ' + back.detail.items[1]['物料编码']);
  if (back.detail.items[0]['物料编码'] !== INS_CODE) {
    console.error('  ✗ 物料编码没能改写,后续断言无意义'); process.exit(1);
  }
}

// 审核(仓库档案缺失时按既有探针口径补 '恒亿仓' 自愈后再审)
let audit = await tryPost('/px/callButton', { panelCode: 'QC_RECV', buttonName: '审核', formData: { 编号: gen['编号'] }, buttonParam: {} });
if (audit.code === 409 && /仓库/.test(String(audit.message))) {
  const full = await docOf('QC_RECV', gen['编号']);
  await post('/px/callButton', {
    panelCode: 'QC_RECV', buttonName: '保存',
    formData: { ...full, detail: { items: (full.detail?.items || []).map((it) => ({ ...it, 仓库: '恒亿仓' })) } },
    buttonParam: {},
  });
  audit = await tryPost('/px/callButton', { panelCode: 'QC_RECV', buttonName: '审核', formData: { 编号: gen['编号'] }, buttonParam: {} });
}
ok(audit.code === 0 || audit.code === 200, '暂收单审核通过', 'code=' + audit.code + ' ' + String(audit.message || '').slice(0, 70));
if (!(audit.code === 0 || audit.code === 200)) { console.log(JSON.stringify(audit).slice(0, 300)); process.exit(1); }

const slDoc = await docOf('QC_RECV', gen['编号']);
const qtyOf = Object.fromEntries((slDoc.detail.items || []).map((it) => [it['物料编码'], Number(it['数量'])]));
console.log('  暂收行数量:', JSON.stringify(qtyOf));

// ═══ ② 一次「生单」→ 两张单 ═══
console.log('\n=== ② 一次生单(生成检验或入库单) ===');
const res = await post('/px/callButton', {
  panelCode: 'QC_RECV', buttonName: '生成检验或入库单', formData: { 编号: gen['编号'] }, buttonParam: {},
});
console.log('  返回:' + JSON.stringify({ 编号: res['编号'], gotoPanel: res.gotoPanel, 生成清单: res['生成清单'] }));
const made = res['生成清单'] || [];
for (const m of made) created.push([m['面板'], m['编号']]);

ok(made.length === 2, '产出 2 张单(检验 + 入库)', made.map((m) => m['面板'] + ' ' + m['编号']).join(' / '));
const inspEntry = made.find((m) => m['面板'] === 'QC_INSP');
const inEntry = made.find((m) => m['面板'] === 'PURCHASE_IN');
ok(!!inspEntry, '① 来料检验单已生成(行1 来料检验=是)');
ok(!!inEntry, '② 采购入库单已生成(行2 来料检验=否)');
ok(res.gotoPanel === (made[0] || {})['面板'], 'gotoPanel 指向第一张', String(res.gotoPanel));
ok(!res['未登记商品'], '无"商品档案未登记"告警', JSON.stringify(res['未登记商品'] || []));

if (inspEntry) {
  const d = await docOf('QC_INSP', inspEntry['编号']);
  const head = (await descOf('QC_INSP', inspEntry['编号'])).data || {};
  const items = d.detail?.items || [];
  ok(items.length === 1, '检验单只含 1 行(只有来料检验=是 的那行)', '行数=' + items.length);
  ok(items[0]?.['物料编码'] === INS_CODE, '检验行物料 = ' + INS_CODE, String(items[0]?.['物料编码']));
  ok(Number(items[0]?.['送检数量']) === qtyOf[INS_CODE], '检验行 送检数量 = 暂收数量',
    items[0]?.['送检数量'] + ' vs ' + qtyOf[INS_CODE]);
  ok(Number(head['批次键']) === Number(slDoc['批次键']) && Number(slDoc['批次键']) > 0, '检验单继承暂收单批次键',
    '检验=' + head['批次键'] + ' 暂收=' + slDoc['批次键']);
  ok(String(head['批次号']) === String(slDoc['批次号']), '检验单继承暂收单批次号',
    head['批次号'] + ' vs ' + slDoc['批次号']);
  // 列表行里单号键是通用「编号」(QueryService 统一补),不是「单据编号」
  ok(String(head['暂收单号']) === String(gen['编号']), '检验单暂收单号 = 来源暂收单', String(head['暂收单号']));
}
if (inEntry) {
  const d = await docOf('PURCHASE_IN', inEntry['编号']);
  const head = (await descOf('PURCHASE_IN', inEntry['编号'])).data || {};
  const items = d.detail?.items || [];
  // 采购入库明细的物料列叫「存货编码」、数量列叫「实收数量」(与暂收的 物料编码/数量 异名,靠 FLOW_DETAIL_SYNONYMS 接)
  const code = items[0]?.['存货编码'];
  ok(items.length === 1, '入库单只含 1 行(只有来料检验≠是 的那行)', '行数=' + items.length);
  ok(!!code && code !== INS_CODE, '入库行存货编码 ≠ ' + INS_CODE, String(code));
  ok(items[0]?.['是否来料检验'] === '否', '入库行 是否来料检验 = 否(免检直达)', String(items[0]?.['是否来料检验']));
  ok(Number(items[0]?.['实收数量']) === qtyOf[code], '入库行 实收数量 = 该行暂收数量',
    items[0]?.['实收数量'] + ' vs ' + qtyOf[code]);
  ok(Number(head['批次键']) === Number(slDoc['批次键']) && Number(slDoc['批次键']) > 0, '入库单继承同一批次键(与检验单同批)',
    '入库=' + head['批次键'] + ' 暂收=' + slDoc['批次键']);
}

// ═══ ③ 重复生单必须被拒 ═══
console.log('\n=== ③ 再点一次必须被拒(行级占用已记账) ===');
{
  const again = await tryPost('/px/callButton', {
    panelCode: 'QC_RECV', buttonName: '生成检验或入库单', formData: { 编号: gen['编号'] }, buttonParam: {},
  });
  ok(again.code !== 0 && again.code !== 200 && /已无剩余可生单/.test(String(again.message)),
    '第二次生单被拒且原因是「已无剩余可生单」', 'code=' + again.code + ' ' + String(again.message).slice(0, 60));
}

// ═══ ④ 单向场景:全免检 / 全检验 ⇒ 各只出一张(不能出空单) ═══
console.log('\n=== ④ 单向场景:只出一张,不出空单 ===');
const oneWay = async (label, toInspection) => {
  const pick2 = await findPo();
  if (!pick2) return;
  const g = await post('/px/batchFlow/generate', {
    sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: pick2.poNo,
    lines: [{ lineKey: pick2.lines[0].lineKey, qty: Math.min(Number(pick2.lines[0].剩余数量), 2) }],
  });
  created.push(['QC_RECV', g['编号']]);
  if (toInspection) {
    const full = await docOf('QC_RECV', g['编号']);
    const items = full.detail.items;
    items[0]['物料编码'] = INS_CODE;
    items[0]['物料名称'] = '鑫恒（80-250）';
    await post('/px/callButton', { panelCode: 'QC_RECV', buttonName: '保存', formData: { ...full, detail: { items } }, buttonParam: {} });
  }
  let a = await tryPost('/px/callButton', { panelCode: 'QC_RECV', buttonName: '审核', formData: { 编号: g['编号'] }, buttonParam: {} });
  if (a.code === 409 && /仓库/.test(String(a.message))) {
    const full = await docOf('QC_RECV', g['编号']);
    await post('/px/callButton', {
      panelCode: 'QC_RECV', buttonName: '保存',
      formData: { ...full, detail: { items: (full.detail?.items || []).map((it) => ({ ...it, 仓库: '恒亿仓' })) } }, buttonParam: {},
    });
    a = await tryPost('/px/callButton', { panelCode: 'QC_RECV', buttonName: '审核', formData: { 编号: g['编号'] }, buttonParam: {} });
  }
  const r = await post('/px/callButton', { panelCode: 'QC_RECV', buttonName: '生成检验或入库单', formData: { 编号: g['编号'] }, buttonParam: {} });
  const m = r['生成清单'] || [];
  for (const x of m) created.push([x['面板'], x['编号']]);
  const want = toInspection ? 'QC_INSP' : 'PURCHASE_IN';
  ok(m.length === 1 && m[0]['面板'] === want, label + ' ⇒ 只出一张 ' + want,
    m.map((x) => x['面板'] + ' ' + x['编号']).join(' / ') || '(无)');
};

await oneWay('④ 全部来料检验=是', true);
await oneWay('④ 全部来料检验=否', false);

// ═══ 清理 ═══
if (!KEEP) {
  for (const [panel, no] of created.reverse()) {
    for (const b of ['弃审', '删除']) {
      try { await post('/px/callButton', { panelCode: panel, buttonName: b, formData: { 编号: no }, buttonParam: {} }); } catch (e) { /* 未审核/已删 */ }
    }
  }
  console.log('\n   清理:已弃审/删除 ' + created.map(([, n]) => n).join(', '));
} else {
  console.log('\n   --keep:保留 ' + created.map(([p, n]) => p + ' ' + n).join(', ') + ' 供人工查看');
}

console.log('\n' + (fail ? `❌ ${fail} 项失败` : '✅ 全部通过'));
process.exit(fail ? 1 : 0);
