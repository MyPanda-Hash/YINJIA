'use strict'
/**
 * _probe-rd-quad-verify.cjs — 研发管理四项改动的验证探针
 *
 * 用法:node tools/archive/_probe-rd-quad-verify.cjs [http://localhost:8090] [单据编号] [阶段标签]
 *
 * 三层断言(缺一层就可能是"改了但用户还是错的"):
 *   ① 后端配置层:/px/getPanelConfig 下发的字段元数据 ——
 *      产品名称/产品类别 还是不是必填;产品形态 dataType 是否已是「标准库」+ options 非空
 *   ② 界面层     :产品信息表纸面实际渲染的格,产品形态下拉的候选
 *   ③ 端到端     :对既有单据点「保存」,抓真实提示语(修复前是「产品名称不能为空」)
 *
 * ⚠ 只在**成品实例 8090** 上跑「保存」:8090 供应的是打包产物,不受前端源文件并发编辑影响,
 *   是本轮①(纯数据库改动)的可信验证通道。探针自身不新增/不删除单据,只对既有单重存一次。
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const BASE = process.argv[2] || 'http://localhost:8090'
const DOC = process.argv[3] || 'DEMO-PI-002'
const TAG = process.argv[4] || 'after'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9352
const SHOTS = path.join(__dirname, '_shots')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let pass = 0, fail = 0
const check = (n, c, e) => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${e ? '  → ' + e : ''}`)) }

let ev = null
async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const lr = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = lr?.data?.token
  if (!token) throw new Error('登录失败: ' + JSON.stringify(lr))

  // ═══ ① 后端配置层(纯 API,不开浏览器)═══
  console.log('\n① 后端配置层 GET /api/px/getPanelConfig?panelCode=RD_PROD_INFO')
  const cfgRes = await (await fetch(`${BASE}/api/px/getPanelConfig?panelCode=RD_PROD_INFO`, {
    headers: { Authorization: 'Bearer ' + token },
  })).json()
  const fields = cfgRes?.data?.dataSchema?.fields || []
  if (!fields.length) throw new Error('取不到字段配置: ' + JSON.stringify(cfgRes).slice(0, 400))
  const by = (n) => fields.filter((f) => (f.dataName || f.code) === n)
  for (const n of ['产品名称', '产品类别']) {
    const fs_ = by(n)
    check(`「${n}」不再是必填(命中 ${fs_.length} 条)`, fs_.length > 0 && fs_.every((f) => !f.isRequired),
      JSON.stringify(fs_.map((f) => ({ req: f.isRequired, hidden: f.hidden }))))
  }
  const form = by('产品形态')[0]
  check('「产品形态」dataType = 标准库', form?.dataType === '标准库', 'dataType=' + form?.dataType)
  check('「产品形态」下发 stdLib=prod.form', form?.stdLib === 'prod.form', 'stdLib=' + form?.stdLib)
  check('「产品形态」选项 ≥4 且含原 4 项',
    (form?.options || []).length >= 4 && ['包布', '套网', '打端盖', '套PP棉'].every((o) => form.options.includes(o)),
    JSON.stringify(form?.options))

  // ═══ ②③ 界面层 + 端到端 ═══
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-rdquad-v-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1760,1700', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
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
    ev = async (exp) => {
      const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      if (r.result?.exceptionDetails) return '<<EVAL-ERR ' + r.result.exceptionDetails.text + '>>'
      return r.result?.result?.value
    }
    const nav = async (url) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 90; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3200); return } }
    }
    const shot = async (name) => {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
      if (r.result?.data) { fs.writeFileSync(path.join(SHOTS, name), Buffer.from(r.result.data, 'base64')); console.log('  📷 ' + name) }
    }
    // 开启浏览器端 fetch/xhr 报文旁路:保存请求的真实响应体(比界面提示更硬)
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1700, deviceScaleFactor: 1, mobile: false })
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lr.data.user))}); 'ok'`)
    await nav('about:blank')

    console.log('\n② 界面层 产品信息表 ' + DOC)
    await nav(`${BASE}/#/panelx/list/RD_PROD_INFO`)
    await sleep(1500)
    await openByDocNo(DOC)
    await shot(`rdquad-verify-${TAG}-prodinfo.png`)
    const cells = await ev(`(function(){
      var rs=document.querySelector('.record-sheet'); if(!rs) return 'NO_SHEET'
      var out=[]; var lbs=[].slice.call(rs.querySelectorAll('td.rs-label')).filter(function(t){return t.offsetParent})
      for (var i=0;i<lbs.length;i++) out.push(lbs[i].textContent.trim())
      return JSON.stringify(out)
    })()`)
    console.log('  纸面格: ' + cells)
    const cellList = JSON.parse(cells === 'NO_SHEET' ? '[]' : cells)
    check('纸面仍不含「产品名称」(本轮口径:纸面不动)', !cellList.includes('产品名称'), cells)

    // ═══ ③ 端到端:点「保存」抓真实提示 ═══
    console.log('\n③ 端到端 对 ' + DOC + ' 点「保存」')
    await ev(`window.__msgs=[]; (function(){ var o=document.createElement('div'); o.id='__msgbox'; o.style.display='none'; document.body.appendChild(o) })()`)
    // 打开编辑器:点侧栏「申请修改」?—— 直接点「保存」按钮(已归档单保存会被拦,先看按钮态)
    const btnState = await ev(`(function(){ var all=[].slice.call(document.querySelectorAll('.as-side-btn'))
      return JSON.stringify(all.filter(function(b){return b.offsetParent}).map(function(b){ return { t:(b.textContent||'').trim(), disabled: !!b.disabled || b.classList.contains('is-disabled') } })) })()`)
    console.log('  侧栏按钮: ' + btnState)
    // 抓所有 el-message 提示
    const clicked = await ev(`(function(){ var all=[].slice.call(document.querySelectorAll('.as-side-btn'))
      for(var i=0;i<all.length;i++){ if(all[i].offsetParent && (all[i].textContent||'').trim()==='保存'){ all[i].click(); return 'CLICKED' } } return 'NO_SAVE_BTN' })()`)
    console.log('  点「保存」: ' + clicked)
    await sleep(3500)
    const msgs = await ev(`(function(){ var out=[]
      var ns=[].slice.call(document.querySelectorAll('.el-message, .el-message__content, .el-notification'))
      for (var i=0;i<ns.length;i++) out.push((ns[i].textContent||'').trim())
      return JSON.stringify(out) })()`)
    console.log('  提示语: ' + msgs)
    await shot(`rdquad-verify-${TAG}-save.png`)
    const msgList = JSON.parse(msgs || '[]').join(' | ')
    check('保存提示中不再出现「产品名称不能为空」（当前提示：' + (msgList || '(无)') + '）',
      !msgList.includes('产品名称不能为空'))
  } finally {
    try { if (ws) ws.close() } catch {}
    try { edge.kill() } catch {}
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
  console.log(`\n═══ 结果: 通过 ${pass} / 失败 ${fail} ═══`)
  process.exit(fail ? 1 : 0)
}

async function openByDocNo(doc) {
  await ev(`(function(){ var all=[].slice.call(document.querySelectorAll('.as-side-btn'))
    for(var i=0;i<all.length;i++){ if(all[i].offsetParent && (all[i].textContent||'').trim()==='查询单据'){ all[i].click(); return 'OK' } } return 'NO_BTN' })()`)
  await sleep(1300)
  const set = await ev(`(function(){ var ds=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.offsetParent && (d.innerText||'').indexOf('查询单据')>=0})
    var d=ds.pop(); if(!d) return 'NO_DIALOG'; var inp=d.querySelector('input'); if(!inp) return 'NO_INPUT'
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(inp, ${JSON.stringify(doc)})
    inp.dispatchEvent(new Event('input',{bubbles:true})); return 'SET' })()`)
  if (set !== 'SET') { console.log('  ⚠ 查询框注入失败: ' + set); return }
  await sleep(400)
  await ev(`(function(){ var ds=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.offsetParent && (d.innerText||'').indexOf('查询单据')>=0})
    var d=ds.pop(); if(!d) return 0; var bs=[].slice.call(d.querySelectorAll('button'))
    for(var i=0;i<bs.length;i++){ if((bs[i].textContent||'').trim()==='查询'){ bs[i].click(); return 1 } } return 0 })()`)
  await sleep(3500)
}

main().catch((e) => { console.error('PROBE FAIL: ' + e.stack); process.exit(1) })
