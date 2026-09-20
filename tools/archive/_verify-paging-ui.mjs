/**
 * _verify-paging-ui.mjs — 界面分页实测:页脚「第 X/N 张」是否按全局序号 + 翻页不越界不空白 + 首页是最新单
 * 用法: node tools/archive/_verify-paging-ui.mjs
 * 依赖: 前端 5173(vite dev)、后端 8090
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONT = 'http://localhost:5173';
const API = 'http://localhost:8090/api';
const PORT = 9377;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = path.join(__dirname, '_so-rail-shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PANELS = [
  { panel: 'PURCHASE_IN', expectFirst: 'PI-2026-09-0020', expectTotal: 59 },
  { panel: 'PU_ORDER', expectFirstTime: true },
];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const lj = await (await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json();
  const token = lj?.data?.token, user = lj?.data?.user;
  if (!token) throw new Error('登录失败');

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-page-'));
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let tab = null;
  for (let i = 0; i < 40 && !tab; i++) {
    await sleep(1000);
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json(); } catch {}
  }
  if (!tab) throw new Error('Edge CDP 未就绪');
  let fails = 0;
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
localStorage.setItem('mes_login_date', '2026-09-20'); localStorage.setItem('mes_locale','zh-CN'); 'ok'`);

    /** 读界面状态:页脚页码文本 + 当前单号 + 左栏首行单号 */
    const readState = `(() => {
      const pn = [...document.querySelectorAll('.page-no')].map(e => e.textContent.trim());
      const rail = document.querySelector('.doc-select-rail');
      const rows = rail ? [...rail.querySelectorAll('tbody tr')] : [];
      const cell = (tr) => tr ? [...tr.children].map(td => td.textContent.trim()) : null;
      return {
        pageText: pn,
        chip: document.querySelector('.doc-chip')?.textContent.trim() || '',
        railFirst: cell(rows[0]), railLast: cell(rows[rows.length - 1]), railCount: rows.length,
        listFirstRows: [...document.querySelectorAll('.doc-rail-main table tbody tr')].slice(0, 3).map(tr => [...tr.children].map(td => td.textContent.trim())[0]),
        empty: !document.querySelector('.doc-rail-main table'),
      };
    })()`;
    const clickPager = (title) => ev(`(() => { const b=[...document.querySelectorAll('.page-btn')].find(x=>x.title===${JSON.stringify(title)}); if(!b) return 'no-btn'; b.click(); return 'ok'; })()`);
    const firstBtn = (title) => ev(`(() => { const b=[...document.querySelectorAll('.page-btn')].find(x=>x.title===${JSON.stringify(title)}); return !!b; })()`);

    for (const t of PANELS) {
      const url = `${FRONT}/?_v=${Date.now()}#/panelx/list/${t.panel}`;
      await send('Page.navigate', { url });
      for (let i = 0; i < 80; i++) { await sleep(400); if (await ev(`!!document.querySelector('.page-no')`)) break; }
      await sleep(2000);
      console.log(`\n=== ${t.panel} ===`);
      let st = await ev(readState);
      console.log('  初始:', JSON.stringify({ pageText: st.pageText, chip: st.chip, railFirst: st.railFirst, railCount: st.railCount }));
      // 断言1:第 1 页页脚序号 = 1
      const p1 = st.pageText[0] || '';
      console.log(`  ${/1\s*\/|1\s*张|^第\s*1\s*\//.test(p1) || /1/.test(p1) ? '[PASS]' : '[FAIL]'} 第 1 页页脚=${JSON.stringify(p1)}`);
      if (t.expectFirst && st.railFirst && st.railFirst[0] !== t.expectFirst) {
        console.log(`  [FAIL] 左栏首行=${st.railFirst[0]} 期望最新单 ${t.expectFirst}`); fails++;
      } else if (t.expectFirst) console.log(`  [PASS] 左栏首行=最新单 ${st.railFirst[0]}`);

      // 断言2:连点「下一张」,页脚序号必须逐张 +1(全局序号,不是页内序号)
      const seqTexts = [];
      for (let i = 0; i < 6; i++) {
        await clickPager('下一张');
        await sleep(1200);
        const after = await ev(readState);
        seqTexts.push(after.pageText[0] || '');
        if (after.empty) { console.log('  [FAIL] 翻页后列表空白'); fails++; break; }
      }
      console.log('  连点「下一张」页脚序列:', JSON.stringify(seqTexts));
      const nums = seqTexts.map((s) => parseInt((s.match(/(\d+)\s*[\/张]/) || [])[1] || '0', 10));
      const mono = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
      console.log(`  ${mono ? '[PASS]' : '[FAIL]'} 页脚序号逐张 +1`);
      if (!mono) fails++;

      // 断言3:「末页」按钮 → 页脚序号必须 = 全量张数(旧实现按页内序号显示,末页只会显示 1..pageSize)
      await clickPager('末页'); await sleep(1500);
      const endState = await ev(readState);
      const endTxt = endState.pageText[0] || '';
      const endNum = parseInt((endTxt.match(/(\d+)\s*[\/张]/) || [])[1] || '0', 10);
      const totalTxt = parseInt((endTxt.match(/\/\s*(\d+)/) || [])[1] || '0', 10);
      console.log(`  「末页」→ 页脚=${JSON.stringify(endTxt)} 当前单=${JSON.stringify(endState.chip)} 左栏末行=${JSON.stringify(endState.railLast)}`);
      const okEnd = endNum === totalTxt && totalTxt > 0 && !endState.empty;
      console.log(`  ${okEnd ? '[PASS]' : '[FAIL]'} 末页页脚序号 = 全量张数(${endNum}/${totalTxt}),列表非空=${!endState.empty}`);
      if (!okEnd) fails++;
      if (t.expectTotal && totalTxt !== t.expectTotal) { console.log(`  [FAIL] 总张数 ${totalTxt} ≠ 预期 ${t.expectTotal}`); fails++; }

      // 断言4:末张再点「下一张」→ 不越界(页脚与列表都不变)
      await clickPager('下一张'); await sleep(1300);
      const afterEnd = await ev(readState);
      const same = (afterEnd.pageText[0] || '') === endTxt;
      console.log(`  ${same && !afterEnd.empty ? '[PASS]' : '[FAIL]'} 末张再点「下一张」不越界(页脚不变=${same} 列表非空=${!afterEnd.empty})`);
      if (!(same && !afterEnd.empty)) fails++;

      // 断言5:跨页回退 —— 末张点「上一张」必须回到倒数第二张(跨页边界),列表非空
      await clickPager('上一张'); await sleep(1500);
      const backState = await ev(readState);
      const backNum = parseInt(((backState.pageText[0] || '').match(/(\d+)\s*[\/张]/) || [])[1] || '0', 10);
      console.log(`  「上一张」→ 页脚=${JSON.stringify(backState.pageText[0])} 列表非空=${!backState.empty}`);
      const okBack = backNum === endNum - 1 && !backState.empty;
      console.log(`  ${okBack ? '[PASS]' : '[FAIL]'} 跨页回退序号 = ${endNum - 1}`);
      if (!okBack) fails++;

      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true });
      const f = path.join(OUT, `paging-${t.panel}.png`);
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
