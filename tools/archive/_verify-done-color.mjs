/**
 * _verify-done-color.mjs — 实测:「已完成」与「已审核」的状态色确实不同
 * 用法: node --experimental-websocket tools/archive/_verify-done-color.mjs
 * 断言:采购订单左侧「单据选择」栏里,已完成行与已审核行的状态标签计算色不同;
 *       右侧表头状态药丸同样不同。输出截图 tools/archive/_so-rail-shots/done-vs-audited.png
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FRONT = 'http://localhost:5173';
const API = 'http://localhost:8090/api';
const PORT = 9365;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = path.join(__dirname, '_so-rail-shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const lj = await (await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json();
  const token = lj?.data?.token, user = lj?.data?.user;
  if (!token) throw new Error('登录失败');
  console.log('[login] ok');

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-color-'));
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
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
    const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
    let nav = 0;
    const navigate = async (url) => {
      nav += 1;
      await send('Page.navigate', { url: url.replace('/#/', `/?_c=${nav}#/`) });
      for (let i = 0; i < 60; i++) { await sleep(300); if (await ev('document.readyState') === 'complete') { await sleep(1800); return; } }
    };
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1000, deviceScaleFactor: 1, mobile: false });
    await navigate(`${FRONT}/#/login`);
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_login_date', '2026-09-20');
localStorage.setItem('mes_locale', 'zh-CN'); 'ok'`);
    await navigate(`${FRONT}/#/panelx/list/PU_ORDER`);
    for (let i = 0; i < 60; i++) { if (await ev(`!!document.querySelector('.doc-select-rail tbody tr')`)) break; await sleep(500); }
    await sleep(1200);

    const styles = await ev(`(() => {
      const rail = document.querySelector('.doc-select-rail');
      const pick = (statusText) => {
        const tr = [...rail.querySelectorAll('tbody tr')].find(r => r.lastElementChild.textContent.trim() === statusText);
        if (!tr) return null;
        const tag = tr.querySelector('.dsr-tag');
        const cs = getComputedStyle(tag);
        return { 行: [...tr.children].map(td => td.textContent.trim()).join(' | '),
                 类: tag.className, 文字色: cs.color, 底色: cs.backgroundColor, 边框色: cs.borderTopColor };
      };
      return { 已完成: pick('已完成'), 已审核: pick('已审核'), 已中止: pick('已中止') };
    })()`);
    console.log('\n=== 左栏状态标签计算色 ===');
    for (const [k, v] of Object.entries(styles)) console.log(`  ${k}: ${v ? JSON.stringify(v) : '(本页无)'}`);

    const done = styles['已完成'], ok = styles['已审核'];
    const fails = [];
    const check = (c, m) => { console.log(`  ${c ? '[PASS]' : '[FAIL]'} ${m}`); if (!c) fails.push(m); };
    check(!!done && !!ok, '左栏同时存在「已完成」与「已审核」两类行,可对比');
    if (done && ok) {
      check(done.底色 !== ok.底色, `底色不同(已完成 ${done.底色} vs 已审核 ${ok.底色})`);
      check(done.文字色 !== ok.文字色, `文字色不同(已完成 ${done.文字色} vs 已审核 ${ok.文字色})`);
      check(done.类 !== ok.类, `标签类不同(已完成 ${done.类} vs 已审核 ${ok.类})`);
    }

    // 右侧表头当前单状态药丸(.doc-status)也对比一次:点一行已完成后读色
    const headColors = await ev(`(async () => {
      const rail = document.querySelector('.doc-select-rail');
      const trs = [...rail.querySelectorAll('tbody tr')];
      const find = (t) => trs.find(r => r.lastElementChild.textContent.trim() === t);
      const read = () => { const el = document.querySelector('.doc-status'); if (!el) return null; const cs = getComputedStyle(el); return { 状态: el.textContent.trim(), 文字色: cs.color, 底色: cs.backgroundColor }; };
      const out = {};
      const doneTr = find('已完成'), okTr = find('已审核');
      if (doneTr) { doneTr.click(); await new Promise(r => setTimeout(r, 1200)); out.已完成 = read(); }
      if (okTr) { okTr.click(); await new Promise(r => setTimeout(r, 1200)); out.已审核 = read(); }
      return out;
    })()`);
    console.log('\n=== 右侧表头状态药丸 ===');
    for (const [k, v] of Object.entries(headColors || {})) console.log(`  ${k}: ${v ? JSON.stringify(v) : '(无)'}`);
    if (headColors?.['已完成'] && headColors?.['已审核']) {
      check(headColors['已完成'].底色 !== headColors['已审核'].底色, '表头药丸底色不同');
      check(headColors['已完成'].文字色 !== headColors['已审核'].文字色, '表头药丸文字色不同');
    }

    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true });
    const f = path.join(OUT, 'done-vs-audited.png');
    fs.writeFileSync(f, Buffer.from(shot.result.data, 'base64'));
    console.log('\n[shot]', f);
    console.log(`\n===== 结果:${fails.length ? 'FAIL ' + fails.length + ' 项' : 'ALL PASS'} =====`);
    fails.forEach((x) => console.log('  ✗', x));
    if (fails.length) process.exitCode = 1;
    ws.close();
  } finally {
    edge.kill();
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
