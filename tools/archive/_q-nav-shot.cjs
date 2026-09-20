/**
 * _q-nav-shot.cjs — 一次性界面取证:采购订单 / 销售订单 列表页截图 + 左侧导航 DOM 结构
 * 用法: node --experimental-websocket tools/archive/_q-nav-shot.cjs
 * 输出: tools/archive/_q-shots/*.png
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const FRONT = 'http://localhost:5173';
const API = 'http://localhost:8090/api';
const PORT = 9351;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = path.join(__dirname, '_q-shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const lr = await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  });
  const lj = await lr.json();
  const token = lj?.data?.token;
  const user = lj?.data?.user;
  if (!token) throw new Error('登录失败: ' + JSON.stringify(lj).slice(0, 200));
  console.log('[login] ok');

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-q-'));
  const edge = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore' });
  await sleep(2500);
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let seq = 0; const pending = new Map();
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
    const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
    const navigate = async (url) => {
      await send('Page.navigate', { url });
      for (let i = 0; i < 60; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(1500); return; } }
    };
    const shot = async (name) => {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true });
      const f = path.join(OUT, name + '.png');
      fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'));
      console.log('[shot]', f);
      return f;
    };

    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1000, deviceScaleFactor: 1, mobile: false });

    await navigate(`${FRONT}/#/login`);
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_login_date', '2026-09-20'); 'ok'`);
    await navigate('about:blank');

    for (const pc of ['PU_ORDER', 'SO_ORDER']) {
      await navigate(`${FRONT}/#/panelx/list/${pc}`);
      await sleep(3000);
      await evaluate(`(() => { const s = document.querySelector('.wz-skip'); if (s) { s.click(); return 'closed' } return 'none' })()`);
      await sleep(600);
      await shot(pc);
      // 左侧导航结构 + 面板内左侧结构
      const dom = await evaluate(`(() => {
        const nav = document.querySelector('aside, .left-nav, .nav, .ln-root');
        const txt = (el) => el ? el.textContent.replace(/\\s+/g, ' ').trim().slice(0, 400) : null;
        const groups = [...document.querySelectorAll('[class*="nav"]')].slice(0, 40).map(e => e.tagName + '.' + e.className + ' :: ' + txt(e).slice(0, 80));
        const rail = document.querySelector('[class*="rail"], .doc-rail, .dsr');
        return { navText: txt(nav), railText: txt(rail), navClassed: groups };
      })()`);
      console.log(`\n=== ${pc} DOM ===`);
      console.log('navText:', dom.navText);
      console.log('railText:', dom.railText);
      for (const g of dom.navClassed || []) console.log('  ', g);
      // 展开左侧导航第一个分区
      await evaluate(`(() => {
        const el = [...document.querySelectorAll('.nav-module, .nb-module, [class*="module"]')][0];
        if (el) { el.click(); return el.className } return 'no-module-el'
      })()`);
      await sleep(1000);
      await shot(pc + '-navopen');
    }
    ws.close();
  } finally {
    edge.kill();
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* 忽略 */ }
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
