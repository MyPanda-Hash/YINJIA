'use strict'
/**
 * _probe-modify-reason-ui.cjs — 「申请修改」输入框的**界面层**验证(只读:点了就取消,不提交)
 *
 * 为什么还要一个 UI 探针:后端必填已由 _probe-modify-reason.cjs 钉死(9/9),
 * 但前端那一格是**这次新加的** —— 加错了(分支没进 onSideAction、或按钮入口是下拉菜单)
 * 用户点了就是"没反应",接口层再绿也白搭。
 *
 * 用法:node tools/archive/_probe-modify-reason-ui.cjs [前端 http://localhost:5173] [后端 http://127.0.0.1:8090]
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const FE = process.argv[2] || 'http://localhost:5173'
const API = process.argv[3] || 'http://127.0.0.1:8090'
const DOC = process.argv[4] || 'DEMO-PI-002'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9356
const SHOTS = path.join(__dirname, '_shots')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const check = (n, c, e) => { c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}${e ? '  → ' + e : ''}`)) }

let ev = null
async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  const lr = await (await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })).json()
  const token = lr?.data?.token
  if (!token) throw new Error('测试账套登录失败')

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-modreason-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1760,1200', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
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
      for (let i = 0; i < 90; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3500); return } }
    }
    const shot = async (n) => {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
      if (r.result?.data) { fs.writeFileSync(path.join(SHOTS, n), Buffer.from(r.result.data, 'base64')); console.log('  📷 ' + n) }
    }
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1200, deviceScaleFactor: 1, mobile: false })
    await nav(`${FE}/#/login`)
    await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lr.data.user))}); 'ok'`)
    await nav('about:blank')

    console.log(`① 打开 ${DOC} 并点「申请修改」`)
    await nav(`${FE}/#/panelx/list/RD_PROD_INFO`)
    await sleep(1500)
    await openByDocNo(DOC)
    // 「申请修改」可能是下拉触发器:先点它,再点菜单里的同名项(两种形态都试)
    const step1 = await ev(`(function(){
      var all=[].slice.call(document.querySelectorAll('.as-side-btn'))
      for (var i=0;i<all.length;i++){ var t=(all[i].textContent||'').trim()
        if (all[i].offsetParent && t.indexOf('申请修改')===0) { all[i].click(); return t.slice(0,12) } }
      return 'NO_BTN'
    })()`)
    console.log('  点触发器: ' + JSON.stringify(step1))
    await sleep(900)
    const step2 = await ev(`(function(){
      var items=[].slice.call(document.querySelectorAll('.el-dropdown-menu__item, .el-dropdown-menu li, .as-side-menu-item'))
      for (var i=0;i<items.length;i++){ var t=(items[i].textContent||'').trim()
        if (t==='申请修改') { items[i].click(); return 'CLICKED_MENU' } }
      return 'NO_MENU_ITEM'
    })()`)
    console.log('  点菜单项: ' + step2)
    await sleep(1800)
    await shot('modify-reason-ui.png')
    const dlg = await ev(`(function(){
      var ds=[].slice.call(document.querySelectorAll('.el-message-box')).filter(function(d){return d.offsetParent})
      if (!ds.length) return JSON.stringify({found:false})
      var d=ds.pop()
      var inp=d.querySelector('textarea, input')
      return JSON.stringify({ found:true, text:(d.innerText||'').replace(/\\s+/g,' ').trim().slice(0,220),
        placeholder: inp ? inp.getAttribute('placeholder') : null, hasInput: !!inp })
    })()`)
    console.log('  弹窗: ' + dlg)
    const d = JSON.parse(dlg.startsWith('<<') ? '{"found":false}' : dlg)
    check('① 点「申请修改」后弹出输入框(此前完全没有)', d.found === true && d.hasInput === true, dlg.slice(0, 200))
    check('① 占位提示 = 修改原因（必填）', String(d.placeholder || '').includes('修改原因'), String(d.placeholder))
    check('① 弹窗文案含「请写明本次要修改什么」', String(d.text || '').includes('请写明本次要修改什么'), String(d.text).slice(0, 160))

    // 空值提交 → 必填校验拦下(不落任何数据)
    const empty = await ev(`(function(){
      var ds=[].slice.call(document.querySelectorAll('.el-message-box')).filter(function(x){return x.offsetParent})
      if (!ds.length) return 'NO_DLG'
      var bs=[].slice.call(ds.pop().querySelectorAll('button'))
      for (var i=0;i<bs.length;i++){ var t=(bs[i].textContent||'').trim()
        if (t.indexOf('提交修改申请')>=0) { bs[i].click(); return 'CLICKED' } }
      return 'NO_CONFIRM'
    })()`)
    await sleep(1200)
    const err = await ev(`(function(){ var e=document.querySelector('.el-message-box__errormsg')
      return e ? (e.textContent||'').trim() : '' })()`)
    console.log('  空值提交: ' + empty + ' / 校验提示: ' + JSON.stringify(err))
    await shot('modify-reason-ui-empty.png')
    check('① 空值提交被前端必填拦下', String(err).includes('修改原因不能为空'), JSON.stringify(err))

    // 取消,确保不产生任何修改申请
    await ev(`(function(){ var ds=[].slice.call(document.querySelectorAll('.el-message-box')).filter(function(x){return x.offsetParent})
      if (!ds.length) return 'NO_DLG'; var bs=[].slice.call(ds.pop().querySelectorAll('button'))
      for (var i=0;i<bs.length;i++){ if ((bs[i].textContent||'').trim()==='取消'){ bs[i].click(); return 'CANCELLED' } } return 'NO_CANCEL' })()`)
    await sleep(500)
    console.log('  已取消,未提交')
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
