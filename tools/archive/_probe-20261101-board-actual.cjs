/**
 * _probe-20261101-board-actual.cjs —— 工单排产「当天实际报工数量」界面取证(2026-11-01)
 * 用户报障:「我报工了这一条为什么没有显示当前日期的实际报工数量」——11-01 格只有计划 2。
 * 本探针:工单排产页 → 选「1号机」→ 找 GD-2026-10-0226-1 → 读 11-01 格文本/样式(actual=绿色)+ 截图。
 */
async function main() {
  const { spawn } = require('node:child_process')
  const fs = require('node:fs')
  const path = require('node:path')
  const WebSocket = require('ws')
  const BASE = 'http://127.0.0.1:8090'
  const PORT = 9373
  const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  const OUT = path.join(__dirname, '_board-actual-1101.png')
  const sleep = (ms) => new Promise(r => setTimeout(r, ms))
  const login = await (await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const profileDir = path.join('D:/workspace/yinjia/.tmp', 'yj-board2-' + Date.now())
  fs.mkdirSync(profileDir, { recursive: true })
  const edge = spawn(EDGE, ['--headless=new','--no-sandbox','--disable-gpu','--no-first-run','--disable-crash-reporter','--window-size=1500,900',`--remote-debugging-port=${PORT}`,`--user-data-dir=${profileDir}`,'about:blank'], { stdio: 'ignore' })
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
    await nav(BASE + '/#/prod/plan/workOrderBoard')
    await sleep(5000)

    // 选 1号机
    const clicked = await ev(`(() => {
      const ln = [...document.querySelectorAll('.wb-line')].find(e => (e.querySelector('.wb-line-name') || e).textContent.trim() === '1号机')
      if (!ln) return 'line-not-found: ' + [...document.querySelectorAll('.wb-line-name')].map(e => e.textContent.trim()).slice(0, 30).join('|')
      ln.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return 'clicked-1号机'
    })()`)
    console.log('[1] 选产线 =', clicked)
    await sleep(4500)

    const info = await ev(`(() => {
      const clean = (s) => String(s || '').replace(/[⇅▲▼△▽\\s]/g, '').trim()
      const t = [...document.querySelectorAll('.el-table')].find(x => (x.querySelector('.el-table__header th') || {}).textContent === '工单号')
        || [...document.querySelectorAll('.el-table')][0]
      if (!t) return { err: 'no-table' }
      const ths = [...t.querySelectorAll('.el-table__header th')].map(th => clean(th.textContent))
      const di = ths.findIndex(h => h.startsWith('11-01'))
      const trs = [...t.querySelectorAll('.el-table__body tbody tr')]
      const tr = trs.find(x => x.innerText.includes('GD-2026-10-0226-1'))
      if (!tr) return { err: 'row-not-found', ths: ths.slice(0, 20) }
      const td = tr.querySelectorAll('td')[di]
      const span = td && td.querySelector('.dp-plan')
      return { di, ths: ths.slice(0, 20), cellText: td ? td.innerText.trim() : '', dpClass: span ? span.className : '', dpTitle: span ? span.getAttribute('title') : '', rowText: tr.innerText.replace(/\\n+/g, ' ').slice(0, 160) }
    })()`)
    console.log('[2] 11-01 格 =', JSON.stringify(info, null, 0))
    // 把 11-01 格滚动到可视区再截图(表格很宽,默认停在左侧看不到日期列)
    await ev(`(() => {
      const t = [...document.querySelectorAll('.el-table')][0]
      const ths = [...t.querySelectorAll('.el-table__header th')]
      const di = ths.findIndex(th => th.textContent.replace(/[⇅▲▼△▽\\s]/g, '').startsWith('11-01'))
      const tr = [...t.querySelectorAll('.el-table__body tbody tr')].find(x => x.innerText.includes('GD-2026-10-0226-1'))
      const td = tr && tr.querySelectorAll('td')[di]
      if (td) td.scrollIntoView({ block: 'center', inline: 'center' })
      return di
    })()`)
    await sleep(800)
    await shot(OUT)
    console.log('[3] 截图 =', OUT)
    console.log('RESULT:', String(info?.cellText || '').includes('2') && String(info?.dpClass || '').includes('actual') ? 'PASS(显示的是实际报工,绿色)' : 'FAIL')
    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profileDir, { recursive: true, force: true }) } catch {} }
}
main().catch(e => { console.error('FAIL:', e.message); process.exit(1) })

