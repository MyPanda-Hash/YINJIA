/**
 * 只读走查:登录 → 打开面板 → 点第一张单据 → 截图 + 抓关键 DOM 文本
 * 用法: node --experimental-websocket <此文件> [panelCode...]
 * 不种任何数据(与 tools/archive/_walk-shot.cjs 的区别就在这)。
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PORT = 9347
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
  if (!EDGE) throw new Error('找不到 Edge/Chrome')
  fs.mkdirSync(OUT, { recursive: true })

  const loginRes = await fetch(API + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const login = await loginRes.json()
  const token = login.data && login.data.token
  const user = login.data && login.data.user
  if (!token) throw new Error('登录失败: ' + JSON.stringify(login).slice(0, 200))
  console.log('[login] ok, user=' + (user && (user.realName || user.userName)))

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'rd-verify-'))
  const edge = spawn(EDGE, [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1600,1100', 'about:blank',
  ], { stdio: 'ignore' })

  try {
    let target = null
    for (let i = 0; i < 40 && !target; i++) {
      await sleep(300)
      try {
        const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
        target = list.find((t) => t.type === 'page')
      } catch { /* 还没起来 */ }
    }
    if (!target) throw new Error('CDP 未就绪')

    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let id = 0
    const pend = new Map()
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
    }
    const send = (method, params) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
    const evaluate = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
      return r.result && r.result.result ? r.result.result.value : undefined
    }

    await send('Page.enable')
    await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1100, deviceScaleFactor: 2, mobile: false })

    await send('Page.navigate', { url: `${FRONT}/#/login` })
    await sleep(1800)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_login_date','2026-09-22'); 'ok'`)
    // ⚠ 必须整页重载一次:只改 hash 不会让 SPA 重新启动,路由守卫仍按启动时的空 store 判成未登录(实测落到登录页)
    await send('Page.navigate', { url: 'about:blank' })
    await sleep(600)

    for (const pc of PANELS) {
      await send('Page.navigate', { url: `${FRONT}/#/panelx/list/${pc}` })
      await sleep(3200)
      // 关掉新手引导浮层(有就点掉)
      await evaluate(`(() => { const s = document.querySelector('.wz-skip'); if (s) { s.click(); return 'closed' } return 'none' })()`)
      await sleep(500)
      // 点第一行单据,让纸面渲染出来
      const clicked = await evaluate(`(() => {
        const row = document.querySelector('.el-table__row') || document.querySelector('tr[class*=row]')
        if (!row) return 'no-row'
        row.click(); return 'clicked'
      })()`)
      await sleep(2500)
      const info = await evaluate(`(() => {
        const sheet = document.querySelector('.approval-sheet') || document.querySelector('.rsp-sheet') || document.querySelector('.ps-table') || document.querySelector('.body')
        const errs = [...document.querySelectorAll('.el-message--error')].map(e => e.textContent.trim())
        const txt = sheet ? sheet.innerText.replace(/\\s+/g,' ') : ''
        const remark = document.querySelector('.as-remark')
        const remarkInput = document.querySelector('.as-remark-input textarea, .as-remark-input .el-textarea__inner')
        const rows = [...document.querySelectorAll('.approval-sheet .as-row')].map(r => ({
          no: (r.querySelector('.as-no')||{}).textContent || '',
          name: (r.querySelector('.as-name')||{}).textContent || '',
          h: Math.round(r.getBoundingClientRect().height),
          second: !!r.querySelector('.as-second'),
        }))
        // 控制列表面板(ProgressControlSheet):表头格文字 + 原则说明段
        const psTh = [...document.querySelectorAll('.ps-table thead th')].map(e => e.textContent.trim()).filter(Boolean)
        const psTd = [...document.querySelectorAll('.ps-table tbody tr:first-child td')].length
        const principle = ((document.querySelector('.ps-principle')||{}).textContent || '').replace(/\\s+/g,' ').trim()
        const infoLabels = [...document.querySelectorAll('.ps-info-label')].map(e => e.textContent.trim())
        return {
          hasSheet: !!sheet, errs, clicked: ${JSON.stringify(clicked)},
          titleText: txt.slice(0, 120),
          hasRemarkCol: !!remark, hasRemarkInput: !!remarkInput,
          signLabels: [...document.querySelectorAll('.as-sign-cell, .q-signitem-label, .as-sign-pair')].map(e=>e.textContent.trim()).slice(0,6),
          rows: rows.slice(0, 12),
          psTh, psTd, principle, infoLabels,
          companyCell: (document.querySelector('.rs-company-cell')||{}).textContent || '',
          docnoCell: (document.querySelector('.rs-docno')||{}).textContent || '',
          docnoColspan: (() => { const td = document.querySelector('.rs-docno'); return td ? td.getAttribute('colspan') : null })(),
          companyColspan: (() => { const td = document.querySelector('.rs-company-cell'); return td ? td.getAttribute('colspan') : null })(),
        }
      })()`)
      const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true })
      const f = path.join(OUT, pc + '.png')
      if (shot.result && shot.result.data) fs.writeFileSync(f, Buffer.from(shot.result.data, 'base64'))
      console.log('\n===== ' + pc + ' =====')
      console.log(JSON.stringify(info, null, 1))
      console.log('shot → ' + f)
    }
    ws.close()
  } finally {
    edge.kill()
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
