/*
 * _probe-first-insp-grip.mjs — 标准行「拖动下标(格子右下角)」的现场量尺 + 端到端验收(2026-10-17)
 *
 * 用户口径(截图红框=标准行「炭棒长度」格里的拖动抓手):
 *   「这个拖动下标应该跟着当前的这个表格框的右下角走」。
 *
 * ⚠ 带 `--measure` 时只量不改(打印标准行每格的 td / textarea 矩形),用来定 CSS 方案。
 * 用法: node tools/archive/_probe-first-insp-grip.mjs [base] [--measure]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'http://127.0.0.1:8090').replace(/\/$/, '')
const MEASURE = process.argv.includes('--measure')
const PORT = 9501
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (m, c, x = '') => { c ? (pass++, console.log('  [PASS] ' + m)) : (fail++, console.log('  [FAIL] ' + m + (x ? '  ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-figrip-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--window-size=1700,1200', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
let tab = null
for (let i = 0; i < 40 && !tab; i++) {
  await sleep(1000)
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json() } catch { /* retry */ }
}
let ws = null
try {
  ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pend = new Map(); const errs = []
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
    if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails?.exception?.description || '').slice(0, 200))
  }
  const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
  const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value

  /** 标准行每格:td 与里面 textarea 的矩形 + 抓手(原生/自绘)的位置 */
  const measure = () => ev(`(() => {
    const s = document.querySelector('.fi-sheet')
    const names = [...s.querySelectorAll('.fi-grid thead tr:nth-child(2) th.col-head')]
      .map((th) => (th.querySelector('input')?.value || th.innerText || '').trim())
    const tr = s.querySelector('.fi-grid tbody tr.standard-row')
    const trR = tr.getBoundingClientRect()
    const cells = [...tr.querySelectorAll('td:not(.col-op)')].map((td, i) => {
      const ta = td.querySelector('textarea')
      const tdR = td.getBoundingClientRect()
      const taR = ta ? ta.getBoundingClientRect() : null
      // 自绘抓手(本轮新增)的矩形
      const g = td.querySelector('.fi-rowgrip')
      const gR = g ? g.getBoundingClientRect() : null
      return {
        col: names[i],
        tdBottom: Math.round(tdR.bottom), tdRight: Math.round(tdR.right), tdH: Math.round(tdR.height),
        taBottom: taR ? Math.round(taR.bottom) : null,
        taRight: taR ? Math.round(taR.right) : null,
        // textarea 底边离格子底边还差多少(>0 = 抓手悬在半空)
        gapBottom: taR ? Math.round(tdR.bottom - taR.bottom) : null,
        gapRight: taR ? Math.round(tdR.right - taR.right) : null,
        resize: ta ? getComputedStyle(ta).resize : null,
        minH: ta ? getComputedStyle(ta).minHeight : null,
        stdVar: getComputedStyle(tr).getPropertyValue('--fi-std-h').trim(),
        grip: gR ? { bottom: Math.round(gR.bottom), right: Math.round(gR.right),
          dBottom: Math.round(tdR.bottom - gR.bottom), dRight: Math.round(tdR.right - gR.right) } : null,
      }
    })
    return { rowH: Math.round(trR.height), cells }
  })()`)

  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1700, height: 1200, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(2200)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
    localStorage.setItem('mes_user', ${JSON.stringify(login.data.user)});
    localStorage.setItem('mes_locale','zh-CN'); localStorage.setItem('mes_init_done','1'); 'ok'`)
  await send('Page.navigate', { url: `${BASE}/?_v=${Date.now()}#/panelx/list/QC_FIRST_INSP` })
  for (let i = 0; i < 80; i++) { await sleep(500); if (await ev(`!!document.querySelector('.panelx-list')`)) break }
  await sleep(3000)
  await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='下次再说'); if(b){b.click()}
    const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
  await sleep(800)
  await ev(`(() => { const b=[...document.querySelectorAll('.approval-side [class*=as-side]')].find(x=>(x.innerText||'').trim()==='新增'); if(b) b.click(); return 'ok' })()`)
  await sleep(2800)
  await ev(`(() => { const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
  await sleep(1200)
  // 造出「同一行里有的格内容长、有的格内容短」的真实条件(截图就是这个场景:跌落/压降 3 行,长度格 1 行)
  await ev(`(() => {
    const s = document.querySelector('.fi-sheet')
    const names = [...s.querySelectorAll('.fi-grid thead tr:nth-child(2) th.col-head')]
      .map((th) => (th.querySelector('input')?.value || th.innerText || '').trim())
    const tas = [...s.querySelectorAll('.fi-grid tbody tr.standard-row td textarea')]
    const set = (col, v) => {
      const i = names.findIndex((n) => n.includes(col)); const ta = tas[i]; if (!ta) return
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
      setter.call(ta, v); ta.dispatchEvent(new Event('input', { bubbles: true }))
    }
    set('炭棒长度', '/')
    set('跌落', '跌落高度: 10cm;跌落次数: 10次;跌落要求: 10')
    set('挤压强度', '测试间距: 10mm;压头下降速度: 10mm/min;强度要求: 10')
    set('压降kPa', '压降标准: 10kPa;是否测试: √')
    return 'ok'
  })()`)
  await sleep(1200)

  const m = await measure()
  console.log(`  标准行高=${m.rowH}px`)
  console.table(m.cells.map((c) => ({
    列: c.col, 格高: c.tdH, 文本域高: c.taBottom == null ? '—' : (c.tdBottom - c.gapBottom) - (c.tdBottom - c.tdH),
    底差: c.gapBottom, 右差: c.gapRight, resize: c.resize,
    抓手底差: c.grip ? c.grip.dBottom : '—', 抓手右差: c.grip ? c.grip.dRight : '—',
  })))

  if (MEASURE) { console.log('\n(--measure:只量不改,结束)') } else {
    const shotIdx = process.argv.indexOf('--shot')
    const shoot = async (suffix) => {
      if (shotIdx < 0) return
      const s = await send('Page.captureScreenshot', { format: 'png' })
      fs.writeFileSync(`${process.argv[shotIdx + 1]}-${suffix}.png`, Buffer.from(s.result.data, 'base64'))
      console.log(`  截图:${process.argv[shotIdx + 1]}-${suffix}.png`)
    }
    await shoot('before')
    // ① 每格都有一个拖动抓手
    ok('① 标准行每格都有拖动抓手', m.cells.every((c) => c.grip), JSON.stringify(m.cells.map((c) => !!c.grip)))
    // ② 抓手贴在**格子**右下角(不是文本域右下角)
    const off = m.cells.filter((c) => c.grip && (c.grip.dBottom > 4 || c.grip.dRight > 4))
    ok('② 抓手贴在各格自己的右下角(底/右偏差 ≤ 4px)', off.length === 0,
      JSON.stringify(off.map((c) => `${c.col}:底${c.grip.dBottom}/右${c.grip.dRight}`)))
    // ③ 原生 resize 抓手已关掉(否则会多一个悬在半空的)
    const native = m.cells.filter((c) => c.resize && c.resize !== 'none')
    ok('③ 原生 textarea 抓手已关(只剩自绘那一个,不会有两个)', native.length === 0,
      JSON.stringify(native.map((c) => `${c.col}:${c.resize}`)))

    // ④ 拖一下:行高跟着长、抓手仍贴本格右下角、写字区(文本域)一起撑满
    const before = await ev(`(() => {
      const s = document.querySelector('.fi-sheet')
      const tr = s.querySelector('.standard-row')
      const tds = [...tr.querySelectorAll('td')]
      return { h: Math.round(tr.getBoundingClientRect().height),
        taH: tds.map((td) => Math.round(td.querySelector('textarea')?.getBoundingClientRect().height || 0)) }
    })()`)
    const drag = await ev(`(() => {
      const g = document.querySelector('.fi-sheet .standard-row .fi-rowgrip')
      if (!g) return 'no-grip'
      const r = g.getBoundingClientRect()
      const at = { clientX: Math.round(r.left + r.width / 2), clientY: Math.round(r.top + r.height / 2) }
      const ev = (t, x, y) => new MouseEvent(t, { bubbles: true, cancelable: true, clientX: x, clientY: y })
      g.dispatchEvent(ev('mousedown', at.clientX, at.clientY))
      window.dispatchEvent(ev('mousemove', at.clientX, at.clientY + 60))
      window.dispatchEvent(ev('mouseup', at.clientX, at.clientY + 60))
      return 'ok'
    })()`)
    await sleep(700)
    const after = await ev(`(() => {
      const s = document.querySelector('.fi-sheet')
      const tr = s.querySelector('.standard-row')
      const tds = [...tr.querySelectorAll('td')]
      const g = tr.querySelector('.fi-rowgrip')
      const trR = tr.getBoundingClientRect()
      const gR = g.getBoundingClientRect()
      const tdR = g.closest('td').getBoundingClientRect()
      return { h: Math.round(trR.height),
        taH: tds.map((td) => Math.round(td.querySelector('textarea')?.getBoundingClientRect().height || 0)),
        gripDBottom: Math.round(tdR.bottom - gR.bottom), gripDRight: Math.round(tdR.right - gR.right),
        userSelect: document.body.style.userSelect, cursor: document.body.style.cursor }
    })()`)
    console.log(`  拖动: 行高 ${before.h} → ${after.h};文本域高 ${JSON.stringify(before.taH)} → ${JSON.stringify(after.taH)}`)
    ok('④ 往下拖 ⇒ 行高跟着长(约 +60px)', drag === 'ok' && after.h - before.h >= 50,
      `${drag} ${before.h} → ${after.h}`)
    ok('④ 拖动后抓手仍贴本格右下角', after.gripDBottom <= 4 && after.gripDRight <= 4,
      `底${after.gripDBottom}/右${after.gripDRight}`)
    // 短内容格的文本域要跟着撑到格底 —— 这正是"写字区一起变大"
    const grew = after.taH.filter((h, i) => h > before.taH[i] + 20).length
    ok('④ 短内容格的文本域跟着撑满(写字区一起变大)', grew >= 6, `${JSON.stringify(before.taH)} → ${JSON.stringify(after.taH)}`)
    ok('④ 拖动结束已还原 body 的选中/光标(不留拖拽残留)',
      after.userSelect === '' && after.cursor === '', JSON.stringify({ s: after.userSelect, c: after.cursor }))
    // ⑤ 行高稳定(没有测量↔撑高的反复抖动)
    const h1 = await ev(`Math.round(document.querySelector('.fi-sheet .standard-row').getBoundingClientRect().height)`)
    await sleep(600)
    const h2 = await ev(`Math.round(document.querySelector('.fi-sheet .standard-row').getBoundingClientRect().height)`)
    ok('⑤ 行高稳定(不会自己越长越高)', h1 === h2, `${h1} vs ${h2}`)
    await shoot('after')
  }
  ok('⑥ 无未捕获的运行时异常', errs.length === 0, errs.join(' | '))
} finally {
  try { ws?.close() } catch { /* ignore */ }
  edge.kill()
}
console.log(`\n== 首件检验单标准行拖动抓手:${pass} PASS / ${fail} FAIL ==`)
process.exit(fail ? 1 : 0)
