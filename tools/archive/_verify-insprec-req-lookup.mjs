/**
 * _verify-insprec-req-lookup.mjs — 「检验数据记录按物料编码查看来料检验要求」界面验证(2026-09-23)
 *
 * 用户口径:「检验数据记录要根据物料编码能够查看来料检验要求相关物料的信息」。
 *
 * 验证:
 *   ① 入口:检验数据记录抬头「物料编码」旁出现「检验要求」链接
 *   ② 命中:物料编码有要求的报告(如 YJ-KG-JC-B02 → 折叠棉)→ 弹窗出现,内含该物料编号的要求行;
 *      嵌入表为**只读**(无 保存/刷新 工具栏、无 修改/删除 行操作)
 *   ③ 未维护:物料编码查不到要求 → 弹窗显示空态文案
 *   ④ 空编码:没填物料编码 → 拦下并提示,不弹窗
 *   ⑤ 回归:来料检验要求维护面板本体不受影响(工具栏仍在、7 个页签仍在)
 *
 * 用法: node tools/archive/_verify-insprec-req-lookup.mjs
 *       YJ_FRONT=http://localhost:8090 node ...   ← 验打包入口(jar 内嵌前端);默认走 5173 dev
 * 前置:后端 8090、前端(dev 或打包)可达;需可启动 headless Edge(受限沙箱下 Chrome 的 mojo 命名管道被拒)。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const API = process.env.YJ_API || 'http://localhost:8090/api';
const FRONT = process.env.YJ_FRONT || 'http://localhost:5173';
const PORT = 9471;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, msg) => { console.log(`  ${c ? '[PASS]' : '[FAIL]'} ${msg}`); if (!c) fails++; };

const pool = await new mssql.ConnectionPool({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
}).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;

/* ---------- 挑样本单据 ---------- */
const hitDoc = (await q(`SELECT TOP 1 r.[单据编号] no, r.[物料编码] code, req.[物料类别] cat
  FROM qc_insp_rec r JOIN qc_insp_req req ON LTRIM(RTRIM(req.[物料编号])) = LTRIM(RTRIM(r.[物料编码]))
  WHERE ISNULL(r.asp_cancel,'N')<>'Y' AND ISNULL(req.asp_cancel,'N')<>'Y' AND ISNULL(r.[物料编码],N'')<>N''
  ORDER BY r.id DESC`))[0];
const missDoc = (await q(`SELECT TOP 1 r.[单据编号] no, r.[物料编码] code FROM qc_insp_rec r
  WHERE ISNULL(r.asp_cancel,'N')<>'Y' AND ISNULL(r.[物料编码],N'')<>N''
    AND NOT EXISTS (SELECT 1 FROM qc_insp_req req WHERE ISNULL(req.asp_cancel,'N')<>'Y'
                    AND LTRIM(RTRIM(req.[物料编号])) = LTRIM(RTRIM(r.[物料编码])))
  ORDER BY r.id DESC`))[0];
const blankDoc = (await q(`SELECT TOP 1 [单据编号] no FROM qc_insp_rec
  WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL([物料编码],N'')=N'' ORDER BY id DESC`))[0];
console.log(`样本:命中 ${hitDoc?.no}(${hitDoc?.code} / ${hitDoc?.cat}) | 未维护 ${missDoc?.no}(${missDoc?.code}) | 空编码 ${blankDoc?.no}`);
ok(!!hitDoc && !!missDoc && !!blankDoc, '三类样本单据齐备(命中 / 未维护 / 空物料编码)');

/* ---------- 登录 + 起浏览器 ---------- */
const lj = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
const token = lj?.data?.token, user = lj?.data?.user;

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-req-'));
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let tab = null;
for (let i = 0; i < 40 && !tab; i++) {
  await sleep(1000);
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json(); } catch { /* 等 CDP */ }
}
if (!tab) { console.log('❌ 无法启动 headless Edge(受限沙箱会拒 mojo 命名管道)'); process.exit(2); }
const ws = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1000, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `${FRONT}/#/login` }); await sleep(2500);
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
  localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
  localStorage.setItem('mes_login_date','2026-09-23'); localStorage.setItem('mes_locale','zh-CN'); 'ok'`);

/** 打开某张检验数据记录:先等纸面出现,再等**单据数据到位**(抬头出现该单的物料编码或单号),
 *  否则点链接时物料编码还是空 → 会走「请先填写物料编码」拦截而不是弹窗(打包入口加载更慢,实测踩过)。 */
async function openRec(no, expectText) {
  await send('Page.navigate', { url: `${FRONT}/?_v=${Date.now()}#/panelx/list/QC_INSP_REC?docNo=${encodeURIComponent(no)}` });
  for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`!!document.querySelector('.qc-rec-sheet .qr-label .qr-lib-btn')`)) break; }
  if (expectText) {
    for (let i = 0; i < 60; i++) {
      const got = await ev(`document.body.innerText.includes(${JSON.stringify(expectText)})`);
      if (got) break;
      await sleep(300);
    }
  }
  await sleep(1500);
}

/* ---------- ① 入口链接 ---------- */
console.log('\n=== ① 入口:抬头「物料编码」旁「检验要求」链接 ===');
await openRec(hitDoc.no, hitDoc.code);
const entry = await ev(`(() => {
  const btn = document.querySelector('.qc-rec-sheet .qr-label .qr-lib-btn');
  if (!btn) return null;
  const th = btn.closest('th');
  return { label: th.textContent.replace(/\\s+/g,' ').trim(), btn: btn.textContent.replace(/\\s+/g,' ').trim() };
})()`);
console.log('   抬头格:', JSON.stringify(entry));
ok(!!entry && /物料编码/.test(entry.label) && /检验要求/.test(entry.btn), '「物料编码」格内有「检验要求」链接');

/* ---------- ② 命中:弹窗 + 只读嵌入 + 该物料的要求行 ---------- */
console.log('\n=== ② 命中:按物料编码查到要求行(只读嵌入) ===');
await ev(`document.querySelector('.qc-rec-sheet .qr-label .qr-lib-btn').click()`);
for (let i = 0; i < 40; i++) { await sleep(300); if (await ev(`!!document.querySelector('.req-view-sub') || !!document.querySelector('.req-view-tip')`)) break; }
await sleep(1200);
const dlg = await ev(`(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.querySelector('.req-view-sub, .req-view-tip'));
  if (!d) return { open: false };
  const wrap = d.querySelector('.qc-insp-sheet');
  const heads = wrap ? [...wrap.querySelectorAll('.rsp-page-tab')].map((t) => t.textContent.trim()) : [];
  // 注:本表把"大标题行 + 两行分组表头 + 数据行"全放在 tbody 里(Excel 一比一),没有 thead ——
  //     表头取 tbody 内的 th,数据行取"无 th、且不是大标题行(.qc-title)"的行
  const headerCells = wrap ? [...wrap.querySelectorAll('table.rs-t tbody tr th')].map((th) => th.textContent.trim()) : [];
  const orow = wrap ? [...wrap.querySelectorAll('table.rs-t tbody tr')] : [];
  const dataRows = orow
    .filter((tr) => !tr.querySelector('th') && !tr.querySelector('.qc-title'))
    .map((tr) => [...tr.children].map((td) => td.textContent.trim()));
  return {
    open: true,
    title: (d.querySelector('.el-dialog__title') || {}).textContent || '',
    sub: (d.querySelector('.req-view-sub') || {}).textContent?.replace(/\\s+/g,' ').trim() || '',
    tip: (d.querySelector('.req-view-tip') || {}).textContent?.trim() || '',
    embed: !!d.querySelector('.qc-insp-sheet--embed'),
    hasToolbar: !!d.querySelector('.qc-insp-sheet--embed .qc-bar'),
    hasRowOps: /修改|删除|新增数据记录行/.test(wrap ? wrap.textContent : ''),
    heads, headerCells, dataRows,
  };
})()`);
console.log('   标题:', dlg.title);
console.log('   小标题:', dlg.sub);
console.log('   页签:', JSON.stringify(dlg.heads));
console.log('   表头:', JSON.stringify(dlg.headerCells));
console.log('   数据行:', JSON.stringify(dlg.dataRows));
ok(dlg.open, '弹窗已打开');
ok(/来料检验要求/.test(dlg.title) && dlg.title.includes(hitDoc.code), `标题含「来料检验要求」与物料编码(${dlg.title})`);
ok(dlg.embed, '弹窗内是只读嵌入表(qc-insp-sheet--embed)');
ok(!dlg.hasToolbar, '嵌入表隐藏了维护工具栏(无 保存/刷新)');
ok(!dlg.hasRowOps, '嵌入表无 修改/删除/新增行 操作');
ok((dlg.heads || []).includes(hitDoc.cat), `只显示命中页签(${hitDoc.cat})`);
ok((dlg.dataRows || []).some((r) => r[0] === hitDoc.code), `表内出现该物料编号的要求行(${hitDoc.code})`);
ok((dlg.headerCells || [])[0] === '物料编号', `首列表头 = 物料编号(实测 ${JSON.stringify((dlg.headerCells || [])[0])})`);

/* ---------- ③ 未维护:空态文案 ---------- */
console.log('\n=== ③ 未维护:空态 ===');
await ev(`document.querySelector('.el-dialog__headerbtn')?.click()`);
await sleep(600);
await openRec(missDoc.no, missDoc.code);
await ev(`document.querySelector('.qc-rec-sheet .qr-label .qr-lib-btn').click()`);
for (let i = 0; i < 40; i++) { await sleep(300); if (await ev(`!!document.querySelector('.req-view-tip')`)) break; }
const miss = await ev(`(() => {
  const t = document.querySelector('.req-view-tip');
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.querySelector('.req-view-tip'));
  return { tip: t ? t.textContent.trim() : '', open: !!d };
})()`);
console.log(`   物料 ${missDoc.code} →`, JSON.stringify(miss.tip));
ok(miss.open && /未维护来料检验要求/.test(miss.tip), '未维护物料显示空态文案');

/* ---------- ④ 空物料编码:拦下并提示 ---------- */
console.log('\n=== ④ 未填物料编码:拦下并提示 ===');
await ev(`document.querySelector('.el-dialog__headerbtn')?.click()`);
await sleep(600);
await openRec(blankDoc.no);
await ev(`document.querySelector('.qc-rec-sheet .qr-label .qr-lib-btn').click()`);
await sleep(900);
const blank = await ev(`(() => {
  const msg = [...document.querySelectorAll('.el-message')].map((m) => m.textContent.trim()).join(' | ');
  const dlgOpen = [...document.querySelectorAll('.el-dialog')].some((x) => x.querySelector('.req-view-sub, .req-view-tip'));
  return { msg, dlgOpen };
})()`);
console.log('   提示:', JSON.stringify(blank.msg), '弹窗打开:', blank.dlgOpen);
ok(!blank.dlgOpen, '空物料编码不弹窗');
ok(/请先填写物料编码/.test(blank.msg), '给出「请先填写物料编码」提示');

/* ---------- ⑤ 回归:来料检验要求维护面板本体 ---------- */
console.log('\n=== ⑤ 回归:来料检验要求维护面板(showToolbar 默认仍为 true) ===');
await send('Page.navigate', { url: `${FRONT}/?_v=${Date.now()}#/panelx/list/QC_INSP_REQ` });
for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`!!document.querySelector('.qc-insp-sheet .qc-bar')`)) break; }
await sleep(1500);
const maint = await ev(`(() => {
  const sheet = document.querySelector('.qc-insp-sheet');
  if (!sheet) return { found: false };
  return {
    found: true,
    embed: sheet.classList.contains('qc-insp-sheet--embed'),
    barText: [...sheet.querySelectorAll('.qc-bar')].map((b) => b.textContent.replace(/\\s+/g,' ').trim()),
    pages: [...sheet.querySelectorAll('.rsp-page-tab')].map((t) => t.textContent.trim()),
    rows: sheet.querySelectorAll('table.rs-t tbody tr').length,
  };
})()`);
console.log('   工具栏:', JSON.stringify(maint.barText));
console.log('   页签数:', (maint.pages || []).length, JSON.stringify(maint.pages));
ok(maint.found && !maint.embed, '维护面板本体不是嵌入态');
ok(/保存/.test((maint.barText || []).join(' ')) && /模糊搜索/.test((maint.barText || []).join(' ')), '维护面板工具栏仍在(保存/模糊搜索)');
ok((maint.pages || []).length === 7, `7 个页签仍在(实测 ${(maint.pages || []).length})`);
ok((maint.rows || 0) > 0, '维护面板数据行仍渲染');

await pool.close(); ws.close(); edge.kill();
console.log(`\n${fails ? `❌ 失败 ${fails} 项` : '✅ 全部通过'}`);
process.exit(fails ? 1 : 0);
