/**
 * 探针:订单结转·交期可编辑(2026-09-23)——同步交期与创建日期雷同的修正闭环:
 * ① 行内改交期 → saveDates 回写订单行(pending 回读为新交期)
 * ② 转工单携带修正交期 → 加工单.预完工日 = 修正交期
 * ③ 转采购单携带修正交期 → PU_REQ.需求日期 = 修正交期
 * 痕迹由外部 SQL 清理(加工单/采购申请/占用/消息 + 订单行交期还原 2026-09-16)。
 */
const API = (process.argv[2] || 'http://127.0.0.1:8090') + '/api';
const SO = 'ZXL-20260916-02';
const NEW_DUE = '2026-10-08';
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

  // ① saveDates:修正 7210/7211 交期 → pending 回读
  let r = await api('/px/orderConvert/saveDates', {
    rows: [{ 订单号: SO, 行id: 7210, 交货日期: NEW_DUE }, { 订单号: SO, 行id: 7211, 交货日期: NEW_DUE }],
  }, token);
  r.json?.data?.['更新行数'] === 2 ? ok('① 保存交期 2 行回写订单行') : bad('① saveDates 失败: ' + r.text.slice(0, 300));
  r = await api('/px/orderConvert/pending', { keyword: SO }, token);
  const rows = r.json?.data || [];
  rows.filter((x) => ['7210', '7211'].includes(String(x['行id']))).every((x) => x['交货日期'] === NEW_DUE)
    ? ok('① pending 回读:7210/7211 交货日期=' + NEW_DUE)
    : bad('① 回读不符: ' + JSON.stringify(rows.map((x) => [x['行id'], x['交货日期']])));

  // ② 转工单(携带修正交期) → 加工单.预完工日
  r = await api('/px/orderConvert/toManu', { rows: [{ 订单号: SO, 行id: 7212, 生单数量: 100, 交货日期: NEW_DUE }] }, token);
  const mo = r.json?.data?.['编号清单']?.[0];
  if (!mo) { bad('② 转工单失败: ' + r.text.slice(0, 300)); }
  else {
    console.log('MARK_MO ' + mo);
    const q = await api('/px/queryFormDataList', { panelCode: 'MANU_ORDER', page: 1, pageSize: 20, keyword: mo }, token);
    const doc = (q.json?.data?.list || []).find((d) => (d['编号'] || d['合同号'] || d['detail']?.items?.[0]?.合同号) === mo) || (q.json?.data?.list || [])[0];
    const due = doc?.['预完工日'] || doc?.['detail']?.items?.[0]?.预完工日;
    String(due || '').slice(0, 10) === NEW_DUE
      ? ok('② 加工单 ' + mo + ' 预完工日=' + NEW_DUE + '(修正交期贯穿)')
      : bad('② 预完工日不符: ' + JSON.stringify(doc).slice(0, 200));
  }

  // ③ 转采购单(行已保存新交期) → PU_REQ.需求日期
  r = await api('/px/orderConvert/toPurchase', { rows: [{ 订单号: SO, 行id: 7211, 生单数量: 50 }] }, token);
  const pr = r.json?.data?.['编号清单']?.[0];
  if (!pr) { bad('③ 转采购单失败: ' + r.text.slice(0, 300)); }
  else {
    console.log('MARK_PR ' + pr);
    const q = await api('/px/queryFormDataList', { panelCode: 'PU_REQ', page: 1, pageSize: 20, keyword: pr }, token);
    const doc = (q.json?.data?.list || [])[0];
    const due = doc?.['需求日期'];
    String(due || '').slice(0, 10) === NEW_DUE
      ? ok('③ 采购申请 ' + pr + ' 需求日期=' + NEW_DUE + '(读修正后行交期)')
      : bad('③ 需求日期不符: ' + JSON.stringify(doc).slice(0, 200));
  }

  console.log(process.exitCode ? '=== 存在失败项 ===' : '=== 交期可编辑探针全部通过 ===');
})();
