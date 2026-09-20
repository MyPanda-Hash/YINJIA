/**
 * _verify-demo-view.mjs — 用 ?docNo= 直达两条测试数据,读界面实际渲染的「采购订单号/采购订单行号」并截图
 * 用法: node tools/archive/_verify-demo-view.mjs
 * 输出: tools/archive/_so-rail-shots/demo-{入库单,退回单}.png
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONT = 'http://localhost:5173';
const API = 'http://localhost:8090/api';
const PORT = 9367;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = path.join(__dirname, '_so-rail-shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TARGETS = [
  { panel: 'PU_ORDER', docNo: 'YJ-20260915-08', tag: '①链路源-采购订单' },
  { panel: 'SL_RECV', docNo: 'SL-2026-09-0012', tag: '②送料暂收' },
  { panel: 'QC_INSP', docNo: 'IJ-2026-09-0011', tag: '③来料检验(含不良)' },
  { panel: 'PURCHASE_IN', docNo: 'PI-2026-09-0020', tag: '④采购入库-含不良路径' },
  { panel: 'QC_RETURN', docNo: 'TH-2026-09-0002', tag: '⑤暂收退回-不良支路' },
  { panel: 'SL_RECV', docNo: 'SL-2026-09-0011', tag: '①链路源-暂收(全合格)' },
  { panel: 'QC_INSP', docNo: 'IJ-2026-09-0010', tag: '②检验(全合格)' },
  { panel: 'PURCHASE_IN', docNo: 'PI-2026-09-0019', tag: '③采购入库-全合格路径' },
];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const lj = await (await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json();
  const token = lj?.data?.token, user = lj?.data?.user;
  if (!token) throw new Error('登录失败');

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-demo-'));
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
    const shot = async (name) => {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true });
      const f = path.join(OUT, name + '.png');
      fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'));
      return f;
    };
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1000, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: `${FRONT}/#/login` });
    await sleep(2500);
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_login_date', '2026-09-20'); localStorage.setItem('mes_locale','zh-CN'); 'ok'`);

    for (const t of TARGETS) {
      // 注意:hash-only 跳转是同文档导航(不重载)→ pinia 里无 token 会被守卫踢回 /login;
      // 故在 base 上加一次性 query 强制整页重载
      const url = `${FRONT}/?_v=${Date.now()}#/panelx/list/${t.panel}?docNo=${t.docNo}`;
      await send('Page.navigate', { url });
      for (let i = 0; i < 80; i++) { await sleep(400); if (await ev(`!!document.querySelector('.doc-rail-main table, .doc-rail-main')`)) break; }
      await sleep(2500);
      const info = await ev(`(() => {
        const main = document.querySelector('.doc-rail-main') || document;
        // 取值:①原生 input.value ②el-select 已选项文本 ③去掉 label 后的字段文本
        // (「检验单号」是 query-ref-select 参照下拉,input.value 恒为空,只有已选项 span 带值)
        const valOf = (f) => {
          const inp = f.querySelector('input');
          if (inp && inp.value && inp.value.trim()) return inp.value.trim();
          const sel = f.querySelector('.el-select__selected-item');
          if (sel && sel.textContent.trim()) return sel.textContent.trim();
          const c = f.cloneNode(true); c.querySelector('label')?.remove();
          return (c.textContent || '').replace(/\s+/g, ' ').trim();
        };
        const fields = [...main.querySelectorAll('.fields .field')].map(f => [f.querySelector('label')?.textContent.trim(), valOf(f)]);
        const tables = [...main.querySelectorAll('table')].map((tb) => {
          const heads = [...tb.querySelectorAll('thead th')].map(th => th.textContent.trim());
          const firstRow = [...(tb.querySelectorAll('tbody tr')[0]?.children || [])].map(td => td.textContent.trim());
          const rows = [...tb.querySelectorAll('tbody tr')].slice(0, 4).map(tr => [...tr.children].map(td => td.textContent.trim()));
          return { heads, firstRow, rows };
        });
        const rail = document.querySelector('.doc-select-rail');
        return {
          表头字段: fields.filter(([l]) => ['单据编号','采购订单号','供应商','单据状态','检验单号'].includes(l || '')),
          左栏: rail ? [...rail.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.textContent.trim())) : null,
          表: tables,
        };
      })()`);
      console.log(`\n=== ${t.tag} | ${t.panel} ${t.docNo} ===`);
      console.log('  URL:', url);
      if (!info || (!info.左栏 && !(info.表 || []).length)) {
        console.log('  [诊断]', JSON.stringify(await ev(`({ href: location.href, title: document.title, app: !!document.querySelector('#app')?.children.length, text: (document.body.innerText||'').replace(/\\s+/g,' ').slice(0,180) })`)));
      }
      console.log('  表头字段:', JSON.stringify(info.表头字段));
      console.log('  左侧栏:', JSON.stringify(info.左栏));
      for (const [i, tb] of (info.表 || []).entries()) {
        console.log(`  表#${i} 列头: ${JSON.stringify(tb.heads)}`);
        for (const r of tb.rows) console.log(`     行: ${JSON.stringify(r)}`);
      }
      const f = await shot(`demo-${t.panel}-${t.docNo}`);
      console.log('  截图:', f);
      // 断言:明细列头含「采购订单行号」
      const grid = (info.表 || []).find((tb) => tb.heads.some((h) => h.includes('采购订单行号')));
      console.log(`  ${grid ? '[PASS] 明细列含「采购订单行号」→ ' + JSON.stringify(grid.rows.map((r) => r[grid.heads.findIndex((h) => h.includes('采购订单行号'))])) : '[FAIL] 明细列未找到「采购订单行号」'}`);
    }
    ws.close();
  } finally {
    edge.kill();
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
