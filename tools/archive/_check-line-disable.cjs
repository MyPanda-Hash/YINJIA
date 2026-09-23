/**
 * 验证:生产线「停用」布尔开关化(2026-09-23)
 * ① PROD_LINE 停用字段 data_type=是否(布尔开关渲染,同 启用派工)
 * ② 排产工作台 产线下拉不含已停用线(v_line_load 过滤)
 * ③ 后端兜底:向已停用线排入被拒(档案外产线不拦,兼容历史)
 * 前置(外部 SQL):成型2线 已置 停用=1
 */
const API = (process.argv[2] || 'http://127.0.0.1:8090') + '/api';
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

  const cfg = await (await fetch(API + '/px/getPanelConfig?panelCode=PROD_LINE', { headers: { Authorization: 'Bearer ' + token } })).json();
  const s = JSON.stringify(cfg);
  s.includes('"是否"') && s.includes('停用')
    ? ok('① PROD_LINE 停用 = 布尔开关(data_type 是否,同 启用派工 等 bit 字段)')
    : bad('① 停用字段类型异常: ' + s.slice(0, 200));

  const st = (await api('/px/scheduleBoard/stats', {}, token)).json?.data || {};
  const lines = st['产线'] || [];
  !lines.some((l) => l['生产线'] === '成型2线') && lines.some((l) => l['生产线'] === '成型1线')
    ? ok('② 排产台下拉不含已停用的 成型2线(共 ' + lines.length + ' 条,成型1线等正常)')
    : bad('② 下拉过滤失效: ' + lines.map((l) => l['生产线']).join(','));

  // ③ 用不存在的单号验证停用拦截(停用校验先于单据校验,无数据副作用)
  const r = await api('/px/scheduleBoard/assign', { rows: [{ 加工单号: 'PROBE-NONE', 生产线: '成型2线' }] }, token);
  /已停用/.test(r.text)
    ? ok('③ 向已停用线排入被后端拒绝(提示去 基础资料→生产线 启用)')
    : bad('③ 未拦截: ' + r.text.slice(0, 200));

  console.log(process.exitCode ? '=== 存在失败项 ===' : '=== 停用开关验证全部通过 ===');
})();
