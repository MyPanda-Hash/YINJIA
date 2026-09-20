/**
 * _verify-batch-header-ui.mjs — 批次号在各处的可见性 + 弹窗超送比例可调:
 *   ① 分批弹窗:超送比例可改(改小后上限同步收敛)
 *   ② 生成后:暂收单 单据卡片头部 + 表头字段 + 明细列 + 左栏「单据选择」列 都能看到批次号
 *   ③ 下游(检验/入库/退回)表头 + 表格列 都带批次号
 *   ④ 收尾清理
 * 用法: node tools/archive/_verify-batch-header-ui.mjs [采购订单号]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API = process.env.YJ_API || 'http://localhost:8090/api';
const FRONT = 'http://localhost:5173';
const PORT = 9413;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = path.join(__dirname, '_so-rail-shots');
const PO = process.argv[2] || 'YJ-20260915-12';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, msg) => { console.log(`  ${c ? '[PASS]' : '[FAIL]'} ${msg}`); if (!c) fails++; };

const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
const lj = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json();
const token = lj?.data?.token, user = lj?.data?.user;
const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token };
const post = async (url, body) => { const r = await fetch(API + url, { method: 'POST', headers: H, body: JSON.stringify(body) }); const j = await r.json(); if (j.code !== 0 && j.code !== 200) throw new Error(`${url} → ${JSON.stringify(j).slice(0, 200)}`); return j.data; };
const cb = (p, b, f) => post('/px/callButton', { panelCode: p, buttonName: b, formData: f, buttonParam: {} });

// ── 后端先造一条带批次的链路数据(弹窗比例=20% 走一次,顺便验证比例覆盖) ──
console.log(`\n=== ⓪ 生成测试链路(${PO},超送比例按 20% 覆盖) ===`);
const lines = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'SL_RECV', sourceNo: PO });
const line1 = (lines.lines || []).find((l) => Number(l.剩余数量) > 0);
if (!line1) { console.log('  [SKIP] 该订单无剩余可送'); await pool.close(); process.exit(0); }
const qty = Math.min(50, Number(line1.剩余数量));
// 故意用 20% 覆盖:申请 剩余×1.15(超过系统 5% 上限、低于本次 20%) → 应被放行,证明比例可调生效
const overQty = Math.round(Number(line1.剩余数量) * 1.15 * 100) / 100;
const gen = await post('/px/batchFlow/generate', {
  sourcePanel: 'PU_ORDER', targetPanel: 'SL_RECV', sourceNo: PO,
  lines: [{ lineKey: line1.lineKey, qty: overQty }], overRatio: 0.2,
});
console.log(`  超送申请 ${overQty}(剩余 ${line1.剩余数量} × 1.15)> 系统 5% 上限,但本次比例 20% → 生成 ${gen['编号']} 批次 ${gen['批次号']}`);
ok(!!gen['编号'], `比例覆盖生效(本次 20% 放行了 15% 超送)`);
const batchNo = gen['批次号'];
const slNo = gen['编号'];
await cb('SL_RECV', '审核', { 编号: slNo });
const insp = await cb('SL_RECV', '生成来料检验单', { 编号: slNo });
const ijNo = insp['编号'];
await q(`UPDATE qc_insp_detail SET 合格数量=10, 不合格数量=5, 数量=${qty} WHERE 单据编号=N'${ijNo}'`);
await cb('QC_INSP', '审核', { 编号: ijNo });
const piNo = (await q(`SELECT 单据编号 FROM bd_purchase_in WHERE 批次号=N'${batchNo}' AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='PURCHASE_IN' AND s.doc_no=bd_purchase_in.单据编号 AND ISNULL(s.canceled,'N')='Y')`))[0]?.单据编号;
const thNo = (await q(`SELECT 单据编号 FROM qc_return WHERE 批次号=N'${batchNo}' AND NOT EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='QC_RETURN' AND s.doc_no=qc_return.单据编号 AND ISNULL(s.canceled,'N')='Y')`))[0]?.单据编号;
console.log(`  链路: ${slNo} → ${ijNo} → ${piNo} / ${thNo}  (批次 ${batchNo})`);

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-bhdr-'));
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

  /** 打开某面板某单据,读 卡片头部/表头字段/明细列头/左栏列头 */
  async function inspect(panel, docNo, tag) {
    const url = `${FRONT}/?_v=${Date.now()}#/panelx/list/${panel}?docNo=${encodeURIComponent(docNo)}`;
    await send('Page.navigate', { url });
    for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`!!document.querySelector('.tools-right')`)) break; }
    await sleep(2600);
    const st = await ev(`(() => {
      const main = document.querySelector('.doc-rail-main') || document;
      const chip = document.querySelector('.tools-right')?.textContent.replace(/\\s+/g,' ').trim() || '';
      const headFields = [...main.querySelectorAll('.fields .field')].map((f) => [f.querySelector('label')?.textContent.trim(), (f.querySelector('input')?.value || f.querySelector('.field-readonly')?.textContent || '').trim()]);
      const batchHead = headFields.find(([l]) => l === '批次号');
      const tables = [...main.querySelectorAll('table')].map((tb) => ({
        heads: [...tb.querySelectorAll('thead th')].map((th) => th.textContent.trim()),
        rows: [...tb.querySelectorAll('tbody tr')].slice(0, 3).map((tr) => [...tr.children].map((td) => td.textContent.trim())),
      }));
      const det = tables.find((t) => t.heads.includes('批次号'));
      const rail = document.querySelector('.doc-select-rail');
      const railHeads = rail ? [...rail.querySelectorAll('thead th')].map((th) => th.textContent.trim()) : [];
      const railFirst = rail ? [...(rail.querySelectorAll('tbody tr')[0]?.children || [])].map((td) => td.textContent.trim()) : [];
      return { chip, batchHead: batchHead ? batchHead[1] : null, detHeads: det ? det.heads.join('|') : null, detBatchCol: det ? det.heads.indexOf('批次号') : -1, detFirstRow: det ? det.rows[0] : null, railHeads, railFirst };
    })()`);
    console.log(`\n  --- ${tag} ${panel} ${docNo} ---`);
    console.log('   卡片头部:', JSON.stringify(st.chip));
    console.log('   表头批次号:', JSON.stringify(st.batchHead));
    console.log('   明细列头:', JSON.stringify(st.detHeads));
    console.log('   明细首行批次号列值:', JSON.stringify(st.detFirstRow && st.detBatchCol >= 0 ? st.detFirstRow[st.detBatchCol] : null));
    console.log('   左栏列头:', JSON.stringify(st.railHeads), ' 首行:', JSON.stringify(st.railFirst));
    ok(/批次号/.test(st.chip || ''), `${tag}:单据卡片头部显示批次号`);
    ok(st.batchHead === batchNo, `${tag}:表头「批次号」= ${batchNo}`);
    ok(st.detBatchCol >= 0, `${tag}:明细表格含「批次号」列`);
    ok(st.detFirstRow && st.detFirstRow[st.detBatchCol] === batchNo, `${tag}:明细行批次号 = ${batchNo}`);
    ok(st.railHeads.includes('批次号'), `${tag}:左栏「单据选择」含批次号列`);
    return st;
  }

  console.log('\n=== ① 四张单的批次号可见性 ===');
  await inspect('SL_RECV', slNo, '暂收');
  await inspect('QC_INSP', ijNo, '检验');
  if (piNo) await inspect('PURCHASE_IN', piNo, '入库');
  if (thNo) await inspect('QC_RETURN', thNo, '退回');

  console.log('\n=== ② 弹窗超送比例可调 ===');
  const url2 = `${FRONT}/?_v=${Date.now()}#/panelx/list/PU_ORDER?docNo=${encodeURIComponent(PO)}`;
  await send('Page.navigate', { url: url2 });
  for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`!!document.querySelector('.tools-right')`)) break; }
  await sleep(2200);
  await ev(`(() => { const g=[...document.querySelectorAll('.tb-group')].find(x=>/生单/.test(x.querySelector('.tb-main')?.textContent||'')); g?.querySelector('.tb-caret')?.click(); return 'ok'; })()`);
  await sleep(500);
  await ev(`(() => { const b=[...document.querySelectorAll('.tb-menu .ctx-item')].find(x=>/生成送料暂收单/.test(x.textContent||'')); b?.click(); return 'ok'; })()`);
  await sleep(3000);
  const dlgInfo = await ev(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null && /分批送料/.test(x.textContent || ''));
    if (!d) return null;
    const ratioInp = d.querySelector('.bsd-ratio input');
    const capCell = d.querySelector('.el-table__body tbody tr td:nth-child(9)')?.textContent.trim();
    return { ratio: ratioInp?.value || '', capFirst: capCell, tip: /本次生效/.test(d.textContent) };
  })()`);
  console.log('  弹窗:', JSON.stringify(dlgInfo));
  ok(!!dlgInfo && dlgInfo.ratio !== '', `弹窗有可编辑「超送比例」输入框(当前 ${dlgInfo?.ratio}%)`);
  ok(dlgInfo?.tip === true, '弹窗注明「0 = 不允许超送;本次生效」');
  // 改比例 → 上限联动
  await ev(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null && /分批送料/.test(x.textContent || ''));
    const inp = d.querySelector('.bsd-ratio input');
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(inp, '30'); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true }));
    inp.dispatchEvent(new Event('blur', { bubbles: true }));
    return inp.value;
  })()`);
  await sleep(1200);
  const after = await ev(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null && /分批送料/.test(x.textContent || ''));
    // 按列头定位「剩余 / 可送上限」下标(不靠硬编码列序)
    const heads = [...d.querySelectorAll('.el-table__header th')].map((th) => th.textContent.trim());
    const iRemain = heads.findIndex((h) => h === '剩余'), iCap = heads.findIndex((h) => h === '可送上限');
    const all = [...d.querySelectorAll('.el-table__body tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent.trim()));
    const row = all.find((c) => Number(c[iRemain]) > 0) || all[0];
    return { ratio: d.querySelector('.bsd-ratio input')?.value || '', iRemain, iCap, remain: row[iRemain], cap: row[iCap] };
  })()`);
  const remain = Number(after.remain || 0), cap = Number(after.cap || 0);
  console.log(`  改 30% 后取 剩余>0 的行: 剩余 ${remain} 可送上限 ${cap}(列下标 ${after.iRemain}/${after.iCap})`);
  ok(remain > 0 && Math.abs(cap - remain * 1.3) < 0.51, `上限随比例联动:剩余 ${remain} × 1.3 = ${cap}`);
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true });
  fs.writeFileSync(path.join(OUT, 'batch-send-ratio.png'), Buffer.from(shot.result.data, 'base64'));
  ws.close();
} finally {
  edge.kill();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  console.log('\n=== 收尾清理测试链路 ===');
  for (const [p, no] of [['PURCHASE_IN', piNo], ['QC_RETURN', thNo], ['QC_INSP', ijNo], ['SL_RECV', slNo]]) {
    if (!no) continue;
    for (const b of ['弃审', '删除']) { try { await cb(p, b, { 编号: no }); console.log(`  ${p} ${no} ${b} ok`); } catch (e) { console.log(`  ${p} ${no} ${b} 跳过`); } }
  }
  await pool.close();
}
console.log(fails ? `\n${fails} 项失败` : '\n全部通过');
process.exit(fails ? 1 : 0);
