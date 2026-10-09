/**
 * _e2e-purchase-chain.cjs — 采购→入库全流程端到端回归(真实登录,覆盖每一种分流)
 *
 * 口径依据(代码真源):
 *   · PanelConfigService.PUSH_TARGETS / SELECT_FLOWS / PANDA_BUTTONS
 *   · QcRecvGenerateHandler —— 送料暂收单「生成检验或入库单」按 bs_inv.来料检验 逐行分流
 *   · ButtonService.inspAutoPurchaseIn / inspAutoReturn —— 检验单审核自动双出口
 *   · ButtonService.returnAutoSpecialAccept —— 退料单「特采」勾选行 → 特采单
 *   · ButtonService.tcInApprovedGenerate —— 特采单二级批准 → 采购入库单(特采=是)
 *
 * 覆盖场景(每一条都是真实 HTTP 调用,不打桩):
 *   P0 真实登录与鉴权(两账套 factory、错口令、无令牌)
 *   P1 采购订单 →(草稿守卫)→ 送料暂收单
 *   P2 免检直达:暂收 → 采购入库单(bs_inv.来料检验 ≠ 是)
 *   P3 走检验·全合格:检验审核 → 采购入库单
 *   P4 走检验·全不合格:检验审核 → 暂收退回单(不特采)
 *   P5 特采全链:部分合格 → 入库(合格) + 退回(不合格) → 勾特采 → 特采单 → 两级审批 → 入库(特采=是)
 *   P6 混合分流:同单两行一免检一走检验;检验单两行一合格一不良
 *   P7 弃审级联守卫:下游已审核挡住弃审;下游草稿被联动作废
 *   P8 边界:手工特采单(无来源)审批不凭空入库;检验 0/0 不产生空单
 *
 * 用法:node tools/archive/_e2e-purchase-chain/_e2e-purchase-chain.cjs [factory]
 *   factory 默认 YJ_TEST(测试账套 —— 造数不污染正式账 HSDZ_MES)
 * 产物:_e2e-purchase-chain-result.json(逐步结果 + 单据号清单)
 */
const fs = require('node:fs');
const path = require('node:path');

const BASE = process.env.YINJIA_API_BASE || 'http://127.0.0.1:8090/api';
const FACTORY = process.argv[2] || process.env.YINJIA_E2E_FACTORY || 'YJ_TEST';
const CRED = { userName: 'admin', password: '123456' };
const SUP = 'GYS00002';
/** 启用中的仓库(bs_wh.状态='启用');采购链的「仓库」参照取的是**仓库名称**不是编码 */
const WH = '华北工控仓';
/** 已停用仓库(CK01 原料仓,bs_wh.停用=1 / 状态='停用')—— 用于「停用仓库不可过账」的负向用例 */
const WH_DISABLED = '原料仓';
/** 走检验链的物料(bs_inv.来料检验 = 是) */
const MAT_INSP = { code: 'CL004', name: '切削液', uom: '升' };
/** 免检直达的物料(bs_inv.来料检验 = 否) */
const MAT_FREE = { code: 'A-32-01', name: 'S阻垢炭棒/滤芯', uom: '支' };

const today = () => new Date().toISOString().slice(0, 10);
const results = [];
const docs = {};
let auth = null;

const j = (o) => JSON.stringify(o);
const log = (...a) => console.log(...a);
function chk(id, name, pass, detail) {
  results.push({ id, name, pass: !!pass, detail: detail === undefined ? '' : String(detail) });
  log((pass ? '  \u2705 PASS' : '  \u274c FAIL') + ' [' + id + '] ' + name + (detail === undefined ? '' : '  \u2192 ' + detail));
}
function section(t) { log('\n=== ' + t + ' ==='); }

// ───────────────────────── HTTP 基础设施 ─────────────────────────

async function apiFetch(p, init = {}) {
  const res = await fetch(BASE + p, init);
  let body;
  try { body = await res.json(); } catch { body = { code: res.status, message: 'non-json response' }; }
  return { http: res.status, body };
}
const okRes = (r) => r && r.code === 200;
const msgOf = (r) => (r && (r.message || r.data?.message)) ? String(r.message || r.data.message) : j(r).slice(0, 200);
const jsonHeaders = () => ({ 'Content-Type': 'application/json', ...auth.authHeader });

async function call(panel, button, formData) {
  const r = await apiFetch('/px/callButton', {
    method: 'POST', headers: jsonHeaders(),
    body: JSON.stringify({ panelCode: panel, buttonName: button, formData }),
  });
  return r.body;
}
async function view(panel, no) {
  const r = await apiFetch('/px/getFormDescriptor?panelCode=' + encodeURIComponent(panel) + '&code=' + encodeURIComponent(no),
    { headers: auth.authHeader });
  const d = r.body?.data ?? {};
  return { head: d.data ?? {}, items: d.detailData?.items ?? [], raw: d };
}
async function listAll(panel, pageSize = 500) {
  const r = await apiFetch('/px/queryFormDataList', {
    method: 'POST', headers: jsonHeaders(),
    body: JSON.stringify({ panelCode: panel, pageNo: 1, pageSize, condition: {} }),
  });
  return r.body?.data?.list ?? [];
}
const SAVE_HEAD_SKIP = new Set(['单据状态', '审核人', '审核时间', '审批状态', 'saved', '审批人', '审批时间', '编制人', '编号']);
/** 读回表单 → 改字段 → 原样保存(等价前端「修改→保存」) */
async function saveDoc(panel, no, patchHead = {}, mapItems = null) {
  const v = await view(panel, no);
  const head = {};
  for (const [k, val] of Object.entries(v.head)) if (!SAVE_HEAD_SKIP.has(k)) head[k] = val;
  Object.assign(head, patchHead);
  head['编号'] = no;
  const items = mapItems ? mapItems(v.items.map((x) => ({ ...x }))) : v.items.map((x) => ({ ...x }));
  const body = { ...head, detail: { items } };
  return call(panel, '保存', body);
}

// ───────────────────────── 链路查询小工具 ─────────────────────────

const notVoid = (d) => (d['单据状态'] || '') !== '已作废';
async function piSet() { return new Set((await listAll('PURCHASE_IN')).map((d) => d['编号'])); }
async function inspOfRecv(slNo) { return (await listAll('QC_INSP')).filter((d) => d['暂收单号'] === slNo && notVoid(d)); }
async function returnsOfInsp(ijNo) { return (await listAll('QC_RETURN')).filter((d) => d['检验单号'] === ijNo && notVoid(d)); }
async function tcsOfReturn(thNo) { return (await listAll('QC_TC_IN')).filter((d) => d['暂收退料单号'] === thNo && notVoid(d)); }
async function piOfInsp(ijNo) {
  const v = await view('QC_INSP', ijNo);
  return v.items.map((r) => r['入库单号']).filter(Boolean);
}
async function statusOf(panel, no) { return String((await view(panel, no)).head['单据状态'] ?? ''); }

// ───────────────────────── 造链 ─────────────────────────

function poLine(m, qty, price = 10) {
  return { 物料编码: m.code, 物料名称: m.name, 单位: m.uom, 数量: qty, 单价: price, 仓库: WH };
}
async function makePo(lines) {
  const r = await call('PU_ORDER', '保存', {
    单据日期: today(), 供应商: SUP, 币种: '人民币', 汇率: 1, detail: { items: lines },
  });
  if (!okRes(r)) throw new Error('采购订单保存失败: ' + msgOf(r));
  const no = r.data['编号'];
  const a = await call('PU_ORDER', '审核', { 编号: no });
  if (!okRes(a)) throw new Error('采购订单审核失败: ' + msgOf(a));
  return no;
}
async function genRecv(poNo) {
  const r = await call('PU_ORDER', '生成送料暂收单', { 编号: poNo });
  if (!okRes(r)) throw new Error('采购订单生送料暂收单失败: ' + msgOf(r));
  return r.data['编号'];
}
async function auditRecv(slNo) {
  const r = await call('QC_RECV', '审核', { 编号: slNo });
  if (!okRes(r)) throw new Error('送料暂收单审核失败: ' + msgOf(r));
  return r;
}
/** PO → 已审核暂收单(未生单) */
async function chainToRecv(lines) {
  const poNo = await makePo(lines);
  const slNo = await genRecv(poNo);
  await auditRecv(slNo);
  return { poNo, slNo };
}
/** PO → 暂收 → 生单 → 来料检验单号(要求该批物料「来料检验=是」) */
async function chainToInsp(lines) {
  const { poNo, slNo } = await chainToRecv(lines);
  const g = await call('QC_RECV', '生成检验或入库单', { 编号: slNo });
  if (!okRes(g)) throw new Error('暂收单生单失败: ' + msgOf(g));
  const insp = (await inspOfRecv(slNo))[0];
  if (!insp) throw new Error('暂收单未生成来料检验单');
  return { poNo, slNo, ijNo: insp['编号'] };
}
/** 填检验结果并审核 */
async function inspectAndAudit(ijNo, perLine) {
  const v = await view('QC_INSP', ijNo);
  const items = v.items.map((x) => ({ ...x }));
  perLine.forEach((p, i) => { if (items[i]) Object.assign(items[i], p); });
  const s = await saveDoc('QC_INSP', ijNo, {}, () => items);
  if (!okRes(s)) throw new Error('检验单保存失败: ' + msgOf(s));
  const a = await call('QC_INSP', '审核', { 编号: ijNo });
  if (!okRes(a)) throw new Error('检验单审核失败: ' + msgOf(a));
  return a;
}
/** 退料单:按行勾特采(勾选索引)→ 保存 → 审核 */
async function returnAuditWithTc(thNo, tcLineIndexes) {
  const v = await view('QC_RETURN', thNo);
  const items = v.items.map((x, i) => ({ ...x, 特采: tcLineIndexes.includes(i) }));
  const s = await saveDoc('QC_RETURN', thNo, {}, () => items);
  if (!okRes(s)) throw new Error('退回单保存失败: ' + msgOf(s));
  const a = await call('QC_RETURN', '审核', { 编号: thNo });
  return { save: s, audit: a };
}

// ───────────────────────── 场景 ─────────────────────────

async function P0_login() {
  section('P0 真实登录与鉴权');
  const good = await apiFetch('/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...CRED, factory: FACTORY }),
  });
  const token = good.body?.data?.token;
  const user = good.body?.data?.user ?? {};
  auth = { token, authHeader: { Authorization: 'Bearer ' + token } };
  chk('P0.1', '真实登录取到令牌(账号 admin/123456)', okRes(good.body) && !!token,
    'factory=' + user.factory + ' realName=' + user.realName + ' isAdmin=' + user.isAdmin);
  chk('P0.2', '登录账套 = ' + FACTORY, user.factory === FACTORY, user.factory);
  chk('P0.3', '管理员权限为全量可见/可审批', user.isAdmin === true && user.visiblePanels?.[0] === '*' && user.approvePanels?.[0] === '*',
    j(user.visiblePanels) + ' / ' + j(user.approvePanels));

  const bad = await apiFetch('/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: 'wrong-pass-xyz', factory: FACTORY }),
  });
  chk('P0.4', '错误口令被拒(真实鉴权生效)', !okRes(bad.body), 'code=' + bad.body?.code + ' msg=' + msgOf(bad.body));

  const noTok = await apiFetch('/px/queryFormDataList', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ panelCode: 'PURCHASE_IN', pageNo: 1, pageSize: 1, condition: {} }),
  });
  chk('P0.5', '无令牌访问业务接口被拒', !okRes(noTok.body), 'http=' + noTok.http + ' code=' + noTok.body?.code);

  const prod = await apiFetch('/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...CRED, factory: 'YJ' }),
  });
  chk('P0.6', '正式账套(HSDZ_MES)亦可真实登录', okRes(prod.body) && prod.body?.data?.user?.factory === 'YJ',
    'factory=' + prod.body?.data?.user?.factory);
}

async function P1_po_to_recv() {
  section('P1 采购订单 → 送料暂收单(含草稿守卫)');
  const po = await call('PU_ORDER', '保存', {
    单据日期: today(), 供应商: SUP, 币种: '人民币', 汇率: 1,
    detail: { items: [poLine(MAT_INSP, 100)] },
  });
  const poNo = po.data?.['编号'];
  docs['P1 采购订单'] = poNo;
  chk('P1.1', '建采购订单草稿', okRes(po) && !!poNo, poNo);

  const early = await call('PU_ORDER', '生成送料暂收单', { 编号: poNo });
  chk('P1.2', '草稿采购订单生单被拒(仅已审核可生单)', !okRes(early) && /审核/.test(msgOf(early)), msgOf(early));

  const aud = await call('PU_ORDER', '审核', { 编号: poNo });
  chk('P1.3', '采购订单审核', okRes(aud) && aud.data?.['单据状态'] === '已审核', msgOf(aud.data ?? aud));

  const gen = await call('PU_ORDER', '生成送料暂收单', { 编号: poNo });
  const slNo = gen.data?.['编号'];
  docs['P1 送料暂收单'] = slNo;
  chk('P1.4', '已审核采购订单生成送料暂收单', okRes(gen) && !!slNo,
    slNo + ' goto=' + gen.data?.gotoPanel + ' 批次号=' + gen.data?.['批次号'] + ' 批次键=' + gen.data?.['批次键']);

  const v = await view('QC_RECV', slNo);
  const it = v.items[0] ?? {};
  chk('P1.5', '暂收单带入行(物料/数量/单价/仓库)与单头(供应商/采购订单号/批次号)',
    it['物料编码'] === MAT_INSP.code && Number(it['数量']) === 100 && Number(it['单价']) === 10 &&
    v.head['供应商'] === SUP && v.head['采购订单号'] === poNo && !!v.head['批次号'],
    '行=' + it['物料编码'] + '/' + it['数量'] + ' 头供应商=' + v.head['供应商'] + ' 采购订单号=' + v.head['采购订单号'] + ' 批次号=' + v.head['批次号']);
  return { poNo, slNo };
}

async function P2_free_pass() {
  section('P2 免检直达:送料暂收单 → 采购入库单(商品档案「来料检验」≠ 是)');
  // 先建带草稿态的链,以便真实检查「草稿不可生单」守卫
  const poNo = await makePo([poLine(MAT_FREE, 50, 4)]);
  const slNo = await genRecv(poNo);
  docs['P2 采购订单'] = poNo; docs['P2 送料暂收单'] = slNo;

  const early = await call('QC_RECV', '生成检验或入库单', { 编号: slNo });
  chk('P2.1', '草稿暂收单生单被拒(未审核不可生单)', !okRes(early) && /审核/.test(msgOf(early)), msgOf(early));

  const auditSl = await call('QC_RECV', '审核', { 编号: slNo });
  chk('P2.1b', '暂收单审核', okRes(auditSl) && auditSl.data?.['单据状态'] === '已审核', msgOf(auditSl.data ?? auditSl));

  const inspBefore = await inspOfRecv(slNo);
  const piBefore = await piSet();
  const gen = await call('QC_RECV', '生成检验或入库单', { 编号: slNo });
  chk('P2.2', '已审核暂收单生单成功', okRes(gen), msgOf(gen.data ?? gen));
  chk('P2.3', '去向 = 采购入库单(免检直达,不产生来料检验单)',
    gen.data?.gotoPanel === 'PURCHASE_IN' && (await inspOfRecv(slNo)).length === inspBefore.length,
    'goto=' + gen.data?.gotoPanel + ' 生成清单=' + j(gen.data?.['生成清单']));

  const piNo = gen.data?.['编号'];
  docs['P2 采购入库单'] = piNo;
  const pv = await view('PURCHASE_IN', piNo);
  const pr = pv.items[0] ?? {};
  chk('P2.4', '入库行数量/标记正确(实收=暂收数量,是否来料检验=否,特采=否)',
    Number(pr['实收数量']) === 50 && pr['是否来料检验'] === '否' && pr['特采'] === '否' && pr['仓库'] === WH,
    '实收=' + pr['实收数量'] + ' 是否来料检验=' + pr['是否来料检验'] + ' 特采=' + pr['特采'] + ' 仓库=' + pr['仓库']);

  const again = await call('QC_RECV', '生成检验或入库单', { 编号: slNo });
  chk('P2.5', '重复生单被拒(无剩余可生单)', !okRes(again) && /剩余/.test(msgOf(again)), msgOf(again));

  const aud = await call('PURCHASE_IN', '审核', { 编号: piNo });
  chk('P2.6', '采购入库单审核(过账)', okRes(aud) && aud.data?.['单据状态'] === '已审核', msgOf(aud.data ?? aud));
  docs['P2 新入库单(生单)'] = piNo;
  docs['P2 新入库单号集'] = [...(await piSet())].filter((n) => !piBefore.has(n));
  return { poNo, slNo, piNo };
}

async function P3_all_pass() {
  section('P3 走检验·全合格:检验单审核 → 采购入库单');
  const { poNo, slNo, ijNo } = await chainToInsp([poLine(MAT_INSP, 100)]);
  docs['P3 采购订单'] = poNo; docs['P3 送料暂收单'] = slNo; docs['P3 来料检验单'] = ijNo;
  chk('P3.1', '暂收单分流到来料检验单(商品档案「来料检验」= 是)', !!ijNo, ijNo);

  const piB = await piSet();
  await inspectAndAudit(ijNo, [{ 送检数量: 100, 合格数量: 100, 不合格数量: 0 }]);
  const ijv = await view('QC_INSP', ijNo);
  const r0 = ijv.items[0] ?? {};
  chk('P3.2', '检验结果落库(送检100/合格100/不合格0)', Number(r0['合格数量']) === 100 && Number(r0['不合格数量'] || 0) === 0,
    '合格=' + r0['合格数量'] + ' 不合格=' + r0['不合格数量']);

  const piNo = r0['入库单号'];
  docs['P3 采购入库单'] = piNo;
  chk('P3.3', '审核后自动生成采购入库单并回填检验行「入库单号」', !!piNo && !piB.has(piNo), piNo ?? '(未回填)');

  const pv = await view('PURCHASE_IN', piNo);
  const pr = pv.items[0] ?? {};
  chk('P3.4', '入库行:实收=合格数量,是否来料检验=是,特采=否',
    Number(pr['实收数量']) === 100 && pr['是否来料检验'] === '是' && pr['特采'] === '否',
    '实收=' + pr['实收数量'] + ' 是否来料检验=' + pr['是否来料检验'] + ' 特采=' + pr['特采']);

  const ths = await returnsOfInsp(ijNo);
  chk('P3.5', '无不良数量 → 不生成暂收退回单(不产生空单)', ths.length === 0, '退回单数=' + ths.length);

  const aud = await call('PURCHASE_IN', '审核', { 编号: piNo });
  chk('P3.6', '入库单审核', okRes(aud) && aud.data?.['单据状态'] === '已审核', msgOf(aud.data ?? aud));
  return { poNo, slNo, ijNo, piNo };
}

async function P4_all_defect() {
  section('P4 走检验·全不合格:检验单审核 → 暂收退回单(不特采)');
  const { poNo, slNo, ijNo } = await chainToInsp([poLine(MAT_INSP, 80)]);
  docs['P4 采购订单'] = poNo; docs['P4 送料暂收单'] = slNo; docs['P4 来料检验单'] = ijNo;

  const piB = await piSet();
  await inspectAndAudit(ijNo, [{ 送检数量: 80, 合格数量: 0, 不合格数量: 80 }]);
  const piNew = [...(await piSet())].filter((n) => !piB.has(n));
  chk('P4.1', '合格=0 → 不生成采购入库单', piNew.length === 0, '新增入库单=' + j(piNew));

  const ths = await returnsOfInsp(ijNo);
  const thNo = ths[0]?.['编号'];
  docs['P4 暂收退回单'] = thNo;
  chk('P4.2', '不良=80 → 生成暂收退回单', ths.length === 1 && !!thNo, j(ths.map((d) => d['编号'] + '/' + d['单据状态'])));

  const tv = await view('QC_RETURN', thNo);
  const tr = tv.items[0] ?? {};
  chk('P4.3', '退回行:退货数量=不合格数量,送检数量带走,特采默认未勾',
    Number(tr['退货数量']) === 80 && Number(tr['送检数量']) === 80 && (tr['特采'] === false || tr['特采'] === 0),
    '退货=' + tr['退货数量'] + ' 送检=' + tr['送检数量'] + ' 特采=' + tr['特采']);
  chk('P4.4', '退回单头带入检验单号/供应商/采购订单号',
    tv.head['检验单号'] === ijNo && tv.head['供应商'] === SUP && tv.head['采购订单号'] === poNo,
    '检验单号=' + tv.head['检验单号'] + ' 供应商=' + tv.head['供应商']);

  const ra = await call('QC_RETURN', '审核', { 编号: thNo });
  const tcs = await tcsOfReturn(thNo);
  chk('P4.5', '退料单审核(不勾特采)→ 不生成特采单', okRes(ra) && tcs.length === 0,
    '状态=' + ra.data?.['单据状态'] + ' 特采单数=' + tcs.length);
  return { poNo, slNo, ijNo, thNo };
}

async function P5_special_accept() {
  section('P5 特采全链:部分合格 → 入库(合格) + 退回(不合格) → 勾特采 → 特采单 → 两级审批 → 入库(特采=是)');
  const { poNo, slNo, ijNo } = await chainToInsp([poLine(MAT_INSP, 100, 10)]);
  docs['P5 采购订单'] = poNo; docs['P5 送料暂收单'] = slNo; docs['P5 来料检验单'] = ijNo;

  const piB = await piSet();
  await inspectAndAudit(ijNo, [{ 送检数量: 100, 合格数量: 60, 不合格数量: 40 }]);
  const ijv = await view('QC_INSP', ijNo);
  const piPass = ijv.items[0]['入库单号'];
  docs['P5 合格入库单'] = piPass;
  const ths = await returnsOfInsp(ijNo);
  const thNo = ths[0]?.['编号'];
  docs['P5 暂收退回单'] = thNo;
  chk('P5.1', '检验审核双出口:合格行→采购入库单,不良行→暂收退回单', !!piPass && !!thNo,
    '入库=' + piPass + ' 退回=' + thNo);

  const pv = await view('PURCHASE_IN', piPass);
  chk('P5.2', '合格入库行:实收=60,特采=否', Number(pv.items[0]?.['实收数量']) === 60 && pv.items[0]?.['特采'] === '否',
    '实收=' + pv.items[0]?.['实收数量'] + ' 特采=' + pv.items[0]?.['特采']);

  const tv = await view('QC_RETURN', thNo);
  chk('P5.3', '退回行:退货=40 且 送检数量=100(特采单总数量的来源)', Number(tv.items[0]?.['退货数量']) === 40 && Number(tv.items[0]?.['送检数量']) === 100,
    '退货=' + tv.items[0]?.['退货数量'] + ' 送检=' + tv.items[0]?.['送检数量']);

  const { save, audit } = await returnAuditWithTc(thNo, [0]);
  const tv2 = await view('QC_RETURN', thNo);
  chk('P5.4', '退料明细行勾「特采」= 是 并保存落库', okRes(save) && tv2.items[0]?.['特采'] === true,
    '特采=' + tv2.items[0]?.['特采']);
  chk('P5.5', '退料单审核', okRes(audit) && audit.data?.['单据状态'] === '已审核', msgOf(audit.data ?? audit));

  const tcs = await tcsOfReturn(thNo);
  const tcNo = tcs[0]?.['编号'];
  docs['P5 特采单'] = tcNo;
  chk('P5.6', '退料单审核后自动逐行生成特采单', tcs.length === 1 && !!tcNo, j(tcs.map((d) => d['编号'] + '/' + d['单据状态'])));

  const tcv = await view('QC_TC_IN', tcNo);
  const th = tcv.head;
  chk('P5.7', '特采单取数正确(总数量=送检数量+单位 / 不合格品数量=退货数量 / 比例 / 检验单号 / 暂收退料单号)',
    th['总数量'] === '100升' && Number(th['不合格品数量']) === 40 && th['不合格品比例'] === '40%' &&
    th['检验单号'] === ijNo && th['暂收退料单号'] === thNo && th['供应商'] === SUP,
    '总数量=' + th['总数量'] + ' 不合格品数量=' + th['不合格品数量'] + ' 比例=' + th['不合格品比例'] + ' 检验单号=' + th['检验单号']);
  chk('P5.8', '特采单批次号/批次键随链继承', !!th['批次号'] && th['批次号'] === tv2.head['批次号'],
    '特采批次号=' + th['批次号'] + ' 退回批次号=' + tv2.head['批次号']);

  const early = await call('QC_TC_IN', '审批通过', { 编号: tcNo, 审批意见: '未提交直接批' });
  chk('P5.9', '未提交审批即点「审批通过」被拒(状态机守卫)', !okRes(early), msgOf(early));

  const sub = await call('QC_TC_IN', '提交审批', { 编号: tcNo });
  chk('P5.10', '提交审批', okRes(sub) && sub.data?.['单据状态'] === '审批中', msgOf(sub.data ?? sub));

  const piB2 = await piSet();
  const ap1 = await call('QC_TC_IN', '审批通过', { 编号: tcNo, 审批意见: '一级通过' });
  chk('P5.11', '一级审批通过 → 待二级审批(未生成入库单)', okRes(ap1) && ap1.data?.['单据状态'] === '待二级审批',
    msgOf(ap1.data ?? ap1));
  const afterL1 = [...(await piSet())].filter((n) => !piB2.has(n));
  chk('P5.12', '一级通过时【不】生成采购入库单(批准才算通过)', afterL1.length === 0, '新增入库单=' + j(afterL1));

  const ap2 = await call('QC_TC_IN', '审批通过', { 编号: tcNo, 审批意见: '二级批准' });
  chk('P5.13', '二级审批通过 → 已审核', okRes(ap2) && ap2.data?.['单据状态'] === '已审核', msgOf(ap2.data ?? ap2));

  const afterL2 = [...(await piSet())].filter((n) => !piB2.has(n));
  const piTc = afterL2[0];
  docs['P5 特采入库单'] = piTc;
  chk('P5.14', '二级批准 → 生成采购入库单(全部数量入库,不走退料)', afterL2.length === 1 && !!piTc, j(afterL2));

  const tpv = await view('PURCHASE_IN', piTc);
  chk('P5.15', '特采入库行:实收=特采单总数量(100),特采=是,是否来料检验=是',
    Number(tpv.items[0]?.['实收数量']) === 100 && tpv.items[0]?.['特采'] === '是' && tpv.items[0]?.['是否来料检验'] === '是',
    '实收=' + tpv.items[0]?.['实收数量'] + ' 特采=' + tpv.items[0]?.['特采'] + ' 是否来料检验=' + tpv.items[0]?.['是否来料检验']);

  const aud = await call('PURCHASE_IN', '审核', { 编号: piTc });
  chk('P5.16', '特采入库单审核(过账)', okRes(aud) && aud.data?.['单据状态'] === '已审核', msgOf(aud.data ?? aud));
  return { poNo, slNo, ijNo, thNo, tcNo, piPass, piTc };
}

async function P6_mixed() {
  section('P6 混合分流:一单两行(一免检一走检验)+ 检验单两行(一合格一不良)');
  const { poNo, slNo } = await chainToRecv([poLine(MAT_INSP, 100), poLine(MAT_FREE, 50, 4)]);
  docs['P6 采购订单'] = poNo; docs['P6 送料暂收单'] = slNo;

  const gen = await call('QC_RECV', '生成检验或入库单', { 编号: slNo });
  const made = gen.data?.['生成清单'] ?? [];
  docs['P6 生成清单'] = made.map((m) => m['面板'] + ':' + m['编号']).join(', ');
  chk('P6.1', '同一暂收单按行分流为两张单(来料检验单 + 采购入库单)', okRes(gen) && made.length === 2,
    j(made.map((m) => m['面板'] + '=' + m['编号'])));
  const madeInsp = made.find((m) => m['面板'] === 'QC_INSP');
  const madePi = made.find((m) => m['面板'] === 'PURCHASE_IN');
  docs['P6 来料检验单'] = madeInsp?.['编号']; docs['P6 免检入库单'] = madePi?.['编号'];

  const iv = await view('QC_INSP', madeInsp?.['编号']);
  const fv = await view('PURCHASE_IN', madePi?.['编号']);
  chk('P6.2', '分流不串行(检验单只含走检验物料,入库单只含免检物料)',
    iv.items.length === 1 && iv.items[0]['物料编码'] === MAT_INSP.code &&
    fv.items.length === 1 && fv.items[0]['存货编码'] === MAT_FREE.code,
    '检验单行=' + j(iv.items.map((r) => r['物料编码'])) + ' 入库单行=' + j(fv.items.map((r) => r['存货编码'])));

  // 检验单两行:行1 全合格、行2 全不良 —— 需先给检验单加第二行
  const items2 = [
    { ...iv.items[0], 送检数量: 40, 合格数量: 40, 不合格数量: 0 },
    { ...iv.items[0], id: undefined, 物料编码: MAT_INSP.code, 物料名称: MAT_INSP.name, 数量: 30, 送检数量: 30, 合格数量: 0, 不合格数量: 30 },
  ];
  const s = await call('QC_INSP', '保存', {
    ...Object.fromEntries(Object.entries(iv.head).filter(([k]) => !SAVE_HEAD_SKIP.has(k))),
    编号: madeInsp?.['编号'],
    detail: { items: items2 },
  });
  chk('P6.3', '检验单加行保存(一合格行 + 一不良行)', okRes(s), msgOf(s).slice(0, 120));

  const piB = await piSet();
  const aud = await call('QC_INSP', '审核', { 编号: madeInsp?.['编号'] });
  chk('P6.4', '检验单审核', okRes(aud), msgOf(aud.data ?? aud));
  const iv2 = await view('QC_INSP', madeInsp?.['编号']);
  const piNew = [...(await piSet())].filter((n) => !piB.has(n));
  const ths = await returnsOfInsp(madeInsp?.['编号']);
  chk('P6.5', '同一检验单同时产出 采购入库单(合格行) + 暂收退回单(不良行)',
    piNew.length === 1 && ths.length === 1,
    '新增入库=' + j(piNew) + ' 退回=' + j(ths.map((d) => d['编号'])));
  docs['P6 检验产出入库单'] = piNew[0];
  docs['P6 检验产出退回单'] = ths[0]?.['编号'];

  const pv2 = await view('PURCHASE_IN', piNew[0]);
  const tv2 = await view('QC_RETURN', ths[0]?.['编号']);
  chk('P6.6', '两出口各自数量正确(入库=40 合格;退回=30 不良)',
    pv2.items.length === 1 && Number(pv2.items[0]['实收数量']) === 40 &&
    tv2.items.length === 1 && Number(tv2.items[0]['退货数量']) === 30,
    '入库行=' + j(pv2.items.map((r) => r['实收数量'])) + ' 退回行=' + j(tv2.items.map((r) => r['退货数量'])));
  chk('P6.7', '检验行「入库单号」仅回填给合格行', (iv2.items.find((r) => Number(r['合格数量']) > 0)?.['入库单号'] ?? '') !== '' &&
    (iv2.items.find((r) => Number(r['合格数量']) === 0)?.['入库单号'] ?? '') === '',
    j(iv2.items.map((r) => ({ 合格: r['合格数量'], 入库单号: r['入库单号'] }))));
  return { poNo, slNo };
}

async function P7_unaudit_cascade() {
  section('P7 弃审级联与守卫');
  // 7A:下游入库单已审核 → 弃审检验单应被挡
  const a = await chainToInsp([poLine(MAT_INSP, 100)]);
  docs['P7A 检验单'] = a.ijNo;
  await inspectAndAudit(a.ijNo, [{ 送检数量: 100, 合格数量: 100, 不合格数量: 0 }]);
  const piA = (await piOfInsp(a.ijNo))[0];
  docs['P7A 入库单'] = piA;
  await call('PURCHASE_IN', '审核', { 编号: piA });

  const un1 = await call('QC_INSP', '弃审', { 编号: a.ijNo });
  chk('P7.1', '下游入库单已审核 → 弃审检验单被拒(提示先弃审入库单)',
    !okRes(un1) && /入库单/.test(msgOf(un1)), msgOf(un1));

  const unPi = await call('PURCHASE_IN', '弃审', { 编号: piA });
  chk('P7.2', '弃审入库单(库存冲回)', okRes(unPi), msgOf(unPi.data ?? unPi));

  const un2 = await call('QC_INSP', '弃审', { 编号: a.ijNo });
  const piSt = await statusOf('PURCHASE_IN', piA);
  const backFill = (await piOfInsp(a.ijNo)).length;
  chk('P7.3', '弃审检验单 → 自动生成的入库单草稿作废 + 回填清空',
    okRes(un2) && piSt === '已作废' && backFill === 0, '入库单状态=' + piSt + ' 回填数=' + backFill);

  // 7B:特采链弃审(特采单已审核 → 退料单不可弃审;逐级弃审后逐级作废)
  const b = await chainToInsp([poLine(MAT_INSP, 100, 10)]);
  docs['P7B 检验单'] = b.ijNo;
  await inspectAndAudit(b.ijNo, [{ 送检数量: 100, 合格数量: 60, 不合格数量: 40 }]);
  const thNo = (await returnsOfInsp(b.ijNo))[0]?.['编号'];
  await returnAuditWithTc(thNo, [0]);
  const tcNo = (await tcsOfReturn(thNo))[0]?.['编号'];
  docs['P7B 退回单'] = thNo; docs['P7B 特采单'] = tcNo;
  const piB2 = await piSet();
  await call('QC_TC_IN', '提交审批', { 编号: tcNo });
  await call('QC_TC_IN', '审批通过', { 编号: tcNo, 审批意见: '一级' });
  await call('QC_TC_IN', '审批通过', { 编号: tcNo, 审批意见: '二级' });
  const tcPi = [...(await piSet())].filter((n) => !piB2.has(n))[0];
  docs['P7B 特采入库单'] = tcPi;

  const unTh1 = await call('QC_RETURN', '弃审', { 编号: thNo });
  chk('P7.4', '特采单已审核 → 弃审退料单被拒(提示先弃审入库单与特采单)',
    !okRes(unTh1) && /特采单/.test(msgOf(unTh1)), msgOf(unTh1));

  const unTc = await call('QC_TC_IN', '弃审', { 编号: tcNo });
  const piSt2 = await statusOf('PURCHASE_IN', tcPi);
  chk('P7.5', '弃审特采单 → 它生成的入库单草稿被联动作废',
    okRes(unTc) && (await statusOf('QC_TC_IN', tcNo)) === '草稿' && piSt2 === '已作废',
    '特采单状态=' + (await statusOf('QC_TC_IN', tcNo)) + ' 入库单=' + tcPi + '/' + piSt2);

  const unTh2 = await call('QC_RETURN', '弃审', { 编号: thNo });
  chk('P7.6', '再弃审退料单 → 特采单草稿被联动作废',
    okRes(unTh2) && (await statusOf('QC_TC_IN', tcNo)) === '已作废',
    '退料单=' + (await statusOf('QC_RETURN', thNo)) + ' 特采单=' + (await statusOf('QC_TC_IN', tcNo)));

  const unInsp = await call('QC_INSP', '弃审', { 编号: b.ijNo });
  chk('P7.7', '弃审检验单(下游均已作废)', okRes(unInsp), msgOf(unInsp.data ?? unInsp));
}

async function P8_boundaries() {
  section('P8 边界:手工特采单不凭空入库;检验 0/0 不产生空单');
  const before = await piSet();
  const cfg = await apiFetch('/px/getPanelConfig?panelCode=QC_TC_IN', { headers: auth.authHeader });
  const schema = cfg.body?.data?.dataSchema?.fields ?? [];
  const opts = (n) => (schema.find((f) => f.dataName === n)?.options ?? [])[0] ?? '';
  const head = {
    单据日期: today(), 供应商: SUP, 产品名称: '手工特采验证(无来源链路)',
    总数量: '10升', 不合格品数量: 10, 不合格品比例: '100%',
    严重程度: opts('严重程度'), 最终处理结果: opts('最终处理结果'),
    不良说明: 'E2E 边界验证', 特采理由: 'E2E 边界验证:手工新建、无来源链路', 备注: 'E2E 边界验证',
  };
  const s = await call('QC_TC_IN', '保存', head);
  const tcNo = s.data?.['编号'];
  docs['P8 手工特采单'] = tcNo;
  chk('P8.1', '手工新建特采单(不设检验单号/暂收退料单号)', okRes(s) && !!tcNo, msgOf(s));

  if (tcNo) {
    await call('QC_TC_IN', '提交审批', { 编号: tcNo });
    await call('QC_TC_IN', '审批通过', { 编号: tcNo, 审批意见: '一级' });
    const ap2 = await call('QC_TC_IN', '审批通过', { 编号: tcNo, 审批意见: '二级' });
    const after = await piSet();
    const added = [...after].filter((n) => !before.has(n));
    chk('P8.2', '无来源链路的特采单批准后【不】生成采购入库单(不凭空入库)',
      okRes(ap2) && added.length === 0, '状态=' + (await statusOf('QC_TC_IN', tcNo)) + ' 新增入库=' + j(added));
  }

  const c = await chainToInsp([poLine(MAT_INSP, 50)]);
  docs['P8 检验单'] = c.ijNo;
  const piB = await piSet();
  await inspectAndAudit(c.ijNo, [{ 送检数量: 50, 合格数量: 0, 不合格数量: 0 }]);
  const piNew = [...(await piSet())].filter((n) => !piB.has(n));
  const thNew = await returnsOfInsp(c.ijNo);
  chk('P8.3', '合格=0 且 不良=0 → 两个出口都不生成空单', piNew.length === 0 && thNew.length === 0,
    '入库=' + j(piNew) + ' 退回=' + j(thNew.map((d) => d['编号'])));

  // P8.4 停用仓库:单据能建、能生单,但审核过账被拦(库存不会记到停用仓上)
  const d = await chainToRecv([{ ...poLine(MAT_FREE, 20, 3), 仓库: WH_DISABLED }]);
  docs['P8.4 采购订单'] = d.poNo; docs['P8.4 送料暂收单'] = d.slNo;
  const g = await call('QC_RECV', '生成检验或入库单', { 编号: d.slNo });
  const piNo = g.data?.['编号'];
  docs['P8.4 入库单'] = piNo;
  const audBad = piNo ? await call('PURCHASE_IN', '审核', { 编号: piNo }) : { code: -1, message: '生单失败' };
  const st = piNo ? await statusOf('PURCHASE_IN', piNo) : '?';
  chk('P8.4', '停用仓库的单据可建可生单,但审核过账被拦(整笔回滚,仍为草稿)',
    !okRes(audBad) && /仓库/.test(msgOf(audBad)) && st === '草稿', msgOf(audBad) + ' 状态=' + st);
}

async function P9_alt_paths() {
  section('P9 另一条生单路径 + 特采多行/驳回重提/数量兜底');

  // 9.1 检验单走「提交审批 → 审批通过」(而非「审核」)也必须自动双出口
  const a = await chainToInsp([poLine(MAT_INSP, 100)]);
  docs['P9.1 检验单'] = a.ijNo;
  await saveDoc('QC_INSP', a.ijNo, {}, (items) =>
    items.map((x) => ({ ...x, 送检数量: 100, 合格数量: 70, 不合格数量: 30 })));
  const piB = await piSet();
  const sub = await call('QC_INSP', '提交审批', { 编号: a.ijNo });
  const ap = await call('QC_INSP', '审批通过', { 编号: a.ijNo, 审批意见: '检验通过' });
  const piNew = [...(await piSet())].filter((n) => !piB.has(n));
  const ths = await returnsOfInsp(a.ijNo);
  docs['P9.1 入库单'] = piNew[0]; docs['P9.1 退回单'] = ths[0]?.['编号'];
  chk('P9.1', '检验单走「提交审批→审批通过」同样自动双出口(钩子不只在「审核」路径)',
    okRes(sub) && okRes(ap) && piNew.length === 1 && ths.length === 1,
    '提交=' + sub.data?.['单据状态'] + ' 通过=' + ap.data?.['单据状态'] + ' 入库=' + j(piNew) + ' 退回=' + j(ths.map((d) => d['编号'])));

  // 9.2 退回单两行都勾特采 → 一物料一单,生成两张特采单(发起走「审批通过」路径)
  const b = await chainToInsp([poLine(MAT_INSP, 100, 10), poLine(MAT_INSP, 60, 8)]);
  docs['P9.2 检验单'] = b.ijNo;
  await inspectAndAudit(b.ijNo, [
    { 送检数量: 100, 合格数量: 0, 不合格数量: 100 },
    { 送检数量: 60, 合格数量: 0, 不合格数量: 60 },
  ]);
  const thNo2 = (await returnsOfInsp(b.ijNo))[0]?.['编号'];
  docs['P9.2 退回单'] = thNo2;
  const tv = await view('QC_RETURN', thNo2);
  chk('P9.2a', '检验单两行全不良 → 退回单两行', tv.items.length === 2,
    j(tv.items.map((r) => r['退货数量'] + '/' + r['送检数量'])));
  await saveDoc('QC_RETURN', thNo2, {}, (items) => items.map((x) => ({ ...x, 特采: true })));
  const sub2 = await call('QC_RETURN', '提交审批', { 编号: thNo2 });
  const ap2 = await call('QC_RETURN', '审批通过', { 编号: thNo2, 审批意见: '退料确认' });
  const tcs2 = await tcsOfReturn(thNo2);
  const tcNos = tcs2.map((d) => d['编号']).sort();
  docs['P9.2 特采单'] = tcNos.join(', ');
  chk('P9.2b', '退料单走「提交审批→审批通过」发起特采;两行勾选各生成一张特采单(一物料一单)',
    okRes(sub2) && okRes(ap2) && tcs2.length === 2, '特采单=' + j(tcNos));
  const tcViews = await Promise.all(tcNos.map((n) => view('QC_TC_IN', n)));
  const totals = tcViews.map((v) => v.head['总数量']).sort();
  chk('P9.2c', '两张特采单各自取本行数量(100升 / 60升),比例 100%',
    totals.join('|') === '100升|60升' && tcViews.every((v) => v.head['不合格品比例'] === '100%'),
    j(tcViews.map((v) => v.head['总数量'] + '(' + v.head['不合格品比例'] + ')')));

  // 9.3 特采单被驳回 → 回草稿 → 重提 → 两级批准 → 生成入库单
  const tcX = tcNos[0];
  await call('QC_TC_IN', '提交审批', { 编号: tcX });
  const rej = await call('QC_TC_IN', '审批驳回', { 编号: tcX, 审批意见: '资料不全,退回补充' });
  const stAfterRej = await statusOf('QC_TC_IN', tcX);
  const piB3 = await piSet();
  chk('P9.3a', '特采单被驳回 → 回草稿(可修改重提)', okRes(rej) && stAfterRej === '草稿', '状态=' + stAfterRej);
  await call('QC_TC_IN', '提交审批', { 编号: tcX });
  const l1 = await call('QC_TC_IN', '审批通过', { 编号: tcX, 审批意见: '一级通过' });
  const l2 = await call('QC_TC_IN', '审批通过', { 编号: tcX, 审批意见: '二级批准' });
  const piNew3 = [...(await piSet())].filter((n) => !piB3.has(n));
  docs['P9.3 入库单'] = piNew3[0];
  chk('P9.3b', '重提后两级批准 → 生成采购入库单(特采=是)',
    okRes(l1) && okRes(l2) && piNew3.length === 1, '入库=' + j(piNew3));
  const p3 = piNew3[0] ? await view('PURCHASE_IN', piNew3[0]) : { items: [] };
  chk('P9.3c', '该入库行特采=是 且 实收=100', p3.items[0]?.['特采'] === '是' && Number(p3.items[0]?.['实收数量']) === 100,
    '实收=' + p3.items[0]?.['实收数量'] + ' 特采=' + p3.items[0]?.['特采']);

  // 9.4 数量守恒守卫:合格+不合格 不得超过送检数量
  // (因此「退料行送检数量为空」这条兜底分支**新单不可达**,只对 2026-10-04 之前的存量老单生效)
  const e = await chainToInsp([poLine(MAT_INSP, 45)]);
  docs['P9.4 检验单'] = e.ijNo;
  const badSave = await saveDoc('QC_INSP', e.ijNo, {}, (items) =>
    items.map((x) => ({ ...x, 送检数量: null, 合格数量: 0, 不合格数量: 45 })));
  const afterBad = await view('QC_INSP', e.ijNo);
  chk('P9.4', '数量守恒守卫:送检数量为空时「合格+不合格超量」被拒,且原值未被改写',
    !okRes(badSave) && /送检数量/.test(msgOf(badSave)) && Number(afterBad.items[0]?.['送检数量']) === 45,
    msgOf(badSave) + ' | 原送检数量=' + afterBad.items[0]?.['送检数量']);

  // 9.5 守恒成立(送检45 = 合格15 + 不合格30)放行,并走完特采链,校验非整数比例
  const okSave = await saveDoc('QC_INSP', e.ijNo, {}, (items) =>
    items.map((x) => ({ ...x, 送检数量: 45, 合格数量: 15, 不合格数量: 30 })));
  chk('P9.5', '守恒成立时放行(送检45 = 合格15 + 不合格30)', okRes(okSave), msgOf(okSave).slice(0, 120));
  await call('QC_INSP', '审核', { 编号: e.ijNo });
  const thNo4 = (await returnsOfInsp(e.ijNo))[0]?.['编号'];
  docs['P9.4 退回单'] = thNo4;
  if (thNo4) {
    await returnAuditWithTc(thNo4, [0]);
    const tc4 = (await tcsOfReturn(thNo4))[0]?.['编号'];
    docs['P9.4 特采单'] = tc4;
    const tvTc = tc4 ? (await view('QC_TC_IN', tc4)).head : {};
    chk('P9.6', '特采单总数量/比例按本行取数(45升 / 不合格30 → 66.7%)',
      tvTc['总数量'] === '45升' && tvTc['不合格品比例'] === '66.7%' && Number(tvTc['不合格品数量']) === 30,
      '总数量=' + tvTc['总数量'] + ' 不合格品数量=' + tvTc['不合格品数量'] + ' 比例=' + tvTc['不合格品比例']);
  }
}

// ───────────────────────── main ─────────────────────────
async function main() {
  log('采购→入库全流程 E2E(真实登录)　API=' + BASE + '　账套=' + FACTORY + '　开始 ' + new Date().toLocaleString());
  await P0_login();
  const p1 = await P1_po_to_recv();
  await P2_free_pass();
  const p3 = await P3_all_pass();
  const p4 = await P4_all_defect();
  const p5 = await P5_special_accept();
  await P6_mixed();
  await P7_unaudit_cascade();
  await P8_boundaries();
  await P9_alt_paths();

  docs['P1 链'] = j({ po: p1.poNo, sl: p1.slNo });
  docs['P3 链'] = j({ po: p3.poNo, sl: p3.slNo, ij: p3.ijNo, pi: p3.piNo });
  docs['P4 链'] = j({ po: p4.poNo, sl: p4.slNo, ij: p4.ijNo, th: p4.thNo });
  docs['P5 链'] = j(p5);

  const fail = results.filter((r) => !r.pass);
  section('总结');
  log('  用例 ' + results.length + ' 条:' + (results.length - fail.length) + ' PASS / ' + fail.length + ' FAIL');
  if (fail.length) log('  未过:' + fail.map((f) => f.id + ' ' + f.name).join(' | '));
  log('\n单据号:');
  for (const [k, v] of Object.entries(docs)) log('  ' + k + ': ' + v);

  const out = {
    ranAt: new Date().toISOString(), api: BASE, factory: FACTORY,
    total: results.length, passed: results.length - fail.length, failed: fail.length,
    results, docs,
  };
  const file = path.join(__dirname, '_e2e-purchase-chain-result.json');
  fs.writeFileSync(file, JSON.stringify(out, null, 2), 'utf8');
  log('\n结果已写入: ' + file);
  process.exitCode = fail.length ? 1 : 0;
}

main().catch((e) => { console.error('FATAL', e); process.exit(2); });
