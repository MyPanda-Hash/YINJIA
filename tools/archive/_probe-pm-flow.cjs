/**
 * 只读:项目管理三面板的可用按钮/侧栏动作 + 纸面结构取证
 * 用法: node --experimental-websocket <此文件> [panelCode...]
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PORT = 9351
const OUT = path.join(process.env.TEMP, 'rd-verify-shots')
const CANDS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
]
const EDGE = CANDS.find((p) => fs.existsSync(p))
const PANELS = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const login = await (await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = login.data.token
  const user = login.data.user

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'rd-flow-'))
  const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1680,1100', 'about:blank'], { stdio: 'ignore' })
  try {
    let target = null
    for (let i = 0; i < 40 && !target; i++) {
      await sleep(300)
      try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page') } catch {}
    }
    if (!target) throw new Error('CDP 未就绪')
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let id = 0
    const pend = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
    const send = (method, params) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
    const evaluate = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
      if (r.result && r.result.exceptionDetails) return { __err: r.result.exceptionDetails.text }
      return r.result && r.result.result ? r.result.result.value : undefined
    }
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1100, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: `${FRONT}/#/login` }); await sleep(1800)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_login_date','2026-09-22'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(600)

    for (const pc of PANELS) {
      await send('Page.navigate', { url: `${FRONT}/#/panelx/list/${pc}` })
      await sleep(3200)
      await evaluate(`(() => { const s = document.querySelector('.wz-skip'); if (s) s.click(); return 1 })()`)
      await sleep(400)
      const info = await evaluate(`(() => {
        const txt = (e) => (e && e.textContent ? e.textContent : '').replace(/\\s+/g,' ').trim()
        const rail = document.querySelector('.approval-side') || document.querySelector('.as-side')
        const railBtns = rail ? [...rail.querySelectorAll('button, .as-side-item, [class*=side-item], .el-button')].map(txt).filter(Boolean).slice(0, 40) : []
        const railText = rail ? txt(rail).slice(0, 600) : ''
        const railItems = rail ? [...rail.children].map((e) => txt(e)).filter(Boolean).slice(0, 40) : []
        const allBtns = [...document.querySelectorAll('button')].map(txt).filter(Boolean).slice(0, 40)
        const rows = [...document.querySelectorAll('.approval-sheet .as-row')].map(r => ({
          name: txt(r.querySelector('.as-name')),
          ro: !!r.querySelector('.as-ro-text'),
          hasInput: !!r.querySelector('input, textarea'),
          hint: txt(r.querySelector('.as-hint')),
        }))
        return {
          railBtns, railText, railItems, allBtns,
          rows: rows.slice(0, 20),
          infoLabels: [...document.querySelectorAll('.ps-info-label, .as-info-label')].map(txt),
          tableEmpty: txt(document.querySelector('.el-table__empty-text')),
          docStatus: txt(document.querySelector('.as-side-status-row')) || txt(document.querySelector('[class*=status-row]')),
        }
      })()`)
      console.log('\n===== ' + pc + ' =====')
      console.log(JSON.stringify(info, null, 1))
      const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true })
      if (shot.result && shot.result.data) fs.writeFileSync(path.join(OUT, pc + '-flow.png'), Buffer.from(shot.result.data, 'base64'))

      // 若该行有「状态」派生标签 → 点它,验阶段计划弹窗
      const hasTag = await evaluate(`(() => !!document.querySelector('.ps-status-tag'))()`)
      if (hasTag) {
        const clickedTag = await evaluate(`(() => { const t = document.querySelector('tbody .ps-status-tag'); if (!t) return 'none'; t.click(); return 'clicked' })()`)
        await sleep(1500)
        const dlg = await evaluate(`(() => {
          const txt = (e) => (e && e.textContent ? e.textContent : '').replace(/\\s+/g,' ').trim()
          const box = document.querySelector('.el-dialog__body')
          const wrap = [...document.querySelectorAll('.el-dialog__wrapper')].find((w) => w.style.display !== 'none')
          const title = txt((wrap || document).querySelector('.el-dialog__title'))
          const rows = [...(box ? box.querySelectorAll('.el-table__body tbody tr') : [])].map((tr) => [...tr.querySelectorAll('td')].map(txt))
          const heads = [...(box ? box.querySelectorAll('.el-table__header th') : [])].map((th) => txt(th))
          return { tagClick: ${JSON.stringify(clickedTag)}, dlgTitle: title, visible: !!wrap, heads, rows: rows.slice(0, 12), bodyText: txt(box).slice(0, 400) }
        })()`)
        console.log('\n----- ' + pc + ' 阶段计划弹窗 -----')
        console.log(JSON.stringify(dlg, null, 1))
        const s2 = await send('Page.captureScreenshot', { format: 'png', fromSurface: true })
        if (s2.result && s2.result.data) fs.writeFileSync(path.join(OUT, pc + '-dialog.png'), Buffer.from(s2.result.data, 'base64'))
      }
    }
    ws.close()
  } finally { edge.kill() }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
