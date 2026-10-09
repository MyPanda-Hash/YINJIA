/**
 * _probe-rd-flow-ui.cjs —— 立项申请「分发对接人 / 确认责任人」**界面**验收(2026-10-08)
 *
 * 为什么要单独一支:接口探针(_probe-rd-liaison-owner.cjs)只能证明**后端收得住**,
 * 证明不了**界面上点得到、弹窗打得开、账号选得到**。本探针钉三件界面事实:
 *   ① 侧栏出现「分发对接人」「确认责任人」两个按钮(文案 + 置灰态 + 分支 title);
 *   ② 已定级单上「分发对接人」可点、「确认责任人」置灰(顺序守卫在界面上看得见);
 *   ③ 点开「分发对接人」⇒ 弹窗标题对 + 账号下拉是「姓名（账号）」格式。
 *
 * 前置:先造一张**已定级**的立项单(照 _probe-rd-liaison-owner.cjs 的两枪法:
 *   普通用户「保存为草稿」拿编号 → 带编号「保存」= 送审 → 管理员「审批通过」带 项目等级)。
 * 探针跑完写清理 SQL,再手工执行 —— 不留在库里。
 *
 * 账套:默认测试账套 YJ_TEST(断言令牌账套,正式库不碰)。
 * 用法:node tools/archive/_probe-rd-flow-ui.cjs
 */
'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const BASE = process.env.YINJIA_API || 'http://127.0.0.1:8090'
const FACTORY = process.env.FACTORY || 'YJ_TEST'
const EDGE = process.env.EDGE_BIN || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9339
const SHOTS = path.join(__dirname, '_shots')
const TAG = 'PROBE-RDUI-' + Date.now().toString().slice(-6)
const CLEANUP = path.join(__dirname, '_probe-rd-flow-ui-cleanup.sql')

let failed = 0
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => { failed++; console.log('  FAIL ' + m) }
const step = (m) => console.log('\n▶ ' + m)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function login(userName) {
  const r = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName, password: '123456', factory: FACTORY }),
  })).json()
  if (!r?.data?.token) throw new Error(`${userName} 登录失败:${JSON.stringify(r).slice(0, 200)}`)
  if (r.data.user?.factory !== FACTORY) throw new Error(`令牌账套不是 ${FACTORY}(实为 ${r.data.user?.factory}),已中止`)
  return { token: r.data.token, user: r.data.user }
}
function api(t) {
  const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${t}` }
  return { btn: async (panelCode, buttonName, formData) => (await (await fetch(`${BASE}/api/px/callButton`, { method: 'POST', headers: H, body: JSON.stringify({ panelCode, buttonName, formData, buttonParam: {} }) }))).json() }
}

async function main() {
  console.log(`\n=== 立项申请「分发对接人 / 确认责任人」界面验收(账套 ${FACTORY})===`)

  const admin = await login('admin')
  const sales = await login('glm53')
  const A = api(admin.token)
  const S = api(sales.token)
  ok(`登录成功(admin / glm53,账套均为 ${admin.user.factory})`)

  // ════ ① 造一张「审批通过 + 已定级」的单(界面才有可点态) ════
  step('① 造一张已定级的立项单(界面要有可点态才验证得了)')
  const blank = await S.btn('RD_APPROVAL', '保存为草稿', {})
  const no = blank?.data?.['编号']
  if (!no) throw new Error('建立项申请失败:' + JSON.stringify(blank).slice(0, 300))
  await S.btn('RD_APPROVAL', '保存', { 编号: no, 文档编号: TAG, 项目开发目标: '探针-立项流程界面验收' })
  const granted = await A.btn('RD_APPROVAL', '审批通过', { 编号: no, 项目等级: '三级', 审批意见: '探针:界面验收用' })
  console.log(`     单号=${no} 审批通过 code=${granted?.code} ${granted?.message || ''}`)
  const st = (await (await fetch(`${BASE}/api/px/rdFlow/state?docNo=${encodeURIComponent(no)}`, { headers: { Authorization: 'Bearer ' + admin.token } })).json())?.data || {}
  console.log('     ' + JSON.stringify(st))
  if (st.status === '已归档' || st.status === '已审核') ok(`单据已定形:${st.status}(等级 ${st.level})`)
  else bad(`单据状态不符:${st.status}`)
  if (st.canDispatchLiaison === true) ok('后端判定可分发(canDispatchLiaison=true)——界面按钮应为可点')
  else bad(`后端应可分发:${JSON.stringify(st)}`)

  // ════ 起浏览器 ════
  fs.mkdirSync(SHOTS, { recursive: true })
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-rdflow-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1760,1500', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  let ws = null
  try {
    await sleep(3000)
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0
    const pending = new Map()
    ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()) } catch { return } if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (exp) => {
      const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      if (r.result && r.result.exceptionDetails) return '<<EVAL-ERR ' + r.result.exceptionDetails.text + '>>'
      return r.result && r.result.result ? r.result.result.value : undefined
    }
    const nav = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 90; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3400); return } }
    }
    const shot = async (tag) => {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
      if (!r.result?.data) return null
      const f = path.join(SHOTS, `rdflow-${tag}.png`)
      fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'))
      return f
    }
    const dismissInit = () => ev(`(function(){ var ds=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.getBoundingClientRect().height>0})
      for (var i=0;i<ds.length;i++){ var t=(ds[i].innerText||'')
        if (t.indexOf('初始化')>=0){ var bs=[].slice.call(ds[i].querySelectorAll('button,span,a'))
          for (var j=0;j<bs.length;j++){ if((bs[j].textContent||'').trim()==='下次再说'){ bs[j].click(); return 'dismissed' } } } }
      return 'none' })()`)

    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1500, deviceScaleFactor: 1, mobile: false })
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(admin.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(admin.user))}); 'ok'`)
    await nav('about:blank')
    await nav(`${BASE}/#/panelx/list/RD_APPROVAL?docNo=${encodeURIComponent(no)}`)
    await sleep(2000)
    await dismissInit()
    await sleep(1200)

    // ════ ② 侧栏两按钮 ════
    step('② 侧栏两个新按钮(文案 / 置灰 / title)')
    const curNo = await ev(`(function(){ var e=document.querySelector('.doc-chip'); return e?(e.textContent||'').trim():'' })()`)
    console.log(`     顶部单据条 = ${curNo}`)
    const btns = await ev(`(function(){
      return [].slice.call(document.querySelectorAll('.as-side-btn')).filter(function(b){return b.offsetParent})
        .map(function(b){ return { text:(b.textContent||'').trim(), disabled:b.classList.contains('disabled'), title:b.getAttribute('title')||'' } }) })()`)
    const all = Array.isArray(btns) ? btns : []
    console.log(`     侧栏 ${all.length} 个按钮:${all.map((b) => b.text).slice(0, 16).join(' | ')}`)
    const lia = all.find((b) => b.text.indexOf('分发对接人') >= 0)
    const own = all.find((b) => b.text.indexOf('确认责任人') >= 0)
    if (lia) ok(`出现「分发对接人」${lia.disabled ? '(置灰)' : '(可点)'}｜title=${lia.title}`)
    else bad(`侧栏没有「分发对接人」;实有:${all.map((b) => b.text).join(' | ')}`)
    if (own) ok(`出现「确认责任人」${own.disabled ? '(置灰)' : '(可点)'}｜title=${own.title}`)
    else bad('侧栏没有「确认责任人」按钮')
    if (lia && lia.disabled === false) ok('已定级单上「分发对接人」可点(与后端 canDispatchLiaison=true 一致)')
    else bad(`已定级单上「分发对接人」应可点:${JSON.stringify(lia)}`)
    if (own && own.disabled === true) ok('未分发对接人时「确认责任人」置灰(顺序守卫在界面可见)')
    else bad(`未分发前「确认责任人」应置灰:${JSON.stringify(own)}`)

    // ════ ③ 点开「分发对接人」弹窗 + 账号下拉 ════
    step('③ 弹窗标题 + 账号下拉格式')
    const opened = await ev(`(function(){
      var b=[].slice.call(document.querySelectorAll('.as-side-btn')).filter(function(x){return x.offsetParent})
        .filter(function(x){ return (x.textContent||'').indexOf('分发对接人')>=0 })[0]
      if(!b) return 'NO_BTN'; if(b.classList.contains('disabled')) return 'DISABLED'; b.click(); return 'CLICKED' })()`)
    await sleep(1500)
    const dlg = await ev(`(function(){
      var ds=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.getBoundingClientRect().height>0})
      var d=ds[ds.length-1]; if(!d) return null
      return { title:(d.querySelector('.el-dialog__title')||{}).textContent||'', text:(d.innerText||'').replace(/\\s+/g,' ').slice(0,200) } })()`)
    console.log(`     点击=${opened} 弹窗=${JSON.stringify(dlg)}`)
    if (opened !== 'CLICKED') bad(`按钮点不开(状态 ${opened})`)
    else if (dlg && dlg.title.includes('分发对接人')) ok(`弹窗标题 = ${dlg.title}`)
    else bad(`弹窗标题不符:${dlg?.title}`)

    const selOpened = await ev(`(function(){
      var ds=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.getBoundingClientRect().height>0})
      var d=ds[ds.length-1]; if(!d) return 'NO_DLG'
      var w=d.querySelector('.el-select__wrapper') || d.querySelector('.el-select')
      if(!w) return 'NO_SELECT'; w.click(); return 'OPENED' })()`)
    await sleep(1000)
    const items = await ev(`[].slice.call(document.querySelectorAll('.el-select-dropdown__item')).map(function(x){return (x.textContent||'').trim()}).filter(function(t){return t}).slice(0,8)`)
    console.log(`     账号下拉(${selOpened})前 8 项 = ${JSON.stringify(items)}`)
    if (Array.isArray(items) && items.length && items.every((t) => /（.+）$/.test(t))) ok(`账号项 = 姓名（账号）格式,共 ${items.length} 项可见`)
    else bad(`账号下拉不符:${JSON.stringify(items)}`)
    const f1 = await shot('liaison-dialog')
    console.log(`     截图:${f1}`)
  } finally {
    if (ws) try { ws.close() } catch { /* ignore */ }
    edge.kill()
  }

  fs.writeFileSync(CLEANUP, `/* 探针清理:立项流程**界面**验收(_probe-rd-flow-ui.cjs) */
USE HSDZ_MES_TEST; SET NOCOUNT ON;
DECLARE @docs TABLE (no nvarchar(120) PRIMARY KEY);
INSERT INTO @docs (no) SELECT 单据编号 FROM rd_approval WHERE 文档编号 = N'${TAG}';
DELETE FROM yj_message            WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM yj_form_approval      WHERE panel_code = N'RD_APPROVAL' AND form_no IN (SELECT no FROM @docs);
DELETE FROM yj_doc_modify_log     WHERE panel_code = N'RD_APPROVAL' AND doc_no IN (SELECT no FROM @docs);
DELETE FROM yj_doc_status         WHERE panel_code = N'RD_APPROVAL' AND doc_no IN (SELECT no FROM @docs);
DELETE FROM rd_approval_detail    WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM rd_approval           WHERE 单据编号 IN (SELECT no FROM @docs);
SELECT N'立项申请残留' AS 检查, CAST(COUNT(*) AS nvarchar) AS n FROM rd_approval WHERE 文档编号 = N'${TAG}';
`, 'utf8')
  console.log(`\n  --   清理 SQL:${CLEANUP}(单号 ${no} / 文档编号 ${TAG})`)
  console.log(failed ? `\n${failed} 项断言失败` : '\nALL PASSED')
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('探针异常:', e.message); process.exit(1) })
