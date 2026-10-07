/**
 * _probe-ui-debug.cjs — 一次性排障:明细行「批次号」只读格在 DOM 里的真实位置。
 * 用法:node tools/archive/_probe-ui-debug.cjs
 */
'use strict'
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const { createRequire } = require('node:module')

const mssql = createRequire('D:/jdy-sync/package.json')('mssql')
const API = 'http://127.0.0.1:8090/api'
const BASE = 'http://127.0.0.1:8090'
const PORT = 9366
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const pool = await new mssql.ConnectionPool({
    server: '127.0.0.1', port: 1433, database: 'HSDZ_MES_TEST', user: 'yinjia', password: 'Yinjia@2026',
    options: { encrypt: false, trustServerCertificate: true },
  }).connect()
  const N = (v) => (v === null || v === undefined ? null : String(v).trim())

  const lj = await (await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })).json()
  const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + lj.data.token }
  const post = async (url, body) => {
    const j = await (await fetch(API + url, { method: 'POST', headers: H, body: JSON.stringify(body) })).json()
    if (j.code !== 0 && j.code !== 200) throw new Error(`${url} → ${JSON.stringify(j).slice(0, 240)}`)
    return j.data
  }
  const cb = (p, b, f) => post('/px/callButton', { panelCode: p, buttonName: b, formData: f || {}, buttonParam: {} })

  const list = (await post('/px/queryFormDataList', { panelCode: 'PU_ORDER', pageNo: 1, pageSize: 400 }))?.list || []
  let pick = null
  for (const r of list) {
    if (N(r['单据状态']) !== '已审核') continue
    let ls; try { ls = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: N(r['单据编号']) }) } catch { continue }
    const line = (ls?.lines || []).find((x) => Number(x.剩余数量) >= 5)
    if (line) { pick = { no: N(r['单据编号']), line }; break }
  }
  const gen = await post('/px/batchFlow/generate', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: pick.no, lines: [{ lineKey: pick.line.lineKey, qty: 5 }] })
  const recv = N(gen['编号'])
  console.log('造单:', recv, '批次号', N(gen['批次号']))

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-dbg2-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  let ws
  try {
    let tab = null
    for (let i = 0; i < 40 && !tab; i++) { await sleep(400); try { tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json() } catch {} }
    ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.onmessage = (d) => { const m = JSON.parse(typeof d.data === 'string' ? d.data : d.data.toString()); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
    await send('Page.enable'); await send('Runtime.enable')
    await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(2500)
    await ev(`(function(){ localStorage.setItem('mes_token', ${JSON.stringify(lj.data.token)});
      localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lj.data.user))});
      localStorage.setItem('mes_factory', '"YJ_TEST"'); return 'ok' })()`)
    await send('Page.navigate', { url: `${BASE}/?_b=1#/panelx/list/QC_RECV?docNo=${encodeURIComponent(recv)}` })
    await sleep(12000)

    console.log('\n--- 结构排障 ---')
    console.log(await ev(`(function(){
      const r = []
      r.push('cell-locked 个数 = ' + document.querySelectorAll('.cell-locked').length)
      r.push('cell-lazy 个数 = ' + document.querySelectorAll('.cell-lazy').length)
      r.push('.body 内 table 个数 = ' + document.querySelectorAll('.body table').length)
      r.push('全页 table 个数 = ' + document.querySelectorAll('table').length)
      const el = document.querySelector('.cell-locked')
      if (el) {
        const chain = []; let n = el
        while (n && chain.length < 12) { chain.push(n.tagName + (n.className ? '.' + String(n.className).split(' ').slice(0,2).join('.') : '')); n = n.parentElement }
        r.push('cell-locked 祖先链 = ' + chain.join(' < '))
      } else r.push('页面没有 .cell-locked')
      // 所有 table 的概况
      document.querySelectorAll('table').forEach(function(t, i){
        const ths = t.querySelectorAll('thead th').length
        const trs = t.querySelectorAll('tbody tr').length
        const firstTrTds = t.querySelector('tbody tr') ? t.querySelector('tbody tr').querySelectorAll('td').length : 0
        r.push('table[' + i + '] th=' + ths + ' tr=' + trs + ' 首行td=' + firstTrTds + ' cls=' + String(t.className).slice(0,60) + ' 父=' + String(t.parentElement && t.parentElement.className).slice(0,60))
      })
      return r.join('\\n')
    })()`))

    console.log('\n--- 明细行首行各 td 文本(定位批次号列真实下标) ---')
    console.log(await ev(`(function(){
      const t = document.querySelector('.body table'); if (!t) return 'no-table'
      const ths = Array.from(t.querySelectorAll('thead th')).map(function(x){return x.textContent.trim()})
      const tr = t.querySelector('tbody tr'); if (!tr) return 'no-tr'
      const tds = Array.from(tr.querySelectorAll('td'))
      return 'th 数=' + ths.length + ' / td 数=' + tds.length + '\\n' +
        tds.map(function(td,i){ return i + ':' + (ths[i]||'?') + '=' + JSON.stringify(td.textContent.trim().slice(0,18)) }).join(' | ')
    })()`))
  } finally {
    try { ws?.close() } catch {}
    try { edge.kill() } catch {}
    for (const b of ['弃审', '删除']) { try { await cb('QC_RECV', b, { 编号: recv }) } catch {} }
    await pool.close()
  }
}
main().catch((e) => { console.error('异常:' + (e && e.stack || e)); process.exit(1) })
