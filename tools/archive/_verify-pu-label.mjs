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
 *   ⑧ 作废打印记录 → 预约释放,行回到"未打印"状态。
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

  // ============ ③ 打印即预约 ============
  console.log('\n=== ③ 打印即预约:弹窗「剩余可打」与生单「剩余/可送上限」都被扣掉 ===');
  const dlg1 = await get(`/px/puLabel/dialog?orderNo=${encodeURIComponent(pick.no)}`);
  const row1 = (dlg1?.lines || []).find((x) => Number(x.id) === LINE_ID);
  ok(Number(row1?.未生单预约) === PRINT_QTY, `弹窗:未生单预约 = ${PRINT_QTY}(实得 ${row1?.未生单预约})`);
  ok(Math.abs(Number(row1?.剩余可打) - (Number(row0.剩余可打) - PRINT_QTY)) < 0.01,
    `弹窗:剩余可打 ${row0.剩余可打} → ${row1?.剩余可打}(减掉了 ${PRINT_QTY})`);
  ok((dlg1?.records || []).length === 1 && Number(dlg1.records[0]['未生单合计']) === PRINT_QTY,
    `弹窗:已打印记录 1 条,未生单合计 = ${PRINT_QTY}(实得 ${dlg1?.records?.[0]?.['未生单合计']})`);

  const ls1 = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: pick.no });
  const bl1 = (ls1?.lines || []).find((x) => Number(x.id) === LINE_ID);
  info(`batchFlow 行:数量 ${bl1?.数量} 已送 ${bl1?.已送数量} 剩余 ${bl1?.剩余数量} 可送上限 ${bl1?.可送上限} 未生单预约合计 ${bl1?.未生单预约合计}`);
  ok(Math.abs(Number(bl1?.剩余数量) - (Number(LINE.剩余数量) - PRINT_QTY)) < 0.01,
    `剩余数量 ${LINE.剩余数量} → ${bl1?.剩余数量}(被预约扣掉)`);
  ok(Math.abs(Number(bl1?.可送上限) - (Number(LINE.可送上限) - PRINT_QTY)) < 0.01,
    `可送上限 ${LINE.可送上限} → ${bl1?.可送上限}(被预约扣掉)`);
  const pr1 = (bl1?.打印预约 || [])[0];
  ok(pr1 && N(pr1['批次号']) === EXPECT_BATCH && Number(pr1['未生单量']) === PRINT_QTY,
    `回传「打印预约」:${JSON.stringify(pr1 && { 批次号: pr1['批次号'], 打印数量: pr1['打印数量'], 已生单量: pr1['已生单量'], 未生单量: pr1['未生单量'] })}`);

  // ============ ④ 约束:超预约量 / 凭空批次号 都要被拒 ============
  console.log('\n=== ④ 生单约束:超未生单预约量、无打印记录的批次号 —— 都要被拒 ===');
  const overMsg = await expectFail('/px/batchFlow/generate', {
    sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: pick.no,
    lines: [{ lineKey: bl1.lineKey, qty: PRINT_QTY + 10, batchNo: EXPECT_BATCH }],
  });
  ok(overMsg.includes('超出该批次号的未生单预约量'), `按该号超出预约量被拒:${overMsg.slice(0, 110)}`);
  const fakeMsg = await expectFail('/px/batchFlow/generate', {
    sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: pick.no,
    lines: [{ lineKey: bl1.lineKey, qty: 10, batchNo: `凭空-${TODAY}` }],
  });
  ok(fakeMsg.includes('没有批次号') && fakeMsg.includes('材料码打印记录'), `凭空批次号被拒:${fakeMsg.slice(0, 110)}`);

  // ============ ⑤ 生单消费:按材料码批次号生成暂收单 ============
  console.log('\n=== ⑤ 生单消费:暂收单 单头/明细行/批次台账 都是材料码上的那个号 ===');
  const gen = await post('/px/batchFlow/generate', {
    sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: pick.no,
    lines: [{ lineKey: bl1.lineKey, qty: PRINT_QTY, batchNo: EXPECT_BATCH }],
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

  // ============ ⑥ 消费后:未生单归 0、已生单 = 送料量(全部派生) ============
  console.log('\n=== ⑥ 消费后:未生单预约归 0,已生单量 = 送料量(由 form_flow_link 派生) ===');
  const ls2 = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: pick.no });
  const bl2 = (ls2?.lines || []).find((x) => Number(x.id) === LINE_ID);
  const pr2 = (bl2?.打印预约 || [])[0];
  ok(Number(pr2?.['未生单量']) === 0 && Number(pr2?.['已生单量']) === PRINT_QTY,
    `打印预约:已生单 ${pr2?.['已生单量']} / 未生单 ${pr2?.['未生单量']}`);
  ok(Math.abs(Number(bl2?.剩余数量) - (Number(LINE.剩余数量) - PRINT_QTY)) < 0.01,
    `剩余数量仍是被真实送掉后的值 ${bl2?.剩余数量}(预约已转成占用,不重复扣)`);

  // ============ ⑦ 删除暂收单 → 预约自动回落(零回滚代码) ============
  console.log('\n=== ⑦ 删除暂收单:link 置 RELEASED ⇒ 预约**自动回落** ===');
  await cb('QC_RECV', '删除', { 编号: recv });
  await sleep(700);
  const ls3 = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: pick.no });
  const bl3 = (ls3?.lines || []).find((x) => Number(x.id) === LINE_ID);
  const pr3 = (bl3?.打印预约 || [])[0];
  ok(Number(pr3?.['已生单量']) === 0 && Number(pr3?.['未生单量']) === PRINT_QTY,
    `预约自动回落:已生单 ${pr3?.['已生单量']} → 未生单 ${pr3?.['未生单量']}(无需任何回滚代码)`);
  ok(Math.abs(Number(bl3?.剩余数量) - (Number(LINE.剩余数量) - PRINT_QTY)) < 0.01,
    `剩余数量回到"只被预约占住"的 ${bl3?.剩余数量}`);
  const i = created.findIndex((c) => c[1] === recv);
  if (i >= 0) created.splice(i, 1);

  // ============ ⑧ 作废打印记录 → 预约彻底释放 ============
  console.log('\n=== ⑧ 作废打印记录:预约释放,该行回到"未打印" ===');
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
  const bl4 = (ls4?.lines || []).find((x) => Number(x.id) === LINE_ID);
  ok(Math.abs(Number(bl4?.剩余数量) - Number(LINE.剩余数量)) < 0.01,
    `生单余量回到打印前 ${bl4?.剩余数量}(预约完全释放)`);

  console.log(`\n  留证:采购订单 ${pick.no} / 批次号 ${EXPECT_BATCH} / 打印单 ${printDoc} / 暂收单 ${recv}(已删)`);
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
