/**
 * _q-qcret-view.mjs — 一次性探针:核对退回单表头「检验单号」在界面上的实际渲染(值/组件类型)
 * 用法: node tools/archive/_q-qcret-view.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONT = 'http://localhost:5173';
const API = 'http://localhost:8090/api';
const PORT = 9371;
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const OUT = path.join(__dirname, '_so-rail-shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const lj = await (await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json();
  const token = lj?.data?.token, user = lj?.data?.user;
  if (!token) throw new Error('登录失败');

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-qcret-'));
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
localStorage.setItem('mes_login_date', '2026-09-20'); localStorage.setItem('mes_locale','zh-CN'); 'ok'`);

    const url = `${FRONT}/?_v=${Date.now()}#/panelx/list/QC_RETURN?docNo=TH-2026-09-0002`;
    await send('Page.navigate', { url });
    for (let i = 0; i < 80; i++) { await sleep(400); if (await ev(`!!document.querySelector('.doc-rail-main')`)) break; }
    await sleep(2500);
    const dump = await ev(`(() => {
      const main = document.querySelector('.doc-rail-main') || document;
      const out = [];
      for (const f of main.querySelectorAll('.fields .field')) {
        const label = f.querySelector('label')?.textContent.trim();
        if (!['检验单号','采购订单号','单据编号'].includes(label)) continue;
        const inp = f.querySelector('input');
        out.push({ label, inputValue: inp ? inp.value : null, inputClass: inp ? inp.className : null,
          text: (f.textContent||'').replace(/\\s+/g,' ').trim().slice(0,120),
          html: f.innerHTML.replace(/\\s+/g,' ').slice(0, 700) });
      }
      return out;
    })()`);
    console.log('URL:', url);
    for (const d of dump) { console.log('\n---', d.label, '---'); console.log('input.value =', JSON.stringify(d.inputValue)); console.log('text =', d.text); console.log('html =', d.html); }
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true });
    const f = path.join(OUT, 'q-qcret-header.png');
    fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'));
    console.log('\n截图:', f);
    ws.close();
  } finally {
    edge.kill();
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
