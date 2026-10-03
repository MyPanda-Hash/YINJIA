/**
 * _dbg-qcinsp-header.cjs — 一次性排查:为什么表头卡片里看不到 部门/部门编码(页面内实测真源)
 * 用法:node tools/archive/_dbg-qcinsp-header.cjs
 */
'use strict'
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const BASE = 'http://127.0.0.1:8090'
const API = BASE + '/api'
const PORT = 9391
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const lj = await (await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = lj.data.token
  const ans = await (await fetch(API + '/px/queryFormDataList', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ panelCode: 'QC_INSP', condition: {}, pageNo: 1, pageSize: 5 }),
  })).json()
  const rows = ans.data?.list || ans.list || []
  const doc = rows.find((d) => d['单据状态'] === '草稿') || rows[0]
  console.log('目标单据:', doc['编号'], doc['单据状态'])

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-dbg-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(3000)
  const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0
  const pending = new Map()
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) console.log('  [JS异常]', JSON.stringify(r.result.exceptionDetails).slice(0, 400))
    return r.result?.result?.value
  }
  const navigate = async (url) => {
    await send('Page.navigate', { url })
    for (let i = 0; i < 60; i++) { await sleep(300); if ((await evaluate('document.readyState')) === 'complete') { await sleep(900); return } }
  }
  await send('Page.enable'); await send('Runtime.enable')
  await navigate(`${BASE}/#/login`)
  await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lj.data.user))});
localStorage.setItem('mes_login_date', '2026-10-05'); 'ok'`)
  await navigate('about:blank')
  await navigate(`${BASE}/#/panelx/list/QC_INSP?docNo=${encodeURIComponent(doc['编号'])}`)
  await sleep(6000)

  console.log('--- 页面内重取面板配置(用注入的 token)---')
  const inside = await evaluate(`(async () => {
    const r = await fetch('/api/px/getPanelConfig?panelCode=QC_INSP', { headers: { Authorization: 'Bearer ' + localStorage.getItem('mes_token') } }).then(x => x.json())
    const d = r.data || r
    return {
      fields: (d.dataSchema?.fields || []).map(f => f.dataName),
      dept: (d.dataSchema?.fields || []).filter(f => f.dataName === '部门' || f.dataName === '部门编码'),
      panelPageDtoFormPages: d.metadata?.panelPageDto?.formPages?.[0]?.fieldNames,
      metadataFormPages: d.metadata?.formPages?.[0]?.fieldNames,
    }
  })()`)
  console.log(JSON.stringify(inside, null, 1))

  console.log('--- DOM:表头卡片字段 ---')
  const dom = await evaluate(`(() => {
    const cells = [...document.querySelectorAll('.header-fields .field')]
    return { n: cells.length, labels: cells.map(c => c.querySelector('label')?.textContent.trim()) }
  })()`)
  console.log(JSON.stringify(dom, null, 1))

  console.log('--- 全页搜「部门」叶子节点 ---')
  const any = await evaluate(`[...document.querySelectorAll('*')].filter(e => e.children.length === 0 && e.textContent.trim() === '部门').map(e => e.tagName + '.' + e.className)`)
  console.log(JSON.stringify(any))

  try { edge.kill() } catch (e) { /* ignore */ }
  process.exitCode = 0
}

main().catch((e) => { console.error('[异常]', e); process.exitCode = 1 })
