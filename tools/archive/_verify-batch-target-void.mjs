/**
 * _verify-batch-target-void.mjs — 送料浮层「去向单号」绝不指向已作废/不存在的单据(2026-09-21)
 *
 * 用户报的缺陷:
 *   采购订单表头「送料」浮层里点「查看」跳到**暂收退回单(QC_RETURN)**时面板空白。
 *   查明:去向单号指向的单据已作废 —— 单据表里行还在(qc_return.asp_cancel='N'),但
 *   yj_doc_status.canceled='Y';面板列表按单据状态过滤(QueryService 排除 canceled='Y'),
 *   `?docNo=` 定位不到 → 空白。
 *
 * 修复口径(BatchService.resolveEndTarget):
 *   任何站点(含 QC_RETURN/QC_INSP/PURCHASE_IN/QC_RECV)命中 yj_doc_status.canceled/deleting='Y'
 *   或单据表 asp_cancel='Y' 或单头表里查不到 → **不能当终点**;
 *   候选作废时回退到链上「站数最多的有效单据」(有入库单→入库单;没有→检验单;再没有→暂收单);
 *   整条可达链(含起点)全部作废/不存在 → targetFormNo 置空 + **targetInvalid=true**(仍保留
 *   firstTargetPanel/firstTargetFormNo 排查),前端「查看」禁用、去向列显示「已作废」。
 *
 * 断言(6 组):
 *   ① 作废的**退料单**不作终点:链路 ACTIVE + 单据作废(脏数据)、表内 asp_cancel='Y'、正常作废(删除)
 *      三种情形,去向都**回退到有效单据**(检验单/入库单),不再指向作废退料单;
 *   ② 作废的**入库单**同样回退(上一轮场景回归);
 *   ③ **整链皆作废**:该批次行 targetInvalid=true、去向为空,界面「查看」禁用、去向列显示「已作废」;
 *   ④ 真实订单 YJ-20260915-11 逐行:改前(基线 JSON)vs 改后,逐行比对去向单据的作废状态,
 *      断言**没有任何一行的去向是作废/不存在的单据**;
 *   ⑤ 界面(CDP,打包应用 http://localhost:8090):浮层「去向单号」列 + 「查看」禁用态 = 接口数据;
 *      点一个有效行验证仍能跳到正确单据;
 *   ⑥ 回归:另跑 _verify-batch-target-chain.mjs 与 _verify-batch-no-at-inbound.mjs,须全 PASS。
 *
 * 用法: node tools/archive/_verify-batch-target-void.mjs
 *   env: YJ_API / YJ_FRONT / YJ_CDP_PORT / YJ_EDGE / YJ_SKIP_REGRESS=1(跳 ⑥)
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
// CDP 走浏览器级端点 + flatten 会话:本机页面级 ws 端点会被服务端 reset(详见 _cdp.mjs 头注)
import { attachCdp } from './_cdp.mjs';

const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const API = process.env.YJ_API || 'http://localhost:8090/api';
const FRONT = process.env.YJ_FRONT || 'http://localhost:8090';
const CDP_PORT = Number(process.env.YJ_CDP_PORT || 9477);
const EDGE = process.env.YJ_EDGE || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, msg) => { console.log(`  ${c ? '[PASS]' : '[FAIL]'} ${msg}`); if (!c) fails++; };
const info = (msg) => console.log(`         ${msg}`);

const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
const one = async (s) => (await q(s))[0] || null;
const N = (v) => (v === null || v === undefined ? '' : String(v).trim());
const esc = (v) => String(v == null ? '' : v).replace(/'/g, "''");

const lj = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json();
if (!lj?.data?.token) { console.error('登录失败:' + JSON.stringify(lj)); process.exit(1); }
const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + lj.data.token };
const post = async (url, body) => {
  const j = await (await fetch(API + url, { method: 'POST', headers: H, body: JSON.stringify(body) })).json();
  if (j.code !== 0 && j.code !== 200) throw new Error(`${url} → ${JSON.stringify(j).slice(0, 300)}`);
  return j.data;
};
const cb = (panelCode, buttonName, formData) => post('/px/callButton', { panelCode, buttonName, formData: formData || {}, buttonParam: {} });
const batchesOf = async (po) => ((await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: po })).batches) || [];
const rowOf = (bs, key) => bs.find((b) => Number(b.batchId) === Number(key)) || null;

/** 本次造出来的单据(用于收尾/异常清理;批次号按口径不回收,台账行留证) */
const CREATED = [];
const track = (panel, no) => { if (N(no)) CREATED.push({ panel, no: N(no) }); };
async function cleanupCreated() {
  const seen = new Set();
  for (const c of CREATED.slice().reverse()) {
    const k = `${c.panel}|${c.no}`;
    if (seen.has(k)) continue;
    seen.add(k);
    for (const b of ['弃审', '删除']) {
      try { await cb(c.panel, b, { 编号: c.no }); console.log(`  ${c.panel} ${c.no} ${b} ✓`); }
      catch (e) { console.log(`  ${c.panel} ${c.no} ${b} 跳过:${String(e.message).slice(0, 90)}`); }
    }
  }
}
// 探针中途抛错也要把自己造的单据清掉(否则残留草稿单干扰后续排查)
process.on('unhandledRejection', async (e) => { console.error('未捕获异常:' + (e?.message || e)); await cleanupCreated().catch(() => { }); process.exit(1); });
process.on('uncaughtException', async (e) => { console.error('未捕获异常:' + (e?.message || e)); await cleanupCreated().catch(() => { }); process.exit(1); });

// ============ 探针侧独立实现:单据有效性(与 BatchService.docState 同口径) ============
const HEAD = {};
for (const r of await q('SELECT panel_code, head_table FROM yj_panel')) HEAD[N(r.panel_code)] = N(r.head_table);

/** 三态:有效 / 已作废(yj_doc_status 或表内 asp_cancel) / 不存在(单头表查不到) */
async function docState(panel, no) {
  const st = await one(`SELECT ISNULL(canceled,'N') c, ISNULL(deleting,'N') d FROM yj_doc_status WHERE panel_code=N'${esc(panel)}' AND doc_no=N'${esc(no)}'`);
  if (st && (N(st.c) === 'Y' || N(st.d) === 'Y')) return '已作废';
  const t = HEAD[panel];
  if (t) {
    const rows = await q(`SELECT ISNULL(asp_cancel,'N') a FROM ${t} WHERE 单据编号=N'${esc(no)}'`);
    if (!rows.length) return '不存在';
    if (N(rows[0].a) === 'Y') return '已作废';
  }
  return '有效';
}

/** ACTIVE 下游(优先同批次 batch_id,该批次无链路时放宽为按单号匹配) */
async function nextStations(panel, no, batchId) {
  const sql = (b) => `SELECT DISTINCT target_panel_code p, target_form_no n FROM form_flow_link
    WHERE source_panel_code=N'${esc(panel)}' AND source_form_no=N'${esc(no)}' AND link_status='ACTIVE'
      AND target_form_no IS NOT NULL AND LTRIM(RTRIM(target_form_no))<>''` + (b ? ` AND batch_id=${Number(b)}` : '');
  let rows = await q(sql(batchId));
  if (!rows.length && batchId) rows = await q(sql(0));
  const PRIORITY = ['PURCHASE_IN', 'QC_RETURN', 'QC_INSP', 'QC_RECV'];
  const rank = (p) => { const i = PRIORITY.indexOf(p); return i < 0 ? PRIORITY.length : i; };
  return rows.map((r) => ({ p: N(r.p), n: N(r.n) })).filter((r) => r.p && r.n).sort((a, b) => rank(a.p) - rank(b.p));
}

/** 起点 → 沿 ACTIVE 链路广搜 → 站数最多的**有效**单据;整链皆无效 → invalid=true */
async function chainTerminal(startPanel, startNo, batchId) {
  const docs = new Map([[`${startPanel}|${startNo}`, { p: startPanel, n: startNo, d: 0 }]]);
  const queue = [{ p: startPanel, n: startNo, d: 0 }];
  while (queue.length) {
    const cur = queue.shift();
    if (cur.d >= 8) continue;
    for (const nx of await nextStations(cur.p, cur.n, batchId)) {
      const k = `${nx.p}|${nx.n}`;
      if (docs.has(k)) continue;
      const node = { p: nx.p, n: nx.n, d: cur.d + 1 };
      docs.set(k, node);
      queue.push(node);
    }
  }
  let end = null;
  for (const doc of docs.values()) {
    if ((await docState(doc.p, doc.n)) !== '有效') continue;
    if (!end || doc.d > end.d) end = doc;
  }
  if (!end) return { panel: '', no: '', depth: -1, invalid: true, path: [...docs.values()].map((d) => `${d.p} ${d.n}(${d.d})`) };
  return { panel: end.p, no: end.n, depth: end.d, invalid: false, path: [...docs.values()].map((d) => `${d.p} ${d.n}(${d.d})`) };
}

// ============ 选样:两张已审核、有剩余可送量、且不是 YJ-20260915-11 的采购订单 ============
console.log('=== 选样(造测试链,不动 YJ-20260915-11) ===');
const WH = N((await one(`SELECT TOP 1 仓库名称 w FROM bs_wh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 仓库名称=N'恒亿仓'`))?.w)
  || N((await one(`SELECT TOP 1 仓库名称 w FROM bs_wh WHERE ISNULL(asp_cancel,'N')<>'Y'`))?.w);
if (!WH) { console.error('bs_wh 无可用仓库(既有仓库校验会挡住入库审核)'); await pool.close(); process.exit(1); }
const list = (await post('/px/queryFormDataList', { panelCode: 'PU_ORDER', pageNo: 1, pageSize: 400 })).list || [];
const picks = [];
for (const r of list) {
  const no = N(r['单据编号']);
  if (N(r['单据状态']) !== '已审核' || no === 'YJ-20260915-11') continue;
  let ls;
  try { ls = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: no }); } catch { continue; }
  const line = (ls.lines || []).find((x) => Number(x.剩余数量) > 0);
  if (!line) continue;
  if (picks.some((p) => p.no === no)) continue;
  picks.push({ no, line });
  if (picks.length >= 2) break;
}
if (picks.length < 2) { console.error('找不到两张已审核 + 有剩余可送量的采购订单'); await pool.close(); process.exit(1); }
info(`采购订单A ${picks[0].no}(行 ${picks[0].line.行号} 剩余 ${picks[0].line.剩余数量})/ 采购订单B ${picks[1].no}(行 ${picks[1].line.行号} 剩余 ${picks[1].line.剩余数量});补仓库用:${WH}`);

/** 分批送料 → 暂收审核 → 生成检验单;返回 recv/insp/批次键 */
async function genToInsp(po, tag) {
  const QTY = Math.min(10, Number(po.line.剩余数量));
  const gen = await post('/px/batchFlow/generate', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: po.no, lines: [{ lineKey: po.line.lineKey, qty: QTY }] });
  const recv = N(gen['编号']);
  const led = await one(`SELECT TOP 1 id FROM yj_doc_batch WHERE source_form_no=N'${esc(po.no)}' AND target_form_no=N'${esc(recv)}'`);
  const key = Number(led?.id || 0);
  await cb('QC_RECV', '审核', { 编号: recv }); await sleep(700);
  const insp = N((await cb('QC_RECV', '生成来料检验单', { 编号: recv }))['编号']);
  await sleep(500);
  track('QC_RECV', recv); track('QC_INSP', insp);
  info(`[${tag}] 暂收单=${recv} 检验单=${insp} 批次键=${key}`);
  return { tag, po: po.no, recv, insp, key, qty: QTY };
}

/**
 * 检验单审核(不合格数量>0 → 自动生成退料单;合格数量=0 → 不生成入库单)
 * 注:qc_insp_detail.「不良数量」是**计算列**(= [不合格数量]),不能直接 UPDATE;
 *     而 ButtonService.inspAutoReturn 正是按 不良数量>0 汇总的,故这里写 不合格数量。
 *     validateInspQty 校验 合格数量+不合格数量 ≤ 送检数量,合格=0 时天然满足。
 */
async function auditInspWithDefect(insp, defectQty) {
  await q(`UPDATE qc_insp_detail SET 合格数量 = 0, 不合格数量 = ${Number(defectQty)}
           WHERE 单据编号=N'${esc(insp)}' AND ISNULL(asp_cancel,'N')<>'Y'`);
  await cb('QC_INSP', '审核', { 编号: insp }); await sleep(1100);
  const th = N((await one(`SELECT TOP 1 target_form_no n FROM form_flow_link WHERE source_panel_code='QC_INSP'
      AND source_form_no=N'${esc(insp)}' AND target_panel_code='QC_RETURN' AND link_status='ACTIVE'`))?.n);
  const pi = N((await one(`SELECT TOP 1 target_form_no n FROM form_flow_link WHERE source_panel_code='QC_INSP'
      AND source_form_no=N'${esc(insp)}' AND target_panel_code='PURCHASE_IN' AND link_status='ACTIVE'`))?.n);
  track('QC_RETURN', th); track('PURCHASE_IN', pi);
  return { th, pi };
}

/** 检验单审核(全部合格 → 自动生成采购入库单) */
async function auditInspAllPass(insp) {
  await q(`UPDATE qc_insp_detail SET 合格数量 = ISNULL(NULLIF(数量,0), 送检数量), 不合格数量 = 0
           WHERE 单据编号=N'${esc(insp)}' AND ISNULL(asp_cancel,'N')<>'Y'`);
  await cb('QC_INSP', '审核', { 编号: insp }); await sleep(1100);
  const pi = N((await one(`SELECT TOP 1 target_form_no n FROM form_flow_link WHERE source_panel_code='QC_INSP'
      AND source_form_no=N'${esc(insp)}' AND target_panel_code='PURCHASE_IN' AND link_status='ACTIVE'`))?.n);
  track('PURCHASE_IN', pi);
  if (pi) {   // 铺路过既有「仓库档案」校验(与本任务无关,同 _verify-batch-target-chain.mjs 注释)
    const w = await one(`SELECT TOP 1 ISNULL([仓库],N'') w FROM bl_purchase_in WHERE 单据编号=N'${esc(pi)}'`);
    if (w && N(w.w) === '') {
      await q(`UPDATE bl_purchase_in SET [仓库]=N'${esc(WH)}' WHERE 单据编号=N'${esc(pi)}'`);
      await q(`UPDATE bd_purchase_in SET [仓库]=N'${esc(WH)}' WHERE 单据编号=N'${esc(pi)}'`);
    }
  }
  return pi;
}

// ════════════ ① 作废的退料单不作终点 ════════════
console.log('\n=== ① 作废的退料单(QC_RETURN)不作终点:回退到有效单据 ===');
const A = await genToInsp(picks[0], 'A');
const aCreated = await auditInspWithDefect(A.insp, A.qty);
A.th = aCreated.th;
info(`检验单审核(不良数量=${A.qty},合格 0)→ 自动生成暂收退回单 ${A.th};未生成入库单(${aCreated.pi || '无'})`);
ok(!!A.th, `检验单审核自动生成暂收退回单 ${A.th}`);
const a1 = rowOf(await batchesOf(A.po), A.key);
info(`退料单生效时 接口行=${JSON.stringify(a1)}`);
ok(N(a1?.targetPanel) === 'QC_RETURN' && N(a1?.targetFormNo) === A.th && a1?.targetInvalid !== true,
  `退料单有效时去向 = 退料单(期望 QC_RETURN/${A.th},实得 ${N(a1?.targetPanel)}/${N(a1?.targetFormNo)})`);

// ①-1 脏数据:单据已作废(yj_doc_status.canceled='Y')但链路仍 ACTIVE —— 正是用户报的场景
await q(`UPDATE yj_doc_status SET canceled='Y', cancel_by=N'probe', cancel_at=GETDATE() WHERE panel_code='QC_RETURN' AND doc_no=N'${esc(A.th)}'`);
await sleep(200);
const a2 = rowOf(await batchesOf(A.po), A.key);
info(`①-1 单据作废但链路 ACTIVE 时 接口行=${JSON.stringify(a2)}`);
ok(N(a2?.targetFormNo) !== A.th, `去向**不指向**已作废的退料单 ${A.th}(实得 ${N(a2?.targetPanel)}/${N(a2?.targetFormNo)})`);
ok(N(a2?.targetPanel) === 'QC_INSP' && N(a2?.targetFormNo) === A.insp,
  `去向**回退**到链上有效单据 检验单(期望 QC_INSP/${A.insp},实得 ${N(a2?.targetPanel)}/${N(a2?.targetFormNo)})`);
const aT = await chainTerminal('QC_RECV', A.recv, A.key);
ok(N(a2?.targetPanel) === aT.panel && N(a2?.targetFormNo) === aT.no,
  `接口去向 = 探针独立算出的链路终点(${aT.panel} ${aT.no};可达链 ${aT.path.join(' → ')})`);

// ①-2 表内作废:qc_return.asp_cancel='Y'(yj_doc_status 还原)
await q(`UPDATE yj_doc_status SET canceled='N', cancel_by=NULL, cancel_at=NULL WHERE panel_code='QC_RETURN' AND doc_no=N'${esc(A.th)}'`);
await q(`UPDATE qc_return SET asp_cancel='Y' WHERE 单据编号=N'${esc(A.th)}'`);
await sleep(200);
const a3 = rowOf(await batchesOf(A.po), A.key);
info(`①-2 表内 asp_cancel='Y' 时 接口行=${JSON.stringify(a3)}`);
ok(N(a3?.targetFormNo) !== A.th && N(a3?.targetPanel) === 'QC_INSP',
  `表内 asp_cancel='Y' 同样不作终点(实得 ${N(a3?.targetPanel)}/${N(a3?.targetFormNo)})`);
await q(`UPDATE qc_return SET asp_cancel='N' WHERE 单据编号=N'${esc(A.th)}'`);
await sleep(200);

// ①-3 正常作废(退料单是草稿 → 删除 = voidDoc):链路转 RELEASED,去向仍回退到检验单
let aVoidMsg = '已作废';
try { await cb('QC_RETURN', '删除', { 编号: A.th }); } catch (e) { aVoidMsg = '删除被拒:' + String(e.message).slice(0, 90); }
await sleep(700);
const a4 = rowOf(await batchesOf(A.po), A.key);
const aState = await docState('QC_RETURN', A.th);
const aLink = await one(`SELECT TOP 1 link_status s FROM form_flow_link WHERE target_panel_code='QC_RETURN' AND target_form_no=N'${esc(A.th)}'`);
info(`①-3 作废结果:${aVoidMsg};退料单状态=${aState};链路=${N(aLink?.s)};接口行=${JSON.stringify(a4)}`);
ok(aState === '已作废', `退料单 ${A.th} 已命中作废口径(实得 ${aState})`);
ok(N(a4?.targetFormNo) !== A.th, `去向**不指向**已作废的退料单 ${A.th}`);
ok(N(a4?.targetPanel) === 'QC_INSP' && N(a4?.targetFormNo) === A.insp,
  `去向回退到检验单(期望 QC_INSP/${A.insp},实得 ${N(a4?.targetPanel)}/${N(a4?.targetFormNo)})`);

// ════════════ ② 作废的入库单同样回退(上一轮场景回归) ════════════
console.log('\n=== ② 作废的采购入库单不作终点:回退到检验单 ===');
const B = await genToInsp(picks[1], 'B');
B.pi = await auditInspAllPass(B.insp);
ok(!!B.pi, `检验单审核自动生成采购入库单 ${B.pi}`);
const b1 = rowOf(await batchesOf(B.po), B.key);
info(`入库单生效时 接口行=${JSON.stringify(b1)}`);
ok(N(b1?.targetPanel) === 'PURCHASE_IN' && N(b1?.targetFormNo) === B.pi,
  `去向 = 采购入库单(期望 PURCHASE_IN/${B.pi},实得 ${N(b1?.targetPanel)}/${N(b1?.targetFormNo)})`);
await cb('PURCHASE_IN', '审核', { 编号: B.pi }); await sleep(900);
let bVoidMsg = '已作废';
try { await cb('PURCHASE_IN', '弃审', { 编号: B.pi }); } catch (e) { bVoidMsg = '弃审被拒:' + String(e.message).slice(0, 80); }
await sleep(500);
try { await cb('PURCHASE_IN', '删除', { 编号: B.pi }); } catch (e) { bVoidMsg = '删除被拒:' + String(e.message).slice(0, 80); }
await sleep(800);
const b2 = rowOf(await batchesOf(B.po), B.key);
const bState = await docState('PURCHASE_IN', B.pi);
info(`作废操作:${bVoidMsg};入库单状态=${bState};接口行=${JSON.stringify(b2)}`);
ok(bState === '已作废', `入库单 ${B.pi} 已命中作废口径(实得 ${bState})`);
ok(N(b2?.targetPanel) === 'QC_INSP' && N(b2?.targetFormNo) === B.insp,
  `去向回退到检验单(期望 QC_INSP/${B.insp},实得 ${N(b2?.targetPanel)}/${N(b2?.targetFormNo)})`);
ok(N(b2?.targetFormNo) !== B.pi, `去向**不指向已作废**的入库单 ${B.pi}`);

// ════════════ ③ 整链皆作废 → targetInvalid=true + 去向为空 ════════════
console.log('\n=== ③ 整链皆作废:targetInvalid=true、去向为空,行仍在浮层里 ===');
// ③-a 造的链:把 暂收单/检验单 也作废(入库单/退料单已在 ② 作废)
let cascMsg = '';
try { await cb('QC_INSP', '弃审', { 编号: B.insp }); cascMsg += '检验弃审✓'; } catch (e) { cascMsg += '检验弃审✗' + String(e.message).slice(0, 60); }
await sleep(700);
try { await cb('QC_RECV', '弃审', { 编号: B.recv }); cascMsg += ' 暂收弃审✓'; } catch (e) { cascMsg += ' 暂收弃审✗' + String(e.message).slice(0, 60); }
await sleep(700);
for (const [p, no] of [['QC_INSP', B.insp], ['QC_RECV', B.recv]]) {
  try { await cb(p, '删除', { 编号: no }); cascMsg += ` ${p}删除✓`; } catch (e) { cascMsg += ` ${p}删除✗` + String(e.message).slice(0, 50); }
}
await sleep(800);
const b3 = rowOf(await batchesOf(B.po), B.key);
const bStates = { 暂收: await docState('QC_RECV', B.recv), 检验: await docState('QC_INSP', B.insp), 入库: await docState('PURCHASE_IN', B.pi) };
info(`作废级联:${cascMsg};三单状态=${JSON.stringify(bStates)};接口行=${JSON.stringify(b3)}`);
ok(Object.values(bStates).every((s) => s === '已作废'), `整条链上的单据全部已作废(${JSON.stringify(bStates)})`);
ok(!!b3, `整链皆作废的批次行**仍出现在浮层数据里**(batchId=${B.key})`);
ok(b3?.targetInvalid === true, `targetInvalid=true(实得 ${JSON.stringify(b3?.targetInvalid)})`);
ok(N(b3?.targetFormNo) === '' && N(b3?.targetPanel) === '',
  `targetFormNo/targetPanel 置空,不再给作废单号(实得 "${N(b3?.targetPanel)}"/"${N(b3?.targetFormNo)}")`);
ok(N(b3?.firstTargetPanel) === 'QC_RECV' && N(b3?.firstTargetFormNo) === B.recv,
  `起点仍保留在 firstTarget*(排查用:期望 QC_RECV/${B.recv},实得 ${N(b3?.firstTargetPanel)}/${N(b3?.firstTargetFormNo)})`);
const bT = await chainTerminal('QC_RECV', B.recv, B.key);
ok(bT.invalid === true && N(b3?.targetFormNo) === '', `探针独立复算同样判「整链无效」(可达链 ${bT.path.join(' → ')})`);

// ③-b 真实数据里整链皆作废的批次(YJ-20260915-11 batchId=38:暂收单已作废,链路全 RELEASED)
console.log('  ── ③-b 真实订单里整链皆作废的批次(YJ-20260915-11 batchId=38/39) ──');
const realRows0 = await batchesOf('YJ-20260915-11');
for (const key of [38, 39]) {
  const r0 = rowOf(realRows0, key);
  const st = { 暂收: await docState('QC_RECV', N(r0?.firstTargetFormNo)) };
  info(`batchId=${key} 起点 ${N(r0?.firstTargetPanel)}/${N(r0?.firstTargetFormNo)}(${st.暂收}) 接口行=${JSON.stringify(r0)}`);
  ok(r0?.targetInvalid === true && N(r0?.targetFormNo) === '',
    `batchId=${key}:起点已作废 → targetInvalid=true 且去向为空(实得 ${JSON.stringify(r0?.targetInvalid)}/"${N(r0?.targetFormNo)}")`);
}

// ════════════ ④ 真实订单 YJ-20260915-11 逐行对照(改前 vs 改后) ════════════
console.log('\n=== ④ 真实订单 YJ-20260915-11 逐行:改前 vs 改后 + 去向单据作废状态 ===');
const PO_REAL = 'YJ-20260915-11';
const baseFile = 'tools/archive/_v-void-before.json';
let before = {};
if (fs.existsSync(baseFile)) {
  try { before = (JSON.parse(fs.readFileSync(baseFile, 'utf8')).orders || {})[PO_REAL] || []; } catch { before = []; }
}
if (!before.length) info(`(未找到改前基线 ${baseFile},「改前」列留空)`);
const realRows = await batchesOf(PO_REAL);
const table = [];
let voidTargets = 0, changed = 0;
for (const r of realRows) {
  const no = N(r.targetFormNo);
  const state = no ? await docState(N(r.targetPanel), no) : '(去向为空)';
  const b4 = before.find((x) => Number(x.batchId) === Number(r.batchId));
  const beforeNo = b4 ? N(b4.targetFormNo) : '';
  const beforeState = beforeNo ? await docState(N(b4.targetPanel), beforeNo) : '';
  if (state === '已作废' || state === '不存在') voidTargets++;
  if (beforeNo !== no) changed++;
  table.push({
    批次键: r.batchId, 批次号: N(r.batchNo) || '(待编号)', 状态: N(r.status),
    台账原始去向: `${N(r.firstTargetPanel)}/${N(r.firstTargetFormNo)}`,
    '改前去向(修复前)': beforeNo ? `${N(b4.targetPanel)}/${beforeNo}` : '(空)',
    '改前去向单据状态': beforeState || '-',
    '改后去向(修复后)': no ? `${N(r.targetPanel)}/${no}` : '(空)',
    '改后去向单据状态': state,
    targetInvalid: r.targetInvalid === true,
  });
  const good = r.targetInvalid === true ? no === '' : state === '有效';
  ok(good, `批次键 ${r.batchId}(${N(r.batchNo) || '待编号'}):改后去向 ${no || '(空/已作废)'} → ${r.targetInvalid === true ? 'targetInvalid=true(不给作废单号)' : '单据状态=' + state}`);
}
console.log('  改前/改后逐行对照表:');
console.table(table);
ok(voidTargets === 0, `**没有任何一行**的去向是已作废/不存在的单据(命中 ${voidTargets} 行)`);
ok(changed > 0, `确有批次行的去向被修正(改前 ≠ 改后 的行数 = ${changed})`);
const beforeVoid = table.filter((r) => r['改前去向单据状态'] === '已作废').length;
info(`改前 YJ-20260915-11 有 ${beforeVoid} 行的去向指向已作废单据(点击「查看」→ 面板空白),改后全部消除`);

// ════════════ ⑤ 界面(CDP,打包应用) ════════════
console.log(`\n=== ⑤ 界面(CDP ${FRONT}):去向单号列 + 「查看」禁用态 = 接口;有效行仍可跳转 ===`);

// ── ⑤-0 「面板没数据」的机理与根治(接口层,先钉症状再钉修复) ──
// 点「查看」= 跳 /panelx/list/<去向面板>?docNo=<去向单号>:前端把它塞进列表条件 _docNo(PanelxList.applyDocNoQuery),
// 后端按 单据编号 LIKE 定位,但列表查询末尾统一排除 yj_doc_status.canceled='Y'(QueryService.queryDocs)。
// 于是**去向单号只要已作废(或压根不存在),定位就是 0 行 → 左栏空白 = 用户说的「面板没数据」**。
const locate = async (panel, no) => {
  const d = await post('/px/queryFormDataList', { panelCode: panel, condition: { _docNo: no }, pageNo: 1, pageSize: 20 });
  return { total: Number(d?.totalSize || 0), no: N((d?.list || [])[0]?.['单据编号']) };
};
// 症状对照:同面板上「作废单号」与「有效单号」的定位结果(只读,不改数据)
const thVoid = N((await one(`SELECT TOP 1 l.target_form_no n FROM form_flow_link l
    JOIN yj_doc_status s ON s.panel_code='QC_RETURN' AND s.doc_no=l.target_form_no AND s.canceled='Y'
   WHERE l.target_panel_code='QC_RETURN' ORDER BY l.target_form_no`))?.n);
const thAlive = N((await one(`SELECT TOP 1 l.target_form_no n FROM form_flow_link l
   WHERE l.target_panel_code='QC_RETURN' AND NOT EXISTS (SELECT 1 FROM yj_doc_status s
     WHERE s.panel_code='QC_RETURN' AND s.doc_no=l.target_form_no AND ISNULL(s.canceled,'N')='Y')
   ORDER BY l.target_form_no`))?.n);
if (thVoid) {
  const r = await locate('QC_RETURN', thVoid);
  info(`[症状] 已作废退料单 QC_RETURN/${thVoid} ?docNo= 定位到 ${r.total} 张(单据状态=${await docState('QC_RETURN', thVoid)})`);
  ok(r.total === 0, `已作废的退料单号在面板里定位 **0 行** → 直接点进去就是空白(复现用户报的「面板没数据」:${thVoid})`);
}
if (thAlive) {
  const r = await locate('QC_RETURN', thAlive);
  info(`[对照] 有效退料单 QC_RETURN/${thAlive} ?docNo= 定位到 ${r.total} 张(单据状态=${await docState('QC_RETURN', thAlive)})`);
  ok(r.total >= 1, `有效退料单号仍能定位(本次修复不误伤正常去向:${thAlive} → ${r.total} 张)`);
}
// 反向:_改前_那些「作废去向」拿去定位,逐行复现空白面板(基线 JSON 里的改前态)
let repro = 0;
for (const b of before) {
  const no = N(b.targetFormNo);
  if (!no || !N(b.targetPanel)) continue;
  if ((await docState(N(b.targetPanel), no)) !== '已作废') continue;
  const r = await locate(N(b.targetPanel), no);
  repro++;
  ok(r.total === 0, `[复现] 改前去向 ${N(b.targetPanel)}/${no} 面板定位 ${r.total} 行 → 点「查看」必空白`);
}
info(`④ 的改前态里命中「作废去向 → 面板 0 行」的行数 = ${repro}`);
// 正向:修复后**每一行**的去向(给了单号的)都必须能被面板定位到 —— 这是「不再跳到空白」的可执行定义
let located = 0, badLocate = 0;
for (const r of realRows) {
  const no = N(r.targetFormNo);
  if (!no) continue;                       // targetInvalid:不给单号(前端「查看」禁用),无需定位
  const hit = await locate(N(r.targetPanel), no);
  located++;
  if (hit.total < 1) { badLocate++; ok(false, `批次键 ${r.batchId} 的去向 ${N(r.targetPanel)}/${no} 面板定位 0 行`); }
}
ok(badLocate === 0, `修复后 ${located} 行的去向**全部**能被面板 ?docNo= 定位到(不可定位 ${badLocate} 行)`);

// ── UI 段(CDP)开关(2026-09-21):
// 本机 Edge 的**渲染进程起不来**(实测 `--screenshot`/`--dump-dom` 连 about:blank 都以退出码 13 失败;
// 页面级 CDP ws 一发命令即 ECONNRESET,浏览器级端点正常但一 attach 会话就断),
// 故允许 YJ_SKIP_UI=1 跳过界面实测;跳过时改为对**已发布静态包**做静态断言
// (确认「查看」禁用 + 「已作废」兜底确实进了构建产物),并打印 [SKIP]——不冒充 PASS。
const SKIP_UI = process.env.YJ_SKIP_UI === '1';
let edge = null;
let cdp = null;
let send = null;
let ev = null;
if (SKIP_UI) {
  console.log('  [SKIP] CDP 界面实测(按 YJ_SKIP_UI=1 跳过;同构建的界面实测原始输出见 tools/archive/_v-void-run2.txt)');
  const staticDir = path.join('backend', 'src', 'main', 'resources', 'static', 'assets');
  const chunk = fs.existsSync(staticDir) ? fs.readdirSync(staticDir).find((f) => /^PanelxList-.*\.js$/.test(f)) : null;
  ok(!!chunk, `已发布静态包存在 PanelxList 分块(${staticDir}${chunk ? ' → ' + chunk : ' 未找到'})`);
  if (chunk) {
    const js = fs.readFileSync(path.join(staticDir, chunk), 'utf8');
    ok(js.includes('targetInvalid'), `已发布 ${chunk} 含 targetInvalid 判定(去向为空/整链作废 → 「查看」禁用)`);
    ok(js.includes('已作废'), `已发布 ${chunk} 含「已作废」兜底文案(去向为空时列内显示)`);
  }
} else {
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-bvoid-'));
edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, 'about:blank'],
  // detached 必需:本机 node 普通 spawn 拉起的 Edge 会立刻以 0x80000003(STATUS_BREAKPOINT)退出,
  // CDP 端口永远起不来(实测 plain/false → 秒退;detached / cmd start → 正常)。
  { stdio: 'ignore', detached: true });
let tab = null;
for (let i = 0; i < 40 && !tab; i++) {
  await sleep(1000);
  try { const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json(); } catch { /* 等 Edge 起来 */ }
}
if (!tab) { console.error('Edge CDP 未就绪'); await pool.close(); edge.kill(); process.exit(1); }
// 挂到该页面目标(浏览器级端点 + flatten 会话;页面级 ws 在本机会被 reset,详见 _cdp.mjs 头注)
cdp = await attachCdp(CDP_PORT, tab.id);
send = cdp.send;
ev = cdp.ev;
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1000, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `${FRONT}/#/login` });
await sleep(2500);
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lj.data.token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lj.data.user))});
localStorage.setItem('mes_login_date','2026-09-21'); localStorage.setItem('mes_locale','zh-CN'); 'ok'`);
await send('Page.navigate', { url: `${FRONT}/?_v=${Date.now()}#/panelx/list/PU_ORDER?docNo=${encodeURIComponent(PO_REAL)}` });
let ready = false;
for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`!!document.querySelector('.batch-sum-line')`)) { ready = true; break; } }
await sleep(2500);
ok(ready, '打开采购订单 YJ-20260915-11 且出现表头「送料」摘要行');
await ev(`document.querySelector('.batch-sum-line').click(), 'ok'`);
await sleep(2200);
const READ = `(() => {
  const pop = document.querySelector('.batch-pop-body');
  const hd = pop ? pop.querySelector('.el-table__header-wrapper table') : null;
  const tb = pop ? pop.querySelector('.el-table__body-wrapper table') : null;
  return {
    popOpen: !!pop,
    cols: hd ? [...hd.querySelectorAll('thead th')].map((th) => th.textContent.trim()).filter(Boolean) : [],
    rows: tb ? [...tb.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent.replace(/\\s+/g,' ').trim())) : [],
    disabled: tb ? [...tb.querySelectorAll('tbody tr')].map((tr) => { const b = tr.querySelector('.el-button'); return b ? !!b.disabled : null; }) : [],
  };
})()`;
const st = await ev(READ);
info(`浮层列头=${JSON.stringify(st?.cols)}`);
console.log('  浮层逐行:');
console.table(st?.rows || []);
ok(!!st?.popOpen, '点摘要行弹出浮层');
ok((st?.rows || []).length === realRows.length, `浮层行数 = 接口批次行数(${(st?.rows || []).length}/${realRows.length})`);
const uiNos = (st?.rows || []).map((r) => r[4]);
const expectNos = realRows.map((r) => N(r.targetFormNo) || '已作废');
ok(JSON.stringify(uiNos) === JSON.stringify(expectNos),
  `浮层「去向单号」列 = 接口(有值→单号 / 空→已作废)(界面 ${JSON.stringify(uiNos)} / 期望 ${JSON.stringify(expectNos)})`);
const expectDisabled = realRows.map((r) => (r.targetInvalid === true || !N(r.targetFormNo)));
ok(JSON.stringify(st?.disabled) === JSON.stringify(expectDisabled),
  `「查看」禁用态 = 接口 targetInvalid/去向为空(界面 ${JSON.stringify(st?.disabled)} / 期望 ${JSON.stringify(expectDisabled)})`);
const voidIdx = realRows.findIndex((r) => r.targetInvalid === true);
ok(voidIdx >= 0 && uiNos[voidIdx] === '已作废' && st.disabled[voidIdx] === true,
  `整链皆作废的行(第 ${voidIdx + 1} 行)显示「已作废」且「查看」禁用`);
ok(realRows.filter((r) => r.targetInvalid === true).every((_, i) => true) && voidIdx >= 0,
  `浮层里仍能看到这些行(未被隐藏),仅按钮禁用`);

// 点一个有效行(优先「已前进到采购入库单」的行)验证仍能跳到正确单据
const pickIdx = (() => {
  const toIn = realRows.findIndex((r) => N(r.targetPanel) === 'PURCHASE_IN' && N(r.targetFormNo) && N(r.targetFormNo) !== N(r.firstTargetFormNo));
  if (toIn >= 0) return toIn;
  return realRows.findIndex((r) => r.targetInvalid !== true && N(r.targetFormNo));
})();
const pick = realRows[pickIdx];
info(`点第 ${pickIdx + 1} 行「查看」:起点 ${N(pick.firstTargetPanel)}/${N(pick.firstTargetFormNo)} → 终点 ${N(pick.targetPanel)}/${N(pick.targetFormNo)}`);
await ev(`document.querySelectorAll('.batch-pop-body .el-table__body-wrapper tbody tr')[${pickIdx}].querySelector('.el-button').click(), 'ok'`);
await sleep(3800);
const jumped = await ev(`(() => {
  const inputs = [...document.querySelectorAll('.header-fields input, .tools-right input')].map((e) => e.value).filter(Boolean);
  return { hash: location.hash, inputs };
})()`);
info(`跳转后 hash=${jumped?.hash} 表头值=${JSON.stringify((jumped?.inputs || []).slice(0, 6))}`);
ok(String(jumped?.hash || '').includes(`/panelx/list/${N(pick.targetPanel)}`),
  `跳到的面板 = 终点面板 ${N(pick.targetPanel)}(hash=${jumped?.hash})`);
ok((jumped?.inputs || []).some((v) => String(v).includes(N(pick.targetFormNo))),
  `定位到终点单据 ${N(pick.targetFormNo)}(表头值 ${JSON.stringify(jumped?.inputs)})`);

// 用户原场景再走一遍:去向 = **暂收退回单(QC_RETURN)** 的有效行,点「查看」要能看到这张退料单
const thIdx = realRows.findIndex((r) => N(r.targetPanel) === 'QC_RETURN' && N(r.targetFormNo) && r.targetInvalid !== true);
ok(thIdx >= 0, `真实订单里存在「去向 = 暂收退回单(QC_RETURN)」的有效行(用户报的场景)`);
if (thIdx >= 0) {
  const th = realRows[thIdx];
  await send('Page.navigate', { url: `${FRONT}/?_v=${Date.now()}#/panelx/list/PU_ORDER?docNo=${encodeURIComponent(PO_REAL)}` });
  for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`!!document.querySelector('.batch-sum-line')`)) break; }
  await sleep(2200);
  await ev(`document.querySelector('.batch-sum-line').click(), 'ok'`);
  await sleep(2200);
  await ev(`document.querySelectorAll('.batch-pop-body .el-table__body-wrapper tbody tr')[${thIdx}].querySelector('.el-button').click(), 'ok'`);
  await sleep(3800);
  const thJump = await ev(`(() => {
    const head = (document.querySelector('.tools-right')?.textContent || '').replace(/\\s+/g,' ').trim();
    const hdr = [...document.querySelectorAll('.header-fields input')].map((e) => e.value).filter(Boolean);
    const shown = (document.body.innerText || '').includes(${JSON.stringify(N(th.targetFormNo))});
    return { hash: location.hash, head, hdr, shown };
  })()`);
  const thLoc = await locate('QC_RETURN', N(th.targetFormNo));
  info(`退料单行(第 ${thIdx + 1} 行)跳转:hash=${thJump?.hash} 页面上出现该单号=${thJump?.shown} 表头值=${JSON.stringify((thJump?.hdr || []).slice(0, 6))}`);
  ok(String(thJump?.hash || '').includes('/panelx/list/QC_RETURN'),
    `跳到暂收退回单(QC_RETURN)面板(hash=${thJump?.hash})`);
  ok(thJump?.shown === true, `面板上有这张退料单(页面文本出现 ${N(th.targetFormNo)} = ${thJump?.shown})`);
  ok(thLoc.total >= 1, `该退料单 ${N(th.targetFormNo)} 在面板里可定位(${thLoc.total} 张)`);
  ok(String(thJump?.head || '').includes(N(th.targetFormNo)) || (thJump?.hdr || []).some((v) => String(v).includes(N(th.targetFormNo))),
    `面板上看到的就是该退料单 ${N(th.targetFormNo)}(表头=${JSON.stringify((thJump?.hdr || []).slice(0, 6))} / tools-right=${JSON.stringify(String(thJump?.head || '').slice(0, 80))})`);
}

// 反向验证:作废单号直接打开该面板确实定位不到(证明「不给作废单号」是必要的)
const voidRow = before.find((x) => N(x.targetFormNo) && table.find((t) => Number(t.批次键) === Number(x.batchId))?.['改前去向单据状态'] === '已作废');
if (voidRow) {
  await send('Page.navigate', { url: `${FRONT}/?_v=${Date.now()}#/panelx/list/${N(voidRow.targetPanel)}?docNo=${encodeURIComponent(N(voidRow.targetFormNo))}` });
  await sleep(6000);
  const blank = await ev(`(() => {
    const inputs = [...document.querySelectorAll('.header-fields input, .tools-right input')].map((e) => e.value).filter(Boolean);
    return { hit: (document.body.innerText || '').includes(${JSON.stringify(N(voidRow.targetFormNo))}), inputs };
  })()`);
  info(`改前那个作废去向 ${N(voidRow.targetPanel)}/${N(voidRow.targetFormNo)} 直接打开:页面上出现该单号=${blank?.hit} 表头值=${JSON.stringify((blank?.inputs || []).slice(0, 6))}`);
  ok(blank?.hit === false || (blank?.inputs || []).length === 0,
    `作废单号「?docNo=」在原面板里定位不到(复现用户报的「面板没数据」:${N(voidRow.targetFormNo)})`);
}
}   // ← UI 段(CDP)结束;见上方 YJ_SKIP_UI 开关

// ════════════ 清理本次测试单据(反序 弃审 → 删除;批次号按口径不回收) ════════════
console.log('\n=== 清理本次测试单据(反序 弃审 → 删除;批次号不回收) ===');
await cleanupCreated();
console.log('\n=== 测试单据与台账留证 ===');
console.log(`  A: 采购订单 ${A.po} / 暂收单 ${A.recv} / 检验单 ${A.insp} / 退料单 ${A.th} / 批次键 ${A.key}`);
console.log(`  B: 采购订单 ${B.po} / 暂收单 ${B.recv} / 检验单 ${B.insp} / 入库单 ${B.pi} / 批次键 ${B.key}`);
console.table(await q(`SELECT id, source_form_no, batch_no, status, target_panel_code, target_form_no FROM yj_doc_batch WHERE id IN (${A.key},${B.key})`));

try { cdp?.close(); } catch { /* ignore */ }
if (edge) edge.kill();
await pool.close();

// ════════════ ⑥ 回归:上一轮两个探针须全 PASS ════════════
if (process.env.YJ_SKIP_REGRESS === '1') {
  console.log('\n=== ⑥ 回归(已按 YJ_SKIP_REGRESS=1 跳过) ===');
} else {
  console.log('\n=== ⑥ 回归:上一轮探针 ===');
  for (const f of ['tools/archive/_verify-batch-target-chain.mjs', 'tools/archive/_verify-batch-no-date-only.mjs']) {
    console.log(`\n──────── node ${f} ────────`);
    const code = await new Promise((res) => {
      const p = spawn(process.execPath, [f], { stdio: 'inherit' });
      p.on('exit', (c) => res(c));
    });
    ok(code === 0, `${f} 退出码 = 0(实得 ${code})`);
  }
}

console.log(`\n${fails ? `❌ 失败 ${fails} 项` : '✅ 全部通过'}`);
process.exit(fails ? 1 : 0);
