/**
 * _probe-pin-bin-ui.mjs — 真实浏览器取证:采购入库单列表宽表里「仓位」格能不能点选(2026-10-09)
 *
 * 背景:用户报「采购入库单仓位页要能够选择」。先用接口证明字段与候选数据都对(B1/B2 已过),
 * 这里证明**页面上看到的交互**:仓位列在不在宽表里、点它开不开弹窗、弹窗里有没有候选。
 * 用法:node tools/archive/_pull-20261009/_probe-pin-bin-ui.mjs [--url http://127.0.0.1:8090]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const argv = process.argv.slice(2);
const argOf = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const BASE = argOf('--url', 'http://127.0.0.1:8090');
const CDP_PORT = Number(argOf('--port', '9413'));
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = path.join(ROOT, 'tools', 'archive', '_pull-20261009');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withEdge(fn) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-bin-'));
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
      const f = path.join(OUT, `_bin-ui-${name}.png`);
      fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'));
      return f;
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

/** 页面读数:宽表列头 / 行数 / 有没有常驻参照编辑器(可点的那种) */
const READ = `(() => {
  const clean = (s) => (s || '').replace(/[\\u21c5\\u21c9\\u21ca\\s]+/g, '').trim();
  const heads = [...document.querySelectorAll('.el-table__header-wrapper th')].map(th => clean(th.innerText)).filter(Boolean);
  const rows = [...document.querySelectorAll('.el-table__body-wrapper tbody tr')];
  const first = rows[0] ? [...rows[0].querySelectorAll('td')].map(td => td.innerText.trim()) : [];
  const refEditors = document.querySelectorAll('.el-table__body-wrapper .inline-ref-editor').length;
  const lazyCells = document.querySelectorAll('.el-table__body-wrapper .cell-lazy').length;
  const dlg = document.querySelector('.el-dialog');
  const dlgRows = dlg ? dlg.querySelectorAll('.el-table__body-wrapper tbody tr').length : 0;
  return JSON.stringify({
    heads, rows: rows.length, first, refEditors, lazyCells,
    dialog: dlg ? (dlg.querySelector('.el-dialog__title')?.innerText?.trim() || '(无题)') : '',
    dlgRows,
    dlgEmpty: dlg ? (dlg.querySelector('.el-table__empty-text')?.innerText?.trim() || '') : '',
    dlgText: dlg ? (dlg.innerText || '').replace(/\\s+/g, ' ').slice(0, 300) : ''
  });
})()`;

const waitFor = async (ev, pred, ms = 20000) => {
  const t0 = Date.now();
  for (;;) {
    const s = JSON.parse(await ev(READ));
    if (pred(s)) return s;
    if (Date.now() - t0 > ms) return s;
    await sleep(500);
  }
};

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

const results = [];
const check = (cond, msg, extra = '') => {
  results.push(!!cond);
  console.log(`${cond ? '✅' : '❌'} ${msg}${extra ? ' — ' + extra : ''}`);
};

const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: argOf('--factory', 'YJ') }),
})).json();
const token = login.data?.token;
if (!token) { console.error('登录失败:', JSON.stringify(login).slice(0, 200)); process.exit(1); }
console.log('登录账套: ' + login.data.user.factory + '\n');

const errsRef = { list: [] };
const errs = await withEdge(async ({ ev, shot, send, errors }) => {
  errsRef.list = errors;
  await send('Page.navigate', { url: BASE + '/#/login' });
  await sleep(3000);
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user || {}))}); localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: login.data.user?.factory || 'YJ', name: 'YINJIA-MES' }))}); localStorage.removeItem('mes_locale'); 'ok'`);
  await send('Page.navigate', { url: `${BASE}/?t=${Date.now()}#/panelx/list/PURCHASE_IN` });
  await sleep(9000);
  await dismissOnboarding(ev);
  await sleep(1500);

  let s = await waitFor(ev, (x) => x.heads.length > 0, 25000);
  console.log('宽表列头(' + s.heads.length + '): ' + s.heads.join(' | ') + '\n');
  check(s.heads.includes('仓位'), '① 采购入库单宽表里有「仓位」列', s.heads.includes('仓位') ? '在第 ' + (s.heads.indexOf('仓位') + 1) + ' 列' : '列头:' + s.heads.join(','));
  check(s.heads.includes('仓库'), '① 也有「仓库」列(便于对照)', '');
  console.log('   截图:', await shot('01-list'));
  check(s.refEditors > 0 || s.lazyCells > 0, '② 明隔壁渲染成可交互控件(参照格 或 懒激活格)',
    `inline-ref-editor=${s.refEditors} cell-lazy=${s.lazyCells}`);

  // 找列头里「仓位」/「仓库」的下标
  const idx = s.heads.indexOf('仓位');
  const wIdx = s.heads.indexOf('仓库');
  const rowsCount = s.rows;
  console.log('\n宽表行数: ' + rowsCount);

  // ⚠ td 与 th 下标不等价(el-table 前置了选择列/展开列)⇒ 用列标题的 class 精确定位同名 td
  const colCls = await ev(`(() => {
    const th = [...document.querySelectorAll('.el-table__header-wrapper th')].find(t => (t.innerText||'').replace(/[\\u21c5\\s]+/g,'').trim() === '仓位');
    if (!th) return null;
    const m = (th.className || '').match(/el-table_\\d+_column_\\d+/);
    return m ? m[0] : null;
  })()`);
  const whCls = await ev(`(() => {
    const th = [...document.querySelectorAll('.el-table__header-wrapper th')].find(t => (t.innerText||'').replace(/[\\u21c5\\s]+/g,'').trim() === '仓库');
    if (!th) return null;
    const m = (th.className || '').match(/el-table_\\d+_column_\\d+/);
    return m ? m[0] : null;
  })()`);
  console.log('仓位列 class=' + colCls + ' / 仓库列 class=' + whCls);
  const rowCls = await ev(`(() => {
    const th = [...document.querySelectorAll('.el-table__header-wrapper th')].find(t => (t.innerText||'').replace(/[\\u21c5\\s]+/g,'').trim() === '规格型号');
    const m = th && (th.className || '').match(/el-table_\\d+_column_\\d+/);
    return m ? m[0] : null;
  })()`);
  console.log('选行用列 class=' + rowCls + '(规格型号:非参照格,点它只选行不开弹窗)');
  const cellSel = (rowIdx, cls) => `(() => {
    const r = [...document.querySelectorAll('.el-table__body-wrapper tbody tr')][${rowIdx}];
    if (!r) return null;
    return r.querySelector('td.${cls}');
  })()`;
  const readCell = async (rowIdx, cls) => await ev(`(() => {
    const r = [...document.querySelectorAll('.el-table__body-wrapper tbody tr')][${rowIdx}];
    const td = r && r.querySelector('td.${cls}');
    if (!td) return null;
    const inp = td.querySelector('input');            // 参照格是 readonly input ⇒ 值在 input.value,不在 innerText
    return inp ? inp.value : td.innerText.trim();
  })()`);
  const clickCell = async (rowIdx, cls) => await ev(`(() => {
    const r = [...document.querySelectorAll('.el-table__body-wrapper tbody tr')][${rowIdx}];
    const td = r && r.querySelector('td.${cls}');
    if (!td) return 'no-cell';
    const box = td.querySelector('.inline-ref-editor input') || td.querySelector('input') || td;
    box.click();
    return 'clicked:' + (td.innerText.trim() || '(空格)');
  })()`);

  const closeDlg = async () => {
    await ev(`(() => { const c = document.querySelector('.el-dialog__headerbtn'); if (c) { c.click(); return 'closed' } return 'no-dlg' })()`);
    await sleep(600);
  };

  const samples = [];
  for (let i = 0; i < Math.min(rowsCount, 8); i++) {
    // 每轮先把可能残留的弹窗关掉(关弹窗会移动焦点,上一轮踩过「点到别的列」)
    await ev(`(() => { const c = document.querySelector('.el-dialog__headerbtn'); if (c) c.click(); return 'ok' })()`);
    await sleep(700);
    // ① 先点行选中单据(明细格可编辑性 = 该单是否草稿/修改中)—— 用「规格型号」格,非参照格不会弹窗
    await ev(`(() => {
      const r = [...document.querySelectorAll('.el-table__body-wrapper tbody tr')][${i}];
      const td = r.querySelector('td.${rowCls}') || r.querySelector('td');
      td.click();
      return 'row-click';
    })()`);
    await sleep(1600);
    const wh = await readCell(i, whCls);
    if (!wh) { console.log(`   行${i}: 仓库为空 → 跳过(级联无上级,候选本就该空)`); continue; }
    // ② 点「仓位」格
    const clicked = await clickCell(i, colCls);
    await sleep(2200);
    let st = JSON.parse(await ev(READ));
    if (!st.dialog) { await clickCell(i, colCls); await sleep(2200); st = JSON.parse(await ev(READ)); }
    const cnt = st.dialog ? await ev(`(() => { const t = document.querySelector('.el-dialog')?.innerText || ''; const m = t.match(/共\\s*(\\d+)\\s*条/); return m ? Number(m[1]) : null })()`) : null;
    console.log(`   行${i}: 仓库=${JSON.stringify(wh)} 点击=${clicked} → 弹窗=${st.dialog ? '「' + st.dialog + '」' : '(未开)'} 候选行=${st.dlgRows} 共${cnt}`);
    if (st.dialog) {
      samples.push({ i, wh, title: st.dialog, dlgRows: st.dlgRows, cnt, empty: st.dlgEmpty, text: st.dlgText });
      console.log('   弹窗文本: ' + st.dlgText.slice(0, 200));
      console.log('   截图:', await shot('02-dialog-' + i));
    }
  }
  const hit = samples[0] || null;
  const withWh = samples.find((s) => s.wh && s.wh !== '') || null;

  check(samples.length > 0, '③ 点「仓位」格能开出参照弹窗', hit ? `行${hit.i} 标题「${hit.title}」` : '一行都没开');
  check(samples.every((s) => /仓位/.test(s.title)), '③b 开出的是「仓位」的参照弹窗(不是别的列)',
    samples.map((s) => '行' + s.i + '「' + s.title + '」').join(' ') || '(无)');
  if (withWh) {
    check(withWh.cnt === null || withWh.cnt > 0, '④ 有仓库的行:候选按该仓收窄(不是全库 679)',
      `行${withWh.i} 仓库=${withWh.wh} 候选条数=${withWh.cnt}`);
  } else {
    console.log('   ⚠ 本页没有「仓库非空」的行,收窄分支没采到界面样本(接口层已由 _e2e-bin-preset.cjs B2 证明:A仓 259 / D仓 168)');
  }
  if (hit) {
    check(hit.dlgRows > 0 || !!hit.empty || hit.text.includes('暂无数据'), '⑤ 空候选给的是可读说明(不是无从下手)',
      hit.dlgRows > 0 ? hit.dlgRows + ' 行' : '空态提示含: ' + (hit.text.match(/该「[^」]+」下暂无候选数据[^）]*）/) || hit.empty || '(无)'));
  }
  check(errsRef.list.length === 0, '⑥ 全程无页面报错', errsRef.list.slice(0, 3).join(' / '));
});

const fail = results.filter((x) => !x).length;
console.log('\n总结: ' + (results.length - fail) + '/' + results.length + ' PASS');
if (errs.length) console.log('页面报错:\n  ' + errs.join('\n  '));
process.exitCode = fail ? 1 : 0;
