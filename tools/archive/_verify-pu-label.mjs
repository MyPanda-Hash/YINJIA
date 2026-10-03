/**
 * _verify-pu-label.mjs — 采购订单「材料码打印 → 批次号登记 → 预约 → 生单消费 → 释放」端到端验证
 * (2026-10-04,方案 docs/plans/2026-10-04-采购订单材料码批次号方案.md)
 *
 * 断言链(每步都读库核对,不看接口自述):
 *   ① 打印弹窗取数:预填批次号 = 供应商编码去 YJ- 前缀 + 当天;行上有「剩余可打」;
 *   ② 登记打印:单据号 MQ-yyyy-MM-nnnn;批次号/行/数量落 bd_pu_label + bl_pu_label;
 *   ③ **打印即预约**:该行「剩余可打」与 batchFlow 的「剩余数量/可送上限」都被扣掉预约量,
 *      且 batchFlow/lines 回传「打印预约」(批次号/打印数量/已生单量/未生单量);
 *   ④ 生单消费:**按材料码批次号生单** → 暂收单 单头/明细行/批次台账 都是那个号;
 *   ⑤ 约束:按该号生单 **超过未生单预约量** 被拒;用一个**没有打印记录**的号生单被拒;
 *   ⑥ 消费后:该行未生单预约归 0、已生单量 = 送料量(全部由 form_flow_link 派生);
 *   ⑦ **删除暂收单 → 预约自动回落**(link 置 RELEASED,无需任何回滚代码);
 *   ⑧ 作废打印记录 → 预约释放,行回到"未打印"状态;
 *   ⑨ **一次打印 = 一行 = 一张单**(追加口径「不能多行否则作废就全部作废了」):
 *      多行入参被拒、同号打两行是**两张单**、作废其中一张另一张纹丝不动、重打只累加次数不新增预约。
 *
 * 跑在**测试账套**(factory=YJ_TEST)。用法:node tools/archive/_verify-pu-label.mjs
 */
import { createRequire } from 'node:module';
import { fetchRetry } from './_apifetch.mjs';

const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const API = process.env.YJ_API || 'http://127.0.0.1:8090/api';
const DB = process.env.YJ_DB || 'HSDZ_MES_TEST';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, msg) => { console.log(`  ${c ? '[PASS]' : '[FAIL]'} ${msg}`); if (!c) fails++; };
const info = (msg) => console.log(`         ${msg}`);
const N = (v) => (v === null || v === undefined ? null : String(v).trim());

const pool = await new mssql.ConnectionPool({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia', password: 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
}).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
const one = async (s) => (await q(s))[0] || null;
const dstr = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' })
  .format(d || new Date()).replace(/-/g, '');
const TODAY = dstr();

const lj = await (await fetchRetry(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})).json();
if (!lj?.data?.token) { console.error('登录失败:' + JSON.stringify(lj).slice(0, 200)); await pool.close(); process.exit(1); }
const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + lj.data.token };
const post = async (url, body) => {
  const j = await (await fetchRetry(API + url, { method: 'POST', headers: H, body: JSON.stringify(body) })).json();
  if (j.code !== 0 && j.code !== 200) throw new Error(`${url} → ${JSON.stringify(j).slice(0, 300)}`);
  return j.data;
};
const get = async (url) => {
  const j = await (await fetchRetry(API + url, { headers: H })).json();
  if (j.code !== 0 && j.code !== 200) throw new Error(`${url} → ${JSON.stringify(j).slice(0, 300)}`);
  return j.data;
};
/** 期待失败:返回错误文本(成功则返回空串,由断言判 fail) */
const expectFail = async (url, body) => {
  try { await post(url, body); return ''; }
  catch (e) { return String(e.message); }
};
const cb = (panelCode, buttonName, formData) => post('/px/callButton', { panelCode, buttonName, formData: formData || {}, buttonParam: {} });

console.log(`=== 测试账套 ${DB} / 今天 ${TODAY} ===`);

// ---------- 选样:一张已审核、有足够余量的采购订单 ----------
let pick = null;
for (const r of ((await post('/px/queryFormDataList', { panelCode: 'PU_ORDER', pageNo: 1, pageSize: 400 }))?.list || [])) {
  if (N(r['单据状态']) !== '已审核') continue;
  const no = N(r['单据编号']);
  let ls; try { ls = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: no }); } catch { continue; }
  const line = (ls?.lines || []).find((x) => Number(x.剩余数量) >= 60 && Number(x.可送上限) >= 60);
  if (!line) continue;
  pick = { no, line, supplier: N(r['供应商编码']), lines: ls };
  break;
}
if (!pick) { console.error('找不到合适的已审核采购订单'); await pool.close(); process.exit(1); }
const LINE = pick.line;
const LINE_ID = Number(LINE.id);
const EXPECT_BATCH = `${String(pick.supplier || '').replace(/^YJ-/i, '')}-${TODAY}`;
console.log(`  采购订单 ${pick.no}(供应商 ${pick.supplier})行 ${LINE.行号} 订单数量 ${LINE.数量} 剩余 ${LINE.剩余数量}`);
const created = [];
let printDoc = '';
try {
  // ============ ① 打印弹窗取数 ============
  console.log('\n=== ① 打印弹窗取数:预填批次号 = 供应商编码去 YJ- 前缀 + 当天 ===');
  const dlg0 = await get(`/px/puLabel/dialog?orderNo=${encodeURIComponent(pick.no)}`);
  ok(N(dlg0?.prefBatchNo) === EXPECT_BATCH, `预填批次号 = ${EXPECT_BATCH}(实得 ${JSON.stringify(dlg0?.prefBatchNo)})`);
  const row0 = (dlg0?.lines || []).find((x) => Number(x.id) === LINE_ID);
  ok(!!row0, `弹窗行里能找到该订单行(行号 ${row0?.行号})`);
  info(`该行:订单数量 ${row0?.数量} 已送 ${row0?.已送数量} 已打印 ${row0?.已打印数量} 剩余可打 ${row0?.剩余可打}`);
  const PRINT_QTY = Math.min(50, Number(row0?.剩余可打 || 0));
  ok(Number(row0?.剩余可打) > 0, `「剩余可打」有额度(${row0?.剩余可打})`);
  ok((dlg0?.records || []).length === 0, `初始没有打印记录(实得 ${(dlg0?.records || []).length} 条)`);

  // ============ ② 登记打印(批次号取预填值) ============
  console.log('\n=== ② 登记打印:落 bd_pu_label / bl_pu_label,单据号 MQ-yyyy-MM-nnnn ===');
  const pr = await post('/px/puLabel/print', {
    orderNo: pick.no, batchNo: EXPECT_BATCH,
    lines: [{ 采购订单行id: LINE_ID, 打印数量: PRINT_QTY }],
  });
  printDoc = N(pr['单据编号']);
  ok(/^MQ-\d{4}-\d{2}-\d{4}$/.test(printDoc), `打印单号符合 MQ-yyyy-MM-nnnn(实得 ${JSON.stringify(printDoc)})`);
  ok(N(pr['批次号']) === EXPECT_BATCH, `返回批次号 = ${EXPECT_BATCH}(实得 ${JSON.stringify(pr['批次号'])})`);
  const hRow = await one(`SELECT 单据编号, 采购订单号, 供应商编码, 批次号, 打印人, 打印次数 FROM bd_pu_label WHERE 单据编号=N'${printDoc}'`);
  ok(N(hRow?.批次号) === EXPECT_BATCH && N(hRow?.采购订单号) === pick.no,
    `头落库:批次号 ${hRow?.批次号} / 采购订单号 ${hRow?.采购订单号} / 打印次数 ${hRow?.打印次数}`);
  const lRow = await one(`SELECT 采购订单行号, 采购订单行id, 物料编码, 打印数量 FROM bl_pu_label WHERE 单据编号=N'${printDoc}' AND ISNULL(asp_cancel,'N')<>'Y'`);
  ok(Number(lRow?.打印数量) === PRINT_QTY && Number(lRow?.['采购订单行id']) === LINE_ID,
    `行落库:行id ${lRow?.['采购订单行id']} / 行号 ${lRow?.采购订单行号} / 打印数量 ${lRow?.打印数量}`);

  // ============ ③ 打印即**隔离**:打印量从原行数量里切走,成为独立一行 ============
  console.log('\n=== ③ 打印即隔离:原行数量切走打印量,并多出一行「已打印」隔离行 ===');
  const dlg1 = await get(`/px/puLabel/dialog?orderNo=${encodeURIComponent(pick.no)}`);
  const row1 = (dlg1?.lines || []).find((x) => Number(x.id) === LINE_ID);
  ok(Number(row1?.未生单预约) === PRINT_QTY, `弹窗:未生单预约 = ${PRINT_QTY}(实得 ${row1?.未生单预约})`);
  ok(Math.abs(Number(row1?.剩余可打) - (Number(row0.剩余可打) - PRINT_QTY)) < 0.01,
    `弹窗:剩余可打 ${row0.剩余可打} → ${row1?.剩余可打}(减掉了 ${PRINT_QTY})`);
  ok((dlg1?.records || []).length === 1 && Number(dlg1.records[0]['未生单合计']) === PRINT_QTY,
    `弹窗:已打印记录 1 条,未生单合计 = ${PRINT_QTY}(实得 ${dlg1?.records?.[0]?.['未生单合计']})`);

  const ls1 = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: pick.no });
  const bl1 = (ls1?.lines || []).find((x) => Number(x.id) === LINE_ID && x.rowKind === 'order');
  const iso1 = (ls1?.lines || []).find((x) => x.rowKind === 'printed');
  info(`原行(batchFlow):数量 ${bl1?.数量}(订单数量 ${bl1?.订单数量} 已切走已打印 ${bl1?.已打印数量}) 已送 ${bl1?.已送数量} 剩余 ${bl1?.剩余数量} 可送上限 ${bl1?.可送上限}`);
  info(`隔离行(batchFlow):lineKey ${iso1?.lineKey} 批次号 ${iso1?.批次号} 数量 ${iso1?.数量} 已送 ${iso1?.已送数量} 剩余 ${iso1?.剩余数量} 已生单 ${iso1?.已生单}`);
  ok(Math.abs(Number(bl1?.数量) - (Number(LINE.数量) - PRINT_QTY)) < 0.01,
    `原行数量 = 订单数量 − 已打印 = ${LINE.数量} − ${PRINT_QTY} = ${bl1?.数量}(**打印量已从原数量隔离出去**)`);
  ok(Math.abs(Number(bl1?.剩余数量) - (Number(LINE.数量) - PRINT_QTY)) < 0.01,
    `原行剩余 = ${bl1?.剩余数量}(原行不再含被切走的那部分)`);
  ok(!!iso1 && Number(iso1.数量) === PRINT_QTY && N(iso1.批次号) === EXPECT_BATCH,
    `**多出一行**隔离行:批次号 ${iso1?.批次号} 数量 ${iso1?.数量} —— 就是"已经隔离出来的那一行"`);
  ok(String(iso1?.lineKey || '').indexOf('@') > 0,
    `隔离行的行键自带身份(${iso1?.lineKey})⇒ 它自己的已送量与 原行 各记各的`);
  ok(Number(iso1?.剩余数量) === PRINT_QTY && iso1?.已生单 === false,
    `隔离行未生单:剩余 ${iso1?.剩余数量} / 已生单标记 ${iso1?.已生单}`);
  // 一张单一行:原行与隔离行分别只认自己的 link(lineKey 不同)
  ok(N(bl1?.lineKey) !== N(iso1?.lineKey), `两行 lineKey 不同(${bl1?.lineKey} ≠ ${iso1?.lineKey})`);

  // ============ ④ 约束:超隔离行数量、重复生单已生单的行 都要被拒 ============
  console.log('\n=== ④ 生单约束:超隔离行数量、重复生单 —— 都要被拒 ===');
  const overMsg = await expectFail('/px/batchFlow/generate', {
    sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: pick.no,
    lines: [{ lineKey: iso1.lineKey, qty: PRINT_QTY + 10 }],
    batchNo: EXPECT_BATCH,
  });
  ok(overMsg.includes('超出该批次号的未生单量'), `按隔离行超出其数量被拒:${overMsg.slice(0, 120)}`);
  const origOverMsg = await expectFail('/px/batchFlow/generate', {
    sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: pick.no,
    lines: [{ lineKey: bl1.lineKey, qty: Number(bl1.数量) + Number(bl1.可送上限) }],
  });
  ok(origOverMsg.includes('超出允许上限'), `原行超出其扣后上限被拒:${origOverMsg.slice(0, 120)}`);

  // ============ ⑤ 生单消费:按隔离行生单 → 暂收单批次号 = 材料码上的号 ============
  console.log('\n=== ⑤ 用隔离行生单:暂收单 单头/明细行/台账 都是材料码上的那个号 ===');
  const gen = await post('/px/batchFlow/generate', {
    sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: pick.no,
    lines: [{ lineKey: iso1.lineKey, qty: PRINT_QTY }],
    batchNo: EXPECT_BATCH,
  });
  const recv = N(gen['编号']);
  created.push(['QC_RECV', recv]);
  ok(N(gen['批次号']) === EXPECT_BATCH, `生单返回批次号 = ${EXPECT_BATCH}(实得 ${JSON.stringify(gen['批次号'])})`);
  const recvRow = await one(`SELECT [批次号] b FROM sl_recv WHERE 单据编号=N'${recv}'`);
  const recvLine = await one(`SELECT COUNT(*) n, SUM(CASE WHEN [批次号]=N'${EXPECT_BATCH}' THEN 1 ELSE 0 END) hit
    FROM sl_recv_detail WHERE 单据编号=N'${recv}' AND ISNULL(asp_cancel,'N')<>'Y'`);
  const led = await one(`SELECT batch_no, status FROM yj_doc_batch WHERE id=${Number(gen['批次键'] || 0)}`);
  ok(N(recvRow?.b) === EXPECT_BATCH, `暂收单头批次号 = ${EXPECT_BATCH}(实得 ${JSON.stringify(recvRow?.b)})`);
  ok(Number(recvLine?.n) > 0 && Number(recvLine?.hit) === Number(recvLine?.n),
    `明细行全部同号(${recvLine?.hit}/${recvLine?.n})`);
  ok(N(led?.batch_no) === EXPECT_BATCH && N(led?.status) === 'ACTIVE', `批次台账 ${led?.batch_no}/${led?.status}`);

  // ============ ⑥ 消费后:隔离行标「已生单」不可再勾;原行不受影响 ============
  console.log('\n=== ⑥ 消费后:隔离行 已送=数量、剩余=0、标已生单;原行数字不动 ===');
  const ls2 = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: pick.no });
  const bl2 = (ls2?.lines || []).find((x) => Number(x.id) === LINE_ID && x.rowKind === 'order');
  const iso2 = (ls2?.lines || []).find((x) => x.rowKind === 'printed' && N(x.lineKey) === N(iso1.lineKey));
  ok(Number(iso2?.已送数量) === PRINT_QTY && Number(iso2?.剩余数量) === 0 && iso2?.已生单 === true,
    `隔离行:已送 ${iso2?.已送数量} / 剩余 ${iso2?.剩余数量} / 已生单 ${iso2?.已生单}(列表里仍在,只是不能再勾)`);
  ok(Number(iso2?.可送上限) === 0, `隔离行可送上限归 0(${iso2?.可送上限})⇒ 前端不给勾`);
  ok(Number(bl2?.已送数量) === 0 && Math.abs(Number(bl2?.数量) - (Number(LINE.数量) - PRINT_QTY)) < 0.01,
    `原行不受影响:数量 ${bl2?.数量} / 已送 ${bl2?.已送数量}(隔离行送的量**不**记到原行)`) ;
  const reMsg = await expectFail('/px/batchFlow/generate', {
    sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: pick.no,
    lines: [{ lineKey: iso1.lineKey, qty: PRINT_QTY }], batchNo: EXPECT_BATCH,
  });
  ok(reMsg.includes('已经生过单'), `重复生单同一隔离行被拒:${reMsg.slice(0, 120)}`);

  // ============ ⑦ 删除暂收单 → 隔离行自动回到"未生单"(零回滚代码) ============
  console.log('\n=== ⑦ 删除暂收单:link 置 RELEASED ⇒ 隔离行**自动回到未生单** ===');
  await cb('QC_RECV', '删除', { 编号: recv });
  await sleep(700);
  const ls3 = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: pick.no });
  const iso3 = (ls3?.lines || []).find((x) => x.rowKind === 'printed' && N(x.lineKey) === N(iso1.lineKey));
  ok(Number(iso3?.已送数量) === 0 && Number(iso3?.剩余数量) === PRINT_QTY && iso3?.已生单 === false,
    `隔离行自动回落:已送 ${iso3?.已送数量} → 剩余 ${iso3?.剩余数量}(无需任何回滚代码)`);
  const i = created.findIndex((c) => c[1] === recv);
  if (i >= 0) created.splice(i, 1);

  // ============ ⑧ 作废打印记录 → 隔离行消失,数量回到原行 ============
  console.log('\n=== ⑧ 作废打印记录:隔离行消失,数量回到原行 ===');
  const vd = await post('/px/puLabel/void', { docNo: printDoc });
  ok(Number(vd['作废行数']) >= 1, `作废行数 = ${vd['作废行数']}`);
  const dlg2 = await get(`/px/puLabel/dialog?orderNo=${encodeURIComponent(pick.no)}`);
  const row2 = (dlg2?.lines || []).find((x) => Number(x.id) === LINE_ID);
  ok(Number(row2?.未生单预约) === 0 && Number(row2?.已打印数量) === 0,
    `弹窗:未生单预约 ${row2?.未生单预约} / 已打印数量 ${row2?.已打印数量}(都归零)`);
  ok(Math.abs(Number(row2?.剩余可打) - Number(row0.剩余可打)) < 0.01,
    `剩余可打回到 ${row2?.剩余可打}(与打印前 ${row0.剩余可打} 一致)`);
  ok((dlg2?.records || []).length === 0, `已打印记录清空(实得 ${(dlg2?.records || []).length} 条)`);
  const ls4 = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: pick.no });
  const bl4 = (ls4?.lines || []).find((x) => Number(x.id) === LINE_ID && x.rowKind === 'order');
  ok(!(ls4?.lines || []).some((x) => x.rowKind === 'printed'), `生单明细里不再有隔离行`);
  ok(Math.abs(Number(bl4?.数量) - Number(LINE.数量)) < 0.01 && Number(bl4?.剩余数量) === Number(LINE.剩余数量),
    `原行数量/剩余回到打印前(${bl4?.数量} / ${bl4?.剩余数量})`);

  console.log(`\n  留证:采购订单 ${pick.no} / 批次号 ${EXPECT_BATCH} / 打印单 ${printDoc} / 暂收单 ${recv}(已删)`);

  // ============ ⑨ 一次打印 = 一行 = 一张单(2026-10-04 追加口径) ============
  // 用户口径「打印需要是每次一行,不能多行否则作废就全部作废了」:
  // 作废按**单据编号**整张作,多行挤一张单 ⇒ 作废一行连累其余行。故:一次只收一行、每次都新建头。
  console.log('\n=== ⑨ 一次打印 = 一行 = 一张单:多行被拒 / 两次两张单 / 作废互不牵连 / 重打不重复占量 ===');
  const lineB = (pick.lines?.lines || []).find((x) => x.rowKind === 'order'
    && Number(x.id) !== LINE_ID && Number(x.剩余数量) > 0 && Number(x.可送上限) > 0);
  ok(!!lineB, `另找到一行可打的订单行(行 ${lineB?.行号} 剩余 ${lineB?.剩余数量})`);
  const LINE_B_ID = Number(lineB?.id);
  const QTY_B = Math.min(20, Number(lineB?.可送上限 || 0));

  // ⑨.1 一次传两行 ⇒ 必须被拒(否则多行并单,作废连坐)
  const twoMsg = await expectFail('/px/puLabel/print', {
    orderNo: pick.no, batchNo: EXPECT_BATCH,
    lines: [{ 采购订单行id: LINE_ID, 打印数量: 10 }, { 采购订单行id: LINE_B_ID, 打印数量: 10 }],
  });
  ok(twoMsg.includes('一次只能打印一行'), `一次传两行被拒:${twoMsg.slice(0, 130)}`);
  ok(Number((await one(`SELECT COUNT(*) n FROM bd_pu_label WHERE 采购订单号=N'${pick.no}' AND ISNULL(asp_cancel,'N')<>'Y'`))?.n) === 0,
    `被拒后**没有**留下半张打印单(事务回滚)`);

  // ⑨.2 分两次各打一行,同一个批次号 ⇒ **两张不同的打印单**
  const prA = await post('/px/puLabel/print', {
    orderNo: pick.no, batchNo: EXPECT_BATCH, lines: [{ 采购订单行id: LINE_ID, 打印数量: PRINT_QTY }],
  });
  const prB = await post('/px/puLabel/print', {
    orderNo: pick.no, batchNo: EXPECT_BATCH, lines: [{ 采购订单行id: LINE_B_ID, 打印数量: QTY_B }],
  });
  ok(N(prA['单据编号']) !== N(prB['单据编号']),
    `同一个批次号打两行 ⇒ **两张单**(${prA['单据编号']} / ${prB['单据编号']};旧口径会复用同一张)`);
  const eachOne = await q(`SELECT h.[单据编号] no, COUNT(l.id) n FROM bd_pu_label h JOIN bl_pu_label l
    ON l.[单据编号]=h.[单据编号] AND ISNULL(l.asp_cancel,'N')<>'Y'
    WHERE h.[单据编号] IN (N'${prA['单据编号']}', N'${prB['单据编号']}') GROUP BY h.[单据编号]`);
  ok(eachOne.length === 2 && eachOne.every((r) => Number(r.n) === 1),
    `两张单**各只有一行**(实得 ${JSON.stringify(eachOne.map((r) => `${r.no}:${r.n}`))})`);
  const lsIso = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: pick.no });
  const isos = (lsIso?.lines || []).filter((x) => x.rowKind === 'printed');
  ok(isos.length === 2 && new Set(isos.map((x) => N(x.lineKey))).size === 2,
    `生单明细里**两行各自成一行隔离行**(${isos.map((x) => x.lineKey).join(' / ')})—— 互不牵连的行键`);

  // ⑨.3 作废其中一张 ⇒ 另一张的预约**纹丝不动**(这就是用户要的"作废只作废一行")
  await post('/px/puLabel/void', { docNo: prA['单据编号'] });
  await sleep(500);
  const lsAfterVoid = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: pick.no });
  const isoB = (lsAfterVoid?.lines || []).find((x) => x.rowKind === 'printed' && Number(x.id) === LINE_B_ID);
  const isoAgone = (lsAfterVoid?.lines || []).find((x) => x.rowKind === 'printed' && Number(x.id) === LINE_ID);
  ok(!isoAgone, `作废 ${prA['单据编号']} ⇒ 甲行的隔离行消失`);
  ok(!!isoB && Number(isoB.数量) === QTY_B && Number(isoB.剩余数量) === QTY_B,
    `乙行的隔离行**不受影响**(批次号 ${isoB?.批次号} 数量 ${isoB?.数量} 剩余 ${isoB?.剩余数量})`);
  const dlgRec = await get(`/px/puLabel/dialog?orderNo=${encodeURIComponent(pick.no)}`);
  ok((dlgRec?.records || []).length === 1 && N(dlgRec.records[0]['单据编号']) === N(prB['单据编号']),
    `打印记录里只剩乙行那张(实得 ${JSON.stringify((dlgRec?.records || []).map((r) => r['单据编号']))})`);

  // ⑨.4 重打:同一张单原样再打一遍 ⇒ 打印次数 +1、**不新增预约**
  const beforeReprint = await one(`SELECT ISNULL([打印次数],0) t FROM bd_pu_label WHERE [单据编号]=N'${prB['单据编号']}'`);
  const rp = await post('/px/puLabel/reprint', { docNo: prB['单据编号'] });
  ok(Number(beforeReprint?.t) === 1 && Number(rp['打印次数']) === 2,
    `重打把 打印次数 1 → 2(实得 ${rp['打印次数']}),且返回可出纸的行(${rp.lines?.length} 行)`);
  const lsAfterReprint = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: pick.no });
  const isoB2 = (lsAfterReprint?.lines || []).find((x) => x.rowKind === 'printed' && Number(x.id) === LINE_B_ID);
  ok((lsAfterReprint?.lines || []).filter((x) => x.rowKind === 'printed').length === 1
    && Number(isoB2?.数量) === QTY_B && N(isoB2?.lineKey) === N(isoB?.lineKey),
    `重打**没有**新增预约/没有多出隔离行(仍是 ${QTY_B}、行键不变)`);
  await post('/px/puLabel/void', { docNo: prB['单据编号'] });
  await sleep(400);
  console.log(`  留证(⑨):${prA['单据编号']} / ${prB['单据编号']}(均已作废)`);
} finally {
  console.log('\n=== 清理测试单据 ===');
  for (const [p, no] of created.slice().reverse()) {
    for (const b of ['弃审', '删除']) {
      try { await cb(p, b, { 编号: no }); console.log(`  ${p} ${no} ${b} ✓`); }
      catch (e) { console.log(`  ${p} ${no} ${b} 跳过:${String(e.message).slice(0, 80)}`); }
    }
  }
  // 打印记录:探针结束一律作废,别在库里留预约
  if (printDoc) {
    try { await post('/px/puLabel/void', { docNo: printDoc }); console.log(`  ${printDoc} 作废 ✓`); }
    catch (e) { console.log(`  ${printDoc} 作废 跳过:${String(e.message).slice(0, 80)}`); }
  }
  await pool.close();
}
console.log(`\n${fails ? `❌ 失败 ${fails} 项` : '✅ 全部通过'}`);
process.exit(fails ? 1 : 0);
