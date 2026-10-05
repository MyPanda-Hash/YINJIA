/**
 * _shot-two-layer-dialog.cjs — 给「生单」弹窗**上下两层**版面留一张图(人工看版面用,不做断言)
 *
 * 为什么要截图:单元/探针只验数据口径,版面(两张表是否上下排、下层标题是否可见、是否挤出对话框)
 * 只能看像素。跑法:
 *   node tools/archive/_shot-two-layer-dialog.cjs
 * 产物:_shot-two-layer-dialog.png(本目录);跑完自己清理打印记录与生成的暂收单。
 */
'use strict'
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const { createRequire } = require('node:module')

const mssql = createRequire('D:/jdy-sync/package.json')('mssql')
const API = process.env.YJ_API || 'http://127.0.0.1:8090/api'
const BASE = API.replace(/\/api$/, '')
const DB = process.env.YJ_DB || 'HSDZ_MES_TEST'
const PORT = Number(process.env.YJ_CDP_PORT || 9376)
const OUT = path.join(__dirname, '_shot-two-layer-dialog.png')
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const N = (v) => (v === null || v === undefined ? null : String(v).trim())

async function main() {
  const pool = await new mssql.ConnectionPool({
    server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia', password: 'Yinjia@2026',
    options: { encrypt: false, trustServerCertificate: true },
  }).connect()
  const one = async (s) => ((await new mssql.Request(pool).query(s)).recordset[0]) || null

  const lj = await (await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })).json()
  const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + lj.data.token }
  const post = async (url, body) => {
    const j = await (await fetch(API + url, { method: 'POST', headers: H, body: JSON.stringify(body) })).json()
    if (j.code !== 0 && j.code !== 200) throw new Error(`${url} → ${JSON.stringify(j).slice(0, 200)}`)
    return j.data
  }
  const dstr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date()).replace(/-/g, '')
  const MY_BATCH = `版面-${dstr}`
  const get = async (url) => {
    const j = await (await fetch(API + url, { headers: H })).json()
    if (j.code !== 0 && j.code !== 200) throw new Error(`${url} → ${JSON.stringify(j).slice(0, 200)}`)
    return j.data
  }

  // 挑一张有可打量的已审核采购订单,按接口打一张材料码(制造下层隔离行)
  let pick = null
  for (const r of ((await post('/px/queryFormDataList', { panelCode: 'PU_ORDER', pageNo: 1, pageSize: 400 }))?.list || [])) {
    if (N(r['单据状态']) !== '已审核') continue
    const no = N(r['单据编号'])
    let d; try { d = await get('/px/puLabel/dialog?orderNo=' + encodeURIComponent(no)) } catch { continue }
    const line = (d?.lines || []).find((x) => Number(x.剩余可打 || 0) >= 20)
    if (line) { pick = { no, line, dlg: d }; break }
  }
  if (!pick) { console.error('找不到可打印的采购订单'); await pool.close(); process.exit(1) }
  const qty = Math.min(30, Number(pick.line.剩余可打))
  await post('/px/puLabel/print', {
    orderNo: pick.no, batchNo: MY_BATCH,
    lines: [{ 采购订单行id: pick.line.id, 打印数量: qty }],
  })

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-shot-'))
  const args = ['--headless=new', '--no-first-run', '--window-size=1600,1100', `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`, 'about:blank']
  const edge = spawn(EDGE, args, { stdio: 'ignore' })
  let ws
  try {
    let tab = null
    for (let i = 0; i < 40 && !tab; i++) { await sleep(400); try { tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json() } catch { /* 未就绪 */ } }
    ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.onmessage = (d) => {
      let m; try { m = JSON.parse(typeof d.data === 'string' ? d.data : d.data.toString()) } catch { return }
      if (m.method === 'Page.javascriptDialogOpening') { send('Page.handleJavaScriptDialog', { accept: true }); return }
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    }
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value
    await send('Page.enable'); await send('Runtime.enable')
    await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(2500)
    await ev(`(function(){
      localStorage.setItem('mes_token', ${JSON.stringify(lj.data.token)});
      localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lj.data.user || {}))});
      localStorage.setItem('mes_factory', '"YJ_TEST"'); return 'ok' })()`)
    await send('Page.navigate', { url: `${BASE}/?_boot=1#/panelx/list/PU_ORDER?docNo=${encodeURIComponent(pick.no)}` })
    for (let i = 0; i < 80; i++) { await sleep(300); if (await ev(`document.querySelectorAll('.header-fields .field').length`) > 0) break }
    await sleep(1500)
    // 「生单」组:有下拉箭头就点箭头、没有再点主体(与 _verify-pu-label-ui.cjs 同一口径)
    console.log('点击工具栏「生单」:', await ev(`(function(){
      const g = Array.from(document.querySelectorAll('.tb-group')).find(function(x){
        const n = x.querySelector('.tb-main .act-name'); return n && n.textContent.trim() === '生单' })
      if (!g) return 'no-group'
      const c = g.querySelector('.tb-caret')
      if (c) c.click(); else g.querySelector('.tb-main').click()
      return c ? 'caret-clicked' : 'main-clicked' })()`))
    let box = null
    for (let i = 0; i < 50; i++) {
      await sleep(400)
      box = await ev(`(function(){
        const b = document.querySelector('.bsd-printed .el-table')
        if (!b) return null
        const d = document.querySelector('.bsd').closest('.el-dialog')
        const r = (d || document.querySelector('.bsd')).getBoundingClientRect()
        return JSON.stringify({ x: Math.max(0, r.x - 8), y: Math.max(0, r.y - 40), w: Math.min(1600, Math.round(r.width) + 16), h: Math.min(1050, Math.round(r.height) + 60) }) })()`)
      if (box) break
    }
    if (!box) {
      console.log('诊断:工具栏组 =', await ev(`Array.from(document.querySelectorAll('.tb-group .tb-main .act-name')).map(function(x){return x.textContent.trim()}).join(' | ')`))
      console.log('诊断:弹窗数 =', await ev(`document.querySelectorAll('.el-dialog').length`))
      console.log('诊断:.bsd =', await ev(`!!document.querySelector('.bsd')`),
        ' / 下层 =', await ev(`!!document.querySelector('.bsd-printed')`),
        ' / 上层表 =', await ev(`!!document.querySelector('.bsd > .el-table')`))
      console.log('诊断:弹窗文本 =', String(await ev(`(function(){ const d = document.querySelector('.el-dialog'); return d ? d.innerText.slice(0, 300) : '' })()`)).replace(/\n+/g, ' / '))
    }
    const clip = JSON.parse(box || '{}')
    if (!clip.w) { console.error('没等到上下两层都渲染出来(下层表未出现)'); return }
    // ⚠ CDP 的 clip 字段是 width/height,写成 w/h 会报 "Failed to deserialize params.clip.height"
    const shot = await send('Page.captureScreenshot', {
      format: 'png', captureBeyondViewport: true,
      clip: { x: clip.x, y: clip.y, width: clip.w, height: clip.h, scale: 1 },
    })
    if (!shot?.result?.data) { console.error('截图失败:', JSON.stringify(shot).slice(0, 300)); process.exitCode = 1; return }
    fs.writeFileSync(OUT, Buffer.from(shot.result.data, 'base64'))
    console.log('版面截图 →', OUT, `(${clip.w}x${clip.h})`)
    // 版面几何自检(看不到图时用数字说话):下层必须**在上层下方**、两层都在对话框内、上层高度受限(不把弹窗撑破)
    const geo = JSON.parse(await ev(`(function(){
      const r = function(sel){ const e = document.querySelector(sel); if (!e) return null
        const b = e.getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), w: Math.round(b.width), h: Math.round(b.height) } }
      const dlg = document.querySelector('.el-dialog')
      const body = document.querySelector('.bsd')
      return JSON.stringify({ dlg: r('.el-dialog'), top: r('.bsd > .el-table'), 标题: r('.bsd-printed-title'),
        下: r('.bsd-printed .el-table'), bodyH: body ? Math.round(body.getBoundingClientRect().height) : null,
        标题文本: (document.querySelector('.bsd-printed-title') || {}).innerText,
        弹窗高: dlg ? Math.round(dlg.getBoundingClientRect().height) : null }) })()`) || '{}')
    console.log('几何:', JSON.stringify(geo))
    const inDlg = geo.dlg && geo.top && geo.下 && geo.下.b <= geo.dlg.b && geo.top.t >= geo.dlg.t
    console.log(`  ${geo.下 && geo.top && geo.下.t >= geo.top.b ? '✔' : '✘'} 下层表在上层表**下方**(上 ${geo.top?.b} → 下 ${geo.下?.t})`)
    console.log(`  ${geo.下 && geo.top && !(geo.下.t < geo.top.b && geo.下.l > geo.top.l) ? '✔' : '✘'} 两层是**上下排**(不是并排):上表底 ${geo.top?.b} / 下表顶 ${geo.下?.t}`)
    console.log(`  ${inDlg ? '✔' : '✘'} 两层都在对话框内(弹窗 ${geo.dlg?.t}~${geo.dlg?.b},上层表高 ${geo.top?.h}、下层 ${geo.下?.h})`)
    console.log(`  ${geo.标题?.h > 0 ? '✔' : '✘'} 下层标题可见:「${geo.标题文本}」`)
  } finally {
    try { ws?.close() } catch { /* ignore */ }
    try { edge.kill() } catch { /* ignore */ }
    const pd = await one(`SELECT TOP 1 单据编号 no FROM bd_pu_label WHERE 采购订单号=N'${pick.no}' AND 批次号=N'${MY_BATCH}' AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id DESC`)
    if (pd?.no) { try { await post('/px/puLabel/void', { docNo: N(pd.no) }); console.log('已作废打印记录', pd.no) } catch (e) { console.log('作废失败:', e.message) } }
    await pool.close()
  }
}
main().catch((e) => { console.error('异常:' + (e && e.stack || e)); process.exit(1) })
