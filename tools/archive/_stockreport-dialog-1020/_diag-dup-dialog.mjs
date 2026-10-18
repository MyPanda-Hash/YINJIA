/**
 * _diag-dup-dialog.mjs — 「进入汇总页出现 2 个查询弹窗」到底是谁的两个?(定向诊断)
 *
 * 输出每个可见「查询」弹窗的:所属 Vue 实例 uid、父级 teleport 目标、是否含「生效中」行、
 * 面板路径线索、以及当前各 keep-alive 实例的 dialogVisible 状态。
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const host = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/+$/, '')
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const profile = mkdtempSync(join(tmpdir(), 'edge-diag-'))
const port = 9395
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1680,1000', 'about:blank'], { stdio: 'ignore' })

let ws, msgId = 0
const pending = new Map()
for (let i = 0; i < 60; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    const page = list.find((t) => t.type === 'page')
    if (page?.webSocketDebuggerUrl) {
      ws = new WebSocket(page.webSocketDebuggerUrl)
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
      ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
      break
    }
  } catch { /* retry */ }
  await sleep(500)
}
if (!ws) { console.error('[FATAL] CDP'); process.exit(1) }
const send = (m, p) => { const id = ++msgId; return new Promise((r) => { pending.set(id, r); ws.send(JSON.stringify({ id, method: m, params: p || {} })) }) }
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value

await send('Page.enable'); await send('Runtime.enable')
await send('Page.navigate', { url: host + '/#/login' })
await sleep(4000)
const lg = await (await fetch(host + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)});`
  + `localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))});`
  + `localStorage.setItem('mes_locale','zh-CN'); 'ok'`)
await send('Page.reload', { ignoreCache: true })
await sleep(8000)

const dump = () => ev(`(() => {
  const vis = (el) => {
    if (!el) return false
    const cs = getComputedStyle(el)
    const ov = el.closest('.el-overlay')
    const ovOk = ov ? getComputedStyle(ov).display !== 'none' : true
    return cs.display !== 'none' && cs.visibility !== 'hidden' && ovOk && el.offsetParent !== null
  }
  const all = [...document.querySelectorAll('.el-dialog')]
  const q = all.filter(vis).filter(d => (d.querySelector('.el-dialog__title')?.innerText || '').trim() === '查询')
  const info = q.map((d, i) => {
    // 从 DOM 往上找 Vue 组件实例
    let vm = d.__vueParentComponent, uid = null, depth = 0
    while (vm && depth < 30) { if (vm.uid !== undefined) { uid = vm.uid; break } vm = vm.parent; depth++ }
    // 弹窗里出现过的字段名(用来区分面板:台账有 仓库/存货,汇总也有;看列名线索)
    const labels = [...d.querySelectorAll('.query-dialog-field label')].map(x => (x.innerText || '').trim())
    return {
      i,
      uid,
      hasActive: !!d.querySelector('.query-active-cond'),
      labels,
      dateVals: [...d.querySelectorAll('.el-date-editor input')].map(x => x.value),
      rect: (() => { const r = d.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.left), Math.round(r.width)] })(),
    }
  })
  return { total: all.length, visibleQuery: q.length, info, hash: location.hash,
    rows: document.querySelectorAll('.el-table__body tbody tr').length }
})()`)

const lines = []
const say = (s) => { console.log(s); lines.push(s) }

say('=== 步骤1:进入台账 → 关掉 → 进汇总(复现 F 的两弹窗)===')
await ev(`location.hash = '#/dashboard'; 'ok'`); await sleep(2500)
await ev(`location.hash = '#/panelx/list/STOCK_LEDGER'; 'ok'`); await sleep(9000)
say('LAY1: ' + JSON.stringify(await dump()))

// 关掉台账弹窗
await ev(`(() => { const d=[...document.querySelectorAll('.el-dialog')].find(x=>x.offsetParent!==null); d?.querySelector('.el-dialog__headerbtn')?.click(); return 1 })()`)
await sleep(3500)
say('LAY2(关后): ' + JSON.stringify(await dump()))

await ev(`location.hash = '#/panelx/list/STOCK_SUMMARY'; 'ok'`); await sleep(9000)
say('SUM1: ' + JSON.stringify(await dump()))

await sleep(4000)
say('SUM2(+4s): ' + JSON.stringify(await dump()))

const fs = await import('node:fs')
const path = await import('node:path')
const { fileURLToPath } = await import('node:url')
fs.writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'diag-dup.out'), lines.join('\n') + '\n')
try { edge.kill() } catch {}
process.exit(0)
