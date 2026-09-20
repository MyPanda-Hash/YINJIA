/**
 * _verify-auditor-ref.mjs — 「审核人」绑定职员验证:API 过滤(表内列 OR yj_doc_status.shr 并集) + 界面参照
 * 用法: node tools/archive/_verify-auditor-ref.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API = process.env.YJ_API || 'http://localhost:8090/api';
const FRONT = 'http://localhost:5173';
const PORT = 9401;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = path.join(__dirname, '_so-rail-shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, msg) => { console.log(`  ${c ? '[PASS]' : '[FAIL]'} ${msg}`); if (!c) fails++; };

const login = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
const token = login?.data?.token, user = login?.data?.user;
if (!token) { console.error('登录失败'); process.exit(1); }
const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token };
const q = async (panelCode, condition) => {
  const r = await fetch(API + '/px/queryFormDataList', { method: 'POST', headers: H, body: JSON.stringify({ panelCode, condition, pageNo: 1, pageSize: 50 }) });
  const j = await r.json();
  if (j.code !== 0 && j.code !== 200) throw new Error(JSON.stringify(j).slice(0, 200));
  return j.data;
};

console.log('=== ① API:审核人过滤走 yj_doc_status.shr 并集 ===');
const noCond = await q('QC_INSP', {});
const byAdmin = await q('QC_INSP', { 审核人: 'admin' });
console.log(`  QC_INSP 无条件 ${noCond.totalSize} 张;审核人=admin → ${byAdmin.totalSize} 张 ${JSON.stringify(byAdmin.list.map((d) => d['单据编号']))}`);
ok(noCond.totalSize > 0 && byAdmin.totalSize > 0, `按 MES 账号名 admin 能筛出单据(${byAdmin.totalSize} 张;修前表内列全空 → 必然 0 张)`);
ok(byAdmin.totalSize < noCond.totalSize, `筛选确实收窄了结果(${byAdmin.totalSize} < ${noCond.totalSize})`);
ok(byAdmin.list.every((d) => String(d['审核人'] || '') === 'admin' || String(d['单据状态']) === '已审核'), '结果与审核人/已审核状态自洽');
const byNone = await q('QC_INSP', { 审核人: '不存在的审核人' });
ok(byNone.totalSize === 0, `不存在的审核人 → 0 张(实得 ${byNone.totalSize})`);
// 职员档案里的真实姓名(王光珍 已审过 采购入库/暂收等;QC_INSP 目前是 admin 审的 → 0 张属数据现状)
const byWang = await q('QC_INSP', { 审核人: '王光珍' });
console.log(`  QC_INSP 审核人=王光珍 → ${byWang.totalSize} 张(数据现状:该面板历史单据都是 admin 审的)`);

console.log('\n=== ② 界面:查询弹窗「审核人」为参照,可点选职员 ===');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-aud-'));
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

  for (const panel of ['QC_INSP', 'QC_RETURN']) {
    const url = `${FRONT}/?_v=${Date.now()}#/panelx/list/${panel}`;
    await send('Page.navigate', { url });
    for (let i = 0; i < 80; i++) { await sleep(400); if (await ev(`!!document.querySelector('.toolbar-query-btn')`)) break; }
    await sleep(1800);
    await ev(`document.querySelector('.toolbar-query-btn').click(); 'ok'`);
    await sleep(1500);
    const kind = await ev(`(() => {
      const box = [...document.querySelectorAll('.query-dialog-field')].find((b) => (b.querySelector('label')?.textContent||'').replace('*','').trim() === '审核人');
      return box ? (box.querySelector('.query-ref') ? '参照' : '非参照') : '(无此字段)';
    })()`);
    console.log(`  ${panel} 查询弹窗「审核人」= ${kind}`);
    ok(kind === '参照', `${panel}:审核人渲染为参照`);
    if (kind === '参照') {
      await ev(`(() => {
        const box = [...document.querySelectorAll('.query-dialog-field')].find((b) => (b.querySelector('label')?.textContent||'').replace('*','').trim() === '审核人');
        box.querySelector('.query-ref .el-button').click(); return 'ok';
      })()`);
      let title = '', rows = [], names = [];
      for (let i = 0; i < 25; i++) {
        await sleep(400);
        const st = await ev(`(() => {
          const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && /参照选择/.test(d.textContent || ''));
          if (!dlg) return null;
          const trs = [...dlg.querySelectorAll('.el-table__body tbody tr')];
          return { title: (dlg.querySelector('.el-dialog__title')?.textContent || '').trim(), rows: trs.length, first: trs.slice(0, 3).map((tr) => tr.textContent.replace(/\\s+/g, ' ').trim().slice(0, 60)) };
        })()`);
        if (st) { title = st.title; rows = st.first; names = st.first; break; }
      }
      console.log(`    → 标题=${JSON.stringify(title)} 前 3 行=${JSON.stringify(rows)}`);
      ok(/职员/.test(title), `参照框打开的是「职员」档案(${JSON.stringify(title)})`);
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true });
      fs.writeFileSync(path.join(OUT, `auditor-${panel}.png`), Buffer.from(r.result.data, 'base64'));
      await ev(`(() => { const b=[...document.querySelectorAll('.el-dialog__headerbtn')].filter(x=>x.offsetParent!==null); b[b.length-1]?.click(); return 'ok'; })()`);
      await sleep(600);
    }
    await ev(`(() => { const b=[...document.querySelectorAll('.el-dialog__headerbtn')].filter(x=>x.offsetParent!==null); b[b.length-1]?.click(); return 'ok'; })()`);
    await sleep(600);
  }
  ws.close();
} finally {
  edge.kill();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
}
console.log(fails ? `\n${fails} 项失败` : '\n全部通过');
process.exit(fails ? 1 : 0);
