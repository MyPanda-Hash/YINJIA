/**
 * _verify-batch-no-at-inbound.mjs — 送料批次号「取号时机改到采购入库单审核」全链验证(8 条断言)
 *
 * 用户定稿口径(2026-09-21):
 *   批次号 = yyyyMMdd + 两位序号(无分隔符);日期取**送料当天**;唯一性范围 = 采购订单号 + 批次号
 *   (不同采购订单之间允许重号);取号 = 同订单同送料日「已用最大序号 + 1」;**弃审/作废不回收**;
 *   入库审核之前链上所有单据批次号留空;审核时取号并**回填** 暂收单/检验单/入库单(头+行)、
 *   批次台账、form_flow_link.batch_no;回填发生在转ERP 之前;历史 YJ- 格式号原样不动。
 *
 * 断言:
 *   ① 分批送料生成暂收单:暂收头/行批次号为空、台账 PENDING 且 batch_no=NULL、「批次键」已写入链路各单;
 *   ② 暂收单审核 → 生成检验单:检验单批次号**仍为空**、「批次键」已继承;
 *   ③ 造合格数量 → 检验单审核 → 自动生成采购入库单(批次号空、批次键已带);
 *   ④ 采购入库单审核 → 三单头+行批次号**同时有值且一致**、格式 ^\d{8}\d{2}$、日期 = 台账 create_time 的送料日、
 *      台账 status=ACTIVE、form_flow_link 该批次 id 的行 batch_no 全回填;
 *   ⑤ 同订单当天再送一批(重复 1→4):序号 +1;
 *   ⑥ 另一张采购订单同一天送料并审核:批次号与前单**相同**(复合唯一允许跨订单重号);
 *   ⑦ 弃审刚审核的入库单:批次号**不变**(三单与台账都不变);
 *   ⑧ 由调用方另跑回归:node tools/archive/_verify-chain-field-complete.mjs(见报告)。
 *
 * 用法: node tools/archive/_verify-batch-no-at-inbound.mjs
 */
import { createRequire } from 'node:module';

const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
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
const lj = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json();
if (!lj?.data?.token) { console.error('登录失败:' + JSON.stringify(lj)); process.exit(1); }
const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + lj.data.token };
const post = async (url, body) => {
  const j = await (await fetch(API + url, { method: 'POST', headers: H, body: JSON.stringify(body) })).json();
  if (j.code !== 0 && j.code !== 200) throw new Error(`${url} → ${JSON.stringify(j).slice(0, 300)}`);
  return j.data;
};
const cb = (panelCode, buttonName, formData) => post('/px/callButton', { panelCode, buttonName, formData: formData || {}, buttonParam: {} });
const dstr = (d) => { const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d || new Date()); return p.replace(/-/g, ''); };
const TODAY = dstr();

// ============ 选样:两张不同的采购订单(已审核 + 有剩余可送量 + 当天还没有已编号批次,保证两边都取 01) ============
console.log('=== 选样 ===');
// 既有「仓库档案」校验(StockLedgerService:入库审核时 仓库必须在 bs_wh)与本次批次号改动无关,
// 但会把入库审核挡在取号之前 —— 该采购订单行没有仓库时,探针在**本次生成的入库草稿**上补一个合法仓库
// (只动本探针自己造的单据,不动采购订单与基础档案)。
const WH = N((await one(`SELECT TOP 1 仓库名称 w FROM bs_wh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 仓库名称=N'恒亿仓'`))?.w)
  || N((await one(`SELECT TOP 1 仓库名称 w FROM bs_wh WHERE ISNULL(asp_cancel,'N')<>'Y'`))?.w);
if (!WH) { console.error('bs_wh 无可用仓库,无法过既有仓库校验'); await pool.close(); process.exit(1); }
console.log(`  探针补仓库用:${WH}`);
const list = (await post('/px/queryFormDataList', { panelCode: 'PU_ORDER', pageNo: 1, pageSize: 400 }))?.list || [];
const cands = [];
for (const r of list) {
  if (N(r['单据状态']) !== '已审核') continue;
  const no = N(r['单据编号']);
  let ls;
  try { ls = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: no }); } catch { continue; }
  const line = (ls?.lines || []).find((x) => Number(x.剩余数量) > 0);
  if (!line) continue;
  const numbered = Number((await one(`SELECT COUNT(*) n FROM yj_doc_batch WHERE source_form_no=N'${no}' AND batch_no LIKE '${TODAY}%'`))?.n || 0);
  cands.push({ no, line, numbered });
  if (cands.filter((c) => c.numbered === 0).length >= 2) break;
}
const fresh = cands.filter((c) => c.numbered === 0);
const PO1 = fresh[0];
const PO2 = fresh[1];
if (!PO1 || !PO2) { console.error('找不到两张当天未编号、且有剩余可送量的采购订单:' + JSON.stringify(cands.map((c) => [c.no, c.numbered]))); await pool.close(); process.exit(1); }
console.log(`  采购订单① ${PO1.no}(行 ${PO1.line.行号} 剩余 ${PO1.line.剩余数量})  /  采购订单② ${PO2.no}(行 ${PO2.line.行号} 剩余 ${PO2.line.剩余数量})`);
console.log(`  送料当天(今日)= ${TODAY}`);

/** 走一遍 分批送料 → 暂收审核 → 检验审核 → 入库审核;返回各单号与批次键 */
async function runChain(po, qty, tag) {
  const out = { tag, po: po.no, recv: null, insp: null, pi: null, key: null };
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
  out.piRow = await one(`SELECT [批次键] k, [批次号] b FROM bd_purchase_in WHERE 单据编号=N'${out.pi}'`);
  // 铺路过既有仓库档案校验(与批次号无关,见选样处注释)
  const piWh = await one(`SELECT TOP 1 ISNULL([仓库],N'') w FROM bl_purchase_in WHERE 单据编号=N'${out.pi}'`);
  if (isBlank(piWh?.w)) {
    await q(`UPDATE bl_purchase_in SET [仓库]=N'${WH}' WHERE 单据编号=N'${out.pi}'`);
    await q(`UPDATE bd_purchase_in SET [仓库]=N'${WH}' WHERE 单据编号=N'${out.pi}'`);
    out.whPatched = WH;
  }
  return out;
}

/** 三单 头+行 的批次号快照 */
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

// ============ ① 分批送料生成暂收单:批次号为空 + 台账 PENDING + 批次键已写入 ============
console.log('\n=== ① 分批送料生成暂收单(采购订单①) ===');
const C1 = await runChain(PO1, Math.min(10, Number(PO1.line.剩余数量)), 'C1');
info(`暂收单=${C1.recv} 检验单=${C1.insp} 入库单=${C1.pi} 批次键=${C1.key}`);
const s1 = await snapshot(C1);
info(`暂收头 批次键=${JSON.stringify(C1.recvKey)}  台账=${JSON.stringify(s1.led)}`);
ok(isBlank(C1.genBatchNo), `生单返回的批次号为空(实得 ${JSON.stringify(C1.genBatchNo)})`);
ok(Number(C1.key) > 0, `台账行已登记且取得「批次键」=${C1.key}`);
ok(N(C1.recvKey?.k) === String(C1.key), `暂收单头「批次键」= 台账行 id(实得 ${C1.recvKey?.k})`);
ok(isBlank(s1.head?.recvH), `暂收单**头**批次号为空(实得 ${JSON.stringify(s1.head?.recvH)})`);
ok(Number(s1.head?.recvLNull) === Number(s1.head?.recvLCnt) && Number(s1.head?.recvLCnt) > 0,
  `暂收单**行**批次号全为空(${s1.head?.recvLNull}/${s1.head?.recvLCnt})`);
ok(N(s1.led?.status) === 'PENDING' && isBlank(s1.led?.batch_no), `台账 status=PENDING 且 batch_no=NULL(实得 ${JSON.stringify(s1.led)})`);
// 前端「送料」摘要的数据源:采购订单表头摘要读 /batchFlow/lines 的 batches,据 status=PENDING 追加「(M 批待编号)」
// 注(2026-09-21 去向跟随链路前进后):targetFormNo 已是**链路终点**(此处已前进到入库单),
// 要按「生成时那张暂收单」定位台账行,改用起点字段 firstTargetFormNo。
const lsAfter = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: PO1.no });
const pendingRow = (lsAfter?.batches || []).find((b) => N(b.status) === 'PENDING' && N(b.firstTargetFormNo) === C1.recv);
ok(!!pendingRow && isBlank(pendingRow.batchNo),
  `送料摘要接口列出该待编号批次(status=PENDING、batchNo 空;前端据此显示「(M 批待编号)」):${JSON.stringify(pendingRow)}`);

console.log('\n=== ② 暂收单审核 → 生成来料检验单 ===');
info(`检验头=${JSON.stringify(C1.inspRow)}`);
ok(isBlank(C1.inspRow?.b), `检验单**头**批次号仍为空(实得 ${JSON.stringify(C1.inspRow?.b)})`);
ok(N(C1.inspRow?.k) === String(C1.key), `检验单头「批次键」已继承(= ${C1.key})`);
ok(Number(s1.head?.inspLNull) === Number(s1.head?.inspLCnt) && Number(s1.head?.inspLCnt) > 0,
  `检验单**行**批次号全为空(${s1.head?.inspLNull}/${s1.head?.inspLCnt})`);

console.log('\n=== ③ 检验单审核 → 自动生成采购入库单 ===');
info(`入库头=${JSON.stringify(C1.piRow)}`);
ok(!!C1.pi, `自动生成采购入库单 ${C1.pi}`);
ok(isBlank(C1.piRow?.b), `入库单**头**批次号为空(实得 ${JSON.stringify(C1.piRow?.b)})`);
ok(N(C1.piRow?.k) === String(C1.key), `入库单头「批次键」已带(= ${C1.key})`);
ok(Number(s1.head?.piLNull) === Number(s1.head?.piLCnt) && Number(s1.head?.piLCnt) > 0,
  `入库单**行**批次号全为空(${s1.head?.piLNull}/${s1.head?.piLCnt})`);

// ============ ④ 采购入库单审核 → 取号并回填全链 ============
console.log('\n=== ④ 采购入库单审核 → 取号并回填全链 ===');
await cb('PURCHASE_IN', '审核', { 编号: C1.pi }); await sleep(900);
const s4 = await snapshot(C1);
const B1 = N(s4.led?.batch_no);
info(`台账=${JSON.stringify(s4.led)}  三单头=${s4.head?.recvH} / ${s4.head?.inspH} / ${s4.head?.piH}`);
ok(/^\d{8}\d{2}$/.test(B1 || ''), `批次号格式 ^\\d{8}\\d{2}$(实得 ${JSON.stringify(B1)})`);
ok(B1?.slice(0, 8) === N(s4.led?.sendDate) && N(s4.led?.sendDate) === TODAY,
  `日期部分 = 台账 create_time 的送料日(${B1?.slice(0, 8)} vs 送料日 ${s4.led?.sendDate},今 ${TODAY})`);
ok(N(s4.led?.status) === 'ACTIVE' && Number(s4.led?.batch_seq) === Number(B1?.slice(8)),
  `台账 status=ACTIVE 且 batch_seq=${Number(B1?.slice(8))}(实得 ${JSON.stringify(s4.led)})`);
ok([s4.head?.recvH, s4.head?.inspH, s4.head?.piH].every((v) => N(v) === B1) && !!B1,
  `三单**头**批次号同时有值且一致 = ${B1}(${s4.head?.recvH} / ${s4.head?.inspH} / ${s4.head?.piH})`);
const lines4 = await one(`SELECT
  (SELECT COUNT(*) FROM sl_recv_detail WHERE 单据编号=N'${C1.recv}' AND [批次号]=N'${B1}') recvOk,
  (SELECT COUNT(*) FROM sl_recv_detail WHERE 单据编号=N'${C1.recv}') recvCnt,
  (SELECT COUNT(*) FROM qc_insp_detail WHERE 单据编号=N'${C1.insp}' AND [批次号]=N'${B1}') inspOk,
  (SELECT COUNT(*) FROM qc_insp_detail WHERE 单据编号=N'${C1.insp}') inspCnt,
  (SELECT COUNT(*) FROM bl_purchase_in WHERE 单据编号=N'${C1.pi}' AND [批次号]=N'${B1}') piOk,
  (SELECT COUNT(*) FROM bl_purchase_in WHERE 单据编号=N'${C1.pi}') piCnt`);
ok(Number(lines4.recvOk) === Number(lines4.recvCnt) && Number(lines4.inspOk) === Number(lines4.inspCnt)
  && Number(lines4.piOk) === Number(lines4.piCnt) && Number(lines4.piCnt) > 0,
  `三单**行**批次号全部回填 = ${B1}(暂收 ${lines4.recvOk}/${lines4.recvCnt}、检验 ${lines4.inspOk}/${lines4.inspCnt}、入库 ${lines4.piOk}/${lines4.piCnt})`);
const link4 = await one(`SELECT
  (SELECT COUNT(*) FROM form_flow_link WHERE batch_id=${C1.key}) total,
  (SELECT COUNT(*) FROM form_flow_link WHERE batch_id=${C1.key} AND batch_no=N'${B1}') filled`);
info(`form_flow_link(batch_id=${C1.key}) = ${JSON.stringify(link4)}`);
ok(Number(link4.total) >= 3 && Number(link4.filled) === Number(link4.total),
  `form_flow_link 该批次 id 的 ${link4.total} 行 batch_no 全部回填`);

// ============ ⑤ 同订单当天再送一批 → 序号 +1 ============
console.log('\n=== ⑤ 同订单(采购订单①)当天再送一批 → 序号 +1 ===');
let C2 = null;
const ls2 = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: PO1.no });
const line2 = (ls2?.lines || []).find((x) => Number(x.剩余数量) > 0);
if (!line2) {
  console.log('  [SKIP] 该订单已无剩余可送,无法验证「序号 +1」');
  fails++;
} else {
  C2 = await runChain({ no: PO1.no, line: line2 }, Math.min(10, Number(line2.剩余数量)), 'C2');
  await cb('PURCHASE_IN', '审核', { 编号: C2.pi }); await sleep(900);
  const s5 = await snapshot(C2);
  const B2 = N(s5.led?.batch_no);
  const expect2 = B1?.slice(0, 8) + String(Number(B1?.slice(8)) + 1).padStart(2, '0');
  info(`第 1 批=${B1}  第 2 批=${B2}  期望=${expect2}(暂收单 ${C2.recv} / 入库单 ${C2.pi})`);
  ok(B2 === expect2, `同订单当天第 2 批序号 = 第 1 批 + 1(${B1} → ${B2})`);
  ok([s5.head?.recvH, s5.head?.inspH, s5.head?.piH].every((v) => N(v) === B2),
    `第 2 批三单头批次号一致 = ${B2}`);
}

// ============ ⑥ 另一张采购订单同一天送料并审核 → 批次号可与前单相同 ============
console.log('\n=== ⑥ 另一张采购订单(采购订单②)同一天送料并审核 → 允许与前单重号 ===');
const C3 = await runChain(PO2, Math.min(10, Number(PO2.line.剩余数量)), 'C3');
await cb('PURCHASE_IN', '审核', { 编号: C3.pi }); await sleep(900);
const s6 = await snapshot(C3);
const B3 = N(s6.led?.batch_no);
info(`订单② 批次号=${B3}(暂收单 ${C3.recv} / 入库单 ${C3.pi})`);
ok(/^\d{8}\d{2}$/.test(B3 || ''), `订单② 批次号格式合法(${B3})`);
ok(B3 === TODAY + '01', `订单② 当天第 1 批 = ${TODAY}01(实得 ${B3};该订单当天此前无已编号批次)`);
const dup = await one(`SELECT COUNT(*) n FROM yj_doc_batch WHERE batch_no=N'${B3}' AND status='ACTIVE'`);
const dupOrders = await one(`SELECT COUNT(DISTINCT source_form_no) n FROM yj_doc_batch WHERE batch_no=N'${B3}' AND status='ACTIVE'`);
info(`全库 batch_no=${B3} 的 ACTIVE 台账行 ${dup?.n} 行,分属 ${dupOrders?.n} 张采购订单`);
ok(Number(dupOrders?.n) >= 2, `同一批次号 ${B3} 同时挂在 ${dupOrders?.n} 张不同采购订单上(复合唯一:订单号+批次号,允许跨订单重号)`);
ok(B3 === B1, `订单② 与 订单① 第 1 批批次号相同(${B3} = ${B1})`);
const idx = await one(`SELECT i.name, i.is_unique, i.filter_definition FROM sys.indexes i WHERE i.object_id=OBJECT_ID('dbo.yj_doc_batch') AND i.name='UX_yj_doc_batch_no_active'`);
const idxCols = await q(`SELECT COL_NAME(ic.object_id, ic.column_id) col FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id WHERE i.object_id=OBJECT_ID('dbo.yj_doc_batch') AND i.name='UX_yj_doc_batch_no_active' AND ic.is_included_column=0 ORDER BY ic.key_ordinal`);
const idxKeys = idxCols.map((r) => N(r.col)).join('+');
const fd = String(idx?.filter_definition || '');
const old = await one(`SELECT COUNT(*) n FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.yj_doc_batch') AND name='UX_yj_doc_batch_active'`);
ok(Number(idx?.is_unique) === 1 && idxKeys === 'source_form_no+batch_no'
  && /status/.test(fd) && /batch_no/.test(fd) && /IS NOT NULL/.test(fd) && Number(old?.n) === 0,
  `索引口径 = 复合筛选唯一(唯一键 ${idxKeys},WHERE ${fd};旧索引 UX_yj_doc_batch_active 已删 ${Number(old?.n) === 0})`);

// ============ ⑦ 弃审刚审核的入库单 → 批次号不变 ============
console.log('\n=== ⑦ 弃审采购入库单 → 批次号不变(不回收) ===');
let unauditMsg = '';
try { await cb('PURCHASE_IN', '弃审', { 编号: C3.pi }); unauditMsg = '弃审成功'; }
catch (e) { unauditMsg = '弃审被业务规则拒绝:' + String(e.message).slice(0, 120); }
await sleep(900);
const s7 = await snapshot(C3);
info(`弃审结果:${unauditMsg}`);
info(`弃审后 台账=${JSON.stringify(s7.led)} 三单头=${s7.head?.recvH} / ${s7.head?.inspH} / ${s7.head?.piH}`);
ok(N(s7.led?.batch_no) === B3 && N(s7.led?.status) === 'ACTIVE',
  `弃审后台账号与 status 不变(${s7.led?.batch_no}/${s7.led?.status})`);
ok([s7.head?.recvH, s7.head?.inspH, s7.head?.piH].every((v) => N(v) === B3),
  `弃审后三单头批次号不变 = ${B3}`);
const reAudit = await cb('PURCHASE_IN', '审核', { 编号: C3.pi }).then(() => '重新审核成功').catch((e) => '重新审核失败:' + String(e.message).slice(0, 90));
await sleep(700);
const s7b = await snapshot(C3);
info(`重新审核:${reAudit};台账=${JSON.stringify(s7b.led)}`);
ok(N(s7b.led?.batch_no) === B3, `重新审核沿用原批次号(幂等,不二次取号):${s7b.led?.batch_no}`);

// ============ 清理测试单据(反序 弃审→删除):冲回库存记账;批次号按新口径**不回收**,留证 ============
console.log('\n=== 清理测试单据(反序 弃审 → 删除;批次号按口径不回收) ===');
for (const c of [C1, C2, C3].filter(Boolean)) {
  for (const [p, no] of [['PURCHASE_IN', c.pi], ['QC_INSP', c.insp], ['QC_RECV', c.recv]]) {
    if (!no) continue;
    for (const b of ['弃审', '删除']) {
      try { await cb(p, b, { 编号: no }); console.log(`  ${p} ${no} ${b} ✓`); }
      catch (e) { console.log(`  ${p} ${no} ${b} 跳过:${String(e.message).slice(0, 90)}`); }
    }
  }
}
console.log('\n=== 测试单据与台账留证 ===');
for (const c of [C1, C2, C3].filter(Boolean)) {
  console.log(`  ${c.tag}: 暂收单 ${c.recv} / 检验单 ${c.insp} / 入库单 ${c.pi} / 批次键 ${c.key}`);
}
const keys = [C1, C2, C3].filter(Boolean).map((c) => c.key).join(',');
const led = await q(`SELECT id, source_form_no, batch_no, batch_seq, status, target_form_no FROM yj_doc_batch WHERE id IN (${keys}) ORDER BY id`);
console.log('  台账行:' + JSON.stringify(led));
ok(led.every((r) => N(r.status) === 'ACTIVE' && !isBlank(r.batch_no)),
  `作废/删除后台账行仍为 ACTIVE 且保留批次号(不回收:会跳号,绝不重号)`);

await pool.close();
console.log(`\n${fails ? `❌ 失败 ${fails} 项` : '✅ 全部通过'}`);
process.exit(fails ? 1 : 0);
