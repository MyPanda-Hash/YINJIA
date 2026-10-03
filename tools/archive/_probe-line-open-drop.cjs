/** 探针:开线下线验证(2026-09-24) — linesSummary 无开线字段/骨架行数=档案全部线/setOpen 端点已消亡 */
const API = (process.argv[2] || 'http://127.0.0.1:8090') + '/api';
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
(async () => {
  const token = (await api('/auth/login', { userName: 'admin', password: '123456' })).json?.data?.token;
  if (!token) { bad('登录失败'); return; }
  ok('登录成功');
  const today = new Date().toISOString().slice(0, 10);
  let r = await api('/px/scheduleBoard/linesSummary', { 开工日期: today }, token);
  const rows = r.json?.data || [];
  rows.length && rows.every((x) => !('开线' in x)) && rows.every((x) => '未交量' in x && '停用' in x)
    ? ok(`① 骨架 ${rows.length} 行,无开线字段(未交量/停用齐全)`)
    : bad('① 骨架异常: ' + JSON.stringify(rows[0] || {}).slice(0, 200));
  r = await api('/px/scheduleBoard/setOpen', { 开工日期: today, 生产线: '成型1线', 开线: '是' }, token);
  r.status === 404 || /setOpen/.test(r.text || '')
    ? ok('② setOpen 端点已下线(status=' + r.status + ')')
    : bad('② setOpen 仍存活: ' + r.status + ' ' + (r.text || '').slice(0, 120));
  console.log(process.exitCode ? '=== 存在失败项 ===' : '=== 开线下线探针全部通过 ===');
})();
