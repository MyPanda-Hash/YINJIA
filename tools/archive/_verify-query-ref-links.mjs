/**
 * _verify-query-ref-links.mjs — 界面实测:七个面板「查询」弹窗里的基础资料类字段都是参照(可点选档案),
 * 并逐个点开参照框确认能取到档案数据。
 * 用法: node tools/archive/_verify-query-ref-links.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONT = 'http://localhost:5173';
const API = 'http://localhost:8090/api';
const PORT = 9395;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = path.join(__dirname, '_so-rail-shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, msg) => { console.log(`  ${c ? '[PASS]' : '[FAIL]'} ${msg}`); if (!c) fails++; };

/** 期望:弹窗里应为「参照」的字段 → 目标档案面板名(仅用于报告可读性) */
const EXPECT = {
  PU_ORDER: { 供应商: 'GFDA', 供应商编码: 'GFDA', 币种: 'CUR' },
  SL_RECV: { 业务员: 'EMP', 供应商代码: 'GFDA', 供应商: 'GFDA' },
  QC_RETURN: { 供应商: 'GFDA', 经手人: 'EMP' },
  QC_INSP: { 供应商: 'GFDA', 检验员: 'EMP', 暂收单号: 'SL_RECV' },
  PURCHASE_IN: { 供应商编码: 'GFDA', 供应商: 'GFDA', 经手人: 'EMP', 部门: 'DEPT', 部门编码: 'DEPT' },
  SO_ORDER: { 客户: 'KHDA', 客户编码: 'KHDA', 结算客户: 'KHDA', 部门: 'DEPT', 业务员: 'EMP' },
  SALE_OUT: { 客户: 'KHDA', 客户编码: 'KHDA', 经手人: 'EMP' },
};
/** 每面板挑一个字段真正点开参照框,断言能取到档案行 */
const PICK = {
  QC_RETURN: '供应商', QC_INSP: '供应商', SL_RECV: '供应商',
  PURCHASE_IN: '经手人', SO_ORDER: '部门', PU_ORDER: '币种', SALE_OUT: '客户',
};

const login = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
const token = login?.data?.token, user = login?.data?.user;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-qref-'));
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

  /** 打开查询弹窗 */
  const openDialog = `(() => {
    const b = document.querySelector('.toolbar-query-btn'); if (!b) return 'no-btn'; b.click(); return 'ok';
  })()`;
  /** 读弹窗字段:标签 + 控件类型 + 已选值 */
  const readFields = `(() => {
    const boxes = [...document.querySelectorAll('.query-dialog-field')];
    return boxes.map((b) => {
      const label = b.querySelector('label')?.textContent.replace('*','').trim() || '';
      const ref = !!b.querySelector('.query-ref');
      const sel = !!b.querySelector('.el-select');
      const date = !!b.querySelector('.el-date-picker, .el-input__inner[placeholder*="日期"]');
      const num = !!b.querySelector('.el-input-number');
      const kind = ref ? '参照' : (sel ? '下拉' : (num ? '数字' : (date ? '日期' : '文本')));
      return { label, kind };
    });
  })()`;

  for (const [panel, exp] of Object.entries(EXPECT)) {
    const url = `${FRONT}/?_v=${Date.now()}#/panelx/list/${panel}`;
    await send('Page.navigate', { url });
    for (let i = 0; i < 80; i++) { await sleep(400); if (await ev(`!!document.querySelector('.toolbar-query-btn')`)) break; }
    await sleep(1800);
    await ev(openDialog);
    await sleep(1500);
    const fields = await ev(readFields);
    console.log(`\n=== ${panel} 查询弹窗(${fields.length} 字段)===`);
    const map = Object.fromEntries(fields.map((f) => [f.label, f.kind]));
    for (const [label, refPanel] of Object.entries(exp)) {
      ok(map[label] === '参照', `${label} → 参照(${refPanel});实得 ${JSON.stringify(map[label] ?? '(字段不存在)')}`);
    }
    // 点开一个参照框,断言弹窗能列出档案行
    const pick = PICK[panel];
    if (pick && map[pick] === '参照') {
      await ev(`(() => {
        const box = [...document.querySelectorAll('.query-dialog-field')].find((b) => (b.querySelector('label')?.textContent||'').replace('*','').trim() === ${JSON.stringify(pick)});
        box?.querySelector('.query-ref .el-button')?.click(); return 'ok';
      })()`);
      let rows = 0, title = '';
      for (let i = 0; i < 25; i++) {
        await sleep(400);
        const st = await ev(`(() => {
          const dlg = [...document.querySelectorAll('.el-dialog, .el-drawer')].find((d) => d.offsetParent !== null && /参照选择/.test(d.textContent || ''));
          if (!dlg) return null;
          return { title: (dlg.querySelector('.el-dialog__title, .el-drawer__title')?.textContent || '').trim(), rows: dlg.querySelectorAll('.el-table__body tbody tr').length };
        })()`);
        if (st) { rows = st.rows; title = st.title; break; }
      }
      console.log(`  点开「${pick}」参照框 → 标题=${JSON.stringify(title)} 档案行数=${rows}`);
      ok(rows > 0, `参照框取到档案数据(${rows} 行)`);
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true });
      fs.writeFileSync(path.join(OUT, `qref-${panel}-pick.png`), Buffer.from(r.result.data, 'base64'));
      // 关闭参照弹窗
      await ev(`(() => { const btns=[...document.querySelectorAll('.el-dialog__headerbtn, .el-drawer__close-btn')].filter(b=>b.offsetParent!==null); btns[btns.length-1]?.click(); return 'ok'; })()`);
      await sleep(800);
    }
    const r2 = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true });
    fs.writeFileSync(path.join(OUT, `qref-${panel}.png`), Buffer.from(r2.result.data, 'base64'));
    // 关弹窗
    await ev(`(() => { const btns=[...document.querySelectorAll('.el-dialog__headerbtn')].filter(b=>b.offsetParent!==null); btns[btns.length-1]?.click(); return 'ok'; })()`);
    await sleep(600);
  }
  console.log('  截图目录:', OUT);
  ws.close();
} finally {
  edge.kill();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
}
console.log(fails ? `\n${fails} 项失败` : '\n全部通过');
process.exit(fails ? 1 : 0);
