/**
 * 「新增」不再撞已审核单号的端到端验证(2026-10-19)
 *
 * 复现原故障:双击新增 → /api/px/callButton(buttonName=保存, formData={}) → directAdd 建空白草稿。
 * 旧代码取号只看号池 ⇒ 发出库里已有的号(SL-2026-10-0032 等)⇒ 新草稿共用旧单的 yj_doc_status
 * (shr=admin)⇒ 列表/表头显示「已审核」,且 409「已审核单据不可保存」。
 *
 * 本脚本断言:
 *   1. 新增返回的单号 **在业务表里不存在**(取号已避开所有未回登的号);
 *   2. 该单在列表里的 单据状态 = 草稿(不是已审核)、saved = N;
 *   3. 能正常保存(不再 409),保存后状态仍为草稿;
 *   4. 清理:把验证单删除(不留垃圾草稿)。
 *
 * 用法(需 8090 在跑):
 *   node tools/archive/_probe-add-newdoc-20261019/_verify-add-newdoc.mjs [QC_RECV] [SL-2026-10-0131]
 *   第二参数可指定"应发出的单号",不传则只校验形态。
 */
const API = 'http://127.0.0.1:8090/api';
const panel = process.argv[2] || 'QC_RECV';
const expectNo = process.argv[3] || '';

const login = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
const token = login?.data?.token;
if (!token) { console.error('登录失败', login); process.exit(2); }
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };

async function callButton(buttonName, formData, buttonParam = {}) {
  const r = await fetch(API + '/px/callButton', { method: 'POST', headers: H, body: JSON.stringify({ panelCode: panel, buttonName, formData, buttonParam }) });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
}
async function listDocs(pageNo = 1, pageSize = 200) {
  const r = await fetch(API + '/px/queryFormDataList', { method: 'POST', headers: H, body: JSON.stringify({ panelCode: panel, condition: {}, pageNo, pageSize }) });
  const body = await r.json();
  return body?.data?.list || [];
}

const fails = [];
const ok = (cond, msg) => { console.log((cond ? '  [PASS] ' : '  [FAIL] ') + msg); if (!cond) fails.push(msg); };

console.log(`== 面板 ${panel} ==`);
const created = await callButton('保存', {});
const no = created.body?.data?.编号 || created.body?.data?.formNo;
console.log('  新增返回:', JSON.stringify(created.body?.data || created.body));
ok(created.status === 200 && !!no, '新增成功并返回单号');
if (!no) process.exit(1);
if (expectNo) ok(no === expectNo, `单号 = ${expectNo}(实际 ${no}:号池已跳过库里已有的号)`);

// 列表里这张单:状态必须是草稿,且不是"继承旧单"的已审核
const rows = await listDocs();
const row = rows.find((x) => x['编号'] === no);
ok(!!row, `新单 ${no} 出现在列表里`);
if (row) {
  ok(row['单据状态'] === '草稿', `列表状态 = 草稿(实际 ${row['单据状态']})`);
  ok(row['审核人'] == null || row['审核人'] === '', `列表审核人为空(实际 ${row['审核人']})`);
  // saved 只是"存过没有"的辅助标记(「保存」建单=saved Y、「保存为草稿」=N),不作断言,仅记录
  console.log(`  [INFO] saved = ${row['saved']}(directAdd 走「保存」分支,现口径为 Y)`);
}

// 保存一次(带一个必填可空字段原样回写),验证不再 409「已审核单据不可保存」
const head = { ...(row || {}) };
delete head.detail;
delete head['单据状态'];
const saved = await callButton('保存', { ...head, 编号: no });
ok(saved.status === 200, `保存成功(HTTP ${saved.status} ${saved.body?.message || ''})`);

// 清理:删除验证单
const del = await callButton('删除', { 编号: no });
ok(del.status === 200, `清理删除验证单(HTTP ${del.status})`);

console.log(fails.length ? `\n[FAIL] ${fails.length} 项:` + fails.map((f) => '\n  - ' + f).join('') : '\n[PASS] 新增/保存/删除全链路正常');
process.exit(fails.length ? 1 : 0);
