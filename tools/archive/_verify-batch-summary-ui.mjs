/**
 * _verify-batch-summary-ui.mjs — 采购订单表头「送料」只读摘要 + 点击浮层(方案 A 轻量版):
 *   ① 已审批采购订单:表头字段区末尾出现一行只读摘要(送料: 已送 N 批 / 剩余 X / 可补 Y ▸)
 *      —— 数值 = 接口(批次台账 + 行级剩余/退货)实测值
 *   ② 未审批/已中止订单:不出现该摘要行
 *   ③ 点摘要 → 弹浮层,窄表 = 批次台账有效批次(批次号/日期/数量/状态/暂收单/操作),行数与接口一致
 *   ④ 浮层「查看」→ 跳到该批次的送料暂收单(QC_RECV)且定位到该单
 *   ⑤ 性能:摘要只在切换单据时请求一次(同一单据停留不重复请求);独立台账面板已下线(无菜单、接口无该面板)
 * 用法: node tools/archive/_verify-batch-summary-ui.mjs
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
const PORT = 9441;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, msg) => { console.log(`  ${c ? '[PASS]' : '[FAIL]'} ${msg}`); if (!c) fails++; };

const pool = await new mssql.ConnectionPool({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia', password: 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } }).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
const lj = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json();
const token = lj?.data?.token, user = lj?.data?.user;
const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token };
const post = async (url, body) => (await (await fetch(API + url, { method: 'POST', headers: H, body: JSON.stringify(body) })).json());

// 样本:有有效批次的已审批订单 / 无批次订单 / 已中止订单
const withBatch = (await q(`SELECT TOP 1 source_form_no AS no FROM yj_doc_batch WHERE source_panel_code='PU_ORDER' AND status='ACTIVE' GROUP BY source_form_no ORDER BY COUNT(*) DESC`))[0]?.no;
const apiList = (await post('/px/queryFormDataList', { panelCode: 'PU_ORDER', pageNo: 1, pageSize: 300 })).data?.list || [];
const stopped = apiList.find((r) => String(r['单据状态']) === '已中止');
console.log(`样本:有批次=${withBatch} / 已中止=${stopped?.['单据编号']}`);
if (!withBatch) { console.log('[SKIP] 无带有效批次的采购订单'); await pool.close(); process.exit(0); }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-bsum-'));
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let tab = null;
for (let i = 0; i < 40 && !tab; i++) {
  await sleep(1000);
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json(); } catch {}
}
if (!tab) throw new Error('Edge CDP 未就绪');
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
localStorage.setItem('mes_login_date','2026-09-21'); localStorage.setItem('mes_locale','zh-CN'); 'ok'`);

const READ = `(() => {
  const line = document.querySelector('.batch-sum-line');
  const pop = document.querySelector('.batch-pop-body');
  const tb = pop ? pop.querySelector('.el-table__body-wrapper table') : null;
  const hd = pop ? pop.querySelector('.el-table__header-wrapper table') : null;
  const R = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), right: Math.round(b.right), bottom: Math.round(b.bottom) }; };
  const wrap = document.querySelector('.header-fields');
  const popper = pop ? (pop.closest('.el-popper') || pop) : null;
  const wr = R(wrap), pr = R(popper);
  const fields = wrap ? [...wrap.querySelectorAll('.field')].map((f) => ({ label: (f.querySelector('label')?.textContent || '').trim(), rect: R(f) })) : [];
  const overlap = (a, b) => !(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y);
  const cr = R(line);
  return {
    summary: line ? line.textContent.replace(/\\s+/g, ' ').trim() : null,
    summaryTag: line ? line.tagName : null,
    popOpen: !!pop,
    popHead: pop ? (pop.querySelector('.bpb-head')?.textContent || '').replace(/\\s+/g,' ').trim() : '',
    popCols: hd ? [...hd.querySelectorAll('thead th')].map((th) => th.textContent.trim()).filter(Boolean) : [],
    popRows: tb ? [...tb.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent.trim())) : [],
    empty: pop ? (pop.querySelector('.el-table__empty-text')?.textContent.trim() || '') : '',
    calls: performance.getEntriesByType('resource').filter((r) => r.name.includes('batchFlow/lines')).length,
    /* 布局断言用:浮层是否落在表头字段区下方末尾、是否遮挡字段;摘要行是否是最后一个字段之后的最后一项 */
    layout: (wr && pr) ? {
      fieldsRect: wr, popRect: pr,
      belowFields: pr.y >= wr.bottom - 2,
      rightAligned: Math.abs(pr.right - wr.right) <= 12,
      coveredFields: fields.filter((f) => overlap(pr, f.rect)).map((f) => f.label),
      /* 摘要行必须排在所有表头字段之后:①DOM 上除锚点外是最后一项 ②几何上没有任何字段在它后面(同行更右 或 更靠下) */
      chipAfterLastField: fields.every((f) => (cr.y > f.rect.y + 4) || (Math.abs(cr.y - f.rect.y) <= 14 && cr.x >= f.rect.right - 2)),
      chipIsLastItem: (() => {
        const kids = [...wrap.children].filter((el) => !el.classList.contains('batch-anchor'));
        return kids.length > 0 && kids[kids.length - 1] === line;
      })(),
      fieldCount: fields.length,
    } : null,
  };
})()`;
async function openPanel(panel, docNo) {
  await send('Page.navigate', { url: `${FRONT}/?_v=${Date.now()}#/panelx/list/${panel}?docNo=${encodeURIComponent(docNo)}` });
  for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`!!document.querySelector('.tools-right') && !!document.querySelector('.header-fields')`)) break; }
  await sleep(2600);
  return ev(READ);
}

// ── ① 摘要行 + ⑤ 请求次数 ──
console.log(`\n=== ① 摘要行(已审批采购订单 ${withBatch})===`);
let st = await openPanel('PU_ORDER', withBatch);
const api = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: withBatch });
const expBatches = (api.data?.batches || []).length;
const expLeft = (api.data?.lines || []).reduce((a, l) => a + Number(l.剩余数量 || 0), 0);
const expRet = (api.data?.lines || []).reduce((a, l) => a + Number(l.已退回数量 || 0), 0);
console.log('   摘要:', JSON.stringify(st.summary));
ok(!!st.summary, '表头出现只读摘要行');
ok(st.summaryTag === 'BUTTON', `摘要行是只读按钮(非输入框):${st.summaryTag}`);
ok(new RegExp(`已送 ${expBatches} 批`).test(st.summary || ''), `已送批次数 = 台账有效批次(${expBatches})`);
ok((st.summary || '').includes(`剩余 ${expLeft}`), `剩余 = 接口剩余(${expLeft})`);
ok((st.summary || '').includes(`可补 ${expRet}`), `可补 = 接口已退回(${expRet})`);
ok((st.summary || '').includes('▸'), '摘要行带展开标记 ▸');
ok(st.calls === 1, `切换单据只请求一次批次数据(=1,实测 ${st.calls})`);
await sleep(2500);
const again = await ev(READ);
ok(again.calls === 1, `停留在同一单据不重复请求(仍为 ${again.calls})`);

// ── ③ 浮层窄表 ──
console.log('\n=== ③ 点击 → 浮层窄表 ===');
await ev(`document.querySelector('.batch-sum-line').click(), 'ok'`);
await sleep(2200);
st = await ev(READ);
console.log('   浮层列头:', JSON.stringify(st.popCols));
console.log('   浮层行:', JSON.stringify(st.popRows));
console.log('   浮层标题:', JSON.stringify(st.popHead));
ok(st.popOpen, '点击摘要行弹出浮层');
ok(st.popCols.join('|') === '批次号|日期|数量|状态|暂收单|操作', `窄表列头 = 批次号/日期/数量/状态/暂收单/操作(${st.popCols.join('|')})`);
ok(st.popRows.length === expBatches, `窄表行数 = 台账有效批次数(${st.popRows.length}/${expBatches})`);
ok(st.popRows.every((r) => r[3] === '有效'), '台账 ACTIVE → 状态列显示「有效」');
ok((st.popHead || '').includes(withBatch), `浮层标题带单据号(${st.popHead})`);
ok(st.calls >= 2, `点开浮层强制刷新一次(请求数 ${st.calls})`);
console.log('   浮层位置:', JSON.stringify(st.layout));
ok(st.layout?.belowFields, '浮层落在表头字段区**下方**(不压字段)');
ok(st.layout?.rightAligned, '浮层右缘对齐表头字段区右缘(字段区末尾)');
ok((st.layout?.coveredFields || []).length === 0, `浮层未遮挡任何表头字段(${JSON.stringify(st.layout?.coveredFields)})`);
ok(st.layout?.chipIsLastItem === true, '摘要行是表头字段区里最后一个字段之后的最后一项(DOM 顺序,表头怎么改都成立)');
ok(st.layout?.chipAfterLastField === true, `没有任何表头字段排在摘要行之后(字段数 ${st.layout?.fieldCount})`);
const baseFieldCount = st.layout?.fieldCount; // ⑥ 的基线:界面可见表头字段数(表头改动前的口径)

// ── ④ 查看 → 跳暂收单 ──
const targetNo = (api.data?.batches || [])[0]?.targetFormNo;
console.log(`\n=== ④ 浮层「查看」→ ${targetNo} ===`);
await ev(`document.querySelector('.batch-pop-body .el-table__body-wrapper tbody tr .el-button').click(), 'ok'`);
await sleep(3800);
const jumped = await ev(`({ hash: location.hash, chip: (document.querySelector('.tools-right')?.textContent || '').replace(/\\s+/g,' ').trim().slice(0, 70) })`);
console.log('   hash:', jumped.hash, ' 头部:', jumped.chip);
ok(String(jumped.hash).includes('QC_RECV'), '跳到送料暂收单面板');
ok(String(jumped.chip).includes(targetNo), `定位到目标暂收单 ${targetNo}`);

// ── ② 已中止订单不含摘要行 ──
if (stopped) {
  console.log(`\n=== ② 已中止订单不含摘要行(${stopped['单据编号']})===`);
  const s2 = await openPanel('PU_ORDER', String(stopped['单据编号']));
  ok(s2.summary === null, '已中止订单不显示送料摘要行');
}
// ── ⑥ 「表头修改后仍然跟在最后一个字段之后」 ──
// 复用表头调整的真实保存接口(/px/saveHeaderPrefs → yj_field 的 seq/alias/hidden/visible),
// 临时隐藏一个表头字段 → 校验摘要行仍排在最后一个字段之后;验完把原表头原样写回并核对库值。
console.log('\n=== ⑥ 表头修改后:摘要行仍跟在最后一个字段之后 ===');
const origRows = await q(`SELECT col_name, seq, alias, hidden, visible FROM yj_field WHERE panel_code='PU_ORDER' AND place LIKE '%header%' ORDER BY seq`);
const origCols = origRows.map((r) => ({ label: r.col_name, alias: r.alias || '', visible: !!r.visible }));
const hideTarget = origRows.find((r) => r.visible && r.col_name === '供应商') || origRows.find((r) => r.visible);
const newCols = origCols.map((c) => (c.label === hideTarget.col_name ? { ...c, visible: false } : c));
await post('/px/saveHeaderPrefs', { panelCode: 'PU_ORDER', columns: newCols });
await sleep(1200);
try {
  const s6 = await openPanel('PU_ORDER', withBatch);
  ok(s6.summary !== null, `隐藏字段「${hideTarget.col_name}」后摘要行仍在`);
  ok(s6.layout?.chipIsLastItem === true, '表头改后:摘要行仍是字段区最后一项(DOM 顺序)');
  ok(s6.layout?.chipAfterLastField === true, `表头改后:没有字段排在摘要行之后(字段数 ${s6.layout?.fieldCount},改前 ${baseFieldCount})`);
  ok(s6.layout?.fieldCount === baseFieldCount - 1, `隐藏生效(界面可见字段 ${baseFieldCount} → ${s6.layout?.fieldCount}),且摘要行未受影响`);
} finally {
  await post('/px/saveHeaderPrefs', { panelCode: 'PU_ORDER', columns: origCols });
  await sleep(1200);
  const back = await q(`SELECT col_name, seq, alias, hidden, visible FROM yj_field WHERE panel_code='PU_ORDER' AND place LIKE '%header%' ORDER BY seq`);
  // 注:/px/saveHeaderPrefs 会按提交顺序把 seq 归一为 (i+1)*10(表头调整的既定行为),
  //     故还原校验比「字段顺序 + alias/hidden/visible 逐项一致」,不比对 seq 数值。
  const snap = (rs) => JSON.stringify(rs.map((r) => [r.col_name, r.alias, r.hidden, r.visible]));
  const orderSame = JSON.stringify(back.map((r) => r.col_name)) === JSON.stringify(origRows.map((r) => r.col_name));
  ok(snap(back) === snap(origRows) && orderSame, '表头字段配置已原样还原(字段顺序 + alias/hidden/visible 与改动前一致)');
}

// ── ⑤ 独立台账面板已下线 ──
console.log('\n=== ⑤ 独立台账面板已下线 ===');
const cfg = await fetch(API + '/px/getPanelConfig?panelCode=BATCH_LEDGER', { headers: H }).then((r) => r.json()).catch(() => ({}));
const hasPanel = !!(cfg?.data?.metadata?.panelCode);
const menuHit = await ev(`(async () => {
  const m = await import('/src/business/menus.js');
  const flat = [];
  const walk = (ns) => (ns || []).forEach((n) => { if (n.panelCode === 'BATCH_LEDGER') flat.push(n); if (n.children) walk(n.children); });
  walk(m.menuTree);
  return flat.length;
})()`);
ok(!hasPanel, '后端已无 BATCH_LEDGER 面板配置');
ok(menuHit === 0, '前端菜单树已无该入口');
const viewGone = (await q(`SELECT OBJECT_ID('dbo.v_batch_ledger') AS id`))[0].id;
ok(viewGone === null, '数据库视图 v_batch_ledger 已删除');

await pool.close();
ws.close(); edge.kill();
console.log(`\n${fails ? `❌ 失败 ${fails} 项` : '✅ 全部通过'}`);
process.exit(fails ? 1 : 0);
