/**
 * _q-pager-layout.mjs — 一次性探针:列出单据面板页面上所有"翻页控件"的位置与文本,搞清"最顶层/最底层"指哪两个
 * 用法: node tools/archive/_q-pager-layout.mjs [PANEL] [DOCNO]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PANEL = process.argv[2] || 'PURCHASE_IN';
const DOCNO = process.argv[3] || '';
const FRONT = 'http://localhost:5173';
const API = 'http://localhost:8090/api';
const PORT = 9381;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const lj = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
const token = lj?.data?.token, user = lj?.data?.user;

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-lay-'));
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let tab = null;
for (let i = 0; i < 40 && !tab; i++) {
  await sleep(1000);
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json(); } catch {}
}
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1000, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `${FRONT}/#/login` });
await sleep(2500);
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_login_date','2026-09-20'); localStorage.setItem('mes_locale','zh-CN'); 'ok'`);
const url = `${FRONT}/?_v=${Date.now()}#/panelx/list/${PANEL}${DOCNO ? '?docNo=' + DOCNO : ''}`;
await send('Page.navigate', { url });
for (let i = 0; i < 80; i++) { await sleep(400); if (await ev(`!!document.querySelector('.page-no')`)) break; }
await sleep(2500);

const map = await ev(`(() => {
  const R = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
  const chain = (el) => { const out = []; let p = el; for (let i = 0; i < 5 && p; i++) { out.push(p.tagName.toLowerCase() + (p.className ? '.' + String(p.className).split(' ').filter(Boolean).join('.') : '')); p = p.parentElement; } return out; };
  const pagers = [];
  document.querySelectorAll('.page-btn, .page-no, .el-pagination, .arch-pager, .as-side-pager, .pg').forEach((el) => {
    if (el.closest('.el-pagination')) { /* 由外层容器汇总 */ }
    const own = el.classList.contains('page-btn') || el.classList.contains('page-no') || el.classList.contains('pg');
    if (!own) return;
    const holder = el.closest('.tools-right, .as-side-pager, .approval-side, .arch-pager, .rpd-pager, .fuzzy-panel') || el.parentElement;
    pagers.push({ text: el.textContent.trim(), title: el.title || '', rect: R(el), holder: String(holder.className), chain: chain(el).slice(0, 3) });
  });
  const boxes = {};
  for (const sel of ['.doc-select-rail', '.doc-rail-main', '.approval-side', '.tools-right', '.toolbar', '.main-table', '.el-table', '.el-pagination', '.arch-pager']) {
    const el = document.querySelector(sel);
    if (el) boxes[sel] = { rect: R(el), text: (el.textContent || '').replace(/\\s+/g, ' ').slice(0, 60) };
  }
  return { url: location.href, winH: window.innerHeight, winW: window.innerWidth, scrollH: document.documentElement.scrollHeight, pagers, boxes };
})()`);
console.log(JSON.stringify(map, null, 1));
ws.close(); edge.kill();
try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
