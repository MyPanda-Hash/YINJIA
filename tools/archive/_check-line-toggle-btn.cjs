/**
 * 验证:生产线停用——切换式按钮(2026-09-23 用户拍板改回切换模式)
 * ① toggle 翻转:停用→启用→停用 各返回翻转后状态
 * ② 停用态:排产台下拉不含该线、排入被拦;启用态:恢复可选
 * ③ 前端按钮分支在产物中(绿停用/红启用)
 * 痕迹:成型2线还原为启用。
 */
const API = (process.argv[2] || 'http://127.0.0.1:8090') + '/api';
const LINE = '成型2线';
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

  // ① 归一到停用态(toggle=翻转,初始态不定):最多点两次
  let r = await api('/px/prodLine/toggle', { 生产线: LINE }, token);
  if (r.json?.data?.['停用'] !== 1) r = await api('/px/prodLine/toggle', { 生产线: LINE }, token);
  r.json?.data?.['停用'] === 1 ? ok('① 切换→停用(' + LINE + ')') : bad('① 未能切到停用: ' + r.text.slice(0, 200));
  const st = (await api('/px/scheduleBoard/stats', {}, token)).json?.data || {};
  !(st['产线'] || []).some((l) => l['生产线'] === LINE)
    ? ok('① 停用态:排产台下拉不含 ' + LINE)
    : bad('① 停用线仍在下拉');
  r = await api('/px/scheduleBoard/assign', { rows: [{ 加工单号: 'PROBE-NONE', 生产线: LINE }] }, token);
  /已停用/.test(r.text) ? ok('① 停用态:排入被拦(无副作用用例)') : bad('① 未拦截: ' + r.text.slice(0, 200));

  // ② 同一按钮切回启用(标签翻转为 启用)→ 下拉恢复
  r = await api('/px/prodLine/toggle', { 生产线: LINE }, token);
  r.json?.data?.['停用'] === 0 ? ok('② 同一按钮切回启用') : bad('② 启用失败: ' + r.text.slice(0, 200));
  const st2 = (await api('/px/scheduleBoard/stats', {}, token)).json?.data || {};
  (st2['产线'] || []).some((l) => l['生产线'] === LINE)
    ? ok('② 启用态:下拉恢复可选')
    : bad('② 启用后仍不在下拉');

  // ③ 前端产物:按钮分支(切换标签)在 PanelxList chunk
  const base = API.replace('/api', '');
  const html = await (await fetch(base + '/index.html')).text();
  const main = (html.match(/assets\/index-[A-Za-z0-9_-]+\.js/) || [])[0];
  const mainJs = main ? await (await fetch(base + '/' + main)).text() : '';
  const listName = (mainJs.match(/PanelxList-[A-Za-z0-9_-]+\.js/) || [])[0];
  const listJs = listName ? await (await fetch(base + '/assets/' + listName)).text() : '';
  listJs.includes('prodLine/toggle') ? ok('③ 前端按钮分支已在产物(prodLine/toggle)') : bad('③ 产物缺按钮分支');

  console.log(process.exitCode ? '=== 存在失败项 ===' : '=== 切换式按钮验证全部通过 ===');
})();
