/**
 * 探针:订单结转页「左上角日期查询 + 分页 + 当天没数据弹窗询问」真实界面取证(2026-10-06)。
 *
 * 目的:后端只证明接口对,这里证明**页面上看到的就是要求的样子**:
 *   ① 打开即「单日 = 今天」;今天没待结转数据 → **弹窗询问**是否跳到最近有数据的一天(不静默跳转)
 *   ② 点「留在本日」→ 停在今天(空表,不跳走),空表里给出「跳到最近有数据的一天 <日期>」近路
 *   ③ 重开页面点「跳转」→ 落到最近有数据的一天,列表条数 = 该日条数
 *   ④ 切「近7天」→ 条数变窗口条数,区间文字同步
 *   ⑤ 分页:每页切 50 / 翻页生效(修的就是"一次全量渲染卡死")
 *   ⑥ 英语:新控件与新弹窗都走 tt()(Single day / Go / Stay on this day),工具条无裸中文
 *   ⑦ 全程记录页面报错(console error / 未捕获异常)
 *
 * 用法: node tools/archive/_probe-oc-date-ui.mjs [--url http://127.0.0.1:8090] [--tag after]
 * 前提:当天(本机日期)没有待结转数据 —— 否则弹窗场景无从触发,脚本会明确说明并跳过该分支。
 * ⚠ 页面加载一律用 waitFor 轮询 + 宽 sleep(实测冷启动首帧会慢,定长 sleep 偏短会假 FAIL)。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const argv = process.argv.slice(2);
const argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const BASE = argOf('--url', 'http://127.0.0.1:8090');
const TAG = argOf('--tag', 'after');
const CDP_PORT = Number(argOf('--port', '9411'));
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (cond, msg, extra = '') => {
  results.push(!!cond);
  console.log(`${cond ? '✅' : '❌'} ${msg}${extra ? ' — ' + extra : ''}`);
};
const pad2 = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const TODAY = fmt(new Date());

/* ---------- CDP 薄封装 ---------- */
async function withEdge(fn) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-oc-'));
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1680,1000', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, 'about:blank'],
    { stdio: 'ignore' });
  try {
    let tab = null;
    for (let i = 0; i < 40 && !tab; i++) {
      await sleep(500);
      try { tab = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json(); } catch { /* retry */ }
    }
    if (!tab) throw new Error('Edge CDP 未就绪');
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let seq = 0; const pending = new Map(); const errors = [];
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
      if (m.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (m.params?.exceptionDetails?.exception?.description || m.params?.exceptionDetails?.text || ''));
      if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error') {
        errors.push('console.error: ' + (m.params.args || []).map((a) => a.value ?? a.description ?? '').join(' '));
      }
    };
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
    const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
    const shot = async (name) => {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const file = path.join(ROOT, 'tools', 'archive', `_oc-date-${TAG}-${name}.png`);
      fs.writeFileSync(file, Buffer.from(r.result.data, 'base64'));
      return file;
    };
    await send('Page.enable'); await send('Runtime.enable');
    await fn({ ev, shot, send, errors });
    ws.close();
    return errors;
  } finally {
    edge.kill();
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

/** 关掉「MES 初始化配置」新手引导弹窗(它会盖住表格,影响截图与点击) */
async function dismissOnboarding(ev) {
  for (let i = 0; i < 6; i++) {
    const hit = await ev(`(() => {
      const el = [...document.querySelectorAll('button, span, div')].find(e => e.innerText?.trim() === '下次再说' && e.offsetParent !== null);
      if (el) { el.click(); return 'clicked' }
      return document.querySelector('.el-overlay') ? 'overlay-no-btn' : 'none';
    })()`);
    if (hit === 'none') return true;
    await sleep(700);
  }
  return false;
}

/* ---------- 页面读数 ---------- */
const READ = `(() => {
  const t = (sel) => document.querySelector(sel)?.innerText?.trim() || '';
  const rows = [...document.querySelectorAll('.el-table__body-wrapper tbody tr')];
  const first = rows[0] ? [...rows[0].querySelectorAll('td')].map(td => td.innerText.trim()).filter(Boolean) : [];
  return JSON.stringify({
    modeText: t('.oc-bar .oc-mode'),
    anchor: document.querySelector('.oc-bar .oc-date input')?.value || '',
    range: t('.oc-range'),
    count: t('.oc-count'),
    summary: t('.oc-summary'),
    rows: rows.length,
    firstRow: first,
    pager: t('.el-pagination__total'),
    empty: t('.oc-empty'),
    emptyBtns: [...document.querySelectorAll('.oc-empty .el-button')].map(b => b.innerText.trim()),
    box: (() => { const b = document.querySelector('.el-message-box'); return b ? {
      title: b.querySelector('.el-message-box__title')?.innerText?.trim() || '',
      message: b.querySelector('.el-message-box__message')?.innerText?.trim() || '',
      buttons: [...b.querySelectorAll('.el-message-box__btns button')].map(x => x.innerText.trim()),
    } : null })(),
  });
})()`;

const waitFor = async (ev, pred, ms = 15000) => {
  const t0 = Date.now();
  for (;;) {
    const s = JSON.parse(await ev(READ));
    if (pred(s)) return s;
    if (Date.now() - t0 > ms) return s;
    await sleep(400);
  }
};

async function clickBox(ev, label) {
  return await ev(`(() => {
    const b = document.querySelector('.el-message-box');
    if (!b) return 'no-box';
    const btn = [...b.querySelectorAll('.el-message-box__btns button')].find(x => x.innerText.trim() === ${JSON.stringify(label)});
    if (!btn) return 'no-btn:' + [...b.querySelectorAll('.el-message-box__btns button')].map(x => x.innerText.trim()).join('|');
    btn.click(); return 'ok';
  })()`);
}

async function pickOption(ev, selectSel, label) {
  await ev(`(() => { const el = document.querySelector(${JSON.stringify(selectSel)}); el.querySelector('.el-select__wrapper').click(); return 'ok' })()`);
  await sleep(500);
  const hit = await ev(`(() => {
    const items = [...document.querySelectorAll('.el-select-dropdown__item')].filter(e => e.offsetParent !== null);
    const it = items.find(e => e.innerText.trim() === ${JSON.stringify(label)}) || items.find(e => e.innerText.trim().startsWith(${JSON.stringify(label)}));
    if (!it) return 'miss:' + items.map(e => e.innerText.trim()).join('|');
    it.click(); return 'ok';
  })()`);
  await sleep(1200);
  return hit;
}

/** 真键盘录入(合成 input 事件不会让 el-date-picker 提交值,必须走 CDP Input 域) */
async function typeDate(send, ev, inputSel, text) {
  await ev(`(() => { const i = document.querySelector(${JSON.stringify(inputSel)}); i.focus(); i.select(); return 'ok' })()`);
  await sleep(200);
  await send('Input.insertText', { text });
  await sleep(300);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await sleep(1500);
}

/* ---------- 主流程 ---------- */
const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
const token = login.data?.token;
if (!token) { console.error('登录失败:', JSON.stringify(login).slice(0, 200)); process.exit(1); }
const post = async (p, body) => (await (await fetch(BASE + '/api' + p, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body),
})).json());
const all = (await post('/px/orderConvert/pending', { keyword: '' })).data || [];
const latest = all.map((r) => r['下单日期']).sort().pop();
const dayCount = all.filter((r) => r['下单日期'] === latest).length;
const todayCount = all.filter((r) => r['下单日期'] === TODAY).length;
const weekFrom = (() => { const [y, m, d] = latest.split('-').map(Number); const dt = new Date(y, m - 1, d); dt.setDate(dt.getDate() - 6); return fmt(dt); })();
const weekCount = all.filter((r) => r['下单日期'] >= weekFrom && r['下单日期'] <= latest).length;
console.log(`基线(接口): 全量 ${all.length} 行 / 今天(${TODAY}) ${todayCount} 行 / 最近有数据的一天 ${latest} ${dayCount} 行 / 近7天(${weekFrom}~${latest}) ${weekCount} 行\n`);
const canAsk = todayCount === 0 && !!latest && latest !== TODAY;
if (!canAsk) console.log('⚠ 今天已有待结转数据(或全库无数据),弹窗分支不做断言 —— 请在有"今天无数据"的账套上跑\n');

const errs = await withEdge(async ({ ev, shot, send }) => {
  // 先落在真实源上(about:blank 的 opaque origin 存不了 localStorage),注入令牌后再进业务页
  await send('Page.navigate', { url: BASE + '/#/login' });
  await sleep(3000);
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user || {}))}); localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: login.data.user?.factory || 'YJ', name: 'YINJIA-MES' }))}); localStorage.removeItem('mes_locale'); 'ok'`);
  await send('Page.navigate', { url: `${BASE}/?t=${Date.now()}#/prod/plan/orderConvert` });
  await sleep(9000);
  await dismissOnboarding(ev);
  await sleep(500);

  // ① 打开页面:默认「单日 = 今天」;今天没数据 → 弹窗询问(不静默跳转)
  let s = await waitFor(ev, (x) => x.box || x.rows > 0, 25000);
  check(s.modeText.includes('单日'), '① 打开即「单日」模式', `控件 "${s.modeText}"`);
  check(s.anchor === TODAY, '① 默认锚点 = 今天(没有静默跳到别的日期)', `日期框 "${s.anchor}"`);
  if (canAsk) {
    s = await waitFor(ev, (x) => x.box, 18000);
    check(!!s.box, '① 今天没数据 → **弹窗询问**,而不是直接跳走', s.box ? `"${s.box.title}" / "${s.box.message}"` : '无弹窗');
    if (s.box) {
      check(s.box.message.includes(TODAY) && s.box.message.includes(latest),
        '① 弹窗写明「今天 + 最近有数据的一天」两个日期', s.box.message);
      check(s.box.buttons.includes('跳转') && s.box.buttons.includes('留在本日'),
        '① 弹窗给出「跳转 / 留在本日」两个选择', s.box.buttons.join(' | '));
    }
    console.log('   截图:', await shot('ask-jump'));

    // ② 选「留在本日」→ 停在今天(空表),空表给近路
    await clickBox(ev, '留在本日');
    s = await waitFor(ev, (x) => !x.box, 10000);
    check(s.anchor === TODAY && s.rows === 0, '② 选「留在本日」→ 停在今天(空表,不跳转)', `锚点 ${s.anchor} 行数 ${s.rows}`);
    check(s.empty.includes(latest) && s.emptyBtns.some((b) => b.includes(latest)),
      '② 空表给出「跳到最近有数据的一天 <日期>」近路', `"${s.empty.replace(/\n/g, ' ')}"`);
    console.log('   截图:', await shot('stay-today'));

    // ③ 点近路按钮 → 跳到最近有数据的一天
    await ev(`(() => { const b = [...document.querySelectorAll('.oc-empty .el-button')].find(x => x.innerText.includes(${JSON.stringify(latest)})); if (!b) return 'miss'; b.click(); return 'ok' })()`);
    s = await waitFor(ev, (x) => x.anchor === latest && x.rows === dayCount, 15000);
    check(s.anchor === latest && s.rows === dayCount, '③ 近路按钮 → 落到最近有数据的一天', `锚点 ${s.anchor} / ${s.rows} 行(期望 ${dayCount})`);

    // ④ 重开页面点「跳转」→ 同样落到最近有数据的一天
    await send('Page.navigate', { url: `${BASE}/?t=${Date.now()}#/prod/plan/orderConvert` });
    await sleep(9000);
    await dismissOnboarding(ev);
    s = await waitFor(ev, (x) => x.box, 18000);
    check(!!s.box, '④ 重开页面仍会先问(不是记住上次选择就闷头跳)', s.box ? `"${s.box.message}"` : '无弹窗');
    await clickBox(ev, '跳转');
    s = await waitFor(ev, (x) => x.anchor === latest && x.rows === dayCount, 15000);
    check(s.anchor === latest && s.rows === dayCount, '④ 点「跳转」→ 落到最近有数据的一天', `锚点 ${s.anchor} / ${s.rows} 行`);
    check(s.range === '', '④ 单日模式不重复显示区间文字(日期框即区间)', `区间文字 "${s.range}"`);
    check(s.pager.includes(String(dayCount)), '④ 分页器总数与列表一致', `"${s.pager}"`);
    check(/未结转订单汇总（总订单笔数: \d+/.test(s.summary), '④ 汇总条「未结转」仍是全量口径', s.summary.slice(0, 88));
    console.log('   截图:', await shot('single-day'));
  }

  // ⑤ 切「近7天」
  const pick = await pickOption(ev, '.oc-bar .oc-mode', '近7天');
  check(pick === 'ok', '⑤ 档位下拉可选「近7天」', pick);
  s = await waitFor(ev, (x) => x.rows === weekCount, 15000);
  check(s.rows === weekCount, '⑤ 近7天条数正确', `页面 ${s.rows} 行 vs 期望 ${weekCount} 行`);
  check(s.range === `${weekFrom} ~ ${latest}`, '⑤ 范围文字 = 近7天窗口', `"${s.range}"`);
  check(s.firstRow.length > 0, '⑤ 表格仍有数据行', `首行: ${s.firstRow.slice(0, 4).join(' | ')}`);
  console.log('   截图:', await shot('last-7-days'));

  // ⑥ 分页:每页 50 → 两页;翻页生效
  const psPick = await pickOption(ev, '.el-pagination .el-select', '50');
  check(psPick === 'ok', '⑥ 每页条数可切 50', psPick);
  s = await waitFor(ev, (x) => x.rows === Math.min(50, weekCount), 10000);
  check(s.rows === Math.min(50, weekCount), '⑥ 第 1 页只渲染 50 行(不再一次全渲染)', `页面 ${s.rows} 行`);
  if (weekCount > 50) {
    await ev(`(() => { document.querySelector('.el-pagination .btn-next').click(); return 'ok' })()`);
    s = await waitFor(ev, (x) => x.rows === weekCount - 50, 8000);
    check(s.rows === weekCount - 50, '⑥ 翻到第 2 页渲染剩余行', `页面 ${s.rows} 行 = ${weekCount} − 50`);
  } else {
    console.log('   (窗口行数 ≤ 50,翻页分支跳过)');
  }

  // ⑦ 英语:新控件/新弹窗都走 tt()
  await ev(`localStorage.setItem('mes_locale', 'en'); 'ok'`);
  await send('Page.navigate', { url: `${BASE}/?t=${Date.now()}#/prod/plan/orderConvert` });
  await sleep(9000);
  await dismissOnboarding(ev);
  let en = await waitFor(ev, (x) => x.box || x.rows > 0, 25000);
  if (canAsk) {
    check(!!en.box && /No data/.test(en.box.title) && /Jump to the latest day with data/.test(en.box.message),
      '⑦ 英语:询问弹窗已译(No data / Jump to the latest day with data)', en.box ? `"${en.box.title}" / "${en.box.message}"` : '无弹窗');
    check(!!en.box && en.box.buttons.includes('Go') && en.box.buttons.includes('Stay on this day'),
      '⑦ 英语:弹窗按钮已译(Go / Stay on this day)', en.box ? en.box.buttons.join(' | ') : '');
    console.log('   截图:', await shot('en-ask'));
    await clickBox(ev, 'Go');
    en = await waitFor(ev, (x) => x.anchor === latest && x.rows === dayCount, 15000);
  }
  check(/Single day/.test(en.modeText), '⑦ 英语:档位显示 Single day', en.modeText);
  const opts = await ev(`(() => { document.querySelector('.oc-bar .oc-mode .el-select__wrapper').click(); return [...document.querySelectorAll('.el-select-dropdown__item')].map(e=>e.innerText.trim()).join('|') })()`);
  check(/Last 7 days/.test(opts || ''), '⑦ 英语:档位选项已译(近7天→Last 7 days)', opts);
  const raw = await ev(`(() => { const el = document.querySelector('.oc-bar'); return el ? el.innerText : '' })()`);
  const dangling = ['单日', '截止日期', '查询条件', '刷新'].filter((w) => (raw || '').includes(w));
  check(dangling.length === 0, '⑦ 英语:工具条无裸中文残留', dangling.length ? '残留: ' + dangling.join(',') : `"${(raw || '').replace(/\s+/g, ' ').slice(0, 100)}"`);
  console.log('   截图:', await shot('en'));
});

const realErrors = (errs || []).filter((e) => !/favicon/i.test(e));
check(realErrors.length === 0, '⑧ 页面无 JS 报错', realErrors.slice(0, 3).join(' || '));

const pass = results.filter(Boolean).length;
console.log(`\n=== ${pass}/${results.length} 项通过 ${pass === results.length ? '(全部通过)' : '(存在失败项)'} ===`);
process.exitCode = pass === results.length ? 0 : 1;
