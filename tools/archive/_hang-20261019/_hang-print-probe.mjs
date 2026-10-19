#!/usr/bin/env node
/**
 * MES「页面/操作卡死」CDP 探针(2026-10-19)
 *
 * 为什么单独写:现场报「13:46 打印工单后整个系统卡住」,5173 与 8090 都卡。
 * 需要把「卡在哪」量出来 —— 是网络/后端慢,还是浏览器主线程被长任务占住。
 *
 * 做法:连一个已经开好的 Edge 调试端口(由 PowerShell 侧启动,见 README),
 *   ① 种 token → 打开目标页;② 每 500ms ping 一次主线程;③ 收集 longtask/错误;
 *   ④ 可选:执行一段页面内 JS(比如点打印按钮)后再观察。
 *
 * 用法:
 *   node _hang-print-probe.mjs --port 9555 --url http://127.0.0.1:8090/#/prod/plan/workOrderList \
 *        --token <JWT> [--secs 25] [--action "js 表达式"] [--shot out.png]
 */
import fs from 'node:fs'

const arg = (k, d = '') => {
  const i = process.argv.indexOf('--' + k)
  return i > 0 ? process.argv[i + 1] : d
}
const PORT = Number(arg('port', '9555'))
const URL_ = arg('url')
const TOKEN = arg('token', '')
const USERFILE = arg('userfile', '')
const SECS = Number(arg('secs', '25'))
const ACTION = arg('action', '')
const BLOCK = arg('block', '')   // 逗号分隔的 URL 子串,用 CDP 拦掉(例如 printStamp,避免污染正式库数据)
const SHOT = arg('shot', '')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let ws, id = 0
const pending = new Map()
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const msg = { id: ++id, method, params }
    pending.set(msg.id, { res, rej })
    ws.send(JSON.stringify(msg))
  })

const events = { longtasks: [], exceptions: [], consoleErrors: [] }

try {
  const ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()
  const tgt = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  ws = new WebSocket(tgt.webSocketDebuggerUrl)
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id)
      m.error ? p.rej(new Error(m.error.message)) : p.res(m.result)
    } else if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails
      events.exceptions.push((d.exception?.description || d.text || '').slice(0, 300))
    } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      events.consoleErrors.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300))
    } else if (m.method === 'Performance.longTask') {
      events.longtasks.push(Math.round(m.params.duration))
    }
  }
  await send('Runtime.enable')
  await send('Page.enable')
  if (BLOCK) {
    await send('Network.enable')
    await send('Network.setBlockedURLs', { urls: BLOCK.split(',').map((s) => '*' + s.trim() + '*') })
    console.log('已拦截请求:', BLOCK)
  }

  const origin = new URL(URL_).origin
  await send('Page.navigate', { url: origin + '/?probe=1' })
  await sleep(1500)
  if (TOKEN) {
    const userJson = USERFILE && fs.existsSync(USERFILE) ? fs.readFileSync(USERFILE, 'utf8').trim() : ''
    await send('Runtime.evaluate', {
      expression: `localStorage.setItem('mes_token', ${JSON.stringify(TOKEN)});` +
        (userJson ? ` localStorage.setItem('mes_user', ${JSON.stringify(userJson)});` : '') +
        ` localStorage.setItem('mes_login_date', ${JSON.stringify(new Date().toISOString().slice(0, 10))}); true`,
      returnByValue: true,
    })
  }

  const t0 = Date.now()
  await send('Page.navigate', { url: URL_ })
  await sleep(3000)

  // 装 longtask 观察器(打开页面之后装,只看稳定期的长任务)
  await send('Runtime.evaluate', {
    expression: `(() => { window.__lt = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)) }).observe({ entryTypes: ['longtask'] }) } catch (e) {} })(); true`,
    returnByValue: true,
  })

  if (ACTION) {
    console.log('执行操作:', ACTION.slice(0, 120))
    const r = await send('Runtime.evaluate', { expression: ACTION, returnByValue: true, awaitPromise: true })
    console.log('操作返回:', JSON.stringify(r?.result?.value ?? r?.exceptionDetails?.text ?? '').slice(0, 300))
  }

  let worst = 0, hangs = 0, samples = []
  for (let i = 0; i < Math.round((SECS * 1000) / 500); i++) {
    const p0 = Date.now()
    let cost = -1
    try {
      const r = await Promise.race([
        send('Runtime.evaluate', { expression: '1+1', returnByValue: true }),
        sleep(20000).then(() => { throw new Error('timeout') }),
      ])
      cost = Date.now() - p0
      if (r?.result?.value !== 2) cost = -1
    } catch { cost = Date.now() - p0 }
    worst = Math.max(worst, cost)
    if (cost > 1500) hangs++
    samples.push(cost)
    if (cost > 1500) console.log(`+${((Date.now() - t0) / 1000).toFixed(1)}s  ping=${cost}ms  <== 主线程被占住`)
  }

  const lt = await send('Runtime.evaluate', { expression: 'window.__lt || []', returnByValue: true })
  const longtasks = lt?.result?.value || []
  const st = await send('Runtime.evaluate', {
    expression: `({nodes: document.querySelectorAll('*').length,
                 rows: document.querySelectorAll('.el-table__body tr').length,
                 checked: document.querySelectorAll('.el-table__body .el-checkbox.is-checked').length,
                 title: document.title,
                 url: location.href,
                 text: (document.body.innerText || '').slice(0, 160)})`,
    returnByValue: true,
  })

  console.log('\n===== 结论 =====')
  console.log('最差 ping =', worst, 'ms;>1.5s 次数 =', hangs + '/' + samples.length)
  console.log('longtask(>50ms):', longtasks.length, '条,最大', Math.max(0, ...longtasks), 'ms,前 10:', longtasks.slice(0, 10))
  console.log('页面状态:', JSON.stringify(st?.result?.value))
  console.log('JS 异常:', events.exceptions.slice(0, 5))
  console.log('console.error:', events.consoleErrors.slice(0, 5))

  if (SHOT) {
    const img = await send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(SHOT, Buffer.from(img.data, 'base64'))
    console.log('截图:', SHOT)
  }
} catch (e) {
  console.log('探针失败:', e.message)
} finally {
  try { ws?.close() } catch {}
}
