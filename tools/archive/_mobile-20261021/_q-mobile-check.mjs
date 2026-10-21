// 一次性探针(2026-10-21):手机端抽屉顶部安全区 + 触控尺寸复核。
//   用户口径:「手机端的左侧导航边栏也高了一点,会被顶部的摄像头挡住」。
//   本脚本把 frontend/dist 起成静态服务(/api 反代 8090),用 Edge headless + CDP 按手机视口取证:
//   ① 抽屉打开后 mn-head / 返回 / 关闭 / 快捷按钮 的盒子与命中区尺寸;
//   ② 模拟 44px 顶部安全区(注入 .leftnav{padding-top:44px})—— CDP 无法模拟 env(safe-area-inset-top),
//      只能证明「内容会整体下移 44px」,真机清障仍以 env() 为准(与 TopBar 的既有修法同源);
//   ③ 375 / 320 视口下横向溢出检查(页面 scrollWidth vs innerWidth);
//   ④ 面板列表/表单页在手机视口下的横向滚动与截图。
// 用法(仓库根,先 npm run build):
//   node tools/archive/_mobile-20261021/_q-mobile-check.mjs
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const DIST = path.join(ROOT, 'frontend', 'dist');
const API_TARGET = { host: '127.0.0.1', port: 8090 };
const SERVE_PORT = 5188;
const CDP_PORT = 9368;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
};

function startStaticServer() {
  const server = http.createServer((req, res) => {
    if (req.url.startsWith('/api')) {
      const p = http.request({ ...API_TARGET, path: req.url, method: req.method, headers: req.headers },
        (up) => { res.writeHead(up.statusCode, up.headers); up.pipe(res); });
      p.on('error', () => { res.writeHead(502); res.end('proxy error'); });
      req.pipe(p);
      return;
    }
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join(DIST, urlPath);
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(DIST, 'index.html');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
  return new Promise((res) => server.listen(SERVE_PORT, '127.0.0.1', () => res(server)));
}

// PROBE_BASE/PROBE_QUERY 可用开发服地址直连(如 http://127.0.0.1:5173 + safeTop=44),
// 不设时照旧自己起 dist 静态服务。
const PROBE_BASE = process.env.PROBE_BASE || '';
const PROBE_QUERY = process.env.PROBE_QUERY || '';
const server = PROBE_BASE ? null : await startStaticServer();
const base = PROBE_BASE || `http://127.0.0.1:${SERVE_PORT}`;
const pageUrl = (hash) => {
  const q = new URLSearchParams(PROBE_QUERY);
  q.set('t', String(Date.now()));
  return `${base}/?${q.toString()}#${hash}`;
};

const login = await (await fetch(`${base}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
const token = login.data?.token;
if (!token) { console.error('登录失败', JSON.stringify(login).slice(0, 300)); server?.close(); process.exit(1); }
const userJson = JSON.stringify(login.data.user || {});
const factoryJson = JSON.stringify({ code: login.data.user?.factory || 'YJ', name: 'YINJIA-MES' });

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-mobile-'));
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--window-size=400,900', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, 'about:blank'],
  { stdio: 'ignore' });

try {
  let tab = null;
  for (let i = 0; i < 40 && !tab; i++) {
    await sleep(400);
    try { tab = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json(); } catch { /* retry */ }
  }
  if (!tab) throw new Error('Edge CDP 未就绪');

  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let seq = 0; const pending = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
  const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
  const shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    const file = path.join(HERE, name);
    fs.writeFileSync(file, Buffer.from(r.result.data, 'base64'));
    return file;
  };
  const setMobile = (w, h) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: false });

  await send('Page.enable'); await send('Runtime.enable');
  await setMobile(390, 844);
  await send('Page.navigate', { url: pageUrl('/login') }); await sleep(2000);
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(userJson)}); localStorage.setItem('mes_factory', ${JSON.stringify(factoryJson)}); 'ok'`);
  await send('Page.navigate', { url: pageUrl('/dashboard') }); await sleep(6000);

  const rectOf = (sel) => `(() => { const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return null;
    const r=e.getBoundingClientRect(); const cs=getComputedStyle(e);
    return { top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right), bottom: Math.round(r.bottom),
             w: Math.round(r.width), h: Math.round(r.height), padTop: cs.paddingTop, display: cs.display }; })()`;

  console.log('\n===== 390x844 首页(抽屉关闭) =====');
  console.log('portal paddingTop =', await ev(`getComputedStyle(document.querySelector('.portal')).paddingTop`));
  console.log('页面横向溢出 =', await ev(`document.documentElement.scrollWidth - window.innerWidth`));
  console.log('hamburger =', JSON.stringify(await ev(rectOf('.hamburger'))));
  console.log('factory =', JSON.stringify(await ev(rectOf('.factory'))));
  console.log('user =', JSON.stringify(await ev(rectOf('.user'))));
  await shot('mobile-01-dashboard-closed.png');

  // 打开抽屉
  await ev(`document.querySelector('.hamburger').click(); 'ok'`);
  await sleep(700);
  console.log('\n===== 抽屉打开 =====');
  console.log('leftnav =', JSON.stringify(await ev(rectOf('.leftnav'))));
  console.log('mn-head =', JSON.stringify(await ev(rectOf('.mn-head'))));
  console.log('mn-back =', JSON.stringify(await ev(rectOf('.mn-back'))));
  console.log('mn-close =', JSON.stringify(await ev(rectOf('.mn-close'))));
  console.log('mn-q[0] =', JSON.stringify(await ev(rectOf('.mn-q'))));
  console.log('mn-item[0] =', JSON.stringify(await ev(rectOf('.mn-item'))));
  console.log('抽屉横向溢出 =', await ev(`document.documentElement.scrollWidth - window.innerWidth`));
  console.log('viewport =', await ev(`JSON.stringify({ innerW: innerWidth, innerH: innerHeight, vvH: visualViewport?.height, docH: document.documentElement.clientHeight })`));
  console.log('topbar =', JSON.stringify(await ev(rectOf('.topbar'))));
  console.log('nav-mask =', JSON.stringify(await ev(rectOf('.nav-mask'))));
  console.log('遮罩处命中元素(350,30) =', await ev(`(() => { const e=document.elementFromPoint(350,30); return e ? e.className || e.tagName : null })()`));
  await shot('mobile-02-drawer-open.png');

  // 模拟 44px 顶部安全区(CDP 无法模拟 env()):证明内容整体下移、不被挖孔区压住
  await ev(`(() => { const s=document.createElement('style'); s.id='sim-notch';
    s.textContent='@media (max-width:768px){.leftnav{padding-top:44px !important}}'; document.head.appendChild(s); return 'ok' })()`);
  await sleep(400);
  console.log('\n===== 模拟 44px 挖孔安全区 =====');
  console.log('mn-head(模拟后) =', JSON.stringify(await ev(rectOf('.mn-head'))));
  await shot('mobile-03-drawer-sim-notch.png');
  await ev(`document.getElementById('sim-notch')?.remove(); 'ok'`);

  // 375 / 320 横向溢出
  for (const w of [375, 320]) {
    await setMobile(w, 812);
    await sleep(900);
    console.log(`\n===== ${w}px 横向溢出 =====`);
    console.log('dashboard scrollWidth-innerWidth =', await ev(`document.documentElement.scrollWidth - window.innerWidth`));
    console.log('innerWidth =', await ev(`window.innerWidth`));
    console.log('顶栏 notice-center =', JSON.stringify(await ev(rectOf('.notice-center'))));
    console.log('顶栏 user =', JSON.stringify(await ev(rectOf('.user'))));
    console.log('顶栏 logo =', JSON.stringify(await ev(rectOf('.logo'))));
  }

  // 面板列表页(手机视口)
  await setMobile(390, 844);
  for (const [hash, name] of [['#/panelx/list/MANU_ORDER', 'mobile-04-list-manu-order.png'], ['#/panelx/form/MANU_ORDER', 'mobile-05-form-manu-order.png']]) {
    await send('Page.navigate', { url: pageUrl(hash.replace(/^#/, '')) });
    await sleep(6500);
    console.log(`\n===== ${hash} =====`);
    console.log('页面横向溢出 =', await ev(`document.documentElement.scrollWidth - window.innerWidth`));
    console.log('工具栏/表格存在 =', await ev(`JSON.stringify({ tools: !!document.querySelector('.tools'), table: !!document.querySelector('.el-table') })`));
    await shot(name);
  }

  ws.close();
} finally {
  edge.kill();
  server?.close();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
}
console.log('\n截图目录:', HERE);
