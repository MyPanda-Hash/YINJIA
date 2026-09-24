/**
 * 探针:单轨改造端到端(2026-09-22,参考库式·用户拍板)
 * 链路:销售订单→按行生成加工单→审核→报工(混料,upsert 建行)→切炭报工(双出口自动入库+产品批号+回填)
 *      →排产看板五工序完成→弃审切炭(红字冲回+回填归零)。
 * 打印 MARK_* 供清理;不做删除(SQL 侧硬清)。
 */
const API = (process.argv[2] || 'http://127.0.0.1:8090') + '/api';
const SO = process.argv[3] || 'LZW-20260917-02';   // 单行订单(T223×1000)

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
const rowsOf = async (c, t, n = 100) => (await api('POST', '/px/queryFormDataList', { panelCode: c, pageNo: 1, pageSize: n }, t)).json?.data?.list || [];
const eq = (l, a, e) => (String(a ?? '') === String(e ?? '')) ? ok(`${l} = ${a}`) : bad(`${l}: 期望 ${e}, 实际 ${a}`);

(async () => {
  const login = await api('POST', '/auth/login', { userName: 'admin', password: '123456' });
  const token = login.json?.data?.token;
  if (!token) { bad('登录失败'); return; }
  ok('登录成功');

  // ① 按行生成加工单(单行订单 → 1 张)并审核
  const gen = await call('SO_ORDER', '生成生产加工单', { 编号: SO }, {}, token);
  const created = gen.json?.data?.['编号清单'] || [];
  if (created.length < 1) { bad('生成异常: ' + gen.text.slice(0, 200)); return; }
  const mo = created[0];
  const au = await call('MANU_ORDER', '审核', { 编号: mo }, {}, token);
  if (au.status !== 200) { bad('加工单审核失败: ' + au.text.slice(0, 200)); return; }
  const moRow = (await rowsOf('MANU_ORDER', token)).find((x) => (x['编号'] || x['合同号']) === mo);
  const plan = Number(moRow?.['排产数量'] || 0);
  log(`① 加工单 ${mo} 产品=${moRow?.['产品编码']} 排产=${plan} 已审核`);

  // ② 报工(混料 400)——无工序行应 upsert 建行
  const r1 = await call('WO_REPORT', '保存', { 单据日期: new Date().toISOString().slice(0, 10), 工单号: mo, 工序: '混料', 报工数量: 400, 报工人: 'admin' }, {}, token);
  const rep1 = r1.json?.data?.['编号'];
  if (!rep1) { bad('报工单保存失败: ' + r1.text.slice(0, 300)); return; }
  const a1 = await call('WO_REPORT', '审核', { 编号: rep1 }, {}, token);
  if (a1.status !== 200) { bad('混料报工审核失败: ' + a1.text.slice(0, 300)); return; }
  ok(`② 混料报工 ${rep1} 审核通过(upsert 建行)`);

  // ③ 切炭报工(300, 直销120)→ 双出口自动入库 + 产品批号 + 回填
  const r2 = await call('WO_REPORT', '保存', { 单据日期: new Date().toISOString().slice(0, 10), 工单号: mo, 工序: '切炭', 报工数量: 300, 直销数量: 120, 报工人: 'admin' }, {}, token);
  const rep2 = r2.json?.data?.['编号'];
  if (!rep2) { bad('切炭报工保存失败: ' + r2.text.slice(0, 300)); return; }
  const a2 = await call('WO_REPORT', '审核', { 编号: rep2 }, {}, token);
  if (a2.status !== 200) { bad('切炭报工审核失败: ' + a2.text.slice(0, 300)); return; }
  ok(`③ 切炭报工 ${rep2} 审核通过`);

  const after = (await rowsOf('MANU_ORDER', token)).find((x) => (x['编号'] || x['合同号']) === mo);
  eq('③ 加工单.入库数量(双出口回填)', after?.['入库数量'], '120');
  after?.['批号'] ? ok('③ 加工单.批号(自动生成) = ' + after['批号']) : bad('③ 批号未生成');
  const fiNos = String(after?.['入库单号'] || '');
  fiNos.startsWith('FI-') ? ok('③ 加工单.入库单号 = ' + fiNos) : bad('③ 入库单号异常: ' + fiNos);

  // ④ 排产看板:五工序完成/未完成
  const board = (await rowsOf('MANU_SCHEDULE', token)).find((x) => String(x['加工单号']) === mo);
  eq('④ 看板.混料完成', board?.['混料完成'], '400');
  eq('④ 看板.切炭完成', board?.['切炭完成'], '300');
  eq('④ 看板.装箱完成', board?.['装箱完成'], '0');
  eq('④ 看板.未完成数量(排产-装箱)', board?.['未完成数量'], String(plan));
  eq('④ 看板.入库数量', board?.['入库数量'], '120');

  // ⑤ 弃审切炭 → 红字入库冲回 + 回填归零 + 进度扣减
  const u2 = await call('WO_REPORT', '弃审', { 编号: rep2 }, {}, token);
  if (u2.status !== 200) { bad('切炭弃审失败: ' + u2.text.slice(0, 300)); return; }
  const final = (await rowsOf('MANU_ORDER', token)).find((x) => (x['编号'] || x['合同号']) === mo);
  eq('⑤ 弃审后.入库数量(红字冲回)', final?.['入库数量'], '0');
  const board2 = (await rowsOf('MANU_SCHEDULE', token)).find((x) => String(x['加工单号']) === mo);
  eq('⑤ 弃审后.看板.切炭完成', board2?.['切炭完成'], '0');
  eq('⑤ 弃审后.看板.混料完成(保留)', board2?.['混料完成'], '400');

  log(`MARK_SO=${SO}`);
  log(`MARK_MO=${mo}`);
  log(`MARK_REP1=${rep1}`);
  log(`MARK_REP2=${rep2}`);
  log(`MARK_FI=${fiNos}`);
  log(`MARK_LOT=${after?.['批号'] || ''}`);
})().catch(e => { console.error('ERR ' + e.message); process.exit(1); });
