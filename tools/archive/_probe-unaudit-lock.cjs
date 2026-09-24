/**
 * 探针:已排产加工单弃审锁定(2026-09-23)
 * ① 已审核+已排产 → 弃审被拒(提示先撤销排产)
 * ② 撤销排产后 → 弃审成功(回草稿)
 * ③ 未排产已审核单 → 弃审不受影响(回归)
 * 前置:由 ZXL-20260916-02#7212 转工单+审核+排产 生成样本;痕迹外部 SQL 清理。
 */
const API = (process.argv[2] || 'http://127.0.0.1:8090') + '/api';
const SO = 'ZXL-20260916-02';
const LINE = '组装线';
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

  // 前置:两张样本 A(排产后弃审锁定) B(不排产直接弃审=回归)
  let r = await api('/px/orderConvert/toManu', { rows: [{ 订单号: SO, 行id: 7212, 生单数量: 10 }, { 订单号: SO, 行id: 7210, 生单数量: 5 }] }, token);
  const [a, b] = r.json?.data?.['编号清单'] || [];
  if (!a || !b) { bad('前置转工单失败: ' + r.text.slice(0, 300)); return; }
  console.log('MARK_MO ' + a + ',' + b);
  for (const no of [a, b]) {
    r = await api('/px/callButton', { panelCode: 'MANU_ORDER', buttonName: '审核', formData: { 编号: no }, buttonParam: {} }, token);
    if (r.status !== 200) { bad('前置审核失败 ' + no + ': ' + r.text.slice(0, 200)); return; }
  }
  r = await api('/px/scheduleBoard/assign', { rows: [{ 加工单号: a, 生产线: LINE, 预开工日: '2026-09-24', 预完工日: '2026-09-30' }] }, token);
  r.json?.data?.['排产张数'] === 1 ? ok('前置:样本A ' + a + ' 已排产(' + LINE + ')') : bad('前置排产失败: ' + r.text.slice(0, 300));

  // ① 已排产 → 弃审被拒
  r = await api('/px/callButton', { panelCode: 'MANU_ORDER', buttonName: '弃审', formData: { 编号: a }, buttonParam: {} }, token);
  /已排产.*不能弃审|不能弃审.*撤销排产/.test(r.text)
    ? ok('① 已排产单弃审被拒:' + (r.json?.message || '').slice(0, 60) + '…')
    : bad('① 未拦截: ' + r.text.slice(0, 300));

  // ② 撤销排产 → 弃审成功
  r = await api('/px/scheduleBoard/unassign', { rows: [{ 加工单号: a }] }, token);
  r.json?.data?.['撤销张数'] === 1 ? ok('② 撤销排产回池') : bad('② 撤销失败: ' + r.text.slice(0, 300));
  r = await api('/px/callButton', { panelCode: 'MANU_ORDER', buttonName: '弃审', formData: { 编号: a }, buttonParam: {} }, token);
  r.status === 200 ? ok('② 撤销排产后弃审成功(回草稿)') : bad('② 弃审仍失败: ' + r.text.slice(0, 300));

  // ③ 未排产已审核单 → 弃审不受影响
  r = await api('/px/callButton', { panelCode: 'MANU_ORDER', buttonName: '弃审', formData: { 编号: b }, buttonParam: {} }, token);
  r.status === 200 ? ok('③ 未排产单弃审不受影响(回归)') : bad('③ 回归失败: ' + r.text.slice(0, 300));

  console.log(process.exitCode ? '=== 存在失败项 ===' : '=== 弃审锁定探针全部通过 ===');
})();
