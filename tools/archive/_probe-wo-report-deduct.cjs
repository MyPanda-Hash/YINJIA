/**
 * 探针:报工扣减链路(2026-09-23 用户拍板:报工数量减少正在排产的数量)
 * 链:转工单→审核→排入线→骨架未交量X→SQL造报工单→审核(wo_progress累计)→骨架未交量X−报工→
 *     明细已报工/未交量列→弃审冲回→未交量恢复X
 * 前置:LZW-20260917-02#7208 可转;无启用线时 SQL 临时启用跑完还原。
 * 痕迹:外部 SQL 清理(MO + BG-PROBE-01 + wo_progress + bs_line_open)。
 */
const API = (process.argv[2] || 'http://127.0.0.1:8090') + '/api';
const SO = 'LZW-20260917-02';
const today = new Date().toISOString().slice(0, 10);
const BG = 'BG-PROBE-01';
const ok = (m) => console.log('✅ ' + m);
const bad = (m) => { console.log('❌ ' + m); process.exitCode = 1; };

async function api(path, body, token) {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { }
  return { status: res.status, json, text };
}

(async () => {
  const token = (await api('/auth/login', { userName: 'admin', password: '123456' })).json?.data?.token;
  if (!token) { bad('登录失败'); return; }
  ok('登录成功');

  let r = await api('/px/scheduleBoard/linesSummary', { 开工日期: today }, token);
  const sum = r.json?.data || [];
  let L1 = (sum.find((x) => !x['停用']) || {})['生产线'];
  const PRE_MO = process.argv[3], PRE_QTY = Number(process.argv[4] || 0);
  if (!L1) { console.log('⏭ 无启用产线,请先在 基础资料→生产线 启用至少一条'); return; }

  let mo, qty;
  if (PRE_MO && PRE_QTY > 0) { mo = PRE_MO; qty = PRE_QTY; ok('前置(外部):' + mo + ' 已排入 ' + L1 + ' ' + qty); }
  else {
  // 前置:工单(已审核)→排入 L1
  r = await api('/px/orderConvert/toManu', { rows: [{ 订单号: SO, 行id: 7208 }] }, token);
  const mo = r.json?.data?.['编号清单']?.[0];
  if (!mo) { bad('前置转工单失败: ' + r.text.slice(0, 200)); return; }
  console.log('MARK_MO ' + mo);
  r = await api('/px/callButton', { panelCode: 'MANU_ORDER', buttonName: '审核', formData: { 编号: mo }, buttonParam: {} }, token);
  if (r.status !== 200) { bad('前置审核失败: ' + r.text.slice(0, 200)); return; }
  r = await api('/px/scheduleBoard/pending', { keyword: mo }, token);
  const qty = Number((r.json?.data || []).find((x) => x['加工单号'] === mo)?.['排产数量']) || 0;
  r = await api('/px/scheduleBoard/assign', { rows: [{ 加工单号: mo, 生产线: L1, 排产数量: qty }] }, token);
  r.json?.data?.['排产张数'] === 1 ? ok(`前置:排入 ${L1} ${qty}`) : bad('前置排入失败: ' + r.text.slice(0, 200));
  }

  // ① 排产后骨架未交量 = qty(尚无报工)
  const backlog = async () => {
    const rr = await api('/px/scheduleBoard/linesSummary', { 开工日期: today }, token);
    return Number((rr.json?.data || []).find((x) => x['生产线'] === L1)?.['未交量'] || 0);
  };
  const b0 = await backlog();
  b0 >= qty - 0.001 ? ok(`① 排产后未交量 = ${b0}(含本单 ${qty};同线他单 ${Math.round((b0 - qty) * 100) / 100})`) : bad(`① 排产后未交量异常: ${b0} < ${qty}`);

  // ② SQL 造报工单(草稿)——单据编号用探针专用号防污染号池
  ok('② 报工单已由外部 SQL 预置(' + BG + ',工序=成型,报工数量=' + Math.floor(qty / 2) + ')');

  // ③ 审核报工单 → wo_progress 累计 → 未交量扣减
  r = await api('/px/callButton', { panelCode: 'WO_REPORT', buttonName: '审核', formData: { 编号: BG }, buttonParam: {} }, token);
  r.status === 200 ? ok('③ 报工单审核成功(wo_progress 已累计)') : bad('③ 报工审核失败: ' + r.text.slice(0, 250));

  const half = Math.floor(qty / 2);
  const b1 = await backlog();
  Math.abs(b1 - (b0 - half)) < 0.001
    ? ok(`③ 报工扣减生效:未交量 ${b0} → ${b1}(−${half} 报工数量)`)
    : bad(`③ 报工扣减未生效: ${b1} ≠ 预期 ${b0 - half}`);

  // ④ 明细列:已报工/未交量
  r = await api('/px/scheduleBoard/scheduled', { 生产线: L1, scope: '全部' }, token);
  const row = (r.json?.data || []).find((x) => x['加工单号'] === mo);
  row && Number(row['已报工']) === half && Math.abs(Number(row['未交量']) - (qty - half)) < 0.001
    ? ok(`④ 明细列:已报工=${row['已报工']} 未交量=${row['未交量']}`)
    : bad('④ 明细列异常: ' + JSON.stringify(row || {}).slice(0, 200));

  // ⑤ 弃审冲回 → 未交量恢复
  r = await api('/px/callButton', { panelCode: 'WO_REPORT', buttonName: '弃审', formData: { 编号: BG }, buttonParam: {} }, token);
  r.status === 200 ? ok('⑤ 报工弃审成功(wo_progress 对称冲回)') : bad('⑤ 弃审失败: ' + r.text.slice(0, 250));
  const b2 = await backlog();
  Math.abs(b2 - b0) < 0.001
    ? ok(`⑤ 冲回生效:未交量恢复 ${b2}(=基线 ${b0})`)
    : bad(`⑤ 冲回异常: ${b2} ≠ 基线 ${b0}`);

  console.log('清理 SQL:删 wo_report/yj_doc_status(WO_REPORT,' + BG + ') + wo_progress(单据编号=' + mo + ') + MO链 + bs_line_open');
  console.log(process.exitCode ? '=== 存在失败项 ===' : '=== 报工扣减链路探针全部通过 ===');
})();
