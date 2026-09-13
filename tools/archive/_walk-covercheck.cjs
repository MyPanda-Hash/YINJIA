/** _walk-covercheck.cjs — 读规格书当前单据封面(产品信息页)显示值 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PORT = 9352
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const login = await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login.data.token
  const user = JSON.stringify(login.data.user)
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-cov-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0
  const pending = new Map()
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
  const evaluate = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); return r.result?.result?.value }
  await send('Page.enable'); await send('Runtime.enable')
  await send('Page.navigate', { url: FRONT + '/#/login' }); await sleep(2200)
  await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)});localStorage.setItem('mes_user', ${JSON.stringify(user)});localStorage.setItem('mes_login_date', '2026-09-05');'ok'`)
  await send('Page.navigate', { url: 'about:blank' }); await sleep(600)
  await send('Page.navigate', { url: FRONT + '/#/panelx/list/RD_SPEC_DOC' }); await sleep(3200)
  await evaluate(`(() => { const s = document.querySelector('.wz-skip'); if (s) s.click(); return 1 })()`); await sleep(700)
  const cover = await evaluate(`(() => ({
    docno: document.querySelector('.rs-docno')?.textContent?.trim() || null,
    pager: document.querySelector('.as-side-pager')?.textContent?.replace(/\\s+/g, ' ').trim() || null,
    status: document.querySelector('.as-side-status-row .doc-status')?.textContent?.trim() || null,
    docDate: document.querySelector('.header-fields .field:nth-child(2) input')?.value || [...document.querySelectorAll('.header-fields label')].map((l) => l.textContent.trim() + '=' + (l.nextElementSibling?.value || l.nextElementSibling?.textContent || '')).slice(0, 3),
    coverLines: [...document.querySelectorAll('.rsp-cover-line')].map((l) => {
      const label = l.querySelector('.rsp-cover-label')?.textContent?.trim()
      const input = l.querySelector('input')
      const val = l.querySelector('.rsp-cover-val')
      return label + ' = ' + (input ? input.value : (val ? val.textContent.trim() : ''))
    }),
    signRow: [...document.querySelectorAll('.rsp-sign-td')].map((td) => { const i = td.querySelector('input'); const v = td.querySelector('.rsp-cover-val'); return (i ? i.value : (v ? v.textContent.trim() : '')) }),
    typeTab: document.querySelector('.rsp-type-tab.active')?.textContent?.trim() || null,
    signMetrics: (() => {
      const cells = [...document.querySelectorAll('.rsp-sign-td')]
      return cells.map((td) => {
        const input = td.querySelector('input')
        const val = td.querySelector('.rsp-cover-val')
        const el = input || val
        const text = input ? input.value : (val ? val.textContent.trim() : '')
        return {
          text: text.slice(0, 20),
          font: el ? getComputedStyle(el).fontSize : null,
          cellW: Math.round(td.clientWidth),
          textW: el ? Math.round(el.scrollWidth) : null,
          overflow: el && input ? (input.scrollWidth > input.clientWidth + 1 ? 'YES' : 'no') : (td.scrollWidth > td.clientWidth + 1 ? 'YES' : 'no'),
        }
      })
    })(),
    metrics: (() => {
      const page = document.querySelector('.rsp-cover-page')
      const pr = page ? page.getBoundingClientRect() : null
      const lines = [...document.querySelectorAll('.rsp-cover-line')].map((l) => {
        const input = l.querySelector('input')
        const val = l.querySelector('.rsp-cover-val')
        const el = input || val
        if (!el) return null
        const r = el.getBoundingClientRect()
        const overflow = input ? (input.scrollWidth > input.clientWidth + 1 ? 'X' : '') : ''
        return { text: (input ? input.value : val.textContent.trim()).slice(0, 14), inputRight: Math.round(r.right), pageRight: pr ? Math.round(pr.right) : null, overflow }
      })
      return { pageW: pr ? Math.round(pr.width) : null, pageH: pr ? Math.round(pr.height) : null, lines }
    })(),
  }))()`)
  console.log(JSON.stringify(cover, null, 1))
  ws.close(); edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
}
main().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
