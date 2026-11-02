/*
 * .tmp/_shot-firstinsp.cjs — 首件检验单纸面截图 + 抬头行几何取证(仅本任务验证用,不入库)
 * 前置:Edge 已由外部以 --remote-debugging-port=<PORT> 起好(沙箱下 Node spawn 会被 EPERM)。
 * 用法: node .tmp/_shot-firstinsp.cjs <cdpPort> [docNo] [outPng] [baseUrl]
 */
const fs = require('node:fs')
const path = require('node:path')
const CDP = Number(process.argv[2] || 9363)
const DOC = process.argv[3] || 'SJ-2026-10-0167'
const OUT = process.argv[4] || path.join(__dirname, '_shot-firstinsp.png')
const BASE = process.argv[5] || 'http://127.0.0.1:5180'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const login = await (await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = login?.data?.token
  if (!token) throw new Error('login failed: ' + JSON.stringify(login).slice(0, 300))
  const tab = await (await fetch(`http://127.0.0.1:${CDP}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pending = new Map()
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
  })
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
  const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(2200)
  await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
                  localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
  await send('Page.navigate', { url: 'about:blank' }); await sleep(400)
  await send('Page.navigate', { url: `${BASE}/#/panelx/list/QC_FIRST_INSP?docNo=${DOC}` })
  await sleep(7000)
  const info = await evaluate(`(() => {
    const sheet = document.querySelector('.fi-sheet')
    const head = document.querySelector('.fi-head')
    const rows = [...document.querySelectorAll('.fi-head tr')].map(tr => [...tr.children].map(td => {
      const c = td.querySelector('textarea') || td.querySelector('input') || td.querySelector('span')
      const r = td.getBoundingClientRect()
      return {
        tag: td.tagName, text: (td.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 60),
        w: Math.round(r.width), h: Math.round(r.height),
        ctl: c ? c.tagName : null, cls: c ? (c.getAttribute('class') || '') : null,
        cw: c ? c.clientWidth : null, sw: c ? c.scrollWidth : null,
        ch: c ? c.clientHeight : null, sh: c ? c.scrollHeight : null,
        val: c && 'value' in c ? String(c.value).slice(0, 60) : null,
      }
    }))
    const sheetR = sheet ? sheet.getBoundingClientRect() : null
    return { sheet: sheetR ? { w: Math.round(sheetR.width), h: Math.round(sheetR.height) } : null,
             headStyle: head ? { tableLayout: getComputedStyle(head).tableLayout, width: getComputedStyle(head).width } : null,
             headRows: rows }
  })()`)
  console.log('DOM:', JSON.stringify(info, null, 1))
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  fs.writeFileSync(OUT, Buffer.from(shot.result.data, 'base64'))
  console.log('截图:', OUT)
  ws.close()
}
main().catch((e) => { console.error('[异常]', e); process.exit(2) })
