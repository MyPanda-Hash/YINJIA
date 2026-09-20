/**
 * _verify-rail-search.mjs — 左栏「单据选择」模糊搜索实测:**全库跨页**命中(后端 keyword)
 * 用法: node tools/archive/_verify-rail-search.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONT = 'http://localhost:5173';
const API = 'http://localhost:8090/api';
const PORT = 9391;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = path.join(__dirname, '_so-rail-shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, msg) => { console.log(`  ${c ? '[PASS]' : '[FAIL]'} ${msg}`); if (!c) fails++; };

// deepNo = 未过滤时排在后面的单据(用于证明"跨页命中":第 1 页取不到它)
// expectHits = 全库命中张数(旧的本页内过滤只会数到当前页,采购入库 TCGRK 本页只有 48 张 → 全库 51 张就是跨页铁证)
const CASES = [
  { panel: 'PURCHASE_IN', kw: 'TCGRK', unfiltered: 59, expectHits: 51 },
  { panel: 'PU_ORDER', kw: 'YJ-20250406-01', deepNo: 'YJ-20250406-01', unfiltered: 2137, expectHits: 1 },
];

const login = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
const token = login?.data?.token, user = login?.data?.user;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-railkw-'));
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

  const state = `(() => {
    const rail = document.querySelector('.doc-select-rail');
    const rows = [...rail.querySelectorAll('.dsr-grid tbody tr')].map((tr) => tr.children[0]?.textContent.trim()).filter((t) => t && t !== '暂无数据');
    return {
      selects: rail.querySelectorAll('.dsr-filters .el-select').length,
      ph: rail.querySelector('.dsr-kw input')?.placeholder || '',
      val: rail.querySelector('.dsr-kw input')?.value || '',
      count: rail.querySelector('.dsr-count')?.textContent.replace(/\\s+/g, ' ').trim() || '',
      pageText: rail.querySelector('.drp-no')?.textContent.replace(/\\s+/g, ' ').trim() || '',
      rows: rows.length, first: rows[0], list: rows.slice(0, 3),
      chip: document.querySelector('.doc-chip')?.textContent.trim() || '',
      topCount: document.querySelector('.page-no')?.textContent.trim() || '',
    };
  })()`;
  const type = (v) => ev(`(() => {
    const el = document.querySelector('.doc-select-rail .dsr-kw input');
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('.doc-select-rail .dsr-filters .el-button').click(); return 'ok';
  })()`);

  for (const c of CASES) {
    const url = `${FRONT}/?_v=${Date.now()}#/panelx/list/${c.panel}`;
    await send('Page.navigate', { url });
    for (let i = 0; i < 80; i++) { await sleep(400); if (await ev(`!!document.querySelector('.doc-select-rail .drp-no')`)) break; }
    await sleep(2000);
    console.log(`\n=== ${c.panel} 左栏模糊搜索 ===`);
    let st = await ev(state);
    console.log('  初始:', JSON.stringify({ ph: st.ph, count: st.count, pageText: st.pageText, rows: st.rows }));
    ok(st.selects === 0, `查找栏无「部门」下拉(实得 .el-select ${st.selects})`);
    ok(st.ph === '模糊搜索', `占位 = 模糊搜索(实得 ${JSON.stringify(st.ph)})`);
    ok((st.count || '').includes(String(c.unfiltered)), `初始「共有数据」= ${c.unfiltered}(实得 ${JSON.stringify(st.count)})`);
    if (c.deepNo) ok(!st.list.includes(c.deepNo), `未搜索时第 1 页取不到 ${c.deepNo}(证明它在后面的页)`);

    await type(c.kw); await sleep(1800);
    st = await ev(state);
    console.log(`  搜索「${c.kw}」→`, JSON.stringify({ count: st.count, pageText: st.pageText, rows: st.rows, list: st.list, chip: st.chip, topCount: st.topCount }));
    ok(st.rows > 0, `全库命中并列出(本页 ${st.rows} 行)`);
    ok(st.rows <= 50, `本页最多 50 行(实得 ${st.rows})`);
    ok((st.count || '').includes(`${c.expectHits} 条`), `全库命中 ${c.expectHits} 张(实得 ${JSON.stringify(st.count)})`);
    ok((st.count || '').includes('模糊搜索'), `计数注明生效中的关键字(${JSON.stringify(st.count)})`);
    ok(!(st.count || '').includes(String(c.unfiltered)), `「共有数据」已变成命中张数(不再显示全量 ${c.unfiltered})`);
    ok((st.pageText || '').includes('/'), `翻页条按命中结果重算页码(${JSON.stringify(st.pageText)})`);
    if (c.deepNo) {
      ok(st.list[0] === c.deepNo || st.chip.includes(c.deepNo), `跨页命中:直接取到后面的单据 ${c.deepNo}(实得 ${JSON.stringify(st.list)})`);
      ok(st.topCount.includes('/1 '), `页脚同步为命中结果(实得 ${JSON.stringify(st.topCount)})`);
    }

    await type(''); await sleep(1800);
    st = await ev(state);
    console.log('  清空 →', JSON.stringify({ count: st.count, pageText: st.pageText, rows: st.rows }));
    ok((st.count || '').includes(String(c.unfiltered)) && st.rows === 50, `清空后恢复全量 ${c.unfiltered} 张 / 本页 50 行`);
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true });
    const f = path.join(OUT, `railsearch-${c.panel}.png`);
    fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'));
    console.log('  截图:', f);
  }
  ws.close();
} finally {
  edge.kill();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
}
console.log(fails ? `\n${fails} 项失败` : '\n全部通过');
process.exit(fails ? 1 : 0);
