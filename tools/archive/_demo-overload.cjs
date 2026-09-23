/**
 * 演示:产线超负荷的呈现形式(2026-09-23)——排 500 到 日产能100 的线,三个触点全展示。
 * 样本由 ZXL-20260916-02#7212 生成(探针自建),痕迹外部 SQL 清理,日产能还原 0。
 */
const API = (process.argv[2] || 'http://127.0.0.1:8090') + '/api';
const ok = (m) => console.log(m);

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
  // 样本:转工单 500 → 审核 → 全部排入成型1线,开工=完工=今天(负荷全落当日)
  let r = await api('/px/orderConvert/toManu', { rows: [{ 订单号: 'ZXL-20260916-02', 行id: 7212, 生单数量: 500 }] }, token);
  const mo = r.json?.data?.['编号清单']?.[0];
  console.log('MARK_MO ' + mo);
  await api('/px/callButton', { panelCode: 'MANU_ORDER', buttonName: '审核', formData: { 编号: mo }, buttonParam: {} }, token);
  const today = new Date().toISOString().slice(0, 10);
  r = await api('/px/scheduleBoard/assign', { rows: [{ 加工单号: mo, 生产线: '成型1线', 预开工日: today, 预完工日: today }] }, token);
  console.log('【形式2·排入回执】' + JSON.stringify((r.json?.data || {})['产线回执'] || []));
  // 形式1:下拉源(stats.产线)
  const st = (await api('/px/scheduleBoard/stats', {}, token)).json?.data || {};
  const l = (st['产线'] || []).find((x) => x['生产线'] === '成型1线');
  console.log('【形式1·产线下拉】成型1线 · 今日负荷 ' + l['今日负荷'] + ' / 日产能 ' + l['日产能']);
  // 形式3:负荷面板
  const q = await api('/px/queryFormDataList', { panelCode: 'LINE_LOAD', page: 1, pageSize: 20 }, token);
  const rows = (q.json?.data?.rows || q.json?.data?.list?.[0]?.detail?.items || []);
  const row = rows.find((x) => x['生产线'] === '成型1线');
  console.log('【形式3·产线排产负荷面板】' + JSON.stringify({ 生产线: row['生产线'], 日产能: row['日产能'], 今日负荷: row['今日负荷'], D1: row['D1'], 合计负荷: row['合计负荷'] }));
})();
