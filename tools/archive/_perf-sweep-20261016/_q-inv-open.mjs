/**
 * _q-inv-open.mjs —— 「商品(INV)页面打开卡一下」定位(只读,2026-10-16 性能专项)
 *
 * 把"卡"拆成三段可量的事实:
 *   ① 网络/体积:该次打开所有 /api 请求的耗时 + 响应体字节(Resource Timing API)
 *   ② 解析:JSON.parse 的体量(以响应字节近似;6.5 MB 必定要付)
 *   ③ 渲染/主线程:首屏渲染完成耗时 + DOM 节点数 + 长任务(longtask)总阻塞时间
 * 同时跑一个轻面板(TEAM)作对照,好判断"是商品特有的问题"还是"所有列表页都这样"。
 *
 * 用法: node tools/archive/_perf-sweep-20261016/_q-inv-open.mjs [uiBase] [panelA] [panelB]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const UI = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PANELS = [process.argv[3] || 'INV', process.argv[4] || 'TEAM']
const PORT = 9402
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const lg = JSON.parse(await (await fetch(UI + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).text())

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-inv-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1440,1000',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)
let tab
for (let i = 0; i < 30 && !tab; i++) {
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json() } catch { /* 等 */ }
  if (!tab) await sleep(500)
}
const ws = new WebSocket(tab.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0
const pending = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }))?.result?.result?.value
await send('Page.enable'); await send('Runtime.enable')
/* 在每次新文档里装长任务观察器(必须在导航前注入,否则错过首屏) */
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `window.__lt = { total: 0, max: 0, n: 0 };
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__lt.total += e.duration; window.__lt.n++; window.__lt.max = Math.max(window.__lt.max, e.duration) } }).observe({ entryTypes: ['longtask'] }) } catch (e) {}`,
})

const measure = async (panel) => {
  await send('Page.navigate', { url: `${UI}/#/login` }); await sleep(1200)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))}); 'ok'`)
  await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
  await ev(`window.__lt = { total: 0, max: 0, n: 0 }`)
  const t0 = Date.now()
  await send('Page.navigate', { url: `${UI}/#/panelx/list/${panel}` })
  /* 等到取数请求真的回来 + 再给渲染 1.5s(固定 sleep 会测到"没数据时的空表",不诚实) */
  let listReq = null
  for (let i = 0; i < 120; i++) {
    await sleep(150)
    const j = await ev(`JSON.stringify(performance.getEntriesByType('resource')
        .filter(r => r.name.includes('queryFormDataList') || r.name.includes('getPanelConfig'))
        .map(r => ({ u: r.name.replace(/^.*\\/api/, ''), ms: Math.round(r.duration), kb: Math.round((r.transferSize || 0) / 1024), dec: Math.round((r.decodedBodySize || 0) / 1024) })))`)
    const arr = JSON.parse(j || '[]')
    listReq = arr.find((x) => x.u.includes('queryFormDataList')) || null
    if (listReq && listReq.dec > 0) break
  }
  await sleep(1500)   // 让表格把行渲染完(DOM 规模与长任务都在这一段)
  const openMs = Date.now() - t0
  const rendered = await ev(`document.querySelectorAll('.el-table__body tr, .px-row, .el-table__row, tbody tr').length`)
  const dom = await ev(`document.querySelectorAll('*').length`)
  const lt = await ev(`JSON.stringify(window.__lt)`)
  const res = await ev(`JSON.stringify(performance.getEntriesByType('resource')
      .filter(r => r.name.includes('/api/'))
      .map(r => ({ u: r.name.replace(/^.*\\/api/, ''), ms: Math.round(r.duration), kb: Math.round((r.transferSize || r.encodedBodySize || 0) / 1024), dec: Math.round((r.decodedBodySize || 0) / 1024) }))
      .sort((a, b) => b.kb - a.kb).slice(0, 8))`)
  return { panel, openMs, rendered, dom, lt: JSON.parse(lt || '{}'), api: JSON.parse(res || '[]') }
}

console.log(`== 面板打开耗时定位 @ ${UI} ==`)
for (const p of PANELS) {
  const r = await measure(p)
  console.log(`\n【${r.panel}】打开→表格出数据 ${r.openMs} ms · 首屏行数 ${r.rendered} · DOM 节点 ${r.dom}`)
  console.log(`   长任务: ${r.lt.n} 次 / 总阻塞 ${Math.round(r.lt.total || 0)} ms / 最长 ${Math.round(r.lt.max || 0)} ms`)
  console.log('   接口(按响应体排序):')
  for (const a of r.api) console.log(`     ${String(a.kb).padStart(6)} KB(解码 ${String(a.dec).padStart(6)} KB)  ${String(a.ms).padStart(5)} ms  ${a.u}`)
  if (process.env.YJ_CENSUS) {
    const census = await ev(`JSON.stringify((() => {
      const byTag = {}; const byCls = {}
      document.querySelectorAll('*').forEach(e => {
        byTag[e.tagName] = (byTag[e.tagName] || 0) + 1
        const c = (typeof e.className === 'string' ? e.className : '').split(' ').filter(Boolean)[0]
        if (c) byCls[c] = (byCls[c] || 0) + 1
      })
      const tables = Array.from(document.querySelectorAll('.el-table')).map((t, i) => ({
        i, rows: t.querySelectorAll('.el-table__body tr').length,
        nodes: t.querySelectorAll('*').length, w: Math.round(t.getBoundingClientRect().width)
      }))
      const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 12)
      return { total: document.querySelectorAll('*').length, byTag: top(byTag), byCls: top(byCls), tables }
    })())`)
    const c = JSON.parse(census || '{}')
    console.log(`   DOM 普查:总节点 ${c.total}`)
    console.log(`     标签 top: ${(c.byTag || []).map(([k, v]) => k + '=' + v).join(' ')}`)
    console.log(`     类名 top: ${(c.byCls || []).map(([k, v]) => k + '=' + v).join(' ')}`)
    console.log(`     表格: ${(c.tables || []).map((t) => `#${t.i} 行${t.rows}/节点${t.nodes}`).join(' | ')}`)
    /* 谁扛着最多的单元格:从每个 TD 往上找 3 层,按「类名 + 承载 TD 数」聚合 */
    const blame = await ev(`JSON.stringify((() => {
      const m = {}
      document.querySelectorAll('td').forEach(td => {
        let e = td.parentElement && td.parentElement.parentElement && td.parentElement.parentElement.parentElement
        const c = e && typeof e.className === 'string' ? e.className.split(' ').slice(0, 2).join('.') : (e ? e.tagName : '?')
        m[c] = (m[c] || 0) + 1
      })
      return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6)
    })())`)
    console.log(`     谁扛着 TD: ${JSON.parse(blame || '[]').map(([k, v]) => k + '=' + v).join(' | ')}`)
  }
}
ws.close(); edge.kill()
