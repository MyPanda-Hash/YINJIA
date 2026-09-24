// 针对生产线档案「停用」行内开关的深入 DOM 勘察:懒渲染列需滚动进视口才挂载
// 用法: node tools/archive/_ui-probe-prodline.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = 'http://127.0.0.1:8090';
const PORT = 9350;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const login = await (await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json();
const token = login.data.token, userJson = JSON.stringify(login.data.user);
const factoryJson = JSON.stringify({ code: login.data.user?.factory || 'YJ', name: 'YINJIA-MES' });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-pl-'));
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1920,1400', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
await sleep(2800);
const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (m, p = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method: m, params: p })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;
await send('Page.enable'); await send('Runtime.enable');
await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(2200);
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(userJson)}); localStorage.setItem('mes_factory', ${JSON.stringify(factoryJson)}); 'ok'`);
await send('Page.navigate', { url: `${BASE}/?t=${Date.now()}#/panelx/list/PROD_LINE` }); await sleep(4500);

console.log('DOM 概况:', await ev(`JSON.stringify({tables:document.querySelectorAll('.el-table').length, rows:document.querySelectorAll('.el-table__row').length, archRows:document.querySelectorAll('[class*=arch]').length, toggles:document.querySelectorAll('.line-toggle-cell').length, switches:document.querySelectorAll('.el-switch').length, lazy:document.querySelectorAll('.col-lazy-empty').length})`));
console.log('表头:', await ev(`JSON.stringify([...document.querySelectorAll('.el-table__header th')].map(e=>e.innerText.trim()).filter(Boolean))`));
console.log('可视行文本:', await ev(`JSON.stringify([...document.querySelectorAll('.el-table__row')].slice(0,6).map(r=>r.innerText.replace(/\\n/g,'|').slice(0,120)))`));
// 滚动档案网格容器,触发懒渲染列挂载
await ev(`(() => { const els=[...document.querySelectorAll('.el-scrollbar__wrap,.el-table__body-wrapper,.el-table__body-wrapper .el-scrollbar__wrap')]; els.forEach(e=>{e.scrollLeft=e.scrollWidth; e.scrollTop=e.scrollHeight;}); window.scrollTo(0,document.body.scrollHeight); return els.length })()`);
await sleep(2500);
console.log('滚动后:', await ev(`JSON.stringify({toggles:document.querySelectorAll('.line-toggle-cell').length, switches:document.querySelectorAll('.line-toggle-cell .el-switch').length, rows:document.querySelectorAll('.el-table__row').length})`));
console.log('停用列是否存在:', await ev(`document.body.innerText.includes('停用')`));
ws.close(); edge.kill();
try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
