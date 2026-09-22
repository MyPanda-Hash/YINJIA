/**
 * _verify-batch-no-date-only.mjs — 送料批次号新口径「纯入库日期 + 同一日期同一批次 + 可人工改」验证
 *
 * 用户定稿口径(2026-09-21 二次变更,取代 _verify-batch-no-at-inbound.mjs 的旧口径):
 *   ① 格式 = **纯日期 yyyyMMdd**(如 20260921),不带序号;
 *   ② 日期取**采购入库单的「单据日期」**(不是送料当天、不是审核当天);
 *   ③ 「同一日期算同一批次」:同一天多批**共号**,允许重复(旧筛选唯一索引已由
 *      tools/migrate-batch-no-date-only.sql 删除,改非唯一索引);
 *   ④ 入库单填单/生单时**预设**、**可人工改**;审核时**以表头「批次号」为准**,为空才按单据日期补;
 *   ⑤ 审核时把最终号**回填全链**(暂收/检验/入库 头+行、批次台账、form_flow_link);
 *   ⑥ 弃审/作废不回收;历史号(YJ-…/10 位旧号)原样保留。
 *
 * 断言(8 组):
 *   ① 生单/审核前:暂收/检验/入库三单批次号为空(入库单的号由前端填单预设,探针走接口故为空)、
 *      台账 PENDING 且 batch_no=NULL、「批次键」逐站带下;
 *   ② 入库单表头**空** + 把「单据日期」改成**昨天** → 审核 → 批次号 = 昨天的 yyyyMMdd
 *      (**证明按入库日期取,不是送料当天**;送料当天=今天);
 *   ③ 入库单表头**人工填**自定义号 → 审核 → 批次号 = 该自定义值(原样,人工优先);
 *   ④ 同一采购订单、同一天(昨天)再来一批 → 批次号与第 1 批**同一个号**,且两行台账
 *      (同订单+同号,ACTIVE)在库中**并存** → 唯一性确已取消(旧唯一索引下第二行会被拒);
 *   ⑤ 另一张采购订单同一天 → 同样允许同号;
 *   ⑥ 每批都要**回填全链**:三单头一致、三单行全填、form_flow_link 该批次 id 全填;
 *   ⑦ 弃审 → 号与状态不变;重新审核 → 沿用原号(幂等);人工改过的号重审后仍以表头为准;
 *   ⑧ 索引口径:UX_yj_doc_batch_no_active 已删,IX_yj_doc_batch_no_active 存在且 **is_unique=0**。
 *
 * 用法: node tools/archive/_verify-batch-no-date-only.mjs   (env: YJ_API)
 */
import { createRequire } from 'node:module';

const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
// API 取数带网络级重试(undici 复用被服务端关掉的 keep-alive 连接会偶发 fetch failed,见 _apifetch.mjs)
import { fetchRetry } from './_apifetch.mjs';
const API = process.env.YJ_API || 'http://localhost:8090/api';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, msg) => { console.log(`  ${c ? '[PASS]' : '[FAIL]'} ${msg}`); if (!c) fails++; };
const info = (msg) => console.log(`         ${msg}`);

const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
const one = async (s) => (await q(s))[0] || null;
const N = (v) => (v === null || v === undefined ? null : String(v).trim());
const isBlank = (v) => N(v) === null || N(v) === '';
const lj = await (await fetchRetry(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json();
if (!lj?.data?.token) { console.error('登录失败:' + JSON.stringify(lj)); process.exit(1); }
const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + lj.data.token };
const post = async (url, body) => {
  const j = await (await fetchRetry(API + url, { method: 'POST', headers: H, body: JSON.stringify(body) })).json();
  if (j.code !== 0 && j.code !== 200) throw new Error(`${url} → ${JSON.stringify(j).slice(0, 300)}`);
  return j.data;
};
const cb = (panelCode, buttonName, formData) => post('/px/callButton', { panelCode, buttonName, formData: formData || {}, buttonParam: {} });
const dstr = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d || new Date()).replace(/-/g, '');
const TODAY = dstr();
const YESTERDAY = dstr(new Date(Date.now() - 86400000));
const YMD = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;   // yyyyMMdd → yyyy-MM-dd

// ============ 选样:两张已审核、余量够跑多批的采购订单 ============
console.log('=== 选样 ===');
// 既有「仓库档案」校验(入库审核时 仓库必须在 bs_wh)与批次号无关,但会挡住审核 ——
// 订单行没仓库时,探针在**自己造的入库草稿**上补一个合法仓库(不动采购订单与基础档案)。
const WH = N((await one(`SELECT TOP 1 仓库名称 w FROM bs_wh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 仓库名称=N'恒亿仓'`))?.w)
  || N((await one(`SELECT TOP 1 仓库名称 w FROM bs_wh WHERE ISNULL(asp_cancel,'N')<>'Y'`))?.w);
if (!WH) { console.error('bs_wh 无可用仓库,无法过既有仓库校验'); await pool.close(); process.exit(1); }
console.log(`  探针补仓库用:${WH}`);
const list = (await post('/px/queryFormDataList', { panelCode: 'PU_ORDER', pageNo: 1, pageSize: 400 }))?.list || [];
const need = [30, 10];   // 订单①要跑 3 批,订单② 1 批
const picks = [];
for (const r of list) {
  if (N(r['单据状态']) !== '已审核') continue;
  const no = N(r['单据编号']);
  if (picks.some((p) => p.no === no)) continue;
  let ls;
  try { ls = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: no }); } catch { continue; }
  const line = (ls?.lines || []).find((x) => Number(x.剩余数量) >= need[picks.length]);
  if (!line) continue;
  picks.push({ no, line });
  if (picks.length === 2) break;
}
if (picks.length < 2) { console.error('找不到两张有足够余量的已审核采购订单'); await pool.close(); process.exit(1); }
const [PO1, PO2] = picks;
console.log(`  采购订单① ${PO1.no}(行 ${PO1.line.行号} 剩余 ${PO1.line.剩余数量},要跑 3 批)  /  采购订单② ${PO2.no}(行 ${PO2.line.行号} 剩余 ${PO2.line.剩余数量})`);
console.log(`  送料当天(今日)= ${TODAY}   探针用来区分"入库日期"的昨天 = ${YESTERDAY}`);

/**
 * 走一遍 分批送料 → 暂收审核 → 生成检验单 → 检验审核 → 造入库单草稿(不审核)。
 * @param piDate 入库单「单据日期」(yyyy-MM-dd);@param piBatchNo 入库单表头预设批次号(空=模拟"没预设")
 */
async function buildChain(po, qty, tag, piDate, piBatchNo) {
  const out = { tag, po: po.no, recv: null, insp: null, pi: null, key: null, piDate, piBatchNo };
  const gen = await post('/px/batchFlow/generate', {
    sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: po.no,
    lines: [{ lineKey: po.line.lineKey, qty }],
  });
  out.recv = N(gen['编号']);
  out.genBatchNo = gen['批次号'];
  out.key = Number((await one(`SELECT TOP 1 id FROM yj_doc_batch WHERE target_form_no=N'${out.recv}' AND source_form_no=N'${po.no}' AND source_panel_code='PU_ORDER'`))?.id || 0);
  out.recvKey = await one(`SELECT [批次键] k, [批次号] b FROM sl_recv WHERE 单据编号=N'${out.recv}'`);
  await cb('QC_RECV', '审核', { 编号: out.recv }); await sleep(600);
  out.insp = N((await cb('QC_RECV', '生成来料检验单', { 编号: out.recv }))['编号']);
  out.inspRow = await one(`SELECT [批次键] k, [批次号] b FROM qc_insp WHERE 单据编号=N'${out.insp}'`);
  await q(`UPDATE qc_insp_detail SET 合格数量 = ISNULL(NULLIF(数量,0), 送检数量), 不合格数量 = 0 WHERE 单据编号=N'${out.insp}'`);
  await cb('QC_INSP', '审核', { 编号: out.insp }); await sleep(800);
  out.pi = N((await one(`SELECT TOP 1 target_form_no no FROM form_flow_link WHERE source_panel_code='QC_INSP' AND source_form_no=N'${out.insp}' AND target_panel_code='PURCHASE_IN' AND link_status='ACTIVE'`))?.no);
  if (!out.pi) throw new Error(`检验单 ${out.insp} 未生成采购入库单`);
  // 铺路过既有仓库档案校验(与批次号无关)
  const piWh = await one(`SELECT TOP 1 ISNULL([仓库],N'') w FROM bl_purchase_in WHERE 单据编号=N'${out.pi}'`);
  if (isBlank(piWh?.w)) {
    await q(`UPDATE bl_purchase_in SET [仓库]=N'${WH}' WHERE 单据编号=N'${out.pi}'`);
    await q(`UPDATE bd_purchase_in SET [仓库]=N'${WH}' WHERE 单据编号=N'${out.pi}'`);
    out.whPatched = WH;
  }
  // 入库单「单据日期」/「批次号」:接口生单不会带批次号(前端填单才预设),故这里直接写库模拟两种情形
  await q(`UPDATE bd_purchase_in SET [单据日期]=N'${piDate}', [批次号]=${piBatchNo ? `N'${piBatchNo}'` : 'NULL'} WHERE 单据编号=N'${out.pi}'`);
  out.piRow = await one(`SELECT [批次键] k, [批次号] b, CONVERT(varchar(10), [单据日期], 120) d FROM bd_purchase_in WHERE 单据编号=N'${out.pi}'`);
  out.piRowCount = Number((await one(`SELECT COUNT(*) n FROM bl_purchase_in WHERE 单据编号=N'${out.pi}' AND ISNULL([批次号],N'')=N''`))?.n || 0);
  out.piLineCount = Number((await one(`SELECT COUNT(*) n FROM bl_purchase_in WHERE 单据编号=N'${out.pi}'`))?.n || 0);
  return out;
}

/** 三单 头+行 的批次号快照 + 台账 */
async function snapshot(c) {
  const head = await one(`SELECT
    (SELECT [批次号] FROM sl_recv WHERE 单据编号=N'${c.recv}') recvH,
    (SELECT [批次号] FROM qc_insp WHERE 单据编号=N'${c.insp}') inspH,
    (SELECT [批次号] FROM bd_purchase_in WHERE 单据编号=N'${c.pi}') piH,
    (SELECT COUNT(*) FROM sl_recv_detail WHERE 单据编号=N'${c.recv}' AND ISNULL([批次号],N'')=N'') recvLNull,
    (SELECT COUNT(*) FROM sl_recv_detail WHERE 单据编号=N'${c.recv}') recvLCnt,
    (SELECT COUNT(*) FROM qc_insp_detail WHERE 单据编号=N'${c.insp}' AND ISNULL([批次号],N'')=N'') inspLNull,
    (SELECT COUNT(*) FROM qc_insp_detail WHERE 单据编号=N'${c.insp}') inspLCnt,
    (SELECT COUNT(*) FROM bl_purchase_in WHERE 单据编号=N'${c.pi}' AND ISNULL([批次号],N'')=N'') piLNull,
    (SELECT COUNT(*) FROM bl_purchase_in WHERE 单据编号=N'${c.pi}') piLCnt`);
  const led = await one(`SELECT batch_no, status, batch_seq, CONVERT(varchar(8), create_time, 112) sendDate FROM yj_doc_batch WHERE id=${c.key}`);
  return { head, led };
}

/** 审核入库单并按期望号校验「三单头一致 + 三单行全填 + 链路全填」 */
async function auditAndAssert(c, expect, label) {
  await cb('PURCHASE_IN', '审核', { 编号: c.pi }); await sleep(900);
  const s = await snapshot(c);
  const got = N(s.led?.batch_no);
  info(`${label} 台账=${JSON.stringify(s.led)}  三单头=${s.head?.recvH} / ${s.head?.inspH} / ${s.head?.piH}`);
  ok(got === expect, `${label} 批次号 = ${JSON.stringify(expect)}(实得 ${JSON.stringify(got)})`);
  ok(N(s.led?.status) === 'ACTIVE', `${label} 台账 status=ACTIVE(实得 ${s.led?.status})`);
  ok([s.head?.recvH, s.head?.inspH, s.head?.piH].every((v) => N(v) === expect),
    `${label} 三单**头**批次号一致 = ${expect}(${s.head?.recvH} / ${s.head?.inspH} / ${s.head?.piH})`);
  const lines = await one(`SELECT
    (SELECT COUNT(*) FROM sl_recv_detail WHERE 单据编号=N'${c.recv}' AND [批次号]=N'${expect}') recvOk,
    (SELECT COUNT(*) FROM sl_recv_detail WHERE 单据编号=N'${c.recv}') recvCnt,
    (SELECT COUNT(*) FROM qc_insp_detail WHERE 单据编号=N'${c.insp}' AND [批次号]=N'${expect}') inspOk,
    (SELECT COUNT(*) FROM qc_insp_detail WHERE 单据编号=N'${c.insp}') inspCnt,
    (SELECT COUNT(*) FROM bl_purchase_in WHERE 单据编号=N'${c.pi}' AND [批次号]=N'${expect}') piOk,
    (SELECT COUNT(*) FROM bl_purchase_in WHERE 单据编号=N'${c.pi}') piCnt`);
  ok(Number(lines.recvOk) === Number(lines.recvCnt) && Number(lines.inspOk) === Number(lines.inspCnt)
    && Number(lines.piOk) === Number(lines.piCnt) && Number(lines.piCnt) > 0,
    `${label} 三单**行**全部回填 = ${expect}(暂收 ${lines.recvOk}/${lines.recvCnt}、检验 ${lines.inspOk}/${lines.inspCnt}、入库 ${lines.piOk}/${lines.piCnt})`);
  const link = await one(`SELECT
    (SELECT COUNT(*) FROM form_flow_link WHERE batch_id=${c.key}) total,
    (SELECT COUNT(*) FROM form_flow_link WHERE batch_id=${c.key} AND batch_no=N'${expect}') filled`);
  ok(Number(link.total) >= 3 && Number(link.filled) === Number(link.total),
    `${label} form_flow_link 该批次 ${link.total} 行 batch_no 全部回填`);
  return { got, snap: s };
}

// ============ ① 生单到入库草稿:三单批次号为空 + 台账 PENDING + 批次键逐站带下 ============
console.log('\n=== ① 分批送料 → 暂收审核 → 检验审核 → 入库草稿:批次号全空、台账 PENDING ===');
const C1 = await buildChain(PO1, Math.min(10, Number(PO1.line.剩余数量)), 'C1', YMD(YESTERDAY), '');
info(`暂收单=${C1.recv} 检验单=${C1.insp} 入库单=${C1.pi} 批次键=${C1.key} 入库单据日期=${C1.piRow?.d}`);
const s1 = await snapshot(C1);
ok(isBlank(C1.genBatchNo), `生单返回的批次号为空(实得 ${JSON.stringify(C1.genBatchNo)})`);
ok(Number(C1.key) > 0, `台账行已登记且取得「批次键」=${C1.key}`);
ok(N(C1.recvKey?.k) === String(C1.key), `暂收单头「批次键」= 台账行 id(实得 ${C1.recvKey?.k})`);
ok(isBlank(s1.head?.recvH) && isBlank(s1.head?.inspH) && isBlank(C1.piRow?.b),
  `暂收/检验/入库三单**头**批次号在审核前为空(暂收 ${JSON.stringify(s1.head?.recvH)}、检验 ${JSON.stringify(s1.head?.inspH)}、入库 ${JSON.stringify(C1.piRow?.b)})`);
ok(N(s1.led?.status) === 'PENDING' && isBlank(s1.led?.batch_no), `台账 status=PENDING 且 batch_no=NULL(实得 ${JSON.stringify(s1.led)})`);
ok(N(C1.inspRow?.k) === String(C1.key) && N(C1.piRow?.k) === String(C1.key),
  `「批次键」逐站带下:检验单=${C1.inspRow?.k} 入库单=${C1.piRow?.k}(均 = ${C1.key})`);

// ============ ② 入库单表头空 → 审核 → 批次号 = 入库单「单据日期」(昨天),**不是送料当天(今天)** ============
console.log('\n=== ② 入库单表头空 + 单据日期=昨天 → 审核:批次号取入库日期(不是送料当天) ===');
const R1 = await auditAndAssert(C1, YESTERDAY, '第 1 批');
ok(R1.got !== TODAY, `批次号不是送料(台账创建)当天 ${TODAY},而是入库单单据日期 ${YESTERDAY}(证明取的是**入库日期**)`);
ok(/^\d{8}$/.test(R1.got || ''), `批次号格式 = 纯 8 位日期 ^\\d{8}$(实得 ${JSON.stringify(R1.got)});无序号`);
const piAfter = await one(`SELECT ISNULL([批次号],N'') b FROM bd_purchase_in WHERE 单据编号=N'${C1.pi}'`);
ok(N(piAfter?.b) === R1.got, `审核后入库单表头已补写为最终号(实得 ${JSON.stringify(piAfter?.b)})`);

// ============ ③ 入库单表头人工填自定义号 → 审核 → 原样保留(人工优先) ============
console.log('\n=== ③ 入库单表头人工填自定义号 → 审核:以表头为准(人工可改) ===');
const MANUAL = `手工-${TODAY}-A`;
const C2 = await buildChain(PO1, Math.min(10, Number(PO1.line.剩余数量)), 'C2', YMD(TODAY), MANUAL);
info(`入库单 ${C2.pi} 表头预设=${JSON.stringify(C2.piRow?.b)}(单据日期 ${C2.piRow?.d})`);
const R2 = await auditAndAssert(C2, MANUAL, '手改批');
ok(R2.got !== TODAY, `人工改过的号**没有**被"按日期算"覆盖(仍是 ${MANUAL})`);

// ============ ④ 同订单同一天(昨天)再来一批 → 与第 1 批同一个号,且两行并存(唯一性已取消) ============
console.log('\n=== ④ 同订单同一天(昨天)第 3 批 → 与第 1 批**同一个号**(同一日期同一批次) ===');
const C3 = await buildChain(PO1, Math.min(10, Number(PO1.line.剩余数量)), 'C3', YMD(YESTERDAY), '');
const R3 = await auditAndAssert(C3, R1.got, `第 3 批(与第 1 批同日 ${YESTERDAY})`);
ok(R3.got === R1.got, `同订单同一天 → 批次号相同(${R3.got} = ${R1.got})`);
const dupRows = await q(`SELECT id, source_form_no, batch_no, batch_seq, status FROM yj_doc_batch
  WHERE source_form_no=N'${PO1.no}' AND batch_no=N'${R1.got}' AND status='ACTIVE' ORDER BY id`);
info(`同订单+同号并存台账行:${JSON.stringify(dupRows)}`);
ok(dupRows.length >= 2, `同订单同号的 ${dupRows.length} 行台账在库中**并存** → 旧唯一索引(订单+批次号)确已取消`);
ok(dupRows.every((r) => N(r.batch_no) === R1.got), `并存行的 batch_no 都是 ${R1.got}`);

// ============ ⑤ 另一张采购订单同一天 → 同样允许同号 ============
console.log('\n=== ⑤ 另一张采购订单同一天(今天) → 允许与手改批以外的同日单同号 ===');
const C4 = await buildChain(PO2, Math.min(10, Number(PO2.line.剩余数量)), 'C4', YMD(TODAY), '');
const R4 = await auditAndAssert(C4, TODAY, '订单②(今天)');
ok(R4.got === TODAY, `订单② 当天批次号 = ${TODAY}(按入库日期,与订单① 的历史无关)`);
const dupAll = await one(`SELECT COUNT(*) n, COUNT(DISTINCT source_form_no) od FROM yj_doc_batch WHERE batch_no=N'${TODAY}' AND status='ACTIVE'`);
info(`全库 batch_no=${TODAY} 的 ACTIVE 台账行 ${dupAll?.n} 行,分属 ${dupAll?.od} 张采购订单`);
ok(Number(dupAll?.n) >= 1, `同一天多单同号可并存(${dupAll?.n} 行 / ${dupAll?.od} 张订单)`);

// ============ ⑥ 弃审 → 号与状态不变;重新审核 → 沿用原号;人工号重审仍以表头为准 ============
console.log('\n=== ⑥ 弃审/重审:批次号不回收、幂等沿用、人工号优先 ===');
let unauditMsg = '';
try { await cb('PURCHASE_IN', '弃审', { 编号: C4.pi }); unauditMsg = '弃审成功'; }
catch (e) { unauditMsg = '弃审被业务规则拒绝:' + String(e.message).slice(0, 120); }
await sleep(900);
const s6 = await snapshot(C4);
info(`弃审结果:${unauditMsg};台账=${JSON.stringify(s6.led)}`);
ok(N(s6.led?.batch_no) === R4.got && N(s6.led?.status) === 'ACTIVE',
  `弃审后台账号与 status 不变(${s6.led?.batch_no}/${s6.led?.status})`);
await cb('PURCHASE_IN', '审核', { 编号: C4.pi }).catch((e) => info('重新审核:' + String(e.message).slice(0, 90))); await sleep(700);
const s6b = await snapshot(C4);
info(`重新审核后台账=${JSON.stringify(s6b.led)}`);
ok(N(s6b.led?.batch_no) === R4.got, `重新审核沿用原号(幂等):${s6b.led?.batch_no}`);
// 人工号:弃审 → 改表头 → 重审应以**新表头值**为准(表头是权威)
const MANUAL2 = `手工-${TODAY}-B`;
await cb('PURCHASE_IN', '弃审', { 编号: C2.pi }).catch((e) => info('弃审手改批:' + String(e.message).slice(0, 90))); await sleep(700);
await q(`UPDATE bd_purchase_in SET [批次号]=N'${MANUAL2}' WHERE 单据编号=N'${C2.pi}'`);
await cb('PURCHASE_IN', '审核', { 编号: C2.pi }).catch((e) => info('手改批重审:' + String(e.message).slice(0, 90))); await sleep(900);
const s6c = await snapshot(C2);
ok(N(s6c.led?.batch_no) === MANUAL2 && N(s6c.head?.recvH) === MANUAL2 && N(s6c.head?.inspH) === MANUAL2,
  `人工改表头后重审:全链改用新表头值 ${MANUAL2}(实得 台账 ${s6c.led?.batch_no} / 暂收 ${s6c.head?.recvH} / 检验 ${s6c.head?.inspH})`);

// ============ ⑦ 索引口径:唯一性已取消(非唯一筛选索引) ============
console.log('\n=== ⑦ 索引口径:UX 唯一索引已删,IX 非唯一筛选索引在位 ===');
const ux = await one(`SELECT COUNT(*) n FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.yj_doc_batch') AND name='UX_yj_doc_batch_no_active'`);
const ix = await one(`SELECT i.is_unique, i.filter_definition FROM sys.indexes i WHERE i.object_id=OBJECT_ID('dbo.yj_doc_batch') AND i.name='IX_yj_doc_batch_no_active'`);
const ixCols = (await q(`SELECT COL_NAME(ic.object_id, ic.column_id) col FROM sys.indexes i JOIN sys.index_columns ic ON i.object_id=ic.object_id AND i.index_id=ic.index_id WHERE i.object_id=OBJECT_ID('dbo.yj_doc_batch') AND i.name='IX_yj_doc_batch_no_active' AND ic.is_included_column=0 ORDER BY ic.key_ordinal`)).map((r) => N(r.col)).join('+');
const fd = String(ix?.filter_definition || '');
ok(Number(ux?.n) === 0, `旧的筛选唯一索引 UX_yj_doc_batch_no_active 已删(实得 ${ux?.n} 个)`);
ok(ix && Number(ix.is_unique) === 0 && ixCols === 'batch_no+source_form_no' && /batch_no/.test(fd) && /IS NOT NULL/.test(fd),
  `新索引非唯一:IX_yj_doc_batch_no_active(键 ${ixCols},WHERE ${fd},is_unique=${ix?.is_unique})`);

// ============ 清理测试单据(反序 弃审→删除);批次号按口径不回收,台账留证 ============
console.log('\n=== 清理测试单据(反序 弃审 → 删除;批次号按口径不回收) ===');
for (const c of [C1, C2, C3, C4].filter(Boolean)) {
  for (const [p, no] of [['PURCHASE_IN', c.pi], ['QC_INSP', c.insp], ['QC_RECV', c.recv]]) {
    if (!no) continue;
    for (const b of ['弃审', '删除']) {
      try { await cb(p, b, { 编号: no }); console.log(`  ${p} ${no} ${b} ✓`); }
      catch (e) { console.log(`  ${p} ${no} ${b} 跳过:${String(e.message).slice(0, 90)}`); }
    }
  }
}
console.log('\n=== 测试单据与台账留证 ===');
for (const c of [C1, C2, C3, C4].filter(Boolean)) {
  console.log(`  ${c.tag}: 暂收单 ${c.recv} / 检验单 ${c.insp} / 入库单 ${c.pi} / 批次键 ${c.key} / 入库单据日期 ${c.piDate}`);
}
const keys = [C1, C2, C3, C4].filter(Boolean).map((c) => c.key).join(',');
console.log('  台账行:' + JSON.stringify(await q(`SELECT id, source_form_no, batch_no, batch_seq, status, target_form_no FROM yj_doc_batch WHERE id IN (${keys}) ORDER BY id`)));

await pool.close();
console.log(`\n${fails ? `❌ 失败 ${fails} 项` : '✅ 全部通过'}`);
process.exit(fails ? 1 : 0);
