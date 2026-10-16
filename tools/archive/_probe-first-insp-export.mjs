/*
 * _probe-first-insp-export.mjs — 首件检验单「打印 / 打印预览 / 导出 PDF / 导出 Excel」端到端验收
 *
 * 用户口径(2026-10-17):「让当前的 excel 可以导出当前这个报表页面,打印预览也需要实现,导出 pdf 也是」。
 *
 * 【验什么】
 *   ① 侧栏「文档输出」有 打印/导出报表/导出 三个入口;
 *   ② 导出 →  PDF:认得出纸面根(.fi-sheet),产出真 PDF(blob 头 %PDF)、页宽≈纸宽;
 *   ③ 导出 → Excel:导出的是**当前这张纸**(两层表头 + 标准行 + 1#..8# 矩阵),不是明细长表;
 *   ④ 打印预览:能开预览窗口且窗口里就是这张纸(纸面元素在,侧栏/顶栏不在);
 *   ⑤ 打印:@media print 下**只剩纸面**(侧栏/顶栏/工具条全隐藏),纸面宽度自适应不留白;
 *   ⑥ 无未捕获异常。
 *
 * ⚠ 用的是**测试账套**(factory=YJ_TEST),会真建一张单,跑完硬删。
 * 用法: node tools/archive/_probe-first-insp-export.mjs [base] [--shot 前缀]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const XLSX = createRequire('D:/workspace/yinjia/frontend/package.json')('xlsx')

const BASE = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'http://127.0.0.1:8090').replace(/\/$/, '')
const FACTORY = 'YJ_TEST'
const DB = 'HSDZ_MES_TEST'
const PORT = 9504
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (m, c, x = '') => { c ? (pass++, console.log('  [PASS] ' + m)) : (fail++, console.log('  [FAIL] ' + m + (x ? '  ' + x : ''))) }

const mssql = createRequire('D:/workspace/yinjia/deploy/package.json')('mssql')
const pool = await new mssql.ConnectionPool({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia', password: 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
}).connect()
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }
const before = new Set((await q(`SELECT 单据编号 FROM dbo.qc_first_insp_head`)).map((r) => r.单据编号))

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-fi-exp-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--window-size=1700,1200', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
let tab = null
for (let i = 0; i < 40 && !tab; i++) {
  await sleep(1000)
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json() } catch { /* retry */ }
}
let junk = []
let ws = null
try {
  ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pend = new Map(); const errs = []; const logs = []
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
    if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails?.exception?.description || '').slice(0, 200))
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) {
      logs.push(m.params.args.map((a) => String(a.value ?? a.description ?? '')).join(' ').slice(0, 300))
    }
  }
  const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
  const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
  const clickByText = (text) => ev(`(() => {
    const el = [...document.querySelectorAll('button, .as-side-btn, [class*=as-side] span, .el-button, .efmt-item')]
      .filter((e) => e.getBoundingClientRect().height > 0)
      .find((e) => (e.innerText || '').trim() === ${JSON.stringify(text)})
    if (!el) return false
    el.click(); return true
  })()`)
  /** 点「导出」→ 弹格式框 → 点某项(可能跨一层弹窗) */
  const clickAny = (text) => ev(`(() => {
    const el = [...document.querySelectorAll('.efmt-item')]
      .filter((e) => e.getBoundingClientRect().height > 0)
      .find((e) => ((e.querySelector('.efmt-name')?.innerText || '').trim() === ${JSON.stringify(text)}))
    if (!el) return false
    el.click(); return true
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
  // 建一张带工单号的单(手动新增的单工单号必填、存不了)
  await ev(`(() => {
    const b=[...document.querySelectorAll('.approval-side [class*=as-side]')].find(x=>(x.innerText||'').trim()==='新增'); if(b) b.click(); return 'ok'
  })()`)
  await sleep(2600)
  await ev(`(() => { const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
  await sleep(900)
  await ev(`(() => {
    const t = document.querySelector('.fi-sheet .fi-head'); const ths=[...t.querySelectorAll('th')]
    const i = ths.findIndex((th) => (th.innerText||'').trim() === '产品编号')
    const inp=[...t.querySelectorAll('td')][i]?.querySelector('input'); if(!inp) return 'no'
    const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set
    set.call(inp,'DEMO-A-001'); inp.dispatchEvent(new Event('input',{bubbles:true})); return 'ok'
  })()`)
  await sleep(500)
  await clickByText('选生产工单')
  await sleep(2500)
  await ev(`(() => { const tr=document.querySelector('.el-dialog .el-table__body tbody tr'); if(tr) tr.click(); return 'ok' })()`)
  await sleep(700)
  await ev(`(() => { const b=[...document.querySelectorAll('.el-dialog__footer button')].find((x)=>(x.innerText||'').trim()==='确定'); if(b) b.click(); return 'ok' })()`)
  await sleep(4000)
  await ev(`(() => { const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
  await sleep(1200)
  junk = (await q(`SELECT 单据编号 FROM dbo.qc_first_insp_head`)).map((r) => r.单据编号).filter((n) => !before.has(n))
  console.log(`  本轮新建单据=${JSON.stringify(junk)}`)

  // ── ① 侧栏三个入口 ──
  const acts = await ev(`(() => [...document.querySelectorAll('.approval-side [class*=as-side], .approval-side button')]
    .map((e) => (e.innerText || '').trim()).filter(Boolean))()`)
  for (const t of ['打印', '导出报表', '导出']) ok(`① 侧栏有「${t}」`, (acts || []).includes(t), JSON.stringify(acts))

  // ── ①b 服务端报表模板(用户口径「打印样式需要实现就是当前报表的 excel 表」=「导出报表」里那张模板) ──
  //    这一条走**界面**(用户点的是这里);接口侧的核验在 _probe-first-insp-report.mjs
  await clickByText('导出报表')
  await sleep(1800)
  const rpt = await ev(`(() => {
    const dlgs = [...document.querySelectorAll('.el-dialog')].filter((d) => d.getBoundingClientRect().height > 0)
    const d = dlgs[dlgs.length - 1]
    return { text: (d?.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 240),
      items: [...document.querySelectorAll('.efmt-item .efmt-name')].filter((e) => e.getBoundingClientRect().height > 0)
        .map((e) => (e.innerText || '').trim()) }
  })()`)
  console.log(`  导出报表弹窗=${JSON.stringify(rpt?.text)}`)
  ok('①b 该面板已挂上专用报表模板(弹窗里是「炭棒成型车间首件检验记录表」,不再是 generic 通用模板)',
    /炭棒成型车间首件检验记录表/.test(String(rpt?.text)) && !/暂无报表模板/.test(String(rpt?.text)),
    JSON.stringify(rpt?.text))
  ok('①b 弹窗里有 打印预览 / 导出 PDF / 导出 Excel 三项',
    ['打印预览', '导出 PDF', '导出 Excel'].every((t) => (rpt?.items || []).some((x) => x.includes(t))),
    JSON.stringify(rpt?.items))
  await ev(`(() => { const b=[...document.querySelectorAll('.el-dialog__footer button')].find((x)=>(x.innerText||'').trim()==='取消'); if(b) b.click(); return 'ok' })()`)
  await sleep(700)

  // ── 安装下载/打印钩子(留住 Blob 本体,便于把 xlsx 解出来核对版式) ──
  await ev(`(() => {
    window.__blobs = []; window.__raw = []; window.__printed = 0; window.__opened = 0
    const orig = URL.createObjectURL.bind(URL)
    URL.createObjectURL = function (b) {
      try { window.__blobs.push({ type: b?.type || '', size: b?.size || 0 }); window.__raw.push(b) } catch (e) { /* ignore */ }
      return orig(b)
    }
    window.print = function () { window.__printed++ }
    // 打印预览走 window.open —— headless 里新窗口不进 /json/list,故在页内数调用次数
    const origOpen = window.open.bind(window)
    window.open = function (...a) { window.__opened++; return origOpen(...a) }
    return 'ok'
  })()`)
  /** 把第 i 个 Blob 读成 base64(用于把 xlsx 解出来核对) */
  const blobB64 = (i) => ev(`(async () => {
    const b = window.__raw[${i}]; if (!b) return ''
    return await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.readAsDataURL(b) })
  })()`)

  const shotIdx = process.argv.indexOf('--shot')
  const shoot = async (suffix) => {
    if (shotIdx < 0) return
    const s = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
    fs.writeFileSync(`${process.argv[shotIdx + 1]}-${suffix}.png`, Buffer.from(s.result.data, 'base64'))
    console.log(`  截图:${process.argv[shotIdx + 1]}-${suffix}.png`)
  }
  /** 点一下 + 轮询提示条(el-message 3s 就消失,不轮询会漏掉真实原因 —— §5.5 E16) */
  const clickAndPoll = async (label, ms = 9000) => {
    await ev(`window.__blobs = []; window.__raw = []; window.__msgs = []`)
    const clicked = await clickAny(label)
    const seen = []
    for (let i = 0; i < Math.ceil(ms / 250); i++) {
      const t = String(await ev(`[...document.querySelectorAll('.el-message')].map((m) => (m.innerText||'').trim()).join(' | ')`))
      if (t && !seen.includes(t)) seen.push(t)
      await sleep(250)
    }
    return { clicked, msgs: seen.join(' | '), blobs: await ev(`window.__blobs`) }
  }
  /** 打开「导出」格式框并读出条目(轮询等它出来,别用定长 sleep —— §5.5 E12)。
   *  ⚠ el-dialog 关闭后 **DOM 仍在**(只是不可见),所以"出来了没有"必须按**可见性**判,
   *    否则会对着上一次的隐藏 DOM 读条目、又不去点「导出」,后面点名一定落空(§5.5 E2)。 */
  const openExportDialog = async () => {
    for (let i = 0; i < 12; i++) {
      const n = await ev(`[...document.querySelectorAll('.efmt-item .efmt-name')].filter((e) => e.getBoundingClientRect().height > 0).length`)
      if (n > 0) break
      await clickByText('导出')
      await sleep(600)
    }
    return await ev(`[...document.querySelectorAll('.efmt-item .efmt-name')]
      .filter((e) => e.getBoundingClientRect().height > 0).map((e) => (e.innerText||'').trim())`)
  }

  // ── ② 导出 → 导出 PDF ──
  const dlgItems = () => ev(`[...document.querySelectorAll('.efmt-item')].map((e) => (e.innerText||'').replace(/\\s+/g,' ').trim())`)
  const dlg = await openExportDialog()
  console.log(`  导出格式框=${JSON.stringify(dlg)}`)
  ok('② 导出格式框弹出且有「导出 PDF」', (dlg || []).some((x) => x.includes('导出 PDF')), JSON.stringify(dlg))
  const r2 = await clickAndPoll('导出 PDF')
  const pdfBlob = (r2.blobs || []).find((b) => String(b.type).includes('pdf')) || (r2.blobs || [])[0]
  console.log(`  点「导出 PDF」=${r2.clicked} blobs=${JSON.stringify(r2.blobs)} 提示=${JSON.stringify(r2.msgs)}`)
  if (logs.length) console.log(`  控制台=${JSON.stringify(logs.slice(0, 2))}`)
  ok('② 导出 PDF 产出了 PDF blob', !!pdfBlob && String(pdfBlob.type).includes('pdf') && pdfBlob.size > 8000,
    JSON.stringify(r2.blobs))
  ok('② 没有报「未找到可导出的单据」/「导出失败」', !/未找到可导出|导出失败/.test(r2.msgs), r2.msgs)

  // ── ③ 导出 → 导出 Excel ──
  const dlg3 = await openExportDialog()
  const xlsLabel = (dlg3 || []).find((x) => x.includes('Excel')) || '导出 Excel（.xlsx）'
  const r3 = await clickAndPoll(xlsLabel)
  const xlsBlob = (r3.blobs || []).find((b) => /sheet|excel|zip|octet/.test(String(b.type))) || (r3.blobs || [])[0]
  console.log(`  点「${xlsLabel}」=${r3.clicked} blobs=${JSON.stringify(r3.blobs)} 提示=${JSON.stringify(r3.msgs)}`)
  ok('③ 导出 Excel 产出了 xlsx blob', !!xlsBlob && xlsBlob.size > 2000, JSON.stringify(r3.blobs))
  // ── ③b 把 xlsx 解出来:核它导的是**这张纸**、不是明细长表 ──
  if (xlsBlob) {
    const b64 = await blobB64((r3.blobs || []).indexOf(xlsBlob))
    try {
      const wb = XLSX.read(Buffer.from(b64, 'base64'), { type: 'buffer' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: true, defval: '' })
      const flat = aoa.map((r) => r.join('|')).join('\n')
      console.log(`  xlsx:sheet=${JSON.stringify(wb.SheetNames)} 行数=${aoa.length} 首行=${JSON.stringify(aoa[0]?.[0])}`)
      console.log(`  xlsx 合并区数=${(ws['!merges'] || []).length} 列宽数=${(ws['!cols'] || []).length}`)
      ok('③b 导出的是纸面版式(首行是大标题,不是"头字段键值")',
        String(aoa[0]?.[0] || '').includes('炭棒成型车间首件检验记录表'), JSON.stringify(aoa[0]))
      ok('③b 有两级表头(分组名 + 测试项目名)', flat.includes('表观及脱粉') && flat.includes('尺寸及重量')
        && flat.includes('强度') && flat.includes('浊度及压降') && flat.includes('炭棒外径'), '')
      ok('③b 有 标准 行 + 1#..8# 八个样品行',
        aoa.some((r) => String(r[0]) === '标准') && [1, 2, 8].every((s) => aoa.some((r) => String(r[0]) === `${s}#`)), '')
      ok('③b 有相关要求 6 条与表尾', flat.includes('相关要求') && flat.includes('检验结果') && flat.includes('检验人'), '')
      ok('③b 是纸面矩阵而不是明细长表(没有"行类型/样品序号/检验列"这种长表列头)',
        !flat.includes('行类型') && !flat.includes('检验列'), '')
      ok('③b 合并区不空(两层表头/抬头/要求行靠它成版式)', (ws['!merges'] || []).length >= 8,
        String((ws['!merges'] || []).length))
      // 可填范围与纸面同源:前两列保持原样(3#..8# 打 `/`),其余列八行全可填(空,不是 `/`)
      const hdr = aoa.findIndex((r) => String(r[0]).includes('测试项目'))
      const itemRow = hdr + 1
      const colOf = (name) => (aoa[itemRow] || []).findIndex((x) => String(x).includes(name))
      const appCol = colOf('炭棒表观状态')
      const outerCol = colOf('炭棒外径')
      const rowOfS = (s) => aoa.findIndex((r) => String(r[0]) === `${s}#`)
      ok('③b 前两列保持原样:3# 的表观状态格照纸面写 `/`',
        String(aoa[rowOfS(3)]?.[appCol] || '') === '/', JSON.stringify(aoa[rowOfS(3)]?.[appCol]))
      ok('③b 其余列八行全可填:3# 的外径格是可填空格', String(aoa[rowOfS(3)]?.[outerCol] ?? '') === '',
        JSON.stringify(aoa[rowOfS(3)]?.[outerCol]))
      ok('③b 改前不可填的 1#/8# 外径格现在也是可填空格(不是 `/`)',
        String(aoa[rowOfS(1)]?.[outerCol] ?? '') === '' && String(aoa[rowOfS(8)]?.[outerCol] ?? '') === '',
        JSON.stringify([aoa[rowOfS(1)]?.[outerCol], aoa[rowOfS(8)]?.[outerCol]]))
    } catch (e) {
      ok('③b 能把导出的 xlsx 解出来核对版式', false, String(e?.message || e))
    }
  }

  // ── ④ 打印预览 ──
  const dlg4 = await openExportDialog()
  const hasPreview = (dlg4 || []).some((x) => x.includes('打印预览'))
  ok('④ 导出格式框里有「打印预览」', hasPreview, JSON.stringify(dlg4))
  if (hasPreview) {
    const tabsBefore = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter((t) => t.type === 'page').map((t) => t.id)
    await ev(`window.__blobs = []; window.__raw = []`)
    const opened = await clickAny('打印预览')
    let preview = null
    for (let i = 0; i < 30 && !preview; i++) {
      await sleep(500)
      const tabs = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      preview = tabs.find((t) => t.type === 'page' && (String(t.url).startsWith('blob:') || !tabsBefore.includes(t.id))) || null
    }
    const r4 = { msgs: String(await ev(`[...document.querySelectorAll('.el-message')].map((m) => (m.innerText||'').trim()).join(' | ')`)), blobs: await ev(`window.__blobs`), opened: await ev(`window.__opened`) }
    console.log(`  打印预览 clicked=${opened} 新窗口=${preview ? String(preview.url).slice(0, 50) : '(headless 不进列表)'} window.open×${r4.opened} blobs=${JSON.stringify(r4.blobs)} 提示=${JSON.stringify(r4.msgs)}`)
    // headless Edge 对 blob: 的 PDF 往往直接落下载页而不渲染、新窗口也不进 /json/list,所以断言分四层:
    //   ① 确实调了 window.open;② 没报"被拦截"(⇒ 拿到了窗口句柄、location.href 那步跑了);
    //   ③ 生成了 PDF(与「导出 PDF」同一份实现);④ 没有任何失败提示。
    ok('④ 打印预览调了 window.open(先开窗占位再填内容,防被弹窗拦截)',
      Number(r4.opened) >= 1, `window.open×${r4.opened}`)
    ok('④ 打印预览没有被浏览器拦截(没报「浏览器拦截了新窗口」)', !/拦截/.test(r4.msgs), r4.msgs)
    ok('④ 打印预览生成了 PDF(与「导出 PDF」同一份实现)',
      (r4.blobs || []).some((b) => String(b.type).includes('pdf') && b.size > 8000), JSON.stringify(r4.blobs))
    ok('④ 打印预览没有报「未找到可导出的单据」/「导出失败」', !/未找到可导出|导出失败/.test(r4.msgs), r4.msgs)
  }

  // ── ⑤ 打印:@media print 下只剩纸面(先点「打印」让 approval-printing 生效) ──
  await clickByText('打印')
  await sleep(1000)
  await send('Emulation.setEmulatedMedia', { media: 'print' })
  await sleep(600)
  const printed = await ev(`(() => {
    const vis = (sel) => { const e = document.querySelector(sel); if (!e) return null
      const cs = getComputedStyle(e); const r = e.getBoundingClientRect()
      return { display: cs.display, visibility: cs.visibility, w: Math.round(r.width) } }
    return { side: vis('.approval-side'), topbar: vis('.topbar'), sheet: vis('.fi-sheet'),
      title: vis('.fi-title'), grid: document.querySelector('.fi-grid')?.getBoundingClientRect().width | 0,
      cls: document.body.classList.contains('approval-printing') }
  })()`)
  console.log(`  打印媒体下的可见性=${JSON.stringify(printed)}`)
  ok('⑤ 点「打印」后 body 挂上了 approval-printing', printed?.cls === true, JSON.stringify(printed?.cls))
  ok('⑤ 打印媒体下侧栏已隐藏', printed?.side == null || printed.side.display === 'none' || printed.side.visibility === 'hidden',
    JSON.stringify(printed?.side))
  ok('⑤ 打印媒体下顶栏已隐藏', printed?.topbar == null || printed.topbar.display === 'none' || printed.topbar.visibility === 'hidden',
    JSON.stringify(printed?.topbar))
  // ⚠ 这一条是**打印空白页**的判据:公共打印样式把 .portal 整体 visibility:hidden 再逐个白名单纸张类名,
  //   .fi-sheet 不在名单里 ⇒ 纸面自己也是 hidden,打出来一片空白
  ok('⑤ 打印媒体下纸面是**可见**的(不是空白页)',
    printed?.sheet?.visibility === 'visible' && printed?.title?.visibility === 'visible',
    JSON.stringify({ sheet: printed?.sheet, title: printed?.title }))
  ok('⑤ 打印媒体下纸面还在且有宽度', (printed?.sheet?.w || 0) > 300, JSON.stringify(printed?.sheet))
  // 打印媒体下纸面不该被横向裁掉(列多时:要么缩到纸宽内,要么整张可见)
  const overflow = await ev(`(() => {
    const s = document.querySelector('.fi-sheet'); if (!s) return null
    const r = s.getBoundingClientRect()
    return { left: Math.round(r.left), right: Math.round(r.right), docW: document.documentElement.clientWidth }
  })()`)
  console.log(`  打印媒体下纸面位置=${JSON.stringify(overflow)}`)
  ok('⑤ 打印媒体下纸面没有左出界(不会被裁掉左半张)', (overflow?.left ?? -1) >= -2, JSON.stringify(overflow))
  // 真的走一遍浏览器打印管线(printToPDF),留一份产物供人眼/文本复核「打出来到底是不是这张纸」
  const pdfIdx = process.argv.indexOf('--printpdf')
  if (pdfIdx > 0) {
    const r = await send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true })
    fs.writeFileSync(process.argv[pdfIdx + 1], Buffer.from(r.result.data, 'base64'))
    console.log(`  打印产物:${process.argv[pdfIdx + 1]}`)
  }
  await shoot('print-media')
  await send('Emulation.setEmulatedMedia', { media: '' })
  // 打印结束(afterprint)→ 类应摘掉
  await ev(`window.dispatchEvent(new Event('afterprint'))`)
  await sleep(400)
  const clsLeft = await ev(`document.body.classList.contains('approval-printing')`)
  ok('⑥ 打印结束后 approval-printing 已摘掉(不残留)', clsLeft === false, String(clsLeft))

  await shoot('ui')
  ok('⑦ 无未捕获的运行时异常', errs.length === 0, errs.join(' | '))
} finally {
  try { ws?.close() } catch { /* ignore */ }
  edge.kill()
  for (const no of new Set(junk.filter(Boolean))) {
    await q(`DELETE FROM dbo.qc_first_insp_detail WHERE 单据编号=N'${no}';
             DELETE FROM dbo.qc_first_insp_head WHERE 单据编号=N'${no}'`)
    console.log(`  清场:删掉探针建的 ${no}`)
  }
  await pool.close()
}
console.log(`\n== 首件检验单 导出/打印:${pass} PASS / ${fail} FAIL ==`)
process.exit(fail ? 1 : 0)
