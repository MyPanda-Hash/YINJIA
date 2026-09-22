/**
 * 只读走查:项目进度查询(RD_PROGRESS)控制列表 —— 校对两处改动
 *   ① 项目编号列(c-remark)实际像素宽度 + 内容是否溢出
 *   ② 项目定级列(c-level)是否还有下拉框(应为纯文本)
 *   ③ 表格里还剩几个 el-select(项目名称列本来就有一个,属正常)
 * 不种任何数据。用法: node --experimental-websocket <此文件>
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
  console.log('[login] ok')

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'rd-cols-'))
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
      } catch { /* 未就绪 */ }
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
    await send('Page.navigate', { url: 'about:blank' })
    await sleep(600)
    await send('Page.navigate', { url: `${FRONT}/#/panelx/list/RD_PROGRESS` })
    await sleep(3500)
    await evaluate(`(() => { const s = document.querySelector('.wz-skip'); if (s) s.click(); return 'x' })()`)
    await sleep(600)

    const info = await evaluate(`(() => {
      const q = (s) => document.querySelector(s)
      const box = (el) => el ? { w: el.offsetWidth, h: el.offsetHeight } : null
      const thRemark = q('.ps-table thead th.c-remark')
      const tdRemark = q('.ps-table tbody td.c-remark')
      const tdLevel = q('.ps-table tbody td.c-level')
      const input = tdRemark ? tdRemark.querySelector('textarea, input') : null
      const table = q('.ps-table')
      const wrap = q('.ps-scroll, .ps-table-wrap, .ps-wrap') || (table ? table.parentElement : null)
      return {
        headers: [...document.querySelectorAll('.ps-table thead th')].map((e) => e.innerText.trim()),
        thRemarkWidth: thRemark ? thRemark.offsetWidth : null,
        tdRemarkWidth: tdRemark ? tdRemark.offsetWidth : null,
        tdRemarkText: tdRemark ? tdRemark.innerText.replace(/\\s+/g, ' ').trim() : null,
        tdRemarkOverflow: (tdRemark && input) ? { scrollW: input.scrollWidth, clientW: input.clientWidth } : null,
        levelCellText: tdLevel ? tdLevel.innerText.replace(/\\s+/g, ' ').trim() : null,
        levelCellHasSelect: !!(tdLevel && tdLevel.querySelector('.el-select')),
        allSelectsInTable: document.querySelectorAll('.ps-table .el-select').length,
        selectColumns: [...document.querySelectorAll('.ps-table thead th')].map((th, i) => {
          const td = document.querySelectorAll('.ps-table tbody tr:first-child td')[i]
          return td && td.querySelector('.el-select') ? th.innerText.trim() : null
        }).filter(Boolean),
        tableWidth: table ? table.offsetWidth : null,
        wrapClientWidth: wrap ? wrap.clientWidth : null,
        wrapScrollWidth: wrap ? wrap.scrollWidth : null,
        editableNow: !!(q('.ps-addbar')),
        errs: [...document.querySelectorAll('.el-message--error')].map((e) => e.innerText.trim()),
      }
    })()`)
    console.log(JSON.stringify(info, null, 1))

    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true })
    const f = path.join(OUT, 'RD_PROGRESS-cols.png')
    if (shot.result && shot.result.data) fs.writeFileSync(f, Buffer.from(shot.result.data, 'base64'))
    console.log('shot → ' + f)
    ws.close()
  } finally {
    edge.kill()
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
