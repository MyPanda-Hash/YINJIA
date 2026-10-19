#!/usr/bin/env node
/**
 * 复现「打印后主页面卡死」:用**有头(headful)** Edge + CDP 打开 MES,注入打印代码,
 * 然后持续 ping 主线程,看它是否被打印流程卡死;并报告是否真的弹出了打印窗口。
 *
 * 用法: node tools/archive/_diag-scan-report/_repro-print-freeze.mjs <url> <token> [秒]
 *   url 例: http://127.0.0.1:5173/#/prod/plan/workOrderBoard
 *
 * 安全:只在你本机开一个**临时 profile** 的 Edge 窗口,结束即关;不写任何业务数据(不点保存/审核)。
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const URL_ = process.argv[2] || 'http://127.0.0.1:5173/#/prod/plan/workOrderBoard'
const TOKEN = process.argv[3] || ''
const SECS = Number(process.argv[4] || 40)
const MODE = process.argv[5] || 'popup'   // popup = 弹窗打印(工单排产/二维码标签); self = 主页面 window.print()(面板单据打印)
const PORT = 9500 + Math.floor(Math.random() * 200)
const PROFILE = path.join(os.tmpdir(), 'edge-repro-' + PORT)
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

const edge = spawn(EDGE, ['--no-first-run', '--no-default-browser-check', '--disable-extensions',
  '--disable-background-networking', '--disable-popup-blocking', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  '--window-size=1200,800', 'about:blank'], { stdio: 'ignore', windowsHide: false })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let ws, id = 0
const pending = new Map()
const send = (method, params = {}) => new Promise((res, rej) => {
  const msg = { id: ++id, method, params }
  pending.set(msg.id, { res, rej })
  ws.send(JSON.stringify(msg))
})

// 近似真实「工单生产任务单」:多行 + 每行一张二维码大小的 data-URL 图片(真实单据就是这样)
const IMAGES_SNIPPET = `
(() => {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0,0,128,128); g.fillStyle = '#000'
  for (let i = 0; i < 300; i++) g.fillRect(Math.random()*120, Math.random()*120, 4, 4)
  const url = c.toDataURL('image/png')
  let rows = ''
  for (let i = 1; i <= 40; i++) {
    rows += '<tr><td>' + i + '</td><td>GD-2026-10-' + String(1000+i) + '</td><td>否</td><td>S022-4</td>'
      + '<td>A+级烧结炭棒/滤芯</td><td>45*25*178</td><td>160</td><td>2026-10-18</td>'
      + '<td><img src="' + url + '" width="64" height="64"/></td></tr>'
  }
  const w = window.open('', '_blank', 'width=1100,height=780')
  if (!w) return 'POPUP_BLOCKED'
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>成型生产任务单</title>'
    + '<style>@page{size:A4 landscape;margin:8mm}body{font:12px "Microsoft YaHei"}table{border-collapse:collapse;width:100%}'
    + 'th,td{border:1px solid #444;padding:4px}img{width:64px;height:64px}</style></head><body>'
    + '<h2 style="text-align:center">成型生产任务单</h2>'
    + '<table><tr><th>序号</th><th>单据编号</th><th>重点</th><th>编码</th><th>名称</th><th>规格</th><th>数量</th><th>交期</th><th>二维码</th></tr>'
    + rows + '</table>'
    + '<scr' + 'ipt>window.onload=function(){setTimeout(function(){window.print()},200)}</scr' + 'ipt>'
    + '</body></html>')
  w.document.close()
  return 'POPUP_OPENED_40ROWS_WITH_IMAGES'
})()
`

const MODULE_SNIPPET = `
(async () => {
  const m = await import('/src/business/print-formats.js')
  const ok = await m.printWorkTaskSheet('成型生产任务单', [{
    单据编号: 'GD-TEST-0001', 公司代码: '0', 工单行号: 1, 是否重点管控产品: '否',
    商品编码: 'P001', 商品名称: '探针测试', 规格型号: '1*1', 订单数量: 10,
    成型折算后数量: 10, 计划完工日期: '2026-10-19',
  }])
  return (ok ? 'OK' : 'FAIL')
    + ' host=' + !!document.getElementById('yj-print-host')
    + ' hostCss=' + !!document.getElementById('yj-print-host-css')
    + ' title=' + document.title
})()
`

const PRINT_SNIPPET = `
(() => {
  const w = window.open('', '_blank', 'width=1100,height=780')
  if (!w) return 'POPUP_BLOCKED'
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body>'
    + '<h1 style="font:700 20px sans-serif">打印测试 ' + new Date().toLocaleTimeString() + '</h1>'
    + '<table border="1" style="border-collapse:collapse"><tr><th>序号</th><th>单据编号</th><th>二维码</th></tr>'
    + '<tr><td>1</td><td>GD-TEST</td><td><img src="https://dummyimage.com/64x64/000/fff"/></td></tr></table>'
    + '<scr' + 'ipt>window.onload=function(){setTimeout(function(){window.print()},200)}</scr' + 'ipt>'
    + '</body></html>')
  w.document.close()
  return 'POPUP_OPENED'
})()
`

try {
  let up = false
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) { up = true; break } } catch {}
    await sleep(250)
  }
  if (!up) throw new Error('Edge 调试端口没起来(可能被沙箱拦住,无法有头启动)')
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
  await sleep(2500)
  if (TOKEN) await send('Runtime.evaluate', { expression: `localStorage.setItem('mes_token', ${JSON.stringify(TOKEN)})` })
  await send('Page.navigate', { url: URL_ })
  console.log(`打开 ${URL_} ...`)
  await sleep(6000)

  const mounted = await send('Runtime.evaluate', { expression: '!document.querySelector("#boot-tip")', returnByValue: true })
  console.log('页面就绪(无启动占位):', mounted.result.value)

  const body = MODE === 'self'
    ? `(() => { window.print(); return 'SELF_PRINT_CALLED' })()`
    : MODE === 'images' ? IMAGES_SNIPPET
      : MODE === 'module' ? MODULE_SNIPPET
        : PRINT_SNIPPET
  const r = await send('Runtime.evaluate', {
    expression: body, returnByValue: true, awaitPromise: MODE === 'module',
  })
  console.log(MODE === 'self' ? '主页面 window.print():' : MODE === 'module' ? '模块内打印(页面内打印层):' : '注入打印:', r.result.value)

  let worst = 0
  for (let i = 1; i <= SECS; i++) {
    const p0 = Date.now()
    let cost
    try {
      await Promise.race([
        send('Runtime.evaluate', { expression: '1+1', returnByValue: true }),
        sleep(20000).then(() => { throw new Error('timeout') }),
      ])
      cost = Date.now() - p0
    } catch { cost = Date.now() - p0 }
    worst = Math.max(worst, cost)
    console.log(`+${String(i).padStart(2)}s  ping=${String(cost).padStart(6)}ms${cost > 1500 ? '   <== 主线程被占死' : ''}`)
    await sleep(Math.max(0, 1000 - (Date.now() - p0)))
  }
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
  console.log('\n最差 ping:', worst, 'ms')
  console.log('当前窗口/标签:', targets.filter((t) => t.type === 'page').map((t) => t.url.slice(0, 70)).join(' | '))
} catch (e) {
  console.log('复现失败:', e.message)
} finally {
  try { ws?.close() } catch {}
  try { edge.kill() } catch {}
  await sleep(500)
  try { fs.rmSync(PROFILE, { recursive: true, force: true }) } catch {}
}
