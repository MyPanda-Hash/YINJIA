/**
 * 探针:工单排产看板(WorkOrderBoard,2026-09-23 去班别版)+排产工作台 接口全链
 * ① 骨架=生产线档案**全部线**(含停用,无班别;与基础资料对应) ② 开线切换(启用线)+回读 ③ 排产台 assign(排入启用线)
 * ④ 看板明细命中(无班别参数) ⑤ 批量调线(启用线目标) ⑤b 调线到停用线被拒(守卫) ⑥ 撤销回池(pending 回现)
 * 前置:ZXL-20260916-02#7212 可转工单。痕迹:外部 SQL 清理(见探针尾部打印)。
 */
const API = (process.argv[2] || 'http://127.0.0.1:8090') + '/api';
const SO = 'LZW-20260917-02';
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

  // ① 骨架:全部档案线(停用与否随用户当前档案状态),每线一行,无班别字段,带停用标志
  let r = await api('/px/scheduleBoard/linesSummary', { 开工日期: today }, token);
  const sum = r.json?.data || [];
  const noShift = sum.every((x) => !('班别' in x));
  sum.length >= 1 && noShift && sum.every((x) => '未交量' in x && '开线' in x && '停用' in x)
    ? ok(`① 骨架 ${sum.length} 行=档案全部线(其中停用 ${sum.filter((x) => x['停用']).length} 条),无班别字段`)
    : bad(`① 骨架异常: ${sum.length} 行,无班别=${noShift}`);
  const L1 = (sum.find((x) => !x['停用']) || sum[0])?.['生产线'];
  const L2 = (sum.filter((x) => !x['停用']).map((x) => x['生产线']).find((x) => x !== L1)) || L1;
  const OFF = (sum.find((x) => x['停用']) || {})['生产线'];
  if (!L1) { bad('① 无产线,无法继续'); return; }
  if (!sum.some((x) => !x['停用'])) { console.log('⏭ 当前档案全部产线已停用,排入/调线流程跳过(守卫类断言 ⑤b 已在启用线场景验证);如需全链回归请在 基础资料→生产线 启用至少一条'); return; }

  // ①b 停用线不进排产工作台产线下拉(stats.产线=v_line_load=启用档案线;2026-09-23 视图修复)
  r = await api('/px/scheduleBoard/stats', {}, token);
  const dropLines = (r.json?.data?.['产线'] || []).map((x) => x['生产线']);
  const offLines = sum.filter((x) => x['停用']).map((x) => x['生产线']);
  offLines.every((ln) => !dropLines.includes(ln)) && (dropLines.length >= 1 || offLines.length === sum.length)
    ? ok(`①b 排产工作台产线下拉 ${dropLines.length} 条,无停用线泄漏(全停用=空下拉属正常)${offLines.length ? '(停用:' + offLines.join('/') + ')' : '(当前档案无停用线)'}`)
    : bad('①b 停用线泄漏进排产工作台下拉: ' + offLines.filter((ln) => dropLines.includes(ln)).join('/'));

  // 前置:样本(已审核·产线空;订单须已审核——若报草稿属环境状态,外部 SQL 恢复 shr 后重跑)
  r = await api('/px/orderConvert/toManu', { rows: [{ 订单号: SO, 行id: 7208 }] }, token);
  const mo = r.json?.data?.['编号清单']?.[0];
  if (!mo) { bad('前置转工单失败: ' + r.text.slice(0, 300)); return; }
  console.log('MARK_MO ' + mo);
  r = await api('/px/callButton', { panelCode: 'MANU_ORDER', buttonName: '审核', formData: { 编号: mo }, buttonParam: {} }, token);
  r.status === 200 ? ok('前置:样本 ' + mo + ' 已审核') : bad('前置审核失败: ' + r.text.slice(0, 300));

  // ③a 排产台池回现
  r = await api('/px/scheduleBoard/pending', { keyword: mo }, token);
  (r.json?.data || []).some((x) => x['加工单号'] === mo) ? ok('③a 排产台待排池命中样本') : bad('③a 待排池未回现样本');

  // ② 开线切换(L1)+骨架回读
  r = await api('/px/scheduleBoard/setOpen', { 开工日期: today, 生产线: L1, 开线: '是' }, token);
  r.json?.data?.['开线'] === '是' && !('班别' in (r.json?.data || {}))
    ? ok(`② 开线切换成功(${L1}=是,无班别回执)`) : bad('② 开线切换失败: ' + r.text.slice(0, 200));
  r = await api('/px/scheduleBoard/linesSummary', { 开工日期: today }, token);
  (r.json?.data || []).find((x) => x['生产线'] === L1)?.['开线'] === true
    ? ok('② 骨架回读 开线=是') : bad('② 骨架回读未反映开线');

  // ②b 停用线开线被拒(后端守卫,2026-09-23 补;当前档案无停用线则跳过)
  if (OFF) {
    r = await api('/px/scheduleBoard/setOpen', { 开工日期: today, 生产线: OFF, 开线: '是' }, token);
    (r.json?.code === 400 || r.json?.code === 409) && /停用/.test(r.text || '')
      ? ok(`②b 停用线「${OFF}」开线被拒(守卫生效)`) : bad('②b 停用线开线守卫未拦截: ' + (r.text || '').slice(0, 200));
  } else {
    console.log('⏭ ②b 跳过(当前档案无停用线)');
  }

  // ③b 排产台 assign(排入启用线 L1)
  r = await api('/px/scheduleBoard/pending', { keyword: mo }, token);
  const prow = (r.json?.data || []).find((x) => x['加工单号'] === mo);
  const qty = Number(prow?.['排产数量']) || 0;
  r = await api('/px/scheduleBoard/assign', { rows: [{ 加工单号: mo, 生产线: L1, 排产数量: qty }] }, token);
  r.json?.data?.['排产张数'] === 1 ? ok(`③b 排产台排入 ${L1} ${qty}`) : bad('③b 排入失败: ' + r.text.slice(0, 300));

  // ④ 看板明细命中(只按线,无班别参数)
  r = await api('/px/scheduleBoard/scheduled', { 生产线: L1, scope: '未完工' }, token);
  const hit = (r.json?.data || []).find((x) => x['加工单号'] === mo);
  hit && Number(hit['排产数量']) === qty && !('班别' in hit)
    ? ok(`④ 看板明细命中:${L1} 排产=${hit['排产数量']} 状态=${hit['生产状态']}(无班别字段)`)
    : bad('④ 明细未命中: ' + r.text.slice(0, 200));

  // ⑤ 批量调线 L1 → L2
  r = await api('/px/scheduleBoard/reassign', { rows: [{ 加工单号: mo }], 目标生产线: L2 }, token);
  r.json?.data?.['调线张数'] === 1 && String(r.json?.data?.['目标']) === L2
    ? ok(`⑤ 批量调线 → ${L2}(目标回执无班别)`) : bad('⑤ 调线失败: ' + r.text.slice(0, 300));
  r = await api('/px/scheduleBoard/scheduled', { 生产线: L2, scope: '全部' }, token);
  (r.json?.data || []).some((x) => x['加工单号'] === mo) ? ok('⑤ 调线后明细落在新线') : bad('⑤ 调线后明细未跟随');

  // ⑤b 调线到停用线被拒(守卫)
  if (OFF) {
    r = await api('/px/scheduleBoard/reassign', { rows: [{ 加工单号: mo }], 目标生产线: OFF }, token);
    r.json?.code === 400 || /停用/.test(r.text)
      ? ok(`⑤b 调线到停用线「${OFF}」被拒(守卫生效)`) : bad('⑤b 停用线守卫未拦截: ' + r.text.slice(0, 200));
  } else {
    console.log('⏭ ⑤b 跳过(档案无停用线)');
  }

  // ⑥ 撤销回池(pending 回现)
  r = await api('/px/scheduleBoard/unassign', { rows: [{ 加工单号: mo }] }, token);
  r.json?.data?.['撤销张数'] === 1 ? ok('⑥ 撤销回池') : bad('⑥ 撤销失败: ' + r.text.slice(0, 300));
  r = await api('/px/scheduleBoard/pending', { keyword: mo }, token);
  (r.json?.data || []).some((x) => x['加工单号'] === mo) ? ok('⑥ 撤销后待排池回现') : bad('⑥ 撤销后未回池');

  console.log('清理 SQL:按 MARK_MO 删 bd/bl_manu_order+yj_doc_status+form_flow_link+yj_usage_log;bs_line_open 今日 ' + L1);
  console.log(process.exitCode ? '=== 存在失败项 ===' : '=== 工单排产(去班别·全线)探针全部通过 ===');
})();
