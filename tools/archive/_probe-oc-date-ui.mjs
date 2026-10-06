/**
 * 探针:订单结转页「左上角日期查询 + 分页」真实界面取证(2026-10-06 用户报障修复)。
 *
 * 目的:后端只证明接口对,这里证明**页面上看到的就是要求的样子**:
 *   ① 打开即「单日」,锚点=最近有数据的一天(不是空表,也不是全量历史)
 *   ② 切「近7天」→ 列表条数变为该窗口条数,范围文字同步
 *   ③ 分页:每页切换/翻页生效(修的就是"一次全量渲染卡死")
 *   ④ 查一个没有数据的单日 → 空表提示 + 「看近7天」近路
 *   ⑤ 切英语:新控件走 tt()(单日→Single day 等),不出现裸中文
 *   ⑥ 全程记录 页面报错(console error / 未捕获异常)
 *
 * 用法: node tools/archive/_probe-oc-date-ui.mjs [--url http://127.0.0.1:8090] [--tag after]
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
    mode: t('.oc-bar .oc-mode .el-select__selected-item, .oc-bar .oc-mode input'),
    modeText: t('.oc-bar .oc-mode'),
    anchor: document.querySelector('.oc-bar .oc-date input')?.value || '',
    range: t('.oc-range'),
    count: t('.oc-count'),
    summary: t('.oc-summary'),
    rows: rows.length,
    firstRow: first,
    pager: t('.el-pagination__total'),
    page: document.querySelector('.el-pagination .el-input__inner')?.value || '',
    empty: t('.oc-empty'),
    emptyBtn: !!document.querySelector('.oc-empty .el-button'),
    loading: !!document.querySelector('.oc-table .el-loading-mask:not([style*="display: none"])'),
  });
})()`;

const waitRows = async (ev, pred, ms = 15000) => {
  const t0 = Date.now();
  for (;;) {
    const s = JSON.parse(await ev(READ));
    if (pred(s)) return s;
    if (Date.now() - t0 > ms) return s;
    await sleep(400);
  }
};

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
const base = await (await fetch(BASE + '/api/px/orderConvert/pending', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify({ keyword: '' }),
})).json();
const all = base.data || [];
const latest = all.map((r) => r['下单日期']).sort().pop();
const dayCount = all.filter((r) => r['下单日期'] === latest).length;
const weekFrom = (() => { const [y, m, d] = latest.split('-').map(Number); const dt = new Date(y, m - 1, d); dt.setDate(dt.getDate() - 6); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`; })();
const weekCount = all.filter((r) => r['下单日期'] >= weekFrom && r['下单日期'] <= latest).length;
console.log(`基线(接口): 全量 ${all.length} 行 / 最新下单日 ${latest} ${dayCount} 行 / 近7天(${weekFrom}~${latest}) ${weekCount} 行\n`);

const errs = await withEdge(async ({ ev, shot, send }) => {
  // 先落在真实源上(about:blank 的 opaque origin 存不了 localStorage),注入令牌后再进业务页
  await send('Page.navigate', { url: BASE + '/#/login' });
  await sleep(3000);
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user || {}))}); localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: login.data.user?.factory || 'YJ', name: 'YINJIA-MES' }))}); localStorage.removeItem('mes_locale'); 'ok'`);
  await send('Page.navigate', { url: `${BASE}/?t=${Date.now()}#/prod/plan/orderConvert` });
  await sleep(7000);
  await dismissOnboarding(ev);
  await sleep(500);

  // ① 默认单日 + 锚点=最近有数据的一天
  let s = await waitRows(ev, (x) => x.rows > 0 || x.empty, 20000);
  check(s.modeText.includes('单日'), '① 打开即「单日」模式', `控件显示 "${s.modeText}"`);
  check(s.anchor === latest, '① 锚点 = 最近有数据的一天', `日期框 "${s.anchor}" vs ${latest}`);
  check(s.range === '', '① 单日模式不重复显示区间文字(日期框即区间)', `区间文字 "${s.range}"`);
  check(s.rows === dayCount, '① 列表只有该日数据(不是全量历史)', `页面 ${s.rows} 行 vs 该日 ${dayCount} 行(全量 ${all.length} 行)`);
  check(s.pager.includes(String(dayCount)), '① 分页器总数与列表一致', `"${s.pager}"`);
  check(/未结转订单汇总（总订单笔数: \d+/.test(s.summary), '① 汇总条仍在(未结转=全量口径)', s.summary.slice(0, 90));
  console.log('   截图:', await shot('single-day'));

  // ② 切「近7天」
  const pick = await pickOption(ev, '.oc-bar .oc-mode', '近7天');
  check(pick === 'ok', '② 档位下拉可选「近7天」', pick);
  s = await waitRows(ev, (x) => x.rows === weekCount, 15000);
  check(s.rows === weekCount, '② 近7天条数正确', `页面 ${s.rows} 行 vs 期望 ${weekCount} 行`);
  check(s.range === `${weekFrom} ~ ${latest}`, '② 范围文字 = 近7天窗口', `"${s.range}"`);
  check(/^Total|^共/.test(s.pager) ? s.pager.includes(String(weekCount)) : true, '② 分页器同步', `"${s.pager}"`);
  check(s.firstRow.length > 0, '② 表格仍有数据行', `首行: ${s.firstRow.slice(0, 4).join(' | ')}`);
  console.log('   截图:', await shot('last-7-days'));

  // ③ 分页:每页 50 → 两页;翻页生效
  const psPick = await pickOption(ev, '.el-pagination .el-select', '50');
  check(psPick === 'ok', '③ 每页条数可切 50', psPick);
  s = await waitRows(ev, (x) => x.rows === Math.min(50, weekCount), 10000);
  check(s.rows === Math.min(50, weekCount), '③ 第 1 页只渲染 50 行(不再一次全渲染)', `页面 ${s.rows} 行`);
  if (weekCount > 50) {
    await ev(`(() => { document.querySelector('.el-pagination .btn-next').click(); return 'ok' })()`);
    s = await waitRows(ev, (x) => x.rows === weekCount - 50, 8000);
    check(s.rows === weekCount - 50, '③ 翻到第 2 页渲染剩余行', `页面 ${s.rows} 行 = ${weekCount} − 50`);
    await ev(`(() => { document.querySelector('.el-pagination .btn-prev').click(); return 'ok' })()`);
    await sleep(800);
  } else {
    console.log('   (窗口行数 ≤ 50,翻页分支跳过)');
  }

  // ④ 空数据单日 → 空表提示 + 近路按钮
  const noDataDay = '2026-10-01';
  await pickOption(ev, '.oc-bar .oc-mode', '单日');
  await typeDate(send, ev, '.oc-bar .oc-date input', noDataDay);
  s = await waitRows(ev, (x) => x.anchor === noDataDay && x.rows === 0, 10000);
  check(s.anchor === noDataDay && s.rows === 0, `④ 单日 ${noDataDay}(无数据)空表`, `行数 ${s.rows} 锚点 ${s.anchor}`);
  check(!!s.empty && s.emptyBtn, '④ 空表有提示 + 「看近7天」近路', `"${s.empty}" 按钮=${s.emptyBtn}`);
  console.log('   截图:', await shot('empty-hint'));

  // ⑤ 英语:新控件走 tt()
  await ev(`localStorage.setItem('mes_locale', 'en'); 'ok'`);
  await send('Page.navigate', { url: `${BASE}/?t=${Date.now()}#/prod/plan/orderConvert` });
  await sleep(7000);
  await dismissOnboarding(ev);
  const en = await ev(READ).then((x) => JSON.parse(x));
  const enText = JSON.stringify(en);
  check(/Single day/.test(enText), '⑤ 英语:档位显示 Single day', en.modeText);
  check(/Last 7 days/.test(await ev(`(() => { document.querySelector('.oc-bar .oc-mode .el-select__wrapper').click(); return [...document.querySelectorAll('.el-select-dropdown__item')].map(e=>e.innerText.trim()).join('|') })()`) || ''), '⑤ 英语:档位选项已译(近7天→Last 7 days)');
  // 裸中文检查:工具条区域不应再出现这些词
  const raw = await ev(`(() => { const el = document.querySelector('.oc-bar'); return el ? el.innerText : '' })()`);
  const dangling = ['单日', '截止日期', '查询条件', '刷新'].filter((w) => (raw || '').includes(w));
  check(dangling.length === 0, '⑤ 英语:工具条无裸中文残留', dangling.length ? '残留: ' + dangling.join(',') : `"${(raw || '').replace(/\s+/g, ' ').slice(0, 110)}"`);
  console.log('   截图:', await shot('en'));
});

const realErrors = (errs || []).filter((e) => !/favicon/i.test(e));
check(realErrors.length === 0, '⑥ 页面无 JS 报错', realErrors.slice(0, 3).join(' || '));

const pass = results.filter(Boolean).length;
console.log(`\n=== ${pass}/${results.length} 项通过 ${pass === results.length ? '(全部通过)' : '(存在失败项)'} ===`);
process.exitCode = pass === results.length ? 0 : 1;
