#!/usr/bin/env node
/**
 * 真实浏览器「卡死」探针:打开一个 MES 页面,然后**每秒 ping 一次 JS 主线程**。
 *   - 若主线程被长任务占住,ping 的往返时间会飙升(几秒~几十秒),甚至超时;
 *   - 页面若整体崩了,ping 直接失败。
 * 用来复现/量化「打开某面板后整页卡死(白屏、点什么都没反应)」。
 *
 * 用法: node tools/archive/_diag-scan-report/_probe-hang.mjs <url> <token> [秒数]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const URL_ = process.argv[2]
const TOKEN = process.argv[3] || ''
const SECS = Number(process.argv[4] || 60)
const PORT = 9333 + Math.floor(Math.random() * 200)
const PROFILE = path.join(os.tmpdir(), 'edge-hang-' + PORT)
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, 'about:blank'],
  { stdio: 'ignore', windowsHide: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let ws, id = 0
const pending = new Map()
const send = (method, params = {}) => new Promise((res, rej) => {
  const msg = { id: ++id, method, params }
  pending.set(msg.id, { res, rej })
  ws.send(JSON.stringify(msg))
})

try {
  let ok = false
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) { ok = true; break } } catch {}
    await sleep(250)
  }
  if (!ok) throw new Error('Edge 调试端口没起来')
  const tgt = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  ws = new WebSocket(tgt.webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result) }
  }
  await send('Runtime.enable'); await send('Page.enable')

  const origin = new URL(URL_).origin
  await send('Page.navigate', { url: origin + '/?_seed=1' })
  await sleep(2000)
  if (TOKEN) await send('Runtime.evaluate', { expression: `localStorage.setItem('mes_token', ${JSON.stringify(TOKEN)})` })

  console.log(`打开 ${URL_} ...`)
  const t0 = Date.now()
  await send('Page.navigate', { url: URL_ })
  await sleep(2500)

  let worst = 0, hangs = 0
  for (let i = 0; i < SECS; i++) {
    const p0 = Date.now()
    let cost = -1
    try {
      const r = await Promise.race([
        send('Runtime.evaluate', { expression: '1+1', returnByValue: true }),
        sleep(15000).then(() => { throw new Error('timeout') }),
      ])
      cost = Date.now() - p0
      if (r?.result?.value !== 2) cost = -1
    } catch { cost = Date.now() - p0 }
    worst = Math.max(worst, cost)
    const flag = cost > 1500 ? '  <== 主线程被占住' : ''
    if (cost > 1500) hangs++
    console.log(`+${String(((Date.now() - t0) / 1000).toFixed(0)).padStart(3)}s  ping=${String(cost).padStart(6)}ms${flag}`)
    await sleep(Math.max(0, 1000 - (Date.now() - p0)))
  }
  console.log(`\n最差 ping=${worst}ms,超过 1.5s 的次数=${hangs}/${SECS}`)
  const st = await send('Runtime.evaluate', {
    expression: `({mounted:!!window.__MES_MOUNTED__, nodes:document.querySelectorAll('*').length, rows:document.querySelectorAll('.el-table__body tr').length, text:(document.body.innerText||'').slice(0,120)})`,
    returnByValue: true,
  })
  console.log('页面状态:', JSON.stringify(st.result.value))
} catch (e) {
  console.log('探针失败:', e.message)
} finally {
  try { ws?.close() } catch {}
  try { edge.kill() } catch {}
  await sleep(300)
  try { fs.rmSync(PROFILE, { recursive: true, force: true }) } catch {}
}
