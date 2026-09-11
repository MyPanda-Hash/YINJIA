// 验收:规格书 1.适用范围 / 2.整体规格参数 / 3.产品主要性能 三节由第 3 页移到第 1 页「产品信息」封面之下
//   —— 断言:①第 1 页区块顺序 = 封面 → 1/2/3 三节(页末);②第 3 页不再出现这三节,仍从 4.产品性能检验项目及检验标准 开始;
//            ③三节的「标准库」勾选→填入仍写回同一个头字段 key;④其它页(修订记录/成品及包装运输)不受影响;
//            ⑤打印分页:第 1 页(封面+三节)的物理页数,并给出「只有封面」的对照页数;⑥出第 1 页截图。
// 用法: node tools/_spec-page-move-check.cjs
// 前置:前端 http://localhost:5173、后端 http://localhost:8090 均在运行。探针**不保存任何单据**(新增草稿不落库)。
//
// 注意(踩过的坑):
//   * 点击一律用 JS el.click():弹窗是 el-dialog teleport 到 body 的,若用
//     `document.querySelectorAll('.el-overlay').forEach(e => e.remove())` 清浮层,
//     会把 teleport 出来的弹窗 DOM 从文档里摘掉——之后 v-show 只改那个已脱离文档的节点,
//     弹窗永远不出现(querySelectorAll 也查不到)。本探针只点 .wz-skip,不清浮层。
//   * setupState 是 proxyRefs(ref 已解包):读 secLibVisible 得到布尔值,不要再 .value。
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090'
const PORT = 9411
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const SHOT_DIR = 'C:/INCER/DSHTemp'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fails = []
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m) }

/** 在页面里按文档顺序 dump 纸面区块(隐藏页 v-show display:none 会被过滤) */
const DUMP_FN = `(function(){
  const vis = (e) => { let el = e; while (el && el !== document.body) { const st = getComputedStyle(el); if (st.display === 'none' || st.visibility === 'hidden') return false; el = el.parentElement } return true }
  const root = document.querySelector('.record-sheet')
  if (!root) return null
  const order = []
  const walk = (node) => {
    for (const el of node.children) {
      if (!vis(el)) continue
      if (el.matches('.rs-head-t')) { order.push(el.querySelector('.rsp-cover-page') ? 'COVER' : 'HEAD'); continue }
      if (el.matches('.rsp-dt-wrap')) { const b = el.querySelector('.rs-sectionbar, .rsp-page-title, .rsp-plain-title'); order.push('TABLE:' + (b ? b.textContent.trim() : '(无标题)')); continue }
      if (el.matches('table.rs-t')) {
        const docs = [...el.querySelectorAll('.rsp-doclabel')].filter(vis).map(e => e.textContent.trim())
        const bar = el.querySelector('.rs-sectionbar')
        const ttl = el.querySelector('.rsp-page-title')
        if (docs.length) order.push(...docs.map(d => 'DOC:' + d))
        if (bar) order.push('BAR:' + bar.textContent.trim())
        if (ttl) order.push('TITLE:' + ttl.textContent.trim())
        if (!docs.length && !bar && !ttl) order.push('TABLE(空标题)')
        continue
      }
      walk(el)
    }
  }
  walk(root)
  const cover = root.querySelector('.rsp-cover-page')
  const docTds = [...root.querySelectorAll('.rsp-doccell')].filter(vis)
  return {
    order,
    tabs: [...document.querySelectorAll('.rsp-page-tab')].map(e => e.textContent.trim()),
    libPicks: [...root.querySelectorAll('.rsp-lib-pick')].filter(vis).length,
    docRows: docTds.map(td => ({ label: (td.querySelector('.rsp-doclabel') || {}).textContent?.trim() || '', h: Math.round(td.getBoundingClientRect().height) })),
    coverH: cover ? Math.round(cover.getBoundingClientRect().height) : 0,
    sheetH: Math.round(root.getBoundingClientRect().height),
  }
})()`

let ws = null
let edge = null
async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true })
  const login = await (await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login?.data?.token
  if (!token) { console.error('登录失败', login); process.exit(1) }

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-specmv-'))
  edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1600,1400', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pending = new Map()
  ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()) } catch { return } if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
  const ev = async (exp) => { const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
    if (r.result && r.result.exceptionDetails) return '<<EVAL-ERR ' + String(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text).slice(0, 200) + '>>'
    return r.result?.result?.value }
  const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 90; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3200); return } } }
  const clickJs = async (expr, wait = 700) => { const r = await ev(`(() => { const el = ${expr}; if (!el) return false; el.click(); return true })()`); await sleep(wait); return r }
  const clickTab = async (i) => { await ev(`(() => { const t = [...document.querySelectorAll('.rsp-page-tab')][${i}]; if (t) t.click(); return !!t })()`); await sleep(700) }
  const dump = () => ev(DUMP_FN)

  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1400, deviceScaleFactor: 1, mobile: false })
  await nav(`${FRONT}/#/login`)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_login_date', '2026-09-11'); 'ok'`)
  await nav('about:blank')                       // 整页重载,否则被弹回登录页

  // ═══ ① 新增草稿(可编辑态,才能看到「标准库」按钮 + 输入框绑定) ═══
  await nav(`${FRONT}/#/panelx/list/RD_SPEC_DOC`)
  await clickJs(`document.querySelector('.wz-skip')`, 600)
  await clickJs(`[...document.querySelectorAll('.as-side-btn')].find(e => e.textContent.trim() === '新增')`, 2800)
  await clickJs(`document.querySelector('.wz-skip')`, 400)
  const tabs = await ev(`[...document.querySelectorAll('.rsp-page-tab')].map(e => e.textContent.trim())`)
  console.log('页签:', JSON.stringify(tabs))
  ok(Array.isArray(tabs) && tabs.length === 4, `页签仍是 4 页 ${JSON.stringify(tabs)}`)

  const per = {}
  for (let i = 0; i < 4; i++) { await clickTab(i); const d = await dump(); per[i] = d; console.log(`P${i + 1}(${tabs[i]}):`, JSON.stringify(d && { order: d.order, libPicks: d.libPicks, coverH: d.coverH, sheetH: d.sheetH, rows: d.docRows })) }

  const p0 = per[0] || {}
  const want0 = ['COVER', 'DOC:1.适用范围：', 'DOC:2.整体规格参数：', 'DOC:3.产品主要性能：']
  ok(JSON.stringify(p0.order) === JSON.stringify(want0),
    `①第 1 页区块顺序 = 封面 → 1/2/3 三节(页末)\n     期望 ${JSON.stringify(want0)}\n     实际 ${JSON.stringify(p0.order)}`)
  ok(p0.libPicks === 3, `②第 1 页这三节各带「标准库」按钮(libPicks=${p0.libPicks},期望 3)`)

  const p2 = per[2] || {}
  const docOnP3 = (p2.order || []).filter((t) => String(t).startsWith('DOC:'))
  ok(docOnP3.length === 0, `③第 3 页(检验项目及标准)不再出现这三节(DOC: ${JSON.stringify(docOnP3)})`)
  ok((p2.order || []).length === 1 && String(p2.order[0]).startsWith('TABLE:4.产品性能检验项目及检验标准'),
    `④第 3 页从 4.产品性能检验项目及检验标准 开始(实际 ${JSON.stringify(p2.order)})`)

  const p1 = per[1] || {}
  ok(!(p1.order || []).some((t) => String(t).startsWith('DOC:')), `⑤第 2 页(修订记录)不受影响(实际 ${JSON.stringify(p1.order)})`)

  const p3 = per[3] || {}
  ok(JSON.stringify(p3.order) === JSON.stringify(['TABLE:5.关键物料列表📦 从物料清单引用', 'DOC:6.包装方式：', 'DOC:7.运输要求：', 'DOC:8.存储环境：']),
    `⑥第 4 页(成品及包装运输)6/7/8 原样(实际 ${JSON.stringify(p3.order)})`)

  // ═══ ② 截图(第 1 页整页,填入标准库条目前) ═══
  // 注意:captureBeyondViewport 的 clip 用**文档坐标**(不是视口坐标),必须加 scrollX/scrollY,
  // 否则从文档顶部截图 → 纸面底部(封面之下的三节)被裁掉,看着像"三节没渲染"
  await clickTab(0)
  await ev(`window.scrollTo(0, 0)`)
  await sleep(400)
  const rect = await ev(`(() => { const r = document.querySelector('.record-sheet').getBoundingClientRect(); return { x: Math.round(r.x + window.scrollX), y: Math.round(r.y + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) } })()`)
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true,
    clip: { x: rect.x, y: rect.y, width: rect.w, height: Math.min(rect.h, 4000), scale: 1 } })
  const shotPath = path.join(SHOT_DIR, 'spec-page1-after.png')
  if (shot.result && shot.result.data) { fs.writeFileSync(shotPath, Buffer.from(shot.result.data, 'base64')); console.log(`SHOT ${shotPath} ${fs.statSync(shotPath).size} bytes rect=${JSON.stringify(rect)}`) }
  else console.log('SHOT FAIL', JSON.stringify(shot.error || shot).slice(0, 200))

  // ═══ ③ 章节标准库:第 1 页第 1 节「1.适用范围」勾选 → 填入 → 写回同一字段 ═══
  await clickTab(0)
  const opened = await clickJs(`document.querySelectorAll('.rsp-lib-pick')[0]`, 1400)
  const dlg = await ev(`(() => { const d = [...document.querySelectorAll('.el-dialog')].find(x => (x.querySelector('.el-dialog__title') || {}).textContent?.includes('章节标准库')); if (!d) return null
    return { title: d.querySelector('.el-dialog__title').textContent.trim(), items: [...d.querySelectorAll('.slm-text')].map(e => e.textContent.trim()),
      btns: [...d.querySelectorAll('button')].map(b => b.textContent.trim()) } })()`)
  console.log('章节库弹窗:', JSON.stringify(dlg && { title: dlg.title, n: dlg.items.length, first: (dlg.items[0] || '').slice(0, 40), btns: dlg.btns }))
  ok(!!dlg, `⑦点第 1 节「标准库」按钮弹出章节标准库(clicked=${opened})`)
  ok(!!dlg && dlg.items.length > 0, `⑧章节库条目加载(spec.section/${dlg ? dlg.title : '?'} 共 ${dlg ? dlg.items.length : 0} 条)`)
  if (dlg && dlg.items.length) {
    await clickJs(`[...document.querySelectorAll('.el-dialog')].find(x => (x.querySelector('.el-dialog__title')||{}).textContent?.includes('章节标准库')).querySelector('.el-table__body .el-checkbox__original')`, 500)
    const pickBtn = await ev(`(() => { const d = [...document.querySelectorAll('.el-dialog')].find(x => (x.querySelector('.el-dialog__title')||{}).textContent?.includes('章节标准库')); const b = [...d.querySelectorAll('button')].find(x => x.textContent.trim() === '填入'); return b ? { found: true, disabled: b.disabled } : { found: false } })()`)
    console.log('填入按钮:', JSON.stringify(pickBtn))
    ok(!!pickBtn && pickBtn.found && !pickBtn.disabled, `⑨勾选库条目后「填入」可用(${JSON.stringify(pickBtn)})`)
    await clickJs(`[...[...document.querySelectorAll('.el-dialog')].find(x => (x.querySelector('.el-dialog__title')||{}).textContent?.includes('章节标准库')).querySelectorAll('button')].find(b => b.textContent.trim() === '填入')`, 900)
    const applied = await ev(`(() => { const tas = [...document.querySelectorAll('.rsp-doccell textarea')]; const ta = tas.find(t => ((t.closest('.rsp-doccell').querySelector('.rsp-doclabel') || {}).textContent || '').includes('1.适用范围')); return ta ? ta.value : null })()`)
    ok(!!applied && applied.length > 0, `⑩「填入」写回**同一个**头字段(1.适用范围 输入框 = ${JSON.stringify(String(applied).slice(0, 40))})`)
    ok(String(applied) === String(dlg.items[0]), '⑪填入值 = 库条目原文(未串到别的行/键)')
    const others = await ev(`(() => [...document.querySelectorAll('.rsp-doccell')].map(td => ((td.querySelector('.rsp-doclabel')||{}).textContent||'').trim() + '|' + String(td.querySelector('textarea')?.value || '').slice(0, 12)))()`)
    console.log('第 1 页章节行(标签|值):', JSON.stringify(others))
  }
  await clickJs(`[...document.querySelectorAll('.el-dialog__headerbtn')].pop()`, 500)

  // ═══ ④ 打印分页:第 1 页(封面+三节) vs 只有封面(改动前的对照) ═══
  const pdfPages = async (tag, hideDocs) => {
    await ev(`(() => { document.body.classList.add('approval-printing'); ${hideDocs ? "[...document.querySelectorAll('.rsp-doccell')].forEach(td => { td.dataset._hide='1'; td.style.display='none' });" : ''} return 1 })()`)
    await sleep(600)
    const pdf = await send('Page.printToPDF', { printBackground: true, paperWidth: 8.27, paperHeight: 11.69,
      marginTop: 0.315, marginBottom: 0.315, marginLeft: 0.315, marginRight: 0.315, preferCSSPageSize: false })
    await ev(`(() => { document.body.classList.remove('approval-printing'); [...document.querySelectorAll('.rsp-doccell')].forEach(td => { if (td.dataset._hide) td.style.display='' }); return 1 })()`)
    if (!pdf.result || !pdf.result.data) { console.log('PDF FAIL ' + tag, JSON.stringify(pdf.error || {}).slice(0, 160)); return null }
    const buf = Buffer.from(pdf.result.data, 'base64')
    const p = path.join(SHOT_DIR, `spec-page1-${tag}.pdf`)
    fs.writeFileSync(p, buf)
    const n = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length
    console.log(`PRINT ${tag}: pages=${n} pdf=${p} (${buf.length} bytes)`)
    return n
  }
  const nAfter = await pdfPages('after', false)
  const nBefore = await pdfPages('cover-only', true)
  console.log(`打印分页对照:改动前(只有封面)=${nBefore} 页,改动后(封面+三节)=${nAfter} 页`)
  ok(nAfter === 1, `⑫「产品信息」纸面打印 = 1 页(实际 ${nAfter};对照:只有封面 ${nBefore})`)

  // ═══ 收尾:作废本次「新增」造出的草稿(不保存、不留可打开的单) ═══
  // 说明:文书面板的「删除」是软删(单据状态→已作废,列表不再出现),**rd_spec_doc_head 行仍在**;
  // 要彻底清行需按 tools/_cleanup-probe-junk-*.sql 的方式删表行(探针不碰 DB 凭据,只调接口)。
  const draftNo = await ev(`(() => { const n = document.querySelector('.rs-docno-input input') || document.querySelector('.rs-docno-input'); return n ? String(n.value || n.textContent || '').trim() : '' })()`)
  // 规格书封面版式不渲染「单据编号」格(.rs-docno 不存在):单号从列表组件实例的当前行取
  const curNo = await ev(`(() => { const root = document.querySelector('.record-sheet'); if (!root) return ''
    let i = root.__vueParentComponent, d = 0
    while (i && d < 5) { const st = i.setupState || {}; if (st.cur && st.cur['单据编号']) return String(st.cur['单据编号']); i = i.parent; d++ }
    return '' })()`)
  const target = draftNo || curNo
  if (target) {
    const r = await (await fetch(`${API}/api/px/callButton`, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ panelCode: 'RD_SPEC_DOC', buttonName: '删除', formData: { 编号: target }, buttonParam: {} }) })).json()
    console.log(`CLEANUP 作废本次新增草稿 ${target} → ${JSON.stringify(r?.data || r).slice(0, 120)}`)
  } else {
    console.log('CLEANUP 未取到本次新增草稿单号(请人工核对 rd_spec_doc_head 是否有当天草稿)')
  }

  console.log(fails.length ? `RESULT FAIL (${fails.length}): ${fails.join(' | ')}` : 'RESULT ALL PASS')
}
main().catch((e) => { console.error('FAIL', e.message); process.exitCode = 1 })
  .finally(() => { try { ws && ws.close() } catch {} ; try { edge && edge.kill() } catch {} })
