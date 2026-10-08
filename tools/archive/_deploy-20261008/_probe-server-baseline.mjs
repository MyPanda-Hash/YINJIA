#!/usr/bin/env node
/**
 * _probe-server-baseline.mjs — 部署前「零风险只读」探针:从开发机经外网 8090 摸清服务器现状
 *
 * 为什么能这么干:应用 API 本身就是最好的元数据探针(比 RDP 截图可靠、零风险)——
 *   · 首页引用的 index-<hash>.js → 服务器当前跑的是哪个前端
 *   · GET /api/dashboard/capacity    → 远程新端点;404=旧 jar,200=新 jar(本次要上的是它)
 *   · POST /api/auth/login           → 应用是否真的可用(健康检查 200 不算数)
 *   · POST /api/px/queryFormDataList panelCode=WH   → **服务器 bs_wh 现状**(决定仓位批能不能整包 GO)
 *   · POST /api/px/queryFormDataList panelCode=WHLOC→ 仓位批是否已上场(理论应 404/空:服务器还没跑本轮迁移)
 *
 * 全程只读(login 只签发 token、query 只 SELECT)。绝不写任何数据。
 * 用法: node tools/archive/_deploy-20261008/_probe-server-baseline.mjs [baseUrl]
 */
const BASE = process.argv[2] || 'http://36.140.66.163:8090';
const out = [];
const say = (s) => { console.log(s); out.push(s); };

say(`=== 服务器部署前基线 ${BASE} (${new Date().toISOString()}) ===`);

// ① 首页前端指纹
let home = '';
try {
  const r = await fetch(BASE + '/', { signal: AbortSignal.timeout(20000) });
  home = await r.text();
  const m = home.match(/assets\/index-[A-Za-z0-9_-]+\.js/);
  say(`① 首页 HTTP ${r.status} 引用 ${m ? m[0] : '(未匹配到 index-*.js)'}`);
} catch (e) { say(`① 首页请求失败: ${e.message}`); }

// ② 登录(应用可用性 + 拿 token)
let token = null, loginInfo = '';
try {
  const r = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
    signal: AbortSignal.timeout(20000),
  });
  const j = await r.json().catch(() => null);
  token = j?.data?.token ?? null;
  loginInfo = `HTTP ${r.status} token=${token ? token.length + ' 字符' : '未签发'} realName=${j?.data?.realName ?? j?.data?.user?.realName ?? '—'}`;
  say(`② 登录 ${loginInfo}`);
} catch (e) { say(`② 登录失败: ${e.message}`); }

const api = async (path, body) => {
  const r = await fetch(BASE + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(25000),
  });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch { /* 非 JSON */ }
  return { status: r.status, json: j, text: t };
};

// ③ jar 版本 oracle:远程新增端点
try {
  const r = await api('/api/dashboard/capacity?period=day');
  if (r.status === 200) {
    const d = r.json?.data ?? r.json;
    const n = Array.isArray(d?.lines ?? d?.rows) ? (d.lines ?? d.rows).length : '?';
    say(`③ GET /api/dashboard/capacity -> 200(服务器 jar 已含远程新端点!产线 ${n} 组)`);
  } else {
    say(`③ GET /api/dashboard/capacity -> HTTP ${r.status}(404 = 服务器还是旧 jar,与预期相符)`);
  }
} catch (e) { say(`③ capacity 探针失败: ${e.message}`); }

// ④ 服务器 bs_wh 现状(决定仓位批能否整包 GO)
try {
  const r = await api('/api/px/queryFormDataList', { panelCode: 'WH', pageNo: 1, pageSize: 200 });
  if (r.status !== 200) say(`④ WH 面板查询 HTTP ${r.status} ${r.text.slice(0, 200)}`);
  else {
    const d = r.json?.data ?? r.json;
    const rows = d?.list ?? d?.rows ?? [];
    const heads = Array.isArray(rows) ? rows : [];
    const s = heads.map((x) => `${x.仓库编码 ?? x['仓库编码'] ?? '?'}=${x.仓库名称 ?? x['仓库名称'] ?? '?'}`);
    const total = d?.totalSize ?? d?.total ?? '?';
    say(`④ 服务器仓库档案(WH 面板)total=${total}: ${s.join(' | ') || '(空)'}`);
  }
} catch (e) { say(`④ WH 面板探针失败: ${e.message}`); }

// ⑤ 仓位面板(WHLOC)是否已上场
try {
  const r = await api('/api/px/queryFormDataList', { panelCode: 'WHLOC', pageNo: 1, pageSize: 5 });
  if (r.status !== 200) say(`⑤ WHLOC 面板 -> HTTP ${r.status}(服务器尚未有仓位批,符合预期)`);
  else {
    const d = r.json?.data ?? r.json;
    say(`⑤ WHLOC 面板 -> 200 totalSize=${d?.totalSize ?? '?'}(服务器竟已有仓位数据,需人工确认)`);
  }
} catch (e) { say(`⑤ WHLOC 探针失败: ${e.message}`); }

// ⑥ 服务器能否枚举"还没上的迁移"的痕迹:四单回正相关字段(试一个只在本地基线里的差异点不易,跳过)
say(`⑥ 结论:`);
say(`   · 服务器前端 = ${(home.match(/assets\/index-[A-Za-z0-9_-]+\.js/) || ['(未知)'])[0]}`);
say(`   · 本次目标前端 = assets/index-CtZ3s6Hm.js(合并后构建)`);

const { writeFileSync, mkdirSync } = await import('node:fs');
const dir = 'tools/archive/_deploy-20261008';
mkdirSync(dir, { recursive: true });
const f = `${dir}/_probe-server-baseline-${new Date().toISOString().slice(0, 10)}.txt`;
writeFileSync(f, out.join('\n') + '\n');
console.log(`\n(已留档 ${f})`);
