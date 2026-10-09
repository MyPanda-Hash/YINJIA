/**
 * _e2e-bin-preset.cjs — 采购入库「仓位」端到端验证(真实登录,测试账套)
 *
 * 验证用户口径(2026-10-09):
 *   ① 采购入库明细有「仓位」且与「仓库」有联系(候选按本行仓库收窄 —— 契约层验证);
 *   ② 预设仓位 = 物料默认 ⇢ 仓库默认兜底;
 *   ③ 启用仓位管理逐仓开启,开了的仓「仓位」必填。
 *
 * 前置夹具(先跑 archive/_pull-20261009/_bin-fixture.sql,仅测试账套):
 *   A仓(CK-A) 启用仓位管理=1;A1-09-1 = 该仓默认仓位;CL004 物料默认仓位=A1-10-1;A-32-01 默认仓位为空。
 *
 * 用法:node tools/archive/_pull-20261009/_e2e-bin-preset.cjs [factory]
 */
const BASE = 'http://127.0.0.1:8090/api';
const FACTORY = process.argv[2] || 'YJ_TEST';
const WH = 'A仓';                 // 夹具里启用了仓位管理、且标了默认仓位的仓(名称形态,与单据字段同口径)
const INSP_MAT = { code: 'CL004', name: '切削液', uom: '升' };       // 物料级默认仓位 A1-10-1
const FREE_MAT = { code: 'A-32-01', name: 'S阻垢炭棒/滤芯', uom: '支' }; // 无物料默认 → 走仓库默认 A1-09-1
const MAT_BIN = 'A1-10-1';
const WH_BIN = 'A1-09-1';

const results = [];
const docs = {};
const j = (o) => JSON.stringify(o);
const chk = (id, name, pass, detail) => {
  results.push({ id, name, pass: !!pass, detail: detail === undefined ? '' : String(detail) });
  console.log((pass ? '  ✅ PASS' : '  ❌ FAIL') + ' [' + id + '] ' + name + (detail === undefined ? '' : '  → ' + detail));
};
let auth = null;

const apiFetch = async (p, init = {}) => {
  const res = await fetch(BASE + p, init);
  let body; try { body = await res.json(); } catch { body = { code: res.status, message: 'non-json' }; }
  return { http: res.status, body };
};
const okRes = (r) => r && r.code === 200;
const msgOf = (r) => (r && (r.message || r.data?.message)) ? String(r.message || r.data.message) : j(r).slice(0, 200);
const jsonH = () => ({ 'Content-Type': 'application/json', ...auth.h });
const call = async (panel, button, formData) =>
  (await apiFetch('/px/callButton', { method: 'POST', headers: jsonH(), body: JSON.stringify({ panelCode: panel, buttonName: button, formData }) })).body;
const view = async (panel, no) => {
  const r = await apiFetch('/px/getFormDescriptor?panelCode=' + panel + '&code=' + encodeURIComponent(no), { headers: auth.h });
  const d = r.body?.data ?? {};
  return { head: d.data ?? {}, items: d.detailData?.items ?? [] };
};
const listAll = async (panel) => (await apiFetch('/px/queryFormDataList', {
  method: 'POST', headers: jsonH(), body: JSON.stringify({ panelCode: panel, pageNo: 1, pageSize: 500, condition: {} }),
})).body?.data?.list ?? [];
const cfg = async (panel) => (await apiFetch('/px/getPanelConfig?panelCode=' + panel, { headers: auth.h })).body?.data ?? {};
const piSet = async () => new Set((await listAll('PURCHASE_IN')).map((d) => d['编号']));
const today = () => new Date().toISOString().slice(0, 10);

function poLine(m, qty, price = 10) {
  return { 物料编码: m.code, 物料名称: m.name, 单位: m.uom, 数量: qty, 单价: price, 仓库: WH };
}

async function main() {
  console.log('采购入库「仓位」端到端验证  账套=' + FACTORY + '  仓库=' + WH + '  开始 ' + new Date().toLocaleString());

  // ── 0 真实登录 ──
  const login = (await apiFetch('/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }),
  })).body;
  auth = { h: { Authorization: 'Bearer ' + login.data.token } };
  chk('B0', '真实登录', okRes(login) && login.data.user.factory === FACTORY, 'factory=' + login.data?.user?.factory);

  // ── 1 契约层:字段登记按预期下发 ──
  console.log('\n=== B1 契约层(前端就靠这份配置渲染)===');
  const pin = await cfg('PURCHASE_IN');
  const fields = (pin.detail?.tabs || []).flatMap((t) => t.fields || []);
  const binF = fields.find((f) => f.dataName === '仓位');
  chk('B1.1', '采购入库明细有「仓位」字段且为参照', !!binF && binF.dataType === '参照',
    binF ? '类型=' + binF.dataType + ' 参照=' + binF.refPanel + '.' + binF.refField : '(未下发)');
  chk('B1.2', '「仓位」带级联过滤 ref_filter(仓库=$仓库)',
    binF?.filter?.['仓库'] === '$仓库', j(binF?.filter));
  chk('B1.3', '「仓位」排在「仓库」之后(seq 195 vs 190)',
    !!binF && fields.findIndex((f) => f.dataName === '仓位') > fields.findIndex((f) => f.dataName === '仓库'),
    '仓位 idx=' + fields.findIndex((f) => f.dataName === '仓位') + ' 仓库 idx=' + fields.findIndex((f) => f.dataName === '仓库'));

  const wl = await cfg('WHLOC');
  const wlFields = (wl.detail?.tabs || []).flatMap((t) => t.fields || []);
  chk('B1.4', '仓位档案有「是否默认」开关(可按仓标默认位)', wlFields.some((f) => f.dataName === '是否默认'),
    j(wlFields.filter((f) => f.dataName === '是否默认').map((f) => f.dataType)));

  const inv = await cfg('INV');
  const invFields = (inv.detail?.tabs || []).flatMap((t) => t.fields || []);
  const invBin = invFields.find((f) => f.dataName === '默认仓位');
  chk('B1.5', '商品档案「默认仓位」可见且为参照(物料级默认可维护)',
    !!invBin && invBin.dataType === '参照' && !invBin.hidden, invBin ? '类型=' + invBin.dataType + ' hidden=' + !!invBin.hidden : '(未下发)');

  // ── 2 候选收窄(级联的数据路径:前端解析 $仓库 后就是这个查询)──
  //   ⚠ WHLOC 是 singleDoc 面板:679 个仓位挂在 detail.locations 里,_不是_顶层行。
  //     参照机制(engine.queryRefRows)对 singleDoc 会按 detail.tabs[0].key 展平 ⇒ 这里照同一口径展平,
  //     否则会误判成「只出 1 行」(2026-10-09 首轮就踩了这个)。
  console.log('\n=== B2 候选收窄(选仓库 ⇒ 仓位候选只出该仓)===');
  const wlTabKey = (await cfg('WHLOC')).detail?.tabs?.[0]?.key || 'items';
  const binsOf = async (wh) => {
    const list = (await apiFetch('/px/queryFormDataList', {
      method: 'POST', headers: jsonH(),
      body: JSON.stringify({ panelCode: 'WHLOC', pageNo: 1, pageSize: 500, condition: { 仓库: wh } }),
    })).body?.data?.list ?? [];
    return list.flatMap((doc) => (doc?.detail?.[wlTabKey] || []));
  };
  const aBins = await binsOf(WH);
  const dBins = await binsOf('D仓');
  const allSame = aBins.length > 0 && aBins.every((r) => String(r['仓库']) === WH);
  chk('B2.1', '按仓库过滤仓位候选:' + WH + ' 只出该仓的位', allSame,
    '命中 ' + aBins.length + ' 个,全部属于该仓=' + allSame);
  chk('B2.2', '换一个仓(D仓)候选随之改变(不是全库 679 个)', dBins.length > 0 && dBins.length !== aBins.length
    && dBins.every((r) => String(r['仓库']) === 'D仓'),
    'D仓 ' + dBins.length + ' 个 vs ' + WH + ' ' + aBins.length + ' 个');
  chk('B2.3', '夹具的默认位与物料默认位都在 ' + WH + ' 的候选内',
    aBins.some((r) => String(r['仓位编码']) === WH_BIN) && aBins.some((r) => String(r['仓位编码']) === MAT_BIN),
    WH_BIN + '/' + MAT_BIN + ' 命中');

  // ── 3 物料默认优先:走检验链(CL004)──
  console.log('\n=== B3 预设·物料级优先(CL004 默认仓位=' + MAT_BIN + ')===');
  const po = await call('PU_ORDER', '保存', {
    单据日期: today(), 供应商: 'GYS00002', 币种: '人民币', 汇率: 1, detail: { items: [poLine(INSP_MAT, 60)] },
  });
  const poNo = po.data?.['编号'];
  await call('PU_ORDER', '审核', { 编号: poNo });
  const sl = await call('PU_ORDER', '生成送料暂收单', { 编号: poNo });
  const slNo = sl.data?.['编号'];
  await call('QC_RECV', '审核', { 编号: slNo });
  const gen = await call('QC_RECV', '生成检验或入库单', { 编号: slNo });
  const ijNo = gen.data?.['编号'];
  docs['B3'] = { po: poNo, sl: slNo, ij: ijNo };
  const ijv = await view('QC_INSP', ijNo);
  const saveIj = await call('QC_INSP', '保存', {
    ...Object.fromEntries(Object.entries(ijv.head).filter(([k]) => !['单据状态', '审核人', '审核时间', '审批状态', 'saved', '编号'].includes(k))),
    编号: ijNo,
    detail: { items: ijv.items.map((x) => ({ ...x, 送检数量: 60, 合格数量: 60, 不合格数量: 0 })) },
  });
  await call('QC_INSP', '审核', { 编号: ijNo });
  const piNo = (await view('QC_INSP', ijNo)).items[0]?.['入库单号'];
  docs['B3'].pi = piNo;
  const piv = await view('PURCHASE_IN', piNo);
  const line = piv.items[0] ?? {};
  chk('B3.1', '检验审核自动生成入库单', okRes(saveIj) && !!piNo, piNo);
  chk('B3.2', '入库行「仓库」= ' + WH, line['仓库'] === WH, '仓库=' + line['仓库']);
  chk('B3.3', '入库行「仓位」被预设为**物料默认** ' + MAT_BIN + '(优先于仓库默认 ' + WH_BIN + ')',
    line['仓位'] === MAT_BIN, '仓位=' + line['仓位']);

  // ── 4 仓库默认兜底:免检直达(A-32-01 无物料默认)──
  console.log('\n=== B4 预设·仓库级兜底(A-32-01 无物料默认 ⇒ 取 ' + WH_BIN + ')===');
  const po2 = await call('PU_ORDER', '保存', {
    单据日期: today(), 供应商: 'GYS00002', 币种: '人民币', 汇率: 1, detail: { items: [poLine(FREE_MAT, 30, 4)] },
  });
  const po2No = po2.data?.['编号'];
  await call('PU_ORDER', '审核', { 编号: po2No });
  const sl2 = await call('PU_ORDER', '生成送料暂收单', { 编号: po2No });
  const sl2No = sl2.data?.['编号'];
  await call('QC_RECV', '审核', { 编号: sl2No });
  const piB = await piSet();
  const gen2 = await call('QC_RECV', '生成检验或入库单', { 编号: sl2No });
  const pi2No = gen2.data?.['编号'];
  docs['B4'] = { po: po2No, sl: sl2No, pi: pi2No, goto: gen2.data?.gotoPanel };
  const p2v = await view('PURCHASE_IN', pi2No);
  const l2 = p2v.items[0] ?? {};
  chk('B4.1', '免检直达生成入库单', okRes(gen2) && gen2.data?.gotoPanel === 'PURCHASE_IN', pi2No);
  chk('B4.2', '入库行「仓位」= **仓库默认** ' + WH_BIN + '(物料没配默认时兜底)',
    l2['仓位'] === WH_BIN, '仓位=' + l2['仓位']);

  // ── 5 逐仓必填:该仓开了仓位管理,清空仓位应被拒 ──
  console.log('\n=== B5 逐仓必填(该仓启用仓位管理 ⇒ 仓位不得为空)===');
  const SKIP = ['单据状态', '审核人', '审核时间', '审批状态', 'saved', '编号'];
  const headOf = (h) => Object.fromEntries(Object.entries(h).filter(([k]) => !SKIP.includes(k)));
  const badSave = await call('PURCHASE_IN', '保存', {
    ...headOf(p2v.head), 编号: pi2No,
    detail: { items: p2v.items.map((x) => ({ ...x, 仓位: '' })) },
  });
  chk('B5.1', '清空仓位保存被拒(提示该仓库已启用仓位管理)',
    !okRes(badSave) && /仓位/.test(msgOf(badSave)) && /启用仓位管理/.test(msgOf(badSave)), msgOf(badSave));
  const goodSave = await call('PURCHASE_IN', '保存', {
    ...headOf(p2v.head), 编号: pi2No,
    detail: { items: p2v.items.map((x) => ({ ...x, 仓位: WH_BIN })) },
  });
  chk('B5.2', '填上仓位后保存放行', okRes(goodSave), msgOf(goodSave).slice(0, 120));
  const p2b = await view('PURCHASE_IN', pi2No);
  chk('B5.3', '仓位落到采购入库行(物理列 bl_purchase_in.仓位编码)',
    p2b.items[0]?.['仓位'] === WH_BIN, '读回=' + p2b.items[0]?.['仓位']);

  // ── 6 未启用仓位管理的仓:不预设、也不拦 ──
  console.log('\n=== B6 未启用仓位管理的仓(免检路径,不预设也不拦)===');
  const po3 = await call('PU_ORDER', '保存', {
    单据日期: today(), 供应商: 'GYS00002', 币种: '人民币', 汇率: 1,
    detail: { items: [{ ...poLine(FREE_MAT, 20, 3), 仓库: '华北工控仓' }] },
  });
  const po3No = po3.data?.['编号'];
  await call('PU_ORDER', '审核', { 编号: po3No });
  const sl3 = await call('PU_ORDER', '生成送料暂收单', { 编号: po3No });
  const sl3No = sl3.data?.['编号'];
  await call('QC_RECV', '审核', { 编号: sl3No });
  const gen3 = await call('QC_RECV', '生成检验或入库单', { 编号: sl3No });
  const pi3No = gen3.data?.['编号'];
  docs['B6'] = { po: po3No, sl: sl3No, pi: pi3No };
  const p3v = await view('PURCHASE_IN', pi3No);
  const l3 = p3v.items[0] ?? {};
  const emptyBin = l3['仓位'] === undefined || l3['仓位'] === null || String(l3['仓位']).trim() === '';
  chk('B6.1', '未启用仓位管理的仓:不预设仓位(留空给人选)', emptyBin && l3['仓库'] === '华北工控仓',
    '仓库=' + l3['仓库'] + ' 仓位=' + j(l3['仓位']));
  const save3 = await call('PURCHASE_IN', '保存', {
    ...headOf(p3v.head), 编号: pi3No, detail: { items: p3v.items.map((x) => ({ ...x, 仓位: '' })) },
  });
  chk('B6.2', '未启用仓位管理的仓:仓位留空也能保存(不误拦)', okRes(save3), msgOf(save3).slice(0, 120));

  const fail = results.filter((r) => !r.pass);
  console.log('\n=== 总结 ===');
  console.log('  用例 ' + results.length + ' 条:' + (results.length - fail.length) + ' PASS / ' + fail.length + ' FAIL');
  if (fail.length) console.log('  未过:' + fail.map((f) => f.id + ' ' + f.name).join(' | '));
  console.log('\n单据号:'); for (const [k, v] of Object.entries(docs)) console.log('  ' + k + ': ' + j(v));
  process.exitCode = fail.length ? 1 : 0;
}
main().catch((e) => { console.error('FATAL', e); process.exit(2); });
