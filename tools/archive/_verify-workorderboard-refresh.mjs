// _verify-workorderboard-refresh.mjs — 工单排产看板「刷新」按钮取证(2026-10-17)
//   ① .wb-top 里有「刷新」按钮(且带 loading 绑定)
//   ② 点它 → 真的重取三处:linesSummary / scheduled / stats
// 用法: node tools/archive/_verify-workorderboard-refresh.mjs [base]
//   默认打 **5173(vite 源码即时生效)**;要看 8090 打包产物就传 http://127.0.0.1:8090
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '');
const PORT = 9361;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let bad = 0;
const record = (label, ok, detail = '') => { if (!ok) bad++; console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`); };

const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
if (!login?.data?.token) { console.log('❌ 登录失败:', JSON.stringify(login).slice(0, 200)); process.exit(1); }
const token = login.data.token;
const userJson = JSON.stringify(login.data.user);
const factoryJson = JSON.stringify({ code: login.data.user?.factory || 'YJ', name: 'YINJIA-MES' });

// 浏览器 profile 必须落在**工作区内**(.esbuild-tmp/ 已在 .gitignore):
// 系统 TEMP 在受限沙箱下写不进去,Edge 起不来(实测 CDP 端口始终拒绝连接)。
const PROFILE_ROOT = fileURLToPath(new URL('../../.esbuild-tmp/', import.meta.url));
const profile = fs.mkdtempSync(path.join(PROFILE_ROOT, 'wb-refresh-'));
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1600,1000',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
edge.on('error', (e) => console.log('❌ Edge 启动失败:', e.message));
/** 等 CDP 端口就绪(固定 sleep 在慢机/首次建 profile 时会误判) */
async function waitCdp(timeoutMs = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { await fetch(`http://127.0.0.1:${PORT}/json/version`); return true; } catch { await sleep(400); }
  }
  return false;
}
if (!(await waitCdp())) { console.log('❌ Edge CDP 端口未就绪'); edge.kill(); process.exit(1); }
const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value;
await send('Page.enable'); await send('Runtime.enable');

await send('Page.navigate', { url: `${BASE}/?t=${Date.now()}#/login` }); await sleep(2500);
await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(userJson)}); localStorage.setItem('mes_factory', ${JSON.stringify(factoryJson)}); 'ok'`);
await send('Page.navigate', { url: `${BASE}/?t=${Date.now()}#/prod/plan/workOrderBoard` }); await sleep(5000);

// ① 顶部条里的刷新按钮
const dom = JSON.parse(await evaluate(`JSON.stringify({
  topButtons: [...document.querySelectorAll('.wb-top .el-button')].map(b => b.innerText.trim()),
  title: document.querySelector('.wb-title')?.innerText.trim() || '',
  lines: document.querySelectorAll('.wb-line').length,
})`) || '{}');
console.log(`  页面标题="${dom.title}"  左侧产线 ${dom.lines} 条  .wb-top 按钮=${JSON.stringify(dom.topButtons)}`);
record('工单排产看板 .wb-top 有「刷新」按钮', (dom.topButtons || []).includes('刷新'));

// ② 点刷新 → 三处重取(XHR 记名)
//    先hook、再选一条产线(loadScheduled 在未选线时**按设计早退**,不选线就发不出 scheduled 请求)
await evaluate(`window.__hits=[];(()=>{const o=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){try{window.__hits.push(String(u))}catch(e){};return o.apply(this,arguments)}})();'hooked'`);
await evaluate(`document.querySelector('.wb-line')?.click(); 'picked'`);
await sleep(2000);
const picked = await evaluate(`document.querySelector('.wb-ctx-label b')?.innerText.trim() || ''`);
console.log(`  已选产线="${picked}"`);
record('点击左侧产线后进入按线明细', !!picked);

await evaluate(`window.__hits=[]; [...document.querySelectorAll('.wb-top .el-button')].find(b=>b.innerText.trim()==='刷新')?.click(); 'clicked'`);
await sleep(2500);
const hits = await evaluate(`JSON.stringify(window.__hits || [])`);
const urls = JSON.parse(hits || '[]').filter((u) => u.includes('/px/scheduleBoard/'));
const kinds = ['linesSummary', 'scheduled', 'stats'].filter((k) => urls.some((u) => u.includes(k)));
console.log(`  刷新后 scheduleBoard 请求: ${JSON.stringify(urls)}`);
record('刷新重取 骨架+按线明细+汇总 三处', kinds.length === 3, `命中 ${kinds.join('/')}`);

ws.close(); edge.kill();
console.log(bad ? `=== 存在 ${bad} 项失败 ===` : '=== 工单排产刷新按钮探针全部通过 ===');
process.exit(bad ? 1 : 0);
