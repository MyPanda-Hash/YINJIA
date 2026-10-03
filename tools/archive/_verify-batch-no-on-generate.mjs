/**
 * _verify-batch-no-on-generate.mjs — 批次号新口径「**生单即定号** + 不再回填」验证(2026-10-04)
 *
 * 用户定稿口径(取代 2026-09-21 的「纯入库日期 + 入库审核确认并回填全链」):
 *   ① 批次号 = 供应商编码去掉 `YJ-` 前缀 + `-` + **生单当天** yyyyMMdd
 *      (如 供应商 YJ-TX、生单日 2026-09-10 ⇒ `TX-20260910`);无序号;
 *   ② 取号时机 = **采购订单→送料暂收单 生单那一刻**;下游(检验/入库/退回)逐站**继承同一个号**;
 *   ③ **不再有回填机制**:入库单审核**不会**给上游重新编号(旧 assignNoAndBackfill 已删除);
 *   ④ 可编辑窗口 = **送料暂收单草稿态的单头**(元数据 editable=1),改完头 → 全部明细行跟着一致;
 *      一旦「送料暂收单审核」,整链不可保存、批次号冻结;
 *   ⑤ 下游三单(检验/退回/入库)的批次号字段元数据 editable=0(不可改);
 *   ⑥ 台账**生单即 ACTIVE 且带号** —— 不再出现 status='PENDING'、batch_no=NULL 的"待编号"批次。
 *
 * 跑在**测试账套**(登录 factory=YJ_TEST → HSDZ_MES_TEST),不污染正式库。
 * 用法:node tools/archive/_verify-batch-no-on-generate.mjs   (env: YJ_API)
 */
import { createRequire } from 'node:module';
import { fetchRetry } from './_apifetch.mjs';

const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const API = process.env.YJ_API || 'http://localhost:8090/api';
const DB = process.env.YJ_DB || 'HSDZ_MES_TEST';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, msg) => { console.log(`  ${c ? '[PASS]' : '[FAIL]'} ${msg}`); if (!c) fails++; };
const info = (msg) => console.log(`         ${msg}`);

const pool = await new mssql.ConnectionPool({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia', password: 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
}).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
const one = async (s) => (await q(s))[0] || null;
const N = (v) => (v === null || v === undefined ? null : String(v).trim());
const isBlank = (v) => N(v) === null || N(v) === '';
const dstr = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' })
  .format(d || new Date()).replace(/-/g, '');
const TODAY = dstr();

// ============ 登录(**测试账套**) ============
const lj = await (await fetchRetry(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})).json();
if (!lj?.data?.token) { console.error('登录失败(测试账套):' + JSON.stringify(lj).slice(0, 300)); await pool.close(); process.exit(1); }
console.log(`=== 登录成功(账套 ${lj.data.factory || '?'} / 目标库 ${DB})===`);
const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + lj.data.token };
const post = async (url, body) => {
  const j = await (await fetchRetry(API + url, { method: 'POST', headers: H, body: JSON.stringify(body) })).json();
  if (j.code !== 0 && j.code !== 200) throw new Error(`${url} → ${JSON.stringify(j).slice(0, 300)}`);
  return j.data;
};
const cb = (panelCode, buttonName, formData) => post('/px/callButton', { panelCode, buttonName, formData: formData || {}, buttonParam: {} });
const get = async (url) => {
  const j = await (await fetchRetry(API + url, { headers: H })).json();
  if (j.code !== 0 && j.code !== 200) throw new Error(`${url} → ${JSON.stringify(j).slice(0, 300)}`);
  return j.data;
};
/**
 * 按界面同款 payload 保存一张单:**整单**(头 + 全部明细行)。
 * ⚠ 别只发 {编号, 批次号}:saveDoc→upsertLineRows 把"载荷里没有的明细行"当成**已删除**
 *   (整单保存语义),只发头会把明细行软删掉(2026-10-04 探针首版就踩到,报"来源单据无明细行,不能生单")。
 */
async function saveWholeDoc(panelCode, docNo, headPatch = {}, buttonName = '保存为草稿') {
  const desc = await get(`/px/getFormDescriptor?panelCode=${panelCode}&code=${encodeURIComponent(docNo)}`);
  const head = { ...(desc?.data || {}), ...headPatch };
  const items = Object.values(desc?.detailData || {}).find((v) => Array.isArray(v)) || [];
  return cb(panelCode, buttonName, { ...head, detail: { items } });
}

// ============ 元数据口径 ============
console.log('\n=== ① 元数据可编辑口径(唯一可改点 = 送料暂收单草稿态单头) ===');
const md = await one(`SELECT
  (SELECT ISNULL(editable,1) FROM yj_field WHERE panel_code='QC_RECV' AND place=N'query,header' AND label=N'批次号') recvH,
  (SELECT ISNULL(editable,1) FROM yj_field WHERE panel_code='QC_RECV' AND place=N'detail' AND label=N'批次号') recvL,
  (SELECT ISNULL(editable,1) FROM yj_field WHERE panel_code='QC_INSP' AND place=N'query,header' AND label=N'批次号') inspH,
  (SELECT ISNULL(editable,1) FROM yj_field WHERE panel_code='QC_INSP' AND place=N'detail' AND label=N'批次号') inspL,
  (SELECT ISNULL(editable,1) FROM yj_field WHERE panel_code='PURCHASE_IN' AND place=N'query,header' AND label=N'批次号') piH,
  (SELECT ISNULL(editable,1) FROM yj_field WHERE panel_code='PURCHASE_IN' AND place=N'detail' AND label=N'批次号') piL,
  (SELECT ISNULL(editable,1) FROM yj_field WHERE panel_code='QC_RETURN' AND place=N'query,header' AND label=N'批次号') thH`);
ok(Number(md?.recvH) === 1, `送料暂收单·单头 批次号 editable=1(可改;实得 ${md?.recvH})`);
ok([md?.recvL, md?.inspH, md?.inspL, md?.piH, md?.piL, md?.thH].every((v) => Number(v) === 0),
  `暂收明细/检验头行/入库头行/退回头 editable 全为 0(不可改;实得 ${[md?.recvL, md?.inspH, md?.inspL, md?.piH, md?.piL, md?.thH].join(',')})`);

// ============ 选样:一张已审核、余量够的采购订单 ============
console.log('\n=== ② 选样:一张已审核且有剩余量的采购订单 ===');
const list = (await post('/px/queryFormDataList', { panelCode: 'PU_ORDER', pageNo: 1, pageSize: 400 }))?.list || [];
let pick = null;
for (const r of list) {
  if (N(r['单据状态']) !== '已审核') continue;
  const no = N(r['单据编号']);
  let ls;
  try { ls = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: no }); } catch { continue; }
  const line = (ls?.lines || []).find((x) => Number(x.剩余数量) >= 5);
  if (!line) continue;
  pick = { no, line, nextBatchNo: ls?.nextBatchNo, supplier: N(r['供应商编码']) };
  break;
}
if (!pick) { console.error('找不到合适的已审核采购订单'); await pool.close(); process.exit(1); }
info(`采购订单 ${pick.no}(供应商编码 ${pick.supplier},行 ${pick.line.行号} 剩余 ${pick.line.剩余数量})`);

// 期望批次号 = 供应商编码去 YJ- 前缀 + - + 当天
const suffix = String(pick.supplier || '').replace(/^YJ-/i, '');
const EXPECT = suffix ? `${suffix}-${TODAY}` : TODAY;
ok(N(pick.nextBatchNo) === EXPECT,
  `batchFlow/lines 预告的本批批次号 = ${EXPECT}(供应商 ${pick.supplier} ⇒ 去 YJ- 前缀 "${suffix}" + 当天 ${TODAY};实得 ${JSON.stringify(pick.nextBatchNo)})`);

// ============ ③~⑧ 全链验证(cleanup 放 finally:断言中途抛错也要把测试单据收拾干净) ============
/** 本次造出来的单据 [panel, no],反序清理用 */
const created = [];
let recv = '', insp = '', pi = '', key = 0;
try {
  // ============ 生单:批次号当场就有了 ============
  console.log('\n=== ③ 生单(采购订单→送料暂收单):批次号当场写入,台账 ACTIVE ===');
  const gen = await post('/px/batchFlow/generate', {
    sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: pick.no,
    lines: [{ lineKey: pick.line.lineKey, qty: 5 }],
  });
  recv = N(gen['编号']);
  created.push(['QC_RECV', recv]);
  key = Number(gen['批次键'] || 0);
  ok(N(gen['批次号']) === EXPECT, `生单接口返回批次号 = ${EXPECT}(实得 ${JSON.stringify(gen['批次号'])})`);
  const recvRow = await one(`SELECT [批次号] b, [批次键] k FROM sl_recv WHERE 单据编号=N'${recv}'`);
  const recvLines = await one(`SELECT COUNT(*) n, SUM(CASE WHEN [批次号]=N'${EXPECT}' THEN 1 ELSE 0 END) hit
    FROM sl_recv_detail WHERE 单据编号=N'${recv}' AND ISNULL(asp_cancel,'N')<>'Y'`);
  ok(N(recvRow?.b) === EXPECT, `送料暂收单**单头**批次号 = ${EXPECT}(实得 ${JSON.stringify(recvRow?.b)})`);
  ok(Number(recvLines?.n) > 0 && Number(recvLines?.hit) === Number(recvLines?.n),
    `送料暂收单**全部明细行**批次号 = ${EXPECT}(${recvLines?.hit}/${recvLines?.n} 行)`);
  ok(N(recvRow?.k) === String(key), `暂收单头「批次键」= 台账行 id(实得 ${recvRow?.k} / ${key})`);
  const led = await one(`SELECT batch_no, status, batch_seq FROM yj_doc_batch WHERE id=${key}`);
  ok(N(led?.batch_no) === EXPECT, `批次台账 batch_no 生单即写入 = ${EXPECT}(实得 ${JSON.stringify(led?.batch_no)})`);
  ok(N(led?.status) === 'ACTIVE', `批次台账 status=ACTIVE(生单即有号,不再有"待编号 PENDING";实得 ${led?.status})`);

  // ============ 草稿态可改:改单头 → 明细行跟着一致 ============
  console.log('\n=== ④ 草稿态可改:改**单头**批次号 → 全部明细行随单头一致 ===');
  const EDITED = `${suffix || 'X'}-${TODAY}-改`;
  let editMsg = '';
  try {
    await saveWholeDoc('QC_RECV', recv, { 批次号: EDITED });
    editMsg = '保存成功';
  } catch (e) { editMsg = '保存被拒:' + String(e.message).slice(0, 140); }
  info(`改单头批次号 → ${EDITED};${editMsg}`);
  const afterEdit = await one(`SELECT
    (SELECT [批次号] FROM sl_recv WHERE 单据编号=N'${recv}') h,
    (SELECT COUNT(*) FROM sl_recv_detail WHERE 单据编号=N'${recv}' AND ISNULL(asp_cancel,'N')<>'Y') n,
    (SELECT COUNT(*) FROM sl_recv_detail WHERE 单据编号=N'${recv}' AND ISNULL(asp_cancel,'N')<>'Y' AND [批次号]=N'${EDITED}') hit`);
  ok(N(afterEdit?.h) === EDITED, `单头已改为人工值 ${EDITED}(实得 ${JSON.stringify(afterEdit?.h)})`);
  ok(Number(afterEdit?.n) > 0, `改单头后台收单仍有 ${afterEdit?.n} 行有效明细(整单保存不该丢行)`);
  ok(Number(afterEdit?.hit) === Number(afterEdit?.n) && Number(afterEdit?.n) > 0,
    `明细行全部随单头一致(${afterEdit?.hit}/${afterEdit?.n} 行 = ${EDITED})—— 用户口径「下面的明细项目也要批次号一致」`);
  // 改回标准号,继续走链路
  await saveWholeDoc('QC_RECV', recv, { 批次号: EXPECT });
  const backAgain = await one(`SELECT [批次号] h FROM sl_recv WHERE 单据编号=N'${recv}'`);
  ok(N(backAgain?.h) === EXPECT, `改回 ${EXPECT} 成功(草稿态可反复改)`);

  // ============ 审核 → 不能修改 ============
  console.log('\n=== ⑤ 送料暂收单审核后:整单不可保存(批次号冻结) ===');
  await cb('QC_RECV', '审核', { 编号: recv });
  await sleep(600);
  let lockMsg = '';
  try { await cb('QC_RECV', '保存为草稿', { 编号: recv, 批次号: `${EXPECT}-偷改` }); lockMsg = '居然保存成功(不符合口径!)'; }
  catch (e) { lockMsg = String(e.message).slice(0, 120); }
  const afterLock = await one(`SELECT [批次号] h FROM sl_recv WHERE 单据编号=N'${recv}'`);
  ok(N(afterLock?.h) === EXPECT, `审核后批次号未被改动仍 = ${EXPECT}(保存被拒理由:${lockMsg})`);

  // ============ 下游继承:检验单 ============
  console.log('\n=== ⑥ 送料暂收→来料检验 生单:批次号**继承**(不重新取号) ===');
  insp = N((await cb('QC_RECV', '生成来料检验单', { 编号: recv }))['编号']);
  created.push(['QC_INSP', insp]);
  const inspRow = await one(`SELECT [批次号] b, [批次键] k FROM qc_insp WHERE 单据编号=N'${insp}'`);
  const inspLines = await one(`SELECT COUNT(*) n, SUM(CASE WHEN [批次号]=N'${EXPECT}' THEN 1 ELSE 0 END) hit
    FROM qc_insp_detail WHERE 单据编号=N'${insp}' AND ISNULL(asp_cancel,'N')<>'Y'`);
  ok(N(inspRow?.b) === EXPECT, `来料检验单 单头批次号 = ${EXPECT}(继承;实得 ${JSON.stringify(inspRow?.b)})`);
  ok(Number(inspLines?.n) > 0 && Number(inspLines?.hit) === Number(inspLines?.n),
    `来料检验单 全部明细行 = ${EXPECT}(${inspLines?.hit}/${inspLines?.n})`);
  ok(N(inspRow?.k) === String(key), `「批次键」逐站继承(检验单 ${inspRow?.k} = ${key})`);

  // ============ 检验目录 / 检验数据记录:建单即带号(不再靠回填) ============
  console.log('\n=== ⑦ 检验目录 + 检验数据记录:建单即带号(旧口径是"入库审核后回填") ===');
  const cat = await one(`SELECT COUNT(*) n, SUM(CASE WHEN ISNULL([批次号],N'')<>N'' THEN 1 ELSE 0 END) filled
    FROM qc_catalog_detail WHERE 检验单号=N'${insp}' AND ISNULL(asp_cancel,'N')<>'Y'`);
  info(`检验目录行 ${cat?.n} 行,其中带批次号 ${cat?.filled} 行`);
  ok(Number(cat?.n) > 0 && Number(cat?.filled) === Number(cat?.n),
    `检验目录行**建单即带**批次号(${cat?.filled}/${cat?.n};旧口径此时全空,等入库审核回填)`);
  const recs = await one(`SELECT COUNT(*) n, SUM(CASE WHEN ISNULL(r.[物料批次],N'')<>N'' THEN 1 ELSE 0 END) filled
    FROM qc_insp_rec r JOIN qc_catalog_detail d ON d.检验数据记录单号 = r.单据编号
    WHERE d.检验单号=N'${insp}' AND ISNULL(r.asp_cancel,'N')<>'Y'`);
  ok(Number(recs?.n) > 0 && Number(recs?.filled) === Number(recs?.n),
    `检验数据记录 物料批次**建单即带**(${recs?.filled}/${recs?.n})`);

  // ============ 检验审核 → 采购入库单:仍继承同号 ============
  console.log('\n=== ⑧ 检验审核 → 自动生成采购入库单:批次号仍是同一个(无回填动作) ===');
  await q(`UPDATE qc_insp_detail SET 合格数量 = ISNULL(NULLIF(数量,0), 送检数量), 不合格数量 = 0 WHERE 单据编号=N'${insp}'`);
  await cb('QC_INSP', '审核', { 编号: insp });
  await sleep(900);
  pi = N((await one(`SELECT TOP 1 target_form_no no FROM form_flow_link WHERE source_panel_code='QC_INSP'
    AND source_form_no=N'${insp}' AND target_panel_code='PURCHASE_IN' AND link_status='ACTIVE'`))?.no);
  if (!pi) { ok(false, '检验单审核后应自动生成采购入库单,实得 0 张'); } else {
    created.push(['PURCHASE_IN', pi]);
    const piRow = await one(`SELECT [批次号] b, [批次键] k FROM bd_purchase_in WHERE 单据编号=N'${pi}'`);
    const piLines = await one(`SELECT COUNT(*) n, SUM(CASE WHEN [批次号]=N'${EXPECT}' THEN 1 ELSE 0 END) hit
      FROM bl_purchase_in WHERE 单据编号=N'${pi}' AND ISNULL(asp_cancel,'N')<>'Y'`);
    ok(N(piRow?.b) === EXPECT, `采购入库单 单头批次号 = ${EXPECT}(实得 ${JSON.stringify(piRow?.b)})`);
    ok(Number(piLines?.n) > 0 && Number(piLines?.hit) === Number(piLines?.n),
      `采购入库单 全部明细行 = ${EXPECT}(${piLines?.hit}/${piLines?.n})`);
    ok(N(piRow?.k) === String(key), `入库单「批次键」= ${key}(实得 ${piRow?.k})`);
    // 入库审核:旧口径会在这里"确认批次号并回填全链";新口径应**一字不改**
    // 仓库只为过既有的「仓库档案」校验(与批次号无关);按列存在性打补丁 ——
    // bd_purchase_in 在测试账套**没有** [仓库] 列,写它会 "Invalid column name"
    // (2026-10-04 探针踩到,别写死表名)。
    const WH = N((await one(`SELECT TOP 1 仓库名称 w FROM bs_wh WHERE ISNULL(asp_cancel,'N')<>'Y'`))?.w);
    const piWh = await one(`SELECT TOP 1 ISNULL([仓库],N'') w FROM bl_purchase_in WHERE 单据编号=N'${pi}'`);
    if (isBlank(piWh?.w) && WH) {
      await q(`UPDATE bl_purchase_in SET [仓库]=N'${WH}' WHERE 单据编号=N'${pi}'`);
      for (const t of ['bd_purchase_in', 'bl_purchase_in']) {
        const has = await one(`SELECT COL_LENGTH(N'dbo.${t}', N'仓库') AS n`);
        if (has?.n != null) await q(`UPDATE ${t} SET [仓库]=N'${WH}' WHERE 单据编号=N'${pi}'`);
      }
      info(`已为入库单 ${pi} 补合法仓库 ${WH}(过既有仓库档案校验,与批次号无关)`);
    }
    await cb('PURCHASE_IN', '审核', { 编号: pi }).catch((e) => info('入库审核:' + String(e.message).slice(0, 140)));
    await sleep(900);
    const link = await one(`SELECT [batch_no] b FROM yj_doc_batch WHERE id=${key}`);
    const final3 = await one(`SELECT
      (SELECT [批次号] FROM sl_recv WHERE 单据编号=N'${recv}') recvH,
      (SELECT [批次号] FROM qc_insp WHERE 单据编号=N'${insp}') inspH,
      (SELECT [批次号] FROM bd_purchase_in WHERE 单据编号=N'${pi}') piH`);
    ok(N(link?.b) === EXPECT, `入库审核后台账号**未变**(无回填换号;实得 ${JSON.stringify(link?.b)})`);
    ok([final3?.recvH, final3?.inspH, final3?.piH].every((v) => N(v) === EXPECT),
      `三单头终态一致 = ${EXPECT}(${final3?.recvH} / ${final3?.inspH} / ${final3?.piH})`);
    console.log(`\n  留证:暂收 ${recv} / 检验 ${insp} / 入库 ${pi} / 批次键 ${key} / 批次号 ${EXPECT}`);
  }
} finally {
  console.log('\n=== 清理测试单据(反序 弃审 → 删除;批次号按口径不回收) ===');
  for (const [p, no] of [...created].reverse()) {
    if (!no) continue;
    for (const b of ['弃审', '删除']) {
      try { await cb(p, b, { 编号: no }); console.log(`  ${p} ${no} ${b} ✓`); }
      catch (e) { console.log(`  ${p} ${no} ${b} 跳过:${String(e.message).slice(0, 90)}`); }
    }
  }
}

await pool.close();
console.log(`\n${fails ? `❌ 失败 ${fails} 项` : '✅ 全部通过'}`);
process.exit(fails ? 1 : 0);
