/**
 * _probe-oc-order-ui.mjs — 订单结转页「新的在上、旧的在下面」真实界面取证(2026-10-18)
 *
 * 后端探针(_probe-oc-order.mjs)只证明接口顺序对;这里证明**页面上看到的顺序**也对:
 *   ① 打开页面(默认单日=今天)→ 今天没数据就点弹窗「跳转」到最近有数据的一天;
 *   ② 把日期档位切「近30天」→ 列表跨多张单;
 *   ③ 逐行读「下单日期」→ 必须**单调不增**(新的在上);末行应是区间里最旧的一张;
 *   ④ 截全屏图留档(tools/archive/_oc-order-20261018/_oc-order-ui.png);
 *   ⑤ 顺带记录页面异常/console.error。
 *
 * 用法:node tools/archive/_oc-order-20261018/_probe-oc-order-ui.mjs [--url http://127.0.0.1:8090] [--port 9412]
 * 前提:本机有 Edge;服务在跑(8090 或 5173 均可,5173 需 dev 代理到后端)。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const BASE = argOf('--url', 'http://127.0.0.1:8090');
const CDP_PORT = Number(argOf('--port', '9412'));
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p));
if (!EDGE) { console.log('[SKIP] 未找到 Edge,跳过界面取证'); process.exit(0); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (cond, msg, extra = '') => { if (!cond) fails++; console.log(`${cond ? '[PASS]' : '[FAIL]'} ${msg}${extra ? ' — ' + extra : ''}`); };

const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})).json();
const token = login?.data?.token;
if (!token) { console.log('[FAIL] 登录失败:', JSON.stringify(login).slice(0, 200)); process.exit(1); }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-oc-order-'));
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--window-size=1680,1000', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, 'about:blank'],
{ stdio: 'ignore' });

let ws, seq = 0; const pending = new Map(); const pageErrors = [];
try {
  let tab = null;
  for (let i = 0; i < 40 && !tab; i++) {
    await sleep(500);
    try { tab = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json(); } catch { /* retry */ }
  }
  if (!tab) throw new Error('Edge CDP 未就绪');
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
    if (m.method === 'Runtime.exceptionThrown') pageErrors.push('exception: ' + (m.params?.exceptionDetails?.exception?.description || m.params?.exceptionDetails?.text || ''));
    if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error') {
      pageErrors.push('console.error: ' + (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' '));
    }
  };
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
  const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
  await send('Page.enable'); await send('Runtime.enable');

  // 注入令牌(#/login 是真实源,能写 localStorage),再进业务页
  await send('Page.navigate', { url: BASE + '/#/login' });
  await sleep(2500);
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
            localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user || {}))});
            localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: 'YJ', name: 'YINJIA-MES' }))});
            localStorage.removeItem('mes_locale'); 'ok'`);
  // 纯 hash 变更不会重建文档 ⇒ 用户 store 还是启动时的空令牌,会被路由守卫踢回登录页。
  // 带一个查询串强制**整页重建**(2026-10-18 实测踩到:截图停在登录页)。
  await send('Page.navigate', { url: BASE + '/?probe=' + Date.now() + '#/prod/plan/orderConvert' });
  await sleep(6000);

  // 关新手引导(会盖住表格)
  for (let i = 0; i < 6; i++) {
    const hit = await ev(`(() => {
      const el = [...document.querySelectorAll('button, span, div')].find(e => e.innerText?.trim() === '下次再说' && e.offsetParent !== null);
      if (el) { el.click(); return 'clicked' }
      return document.querySelector('.el-overlay') ? 'overlay-no-btn' : 'none';
    })()`);
    if (hit === 'none') break;
    await sleep(800);
  }
  // 今天没数据 → 弹窗询问是否跳到最近有数据的一天:点「跳转」
  const jumped = await ev(`(() => {
    const btns = [...document.querySelectorAll('.el-message-box__btns button')];
    const go = btns.find(b => b.innerText.trim() === '跳转');
    if (go) { go.click(); return 'jumped' }
    return btns.length ? 'other-dialog:' + btns.map(b => b.innerText.trim()).join('/') : 'none';
  })()`);
  console.log('首屏日期弹窗处理:', jumped);
  await sleep(3500);

  // 切「近30天」(跨多张单,才看得出排序)
  const switched = await ev(`(async () => {
    const wrap = document.querySelector('.oc-mode .el-select__wrapper') || document.querySelector('.oc-mode input');
    if (!wrap) return 'no-select';
    wrap.click();
    await new Promise(r => setTimeout(r, 600));
    const items = [...document.querySelectorAll('.el-select-dropdown__item, .el-select-dropdown li')];
    const it = items.find(e => e.innerText.trim() === '近30天');
    if (!it) return 'no-option:' + items.map(e => e.innerText.trim()).join('/');
    it.click();
    return 'ok';
  })()`);
  console.log('日期档位切近30天:', switched);
  await sleep(3500);

  const read = await ev(`(() => {
    const rows = [...document.querySelectorAll('.oc-table .el-table__body-wrapper tbody tr')];
    const data = rows.map((tr) => {
      const tds = [...tr.querySelectorAll('td')].map(td => td.innerText.replace(/\\s+/g, ' ').trim());
      return tds.filter(Boolean);
    });
    return JSON.stringify({
      range: document.querySelector('.oc-range')?.innerText?.trim() || '',
      count: document.querySelector('.oc-count')?.innerText?.trim() || '',
      anchor: document.querySelector('.oc-bar .oc-date input')?.value || '',
      rows: data.length,
      head: data.slice(0, 6),
      tail: data.slice(-4),
    });
  })()`);
  const d = JSON.parse(read || '{}');
  console.log(`\n区间=${d.range} ${d.count} 行数=${d.rows} 锚点=${d.anchor}`);
  console.log('头几行:'); (d.head || []).forEach((r) => console.log('   ', r.join(' | ').slice(0, 120)));
  console.log('末几行:'); (d.tail || []).forEach((r) => console.log('   ', r.join(' | ').slice(0, 120)));

  // 表头列序:订单资料 / 行号 / 下单日期 ... → 找「下单日期」列下标
  const dates = (d.head || []).concat(d.tail || []).map((r) => r.find((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)) || '');
  ok((d.rows || 0) >= 2, '页面有条目(≥2)', `rows=${d.rows}`);
  let mono = true;
  const all = await ev(`(() => JSON.stringify([...document.querySelectorAll('.oc-table .el-table__body-wrapper tbody tr')].map((tr) => {
    const tds = [...tr.querySelectorAll('td')];
    const ds = tds.map(td => td.innerText.trim()).filter(x => /^\\d{4}-\\d{2}-\\d{2}$/.test(x));
    return ds[0] || '';
  })))()`);
  const dateList = JSON.parse(all || '[]');
  for (let i = 1; i < dateList.length; i++) if (dateList[i] && dateList[i - 1] && dateList[i] > dateList[i - 1]) { mono = false; break; }
  ok(mono, '③ 界面「下单日期」自上而下不递增(新的在上)',
    `首=${dateList.find(Boolean)} 末=${[...dateList].reverse().find(Boolean)}`);
  ok(pageErrors.length === 0, '④ 页面上没有异常', pageErrors.slice(0, 2).join(' | '));

  const shotFile = path.join(HERE, '_oc-order-ui.png');
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(shotFile, Buffer.from(shot.result.data, 'base64'));
  console.log('截图:', shotFile);
} finally {
  try { ws?.close(); } catch { /* ignore */ }
  edge.kill();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
}
console.log(fails ? `\n=== 存在 ${fails} 项失败 ===` : '\n=== 订单结转界面排序取证通过 ===');
process.exit(fails ? 1 : 0);
