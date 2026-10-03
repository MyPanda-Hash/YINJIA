/**
 * _verify-over-ratio-save.cjs — 生单对话框「超送比例」**改完自动保存**的验证(2026-10-04 用户口径)
 *
 * 断言链:
 *   ① 接口:POST /px/batchFlow/overRatio 落 yj_app_setting.receive_over_ratio,且立刻生效
 *      (改完马上再取 batchFlow/lines,overRatio 就是新值 —— 不能吃 30 秒缓存);
 *   ② 上限:传 0.9 被夹到 0.5(与 overRatio() 同一钳制口径);
 *   ③ 界面:在**生单对话框**里改数字框,**不点任何按钮**,等 2 秒后库里的参数就变了(真自动保存),
 *      且界面出现「已自动保存」回执;
 *   ④ 收尾:把参数**还原**成跑之前的值(别把探针改的比例留给别人)。
 *
 * 用法:node tools/archive/_verify-over-ratio-save.cjs   (env: YJ_HEADLESS=0 可开有头)
 */
'use strict'
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const { createRequire } = require('node:module')

const mssql = createRequire('D:/jdy-sync/package.json')('mssql')
const API = process.env.YJ_API || 'http://127.0.0.1:8090/api'
const BASE = API.replace(/\/api$/, '')
const DB = process.env.YJ_DB || 'HSDZ_MES_TEST'
const PORT = Number(process.env.YJ_CDP_PORT || 9378)
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p))
const HEADLESS = process.env.YJ_HEADLESS !== '0'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fails = 0
const ok = (c, msg) => { console.log(`  ${c ? '[PASS]' : '[FAIL]'} ${msg}`); if (!c) fails++ }
const info = (msg) => console.log(`         ${msg}`)
const N = (v) => (v === null || v === undefined ? null : String(v).trim())

async function main() {
  if (!EDGE) { console.error('未找到 Edge'); process.exit(1) }
  const pool = await new mssql.ConnectionPool({
    server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia', password: 'Yinjia@2026',
    options: { encrypt: false, trustServerCertificate: true },
  }).connect()
  const one = async (s) => ((await new mssql.Request(pool).query(s)).recordset[0]) || null
  const readSetting = async () => N((await one(`SELECT setting_value v FROM yj_app_setting WHERE setting_key=N'receive_over_ratio'`))?.v)

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
  const ORIGINAL = await readSetting()
  console.log(`=== 测试账套 ${DB} / 跑之前 receive_over_ratio = ${ORIGINAL} ===`)

  let edge = null, ws = null
  try {
    // ---------- ① 接口保存 + 立刻生效 ----------
    console.log('\n=== ① 接口:保存比例 → 落库 + 立刻生效(不吃 30s 缓存) ===')
    const saved = await post('/px/batchFlow/overRatio', { overRatio: 0.08 })
    ok(Math.abs(Number(saved['overRatio']) - 0.08) < 1e-9, `接口返回生效比例 0.08(实得 ${saved['overRatio']})`)
    ok(Math.abs(Number(await readSetting()) - 0.08) < 1e-9, `库里 receive_over_ratio = 0.08(实得 ${await readSetting()})`)

    // 找一张已审核采购订单,取 batchFlow/lines 看它回的比例是不是马上就是新值
    let orderNo = null
    for (const r of ((await post('/px/queryFormDataList', { panelCode: 'PU_ORDER', pageNo: 1, pageSize: 200 }))?.list || [])) {
      if (N(r['单据状态']) === '已审核') { orderNo = N(r['单据编号']); break }
    }
    const ls = await post('/px/batchFlow/lines', { sourcePanel: 'PU_ORDER', targetPanel: 'QC_RECV', sourceNo: orderNo })
    ok(Math.abs(Number(ls?.overRatio) - 0.08) < 1e-9,
      `紧接着取的 batchFlow/lines 就按新比例(${orderNo} → overRatio ${ls?.overRatio})`)

    // ---------- ② 上限夹到 50% ----------
    console.log('\n=== ② 上限:传 90% 被夹到 50% ===')
    const capped = await post('/px/batchFlow/overRatio', { overRatio: 0.9 })
    ok(Math.abs(Number(capped['overRatio']) - 0.5) < 1e-9 && Math.abs(Number(await readSetting()) - 0.5) < 1e-9,
      `传 0.9 → 存 0.5(实得 ${await readSetting()})`)

    // ---------- ③ 界面:改数字框,不点按钮也会保存 ----------
    console.log('\n=== ③ 界面:生单对话框里改「超送比例」,不点任何按钮 ⇒ 自动保存 ===')
    await post('/px/batchFlow/overRatio', { overRatio: 0.05 })     // 先归到一个已知值
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-ratio-'))
    const args = ['--no-first-run', '--window-size=1560,980', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank']
    if (HEADLESS) args.unshift('--headless=new')
    edge = spawn(EDGE, args, { stdio: 'ignore' })
    let tab = null
    for (let i = 0; i < 40 && !tab; i++) { await sleep(400); try { tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json() } catch { /* 未就绪 */ } }
    if (!tab) throw new Error('CDP 未就绪')
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
    await send('Page.navigate', { url: `${BASE}/?_boot=1#/panelx/list/PU_ORDER?docNo=${encodeURIComponent(orderNo)}` })
    for (let i = 0; i < 80; i++) { await sleep(300); if (await ev(`document.querySelectorAll('.header-fields .field').length`) > 0) break }
    await sleep(1500)
    await ev(`(function(){
      const g = Array.from(document.querySelectorAll('.tb-group')).find(function(x){
        const n = x.querySelector('.tb-main .act-name'); return n && n.textContent.trim() === '生单' })
      if (!g) return 'no-group'
      const c = g.querySelector('.tb-caret'); (c || g.querySelector('.tb-main')).click(); return 'ok' })()`)
    await sleep(700)
    await ev(`(function(){
      const it = Array.from(document.querySelectorAll('.tb-menu .ctx-item')).find(function(x){ return x.textContent.trim().indexOf('生成送料暂收单') >= 0 })
      if (it) it.click(); return 'ok' })()`)
    let before = null
    for (let i = 0; i < 40; i++) {
      await sleep(400)
      before = await ev(`(function(){ const i = document.querySelector('.bsd-ratio input'); return i ? i.value : null })()`)
      if (before !== null && before !== undefined) break
    }
    info(`弹窗里「超送比例」预填 = ${before}%`)
    ok(N(before) === '5', `预填的就是库里存的 5%(证明"上次改的会被记住";实得 ${JSON.stringify(before)})`)
    const typed = await ev(`(function(){
      const i = document.querySelector('.bsd-ratio input')
      if (!i) return 'no-input'
      i.value = '12'
      i.dispatchEvent(new Event('input', { bubbles: true }))
      i.dispatchEvent(new Event('change', { bubbles: true }))
      return i.value })()`)
    info(`把比例改成 ${typed}%,然后**什么都不点**,等 2.5 秒`)
    await sleep(2500)
    const afterSetting = await readSetting()
    ok(Math.abs(Number(afterSetting) - 0.12) < 1e-9,
      `**没点保存**库里的 receive_over_ratio 已变成 0.12(实得 ${afterSetting})`)
    const badge = await ev(`(function(){
      const el = document.querySelector('.bsd-ratio-saved')
      return el ? el.textContent.trim() : '' })()`)
    info(`界面回执:${JSON.stringify(badge)}`)
    ok(String(badge).length > 0, `界面给了「已自动保存」回执(实得 ${JSON.stringify(badge)})`)
  } finally {
    try { ws?.close() } catch { /* ignore */ }
    try { edge?.kill() } catch { /* ignore */ }
    // ---------- ④ 还原 ----------
    try {
      await post('/px/batchFlow/overRatio', { overRatio: Number(ORIGINAL || 0.05) })
      console.log(`\n已把 receive_over_ratio 还原为 ${await readSetting()}(跑之前是 ${ORIGINAL})`)
    } catch (e) { console.error('还原失败:' + String(e.message).slice(0, 120)) }
    await pool.close()
  }
  console.log(`\n${fails ? `❌ 失败 ${fails} 项` : '✅ 全部通过'}`)
  process.exit(fails ? 1 : 0)
}
main().catch((e) => { console.error('探针异常:' + (e && e.stack || e)); process.exit(1) })
