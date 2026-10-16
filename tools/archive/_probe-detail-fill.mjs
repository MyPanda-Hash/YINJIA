/*
 * _probe-detail-fill.mjs — 单据明细表「是否填满页面 / 行多时边框是否扩大」几何实测
 *
 * 【用户口径 2026-10-15】
 *   「先对当前组装成品检验单这三个检验单据的明细表无法填充满页面进行修复,
 *     当行数和数据过多时当前明细表边框应该扩大」
 *
 * 【两个要证的态】
 *   ① 行少:表格高 = 可用高 ⇒ 表格底边贴到 .body 底边(gapBelowTable 只剩区块外边距 ~10px);
 *   ② 行多(可用高不够):表格高 = 内容自然高 ⇒ 边框**越出**可视区、外层 .portal-content 可滚,
 *      而不是卡在固定 5 行高里内部滚动。
 *      ②用**矮窗口**制造(窗口一矮,可用高就小于 5 行自然高),详见 --h=。
 *
 * 【稳定性】每次量完等 1.5s 再量一次:高度若还在变,说明"可用高度"自反馈了(表格长高 ⇒ .body
 *   被撑高 ⇒ 重测可用高度更大 ⇒ 再长高)。
 *
 * 用法:
 *   node tools/archive/_probe-detail-fill.mjs [baseUrl]               # 默认 5173 + 三张检验单
 *   node tools/archive/_probe-detail-fill.mjs <base> <窗口高> <面板> <单号|->   # 单张精确量
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '')
const VIEW_H = Number(process.argv[3] || 1100)
const PORT = 9481 + (VIEW_H % 10)
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败', login); process.exit(1) }
const token = login.data.token

const TARGETS = process.argv[4]
  ? [[process.argv[4], process.argv[5] === '-' ? null : process.argv[5]]]
  : [
      ['QC_MOLD_INSP', 'CX-2026-10-0022'],
      ['QC_CUT_INSP', 'QT-2026-10-0010'],
      ['QC_ASM_INSP', 'ZJ-2026-10-0008'],
    ]

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-dfill-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--window-size=1680,${VIEW_H}`, `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })

let tab = null
for (let i = 0; i < 40 && !tab; i++) {
  await sleep(1000)
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json() } catch { /* retry */ }
}
if (!tab) { edge.kill(); throw new Error('Edge CDP 未就绪') }

let ws = null
try {
  ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pend = new Map()
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
  const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
  const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: VIEW_H, deviceScaleFactor: 1, mobile: false })

  await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(2000)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
    localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))});
    localStorage.setItem('mes_locale','zh-CN'); localStorage.setItem('mes_init_done','1'); 'ok'`)
  await send('Page.navigate', { url: 'about:blank' }); await sleep(300)

  const measure = () => ev(`(() => {
    const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) } }
    const body = document.querySelector('.panelx-list .body')
    const detail = document.querySelector('.panelx-list .detail')
    const tbl = detail && detail.querySelector('.el-table')
    const bwrap = tbl && tbl.querySelector('.el-table__body-wrapper')
    const inner = bwrap && bwrap.querySelector('table')
    const rows = tbl ? tbl.querySelectorAll('.el-table__body-wrapper tbody tr').length : 0
    let sc = null
    let n = body
    while (n && n !== document.body) {
      const st = getComputedStyle(n)
      if (/(auto|scroll)/.test(st.overflowY) && n.scrollHeight > n.clientHeight + 1) { sc = (n.className || n.tagName).toString(); break }
      n = n.parentElement
    }
    return {
      viewportH: window.innerHeight,
      docH: document.documentElement.scrollHeight,
      bodyH: body ? body.clientHeight : null,
      detail: r(detail), detailCount: document.querySelectorAll('.panelx-list .body .detail').length,
      table: r(tbl), naturalTableH: inner ? inner.offsetHeight : null,
      rows,
      innerScrollable: bwrap ? bwrap.scrollHeight > bwrap.clientHeight + 1 : null,
      pageScrollable: sc,
      gapBelowTable: body && tbl ? Math.round(body.getBoundingClientRect().bottom - tbl.getBoundingClientRect().bottom) : null,
      belowFold: tbl ? Math.round(tbl.getBoundingClientRect().bottom - window.innerHeight) : null,
    }
  })()`)

  console.log(`# 窗口 ${VIEW_H}px @ ${BASE}`)
  for (const [panel, docNo] of TARGETS) {
    await send('Page.navigate', {
      url: `${BASE}/?_v=${Date.now()}#/panelx/list/${panel}` + (docNo ? `?docNo=${encodeURIComponent(docNo)}` : ''),
    })
    for (let i = 0; i < 90; i++) {
      await sleep(400)
      const ok = docNo
        ? await ev(`!!document.querySelector('.panelx-list .detail .el-table__body-wrapper tbody tr')`)
        : await ev(`!!document.querySelector('.panelx-list')`)
      if (ok) break
    }
    await sleep(2200)
    await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='下次再说'); if(b){b.click();return 'skip'} const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
    await sleep(600)
    console.log(`\n══ ${panel} ${docNo || '(列表态)'} ══`)
    const m = await measure()
    console.log('  ' + JSON.stringify(m))
    await sleep(1500)
    const m2 = await measure()
    const drift = ['table', 'detail', 'bodyH', 'docH'].map((k) => `${k}:${m[k]?.h ?? m[k]}→${m2[k]?.h ?? m2[k]}`).join(' ')
    console.log(`  稳定性 ${drift}${JSON.stringify(m.table) === JSON.stringify(m2.table) ? '  ✅稳定' : '  ❌仍在变'}`)
  }
} finally {
  try { ws?.close() } catch { /* ignore */ }
  edge.kill()
}
