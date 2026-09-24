// 调试:CDP 打开指定 hash 路由,打印 body innerText + console 错误(定位界面为何未渲染)
// 用法: node tools/archive/_ui-debug-page.mjs "/panelx/list/PURCHASE_IN"
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = 'http://127.0.0.1:8090';
const hash = process.argv[2] || '/panelx/list/PURCHASE_IN';
const PORT = 9348;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
const token = login.data.token, userJson = JSON.stringify(login.data.user);
const factory = login.data.user?.factory || 'YJ';
const factoryJson = JSON.stringify({ code: factory, name: 'YINJIA-MES' });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-ui-dbg-'));
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
await sleep(2800);
const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0; const pending = new Map(); const logs = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.type + ': ' + (m.params.args || []).map((a) => a.value || a.description || '').join(' ').slice(0, 200));
  if (m.method === 'Runtime.exceptionThrown') logs.push('exception: ' + (m.params.exceptionDetails?.exception?.description || '').slice(0, 300));
  if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) logs.push('HTTP ' + m.params.response.status + ' ' + m.params.response.url.slice(0, 140));
  if (m.method === 'Network.loadingFailed') logs.push('LOADFAIL ' + m.params.errorText + ' ' + (m.params.requestId || ''));
};
const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value;
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');

await send('Page.navigate', { url: BASE + '/#/login' });
await sleep(2500);
console.log('--- 登录页 innerText ---');
console.log(await evaluate('document.body.innerText'));
await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(userJson)}); localStorage.setItem('mes_factory', ${JSON.stringify(factoryJson)}); localStorage.setItem('mes_login_date', ${JSON.stringify(new Date().toISOString().slice(0, 10))}); 'ok'`);
console.log('--- localStorage keys ---', await evaluate('JSON.stringify(Object.keys(localStorage))'));
// 必须强制整页重载:同文档 hash 变更不会重建 Pinia store(store 在首次加载时读 localStorage)
await send('Page.navigate', { url: 'about:blank' });
await sleep(600);

await send('Page.navigate', { url: `${BASE}/?t=${Date.now()}#${hash}` });
await sleep(5000);
console.log('--- 目标页 innerText ---');
console.log(await evaluate('document.body.innerText'));
console.log('--- DOM 摘要 ---');
console.log(await evaluate(`JSON.stringify({title:document.title, tables:document.querySelectorAll('.el-table').length, tabs:document.querySelectorAll('.el-tabs__item').length, rows:document.querySelectorAll('.el-table__row').length, html:document.body.innerHTML.length})`));
console.log('--- 网络/控制台 ---');
console.log(logs.slice(-25).join('\n'));
ws.close(); edge.kill();
try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
