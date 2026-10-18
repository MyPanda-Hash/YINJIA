#!/usr/bin/env node
/**
 * 真实浏览器探针(零依赖 CDP):用 headless Edge 打开一个 MES 地址,收集
 *   控制台错误 / 未捕获异常 / 失败请求(含加载失败)、以及挂载后的 DOM 状态。
 *
 * 为什么需要:白屏这类问题在服务端日志里**什么都没有**,只能在浏览器里看。
 *
 * 用法:
 *   node tools/archive/_diag-scan-report/_probe-page-boot.mjs <url> [等待毫秒] [token]
 *   例: node ... "http://36.140.66.163:8090/#/prod/plan/workOrderBoard" 9000
 *   token: 可选;给了就先写进 localStorage.mes_token 再进目标页(免登录)
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const URL_ = process.argv[2] || 'http://127.0.0.1:8090/'
const WAIT = Number(process.argv[3] || 9000)
const TOKEN = process.argv[4] || ''
const PORT = 9333 + Math.floor(Math.random() * 200)
const PROFILE = path.join(os.tmpdir(), 'edge-cdp-' + PORT)
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--disable-background-networking',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  'about:blank',
], { stdio: 'ignore', windowsHide: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let ws
let id = 0
const pending = new Map()
const logs = []
const exceptions = []
const failedReqs = []

function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const msg = { id: ++id, method, params }
    if (sessionId) msg.sessionId = sessionId
    pending.set(msg.id, { resolve, reject })
    ws.send(JSON.stringify(msg))
  })
}

try {
  // 等调试端口起来
  let version = null
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      if (r.ok) { version = await r.json(); break }
    } catch { /* retry */ }
    await sleep(250)
  }
  if (!version) throw new Error('Edge 调试端口没起来')

  const tgt = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' })
  const target = await tgt.json()
  ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })

  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id)
      m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result)
      return
    }
    if (m.method === 'Runtime.consoleAPICalled') {
      const txt = (m.params.args || []).map((a) => a.value ?? a.description ?? a.type).join(' ')
      logs.push(`[${m.params.type}] ${txt}`)
    } else if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails
      exceptions.push(`${d.text} ${d.exception?.description ?? ''} @${d.url ?? ''}:${d.lineNumber ?? ''}`)
    } else if (m.method === 'Log.entryAdded') {
      logs.push(`[log:${m.params.entry.level}] ${m.params.entry.text}`)
    } else if (m.method === 'Network.loadingFailed') {
      failedReqs.push(`${m.params.type} ${m.params.errorText} (blocked=${m.params.blockedReason || '-'})`)
    }
  }

  await send('Runtime.enable')
  await send('Log.enable')
  await send('Network.enable')
  await send('Page.enable')

  const origin = new URL(URL_).origin
  if (TOKEN) {
    // 先到同源首页写 token,再进目标页
    await send('Page.navigate', { url: origin + '/?_seed=1' })
    await sleep(2500)
    await send('Runtime.evaluate', {
      expression: `localStorage.setItem('mes_token', ${JSON.stringify(TOKEN)}); 'seeded'`,
      returnByValue: true,
    })
  }
  const t0 = Date.now()
  await send('Page.navigate', { url: URL_ })
  await sleep(WAIT)

  const probe = await send('Runtime.evaluate', {
    expression: `(() => {
      const app = document.querySelector('#app')
      const txt = (document.body.innerText || '').trim()
      return {
        title: document.title,
        mounted: !!window.__MES_MOUNTED__,
        appChildren: app ? app.children.length : -1,
        appHtmlLen: app ? app.innerHTML.length : -1,
        bodyText: txt.slice(0, 300),
        bodyTextLen: txt.length,
        bootTip: !!document.getElementById('boot-tip'),
        fatal: !!document.getElementById('boot-fatal'),
        fatalText: document.getElementById('boot-fatal') ? document.getElementById('boot-fatal').innerText.slice(0, 400) : '',
        token: !!localStorage.getItem('mes_token'),
        hash: location.hash,
      }
    })()`,
    returnByValue: true,
  })

  console.log('=== 页面探测 ===')
  console.log(JSON.stringify(probe.result.value, null, 1))
  console.log(`\n=== 控制台(${logs.length}) ===`)
  for (const l of logs.slice(-25)) console.log(' ', l.slice(0, 300))
  console.log(`\n=== 未捕获异常(${exceptions.length}) ===`)
  for (const e of exceptions.slice(-10)) console.log(' ', e.slice(0, 400))
  console.log(`\n=== 失败请求(${failedReqs.length}) ===`)
  for (const f of failedReqs.slice(-10)) console.log(' ', f)
  console.log(`\n耗时 ${Date.now() - t0}ms, URL=${URL_}`)
} catch (e) {
  console.error('探针失败:', e.message)
} finally {
  try { ws?.close() } catch { /* ignore */ }
  try { edge.kill() } catch { /* ignore */ }
  await sleep(300)
  try { fs.rmSync(PROFILE, { recursive: true, force: true }) } catch { /* ignore */ }
}
