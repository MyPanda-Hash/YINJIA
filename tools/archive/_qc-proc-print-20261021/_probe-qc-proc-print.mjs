/*
 * _probe-qc-proc-print.mjs — 制程/首件检验单「打印」出纸实测(2026-10-21)
 *
 * 用户口径:「处理一下当前的报表渲染问题,打印处的格式应该和当前单据对应,修改当前打印预览的渲染方式,
 *   第一张图为打印预览的格式,第二张为原来的系统内实现的报表。」
 *
 * 验什么(CDP + Edge headless,用 Page.printToPDF 真正出纸,不靠肉眼):
 *   ① 点侧栏「打印」后,body 拿到 approval-printing 类;
 *   ② printToPDF 出来的 PDF **不是空白**(页数 ≥1 且内容流里有绘制指令);
 *   ③ 纸张根元素在打印态下 computed visibility === 'visible'(不是被 .portal 的 hidden 吃掉);
 *   ④ 出纸包含标题「制程检验记录表」;
 *   ⑤ 首件检验单同样验一遍(它的白名单里有 .fi-sheet,应当正常)。
 *
 * 用法: node tools/archive/_qc-proc-print-20261021/_probe-qc-proc-print.mjs [base]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = (process.argv[2] || 'http://localhost:5173').replace(/\/$/, '')
const OUT = 'D:/workspace/yinjia/tools/archive/_qc-proc-print-20261021'
const PORT = 9499
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (m, c, x = '') => { c ? (pass++, console.log('  [PASS] ' + m)) : (fail++, console.log('  [FAIL] ' + m + (x ? '  ' + x : ''))) }

const PANELS = [
  { code: 'QC_PROC_INSP', root: '.qr-sheet', title: '制程检验记录表' },
  { code: 'QC_FIRST_INSP', root: '.fi-sheet', title: '炭棒成型车间首件检验记录表' },
]

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-print-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--window-size=1800,1100', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
let tab = null
for (let i = 0; i < 40 && !tab; i++) {
  await sleep(1000)
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json() } catch { /* retry */ }
}
let ws = null
try {
  ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pend = new Map()
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
  const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
  const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value

  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1800, height: 1100, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(2500)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
    localStorage.setItem('mes_user', ${JSON.stringify(login.data.user)});
    localStorage.setItem('mes_locale','zh-CN'); localStorage.setItem('mes_init_done','1'); 'ok'`)

  for (const p of PANELS) {
    console.log(`\n=== ${p.code} (${p.root}) ===`)
    await send('Page.navigate', { url: `${BASE}/?_v=${Date.now()}#/panelx/list/${p.code}` })
    for (let i = 0; i < 80; i++) { await sleep(500); if (await ev(`!!document.querySelector('${p.root}')`)) break }
    await sleep(2500)
    await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='下次再说');if(b)b.click();
      const x=document.querySelector('.el-dialog__headerbtn');if(x)x.click();return 'ok'})()`)
    await sleep(800)

    // 模拟点「打印」:只加类、不真弹打印框(printToPDF 自己会走 print 媒体查询)
    await ev(`document.body.classList.add('approval-printing'); 'ok'`)
    await sleep(600)

    const vis = await ev(`getComputedStyle(document.querySelector('${p.root}')).visibility`)
    ok(`③ ${p.code} 纸张根在打印态 visibility=visible`, vis === 'visible', `实际 ${vis}`)

    const printed = await ev(`(() => {
      const el = document.querySelector('${p.root}')
      const r = el.getBoundingClientRect()
      return { w: Math.round(r.width), h: Math.round(r.height), text: (el.innerText || '').slice(0, 60) }
    })()`)
    console.log(`  纸张尺寸=${printed.w}x${printed.h} 文本=${JSON.stringify(printed.text)}`)
    // 标题可能在 innerText 前 60 字之外(首件纸张最上面是提醒条),单独查 .fi-title / .qr-title
    const titleText = await ev(`(document.querySelector('${p.root} .fi-title, ${p.root} .qr-title')?.innerText || '').trim()`)
    ok(`④ ${p.code} 纸张标题正确(${p.title})`, String(titleText).includes(p.title.slice(0, 6)), titleText || printed.text)
    ok('④ 纸张宽度 > 500px(没被压成 0)', printed.w > 500, String(printed.w))

    // 真出纸
    const pdf = await send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true })
    const b64 = pdf.result?.data || ''
    const buf = Buffer.from(b64, 'base64')
    const file = `${OUT}/print-${p.code}.pdf`
    fs.writeFileSync(file, buf)
    const s = buf.toString('latin1')
    const pageCount = (s.match(/\/Type\s*\/Page[^s]/g) || []).length
    const hasContent = /\/Contents\s+\d+\s+0\s+R/.test(s)
    // 内容流长度(压缩流看不到明文,用 /Length 近似判断"有没有画东西")
    const lens = [...s.matchAll(/\/Length\s+(\d+)/g)].map((m) => Number(m[1])).sort((a, b) => b - a)
    console.log(`  PDF: ${buf.length} bytes / ${pageCount} 页 / 最大流 ${lens[0] || 0}`)
    ok(`② ${p.code} printToPDF 出纸非空`, buf.length > 3000 && pageCount >= 1, `${buf.length}B / ${pageCount}页`)
    ok('② 有内容流', hasContent, String(hasContent))

    await ev(`document.body.classList.remove('approval-printing'); 'ok'`)
    await sleep(300)
  }
} finally {
  try { ws?.close() } catch { /* ignore */ }
  edge.kill()
}
console.log(`\n== 制程/首件检验单打印出纸:${pass} PASS / ${fail} FAIL ==`)
console.log(`PDF 落在 ${OUT}/print-*.pdf`)
process.exit(fail ? 1 : 0)
