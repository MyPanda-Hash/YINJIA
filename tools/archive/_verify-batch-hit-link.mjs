'use strict'
/**
 * _verify-batch-hit-link.mjs — 分批送料链回归:`findPendingBatchId` **命中分支**的行为验证
 * (补 commit 8cc1648f「手工采购入库单审核必 500」修复**未覆盖的另一半**)
 *
 * 背景:8cc1648f 把 `BatchService.findPendingBatchId` 里查 `form_flow_link.batch_id` 的那一句
 * 由 `jdbc.queryForObject` 改成 `jdbc.queryForList` + 取首行。SQL 一字未改(TOP 1 + ORDER BY id
 * ⇒ 至多 1 行),所以"命中"时两种实现应当**返回同一个 batch_id**,只有"0 行"从抛
 * EmptyResultDataAccessException(IncorrectResultSizeDataAccessException 子类)变成返回 null。
 *
 * `findPendingBatchId` 三档取值(见 BatchService:228-264):
 *   ① bd_purchase_in.[批次键]  —— 链路自然带下来的键
 *   ② form_flow_link.batch_id  —— **本次被改的那一句**
 *   ③ 来源单头(qc_insp/sl_recv/qc_tc_in).[批次键]
 * 三档任一命中就 `assignNoAndBackfill(batchId)`:台账行 PENDING→ACTIVE 并取号、回填
 * form_flow_link.batch_no、回填三单头/行。**跳过**(返回 0)则台账行保持 PENDING、批次号保持空。
 * ⇒ 判别"命中 vs 跳过"的观测面 = **哪一行台账翻了 ACTIVE**(不是批次号文本:同日同号是既定口径)。
 *
 * ⚠ 本探针跑起来时「采购订单 → 送料暂收单」(分批送料,真链路)是通的,而
 *   「送料暂收单 → 生成来料检验单」这条路**当前在两个账套都 500**(QcCatalogService.loadInspRows
 *   选择 qc_insp_detail.[单位],而该列在两账套都不存在 —— 与本任务无关的存量缺陷,探针会把原始
 *   应答原样打出来并继续)。因此本探针的入库单走**同一面板的另一个真实出口**:
 *   「QC_RECV|生成采购入库单」(免检直达,2026-09-22 用户口径),再按需调整链路行的 batch_id 造出
 *   「只留②档」的状态。
 *
 * 验证矩阵(全部在**测试账套**造,正式账套只读):
 *   A  免检直达入库单(链路行由系统写)      : 按 oracle 判定该走哪档 → 审核不 500,台账状态与 oracle 一致
 *   B1 清空 头/来源单 批次键 + 链路行 batch_id=K : oracle=②档 → 审核后台账 **K 那行**翻 ACTIVE(命中②档)
 *   B2 同 B1 但链路行 batch_id=NULL          : oracle=0 行 → 跳过(NEW)/ 500(OLD)—— 与 B1 只差这一处
 *   C  手工采购入库单(链路里一行都没有)     : oracle=0 行 → 跳过(NEW)/ 500(OLD)—— 8cc1648f 报的形状
 *   弃审 B1 → 批次号不回收、台账状态不变
 *
 * 「两种实现返回同一个 batch_id」的直接证据:设了 `YJ_JAVA_CP`(应用依赖 jar 目录)时,本探针在
 * **审核之前**(只读)调用 `tools/archive/_BatchPendingIdEquiv.java`,对同一张入库单分别跑
 * "queryForObject 版"与"queryForList 版"两段**真实实现**,打印两者返回的 id ⇒ 应当相等。
 *
 * 用法:
 *   node tools/archive/_verify-batch-hit-link.mjs                      # 打 8090(现行/新实现)
 *   YJ_API=http://127.0.0.1:8091 YJ_LABEL=OLD YJ_EXPECT=OLD node tools/archive/_verify-batch-hit-link.mjs
 *   env: YJ_API / YJ_FACTORY(默认 YJ_TEST) / YJ_DB(默认 HSDZ_MES_TEST) / YJ_PROD_DB(默认 HSDZ_MES)
 *        YJ_LABEL(打标签) / YJ_EXPECT(NEW|OLD,默认 NEW:0 行那条路该不该 500) / YJ_EVIDENCE(json 落盘) / YJ_JAVA_CP
 *
 * 红线:只碰 YJ_DB(默认测试账套);正式账套只做只读基线快照。跑完必须回到基线
 * (kucun 余量 15939.0000 / inh 31 / outh 0 / inv_cost_ledger 31,且全库行数快照一致)。
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const API = (process.env.YJ_API || 'http://127.0.0.1:8090').replace(/\/$/, '');
const FACTORY = process.env.YJ_FACTORY || 'YJ_TEST';
const DB = process.env.YJ_DB || 'HSDZ_MES_TEST';
const PROD_DB = process.env.YJ_PROD_DB || 'HSDZ_MES';
const LABEL = process.env.YJ_LABEL || 'NEW';
const EXPECT = (process.env.YJ_EXPECT || 'NEW').toUpperCase();   // NEW:0 行应"跳过";OLD:0 行应 500
const EVIDENCE = process.env.YJ_EVIDENCE || '';
const JAVA_CP = process.env.YJ_JAVA_CP || '';

if (DB !== 'HSDZ_MES_TEST') { console.error(`拒绝执行:本探针只允许在测试账套造数(YJ_DB=${DB})`); process.exit(2); }

let pass = 0, fail = 0;
const check = (n, c, extra) => { c ? (pass++, console.log(`  [PASS] ${n}`)) : (fail++, console.log(`  [FAIL] ${n}${extra ? '  → ' + extra : ''}`)); };
const info = (n) => console.log(`         ${n}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const N = (v) => (v === null || v === undefined ? null : String(v).trim());
const esc = (v) => String(v == null ? '' : v).replace(/'/g, "''");
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
const ymd8 = (d) => String(d || '').replace(/\D/g, '').slice(0, 8);
const is0Row500 = (r) => r?.http === 500 && /Incorrect result size|EmptyResultDataAccess/i.test(String(r?.message || ''));

const out = { label: LABEL, expect: EXPECT, api: API, db: DB, baseline: {}, states: {}, docs: {}, cleanup: {}, findings: {} };
/** 造出来的单据与台账键**边造边登记**(探针中途失败也要能清干净) */
const CREATED = [];
const LEDGER_IDS = [];
const track = (panel, no) => { if (no) CREATED.push({ panel, no }); return no; };
const BASE = { kucun0: null, cnt0: null, prod: null, startsAt: null, maxIds: null };

async function pool(db) {
  return new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: db, user: 'yinjia', password: 'Yinjia@2026',
    options: { encrypt: false, trustServerCertificate: true }, pool: { max: 4 } }).connect();
}
let P, PP;
const q = async (s) => (await new mssql.Request(P).query(s)).recordset;
const one = async (s) => (await q(s))[0] || null;

const snap4 = async (p) => (await new mssql.Request(p).query(
  "SELECT (SELECT CAST(ISNULL(SUM(yl),0) AS decimal(18,4)) FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y') kucun_sum,"
  + " (SELECT COUNT(*) FROM kucun) kucun_rows,"
  + " (SELECT COUNT(*) FROM inh) inh_cnt, (SELECT COUNT(*) FROM outh) outh_cnt,"
  + " (SELECT COUNT(*) FROM inv_cost_ledger) cost_cnt,"
  + " (SELECT COUNT(*) FROM form_flow_link) ffl, (SELECT COUNT(*) FROM yj_doc_batch) batches")).recordset[0];
const allTableCounts = async (p) => {
  const t = (await new mssql.Request(p).query('SELECT name FROM sys.tables WHERE is_ms_shipped=0 ORDER BY name')).recordset.map((r) => r.name);
  const cnt = {};
  for (const name of t) {
    try { cnt[name] = Number((await new mssql.Request(p).query(`SELECT COUNT(*) c FROM [${name}]`)).recordset[0].c); }
    catch { cnt[name] = -1; }
  }
  return cnt;
};
const kucunSnapshot = async () => JSON.stringify(await q(
  'SELECT id,wzdm,ckdm,lot_no,CAST(yl AS decimal(18,4)) yl,CAST(rkl AS decimal(18,4)) rkl,'
  + " CAST(ckl AS decimal(18,4)) ckl,ISNULL(asp_cancel,'N') c FROM kucun ORDER BY id"));

let TOKEN = null;
const H = () => ({ 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + TOKEN });
const rawPost = async (p, b) => {
  const r = await fetch(API + '/api' + p, { method: 'POST', headers: H(), body: JSON.stringify(b) });
  const j = await r.json().catch(() => null);
  return { http: r.status, code: j?.code, message: j?.message, data: j?.data };
};
const cb = (panelCode, buttonName, formData) => rawPost('/px/callButton', { panelCode, buttonName, formData: formData || {}, buttonParam: {} });
const okResp = (r) => !!r && (r.code === 200 || r.code === 0);
const brief = (r, n = 300) => JSON.stringify({ http: r?.http, code: r?.code, message: String(r?.message || '').slice(0, n) });
const audit = (panel, no) => cb(panel, '审核', { 编号: no });

async function main() {
  console.log(`=== 分批送料链回归(${LABEL},期望基线=${EXPECT})  api=${API} factory=${FACTORY} db=${DB} ===`);
  P = await pool(DB); PP = await pool(PROD_DB);
  const t0 = await snap4(P), p0 = await snap4(PP);
  out.baseline = { test: t0, prod: p0 };
  BASE.prod = p0;
  console.log('\n=== 0 前置:两账套基线 ===');
  info(`正式 ${PROD_DB}: kucun 余量 ${p0.kucun_sum} / 行 ${p0.kucun_rows} / inh ${p0.inh_cnt} / outh ${p0.outh_cnt} / 成本表 ${p0.cost_cnt} 行`);
  info(`测试 ${DB}: kucun 余量 ${t0.kucun_sum} / 行 ${t0.kucun_rows} / inh ${t0.inh_cnt} / outh ${t0.outh_cnt} / 成本表 ${t0.cost_cnt} 行`);
  check('基线口径(测试账套) kucun=15939 inh=31 outh=0 成本=31',
    Number(t0.kucun_sum) === 15939 && t0.inh_cnt === 31 && t0.outh_cnt === 0 && t0.cost_cnt === 31, JSON.stringify(t0));
  check('测试账套 form_flow_link / yj_doc_batch 为空(基线干净)', Number(t0.ffl) === 0 && Number(t0.batches) === 0, JSON.stringify({ ffl: t0.ffl, batches: t0.batches }));
  BASE.kucun0 = await kucunSnapshot();
  BASE.cnt0 = await allTableCounts(P);
  // 发号池(s_allno:每张新单一行)与操作留痕(yj_usage_log)也会因本探针增长 —— 记下基线最大 id,
  // 收尾把这两张表在本次运行中新增的行删掉,保证"测试账套全库行数快照与基线完全一致"。
  BASE.maxIds = {
    s_allno: Number((await one('SELECT ISNULL(MAX(ID),0) m FROM s_allno'))?.m || 0),
    yj_usage_log: Number((await one('SELECT ISNULL(MAX(id),0) m FROM yj_usage_log'))?.m || 0),
  };
  BASE.startsAt = new Date().toISOString();
  info(`基线最大 id:s_allno=${BASE.maxIds.s_allno} yj_usage_log=${BASE.maxIds.yj_usage_log}`);

  const login = await fetch(API + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }) }).then((r) => r.json());
  TOKEN = login?.data?.token;
  if (!TOKEN) throw new Error('登录失败: ' + JSON.stringify(login).slice(0, 200));
  check(`登录工厂 ${FACTORY}(实际账套 ${login?.data?.user?.factory})`, N(login?.data?.user?.factory) === FACTORY, JSON.stringify(login?.data?.user?.factory));

  const WH = N((await one("SELECT TOP 1 仓库名称 w FROM bs_wh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 仓库名称=N'原料仓'"))?.w)
    || N((await one("SELECT TOP 1 仓库名称 w FROM bs_wh WHERE ISNULL(asp_cancel,'N')<>'Y'"))?.w);
  const inv = await one('SELECT TOP 1 存货编码 a, 存货名称 b FROM bs_inv ORDER BY 存货编码');
  const SUP = N((await one("SELECT TOP 1 mc FROM dm_gf WHERE ISNULL(asp_cancel,'N')<>'Y'"))?.mc);
  const INV = N(inv?.a), INV_NAME = N(inv?.b), stamp = Date.now().toString(36).toUpperCase();
  console.log(`\n靶子: 仓库=${WH} 存货=${INV}/${INV_NAME} 供应商=${SUP} 批次戳=${stamp}`);

  // ── 1 采购订单 ──
  console.log('\n=== 1 造链起点:采购订单(保存 → 审核) ===');
  const poSave = await cb('PU_ORDER', '保存', {
    单据日期: today, 供应商: SUP, 币种: 'RMB', 汇率: 1, 备注: `批次链回归探针 ${stamp}`,
    detail: { items: [{ 物料编码: INV, 物料名称: INV_NAME, 单位: 'kg', 数量: 50, 单价: 10, 仓库: WH }] },
  });
  const PO = track('PU_ORDER', N(poSave?.data?.编号));
  if (!PO) throw new Error('建采购订单失败: ' + brief(poSave, 400));
  console.log(`  采购订单 ${PO}`);
  const poAud = await audit('PU_ORDER', PO); await sleep(300);
  check('采购订单审核成功', okResp(poAud), brief(poAud, 400));
  const lines = await rawPost('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: PO });
  const line = (lines?.data?.lines || []).find((x) => Number(x.剩余数量) > 0);
  if (!line) throw new Error('送料行查询失败: ' + brief(lines, 400));
  info(`送料行 lineKey=${line.lineKey} 剩余=${line.剩余数量}`);

  /** 分批送料:采购订单 → 送料暂收单(真链路,写 form_flow_link.batch_id + yj_doc_batch) */
  const chain = async (tag, qty) => {
    const c = { tag, qty };
    const gen = await rawPost('/px/batchFlow/generate', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: PO,
      lines: [{ lineKey: line.lineKey, qty }] });
    if (!okResp(gen)) throw new Error(`[${tag}] 分批送料失败: ` + brief(gen, 400));
    c.recv = track('QC_RECV', N(gen.data?.编号));
    c.ledgerId = Number((await one(`SELECT TOP 1 id FROM yj_doc_batch WHERE target_form_no=N'${esc(c.recv)}' AND source_form_no=N'${esc(PO)}'`))?.id || 0);
    if (!c.ledgerId) throw new Error(`[${tag}] 未取到批次键`);
    LEDGER_IDS.push(c.ledgerId);
    const r1 = await audit('QC_RECV', c.recv); await sleep(400);
    if (!okResp(r1)) throw new Error(`[${tag}] 暂收单审核失败: ` + brief(r1, 400));
    c.recvKey = (await one(`SELECT [批次键] k, ISNULL([批次号],N'') b FROM sl_recv WHERE 单据编号=N'${esc(c.recv)}'`))?.k;
    c.linkBatch = (await one("SELECT TOP 1 batch_id b FROM form_flow_link WHERE source_panel_code='PU_ORDER'"
      + ` AND target_panel_code='QC_RECV' AND target_form_no=N'${esc(c.recv)}'`))?.b;
    return c;
  };

  /**
   * 免检直达:送料暂收单 → 采购入库单(真实出口 QC_RECV|生成采购入库单;不经被阻塞的检验单那一跳)。
   * 链路行由系统自己写(link():**不带 batch_id**),表头批次键按面板同名映射带入。
   */
  const directInbound = async (c, docDate) => {
    const gen = await cb('QC_RECV', '生成采购入库单', { 编号: c.recv }); await sleep(500);
    if (!okResp(gen)) throw new Error(`[${c.tag}] 免检直达生单失败: ` + brief(gen, 400));
    c.pi = track('PURCHASE_IN', N(gen.data?.编号));
    if (!c.pi) throw new Error(`[${c.tag}] 免检直达未返回单号`);
    const whRow = await one(`SELECT ISNULL([仓库],N'') w FROM bl_purchase_in WHERE 单据编号=N'${esc(c.pi)}'`);
    c.whPatched = false;
    if (!N(whRow?.w)) {
      await q(`UPDATE bl_purchase_in SET [仓库]=N'${esc(WH)}' WHERE 单据编号=N'${esc(c.pi)}'`);
      await q(`UPDATE bd_purchase_in SET [仓库]=N'${esc(WH)}' WHERE 单据编号=N'${esc(c.pi)}'`);
      c.whPatched = true;
    }
    await q(`UPDATE bd_purchase_in SET [单据日期]=N'${esc(docDate)}' WHERE 单据编号=N'${esc(c.pi)}'`);
    c.head0 = await one(`SELECT [批次键] k, ISNULL([批次号],N'') b FROM bd_purchase_in WHERE 单据编号=N'${esc(c.pi)}'`);
    c.piLinks = await q("SELECT id, source_panel_code pc, source_form_no no, batch_id FROM form_flow_link"
      + ` WHERE target_panel_code='PURCHASE_IN' AND target_form_no=N'${esc(c.pi)}' ORDER BY id`);
    return c;
  };

  /** 只读"三档 oracle":照 findPendingBatchId 三档逐档直查(不动库),判这次该走哪一档 */
  const oracle = async (pi) => {
    const head = (await one(`SELECT [批次键] k FROM bd_purchase_in WHERE 单据编号=N'${esc(pi)}'`))?.k;
    const link = (await one("SELECT TOP 1 batch_id b FROM form_flow_link WHERE target_panel_code='PURCHASE_IN'"
      + ` AND target_form_no=N'${esc(pi)}' AND batch_id IS NOT NULL ORDER BY id`))?.b;
    const linkRows = Number((await one("SELECT COUNT(*) c FROM form_flow_link WHERE target_panel_code='PURCHASE_IN'"
      + ` AND target_form_no=N'${esc(pi)}'`))?.c || 0);
    const srcs = await q("SELECT DISTINCT source_panel_code pc, source_form_no no FROM form_flow_link"
      + ` WHERE target_panel_code='PURCHASE_IN' AND target_form_no=N'${esc(pi)}'`);
    let srcKey = null;
    for (const s of srcs) {
      const tb = { QC_INSP: 'qc_insp', QC_RECV: 'sl_recv', QC_TC_IN: 'qc_tc_in' }[N(s.pc)];
      if (!tb) continue;
      const k = (await one(`SELECT [批次键] k FROM ${tb} WHERE 单据编号=N'${esc(s.no)}'`))?.k;
      if (Number(k) > 0) srcKey = Number(k);
    }
    const branch = Number(head) > 0 ? 1 : (Number(link) > 0 ? 2 : (Number(srcKey) > 0 ? 3 : 0));
    return { head: Number(head) || null, link: Number(link) || null, linkRows, srcKey, branch };
  };
  const ledger = async (id) => await one(`SELECT id, batch_no, status, target_form_no FROM yj_doc_batch WHERE id=${Number(id)}`);
  const javaEquiv = async (docs) => {
    if (!JAVA_CP) { console.log('  [SKIP] Java 等价探针(未设 YJ_JAVA_CP)'); return null; }
    const file = path.join(process.cwd(), 'tools', 'archive', '_BatchPendingIdEquiv.java');
    if (!fs.existsSync(file)) { console.log('  [SKIP] 缺 ' + file); return null; }
    try {
      const o = execFileSync('java', ['-Dstdout.encoding=UTF-8', '-Dfile.encoding=UTF-8',
        '-cp', JAVA_CP.replace(/[/\\]$/, '') + path.sep + '*', file, DB, ...docs],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      console.log(o.split(/\r?\n/).filter(Boolean).map((l) => '         ' + l).join('\n'));
      return o;
    } catch (e) { console.log('  [SKIP] Java 等价探针执行失败: ' + String(e.message).split(/\r?\n/)[0]); return null; }
  };

  // ── 2 三条真链(PO → 分批送料 → 暂收单) ──
  console.log('\n=== 2 分批送料真链(采购订单 → 送料暂收单) ===');
  const A = await chain('A', 10), B1 = await chain('B1', 10), B2 = await chain('B2', 10);
  for (const c of [A, B1, B2]) info(`${c.tag}: 暂收单=${c.recv} 批次键=${c.ledgerId} 暂收单头批次键=${c.recvKey} 链路行 batch_id=${c.linkBatch}`);
  check('三条链都拿到独立批次键(真 form_flow_link.batch_id + yj_doc_batch)',
    new Set([A.ledgerId, B1.ledgerId, B2.ledgerId]).size === 3 && [A, B1, B2].every((c) => Number(c.linkBatch) === c.ledgerId),
    JSON.stringify([A, B1, B2].map((c) => ({ K: c.ledgerId, link: c.linkBatch }))));
  check('三行台账审核前均 PENDING 且批次号空',
    (await q(`SELECT status, batch_no FROM yj_doc_batch WHERE id IN (${[A.ledgerId, B1.ledgerId, B2.ledgerId].join(',')})`))
      .every((r) => N(r.status) === 'PENDING' && N(r.batch_no) === null),
    JSON.stringify(await q(`SELECT id, status, batch_no FROM yj_doc_batch WHERE id IN (${[A.ledgerId, B1.ledgerId, B2.ledgerId].join(',')})`)));

  // ── 2b 顺带实测「生成来料检验单」这一步(与本任务无关的存量缺陷,原样留证) ──
  console.log('\n=== 2b 顺带:暂收单 → 生成来料检验单(当前被别处缺陷挡住,原样留证) ===');
  const inspBtn = await cb('QC_RECV', '生成来料检验单', { 编号: A.recv }); await sleep(500);
  out.findings.inspButton = { http: inspBtn.http, code: inspBtn.code, message: String(inspBtn.message || '').slice(0, 700) };
  info(`应答: ${brief(inspBtn, 700)}`);
  const inspResidue = Number((await one("SELECT COUNT(*) c FROM form_flow_link WHERE source_panel_code='QC_RECV'"
    + ` AND target_panel_code='QC_INSP' AND source_form_no=N'${esc(A.recv)}'`))?.c || 0);
  info(`该暂收单是否留下检验单链路行:${inspResidue}`);
  check('「生成来料检验单」当前 500(存量缺陷,已原样留证;不影响本探针后续走免检直达出口)',
    inspBtn.http === 500, brief(inspBtn, 200));

  // ── 3 免检直达入库单(三条链各一张) ──
  console.log('\n=== 3 免检直达:暂收单 → 采购入库单(真实出口,系统自己写链路行) ===');
  await directInbound(A, today);
  await directInbound(B1, today);
  await directInbound(B2, today);
  for (const c of [A, B1, B2]) info(`${c.tag}: 入库单=${c.pi} 表头批次键=${c.head0?.k} 表头批次号=${JSON.stringify(N(c.head0?.b))} 链路行=${JSON.stringify(c.piLinks)}`);
  check('三张入库单都已生成且链路行由系统写出',
    [A, B1, B2].every((c) => c.pi && c.piLinks.length >= 1),
    JSON.stringify([A, B1, B2].map((c) => ({ pi: c.pi, links: c.piLinks.length }))));

  // ── 4 A:系统自然产出的状态(照 oracle 走) ──
  console.log('\n=== 4 A:免检直达入库单(系统自然状态) ===');
  const oA = await oracle(A.pi);
  info(`oracle(A)=${JSON.stringify(oA)}`);
  const jeq = [await javaEquiv([A.pi])];
  const aAud = await audit('PURCHASE_IN', A.pi); await sleep(900);
  const ledA = await ledger(A.ledgerId);
  out.states.A = { doc: A.pi, oracle: oA, audit: { http: aAud.http, code: aAud.code, message: String(aAud.message || '').slice(0, 300) }, ledger: ledA };
  console.log(`  A 审核应答: ${brief(aAud)}  台账=${JSON.stringify(ledA)}`);
  check('A 采购入库单审核**不 500**', aAud.http !== 500 && okResp(aAud), brief(aAud));
  check(`A 台账状态与 oracle 一致(命中档 ${oA.branch} ⇒ ${oA.branch > 0 ? 'ACTIVE' : 'PENDING'})`,
    oA.branch > 0 ? N(ledA?.status) === 'ACTIVE' && !!N(ledA?.batch_no) : N(ledA?.status) === 'PENDING' && N(ledA?.batch_no) === null,
    JSON.stringify({ oracle: oA, ledger: ledA }));

  // ── 5 B1:只留②档(被改的那一句) ──
  console.log('\n=== 5 B1:清空 表头/来源单 批次键,只留 form_flow_link.batch_id(②档) ===');
  await q(`UPDATE bd_purchase_in SET [批次键]=NULL WHERE 单据编号=N'${esc(B1.pi)}'`);
  await q(`UPDATE sl_recv SET [批次键]=NULL WHERE 单据编号=N'${esc(B1.recv)}'`);
  await q(`UPDATE form_flow_link SET batch_id=${B1.ledgerId} WHERE target_panel_code='PURCHASE_IN' AND target_form_no=N'${esc(B1.pi)}'`);
  const oB1 = await oracle(B1.pi);
  info(`B1 入库单=${B1.pi} 清键+补链路 batch_id 后 oracle=${JSON.stringify(oB1)}`);
  check('B1 ①档不可用(表头批次键空) / ③档不可用(来源单头批次键空)', oB1.head === null && oB1.srcKey === null, JSON.stringify(oB1));
  check('B1 ②档命中且 = 本链批次键', oB1.branch === 2 && oB1.link === B1.ledgerId, JSON.stringify({ o: oB1, K: B1.ledgerId }));
  jeq.push(await javaEquiv([B1.pi]));
  const b1Aud = await audit('PURCHASE_IN', B1.pi); await sleep(900);
  const ledB1 = await ledger(B1.ledgerId);
  out.states.B1 = { doc: B1.pi, oracle: oB1, audit: { http: b1Aud.http, code: b1Aud.code, message: String(b1Aud.message || '').slice(0, 300) }, ledger: ledB1 };
  console.log(`  B1 审核应答: ${brief(b1Aud)}  台账=${JSON.stringify(ledB1)}`);
  check('🔴 B1(②档命中)审核**不 500** —— 旧实现若在这里抛错即"等价性不成立",必须上报',
    b1Aud.http !== 500 && okResp(b1Aud), brief(b1Aud));
  check('🔴 B1 **②档命中**:本链批次台账翻 ACTIVE 且取到号(跳过的路会保持 PENDING/NULL)',
    N(ledB1?.status) === 'ACTIVE' && !!N(ledB1?.batch_no), JSON.stringify(ledB1));
  const fflB1 = await one(`SELECT COUNT(*) c FROM form_flow_link WHERE batch_id=${B1.ledgerId} AND batch_no=N'${esc(N(ledB1?.batch_no))}'`);
  check('B1 form_flow_link 该批次 batch_no 已回填(②档取号后走完了回填链)', Number(fflB1?.c) >= 1,
    JSON.stringify({ fflB1, ledger: ledB1 }));
  check('B1 未误动其它批次台账', N((await ledger(A.ledgerId))?.batch_no) === N(ledA?.batch_no),
    JSON.stringify({ A: await ledger(A.ledgerId), A_before: ledA }));

  // ── 6 B2:与 B1 只差链路行 batch_id ──
  console.log('\n=== 6 B2:同 B1 但 form_flow_link.batch_id=NULL(0 行 ⇒ 跳过 / 旧实现 500) ===');
  await q(`UPDATE bd_purchase_in SET [批次键]=NULL WHERE 单据编号=N'${esc(B2.pi)}'`);
  await q(`UPDATE sl_recv SET [批次键]=NULL WHERE 单据编号=N'${esc(B2.recv)}'`);
  const b2Links = await q(`SELECT id, batch_id FROM form_flow_link WHERE target_panel_code='PURCHASE_IN' AND target_form_no=N'${esc(B2.pi)}'`);
  await q(`UPDATE form_flow_link SET batch_id=NULL WHERE target_panel_code='PURCHASE_IN' AND target_form_no=N'${esc(B2.pi)}'`);
  const oB2 = await oracle(B2.pi);
  info(`B2 入库单=${B2.pi} 链路行(置 NULL 前)${JSON.stringify(b2Links)} | oracle=${JSON.stringify(oB2)}`);
  check('B2 与 B1 只差链路行 batch_id(行还在,只是 batch_id 空) ⇒ oracle=0 行', b2Links.length >= 1 && oB2.branch === 0, JSON.stringify({ b2Links, oB2 }));
  jeq.push(await javaEquiv([B2.pi]));
  const b2Before = await ledger(B2.ledgerId);
  const b2Aud = await audit('PURCHASE_IN', B2.pi); await sleep(900);
  const ledB2 = await ledger(B2.ledgerId);
  out.states.B2 = { doc: B2.pi, oracle: oB2, audit: { http: b2Aud.http, code: b2Aud.code, message: String(b2Aud.message || '').slice(0, 300) }, ledgerBefore: b2Before, ledger: ledB2 };
  console.log(`  B2 审核应答: ${brief(b2Aud)}  台账=${JSON.stringify(ledB2)}`);
  if (EXPECT === 'NEW') {
    check('B2 审核**不 500**(0 行那条路已修)', b2Aud.http !== 500, brief(b2Aud));
    check('B2 **跳过**:台账保持 PENDING + 批次号空', N(ledB2?.status) === 'PENDING' && N(ledB2?.batch_no) === null, JSON.stringify(ledB2));
  } else {
    check('B2 审核 **500**(旧实现在 0 行处抛 EmptyResultDataAccessException)', is0Row500(b2Aud), brief(b2Aud));
    check('B2 500 后整笔回滚:台账保持 PENDING + 批次号空', N(ledB2?.status) === 'PENDING' && N(ledB2?.batch_no) === null, JSON.stringify(ledB2));
  }

  // ── 7 C:手工采购入库单(链路里一行都没有) ──
  console.log('\n=== 7 C:手工采购入库单(无链路 ⇒ 0 行) ===');
  const cSave = await cb('PURCHASE_IN', '保存', {
    单据日期: today, 供应商: `探针供应商${stamp}`, 仓库: WH, 经手人: 'admin',
    detail: { items: [{ 存货编码: INV, 存货名称: INV_NAME, 实收数量: 5, 计量单位: 'kg', 单价: 10, 税率: 13,
      金额: 50, 含税金额: 56.5, 批号: `HITLINK-${stamp}-C`, 仓库: WH }] },
  });
  const C = track('PURCHASE_IN', N(cSave?.data?.编号));
  if (!C) throw new Error('建手工采购入库单失败: ' + brief(cSave, 400));
  const cRows = Number((await one(`SELECT COUNT(*) c FROM form_flow_link WHERE target_panel_code='PURCHASE_IN' AND target_form_no=N'${esc(C)}'`))?.c || 0);
  const oC = await oracle(C);
  info(`C 手工入库单=${C} 链路行 ${cRows} 条 | oracle=${JSON.stringify(oC)}`);
  check('C 链路行 0 条(手工单形状)', cRows === 0 && oC.branch === 0, JSON.stringify({ cRows, oC }));
  jeq.push(await javaEquiv([C]));
  const cAud = await audit('PURCHASE_IN', C); await sleep(900);
  out.states.C = { doc: C, oracle: oC, audit: { http: cAud.http, code: cAud.code, message: String(cAud.message || '').slice(0, 300) } };
  console.log(`  C 审核应答: ${brief(cAud)}`);
  if (EXPECT === 'NEW') check('C 审核**不 500**(8cc1648f 修的就是这条)', cAud.http !== 500, brief(cAud));
  else check('C 审核 **500**(旧实现在 0 行处抛异常 —— 复现 8cc1648f 报的形状)', is0Row500(cAud), brief(cAud));

  // ── 8 弃审 B1(②档命中的那张) ──
  console.log('\n=== 8 弃审 B1:批次号不回收、台账状态不变 ===');
  const unB1 = await cb('PURCHASE_IN', '弃审', { 编号: B1.pi }); await sleep(900);
  const ledB1b = await ledger(B1.ledgerId);
  out.states.B1Unaudit = { resp: { http: unB1.http, code: unB1.code, message: String(unB1.message || '').slice(0, 300) }, ledger: ledB1b };
  console.log(`  B1 弃审应答: ${brief(unB1)}  台账=${JSON.stringify(ledB1b)}`);
  check('B1 弃审成功', okResp(unB1), brief(unB1));
  check('B1 弃审后台账号/状态不变(口径:不回收)', N(ledB1b?.batch_no) === N(ledB1?.batch_no) && N(ledB1b?.status) === 'ACTIVE',
    JSON.stringify({ before: ledB1, after: ledB1b }));
  const inhCancel = await one(`SELECT COUNT(*) c FROM inh WHERE 单据编号=N'${esc(B1.pi)}' AND ISNULL(asp_cancel,'N')='Y'`);
  check('B1 弃审后台账流水红冲(inh 标 Y)', Number(inhCancel?.c) === 1, JSON.stringify(inhCancel));

  // ── 9 等价性小结 ──
  console.log('\n=== 9 「两种实现返回同一个 batch_id」的直接证据 ===');
  const jeqRaw = jeq.filter(Boolean).join('\n');
  if (jeqRaw) {
    out.equiv = { raw: jeqRaw };
    const rows = jeqRaw.split(/\r?\n/).filter((l) => l.startsWith('doc='));
    const bad = rows.filter((l) => l.includes('**不同**'));
    check(`Java 逐字对照探针:${rows.length} 个样本,两实现返回值全部等价(命中同值 / 0 行仅旧抛异常)`, rows.length >= 3 && bad.length === 0, bad.join(' | '));
  } else {
    info('未提供 YJ_JAVA_CP ⇒ 本段以"路数判别(哪一行台账翻 ACTIVE)+ 审核应答"为等价性证据,见报告');
  }

  out.docs = { PO, A: A.pi, B1: B1.pi, B2: B2.pi, C };
  return { A, B1, B2, C };
}

async function cleanup(ctx, err) {
  const docs = [...new Set([...Object.values(out.docs).filter(Boolean), ...CREATED.map((c) => c.no)])];
  console.log('\n=== 10 清理 ===');
  if (err) console.log(`  (异常路径也照常清理:${String(err.message).split('\n')[0]})`);
  const rank = { PURCHASE_IN: 4, QC_INSP: 3, QC_RECV: 2, PU_ORDER: 1 };
  const seq = [...CREATED].sort((a, b) => (rank[b.panel] || 0) - (rank[a.panel] || 0));
  for (const { panel: p, no } of seq) {
    if (!no) continue;
    for (const b of ['弃审', '删除']) {
      try { const r = await cb(p, b, { 编号: no }); if (!okResp(r)) info(`${p} ${no} ${b} 未成功:${brief(r, 160)}`); }
      catch (e) { info(`${p} ${no} ${b} 异常:${String(e.message).slice(0, 80)}`); }
    }
  }
  const inList = (arr) => arr.filter(Boolean).map((x) => `N'${esc(x)}'`).join(',') || "N''";
  const idList = [...new Set(LEDGER_IDS)].join(',') || '0';
  const kill = [
    `DELETE FROM inh WHERE 单据编号 IN (${inList(docs)})`,
    `DELETE FROM outh WHERE 单据编号 IN (${inList(docs)})`,
    `DELETE FROM yj_doc_status WHERE doc_no IN (${inList(docs)})`,
    `DELETE FROM form_flow_link WHERE source_form_no IN (${inList(docs)}) OR target_form_no IN (${inList(docs)})`,
    `DELETE FROM yj_form_approval WHERE form_no IN (${inList(docs)})`,
    `DELETE FROM yj_doc_batch WHERE id IN (${idList})`,
    `DELETE FROM bl_purchase_in WHERE 单据编号 IN (${inList(docs)})`,
    `DELETE FROM bd_purchase_in WHERE 单据编号 IN (${inList(docs)})`,
    `DELETE FROM qc_insp_detail WHERE 单据编号 IN (${inList(docs)})`,
    `DELETE FROM qc_insp WHERE 单据编号 IN (${inList(docs)})`,
    `DELETE FROM sl_recv_detail WHERE 单据编号 IN (${inList(docs)})`,
    `DELETE FROM sl_recv WHERE 单据编号 IN (${inList(docs)})`,
    `DELETE FROM bl_pu_order WHERE 单据编号 IN (${inList(docs)})`,
    `DELETE FROM bd_pu_order WHERE 单据编号 IN (${inList(docs)})`,
  ];
  for (const s of kill) { try { await q(s); } catch (e) { info('清理语句失败: ' + String(e.message).split('\n')[0] + ' :: ' + s.slice(0, 70)); } }
  // kucun:逐行还原(不按批号删 —— 批号可能撞既有行)
  if (BASE.kucun0) {
    const before = JSON.parse(BASE.kucun0), now = JSON.parse(await kucunSnapshot());
    const nowById = new Map(now.map((r) => [r.id, r])), beforeById = new Map(before.map((r) => [r.id, r]));
    for (const r of now) if (!beforeById.has(r.id)) { await q(`DELETE FROM kucun WHERE id=${r.id}`); info(`kucun 删除新增行 id=${r.id}(${r.wzdm}/${r.ckdm}/${r.lot_no})`); }
    for (const b of before) {
      const n = nowById.get(b.id);
      if (n && JSON.stringify(n) !== JSON.stringify(b)) {
        await q(`UPDATE kucun SET yl=${b.yl}, rkl=${b.rkl}, ckl=${b.ckl}, asp_cancel=N'${b.c}' WHERE id=${b.id}`);
        info(`kucun 还原行 id=${b.id} → yl=${b.yl}`);
      }
    }
  }
  const rc = await cb('STOCK_LEDGER', '重算成本', {}).catch(() => null);
  info('重算成本应答: ' + brief(rc, 160));
  // 发号池 / 操作留痕:删掉本次运行新增的行(只删 id 超过基线最大值的,拿不到别人既有行)
  if (BASE.maxIds) {
    for (const [tb, col] of [['s_allno', 'ID'], ['yj_usage_log', 'id']]) {
      try {
        const r = await one(`SELECT COUNT(*) c FROM ${tb} WHERE ${col} > ${BASE.maxIds[tb]}`);
        await q(`DELETE FROM ${tb} WHERE ${col} > ${BASE.maxIds[tb]}`);
        info(`${tb} 清掉本次新增 ${r?.c ?? 0} 行(> ${BASE.maxIds[tb]})`);
      } catch (e) { info(`${tb} 清理失败: ` + String(e.message).split('\n')[0]); }
    }
  }
  await sleep(1500);

  console.log('\n=== 11 收尾核对 ===');
  const t1 = await snap4(P), p1 = await snap4(PP);
  out.cleanup = { test: t1, prod: p1 };
  info(`测试 ${DB}: kucun 余量 ${t1.kucun_sum} / 行 ${t1.kucun_rows} / inh ${t1.inh_cnt} / outh ${t1.outh_cnt} / 成本表 ${t1.cost_cnt} 行`);
  info(`正式 ${PROD_DB}: kucun 余量 ${p1.kucun_sum} / inh ${p1.inh_cnt} / outh ${p1.outh_cnt} / 成本表 ${p1.cost_cnt} 行`);
  check('测试账套回到基线 kucun=15939 / inh=31 / outh=0 / 成本=31',
    Number(t1.kucun_sum) === 15939 && t1.inh_cnt === 31 && t1.outh_cnt === 0 && t1.cost_cnt === 31, JSON.stringify(t1));
  check('测试账套链路/台账清零(form_flow_link=0, yj_doc_batch=0)', Number(t1.ffl) === 0 && Number(t1.batches) === 0, JSON.stringify({ ffl: t1.ffl, batches: t1.batches }));
  check('正式账套未被改动(与基线一致)', JSON.stringify(BASE.prod) === JSON.stringify(p1), `${JSON.stringify(BASE.prod)} vs ${JSON.stringify(p1)}`);
  if (BASE.kucun0) {
    const kucunNow = await kucunSnapshot();
    out.cleanup.kucunSame = kucunNow === BASE.kucun0;
    check('kucun 逐行回到基线(快照完全相同)', out.cleanup.kucunSame, '改后: ' + kucunNow.slice(0, 300));
  }
  if (BASE.cnt0) {
    const cnt1 = await allTableCounts(P);
    const diff = Object.keys(cnt1).filter((k) => cnt1[k] !== BASE.cnt0[k]).map((k) => `${k}: ${BASE.cnt0[k]} → ${cnt1[k]}`);
    out.tableDiff = diff;
    info(`全库行数差异: ${diff.length ? diff.join(' | ') : '无'}`);
    check('全库行数快照与基线完全一致(含发号池与操作留痕 — 本次新增行已清)', diff.length === 0, diff.join(' | '));
  }
}

let ctx = null, thrown = null;
try { ctx = await main(); }
catch (e) { thrown = e; console.error('\nPROBE ERROR: ' + e.stack); }
finally {
  try { await cleanup(ctx, thrown); } catch (e) { console.error('清理段异常: ' + e.stack); }
  try { if (EVIDENCE) { fs.writeFileSync(EVIDENCE, JSON.stringify(out, null, 1)); console.log('\n观测已写 ' + EVIDENCE); } } catch { /* ignore */ }
  try { await P?.close(); await PP?.close(); } catch { /* ignore */ }
}
console.log(`\n═══ 结果(${LABEL}): 通过 ${pass} / 失败 ${fail} ═══`);
process.exit(thrown || fail ? 1 : 0);
