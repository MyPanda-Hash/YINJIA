/**
 * _verify-rail-pager.mjs — 左栏「单据选择」顶/底翻页条实测(50 条/页整页翻)
 * 用法: node tools/archive/_verify-rail-pager.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONT = 'http://localhost:5173';
const API = 'http://localhost:8090/api';
const PORT = 9385;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = path.join(__dirname, '_so-rail-shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CASES = [
  { panel: 'PURCHASE_IN', expectTotal: 59, expectPages: 2, expectLastRows: 9 },
  { panel: 'PU_ORDER', expectTotal: 2137, expectPages: 43 },
  { panel: 'SL_RECV', expectTotal: 5, expectPages: 1 },
];
let fails = 0;
const ok = (c, msg) => { console.log(`  ${c ? '[PASS]' : '[FAIL]'} ${msg}`); if (!c) fails++; };

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const lj = await (await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json();
  const token = lj?.data?.token, user = lj?.data?.user;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-railpage-'));
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

    const readRail = `(() => {
      const rail = document.querySelector('.doc-select-rail');
      if (!rail) return { none: true };
      const pagers = [...rail.querySelectorAll('.drp')].map((p) => ({
        text: p.querySelector('.drp-no')?.textContent.replace(/\\s+/g, ' ').trim() || '',
        off: [...p.querySelectorAll('.drp-btn')].map((b) => b.classList.contains('off')),
        titles: [...p.querySelectorAll('.drp-btn')].map((b) => b.title),
      }));
      const rows = [...rail.querySelectorAll('.dsr-grid tbody tr')].map((tr) => tr.children[0]?.textContent.trim());
      const real = rows.filter((t) => t && t !== '暂无数据');
      return {
        count: rail.querySelector('.dsr-count')?.textContent.replace(/\\s+/g, ' ').trim() || '',
        first: real[0], last: real[real.length - 1], rows: real.length,
        active: rail.querySelector('tr.active')?.children[0]?.textContent.trim() || '',
        pagers, chip: document.querySelector('.doc-chip')?.textContent.trim() || '',
      };
    })()`;
    // 点第 n 条(0=顶层,1=底层)翻页条上的按钮(title 定位;顶层/底层按 DOM 顺序)
    const clickBtn = (strip, title) => ev(`(() => {
      const rail = document.querySelector('.doc-select-rail'); if (!rail) return 'no-rail';
      const p = [...rail.querySelectorAll('.drp')][${strip}]; if (!p) return 'no-strip';
      const b = [...p.querySelectorAll('.drp-btn')].find((x) => x.title === ${JSON.stringify(title)});
      if (!b) return 'no-btn'; b.click(); return 'ok';
    })()`);

    for (const c of CASES) {
      const url = `${FRONT}/?_v=${Date.now()}#/panelx/list/${c.panel}`;
      await send('Page.navigate', { url });
      for (let i = 0; i < 80; i++) { await sleep(400); if (await ev(`!!document.querySelector('.doc-select-rail .drp')`)) break; }
      await sleep(2000);
      console.log(`\n=== ${c.panel} ===`);
      let st = await ev(readRail);
      console.log('  初始:', JSON.stringify({ count: st.count, rows: st.rows, first: st.first, last: st.last, pagers: st.pagers }));
      ok(st.pagers.length === 2, `左栏顶/底各一条翻页条(实得 ${st.pagers.length} 条)`);
      ok((st.count || '').includes(String(c.expectTotal)), `「共有数据」= 全量 ${c.expectTotal} 条(实得 ${JSON.stringify(st.count)})`);
      ok(st.pagers[0]?.text === st.pagers[1]?.text, '顶/底两条页码一致');
      ok((st.pagers[0]?.text || '').includes(`1/${c.expectPages}`), `初始页码 1/${c.expectPages}(实得 ${JSON.stringify(st.pagers[0]?.text)})`);
      ok(st.rows === (c.expectPages > 1 ? 50 : c.expectTotal), `每页条数 = ${c.expectPages > 1 ? 50 : c.expectTotal}(实得 ${st.rows})`);
      if (c.expectPages === 1) {
        ok(st.pagers[0]?.off?.every(Boolean), '只有 1 页时 4 个按钮全部置灰');
        continue;
      }
      // 顶层 ▶ 下一页 → 第 2 页(末页时按钮应置灰)
      await clickBtn(0, '下一页'); await sleep(1600);
      st = await ev(readRail);
      console.log('  顶层「下一页」→', JSON.stringify({ pagers: st.pagers[0]?.text, rows: st.rows, first: st.first, active: st.active, chip: st.chip }));
      ok((st.pagers[0]?.text || '').includes(`2/${c.expectPages}`), `翻到第 2 页(期望 2/${c.expectPages},实得 ${st.pagers[0]?.text})`);
      if (c.expectLastRows) {
        ok(st.rows === c.expectLastRows, `末页条数 ${c.expectLastRows}(实得 ${st.rows})`);
        ok(st.pagers[1]?.off?.[2] === true && st.pagers[1]?.off?.[3] === true, '末页时「下一页/末页」置灰');
      } else {
        ok(st.rows === 50, `非末页仍 50 条(实得 ${st.rows})`);
        ok(st.pagers[1]?.off?.[2] === false && st.pagers[1]?.off?.[3] === false, '非末页时「下一页/末页」可用');
      }
      ok(st.active === st.first, '当前单据 = 新页首张(高亮同步)');
      // 底层 ◀ 上一页 → 回首页
      await clickBtn(1, '上一页'); await sleep(1600);
      st = await ev(readRail);
      console.log('  底层「上一页」→', JSON.stringify({ pagers: st.pagers[0]?.text, rows: st.rows, first: st.first }));
      ok((st.pagers[0]?.text || '').includes('1/'), '底层按钮同样生效,回到第 1 页');
      ok(st.rows === 50, `回到第 1 页 50 条(实得 ${st.rows})`);
      ok(st.pagers[0]?.off?.[0] === true && st.pagers[0]?.off?.[1] === true, '首页时「首页/上一页」置灰');
      // 顶层 ▷ 末页 / ◁ 首页
      await clickBtn(0, '末页'); await sleep(1600);
      st = await ev(readRail);
      const atEnd = (st.pagers[0]?.text || '').includes(`${c.expectPages}/${c.expectPages}`);
      ok(atEnd, `「末页」按钮直达末页(${st.pagers[0]?.text})`);
      await clickBtn(0, '首页'); await sleep(1600);
      st = await ev(readRail);
      ok((st.pagers[0]?.text || '').includes('1/'), `「首页」按钮回第 1 页(${st.pagers[0]?.text})`);
      // 边界:首页再点「上一页」不应变化
      await clickBtn(0, '上一页'); await sleep(900);
      st = await ev(readRail);
      ok((st.pagers[0]?.text || '').includes('1/') && st.rows === 50, '首页点「上一页」无变化(不越界)');
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true });
      const f = path.join(OUT, `railpager-${c.panel}.png`);
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
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
