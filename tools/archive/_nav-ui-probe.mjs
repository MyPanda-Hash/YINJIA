// 一次性探针(2026-10-14):左侧导航「生产制造 vs 其他模块」改造前后取证。
//   为什么自带静态服务器:本机沙箱禁止程序开命名管道 ⇒ esbuild 起不来(不能 vite dev/preview)、
//   Chromium 也起不来(Mojo 需要命名管道)。故本脚本用纯 node:http 把 frontend/dist 静态服务出来
//   并把 /api 反代到 8090,自己再去开 Edge —— 全程不 spawn 第三方构建器。
//
// 用法(仓库根):
//   1) 改前(8090 里是上一次打包的前端):node tools/archive/_nav-ui-probe.mjs --only 8090
//   2) 改后(先 npm run build 出 dist):    node tools/archive/_nav-ui-probe.mjs --serve-dist
//   3) 一次跑两边对照:                    node tools/archive/_nav-ui-probe.mjs --serve-dist --also-8090
//
// 产出:控制台 DOM 取证 + tools/archive/_nav-<before|after>-<scm|mfg|qc>.png 截图
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// NAV_DIST/NAV_TAG 可覆盖:用来把「改前的旧前端快照」(git archive 取出的 backend/…/static)也拍一组 before 截图
const DIST = process.env.NAV_DIST ? path.resolve(process.env.NAV_DIST) : path.join(ROOT, 'frontend', 'dist');
const API_TARGET = { host: '127.0.0.1', port: 8090 };
const SERVE_PORT = 5199;
const CDP_PORT = 9358;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const argv = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- 自带静态服务器(dist + /api 反代) ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
};
function startStaticServer() {
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api')) { // 反代到后端
      const p = http.request({ ...API_TARGET, path: req.url, method: req.method, headers: req.headers },
        (up) => { res.writeHead(up.statusCode, up.headers); up.pipe(res); });
      p.on('error', () => { res.writeHead(502); res.end('proxy error'); });
      req.pipe(p);
      return;
    }
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join(DIST, urlPath);
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(DIST, 'index.html'); // SPA 回退
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
  return new Promise((res) => server.listen(SERVE_PORT, '127.0.0.1', () => res(server)));
}

/* ---------- 单目标取证 ---------- */
async function probe(target) {
  const { base, tag } = target;
  const login = await (await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json();
  const token = login.data?.token;
  if (!token) { console.error(`[${tag}] 登录失败`, JSON.stringify(login).slice(0, 200)); return; }
  const userJson = JSON.stringify(login.data.user || {});
  const factoryJson = JSON.stringify({ code: login.data.user?.factory || 'YJ', name: 'YINJIA-MES' });

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-nav-'));
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1680,1000', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, 'about:blank'],
    { stdio: 'ignore' });
  try {
    let tab = null;
    for (let i = 0; i < 30 && !tab; i++) {
      await sleep(500);
      try { tab = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json(); } catch { /* retry */ }
    }
    if (!tab) { console.error(`[${tag}] Edge CDP 未就绪`); return; }
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let seq = 0; const pending = new Map();
    ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
    const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
    const shot = async (file) => {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.from(r.result.data, 'base64'));
    };
    await send('Page.enable'); await send('Runtime.enable');
    await send('Page.navigate', { url: base + '/#/login' }); await sleep(2500);
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(userJson)}); localStorage.setItem('mes_factory', ${JSON.stringify(factoryJson)}); 'ok'`);
    await send('Page.navigate', { url: `${base}/?t=${Date.now()}#/dashboard` }); await sleep(5500);

    console.log(`\n########## [${tag}] ${base} ##########`);
    console.log('侧栏一级:', await ev(`JSON.stringify([...document.querySelectorAll('.nav-group span')].map(e=>e.innerText.trim()))`));
    for (const [code, title] of [['scm', '智能供应链'], ['mfg', '生产制造'], ['qc', '品质管理'], ['base', '基础档案']]) {
      await ev(`(() => { const g=[...document.querySelectorAll('.nav-group')].find(e=>e.innerText.includes(${JSON.stringify(title)})); if(!g) return 'miss'; g.click(); return 'ok' })()`);
      await sleep(600);
      const mods = await ev(`JSON.stringify((() => { const g=[...document.querySelectorAll('.nav-group')].find(e=>e.innerText.includes(${JSON.stringify(title)})); const box=g?.nextElementSibling; return box?[...box.querySelectorAll('.nav-module span')].map(e=>e.innerText.trim()):[] })())`);
      console.log(`侧栏二级[${title}] = ${mods}`);
      await ev(`(() => { const g=[...document.querySelectorAll('.nav-group')].find(e=>e.innerText.includes(${JSON.stringify(title)})); g.dispatchEvent(new MouseEvent('mouseenter',{bubbles:true})); return 'ok' })()`);
      await sleep(800);
      const card = await ev(`JSON.stringify([...document.querySelectorAll('.fly-card .card-group')].map(g=>g.querySelector('.card-group-title')?.innerText.trim()+'×'+g.querySelectorAll('.card-item').length))`);
      console.log(`悬停浮层[${title}] = ${card}`);
      await shot(path.join(ROOT, 'tools', 'archive', `_nav-${tag}-${code}.png`));
      await ev(`(() => { const g=[...document.querySelectorAll('.nav-group')].find(e=>e.innerText.includes(${JSON.stringify(title)})); g.dispatchEvent(new MouseEvent('mouseleave',{bubbles:true})); return 'ok' })()`);
      await sleep(250);
      await ev(`(() => { const g=[...document.querySelectorAll('.nav-group')].find(e=>e.innerText.includes(${JSON.stringify(title)})); g.click(); return 'ok' })()`); // 收起,避免影响下一项
      await sleep(250);
    }
    ws.close();
  } finally {
    edge.kill();
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

/* ---------- 主流程 ---------- */
const targets = [];
let server = null;
if (argv.includes('--serve-dist')) {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.error('frontend/dist 不存在,请先 npm run build'); process.exit(1); }
  server = await startStaticServer();
  server.unref?.();
  targets.push({ base: `http://127.0.0.1:${SERVE_PORT}`, tag: process.env.NAV_TAG || 'after' });
}
if (argv.includes('--also-8090') || argv.includes('--only-8090')) targets.push({ base: 'http://127.0.0.1:8090', tag: process.env.NAV_TAG || 'before' });
for (let i = 0; i < argv.length; i++) { // --url <base> --tag <name> 任意目标
  if (argv[i] === '--url') targets.push({ base: argv[i + 1], tag: argv[i + 2] || 'target' });
}
if (argv.includes('--only-5173')) targets.push({ base: 'http://127.0.0.1:5173', tag: process.env.NAV_TAG || 'vite' });
if (!targets.length) { console.error('用法: node tools/archive/_nav-ui-probe.mjs (--serve-dist | --only-8090 | --only-5173 | --url <base> <tag>) [--also-8090]'); process.exit(1); }

for (const t of targets) {
  try { await probe(t); } catch (e) { console.error(`[${t.tag}] 取证失败:`, e?.message || e); }
}
if (server) server.close();
console.log('\n截图目录: tools/archive/_nav-<before|after>-<scm|mfg|qc|base>.png');
