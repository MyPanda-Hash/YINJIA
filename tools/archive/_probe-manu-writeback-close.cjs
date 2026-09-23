/**
 * 探针:生产加工单「执行回填 + 结案」端到端(2026-09-22,盘点文档 §4.5 两个 ❌ 的验收)
 * 链路:客户订单→生成加工单(按行) → FINISH_IN 保存+审核 → 断言回填(入库数量/入库单号/余量/完工日期)
 *      → MATERIAL_OUT 保存+审核 → 断言领料单号回填 → 弃审(领料回收) → 弃审入库(数量回收)
 *      → 结案 → 拆单被拒 → 取消结案。
 * 打印 MARK_* 供清理;不做删除(由 SQL 侧硬清:单据/行/状态/占用/kucun/日志)。
 */
const API = (process.argv[2] || 'http://127.0.0.1:8090') + '/api';
const SO = process.argv[3] || 'LZW-20260917-03';
const LOT = 'E2E-WB-0922';

const log = (...a) => console.log(...a);
const ok = (m) => log('✅ ' + m);
const bad = (m) => { log('❌ ' + m); process.exitCode = 1; };

async function api(method, path, body, token) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { }
  return { status: res.status, json, text };
}
const call = (p, b, f, bp, t) => api('POST', '/px/callButton', { panelCode: p, buttonName: b, formData: f, buttonParam: bp || {} }, t);
const cfgOf = async (c, t) => (await api('GET', `/px/getPanelConfig?panelCode=${c}`, undefined, t)).json?.data;
const head = (d) => d.dataSchema?.fields || [];
const lines = (d) => d.detail?.tabs?.[0]?.fields || [];
const optOf = (d, name, where) => { const f = (where || head(d)).find((x) => x.dataName === name); return f?.options || f?.dictOptions || []; };
const listRows = async (c, t, n = 100) => (await api('POST', '/px/queryFormDataList', { panelCode: c, pageNo: 1, pageSize: n }, t)).json?.data?.list || [];
const assertEq = (label, actual, expect) => {
  const a = String(actual ?? ''), e = String(expect ?? '');
  (a === e) ? ok(`${label} = ${a}`) : bad(`${label}: 期望 ${e}, 实际 ${a}`);
};

(async () => {
  const login = await api('POST', '/auth/login', { userName: 'admin', password: '123456' });
  const token = login.json?.data?.token;
  if (!token) { bad('登录失败'); return; }
  ok('登录成功');

  // ── ① 按行生成加工单,取首张(单行)作为回填靶 ──
  const gen = await call('SO_ORDER', '生成生产加工单', { 编号: SO }, {}, token);
  const created = gen.json?.data?.['编号清单'] || [];
  if (!created.length) { bad('生成失败: ' + gen.text.slice(0, 200)); return; }
  const mo = created[0];
  const moRows = await listRows('MANU_ORDER', token);
  const moRow = moRows.find((r) => (r['编号'] || r['合同号']) === mo);
  const prod = moRow?.['产品编码'] || 'T111';
  const prodName = moRow?.['产品名称'] || '';
  const plan = Number(moRow?.['排产数量'] || 0);
  log(`① 加工单 ${mo} 产品=${prod}(${prodName}) 排产=${plan}`);
  assertEq('生成张数', created.length, '3');

  // ── ② FINISH_IN 保存+审核 → 回填断言 ──
  const fi = await cfgOf('FINISH_IN', token);
  const biz = (optOf(fi, '业务类型')[0]) || '生产入库';
  const fiSave = await call('FINISH_IN', '保存', {
    单据日期: new Date().toISOString().slice(0, 10), 仓库: '成品B仓', 生产车间: '切炭车间', 加工单号: mo, 业务类型: biz, 经手人: 'admin',
    detail: { items: [{ 产品编码: prod, 产品名称: prodName, 实收数量: 100, 计量单位: '支', 批号: LOT, 仓库: '成品B仓' }] },
  }, {}, token);
  const fiNo = fiSave.json?.data?.['编号'];
  if (!fiNo) { bad('FINISH_IN 保存失败: ' + fiSave.text.slice(0, 300)); return; }
  const fiAudit = await call('FINISH_IN', '审核', { 编号: fiNo }, {}, token);
  if (fiAudit.status !== 200) { bad('FINISH_IN 审核失败: ' + fiAudit.text.slice(0, 300)); return; }
  ok(`② FINISH_IN ${fiNo} 已审核`);
  let r1 = (await listRows('MANU_ORDER', token)).find((x) => (x['编号'] || x['合同号']) === mo);
  assertEq('入库数量', r1?.['入库数量'], '100');
  assertEq('入库单号', r1?.['入库单号'], fiNo);
  assertEq('余量', r1?.['余量'], String(plan - 100));
  r1?.['完工日期'] ? ok('完工日期 = ' + String(r1['完工日期']).slice(0, 10)) : bad('完工日期未回填');

  // ── ③ MATERIAL_OUT 保存+审核 → 领料单号回填 ──
  const mo_ = await cfgOf('MATERIAL_OUT', token);
  const biz2 = (optOf(mo_, '业务类型')[0]) || '生产领料';
  const mkSave = await call('MATERIAL_OUT', '保存', {
    单据日期: new Date().toISOString().slice(0, 10), 仓库: '成品B仓', 生产车间: '切炭车间', 加工单号: mo, 业务类型: biz2, 领用人: 'admin',
    detail: { items: [{ 材料编码: prod, 材料名称: prodName, 数量: 30, 计量单位: '支', 批号: LOT, 仓库: '成品B仓' }] },
  }, {}, token);
  const mkNo = mkSave.json?.data?.['编号'];
  if (!mkNo) { bad('MATERIAL_OUT 保存失败: ' + mkSave.text.slice(0, 300)); return; }
  const mkAudit = await call('MATERIAL_OUT', '审核', { 编号: mkNo }, {}, token);
  if (mkAudit.status !== 200) { bad('MATERIAL_OUT 审核失败: ' + mkAudit.text.slice(0, 300)); return; }
  ok(`③ MATERIAL_OUT ${mkNo} 已审核`);
  let r2 = (await listRows('MANU_ORDER', token)).find((x) => (x['编号'] || x['合同号']) === mo);
  assertEq('领料单号', r2?.['领料单号'], mkNo);

  // ── ④ 弃审领料 → 领料单号回收 ──
  const mkUn = await call('MATERIAL_OUT', '弃审', { 编号: mkNo }, {}, token);
  if (mkUn.status !== 200) { bad('MATERIAL_OUT 弃审失败: ' + mkUn.text.slice(0, 300)); return; }
  let r3 = (await listRows('MANU_ORDER', token)).find((x) => (x['编号'] || x['合同号']) === mo);
  (r3?.['领料单号'] == null || r3?.['领料单号'] === '') ? ok('弃审领料 → 领料单号已回收') : bad('领料单号未回收: ' + r3?.['领料单号']);

  // ── ⑤ 弃审入库 → 数量/单号回收(余量复原) ──
  const fiUn = await call('FINISH_IN', '弃审', { 编号: fiNo }, {}, token);
  if (fiUn.status !== 200) { bad('FINISH_IN 弃审失败: ' + fiUn.text.slice(0, 300)); return; }
  let r4 = (await listRows('MANU_ORDER', token)).find((x) => (x['编号'] || x['合同号']) === mo);
  assertEq('弃审后入库数量', r4?.['入库数量'], '0');
  assertEq('弃审后余量', r4?.['余量'], String(plan));
  (r4?.['入库单号'] == null || r4?.['入库单号'] === '') ? ok('弃审后入库单号已回收') : bad('入库单号未回收: ' + r4?.['入库单号']);

  // ── ⑥ 审核 → 结案 → 拆单被拒 → 取消结案 ──
  const moAudit = await call('MANU_ORDER', '审核', { 编号: mo }, {}, token);
  if (moAudit.status !== 200) { bad('加工单审核失败: ' + moAudit.text.slice(0, 200)); return; }
  const close = await call('MANU_ORDER', '结案', { 编号: mo }, {}, token);
  if (close.status !== 200) { bad('结案失败: ' + close.text.slice(0, 200)); return; }
  let r5 = (await listRows('MANU_ORDER', token)).find((x) => (x['编号'] || x['合同号']) === mo);
  assertEq('结案标记', r5?.['结案'], 'Y');
  const splitClosed = await call('MANU_ORDER', '拆单', { 编号: mo }, { 拆分数: 2 }, token);
  /已结案/.test(splitClosed.json?.message || splitClosed.text || '') ? ok('已结案拆单被拒') : bad('已结案拆单未被拒: ' + (splitClosed.text || '').slice(0, 120));
  const unclose = await call('MANU_ORDER', '取消结案', { 编号: mo }, {}, token);
  if (unclose.status !== 200) { bad('取消结案失败: ' + unclose.text.slice(0, 200)); return; }
  let r6 = (await listRows('MANU_ORDER', token)).find((x) => (x['编号'] || x['合同号']) === mo);
  (r6?.['结案'] == null || r6?.['结案'] === '' || r6?.['结案'] === 'N') ? ok('取消结案 → 标记清空') : bad('结案标记未清: ' + r6?.['结案']);

  log(`MARK_SO=${SO}`);
  log(`MARK_MO_LIST=` + JSON.stringify(created));
  log(`MARK_FI=${fiNo}`);
  log(`MARK_MK=${mkNo}`);
  log(`MARK_LOT=${LOT}`);
})();
