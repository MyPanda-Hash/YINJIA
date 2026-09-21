/**
 * _verify-insp-oneclick-ui.mjs — 界面验证:送料暂收单点「生成来料检验单」**不弹分批对话框**,一键整单生成
 *   对照:采购订单点「生成送料暂收单」**仍然弹**分批对话框
 * 用法: node tools/archive/_verify-insp-oneclick-ui.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const API = process.env.YJ_API || 'http://localhost:8090/api';
const FRONT = 'http://localhost:5173';
const PORT = 9417;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PO = 'YJ-20260916-01';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, msg) => { console.log(`  ${c ? '[PASS]' : '[FAIL]'} ${msg}`); if (!c) fails++; };

const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
const lj = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json();
const token = lj?.data?.token, user = lj?.data?.user;
const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token };
const post = async (u, b) => { const r = await fetch(API + u, { method: 'POST', headers: H, body: JSON.stringify(b) }); const j = await r.json(); if (j.code !== 0 && j.code !== 200) throw new Error(`${u} → ${j.message}`); return j.data; };
const cb = (p, b, f) => post('/px/callButton', { panelCode: p, buttonName: b, formData: f, buttonParam: {} });

// 造一张已审核暂收单(送 40)
const st = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: PO });
const line = st.lines.find((l) => Number(l.剩余数量) > 0);
const gen = await post('/px/batchFlow/generate', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: PO, lines: [{ lineKey: line.lineKey, qty: 40 }] });
await cb('QC_RECV', '审核', { 编号: gen['编号'] });
console.log(`测试暂收单: ${gen['编号']} 批次 ${gen['批次号']}`);

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-1click-'));
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let tab = null;
for (let i = 0; i < 40 && !tab; i++) { await sleep(1000); try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json(); } catch {} }
if (!tab) throw new Error('Edge CDP 未就绪');
let inspNo = null;
try {
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let seq = 0; const pending = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
  const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value;
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${FRONT}/#/login` });
  await sleep(2500);
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_login_date','2026-09-20'); localStorage.setItem('mes_locale','zh-CN'); 'ok'`);
  const openPanel = async (panel, docNo) => {
    await send('Page.navigate', { url: `${FRONT}/?_v=${Date.now()}#/panelx/list/${panel}?docNo=${encodeURIComponent(docNo)}` });
    for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`!!document.querySelector('.tools-right')`)) break; }
    await sleep(2200);
  };
  const clickAction = async (label) => {
    let r = await ev(`(() => { const b=[...document.querySelectorAll('.tb-main')].find(x=>x.textContent.trim()===${JSON.stringify(label)}); if(b){b.click(); return 'main';} return 'no'; })()`);
    if (r === 'no') {
      await ev(`(() => { const g=[...document.querySelectorAll('.tb-group')].find(x=>/生单/.test(x.querySelector('.tb-main')?.textContent||'')); g?.querySelector('.tb-caret')?.click(); return 'ok'; })()`);
      await sleep(500);
      r = await ev(`(() => { const b=[...document.querySelectorAll('.tb-menu .ctx-item')].find(x=>x.textContent.trim()===${JSON.stringify(label)}); if(b){b.click(); return 'menu';} return 'no'; })()`);
    }
    if (r === 'no') {
      // 单动作组(如 QC_RECV 的「生单」组只有 生成来料检验单):主按钮文字=组名「生单」,点它即执行该动作
      r = await ev(`(() => { const b=[...document.querySelectorAll('.tb-main')].find(x=>x.textContent.trim()==='生单'); if(b){b.click(); return 'group-main';} return 'no'; })()`);
    }
    return r;
  };

  console.log('\n=== ① 送料暂收单 →「生成来料检验单」:不应弹分批对话框 ===');
  await openPanel('QC_RECV', gen['编号']);
  const clicked = await clickAction('生成来料检验单');
  await sleep(4000);
  const dlg = await ev(`!![...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && /分批送料/.test(d.textContent || ''))`);
  ok(clicked !== 'no', `点到了「生成来料检验单」(${clicked})`);
  ok(dlg === false, '没有弹出「分批送料」对话框');
  inspNo = (await q(`SELECT TOP 1 i.单据编号 FROM qc_insp i JOIN form_flow_link l ON l.target_form_no=i.单据编号 AND l.target_panel_code='QC_INSP' AND l.source_form_no=N'${gen['编号']}' AND l.link_status='ACTIVE' ORDER BY i.id DESC`))[0]?.单据编号 || null;
  console.log('  生成的检验单:', inspNo);
  ok(!!inspNo, `一键生成了检验单 ${inspNo}`);
  const ij = await q(`SELECT 批次号, (SELECT SUM(CAST(送检数量 AS decimal(18,4))) FROM qc_insp_detail WHERE 单据编号=i.单据编号) 送检合计 FROM qc_insp i WHERE 单据编号=N'${inspNo}'`);
  console.log('  检验单批次号/送检合计:', JSON.stringify(ij[0]));
  ok(String(ij[0]?.批次号) === String(gen['批次号']), `检验单继承同一批次号 ${gen['批次号']}`);
  ok(Math.abs(Number(ij[0]?.送检合计 || 0) - 40) < 0.001, '送检数量 = 暂收剩余全部(40)');

  console.log('\n=== ② 采购订单 →「生成送料暂收单」:仍应弹分批对话框 ===');
  await openPanel('PU_ORDER', PO);
  await clickAction('生成送料暂收单');
  let dlg2 = null;
  for (let i = 0; i < 20; i++) { await sleep(500); dlg2 = await ev(`!![...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && /分批送料/.test(d.textContent || ''))`); if (dlg2) break; }
  ok(dlg2 === true, '批次源头那一跳仍弹分批对话框');
  ws.close();
} finally {
  edge.kill();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  console.log('\n=== 收尾清理 ===');
  for (const [p, no] of [['QC_INSP', inspNo], ['QC_RECV', gen['编号']]]) {
    if (!no) continue;
    for (const b of ['弃审', '删除']) { try { await cb(p, b, { 编号: no }); console.log(`  ${p} ${no} ${b} ok`); } catch { console.log(`  ${p} ${no} ${b} 跳过`); } }
  }
  await pool.close();
}
console.log(fails ? `\n${fails} 项失败` : '\n全部通过');
process.exit(fails ? 1 : 0);
