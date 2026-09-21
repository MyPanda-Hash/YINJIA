/**
 * _verify-batch-target-chain.mjs — 采购订单「送料」浮层:台账**去向单号 = 链路终点**(2026-09-21)
 *
 * 用户口径:
 *   台账 yj_doc_batch 的 target_panel_code/target_form_no 是**生成时写死**的(一般是送料暂收单),
 *   不随链路前进 → 浮层点「查看」永远只到暂收单,即使检验单/采购入库单早已存在。
 *   要求:终点 = 沿 form_flow_link(link_status='ACTIVE')走到的**最后一站**;
 *         作废/删除的单据不能当终点(回退到链上最近一张有效单)。
 *
 * 断言:
 *   ① 只有暂收单(未审核、无下游)→ batches() 去向 = 暂收单;
 *   ② 暂收单已审核并生成检验单 → 去向 = 检验单;
 *   ③ 检验单已审核并生成采购入库单 → 去向 = 采购入库单(用户场景);
 *   ④ 入库单已作废(yj_doc_status.canceled='Y')→ 去向回退到检验单(不指作废单);
 *   ⑤ 真实订单 YJ-20260915-11 逐行:接口去向 = 直查 form_flow_link 算出的链路终点(附前后对照表);
 *   ⑥ 界面(CDP,打包应用 http://localhost:8090):浮层**无 .bpb-head 标题行**、列头仍为
 *      批次号/日期/数量/状态/去向单号/操作、点某行「查看」跳到**终点单据**的面板与单号。
 *
 * 用法: node tools/archive/_verify-batch-target-chain.mjs
 *   env: YJ_API / YJ_FRONT / YJ_CDP_PORT / YJ_EDGE
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
const CDP_PORT = Number(process.env.YJ_CDP_PORT || 9455);
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
/** 浮层数据源:采购订单 → 送料暂收单 的批次清单 */
const batchesOf = async (po) => ((await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: po })).batches) || [];

// ============ 探针侧独立实现:直查 form_flow_link / yj_doc_status 算「链路终点」 ============
const HEAD = {};
for (const r of await q('SELECT panel_code, head_table FROM yj_panel')) HEAD[N(r.panel_code)] = N(r.head_table);
console.log('面板单头表:' + JSON.stringify(HEAD));
const PRIORITY = ['PURCHASE_IN', 'QC_RETURN', 'QC_INSP', 'QC_RECV'];
const rank = (p) => { const i = PRIORITY.indexOf(p); return i < 0 ? PRIORITY.length : i; };

/** 有效 = yj_doc_status 未作废/未删除,且单据表内 asp_cancel<>'Y' */
async function alive(panel, no) {
  const st = await one(`SELECT ISNULL(canceled,'N') c, ISNULL(deleting,'N') d FROM yj_doc_status WHERE panel_code=N'${esc(panel)}' AND doc_no=N'${esc(no)}'`);
  if (st && (N(st.c) === 'Y' || N(st.d) === 'Y')) return false;
  const t = HEAD[panel];
  if (t) {
    const r = await one(`SELECT TOP 1 ISNULL(asp_cancel,'N') a FROM ${t} WHERE 单据编号=N'${esc(no)}'`);
    if (r && N(r.a) === 'Y') return false;
  }
  return true;
}

/** ACTIVE 下游(优先同批次 batch_id,该批次无链路时放宽) */
async function nextStations(panel, no, batchId) {
  const sql = (b) => `SELECT DISTINCT target_panel_code p, target_form_no n FROM form_flow_link
    WHERE source_panel_code=N'${esc(panel)}' AND source_form_no=N'${esc(no)}' AND link_status='ACTIVE'
      AND target_form_no IS NOT NULL AND LTRIM(RTRIM(target_form_no))<>''` + (b ? ` AND batch_id=${Number(b)}` : '');
  let rows = await q(sql(batchId));
  if (!rows.length && batchId) rows = await q(sql(0));
  return rows.map((r) => ({ p: N(r.p), n: N(r.n) })).filter((r) => r.p && r.n).sort((a, b) => rank(a.p) - rank(b.p));
}

/** 起点 → 沿 ACTIVE 链路广搜(≤8 跳)→ 可达链上**站数最多的有效单据**(整链皆作废 → invalid,不给作废单号) */
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
  for (const doc of docs.values()) {          // Map 保插入序 = BFS 序(同站数取优先级靠前者)
    if (!(await alive(doc.p, doc.n))) continue;
    if (!end || doc.d > end.d) end = doc;
  }
  // 2026-09-21 修复:整链皆作废时**不再回退起点**(起点也已作废,拿它当去向 → 面板定位不到而空白),
  // 改为 invalid=true + 单号为空(与 BatchService.resolveEndTarget 同口径,见 _verify-batch-target-void.mjs)
  if (!end) return { panel: '', no: '', depth: -1, invalid: true, path: [...docs.values()].map((d) => `${d.p} ${d.n}(${d.d})`) };
  return { panel: end.p, no: end.n, depth: end.d, invalid: false, path: [...docs.values()].map((d) => `${d.p} ${d.n}(${d.d})`) };
}

// ============ 选样:一张已审核、有剩余可送量、且不是 YJ-20260915-11 的采购订单 ============
console.log('\n=== 选样(造测试链,不动 YJ-20260915-11) ===');
const WH = N((await one(`SELECT TOP 1 仓库名称 w FROM bs_wh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 仓库名称=N'恒亿仓'`))?.w)
  || N((await one(`SELECT TOP 1 仓库名称 w FROM bs_wh WHERE ISNULL(asp_cancel,'N')<>'Y'`))?.w);
if (!WH) { console.error('bs_wh 无可用仓库(既有仓库校验会挡住入库审核)'); await pool.close(); process.exit(1); }
const list = (await post('/px/queryFormDataList', { panelCode: 'PU_ORDER', pageNo: 1, pageSize: 400 })).list || [];
let PO = null;
for (const r of list) {
  const no = N(r['单据编号']);
  if (N(r['单据状态']) !== '已审核' || no === 'YJ-20260915-11') continue;
  let ls;
  try { ls = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: no }); } catch { continue; }
  const line = (ls.lines || []).find((x) => Number(x.剩余数量) > 0);
  if (line) { PO = { no, line }; break; }
}
if (!PO) { console.error('找不到已审核 + 有剩余可送量的采购订单'); await pool.close(); process.exit(1); }
info(`采购订单 ${PO.no}(行 ${PO.line.行号} 剩余 ${PO.line.剩余数量});补仓库用:${WH}`);

const QTY = Math.min(10, Number(PO.line.剩余数量));
const gen = await post('/px/batchFlow/generate', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: PO.no, lines: [{ lineKey: PO.line.lineKey, qty: QTY }] });
const recv = N(gen['编号']);
const led = await one(`SELECT TOP 1 id, batch_no, status, target_panel_code, target_form_no FROM yj_doc_batch WHERE source_form_no=N'${esc(PO.no)}' AND target_form_no=N'${esc(recv)}'`);
const KEY = Number(led?.id || 0);
if (!KEY) { console.error('未取到批次键:' + JSON.stringify(led)); await pool.close(); process.exit(1); }
info(`暂收单=${recv} 批次键=${KEY} 台账=${JSON.stringify(led)}`);
const rowOf = (bs) => bs.find((b) => Number(b.batchId) === KEY) || null;

// ============ ① 只有暂收单(未审核/未生成下游)→ 去向 = 暂收单 ============
console.log('\n=== ① 只有暂收单(未审核、无下游)→ 去向 = 暂收单 ===');
const b1 = rowOf(await batchesOf(PO.no));
info(`接口行=${JSON.stringify(b1)}`);
ok(!!b1, `接口列出该批次(batchId=${KEY})`);
ok(N(b1?.targetPanel) === 'QC_RECV' && N(b1?.targetFormNo) === recv,
  `去向 = 暂收单(期望 QC_RECV/${recv},实得 ${N(b1?.targetPanel)}/${N(b1?.targetFormNo)})`);
ok(N(b1?.firstTargetFormNo) === recv, `firstTargetFormNo 仍记起点暂收单(实得 ${N(b1?.firstTargetFormNo)})`);
ok(Number(b1?.targetHops) === 0, `尚未前进(targetHops=0,实得 ${N(b1?.targetHops)})`);

// ============ ② 暂收单审核 → 生成检验单 → 去向 = 检验单 ============
console.log('\n=== ② 暂收单已审核并生成检验单 → 去向 = 检验单 ===');
await cb('QC_RECV', '审核', { 编号: recv }); await sleep(700);
const insp = N((await cb('QC_RECV', '生成来料检验单', { 编号: recv }))['编号']);
await sleep(500);
const b2 = rowOf(await batchesOf(PO.no));
info(`检验单=${insp}  接口行=${JSON.stringify(b2)}`);
ok(!!insp, `已生成来料检验单 ${insp}`);
ok(N(b2?.targetPanel) === 'QC_INSP' && N(b2?.targetFormNo) === insp,
  `去向 = 检验单(期望 QC_INSP/${insp},实得 ${N(b2?.targetPanel)}/${N(b2?.targetFormNo)})`);
ok(N(b2?.firstTargetFormNo) === recv, `firstTargetFormNo 仍是起点暂收单 ${recv}(实得 ${N(b2?.firstTargetFormNo)})`);
ok(Number(b2?.targetHops) === 1, `前进 1 跳(targetHops=1,实得 ${N(b2?.targetHops)})`);

// ============ ③ 检验单审核 → 生成采购入库单 → 去向 = 采购入库单 ============
console.log('\n=== ③ 检验单已审核并生成采购入库单 → 去向 = 采购入库单 ===');
await q(`UPDATE qc_insp_detail SET 合格数量 = ISNULL(NULLIF(数量,0), 送检数量), 不合格数量 = 0 WHERE 单据编号=N'${esc(insp)}'`);
await cb('QC_INSP', '审核', { 编号: insp }); await sleep(900);
const pi = N((await one(`SELECT TOP 1 target_form_no n FROM form_flow_link WHERE source_panel_code='QC_INSP' AND source_form_no=N'${esc(insp)}' AND target_panel_code='PURCHASE_IN' AND link_status='ACTIVE'`))?.n);
// 铺路过既有「仓库档案」校验(与本任务无关,见 _verify-batch-no-at-inbound.mjs 同注释)
const piWh = await one(`SELECT TOP 1 ISNULL([仓库],N'') w FROM bl_purchase_in WHERE 单据编号=N'${esc(pi)}'`);
if (piWh && N(piWh.w) === '') {
  await q(`UPDATE bl_purchase_in SET [仓库]=N'${esc(WH)}' WHERE 单据编号=N'${esc(pi)}'`);
  await q(`UPDATE bd_purchase_in SET [仓库]=N'${esc(WH)}' WHERE 单据编号=N'${esc(pi)}'`);
}
const b3 = rowOf(await batchesOf(PO.no));
info(`入库单=${pi}  接口行=${JSON.stringify(b3)}`);
ok(!!pi, `检验单审核自动生成采购入库单 ${pi}`);
ok(N(b3?.targetPanel) === 'PURCHASE_IN' && N(b3?.targetFormNo) === pi,
  `去向 = 采购入库单(期望 PURCHASE_IN/${pi},实得 ${N(b3?.targetPanel)}/${N(b3?.targetFormNo)})`);
ok(Number(b3?.targetHops) === 2, `前进 2 跳(targetHops=2,实得 ${N(b3?.targetHops)})`);

// ============ ④ 入库单作废 → 去向回退到检验单(不指作废单) ============
console.log('\n=== ④ 入库单已作废 → 去向回退到检验单 ===');
await cb('PURCHASE_IN', '审核', { 编号: pi }); await sleep(900);   // 先审核(用户场景:暂收+检验已审核并生单)
const b3b = rowOf(await batchesOf(PO.no));
info(`入库单审核后 接口行=${JSON.stringify(b3b)}`);
ok(N(b3b?.targetFormNo) === pi, `入库单审核后去向仍 = 采购入库单 ${pi}(实得 ${N(b3b?.targetFormNo)})`);
let voidMsg = '已作废';
try { await cb('PURCHASE_IN', '弃审', { 编号: pi }); } catch (e) { voidMsg = '弃审被拒:' + String(e.message).slice(0, 80); }
await sleep(600);
try { await cb('PURCHASE_IN', '删除', { 编号: pi }); } catch (e) { voidMsg = '删除被拒:' + String(e.message).slice(0, 80); }
await sleep(800);
const pst = await one(`SELECT ISNULL(canceled,'N') c, ISNULL(deleting,'N') d FROM yj_doc_status WHERE panel_code='PURCHASE_IN' AND doc_no=N'${esc(pi)}'`);
const piAsp = await one(`SELECT ISNULL(asp_cancel,'N') a FROM bd_purchase_in WHERE 单据编号=N'${esc(pi)}'`);
info(`入库单作废操作:${voidMsg};yj_doc_status=${JSON.stringify(pst)};bd_purchase_in.asp_cancel=${JSON.stringify(piAsp)}`);
ok(N(pst?.c) === 'Y' || N(pst?.d) === 'Y' || N(piAsp?.a) === 'Y',
  `入库单 ${pi} 已命中作废口径(canceled/deleting/asp_cancel='Y')`);
const b4 = rowOf(await batchesOf(PO.no));
info(`接口行=${JSON.stringify(b4)}`);
ok(N(b4?.targetPanel) === 'QC_INSP' && N(b4?.targetFormNo) === insp,
  `去向回退到检验单(期望 QC_INSP/${insp},实得 ${N(b4?.targetPanel)}/${N(b4?.targetFormNo)})`);
ok(N(b4?.targetFormNo) !== pi, `去向**不指向已作废**的入库单 ${pi}`);
const t4 = await chainTerminal('QC_RECV', recv, KEY);
ok(N(b4?.targetPanel) === t4.panel && N(b4?.targetFormNo) === t4.no,
  `接口去向 = 探针独立算出的链路终点(${t4.panel} ${t4.no};可达链 ${t4.path.join(' → ')})`);

// ============ ⑤ 真实订单 YJ-20260915-11:逐行 接口去向 vs 直查链路终点 ============
console.log('\n=== ⑤ 真实订单 YJ-20260915-11 逐行对照 ===');
const PO_REAL = 'YJ-20260915-11';
const realRows = await batchesOf(PO_REAL);
const linkRows = await q(`SELECT l.batch_id, l.source_panel_code, l.source_form_no, l.target_panel_code, l.target_form_no, l.link_status
  FROM form_flow_link l JOIN yj_doc_batch b ON b.id = l.batch_id WHERE b.source_form_no=N'${PO_REAL}' ORDER BY l.batch_id, l.id`);
console.log('  form_flow_link(该订单各批次):');
console.table(linkRows.map((r) => ({ 批次键: r.batch_id, 源: `${N(r.source_panel_code)} ${N(r.source_form_no)}`, 目标: `${N(r.target_panel_code)} ${N(r.target_form_no)}`, 链路: N(r.link_status) })));
const table = [];
for (const r of realRows) {
  const t = await chainTerminal(N(r.firstTargetPanel), N(r.firstTargetFormNo), Number(r.batchId));
  // 2026-09-21:整链皆作废的行 → 接口置空 + targetInvalid=true(不再回起点),探针按新口径比对
  const match = t.invalid
    ? (r.targetInvalid === true && N(r.targetFormNo) === '')
    : (N(r.targetPanel) === t.panel && N(r.targetFormNo) === t.no);
  table.push({
    批次键: r.batchId,
    批次号: N(r.batchNo) || '(待编号)',
    状态: N(r.status),
    台账原始去向_前: `${N(r.firstTargetPanel)} ${N(r.firstTargetFormNo)}`,
    接口去向_后: `${N(r.targetPanel)} ${N(r.targetFormNo)}` || '(空,整链皆作废)',
    直查链路终点: t.invalid ? '(整链皆作废 → 不给去向)' : `${t.panel} ${t.no}(跳${t.depth})`,
    一致: match ? 'OK' : 'MISMATCH',
  });
  ok(match, `批次键 ${r.batchId}(${N(r.batchNo) || '待编号'}):接口去向 ${N(r.targetPanel)}/${N(r.targetFormNo) || '(空)'} = 链路终点 ${t.invalid ? '(整链皆作废)' : t.panel + '/' + t.no + '(跳 ' + t.depth + ')'}`);
  info(`   可达链:${t.path.join(' → ')}`);
}
console.log('  前后对照表:');
console.table(table);
const advanced = table.filter((r) => r.台账原始去向_前 !== r.接口去向_后);
ok(advanced.length > 0, `该订单确有批次「去向前进」(前 ≠ 后 的行数 = ${advanced.length},证明不再停在生成时那张单)`);

// ============ ⑥ 界面(CDP,打包应用) ============
console.log(`\n=== ⑥ 界面(CDP ${FRONT}):无 .bpb-head + 列头 + 「查看」跳终点 ===`);
// ── UI 段(CDP)开关(2026-09-21):本机 Edge 渲染进程起不来(--screenshot/--dump-dom 连 about:blank
//    都以退出码 13 失败;页面级 CDP ws 一发命令即 ECONNRESET),故允许 YJ_SKIP_UI=1 跳过界面实测;
//    跳过时改为对**已发布静态包**做静态断言,并打印 [SKIP]——不冒充 PASS。
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
    ok(!js.includes('bpb-head'), `已发布 ${chunk} 不含浮层标题行 .bpb-head(标题行已删)`);
  }
} else {
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-bchain-'));
edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, 'about:blank'],
  // detached 必需:本机 node 普通 spawn 拉起的 Edge 会立刻以 0x80000003(STATUS_BREAKPOINT)退出,CDP 端口起不来
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
for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`!!document.querySelector('.header-fields') && !!document.querySelector('.batch-sum-line')`)) { ready = true; break; } }
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
    hasHead: !!(pop && pop.querySelector('.bpb-head')),
    headText: pop && pop.querySelector('.bpb-head') ? pop.querySelector('.bpb-head').textContent.replace(/\\s+/g,' ').trim() : null,
    popText: pop ? pop.textContent.replace(/\\s+/g,' ').trim() : '',
    cols: hd ? [...hd.querySelectorAll('thead th')].map((th) => th.textContent.trim()).filter(Boolean) : [],
    rows: tb ? [...tb.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent.replace(/\\s+/g,' ').trim())) : [],
  };
})()`;
const st = await ev(READ);
info(`浮层列头=${JSON.stringify(st?.cols)}`);
info(`浮层行=${JSON.stringify(st?.rows)}`);
info(`浮层标题节点(.bpb-head)=${JSON.stringify(st?.headText)}`);
ok(!!st?.popOpen, '点摘要行弹出浮层');
ok(st?.hasHead === false, `浮层里**不存在** .bpb-head 标题行(hasHead=${st?.hasHead},文本=${JSON.stringify(st?.headText)})`);
ok(!String(st?.popText || '').includes('已送合计') && !String(st?.popText || '').includes('送料批次'),
  `浮层文本里也没有「送料批次 · … · 已送合计 N」标题痕迹(${JSON.stringify(String(st?.popText || '').slice(0, 60))}…)`);
ok((st?.cols || []).join('|') === '批次号|日期|数量|状态|去向单号|操作',
  `表格列头仍为 批次号/日期/数量/状态/去向单号/操作(实得 ${(st?.cols || []).join('|')})`);
ok((st?.rows || []).length === realRows.length, `浮层行数 = 接口批次行数(${(st?.rows || []).length}/${realRows.length})`);
const uiRows = (st?.rows || []).map((r) => r[4]);
// 2026-09-21:去向为空的行走「整链皆作废」兜底,列里显示「已作废」(不再是空串)
const apiNos = realRows.map((r) => N(r.targetFormNo) || '已作废');
ok(JSON.stringify(uiRows) === JSON.stringify(apiNos),
  `浮层「去向单号」列 = 接口 targetFormNo 列(空则显示「已作废」)(界面 ${JSON.stringify(uiRows)} / 接口 ${JSON.stringify(apiNos)})`);

// 点「查看」:优先挑「暂收单 → 采购入库单」的行(用户场景),否则挑任意一行「去向已前进」的(终点 ≠ 起点)
const advIdx = (() => {
  const toIn = realRows.findIndex((r) => N(r.targetPanel) === 'PURCHASE_IN' && N(r.targetFormNo) && N(r.targetFormNo) !== N(r.firstTargetFormNo));
  if (toIn >= 0) return toIn;
  const anyAdv = realRows.findIndex((r) => N(r.targetFormNo) && N(r.targetFormNo) !== N(r.firstTargetFormNo));
  return anyAdv >= 0 ? anyAdv : 0;
})();
const pickIdx = advIdx >= 0 ? advIdx : 0;
const pick = realRows[pickIdx];
info(`点第 ${pickIdx + 1} 行「查看」:起点 ${N(pick.firstTargetPanel)}/${N(pick.firstTargetFormNo)} → 终点 ${N(pick.targetPanel)}/${N(pick.targetFormNo)}`);
await ev(`document.querySelectorAll('.batch-pop-body .el-table__body-wrapper tbody tr')[${pickIdx}].querySelector('.el-button').click(), 'ok'`);
await sleep(3800);
const jumped = await ev(`({ hash: location.hash, head: (document.querySelector('.tools-right')?.textContent || '').replace(/\\s+/g,' ').trim().slice(0, 120) })`);
info(`跳转后 hash=${jumped?.hash}`);
info(`跳转后 单据头=${jumped?.head}`);
ok(String(jumped?.hash || '').includes(`/panelx/list/${N(pick.targetPanel)}`),
  `跳到的面板 = 终点面板 ${N(pick.targetPanel)}(hash=${jumped?.hash})`);
ok(String(jumped?.head || '').includes(N(pick.targetFormNo)),
  `定位到终点单据 ${N(pick.targetFormNo)}`);
ok(!String(jumped?.hash || '').includes(`/panelx/list/${N(pick.firstTargetPanel)}?docNo=${encodeURIComponent(N(pick.firstTargetFormNo))}`),
  `未停在起点单据 ${N(pick.firstTargetPanel)}/${N(pick.firstTargetFormNo)}`);
}   // ← UI 段(CDP)结束;见上方 YJ_SKIP_UI 开关

// ============ 清理本次测试单据(反序 弃审 → 删除;批次号按口径不回收) ============
console.log('\n=== 清理本次测试单据(反序 弃审 → 删除;批次号不回收) ===');
for (const [p, no] of [['PURCHASE_IN', pi], ['QC_INSP', insp], ['QC_RECV', recv]]) {
  if (!no) continue;
  for (const b of ['弃审', '删除']) {
    try { await cb(p, b, { 编号: no }); console.log(`  ${p} ${no} ${b} ✓`); }
    catch (e) { console.log(`  ${p} ${no} ${b} 跳过:${String(e.message).slice(0, 90)}`); }
  }
}
console.log('\n=== 本次测试造的单据与台账留证 ===');
console.log(`  采购订单 ${PO.no}(未改动)/ 送料暂收单 ${recv} / 来料检验单 ${insp} / 采购入库单 ${pi}(已作废)/ 批次键 ${KEY}`);
console.table(await q(`SELECT id, source_form_no, batch_no, batch_seq, status, target_panel_code, target_form_no FROM yj_doc_batch WHERE id=${KEY}`));

try { cdp?.close(); } catch { /* ignore */ }
if (edge) edge.kill();
await pool.close();
console.log(`\n${fails ? `❌ 失败 ${fails} 项` : '✅ 全部通过'}`);
process.exit(fails ? 1 : 0);
