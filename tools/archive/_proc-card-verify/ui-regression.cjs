/**
 * ui-regression.cjs — 补验 C + 原验证项 9(回归):
 *   C) 生产工单页「追溯」弹窗:质检段能正常显示(Lead 修复后被追溯表已恢复为现役三张检验单)
 *   9) 生产工单 / 工序报工 / 工单排产 三页仍能打开;/api/auth/perms 的 pagePerms 含 PROC_FLOW_CARD
 *
 * 用法: node tools/archive/_proc-card-verify/ui-regression.cjs
 * 产物: shots/regression-*.png、regression-result.json
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const BASE = 'http://127.0.0.1:8090'
const PORT = 9349
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const HERE = __dirname
const SHOTS = path.join(HERE, 'shots')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let fails = 0
const report = { checks: [], errors: [], shots: [] }
function chk(name, cond, detail) {
  report.checks.push({ name, pass: !!cond, detail: detail === undefined ? '' : detail })
  console.log(`  ${cond ? '[PASS]' : '[FAIL]'} ${name}${detail !== undefined && detail !== '' ? '  :: ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''}`)
  if (!cond) fails++
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const login = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const T = login.data.token, user = login.data.user

  // ── 9a) /api/auth/perms:pagePerms 含 PROC_FLOW_CARD ──
  const perms = await (await fetch(BASE + '/api/auth/perms', { headers: { Authorization: `Bearer ${T}` } })).json()
  const pp = perms?.data?.pagePerms || {}
  chk('/api/auth/perms.pagePerms 含 PROC_FLOW_CARD', 'PROC_FLOW_CARD' in pp, `值=${JSON.stringify(pp['PROC_FLOW_CARD'])}（admin=*）`)
  chk('登录用户 pagePerms.PROC_FLOW_CARD 非空(有权限词)', !!(user.pagePerms && 'PROC_FLOW_CARD' in user.pagePerms), JSON.stringify(user.pagePerms?.['PROC_FLOW_CARD']))

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-pfc-reg-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  let ws
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0
    const pending = new Map()
    let phase = 'init'
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
      if (m.method === 'Runtime.exceptionThrown') report.errors.push({ phase, type: 'exception', text: m.params?.exceptionDetails?.exception?.description || m.params?.exceptionDetails?.text })
      if (m.method === 'Runtime.consoleAPICalled' && m.params?.type === 'error') report.errors.push({ phase, type: 'console.error', text: (m.params.args || []).map((a) => a.value ?? a.description).join(' ') })
      if (m.method === 'Network.responseReceived' && m.params?.response?.status >= 400) report.errors.push({ phase, type: 'http' + m.params.response.status, text: m.params.response.url })
    }
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value
    const nav = async (url, wait = 2500) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 60; i++) { await sleep(300); if (await ev('document.readyState') === 'complete') break }
      await sleep(wait)
    }
    const shot = async (name) => {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true })
      fs.writeFileSync(path.join(SHOTS, name), Buffer.from(r.result.data, 'base64'))
      report.shots.push(name)
      console.log('  [shot] ' + name)
    }
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('Log.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })

    await nav(BASE + '/#/login', 800)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(T)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))});
localStorage.setItem('mes_locale', 'zh-CN'); localStorage.setItem('mes_login_date','2026-08-29'); 'ok'`)

    // ── C) 生产工单 → 追溯弹窗 ──
    phase = 'workOrderList'
    // 用页面自带入口参数 ?keyword=<工单号> 打开:它会填关键词并清空默认 15 天日期窗
    // (GD-2026-10-0211 在默认窗口外,但库里有首件/制程/组装三张检验单 —— probe_pick_wo_insp.sql 取证)
    const WO = process.env.WO_KEYWORD || 'GD-2026-10-0211'
    await nav('about:blank', 200)
    await nav(BASE + '/#/prod/plan/workOrderList?keyword=' + encodeURIComponent(WO), 4000)
    for (let i = 0; i < 30 && !(await ev(`document.querySelectorAll('.wol-table .el-table__row').length`)); i++) await sleep(400)
    const rowCount = await ev(`document.querySelectorAll('.wol-table .el-table__row').length`)
    chk('生产工单页打开且有数据行', rowCount > 0, `行数=${rowCount}(keyword=${WO})`)
    await shot('regression-workorder-list.png')
    const targeted = await ev(`(() => {
      const rows=[...document.querySelectorAll('.wol-table .el-table__row')]
      const row=rows.find(r=>r.textContent.includes(${JSON.stringify(WO)}))
      const a=row?.querySelector('.el-link')
      if(!a) return { ok:false, rows: rows.map(r=>r.textContent.replace(/\\s+/g,' ').slice(0,40)).slice(0,5) }
      a.click(); return { ok:true }
    })()`)
    chk('按工单号定位到 ' + WO + ' 并点开追溯', targeted?.ok === true, JSON.stringify(targeted))
    await sleep(4500)
    const dlg = await ev(`(() => {
      const d=[...document.querySelectorAll('.el-dialog')].find(e=>e.offsetParent!==null)
      if(!d) return { open:false }
      const blocks=[...d.querySelectorAll('.wb-block-title')].map(e=>e.textContent.replace(/\\s+/g,' ').trim())
      const qcBlock=[...d.querySelectorAll('.wb-trace-block')].find(b=>/质检数据/.test(b.textContent))
      const qcRows=qcBlock? [...qcBlock.querySelectorAll('.el-table__row')].map(r=>r.textContent.replace(/\\s+/g,' ').trim()) : []
      const qcSummary=qcBlock? (qcBlock.querySelector('.wb-trace-sub')?.textContent||'').replace(/\\s+/g,' ').trim() : ''
      const bodyTxt=(d.textContent||'').replace(/\\s+/g,' ')
      return { open:true, blocks, qcRows, qcSummary, qcCount: qcRows.length,
               hasInvalidObject: /对象名|Invalid object name|qc_mold_insp/i.test(bodyTxt) }
    })()`)
    chk('生产工单页点工单号 → 工单详情·追溯弹窗打开', targeted?.ok === true && dlg?.open === true, JSON.stringify(dlg?.open))
    chk('追溯弹窗无「对象名无效」报错', dlg?.open === true && dlg.hasInvalidObject === false, dlg?.hasInvalidObject)
    chk('追溯弹窗质检段有数据(检验单行 > 0)', (dlg?.qcRows || []).length > 0, `质检行=${(dlg?.qcRows || []).length} 汇总=${dlg?.qcSummary || ''}`)
    const qcTypes = (dlg?.qcRows || []).map((t) => (t.match(/首件检验|制程检验|组装成品检验|成型检验/) || [])[0]).filter(Boolean)
    chk('质检段出现现役检验类型(首件/制程/组装成品)', qcTypes.length > 0, JSON.stringify([...new Set(qcTypes)]))
    console.log('  质检段行示例:', JSON.stringify((dlg?.qcRows || []).slice(0, 3)))
    await shot('regression-workorder-trace.png')
    await ev(`(() => { const b=document.querySelector('.el-dialog__headerbtn'); b?.click(); return !!b })()`)
    await sleep(800)
    report.woTraceDialog = dlg

    // ── 9b) 工序报工 ──
    phase = 'prodReport'
    await nav(BASE + '/#/panelx/list/PROD_REPORT', 3500)
    const reportPage = await ev(`(() => ({
      title: document.title,
      hasTable: !!document.querySelector('.el-table'),
      rows: document.querySelectorAll('.el-table__row').length,
      toolbar: [...document.querySelectorAll('.tools .tb-main .act-name')].map(e=>e.textContent.trim()).slice(0,8),
      body: (document.querySelector('.panelx, .pane, .app-main, main')?.textContent || '').replace(/\\s+/g,' ').slice(0, 120)
    }))()`)
    chk('工序报工页(PROD_REPORT)打开且渲染表格', reportPage?.hasTable === true || (reportPage?.body || '').length > 0, JSON.stringify(reportPage?.toolbar || reportPage?.title))
    await shot('regression-prod-report.png')

    // ── 9c) 工单排产 ──
    phase = 'workOrderBoard'
    await nav(BASE + '/#/prod/plan/workOrderBoard', 3500)
    const boardPage = await ev(`(() => ({
      title: document.title,
      body: (document.querySelector('.app-main, main, .wob')?.textContent || '').replace(/\\s+/g,' ').slice(0, 160),
      rows: document.querySelectorAll('.el-table__row').length,
      cards: document.querySelectorAll('[class*=line], [class*=card]').length
    }))()`)
    chk('工单排产页打开且渲染内容', (boardPage?.body || '').length > 20 || boardPage?.rows > 0, (boardPage?.title || '') + ' rows=' + boardPage?.rows)
    await shot('regression-workorder-board.png')

    report.failCount = fails
    fs.writeFileSync(path.join(HERE, 'regression-result.json'), JSON.stringify(report, null, 2), 'utf8')
    console.log('\n=== 控制台/网络错误 ===')
    console.log(JSON.stringify(report.errors.slice(0, 20), null, 1))
    console.log(`\n[result] 断言 ${report.checks.length} 项,失败 ${fails}`)
    ws.close()
  } finally {
    try { ws && ws.close() } catch {}
    edge.kill()
    await sleep(400)
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
  if (fails > 0) process.exit(1)
}
main().catch((e) => { console.error('[FATAL]', e && e.stack || e); process.exit(2) })
