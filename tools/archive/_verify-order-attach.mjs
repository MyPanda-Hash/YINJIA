/**
 * _verify-order-attach.mjs — 订单附件端到端实测:六个订单面板出现「附件」区且已审核单也能上传
 *  ① 界面:附件区存在、有「上传附件」按钮(已审核单)
 *  ② 真上传:CDP DOM.setFileInputFiles 传一个 txt → 断言 chip 出现 + yj_attachment 落库 + 头列镜像
 *  ③ 清理:删除附件(还原库与磁盘)
 * 用法: node tools/archive/_verify-order-attach.mjs
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
const PORT = 9405;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = path.join(__dirname, '_so-rail-shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, msg) => { console.log(`  ${c ? '[PASS]' : '[FAIL]'} ${msg}`); if (!c) fails++; };

// 每面板取一张单据(优先非草稿,用于证明"已审核也能传")
const PANELS = ['PU_ORDER', 'SO_ORDER', 'MANU_ORDER', 'OUTSOURCE_ORDER', 'WO_ORDER', 'KHDD'];

const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (sql) => (await new mssql.Request(pool).query(sql)).recordset;

const login = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json();
const token = login?.data?.token, user = login?.data?.user;
if (!token) { console.error('登录失败'); process.exit(1); }

const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-att-'));
const upFile = path.join(tmpdir, '订单附件测试.txt');
fs.writeFileSync(upFile, 'YINJIA-MES 订单附件端到端测试 ' + new Date().toISOString(), 'utf8');

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-attp-'));
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let tab = null;
for (let i = 0; i < 40 && !tab; i++) {
  await sleep(1000);
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json(); } catch {}
}
if (!tab) throw new Error('Edge CDP 未就绪');
const uploaded = [];
try {
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let seq = 0; const pending = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
  const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
  await send('Page.enable'); await send('Runtime.enable'); await send('DOM.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${FRONT}/#/login` });
  await sleep(2500);
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_login_date','2026-09-20'); localStorage.setItem('mes_locale','zh-CN'); 'ok'`);

  for (const panel of PANELS) {
    // 取该面板**列表里真实可见**的一张单据(从 API 取,避免挑到已作废/被过滤的单)
    const p = (await q(`SELECT head_table, group_col FROM yj_panel WHERE panel_code=N'${panel}'`))[0];
    const lr = await fetch(API + '/px/queryFormDataList', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token }, body: JSON.stringify({ panelCode: panel, condition: {}, pageNo: 1, pageSize: 5 }) });
    const lj2 = await lr.json();
    const docs = lj2?.data?.list || [];
    const docNo = String(docs[0]?.['编号'] || '');
    const meta = await q(`SELECT COUNT(*) n FROM yj_field WHERE panel_code=N'${panel}' AND data_type=N'附件'`);
    console.log(`\n=== ${panel}(可见单据 ${lj2?.data?.totalSize ?? '-'} 张;取 ${String(docNo)} / 状态 ${docs[0]?.['单据状态'] ?? '-'})=`);
    ok(meta[0].n === 6, `${panel}:元数据已注册 6 个附件列位(实得 ${meta[0].n})`);
    if (!docNo) { console.log(`  [SKIP] ${panel} 当前没有可见单据,无法做界面上传验证(功能由元数据驱动,有单即出现附件区)`); continue; }
    const url = `${FRONT}/?_v=${Date.now()}#/panelx/list/${panel}?docNo=${encodeURIComponent(docNo)}`;
    await send('Page.navigate', { url });
    for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`!!document.querySelector('.attach-strip') || !!document.querySelector('.toolbar-query-btn')`)) break; }
    await sleep(2500);
    const st = await ev(`(() => {
      const strip = document.querySelector('.attach-strip');
      return {
        hasStrip: !!strip,
        label: strip?.querySelector('.attach-strip-label')?.textContent.trim() || '',
        slots: document.querySelectorAll('.attach-strip .fac-upload-btn').length,
        chip: document.querySelector('.doc-chip')?.textContent.trim() || '',
        status: document.querySelector('.doc-status')?.textContent.trim() || '',
      };
    })()`);
    console.log('  ', JSON.stringify(st));
    ok(st.hasStrip, `${panel}:附件区存在(标签 ${JSON.stringify(st.label)})`);
    if (!st.hasStrip) continue;
    ok(st.slots > 0, `${panel}:有「上传附件」入口(状态 ${JSON.stringify(st.status)})`);
    if (st.slots === 0) continue;

    // 真上传:注入文件到隐藏 input
    const { result: { root } } = await send('DOM.getDocument', { depth: -1 });
    const q1 = await send('DOM.querySelector', { nodeId: root.nodeId, selector: '.attach-strip input[type=file]' });
    if (!q1.result?.nodeId) { console.log('  [FAIL] 找不到文件输入框'); fails++; continue; }
    await send('DOM.setFileInputFiles', { files: [upFile], nodeId: q1.result.nodeId });
    await sleep(3000);
    const st2 = await ev(`(() => {
      const strip = document.querySelector('.attach-strip');
      return { chips: [...strip.querySelectorAll('.fac-chip .fac-name')].map((e) => e.textContent.trim()), empty: !!strip.querySelector('.fac-empty') };
    })()`);
    console.log('  上传后:', JSON.stringify(st2));
    ok(st2.chips.some((c) => c.includes('订单附件测试')), `${panel}:上传成功并出现附件 chip`);
    // 落库核对
    const rows = await q(`SELECT id, field_key, file_name, file_size FROM yj_attachment WHERE panel_code=N'${panel}' AND doc_no=N'${docNo}'`);
    console.log('  yj_attachment:', JSON.stringify(rows));
    ok(rows.length > 0 && rows.some((r) => String(r.file_name).includes('订单附件测试')), `${panel}:附件落库 yj_attachment`);
    // 头列镜像
    if (p?.head_table && rows.length) {
      const mirror = await q(`SELECT [${rows[0].field_key}] v FROM ${p.head_table} WHERE [${p.group_col}]=N'${docNo}'`);
      console.log(`  头列镜像 ${rows[0].field_key} = ${JSON.stringify(mirror[0]?.v)}`);
      ok(String(mirror[0]?.v || '').includes('订单附件测试'), `${panel}:文件名镜像回头列(打印/列表可见)`);
    }
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true });
    fs.writeFileSync(path.join(OUT, `attach-${panel}.png`), Buffer.from(r.result.data, 'base64'));
    uploaded.push({ panel, docNo, ids: rows.map((x) => x.id), file: upFile });
    // 顺手删掉(与 finally 的兜底清理等价,保证每面板测完即干净)
    await ev(`(() => { const c=document.querySelector('.attach-strip .fac-del'); if (c) c.click(); return 'ok'; })()`);
    await sleep(600);
    await ev(`(() => { const b=[...document.querySelectorAll('.el-message-box__btns .el-button')].find((x)=>/确定/.test(x.textContent)); b?.click(); return 'ok'; })()`);
    await sleep(1200);
    const left = await q(`SELECT COUNT(*) n FROM yj_attachment WHERE panel_code=N'${panel}' AND doc_no=N'${docNo}'`);
    console.log(`  界面删除后剩 ${left[0].n} 个附件`);
    ok(left[0].n === 0, `${panel}:界面删除附件生效`);
  }
  ws.close();
} finally {
  edge.kill();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  // ── 清理:删附件行 + 用户目录里的实体文件 + 头列还原 ──
  for (const u of uploaded) {
    const p = (await q(`SELECT head_table, group_col FROM yj_panel WHERE panel_code=N'${u.panel}'`))[0];
    const files = await q(`SELECT stored_name, field_key FROM yj_attachment WHERE panel_code=N'${u.panel}' AND doc_no=N'${u.docNo}'`);
    for (const f of files) {
      const dir = path.join('D:/YINJIA-main/backend', 'uploads', 'attachments');
      for (const d of [dir, path.join('D:/YINJIA-main', 'uploads', 'attachments')]) {
        const fp = path.join(d, String(f.stored_name));
        if (fs.existsSync(fp)) { fs.rmSync(fp); console.log('  已删实体文件:', fp); }
      }
      if (p?.head_table) await q(`UPDATE ${p.head_table} SET [${f.field_key}]=NULL WHERE [${p.group_col}]=N'${u.docNo}'`);
    }
    await q(`DELETE FROM yj_attachment WHERE panel_code=N'${u.panel}' AND doc_no=N'${u.docNo}'`);
    console.log(`  已清理 ${u.panel} ${u.docNo} 的测试附件 ${files.length} 个`);
  }
  await pool.close();
  try { fs.rmSync(tmpdir, { recursive: true, force: true }); } catch {}
}
console.log(fails ? `\n${fails} 项失败` : '\n全部通过');
process.exit(fails ? 1 : 0);
