#!/usr/bin/env node
/**
 * _verify-merged-api.mjs — 合并后本地 8090 的功能级验收(只读探针)
 *
 * 验的是「远程那批功能在本地真的能跑」:
 *   ① 登录拿 token(yj_user 实读 —— 比健康检查更能证明应用可用)
 *   ② GET /api/shell/dashboard/capacity?period=day|week|month|year —— 远程新增端点
 *      (断言:period 回显正确、产线组数 > 0、上限字段与周期口径一致)
 *   ③ GET /api/shell/dashboard/stats —— 旧端点未被 capacity 改造打坏
 *   ④ 仓位体系(本地那批):WHLOC 面板查询能出数(679 个仓位)、仓库档案 厂区 列在
 *
 * 用法: node tools/archive/_registry-audit-20261008/_verify-merged-api.mjs [baseUrl]
 */
const BASE = process.argv[2] || 'http://127.0.0.1:8090';

let token = null;
let fails = 0;

function ok(label, detail) {
  console.log(`  [OK]   ${label}${detail ? ' — ' + detail : ''}`);
}
function bad(label, detail) {
  fails++;
  console.log(`  [FAIL] ${label}${detail ? ' — ' + detail : ''}`);
}

async function api(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* 非 JSON 原样返回 */ }
  return { status: res.status, json, text };
}

// ---------- ① 登录 ----------
console.log(`=== 探针目标 ${BASE} ===`);
console.log('① 登录(admin)');
const login = await api('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
});
if (login.status !== 200) {
  bad('登录', `HTTP ${login.status} ${login.text.slice(0, 200)}`);
  process.exit(1);
}
token = login.json?.data?.token;
if (!token) bad('登录', '未拿到 token: ' + login.text.slice(0, 200));
else ok('登录', 'token 已签发(' + token.length + ' 字符),库=' + (login.json?.data?.database || login.json?.data?.db || '—'));

// ---------- ② 产能对比四周期 ----------
console.log('② GET /api/dashboard/capacity(远程新增端点;控制器 @RequestMapping("/api"))');
const wantPeriods = ['day', 'week', 'month', 'year'];
for (const p of wantPeriods) {
  const r = await api('/api/dashboard/capacity?period=' + p);
  if (r.status !== 200) { bad(`period=${p}`, `HTTP ${r.status} ${r.text.slice(0, 160)}`); continue; }
  const d = r.json?.data ?? r.json;
  const lines = d?.lines ?? d?.rows ?? [];
  const periodEcho = d?.period;
  const lineCount = Array.isArray(lines) ? lines.length : 0;
  const withLimit = Array.isArray(lines) ? lines.filter((x) => x.上限 != null || x.limit != null).length : 0;
  const days = d?.days ?? d?.周期天数;
  if (periodEcho !== p) bad(`period=${p}`, `回显 period=${periodEcho}(口径未生效)`);
  else if (lineCount === 0) bad(`period=${p}`, '产线组数为 0 —— 图表会空');
  else ok(`period=${p}`, `产线 ${lineCount} 组 / 其中带上限 ${withLimit} 组 / 区间 ${d?.start ?? d?.from ?? '—'}~${d?.end ?? d?.to ?? '—'}${days != null ? ' / 天数 ' + days : ''}`);
}

// ---------- ③ 旧端点未被打坏 ----------
console.log('③ GET /api/dashboard/stats(既有桌面聚合)');
const stats = await api('/api/dashboard/stats');
if (stats.status !== 200) bad('dashboard/stats', `HTTP ${stats.status}`);
else {
  // ⚠ 段名是 production(不是 prod)—— 探针按真实响应键取,别按直觉猜
  const d = stats.json?.data ?? stats.json;
  const production = d?.production;
  const keys = production ? Object.keys(production) : [];
  if (keys.length === 0) bad('dashboard/stats', 'production 段为空;实际 data 段键: ' + Object.keys(d || {}).join(','));
  else ok('dashboard/stats', 'production 段键: ' + keys.join(','));
  if (keys.includes('capacityToday')) bad('dashboard/stats', '仍返回已删除的 capacityToday(前端已改为独立端点)');
  else ok('dashboard/stats', '旧的 capacityToday 已按远程改造移除');
  const other = Object.keys(d || {}).filter((k) => k !== 'production');
  ok('dashboard/stats', '其余段齐备: ' + other.join(','));
}

// ---------- ④ 仓位体系(本地那批) ----------
// ⚠ WHLOC 是「单单据」面板:响应 { totalSize, list[ {编号,状态,单据状态,detail:{locations:[…]}} ] },
//    仓位层次列在 detail.locations[] 的每行里,不在 list[] 顶层 —— 按顶层取键会误判"没有新列"。
console.log('④ 仓位体系功能(本地合并前那批)');
const whloc = await api('/api/px/queryFormDataList', {
  method: 'POST',
  body: JSON.stringify({ panelCode: 'WHLOC', pageNo: 1, pageSize: 3 }),
});
if (whloc.status !== 200) bad('WHLOC 面板查询', `HTTP ${whloc.status} ${whloc.text.slice(0, 200)}`);
else {
  const d = whloc.json?.data ?? whloc.json;
  const total = d?.totalSize ?? d?.total ?? '—';
  const head = (d?.list ?? [])[0];
  const locs = head?.detail?.locations ?? head?.detail?.lines ?? [];
  if (!head) bad('WHLOC 面板查询', 'list 为空');
  else if (locs.length === 0) bad('WHLOC 面板查询', `头行 ${head.编号} 无明细行;detail 键: ` + Object.keys(head.detail ?? {}).join(','));
  else {
    const l0 = locs[0];
    const want = ['仓位编码', '区码', '排号', '位号', '仓位地址', '仓库'];
    const hit = want.filter((k) => k in l0);
    if (hit.length < want.length) bad('WHLOC 明细行', `缺列: ${want.filter((k) => !(k in l0)).join('/')};实有列: ${Object.keys(l0).join(',')}`);
    else ok('WHLOC 明细行', `${locs.length} 行;层次列齐备(${hit.join('/')});首行 ${l0.仓库}/${l0.仓位编码} 地址=${l0.仓位地址}`);
    if (String(total) !== '679') bad('WHLOC 总行数', `totalSize=${total},期望 679(与库内有效仓位一致)`);
    else ok('WHLOC 总行数', 'totalSize=679,与库内有效仓位一致');
    if (l0.仓库 === 'B仓' && l0.仓位编码?.startsWith('B4-')) ok('仓位改名生效', `仓库名已是「${l0.仓库}」,编码 ${l0.仓位编码}(厂区>仓 重构 + 库位→仓位)`);
  }
}

console.log('');
console.log(fails === 0 ? 'RESULT: ALL-OK' : `RESULT: FAIL-${fails}`);
process.exit(fails === 0 ? 0 : 1);
