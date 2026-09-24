/**
 * 探针:排产工作台·线班骨架(参考工单排产页范式,2026-09-23)
 * ① 线班骨架:8线×2班=16行,开线默认否 ② 开线切换 ③ 排入选中线+班 ④ 该线班明细命中 ⑤ 批量调线 ⑥ 撤销回池
 * 前置:ZXL-20260916-02#7212 转工单+审核;痕迹外部 SQL 清理。
 */
const API = (process.argv[2] || 'http://127.0.0.1:8090') + '/api';
const SO = 'ZXL-20260916-02';
const LINE = '成型4线';   // 当前唯一启用且空闲的线(成型1/2/3/切炭/组装/装箱 被用户在界面停用)
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

  // 前置:样本(已审核·产线空)
  let r = await api('/px/orderConvert/toManu', { rows: [{ 订单号: SO, 行id: 7212, 生单数量: 1030 }] }, token);
  const mo = r.json?.data?.['编号清单']?.[0];
  if (!mo) { bad('前置转工单失败: ' + r.text.slice(0, 300)); return; }
  console.log('MARK_MO ' + mo);
  r = await api('/px/callButton', { panelCode: 'MANU_ORDER', buttonName: '审核', formData: { 编号: mo }, buttonParam: {} }, token);
  r.status === 200 ? ok('前置:样本 ' + mo + ' 已审核') : bad('前置审核失败: ' + r.text.slice(0, 300));

  // ① 线班骨架:16 行(8线×白/夜),开线默认否,未交量字段齐全
  r = await api('/px/scheduleBoard/linesSummary', { 开工日期: today }, token);
  const sum = r.json?.data || [];
  const enabledLines = new Set(sum.map((x) => x['生产线'])).size;
  sum.length === enabledLines * 2 && sum.every((x) => '未交量' in x && '开线' in x)
    ? ok(`① 线班骨架 ${sum.length} 行(${enabledLines} 条启用线 × 白班/夜班)`)
    : bad('① 骨架行数异常: ' + sum.length);
  const l1 = sum.find((x) => x['生产线'] === LINE && x['班别'] === '白班');
  l1 && l1['开线'] === false && '未交量' in l1 ? ok('① ' + LINE + '/白班 未交量=' + l1['未交量'] + ' 开线=否(默认)') : bad('① 成型1线行异常');

  // ② 开线切换
  r = await api('/px/scheduleBoard/setOpen', { 开工日期: today, 生产线: LINE, 班别: '白班', 开线: '是' }, token);
  r.json?.data?.['开线'] === '是' ? ok('② 开线切换成功(成型1线/白班=是)') : bad('② 开线切换失败: ' + r.text.slice(0, 200));
  r = await api('/px/scheduleBoard/linesSummary', { 开工日期: today }, token);
  (r.json?.data || []).find((x) => x['生产线'] === LINE && x['班别'] === '白班')?.['开线'] === true
    ? ok('② 骨架回读 开线=是') : bad('② 骨架回读未反映开线');

  // ③ 排入选中线+班(白班)
  r = await api('/px/scheduleBoard/assign', { rows: [{ 加工单号: mo, 生产线: LINE, 排产班组: '白班', 排产数量: 1030 }] }, token);
  r.json?.data?.['排产张数'] === 1 ? ok(`③ 排入 ${LINE}/白班 1030`) : bad('③ 排入失败: ' + r.text.slice(0, 300));

  // ④ 该线班明细命中(未完工筛选);切夜班 → 空
  r = await api('/px/scheduleBoard/scheduled', { 生产线: LINE, 班别: '白班', scope: '未完工' }, token);
  const hit = (r.json?.data || []).find((x) => x['加工单号'] === mo);
  hit && Number(hit['排产数量']) === 1030
    ? ok(`④ 该线班明细命中:排产=${hit['排产数量']} 排产日期=${hit['排产日期']}`)
    : bad('④ 明细未命中: ' + r.text.slice(0, 200));
  r = await api('/px/scheduleBoard/scheduled', { 生产线: LINE, 班别: '夜班', scope: '全部' }, token);
  (r.json?.data || []).length === 0 ? ok('④ 线班隔离正确:夜班不含白班的单') : bad('④ 线班隔离失效');

  // ⑤ 批量调线:成型1线/白班 → 切炭线/夜班
  r = await api('/px/scheduleBoard/reassign', { rows: [{ 加工单号: mo }], 目标生产线: '切炭线', 班别: '夜班' }, token);
  r.json?.data?.['调线张数'] === 1 ? ok('⑤ 批量调线 → 切炭线/夜班') : bad('⑤ 调线失败: ' + r.text.slice(0, 300));
  r = await api('/px/scheduleBoard/scheduled', { 生产线: '切炭线', 班别: '夜班', scope: '全部' }, token);
  (r.json?.data || []).some((x) => x['加工单号'] === mo) ? ok('⑤ 调线后明细落在新线班') : bad('⑤ 调线后明细未跟随');

  // ⑥ 撤销回池
  r = await api('/px/scheduleBoard/unassign', { rows: [{ 加工单号: mo }] }, token);
  r.json?.data?.['撤销张数'] === 1 ? ok('⑥ 撤销回池') : bad('⑥ 撤销失败: ' + r.text.slice(0, 300));

  console.log(process.exitCode ? '=== 存在失败项 ===' : '=== 线班骨架探针全部通过 ===');
})();
