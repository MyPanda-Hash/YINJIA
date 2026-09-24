/**
 * 探针:排产工作台(实现总结 V1.0 §5 验证清单 ①-⑦)——2026-09-23
 * 前置:从 ZXL-20260916-02#7212(T305 1030,剩余足)转工单→审核,得到池内样本;
 * 痕迹由外部 SQL 清理(加工单/占用/状态/日志 + 表单只读与按钮下线由 SQL 断言)。
 */
const API = (process.argv[2] || 'http://127.0.0.1:8090') + '/api';
const SO = 'ZXL-20260916-02';
const LINE = '成型1线';
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

  // 前置:转工单 + 审核 → 得到"已审核·未指派产线"样本
  let r = await api('/px/orderConvert/toManu', { rows: [{ 订单号: SO, 行id: 7212, 生单数量: 1030 }] }, token);
  const mo = r.json?.data?.['编号清单']?.[0];
  if (!mo) { bad('前置转工单失败: ' + r.text.slice(0, 300)); return; }
  console.log('MARK_MO ' + mo);
  r = await api('/px/callButton', { panelCode: 'MANU_ORDER', buttonName: '审核', formData: { 编号: mo }, buttonParam: {} }, token);
  r.status === 200 ? ok('前置:样本 ' + mo + ' 已审核') : bad('前置审核失败: ' + r.text.slice(0, 300));

  // ① 池=已审核·未指派产线(草稿/已排/作废/中止/结案不出现)
  r = await api('/px/scheduleBoard/pending', { keyword: '' }, token);
  const pool = r.json?.data || [];
  const inPool = pool.find((x) => x['加工单号'] === mo);
  const drafts = pool.filter((x) => ['MO-2026-09-0030', 'MO-2026-09-0036', 'MO-2026-09-0040'].includes(x['加工单号']));
  const scheduled = pool.find((x) => x['加工单号'] === 'MO-2026-09-0001');
  inPool ? ok('① 已审核·产线空 样本在池中(混料批次号=' + inPool['混料批次号'] + ' 重点管控=' + inPool['重点管控'] + ')') : bad('① 样本不在池中');
  drafts.length === 0 ? ok('① 草稿单不进池(' + 'MO-0030/0036/0040 排除)') : bad('① 草稿出现在池中: ' + drafts.map((d) => d['加工单号']).join(','));
  !scheduled ? ok('① 已排产单(用户 MO-0001)不在池中') : bad('① 已排产单仍在池中');

  // stats:产线/班组下拉源 + 三项统计
  r = await api('/px/scheduleBoard/stats', {}, token);
  const st = r.json?.data || {};
  const l1 = (st['产线'] || []).find((l) => l['生产线'] === LINE);
  l1 ? ok(`② 统计:待排产=${st['待排产笔数']} 今日排产=${st['今日排产']?.张数}张/${st['今日排产']?.数量}件 总未完成=${st['总未完成量']};产线下拉 ${ (st['产线'] || []).length } 条(含${LINE} 日产能=${l1['日产能']});班组 ${ (st['班组'] || []).length } 个`) : bad('② 产线下拉缺 ' + LINE + ': ' + JSON.stringify(st).slice(0, 200));

  // ③ 部分排 + 超生单量拒绝
  r = await api('/px/scheduleBoard/assign', { rows: [{ 加工单号: mo, 行id: inPool['行id'], 生产线: LINE, 排产数量: 99999, 预开工日: '2026-09-24', 预完工日: '2026-09-30' }] }, token);
  /超过本单生单量/.test(r.text) ? ok('③ 超生单量排产被拒') : bad('③ 超限未拒: ' + r.text.slice(0, 200));
  r = await api('/px/scheduleBoard/assign', { rows: [{ 加工单号: mo, 生产线: LINE, 排产班组: '成型一班', 排产数量: 400, 预开工日: '2026-09-24', 预完工日: '2026-09-30' }] }, token);
  const d = r.json?.data || {};
  const rc = (d['产线回执'] || [])[0];
  d['排产张数'] === 1 && rc && rc['生产线'] === LINE
    ? ok(`③ 排入 ${LINE} 400:回执 今日负荷=${rc['今日负荷']} 日产能=${rc['日产能']} 提示=${rc['提示'] || '正常'}`)
    : bad('③ 排入失败: ' + r.text.slice(0, 300));

  // 池联动 + 占用守恒(剩余=1030−400=630)
  r = await api('/px/orderConvert/pending', { keyword: SO }, token);
  const row = (r.json?.data || []).find((x) => String(x['行id']) === '7212');
  Number(row?.['已排产数量']) === 400 && Number(row?.['剩余数量']) === 630
    ? ok('③ 数量守恒:订单行 已排产=400 剩余=630(占用随排产数量走)')
    : bad(`③ 守恒不符: 已排=${row?.['已排产数量']} 剩余=${row?.['剩余数量']}`);

  // ⑥ 今日已排产 + 回池
  r = await api('/px/scheduleBoard/today', { mode: 'today' }, token);
  const t = (r.json?.data || []).find((x) => x['加工单号'] === mo);
  t && t['生产线'] === LINE && Number(t['排产数量']) === 400 && t['排产班组'] === '成型一班'
    ? ok(`④ 今日已排产命中:线=${t['生产线']} 班组=${t['排产班组']} 量=${t['排产数量']} 箱数=${t['箱数']}`)
    : bad('④ 今日已排产未命中: ' + JSON.stringify(r.json?.data || []).slice(0, 200));
  r = await api('/px/scheduleBoard/unassign', { rows: [{ 加工单号: mo }] }, token);
  r.json?.data?.['撤销张数'] === 1 ? ok('⑤ 撤销排产回池(换线=撤销+重排)') : bad('⑤ 撤销失败: ' + r.text.slice(0, 300));
  r = await api('/px/scheduleBoard/pending', { keyword: mo }, token);
  (r.json?.data || []).some((x) => x['加工单号'] === mo) ? ok('⑤ 撤销后样本回到待排产池') : bad('⑤ 撤销后未回池');

  // 重排(全量=本单生单量) 供⑦断言后清理
  r = await api('/px/scheduleBoard/assign', { rows: [{ 加工单号: mo, 生产线: LINE, 预开工日: '2026-09-24', 预完工日: '2026-10-06' }] }, token);
  r.json?.data?.['排产张数'] === 1 ? ok('⑥ 重排(全量)成功 → 已排产列表') : bad('⑥ 重排失败: ' + r.text.slice(0, 200));

  console.log(process.exitCode ? '=== 存在失败项 ===' : '=== 排产工作台探针全部通过 ===');
})();
