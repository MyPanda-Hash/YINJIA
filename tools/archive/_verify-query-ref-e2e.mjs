/**
 * _verify-query-ref-e2e.mjs — 端到端:在查询弹窗里用「参照」挑基础资料 → 执行查询 → 结果与所选值一致
 * 用法: node tools/archive/_verify-query-ref-e2e.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONT = 'http://localhost:5173';
const API = 'http://localhost:8090/api';
const PORT = 9399;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = path.join(__dirname, '_so-rail-shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, msg) => { console.log(`  ${c ? '[PASS]' : '[FAIL]'} ${msg}`); if (!c) fails++; };

// 用例:面板 / 参照字段 / 参照弹窗里搜的关键字 / 期望选中的存值 / 结果里用于核对的列
const CASES = [
  { panel: 'PURCHASE_IN', field: '供应商', kw: '无锡安吉', expect: '无锡安吉环保科技有限公司', checkCol: 2, expectDocs: 2 },
  { panel: 'QC_INSP', field: '供应商', kw: '无锡安吉', expect: '无锡安吉环保科技有限公司', checkCol: 2, expectDocs: 2 },
];

const login = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
const token = login?.data?.token, user = login?.data?.user;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-qrefe2e-'));
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let tab = null;
for (let i = 0; i < 40 && !tab; i++) {
  await sleep(1000);
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json(); } catch {}
}
if (!tab) throw new Error('Edge CDP 未就绪');
try {
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

  for (const c of CASES) {
    const url = `${FRONT}/?_v=${Date.now()}#/panelx/list/${c.panel}`;
    await send('Page.navigate', { url });
    for (let i = 0; i < 80; i++) { await sleep(400); if (await ev(`!!document.querySelector('.toolbar-query-btn')`)) break; }
    await sleep(1800);
    console.log(`\n=== ${c.panel} · 弹窗里挑「${c.field}」再查询 ===`);
    await ev(`document.querySelector('.toolbar-query-btn').click(); 'ok'`);
    await sleep(1500);
    // 打开参照框
    await ev(`(() => {
      const box = [...document.querySelectorAll('.query-dialog-field')].find((b) => (b.querySelector('label')?.textContent||'').replace('*','').trim() === ${JSON.stringify(c.field)});
      box.querySelector('.query-ref .el-button').click(); return 'ok';
    })()`);
    await sleep(2000);
    // 参照框里按关键字查询
    await ev(`(() => {
      const inp = document.querySelector('.rpd-toolbar input');
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      set.call(inp, ${JSON.stringify(c.kw)}); inp.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('.rpd-toolbar .el-button').click(); return 'ok';
    })()`);
    await sleep(2000);
    const picked = await ev(`(() => {
      const rows = [...document.querySelectorAll('.rpd .el-table__body tbody tr')];
      if (!rows.length) return null;
      const first = rows[0];
      const cells = [...first.children].map((td) => td.textContent.trim());
      first.querySelector('.el-checkbox__original')?.click();
      return { cells };
    })()`);
    console.log('  参照框首行:', JSON.stringify(picked?.cells));
    ok(!!picked, '参照框按关键字过滤后有数据');
    // 确定
    await ev(`(() => {
      const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => /参照选择/.test(d.textContent||''));
      const btns = [...dlg.querySelectorAll('.el-dialog__footer .el-button')];
      const okb = btns.find((b) => /确定|确 定/.test(b.textContent)) || btns[btns.length-1];
      okb.click(); return 'ok';
    })()`);
    await sleep(1500);
    const val = await ev(`(() => {
      const box = [...document.querySelectorAll('.query-dialog-field')].find((b) => (b.querySelector('label')?.textContent||'').replace('*','').trim() === ${JSON.stringify(c.field)});
      return box.querySelector('input')?.value || '';
    })()`);
    console.log(`  回填到查询弹窗的「${c.field}」= ${JSON.stringify(val)}`);
    ok(val === c.expect, `回填值 = ${c.expect}`);
    // 执行查询
    await ev(`(() => {
      const btns = [...document.querySelectorAll('.el-dialog__footer .el-button')].filter((b) => b.offsetParent !== null);
      const q = btns.find((b) => /查询/.test(b.textContent));
      q.click(); return 'ok';
    })()`);
    await sleep(2500);
    const res = await ev(`(() => {
      const rail = document.querySelector('.doc-select-rail');
      const rows = rail ? [...rail.querySelectorAll('.dsr-grid tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent.trim())) : [];
      return { count: rail?.querySelector('.dsr-count')?.textContent.replace(/\\s+/g,' ').trim() || '', rows: rows.slice(0, 5), total: rows.length, pageText: document.querySelector('.page-no')?.textContent.trim() || '' };
    })()`);
    console.log('  查询结果:', JSON.stringify(res));
    ok(res.total > 0, `查询返回 ${res.total} 行(共 ${JSON.stringify(res.count)})`);
    const col = res.rows.map((r) => r[c.checkCol]);
    ok(col.every((v) => v === c.expect), `结果行「${c.field}」列全部 = ${c.expect};实得 ${JSON.stringify(col)}`);
    if (c.expectDocs) ok((res.count || '').includes(`${c.expectDocs} 条`), `命中张数 = ${c.expectDocs}(实得 ${JSON.stringify(res.count)})`);
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true });
    fs.writeFileSync(path.join(OUT, `qref-e2e-${c.panel}.png`), Buffer.from(r.result.data, 'base64'));
  }
  ws.close();
} finally {
  edge.kill();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
}
console.log(fails ? `\n${fails} 项失败` : '\n全部通过');
process.exit(fails ? 1 : 0);
