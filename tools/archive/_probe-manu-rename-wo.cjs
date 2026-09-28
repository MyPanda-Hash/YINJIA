/**
 * 探针:生产加工单 → 生产工单 改名 + 列表字段对齐(2026-09-24)
 * ①面板名=生产工单(明细/统计表同步);②列表列=用户清单 16 列且顺序一致;③SO_ORDER 按钮「生成生产工单」亮且
 * 旧名「生成生产加工单」已消亡;④老 WO_ORDER 已让位「生产工单(旧版)」;⑤生单链路(生成生产工单)可用——建单后清理。
 */
const API = (process.argv[2] || 'http://127.0.0.1:8090') + '/api';
const SO = 'ZXL-20260916-02';
const ok = (m) => console.log('OK ' + m);
const bad = (m) => { console.log('FAIL ' + m); process.exitCode = 1; };
async function api(path, body, token) {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}
async function get(path, token) {
  const res = await fetch(API + path, { headers: { Authorization: 'Bearer ' + token } });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}
const WANT = ['合同号', '单据日期', '销售订单号', '客户编码', '生产线', '需求数量', '排产数量', '入库数量',
  '余量', '预开工日', '预完工日', '完工日期', '结案', '领料单号', '备注', '创建时间'];
(async () => {
  const token = (await api('/auth/login', { userName: 'admin', password: '123456' })).json?.data?.token;
  if (!token) { bad('登录失败'); return; }
  ok('登录成功');
  let r = await get('/px/getPanelConfig?panelCode=MANU_ORDER', token);
  const cfg = r.json?.data || {};
  const meta = cfg.metadata || cfg;
  meta.panelName === '生产工单' || cfg.panelName === '生产工单'
    ? ok('① 面板名=生产工单')
    : bad('① 面板名异常: ' + JSON.stringify(meta.panelName || cfg.panelName));
  // 列表列 = metadata.panelPageDto.tablePages[0].queryFields(按 seq 顺序)
  const page0 = (meta.panelPageDto?.tablePages || [])[0] || {};
  const uniq = (page0.queryFields || []).map((c) => c.label || c.dataName);
  const missing = WANT.filter((w) => !uniq.includes(w));
  const orderOk = JSON.stringify(uniq.filter((l) => WANT.includes(l))) === JSON.stringify(WANT);
  missing.length === 0 && orderOk
    ? ok('② 列表列 16 列且顺序一致: ' + uniq.join('|'))
    : bad('② 列不符(缺=' + missing.join(',') + ' 顺序OK=' + orderOk + '): ' + uniq.join('|'));
  r = await get('/px/getPanelConfig?panelCode=MANU_ORDER_DETAIL', token);
  (r.json?.data?.metadata?.panelName === '生产工单明细表')
    ? ok('① 家族面板:生产工单明细表') : bad('① 明细表名异常: ' + r.json?.data?.metadata?.panelName);
  r = await get('/px/getPanelConfig?panelCode=WO_ORDER', token);
  (r.json?.data?.metadata?.panelName === '生产工单(旧版)')
    ? ok('④ 老面板已让位:生产工单(旧版)') : bad('④ 老面板名异常: ' + r.json?.data?.metadata?.panelName);
  // ③ 按钮:SO_ORDER 生单组
  r = await get('/px/getPanelConfig?panelCode=SO_ORDER', token);
  const s = JSON.stringify(r.json?.data || {});
  (s.includes('生成生产工单') && !s.includes('生成生产加工单'))
    ? ok('③ SO_ORDER 按钮=生成生产工单(旧名已消亡)') : bad('③ 按钮名异常');
  // ⑤ 生单链路可用(生成生产工单 → 拿编号 → 删除草稿回收占用)
  r = await api('/px/callButton', { panelCode: 'SO_ORDER', buttonName: '生成生产工单', formData: { 编号: SO }, buttonParam: {} }, token);
  const mo = r.json?.data?.['编号清单']?.[0] || r.json?.data?.['编号'];
  mo ? ok('⑤ 生单链路通:生成 ' + mo + '(旧按钮名应失败)') : bad('⑤ 生单失败: ' + (r.text || '').slice(0, 200));
  if (mo) {
    const del = await api('/px/deleteForms', { panelCode: 'MANU_ORDER', rowCodes: [mo] }, token);
    ok('⑤ 清理草稿:' + (del.status === 200 ? ' 已删除 ' + mo : ' 需手工清理 ' + mo));
  }
  const oldBtn = await api('/px/callButton', { panelCode: 'SO_ORDER', buttonName: '生成生产加工单', formData: { 编号: SO }, buttonParam: {} }, token);
  (oldBtn.status !== 200 || /未|不存在|不支持/.test(oldBtn.text || ''))
    ? ok('③ 旧按钮名调用已被拒(status=' + oldBtn.status + ')')
    : bad('③ 旧按钮名仍可用: ' + (oldBtn.text || '').slice(0, 150));
  console.log(process.exitCode ? '=== 存在失败项 ===' : '=== 生产工单改名+字段探针全部通过 ===');
})();
