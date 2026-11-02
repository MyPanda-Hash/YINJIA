/**
 * _probe-20261101-board-slash.cjs —— 排产区间外画「/」界面取证(2026-11-01)
 * 用户口径:改行日期后,不在本行排产区间内的日期格要画斜杠(例:开工日期改 11-02 → 11-01 画 /)。
 * 本探针打开工单排产 → 1号机 → 某行,读每个日期格的文本/class;截图。
 * 用法:node archive\_probe-20261101-board-slash.cjs [工单号]  默认 GD-2026-10-0226-1
 */
async function main() {
  const { spawn } = require('node:child_process')
  const fs = require('node:fs')
  const path = require('node:path')
  const WebSocket = require('ws')
  const BASE = 'http://127.0.0.1:8090'
  const PORT = 9375
  const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  const WANT = process.argv[2] || 'GD-2026-10-0226-1'
  const OUT = path.join(__dirname, '_board-slash.png')
  const sleep = (ms) => new Promise(r => setTimeout(r, ms))
  const login = await (await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456', factory: process.env.PROBE_FACTORY || 'YJ' }) })).json()
  const profileDir = path.join('D:/workspace/yinjia/.tmp', 'yj-slash-' + Date.now())
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
    const clicked = await ev(`(() => {
      const ln = [...document.querySelectorAll('.wb-line')].find(e => (e.querySelector('.wb-line-name') || e).textContent.trim() === '1号机')
      if (!ln) return 'line-not-found'
      ln.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return 'clicked-1号机'
    })()`)
    console.log('[1] 选产线 =', clicked)
    await sleep(4500)
    const info = await ev(`(() => {
      const clean = (s) => String(s || '').replace(/[⇅▲▼△▽\\s]/g, '').trim()
      const t = [...document.querySelectorAll('.el-table')].find(x => (x.querySelector('.el-table__header') || {}).innerText && x.querySelector('.el-table__header').innerText.includes('工单号'))
      if (!t) return { err: 'no-table' }
      const ths = [...t.querySelectorAll('.el-table__header th')].map(th => clean(th.textContent))
      const tr = [...t.querySelectorAll('.el-table__body tbody tr')].find(x => x.innerText.includes('${WANT}'))
      if (!tr) return { err: 'row-not-found', rows: [...t.querySelectorAll('.el-table__body tbody tr')].map(x => x.innerText.split('\\n')[1] || '').slice(0, 8) }
      const out = []
      for (let i = 0; i < ths.length; i++) {
        const h = ths[i]
        if (!/^\\d{2}-\\d{2}/.test(h)) continue
        const td = tr.querySelectorAll('td')[i]
        if (!td) continue
        const sp = td.querySelector('.dp-out, .dp-plan')
        out.push({ date: h, text: td.innerText.trim(), cls: sp ? sp.className : '' })
      }
      const dates = [...t.querySelectorAll('.el-table__header th')].map(th => clean(th.textContent)).filter(h => /^\\d{2}-\\d{2}/.test(h))
      const di = ths.findIndex(h => h === (dates[0] || ''))
      return { windowCols: out, firstDateIdx: di, ths: ths.slice(0, 8) }
    })()`)
    console.log('[2] 日期格 =', JSON.stringify(info, null, 0))
    await ev(`(() => {
      const t = [...document.querySelectorAll('.el-table')][0]
      const ths = [...t.querySelectorAll('.el-table__header th')]
      const tr = [...t.querySelectorAll('.el-table__body tbody tr')].find(x => x.innerText.includes('${WANT}'))
      const di = ths.findIndex(th => th.textContent.replace(/[⇅▲▼△▽\\s]/g, '').startsWith('11-01'))
      const td = tr && tr.querySelectorAll('td')[di]
      if (td) td.scrollIntoView({ block: 'center', inline: 'center' })
      return di
    })()`)
    await sleep(800)
    await shot(OUT)
    console.log('[3] 截图 =', OUT)
    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profileDir, { recursive: true, force: true }) } catch {} }
}
main().catch(e => { console.error('FAIL:', e.message); process.exit(1) })



