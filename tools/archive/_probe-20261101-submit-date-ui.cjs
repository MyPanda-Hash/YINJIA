/**
 * _probe-20261101-submit-date-ui.cjs —— 提交审批后「单据日期」自动生成(界面取证,2026-11-01)
 * 用户口径:「当前工序报工的单据日期应该在提交审批的时候自动生成」。
 * 探针:测试账套打开工序报工单(夹具 BG-TEST-SUBDATE:存草稿时日期是 2026-10-20,提交审批后应为当天)
 * → 读表头「单据编号 / 单据日期」→ 截图。
 */
async function main() {
  const { spawn } = require('node:child_process')
  const fs = require('node:fs')
  const path = require('node:path')
  const WebSocket = require('ws')
  const BASE = 'http://127.0.0.1:8090'
  const PORT = 9374
  const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  const OUT = path.join(__dirname, '_submit-date-auto.png')
  const sleep = (ms) => new Promise(r => setTimeout(r, ms))
  const login = await (await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }) })).json()
  const profileDir = path.join('D:/workspace/yinjia/.tmp', 'yj-subdate-' + Date.now())
  fs.mkdirSync(profileDir, { recursive: true })
  const edge = spawn(EDGE, ['--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--disable-crash-reporter','--window-size=1400,860',`--remote-debugging-port=${PORT}`,`--user-data-dir=${profileDir}`,'about:blank'], { stdio: 'ignore' })
  try {
    let tab = null
    for (let i = 0; i < 40; i++) { try { tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json(); if (tab?.webSocketDebuggerUrl) break } catch {} await sleep(500) }
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    const send = (method, params = {}) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
    const shot = async (file) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(file, Buffer.from(r.result.data, 'base64')) }
    const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 80; i++) { await sleep(300); if (await ev('document.readyState') === 'complete') { await sleep(1800); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    await nav(BASE + '/#/login')
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_locale','zh'); 'ok'`)
    await nav('about:blank')
    await nav(BASE + '/#/panelx/list/WO_REPORT')
    await sleep(5000)
    console.log('[1] 单据行 =', ((await ev('document.body.innerText')).match(/单据[:：][^|]{0,50}/) || [''])[0].replace(/\n/g, ' '))
    const header = await ev(`(() => {
      const out = []
      for (const item of document.querySelectorAll('.header-fields > *, .el-form-item')) {
        const label = (item.querySelector('label, .el-form-item__label') || {}).textContent || ''
        const inp = item.querySelector('input')
        if (inp && label.trim()) out.push(label.trim() + '=' + inp.value)
      }
      return out.slice(0, 8)
    })()`)
    console.log('[2] 表头字段 =', JSON.stringify(header))
    const dateVal = (header || []).find(x => x.startsWith('单据日期='))
    console.log('RESULT:', dateVal === '单据日期=2026-11-01' ? 'PASS(提交审批后单据日期=今天)' : 'CHECK: ' + dateVal)
    await shot(OUT)
    console.log('[3] 截图 =', OUT)
    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profileDir, { recursive: true, force: true }) } catch {} }
}
main().catch(e => { console.error('FAIL:', e.message); process.exit(1) })
