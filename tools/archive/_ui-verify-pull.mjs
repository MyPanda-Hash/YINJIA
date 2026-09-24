// 下拉生产域后的界面走查(CDP,无第三方依赖:用 Node 内置 WebSocket 直连 DevTools)。
// 覆盖:生产域新页(订单结转/排产工作台/工单排产/生产线)+ 三大自有域代表面板;
// 采集 console 错误/未捕获异常,并对关键页截图到 tools/archive/_ui-shots/。
// 用法: node tools/archive/_ui-verify-pull.mjs [base]   默认 http://127.0.0.1:8090
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '');
const PORT = 9347;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SHOTS = path.join(process.cwd(), 'tools', 'archive', '_ui-shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PAGES = [
  { code: 'MANU_ORDER', label: '生产加工单(生产域)', hash: '/panelx/list/MANU_ORDER', shot: true },
  { code: 'orderConvert', label: '订单结转(生产域)', hash: '/prod/plan/orderConvert', shot: true },
  { code: 'scheduleBoard', label: '排产工作台(生产域)', hash: '/prod/plan/scheduleBoard', shot: true },
  { code: 'workOrderBoard', label: '工单排产(生产域)', hash: '/prod/plan/workOrderBoard', shot: true },
  { code: 'PROD_LINE', label: '生产线档案(生产域·停用开关)', hash: '/panelx/list/PROD_LINE', shot: true },
  { code: 'OP_TIME', label: '工序工时(生产域·gxgs 建表后)', hash: '/panelx/list/OP_TIME', shot: false },
  { code: 'LINE_LOAD', label: '产线排产负荷(生产域)', hash: '/panelx/list/LINE_LOAD', shot: false },
  { code: 'PURCHASE_IN', label: '采购入库单(智能供应链)', hash: '/panelx/list/PURCHASE_IN', shot: false },
  { code: 'SALE_OUT', label: '销售出库单(智能供应链)', hash: '/panelx/list/SALE_OUT', shot: false },
  { code: 'PU_ORDER', label: '采购订单(智能供应链)', hash: '/panelx/list/PU_ORDER', shot: false },
  { code: 'QC_INSP', label: '来料检验单(品质管理)', hash: '/panelx/list/QC_INSP', shot: false },
  { code: 'QC_CATALOG', label: '检验目录(品质管理)', hash: '/panelx/list/QC_CATALOG', shot: false },
  { code: 'RD_PROGRESS', label: '项目进度查询(研发)', hash: '/panelx/list/RD_PROGRESS', shot: false },
];

const results = [];
const record = (label, ok, detail = '') => {
  results.push({ label, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`);
};

const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
const token = login?.data?.token;
if (!token) { console.error('登录失败', JSON.stringify(login)); process.exit(1); }
const userJson = JSON.stringify(login.data.user);
const factoryJson = JSON.stringify({ code: login.data.user?.factory || 'YJ', name: 'YINJIA-MES' });
const loginDate = new Date().toISOString().slice(0, 10);

fs.mkdirSync(SHOTS, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-ui-pull-'));
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1600,1000',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
await sleep(3000);

const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0; const pending = new Map();
let errors = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    errors.push('console: ' + (m.params.args || []).map((a) => a.value || a.description || '').join(' ').slice(0, 240));
  }
  if (m.method === 'Runtime.exceptionThrown') {
    errors.push('exception: ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || '').slice(0, 240));
  }
};
const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value;
const navigate = async (url) => {
  await send('Page.navigate', { url });
  for (let i = 0; i < 60; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(800); return; } }
};
await send('Page.enable'); await send('Runtime.enable');

// 注入登录态(键名与前端 stores 一致),随后**整页重载**——同文档 hash 变更不会重建 Pinia store
await navigate(BASE + '/#/login');
await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(userJson)}); localStorage.setItem('mes_factory', ${JSON.stringify(factoryJson)}); localStorage.setItem('mes_login_date', ${JSON.stringify(loginDate)}); 'ok'`);
await navigate('about:blank');

for (const p of PAGES) {
  errors = [];
  await navigate(`${BASE}/?t=${Date.now()}#${p.hash}`);
  await sleep(3200);
  const hasTable = await evaluate(`!!document.querySelector('.el-table') || !!document.querySelector('.el-empty') || !!document.querySelector('.board, .sb-wrap, .oc-wrap, .wob-wrap')`);
  const bodyText = (await evaluate('document.body.innerText || ""')) || '';
  const real = errors.filter((e) => !e.includes('favicon') && !e.includes('WebSocket connection'));
  const ok = real.length === 0 && !/404|页面不存在|资源不存在/.test(bodyText.slice(0, 400));
  record(`${p.label} 渲染`, ok && !!hasTable,
    `table=${hasTable} 文本长度=${bodyText.length}${real.length ? ' | ' + real.slice(0, 2).join(' ; ') : ''}`);
  if (p.shot) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const data = shot?.result?.data;
    if (data) fs.writeFileSync(path.join(SHOTS, `${p.code}.png`), Buffer.from(data, 'base64'));
  }
}

ws.close();
edge.kill();
try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }

const bad = results.filter((r) => !r.ok);
console.log(`\n=== 界面走查汇总: ${results.length - bad.length}/${results.length} 通过;截图目录 ${SHOTS} ===`);
if (bad.length) { bad.forEach((b) => console.log('  BAD', b.label, b.detail)); process.exit(1); }
