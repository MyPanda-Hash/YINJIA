// 一次性取证探针(2026-10-06):「直接点空行选工序 → 自动新增一行」取证。
// 只驱动真实浏览器(Edge headless + CDP),只读 + 只点,不点保存、不落库(ROUTE 参照确认按已定口径本就不落库)。
//
// 用法(仓库根): node tools/archive/_route-addrow-probe.mjs [base] [docNo]
//   默认 base = http://127.0.0.1:5173 (vite 源码热更) / docNo = 面板列表第一张
// 产出:控制台 DOM 取证(行数/ph-row/参照弹窗标题/带入后单元格文本)+ 截图 tools/archive/_route-addrow-*.png
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:5173';
const DOC = process.argv.find((a) => /^(GY|ROUTE)/i.test(a)) || '';
const TAG = process.argv.find((a) => a.startsWith('--tag='))?.slice(6) || (DOC || 'default');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9362;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const login = await (await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
const token = login?.data?.token;
if (!token) { console.error('登录失败', JSON.stringify(login).slice(0, 300)); process.exit(1); }
const userJson = JSON.stringify(login.data.user || {});
const factoryJson = JSON.stringify({ code: login.data.user?.factory || 'YJ', name: 'YINJIA-MES' });

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-route-'));
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--window-size=1680,1000', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, 'about:blank'],
  { stdio: 'ignore' });

const D = 'document.querySelector(".panelx-list .detail")';
// 单元格文本:参照列是 el-input(readonly),innerText 为空 ⇒ 取 input.value
const CELLTXT = `(td)=>{const i=td.querySelector('input');return i?('input:'+i.value):td.querySelector('.cell')?.innerText.trim()}`;
const ROWS = `JSON.stringify([...${D}.querySelectorAll('.el-table__body-wrapper tbody tr')].map(tr=>({
  ph: tr.classList.contains('ph-row'),
  cells: [...tr.querySelectorAll('td')].map(td=>(${CELLTXT})(td)),
})))`;
const CLICK = (which, colName) => `(() => {
  const d = ${D};
  const trs = [...d.querySelectorAll('.el-table__body-wrapper tbody tr')];
  const tr = ${which === 'ph' ? `trs.find(t=>t.classList.contains('ph-row'))` : `trs.filter(t=>!t.classList.contains('ph-row'))[${which}]`};
  if (!tr) return 'no-row';
  const ths = [...d.querySelectorAll('.el-table__header th')];
  const idx = ths.findIndex(th => (th.querySelector('.cell')?.innerText || '').trim().startsWith(${JSON.stringify(colName)}));
  if (idx < 0) return 'no-col';
  const td = tr.querySelectorAll('td')[idx];
  if (!td) return 'no-td';
  td.scrollIntoView({ block: 'center' });
  // 参照列的 @click 挂在 el-input 上(不是 td) ⇒ 真用户点的是输入框本身;占位行无 input,退化为点 td(走 el-table row-click)
  const hit = td.querySelector('input') || td;
  const r = hit.getBoundingClientRect();
  for (const t of ['mousedown','mouseup','click']) hit.dispatchEvent(new MouseEvent(t,{bubbles:true,clientX:r.x+5,clientY:r.y+5}));
  return 'clicked col#'+idx+' on '+(hit.tagName||'?');
})()`;
const BTN = (text) => `(()=>{const b=[...document.querySelectorAll('.el-dialog__footer .el-button')].find(b=>b.innerText.includes(${JSON.stringify(text)}));if(!b)return 'no-btn';if(b.disabled)return 'disabled';b.click();return 'ok'})()`;

let ws;
try {
  let tab = null;
  for (let i = 0; i < 40 && !tab; i++) {
    await sleep(500);
    try { tab = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json(); } catch { /* retry */ }
  }
  if (!tab) { console.error('Edge CDP 未就绪'); process.exit(1); }
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let seq = 0; const pending = new Map();
  const netLog = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.method === 'Network.requestWillBeSent' && m.params?.request?.url?.includes('/api/')) {
      netLog.push({ m: m.params.request.method, u: m.params.request.url.replace(/^https?:\/\/[^/]+/, ''), b: String(m.params.request.postData || '').slice(0, 120) });
    }
    if (m.method === 'Runtime.exceptionThrown') {
      netLog.push({ exc: String(m.params?.exceptionDetails?.exception?.description || m.params?.exceptionDetails?.text || '').slice(0, 200) });
    }
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) return `«EXC» ${r.result.exceptionDetails.text}`;
    return r.result?.result?.value;
  };
  const shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ROOT, 'tools', 'archive', `_route-addrow-${TAG}-${name}.png`), Buffer.from(r.result.data, 'base64'));
  };
  const rows = async () => JSON.parse(await ev(ROWS));
  const dump = async (title) => {
    const rs = await rows();
    console.log(`  [${title}] 行数=${rs.length} 实=${rs.filter((r) => !r.ph).length} 占位=${rs.filter((r) => r.ph).length}`);
    rs.forEach((r, i) => console.log(`     row${i} ph=${r.ph} 工序(编码/名称)=${JSON.stringify(r.cells.slice(1, 3))} 工序控制=${JSON.stringify(r.cells[4])} 序列=${JSON.stringify(r.cells[10])}`));
    return rs;
  };
  const flushNet = (title) => {
    console.log(`  [${title}] 期间 /api 与异常 ${netLog.length} 条:`);
    for (const n of netLog.splice(0)) console.log('     ', JSON.stringify(n));
  };
  const openDialogFrom = async (which) => {
    console.log(`  点${which === 'ph' ? '占位空行' : '实行#' + which} 的「工序编码」格 =`, await ev(CLICK(which, '工序编码')));
    await sleep(2200);
    console.log('  弹窗打开 =', await ev(`!!document.querySelector('.rpd')`),
      '| 标题 =', await ev(`[...document.querySelectorAll('.el-dialog__title')].map(e=>e.innerText.trim()).join('|')`),
      '| 候选行数 =', await ev(`document.querySelectorAll('.rpd .el-table__body-wrapper tbody tr').length`));
  };
  const pickFirst = async () => {
    await ev(`(()=>{const cb=document.querySelector('.rpd .el-table__body-wrapper tbody tr .el-checkbox');if(cb)cb.click();return 'ok'})()`);
    await sleep(400);
  };

  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Page.navigate', { url: BASE + '/#/login' }); await sleep(2500);
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(userJson)}); localStorage.setItem('mes_factory', ${JSON.stringify(factoryJson)}); 'ok'`);
  await send('Page.navigate', { url: `${BASE}/?t=${Date.now()}#/panelx/list/ROUTE${DOC ? '?docNo=' + DOC : ''}` }); await sleep(7000);

  console.log(`\n########## ROUTE @ ${BASE} (doc=${DOC || '列表第一张'}) ##########`);
  console.log('单据 =', await ev(`JSON.stringify([...document.querySelectorAll('.panelx-list input')].slice(0,3).map(i=>i.value))`));
  await dump('初始');
  flushNet('装载');
  await shot('01-initial');

  /* ── 场景乙:点占位空行(末行垫行)的「工序编码」格 → 勾一行 → 确定导入 ── */
  console.log('\n=== 场景乙:点占位空行 → 选工序 → 确定导入(用户口径「直接选工序加一行」) ===');
  await openDialogFrom('ph');
  await pickFirst();
  console.log('  确定导入 =', await ev(BTN('确定导入')));
  await sleep(2500);
  console.log('  提示 =', await ev(`JSON.stringify([...document.querySelectorAll('.el-message')].map(m=>m.innerText.trim()))`));
  await dump('场景乙带入后');
  flushNet('场景乙确认');
  await shot('02-phrow-confirm');

  /* ── 场景丙:再点一次空行 → 取消 → 那行空行必须被撤掉(取消语义不回归) ── */
  console.log('\n=== 场景丙:点空行 → 取消(那行临时行必须撤掉) ===');
  await openDialogFrom('ph');
  console.log('  取消 =', await ev(BTN('取消')));
  await sleep(1500);
  await dump('场景丙取消后');

  /* ── 场景甲:点已有实行的「工序编码」格 → 覆盖那一行、不新增行(既有无绑定行为不回归) ── */
  console.log('\n=== 场景甲:点实行#1 的「工序编码」格(改写该行,不新增) ===');
  await openDialogFrom(1);
  await pickFirst();
  console.log('  确定导入 =', await ev(BTN('确定导入')));
  await sleep(2200);
  await dump('场景甲带入后');
  flushNet('场景甲确认');

  /* ── 场景丁:「新增数据」按钮既有路径不回归 ── */
  console.log('\n=== 场景丁:点「新增数据」(既有路径) ===');
  console.log('  按钮 =', await ev(`(()=>{const b=[...document.querySelectorAll('.panelx-list .detail .dt-head .el-button')].find(b=>b.innerText.includes('新增数据'));if(!b)return 'no-btn';b.click();return 'ok'})()`));
  await sleep(1200);
  await dump('场景丁新增数据后');
  await shot('03-after-addbutton');
  ws.close();
} finally {
  try { edge.kill(); } catch { /* ignore */ }
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
}
