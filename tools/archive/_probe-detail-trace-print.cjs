/**
 * 探针:工单排产看板·明细补列 + 取消结案/追溯/打印工单(2026-09-23,旧系统 ProSchedList 对齐)
 * ① 明细补列(结案/结案人/打印人/打印次数/规格型号…) ② printStamp 打印留痕 ③ 结案→结案戳
 * ④ trace 追溯(头/时间线/排产/完工/领料) ⑤ 取消结案→戳清空 ⑥ 撤销回池
 * 前置:ZXL-20260916-02 行可转工单;启用线动态取;痕迹外部 SQL 清理(见尾打印)。
 */
const API = (process.argv[2] || 'http://127.0.0.1:8090') + '/api';
const SO = 'ZXL-20260916-02';
const today = new Date().toISOString().slice(0, 10);
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

  // 前置:样本(已审核·产线空)→ 排到第一条启用线
  let r = await api('/px/scheduleBoard/linesSummary', { 开工日期: today }, token);
  const lines = [...new Set((r.json?.data || []).map((x) => x['生产线']))];
  if (!lines.length) { bad('无启用产线'); return; }
  const LINE = lines[0];
  r = await api('/px/orderConvert/toManu', { rows: [{ 订单号: SO, 行id: 7212 }] }, token);
  const mo = r.json?.data?.['编号清单']?.[0];
  if (!mo) { bad('前置转工单失败: ' + r.text.slice(0, 200)); return; }
  console.log('MARK_MO ' + mo);
  r = await api('/px/callButton', { panelCode: 'MANU_ORDER', buttonName: '审核', formData: { 编号: mo }, buttonParam: {} }, token);
  r.status === 200 ? ok('前置:样本 ' + mo + ' 已审核') : bad('前置审核失败: ' + r.text.slice(0, 200));
  r = await api('/px/scheduleBoard/assign', { rows: [{ 加工单号: mo, 生产线: LINE }] }, token);
  r.json?.data?.['排产张数'] === 1 ? ok('前置:排入 ' + LINE) : bad('前置排入失败: ' + r.text.slice(0, 200));

  // ① 明细补列
  r = await api('/px/scheduleBoard/scheduled', { 生产线: LINE, scope: '全部' }, token);
  const row = (r.json?.data || []).find((x) => x['加工单号'] === mo);
  const needCols = ['规格型号', '单位', '批号', '重点管控', '操作员', '备注', '领料单号', '入库单号',
    '结案', '结案人', '结案时间', '打印人', '打印时间', '打印次数', '实际完工日期', '每箱数量', '箱数'];
  row && needCols.every((k) => k in row)
    ? ok('① 明细补列齐全(' + needCols.length + ' 列)')
    : bad('① 明细缺列: ' + (row ? needCols.filter((k) => !(k in row)).join(',') : '行未命中'));

  // ② 打印留痕
  r = await api('/px/scheduleBoard/printStamp', { rows: [{ 加工单号: mo }] }, token);
  r.json?.data?.['打印张数'] === 1 ? ok('② printStamp 留痕成功') : bad('② printStamp 失败: ' + r.text.slice(0, 200));
  r = await api('/px/scheduleBoard/scheduled', { 生产线: LINE, scope: '全部' }, token);
  const pr = (r.json?.data || []).find((x) => x['加工单号'] === mo);
  Number(pr?.['打印次数']) === 1 && pr?.['打印人'] === 'admin' && pr?.['打印时间']
    ? ok('② 打印次数=1 打印人=admin 打印时间=' + pr['打印时间'])
    : bad('② 打印戳未落库: ' + JSON.stringify(pr && { c: pr['打印次数'], u: pr['打印人'] }));

  // ③ 结案 → 结案戳
  r = await api('/px/callButton', { panelCode: 'MANU_ORDER', buttonName: '结案', formData: { 编号: mo }, buttonParam: {} }, token);
  r.status === 200 ? ok('③ 结案成功') : bad('③ 结案失败: ' + r.text.slice(0, 200));
  r = await api('/px/scheduleBoard/scheduled', { 生产线: LINE, scope: '全部' }, token);
  const cr = (r.json?.data || []).find((x) => x['加工单号'] === mo);
  cr?.['结案'] === 'Y' && cr?.['结案人'] === 'admin' && cr?.['结案时间']
    ? ok('③ 结案戳:结案人=admin 结案时间=' + cr['结案时间'])
    : bad('③ 结案戳未落库');

  // ④ 追溯
  r = await api('/px/scheduleBoard/trace', { 工单号: mo }, token);
  const t = r.json?.data || {};
  t['头']?.['加工单号'] === mo && (t['时间线'] || []).length >= 2
    && (t['排产数据'] || []).length >= 1 && Array.isArray(t['领料数据']) && Array.isArray(t['完工数据'])
    ? ok(`④ 追溯:状态=${t['头']?.['单据状态']} 时间线=${t['时间线'].length} 条(${t['时间线'].map((x) => x['步骤']).join('→')}) 排产数据 ${(t['排产数据']).length} 行`)
    : bad('④ 追溯数据异常: ' + r.text.slice(0, 200));

  // ⑤ 取消结案 → 戳清空、回到已审核
  r = await api('/px/callButton', { panelCode: 'MANU_ORDER', buttonName: '取消结案', formData: { 编号: mo }, buttonParam: {} }, token);
  r.status === 200 ? ok('⑤ 取消结案成功') : bad('⑤ 取消结案失败: ' + r.text.slice(0, 200));
  r = await api('/px/scheduleBoard/scheduled', { 生产线: LINE, scope: '全部' }, token);
  const ur = (r.json?.data || []).find((x) => x['加工单号'] === mo);
  ur?.['结案'] !== 'Y' && !ur?.['结案人'] && !ur?.['结案时间']
    ? ok('⑤ 取消后结案/结案人/结案时间已清空')
    : bad('⑤ 取消后戳未清: ' + JSON.stringify(ur && { j: ur['结案'], u: ur['结案人'] }));

  // ⑥ 撤销回池(清理前置)
  r = await api('/px/scheduleBoard/unassign', { rows: [{ 加工单号: mo }] }, token);
  r.json?.data?.['撤销张数'] === 1 ? ok('⑥ 撤销回池') : bad('⑥ 撤销失败: ' + r.text.slice(0, 200));

  console.log('清理 SQL:按 MARK_MO 删 bd/bl_manu_order+yj_doc_status+form_flow_link+yj_usage_log');
  console.log(process.exitCode ? '=== 存在失败项 ===' : '=== 明细补列+取消结案/追溯/打印 探针全部通过 ===');
})();
