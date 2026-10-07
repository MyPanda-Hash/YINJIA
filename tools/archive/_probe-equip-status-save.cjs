/**
 * _probe-equip-status-save.cjs — 设备状态列「填了保存后变成 /」的端到端取证(2026-10-07)
 *
 * 症状:RD_EQUIP_USE 明细里「设备状态」格输入内容 → 保存后**值被丢掉**(格子回到空占位 ' / ')。
 * 根因:recordSheetConfigs 里该列 key 写的是 col_name `设备状态`,而字段 label 是
 *       `设备状态\n（检查管路、阀门、启动是否正常）`(字面反斜杠+n);row 模型按 label 建键
 *       ⇒ row['设备状态'] 永远 undefined,保存时 labelsToCols 也按 label 找,值直接丢。
 * 本探针:真在页面上往该格输入 → 点右侧「保存」→ 打印返回值与提示,库里值由 SqlRunner 另查。
 *
 * 用法:node tools/archive/_probe-equip-status-save.cjs ["要写入的文本"]
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const PORT = 9396
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:5173'
const TEXT = process.argv[2] || '管路渗漏（探针写入）'
const OUT = 'C:/INCER/YINJIA-MES/tools/archive/_lab-date-cells-out'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const login = await (await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-eq-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1800,1600',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2600)
  const log = []
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0
    const pending = new Map()
    ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()) } catch { return } if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (exp) => {
      const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      const ex = r.result && r.result.exceptionDetails
      if (ex) return '<<ERR ' + String((ex.exception || {}).description || ex.text || '').slice(0, 300) + '>>'
      return r.result && r.result.result ? r.result.result.value : undefined
    }
    const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 90; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') break } await sleep(3200) }
    await send('Page.enable'); await send('Runtime.enable')
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_login_date','2026-10-07'); 'ok'`)
    await nav('about:blank')
    await nav(`${BASE}/#/panelx/list/RD_EQUIP_USE`)
    await sleep(1200)
    await ev(`(function(){ document.querySelectorAll('.el-dialog__headerbtn').forEach((b)=>b.click()); return 1; })()`)
    // 翻到「表头完整(设备名称已填)+ 有明细行」的单据:
    //   EU2609040002/3 的表头 设备名称 为空,保存会被必填校验拦下(不发给后端)——2026-10-07 实测踩到
    for (let hop = 0; hop < 6; hop++) {
      const state = await ev(`(function(){
        const cells = document.querySelectorAll('table.rs-t td.rs-td').length;
        const sub = document.querySelector('.rsp-sub-ctl input');
        return JSON.stringify({ cells: cells, sub: sub ? sub.value : '' });
      })()`)
      const st = JSON.parse(state)
      log.push('hop' + hop + ': cells=' + st.cells + ' 设备名称=' + JSON.stringify(st.sub))
      if (st.cells > 0 && st.sub) break
      const moved = await ev(`(function(){
        const b = [...document.querySelectorAll('.page-btn')].find((x) => (x.getAttribute('title') || '') === '下一张');
        if (!b) return 'no-btn'; b.click(); return 'clicked';
      })()`)
      if (moved !== 'clicked') break
      await sleep(2000)
    }
    log.push('before: ' + await ev(`(function(){
      const tds = [...document.querySelectorAll('table.rs-t td.rs-td')];
      return JSON.stringify(tds.map((td) => td.querySelector('input') ? td.querySelector('input').value : td.textContent.trim()));
    })()`))
    // 往第 5 格(设备状态)输入
    log.push('input: ' + await ev(`(function(){
      const tds = [...document.querySelectorAll('table.rs-t td.rs-td')];
      const td = tds[4];
      if (!td) return 'no-cell4';
      const inp = td.querySelector('input');
      if (!inp) return 'no-input';
      inp.focus();
      inp.value = ${JSON.stringify(TEXT)};
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      return 'typed';
    })()`))
    await sleep(600)
    log.push('after-type: ' + await ev(`(function(){
      const tds = [...document.querySelectorAll('table.rs-t td.rs-td')];
      return JSON.stringify(tds.map((td) => td.querySelector('input') ? td.querySelector('input').value : td.textContent.trim()));
    })()`))
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
    if (r.result?.data) fs.writeFileSync(path.join(OUT, 'RD_EQUIP_USE-typed.png'), Buffer.from(r.result.data, 'base64'))
    // 抓请求(axios 走 XHR):看「保存」到底有没有发出去、服务端回什么
    log.push('hook: ' + await ev(`(function(){
      window.__reqs = [];
      const open = XMLHttpRequest.prototype.open, send = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function (m, u) { this.__m = m; this.__u = u; return open.apply(this, arguments); };
      XMLHttpRequest.prototype.send = function (body) {
        this.addEventListener('load', () => { try { window.__reqs.push(this.__m + ' ' + this.__u + ' -> ' + this.status + ' ' + String(this.responseText).slice(0, 400)); } catch (e) {} });
        return send.apply(this, arguments);
      };
      return 'hooked';
    })()`))
    log.push('save: ' + await ev(`(function(){
      const btns = [...document.querySelectorAll('.as-side-btn')];
      const b = btns.find((x) => (x.textContent || '').trim() === '保存');
      if (!b) return 'no-save';
      const cls = b.className;
      b.click();
      return 'clicked cls=' + cls;
    })()`))
    await sleep(4500)
    log.push('toast: ' + await ev(`JSON.stringify([...document.querySelectorAll('.el-message, .el-message-box__message, .el-notification')].map((x)=>x.textContent.trim()))`))
    log.push('reqs: ' + await ev(`JSON.stringify(window.__reqs || [])`))
    log.push('after-save: ' + await ev(`(function(){
      const tds = [...document.querySelectorAll('table.rs-t td.rs-td')];
      return JSON.stringify(tds.map((td) => td.querySelector('input') ? td.querySelector('input').value : td.textContent.trim()));
    })()`))
    const r2 = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
    if (r2.result?.data) fs.writeFileSync(path.join(OUT, 'RD_EQUIP_USE-saved.png'), Buffer.from(r2.result.data, 'base64'))
  } finally {
    try { edge.kill() } catch { }
    await sleep(1000)
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch { }
  }
  fs.writeFileSync(path.join(OUT, '_equip-status.txt'), log.join('\n'), 'utf8')
  log.forEach((l) => console.log(l.slice(0, 500)))
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
