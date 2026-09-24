// 生产域界面细节走查(DOM 断言):
//  ①生产线档案「停用」列是否渲染为行内开关(.line-toggle-cell)
//  ②生产加工单工具栏是否含生产域新按钮(拆单/结案/首件完成通知/生成采购申请/生成产品批号),且「排产」按钮已下线
//  ③订单结转/排产工作台/工单排产三页的关键容器与按钮存在
// 用法: node tools/archive/_ui-check-prod-dom.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = 'http://127.0.0.1:8090';
const PORT = 9349;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const record = (label, ok, detail = '') => { results.push({ label, ok }); console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`); };

const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
const token = login.data.token;
const userJson = JSON.stringify(login.data.user);
const factoryJson = JSON.stringify({ code: login.data.user?.factory || 'YJ', name: 'YINJIA-MES' });

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-dom-'));
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1600,1000',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
await sleep(2800);
const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0; const pending = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value;
const nav = async (hash, wait = 3800) => { await send('Page.navigate', { url: `${BASE}/?t=${Date.now()}#${hash}` }); await sleep(wait); };
await send('Page.enable'); await send('Runtime.enable');
await nav('/login', 2500);
await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(userJson)}); localStorage.setItem('mes_factory', ${JSON.stringify(factoryJson)}); 'ok'`);

// ① 生产线档案:停用列行内开关
await nav('/panelx/list/PROD_LINE');
const lineDom = await evaluate(`JSON.stringify({ toggle: document.querySelectorAll('.line-toggle-cell').length, switches: document.querySelectorAll('.line-toggle-cell .el-switch').length, rows: document.querySelectorAll('.el-table__row').length, headers: [...document.querySelectorAll('.el-table__header th')].map(e=>e.innerText.trim()).filter(Boolean).slice(0,14) })`);
const lineObj = JSON.parse(lineDom || '{}');
record('生产线档案 停用列行内开关', (lineObj.switches || 0) > 0, `开关 ${lineObj.switches} 个 / 行 ${lineObj.rows}`);

// ② 生产加工单工具栏(按钮由后端 PanelConfigService 下发,配置层断言更稳)
const cfg = await (await fetch(BASE + '/api/px/getPanelConfig?panelCode=MANU_ORDER', { headers: { Authorization: 'Bearer ' + token } })).json();
const flat = JSON.stringify(cfg);
const wantBtns = ['拆单', '结案', '取消结案', '首件完成通知', '生成采购申请', '生成产品批号'];
record('MANU_ORDER 工具栏含生产域新按钮', wantBtns.every((b) => flat.includes(b)), wantBtns.filter((b) => !flat.includes(b)).join(',') || '全部存在');
record('MANU_ORDER 「排产」按钮已下线', !flat.includes('"排产"'), '');
// 销售订单侧的「生成生产加工单」入口(流转配置挂在 SO_ORDER 面板上;MANU_ORDER 侧只有入向映射)
const soCfg = await (await fetch(BASE + '/api/px/getPanelConfig?panelCode=SO_ORDER', { headers: { Authorization: 'Bearer ' + token } })).json();
record('SO_ORDER 可生成生产加工单', JSON.stringify(soCfg).includes('生成生产加工单'), '');

// ③ 三个新页面的关键容器
const pages = [
  ['/prod/plan/orderConvert', ['转工单', '转采购单']],
  ['/prod/plan/scheduleBoard', ['待排产']],
  ['/prod/plan/workOrderBoard', []],
];
for (const [hash, texts] of pages) {
  await nav(hash, 4200);
  const txt = (await evaluate('document.body.innerText || ""')) || '';
  const ok = texts.every((t) => txt.includes(t)) && txt.length > 300;
  record(`${hash} 页面要素`, ok, `文本 ${txt.length} 字` + (ok ? '' : ` 缺:${texts.filter((t) => !txt.includes(t)).join(',')}`));
}

ws.close(); edge.kill();
try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
const bad = results.filter((r) => !r.ok);
console.log(`\n=== DOM 细节断言: ${results.length - bad.length}/${results.length} 通过 ===`);
if (bad.length) process.exit(1);
