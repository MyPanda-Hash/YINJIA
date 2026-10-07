/**
 * 一次性探针(2026-10-14):在真实浏览器里复现「材料出库单选商品 ⇒ 报 明细第 1 行批号不能为空」。
 *
 * 取证目标(只读/只点击,不做任何保存成功的动作):
 *   ① 点明细行「材料编码」格 → 参照弹窗 → 勾一行 → 「确定导入」全过程;
 *   ② 捕获该过程发出的 /px/callButton 请求体与响应(证明"选商品=顺带保存整单");
 *   ③ 捕获界面 ElMessage 的文案与类型(error/warning)—— 判定文案来自前端还是后端;
 *   ④ 记录点击前后明细首行的单元格文本(证明"带入值没进表格")。
 *
 * 用法(需 8090 后端 + 5173 vite 在跑):
 *   node tools/archive/_probe-matout-pick-ui-1014.mjs [--panel MATERIAL_OUT] [--doc CL-2026-10-0001]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire('D:/workspace/yinjia/tools/package.json')
const WebSocket = require('ws')

const arg = (name, dflt) => {
  const i = process.argv.indexOf('--' + name)
  return i >= 0 ? process.argv[i + 1] : dflt
}
const PANEL = arg('panel', 'MATERIAL_OUT')
const DOC = arg('doc', '')
const SITE = arg('site', 'http://localhost:5173')
const API = arg('api', 'http://localhost:8090/api')
const PORT = 9411
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------- 登录(后端 API 取 token) ----------
const login = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = login?.data?.token
const user = login?.data?.user
if (!token) { console.error('[FATAL] 登录失败', JSON.stringify(login).slice(0, 200)); process.exit(1) }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-pick-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)

const results = { panel: PANEL, calls: [], messages: [], rowsBefore: null, rowsAfter: null, dialogOpened: false }
try {
  const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0
  const pending = new Map()
  const netPending = new Map()
  ws.on('message', (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
    if (m.method === 'Network.requestWillBeSent') {
      const { requestId, request } = m.params
      if (request.url.includes('/api/px/callButton')) {
        netPending.set(requestId, { method: request.method, url: request.url, body: request.postData })
      }
    }
    if (m.method === 'Network.responseReceived') {
      const hit = netPending.get(m.params.requestId)
      if (hit) hit.status = m.params.response.status
    }
    if (m.method === 'Network.loadingFinished') {
      const hit = netPending.get(m.params.requestId)
      if (hit) { hit.finished = true; results.calls.push(hit); netPending.delete(m.params.requestId) }
    }
  })
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
  const evaluate = async (exp) => (await send('Runtime.evaluate', {
    expression: exp, returnByValue: true, awaitPromise: true,
  })).result?.result?.value

  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
  await send('Page.navigate', { url: SITE + '/#/login' })
  await sleep(1500)
  await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))}); 'ok'`)
  await send('Page.navigate', { url: 'about:blank' })
  await sleep(300)
  const url = SITE + '/#/panelx/list/' + PANEL + (DOC ? '?docNo=' + encodeURIComponent(DOC) : '')
  await send('Page.navigate', { url })
  await sleep(6000)

  // ---------- 明细区定位(第 1 个 .detail 区块) ----------
  const layout = await evaluate(`(() => {
    const d = document.querySelector('.detail')
    if (!d) return { err: 'no .detail' }
    const heads = [...d.querySelectorAll('.el-table__header th .cell')].map(e => e.innerText.trim())
    const rows = [...d.querySelectorAll('.el-table__body-wrapper tr.el-table__row')]
    return { heads, rowCount: rows.length,
      firstRow: rows[0] ? [...rows[0].querySelectorAll('td .cell')].map(e => e.innerText.trim()) : [] }
  })()`)
  console.log('[界面] 明细列 =', JSON.stringify(layout.heads))
  console.log('[界面] 明细行数 =', layout.rowCount, '| 首行 =', JSON.stringify(layout.firstRow))
  results.rowsBefore = layout.firstRow
  if (layout.err) throw new Error(layout.err)

  const colIdx = layout.heads.findIndex((h) => h.replace(/^\*/, '') === '材料编码')
  if (colIdx < 0) throw new Error('明细里没有「材料编码」列:' + JSON.stringify(layout.heads))

  // ---------- 点首行「材料编码」格 → 参照弹窗 ----------
  await evaluate(`(() => {
    const d = document.querySelector('.detail')
    const row = d.querySelector('.el-table__body-wrapper tr.el-table__row')
    const cell = row.querySelectorAll('td')[${colIdx}]
    const inp = cell.querySelector('input') || cell.querySelector('.cell')
    inp.click()
    return 'clicked'
  })()`)
  await sleep(2500)
  const dlg = await evaluate(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find(x => /参照选择/.test(x.innerText))
    if (!d) return { err: 'dialog 未打开' }
    return { title: d.querySelector('.el-dialog__title')?.innerText,
      rows: d.querySelectorAll('.el-table__body-wrapper tr.el-table__row').length,
      firstRow: [...(d.querySelectorAll('.el-table__body-wrapper tr.el-table__row')[0]?.querySelectorAll('td .cell') || [])].map(e => e.innerText.trim()).slice(0, 6) }
  })()`)
  results.dialogOpened = !dlg.err
  console.log('[弹窗]', JSON.stringify(dlg))
  if (dlg.err) throw new Error(dlg.err)

  // 勾第 1 行 → 确定导入
  await evaluate(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find(x => /参照选择/.test(x.innerText))
    const cb = d.querySelector('.el-table__body-wrapper tr.el-table__row td .el-checkbox')
    cb.click(); return 'checked'
  })()`)
  await sleep(400)
  const btnText = await evaluate(`(() => {
    const d = [...document.querySelectorAll('.el-dialog')].find(x => /参照选择/.test(x.innerText))
    const b = [...d.querySelectorAll('.el-dialog__footer button')].find(x => /确定/.test(x.innerText))
    if (!b) return ''
    b.click(); return b.innerText.trim()
  })()`)
  console.log('[弹窗] 点击按钮 =', JSON.stringify(btnText))
  await sleep(3500)

  // ---------- 结果取证 ----------
  results.messages = await evaluate(`[...document.querySelectorAll('.el-message')].map(e => ({
     text: e.innerText.trim(), cls: [...e.classList].join(' '), type: e.className.match(/el-message--(\\w+)/)?.[1] || '' }))`)
  console.log('\n[提示] ElMessage =')
  for (const m of results.messages) console.log('   ·', m.type, '|', m.text)

  const after = await evaluate(`(() => {
    const d = document.querySelector('.detail')
    const rows = [...d.querySelectorAll('.el-table__body-wrapper tr.el-table__row')]
    return { rowCount: rows.length, firstRow: rows[0] ? [...rows[0].querySelectorAll('td .cell')].map(e => e.innerText.trim()) : [] }
  })()`)
  results.rowsAfter = after.firstRow
  console.log('\n[界面] 点击后 明细行数 =', after.rowCount, '| 首行 =', JSON.stringify(after.firstRow))

  console.log('\n[网络] /px/callButton 调用 =', results.calls.length)
  for (const c of results.calls) {
    console.log('   · status =', c.status)
    console.log('     body   =', String(c.body || '').slice(0, 500))
  }

  // 后端响应体(对同一次请求重放不会落库:请求本身就失败了)
  const out = path.resolve('tools/archive/_probe-matout-pick-ui-1014.json')
  fs.writeFileSync(out, JSON.stringify(results, null, 2), 'utf8')
  console.log('\n[落盘]', out)
} finally {
  try { edge.kill() } catch { /* ignore */ }
}
