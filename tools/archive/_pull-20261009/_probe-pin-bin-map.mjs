/**
 * _probe-pin-bin-map.mjs — 把采购入库列表宽表的「列头 ↔ 单元格」映射与**列虚拟化视口**dump 出来
 * 目的:确认第 17 列「仓位」是否落在视口外(整列不渲染 ⇒ 点不到),还是真的可点。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const argv = process.argv.slice(2);
const argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const BASE = argOf('--url', 'http://127.0.0.1:8090');
const FACTORY = argOf('--factory', 'YJ');
const CDP_PORT = Number(argOf('--port', '9414'));
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }),
})).json();
const token = login.data?.token;
if (!token) { console.error('登录失败'); process.exit(1); }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-map-'));
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--window-size=1680,1000', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, 'about:blank'],
  { stdio: 'ignore' });
try {
  let tab = null;
  for (let i = 0; i < 40 && !tab; i++) {
    await sleep(500);
    try { tab = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json(); } catch {}
  }
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let seq = 0; const pending = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
  const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
  await send('Page.enable'); await send('Runtime.enable');

  await send('Page.navigate', { url: BASE + '/#/login' });
  await sleep(3000);
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user || {}))}); localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: FACTORY, name: FACTORY }))}); localStorage.removeItem('mes_locale'); 'ok'`);
  await send('Page.navigate', { url: `${BASE}/?t=${Date.now()}#/panelx/list/PURCHASE_IN` });
  await sleep(10000);
  await ev(`(() => { const el = [...document.querySelectorAll('button, span, div')].find(e => e.innerText?.trim() === '下次再说' && e.offsetParent !== null); if (el) el.click(); return 'ok' })()`);
  await sleep(1500);

  console.log('===== ① 列头 class ↔ 文本 =====');
  console.log(await ev(`(() => {
    const clean = (s) => (s || '').replace(/[\\u21c5\\u21c9\\u21ca\\s]+/g, '').trim();
    return [...document.querySelectorAll('.el-table__header-wrapper th')].map((th, i) => {
      const m = (th.className || '').match(/el-table_\\d+_column_\\d+/);
      return i + '  ' + (m ? m[0] : '(无cls)') + '  ' + clean(th.innerText);
    }).join('\\n');
  })()`));

  console.log('\n===== ② 第 0 行 每个 td 的 class 与文本 =====');
  console.log(await ev(`(() => {
    const r = document.querySelector('.el-table__body-wrapper tbody tr');
    if (!r) return '(无行)';
    return [...r.querySelectorAll('td')].map((td, i) => {
      const m = (td.className || '').match(/el-table_\\d+_column_\\d+/);
      const hasInput = !!td.querySelector('input');
      const hasRefEditor = !!td.querySelector('.inline-ref-editor');
      const lazy = !!td.querySelector('.cell-lazy');
      return i + '  ' + (m ? m[0] : '(无cls)') + '  txt=' + JSON.stringify(td.innerText.trim().slice(0, 12))
        + (hasInput ? ' [input]' : '') + (hasRefEditor ? ' [ref-editor]' : '') + (lazy ? ' [cell-lazy]' : '');
    }).join('\\n');
  })()`));

  console.log('\n===== ③ 列虚拟化视口状态 =====');
  console.log(await ev(`(() => {
    const wrap = document.querySelector('.el-table__body-wrapper');
    const inner = wrap && (wrap.querySelector('.el-table__body') || wrap.querySelector('table'));
    const ph = document.querySelectorAll('.col-lazy-empty, .col-ph, td[class*="lazy"]').length;
    return JSON.stringify({
      scrollLeft: wrap ? wrap.scrollLeft : null,
      scrollWidth: wrap ? wrap.scrollWidth : null,
      clientWidth: wrap ? wrap.clientWidth : null,
      tableViewportReact: (typeof window !== 'undefined' && document.querySelector('.arch-grid')) ? 'has-arch-grid' : 'n/a',
      占位格数: ph,
      bodyTdCount: document.querySelectorAll('.el-table__body-wrapper tbody tr:first-child td').length,
      headerThCount: document.querySelectorAll('.el-table__header-wrapper th').length
    }, null, 1);
  })()`));

  // ④ 横向滚到最右,再看一次 仓位 td 在不在、能不能点
  await ev(`(() => { const w = document.querySelector('.el-table__body-wrapper'); w.scrollLeft = w.scrollWidth; return 'scrolled' })()`);
  await sleep(2000);
  console.log('\n===== ④ 滚到最右后再看第 0 行 td =====');
  console.log(await ev(`(() => {
    const r = document.querySelector('.el-table__body-wrapper tbody tr');
    return [...r.querySelectorAll('td')].map((td, i) => {
      const m = (td.className || '').match(/el-table_\\d+_column_\\d+/);
      const hasRefEditor = !!td.querySelector('.inline-ref-editor');
      return i + '  ' + (m ? m[0] : '(无cls)') + '  txt=' + JSON.stringify(td.innerText.trim().slice(0, 12)) + (hasRefEditor ? ' [ref-editor]' : '');
    }).join('\\n');
  })()`));

  const r = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(ROOT, 'tools', 'archive', '_pull-20261009', '_bin-ui-map.png'), Buffer.from(r.result.data, 'base64'));
  console.log('\n截图: tools/archive/_pull-20261009/_bin-ui-map.png');
  ws.close();
} finally {
  edge.kill();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
}
