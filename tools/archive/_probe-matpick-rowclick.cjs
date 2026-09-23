/**
 * _probe-matpick-rowclick.cjs — 复现「在弹窗点击有子件的数据行 → 出现对应子件数的一模一样的父数据行」
 *
 * 对照三组:
 *   A 点勾选框(已知正常)
 *   B 点**行体**(tr.click(),用户报的那一下)
 *   C 点行体后再切档/再点一次(看是不是"重复累加")
 * 每组都读:弹窗里被勾选的行数、目标物料表落了几行、每行的物料编码/名称。
 *
 * 用法:node tools/archive/_probe-matpick-rowclick.cjs
 */
'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const BASE = process.env.YINJIA_API || 'http://localhost:8090'
const EDGE = process.env.EDGE_BIN || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9337
const SHOTS = path.join(__dirname, '_shots')
const PARENT = 'T382'
let failed = 0
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => { failed++; console.log('  FAIL ' + m) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const lr = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = lr?.data?.token
  if (!token) throw new Error('登录失败')
  const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` }
  const btn = async (p, b, f) => (await (await fetch(`${BASE}/api/px/callButton`, {
    method: 'POST', headers: H, body: JSON.stringify({ panelCode: p, buttonName: b, formData: f, buttonParam: {} }),
  })).json())

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-rowclick-'))
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
      for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3200); return } }
    }
    const shot = async (tag) => {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
      if (!r.result?.data) return null
      const f = path.join(SHOTS, `matpick-rowclick-${tag}.png`)
      fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'))
      return f
    }
    const clickText = (sel, text) => ev(`(function(){
      var all=[].slice.call(document.querySelectorAll(${JSON.stringify(sel)}));
      for(var i=0;i<all.length;i++){ if((all[i].textContent||'').trim().indexOf(${JSON.stringify(text)})>=0 && all[i].offsetParent){ all[i].click(); return 1 } }
      return 0 })()`)
    const clickTab = (t) => ev(`(function(){ var ts=[].slice.call(document.querySelectorAll('.rsp-page-tab'));
      for(var i=0;i<ts.length;i++){ if(ts[i].textContent.trim()===${JSON.stringify(t)}){ ts[i].click(); return 1 } } return 0 })()`)
    const dialogs = `[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.getBoundingClientRect().height>0})`
    /** 弹窗里:被勾选行数 + T382 那一行的勾选状态 */
    const pickState = () => ev(`(function(){
      var dlgs=${dialogs}; var d=dlgs[dlgs.length-1]; if(!d) return null
      var trs=[].slice.call(d.querySelectorAll('.el-table__body-wrapper tbody tr'))
      var checked=trs.filter(function(tr){ var cb=tr.querySelector('.el-checkbox'); return cb && cb.classList.contains('is-checked') })
      var t382=trs.filter(function(tr){ return (tr.textContent||'').indexOf('T382')>=0 })[0]
      return { rows:trs.length, checked:checked.length,
               t382Checked: !!(t382 && t382.querySelector('.el-checkbox') && t382.querySelector('.el-checkbox').classList.contains('is-checked')),
               checkedText: checked.map(function(tr){ return (tr.textContent||'').replace(/\\s+/g,' ').trim().slice(0,40) }) } })()`)
    /** 目标物料表的行(物料编码/名称) */
    const matRows = () => ev(`(function(){
      var root=document.querySelector('.record-sheet'); if(!root) return null
      var wraps=[].slice.call(root.querySelectorAll('.rsp-dt-wrap')).filter(function(w){return w.offsetParent})
      var out=null
      wraps.forEach(function(w){ if((w.textContent||'').indexOf('物料编码')>=0){
        var t=w.querySelector('table.rs-dt'); if(!t) return
        out=[]; [].slice.call(t.querySelectorAll('tbody tr')).forEach(function(tr){
          if(tr.querySelector('th')) return
          var vals=[].slice.call(tr.querySelectorAll('td')).map(function(td){ var i=td.querySelector('input,textarea'); return i? i.value : (td.textContent||'').trim() })
          var j=vals.join('').trim(); if(!j || j==='—' || j.indexOf('字段编辑')>=0) return
          out.push(vals) }) } })
      return out })()`)
    const clickRowBody = (code) => ev(`(function(){
      var dlgs=${dialogs}; var d=dlgs[dlgs.length-1]; if(!d) return 'NO_DIALOG'
      var cells=[].slice.call(d.querySelectorAll('.el-table__body-wrapper tbody tr td'))
      for(var i=0;i<cells.length;i++){
        if((cells[i].textContent||'').trim()===${JSON.stringify(code)}){ cells[i].click(); return 'CLICKED_BODY' } }
      return 'NO_CELL' })()`)
    const clickCheckbox = (code) => ev(`(function(){
      var dlgs=${dialogs}; var d=dlgs[dlgs.length-1]; if(!d) return 'NO_DIALOG'
      var trs=[].slice.call(d.querySelectorAll('.el-table__body-wrapper tbody tr'))
      for(var i=0;i<trs.length;i++){ if((trs[i].textContent||'').indexOf(${JSON.stringify(code)})>=0){
        var c=trs[i].querySelector('.el-checkbox'); if(!c) return 'NO_CB'; c.click(); return 'CLICKED_CB' } }
      return 'NO_ROW' })()`)
    const clickImport = () => ev(`(function(){
      var dlgs=${dialogs}; var d=dlgs[dlgs.length-1]; if(!d) return 'NO_DIALOG'
      var bs=[].slice.call(d.querySelectorAll('button'))
      for(var i=0;i<bs.length;i++){ if((bs[i].textContent||'').trim().indexOf('导入')===0){ bs[i].click(); return 'CLICKED' } }
      return 'NO_BTN' })()`)

    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1500, deviceScaleFactor: 1, mobile: false })
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lr.data.user))}); 'ok'`)
    await nav('about:blank')

    /** 开一张干净草稿 → 第 4 页 → 打开弹窗 */
    const openDialog = async () => {
      await nav(`${BASE}/#/panelx/list/RD_SPEC_DOC`); await sleep(2400)
      await ev(`(function(){ var dlgs=${dialogs}
        for (var i=0;i<dlgs.length;i++){ var t=(dlgs[i].innerText||'')
          if (t.indexOf('初始化')>=0 || t.indexOf('下次再说')>=0){ var bs=[].slice.call(dlgs[i].querySelectorAll('button,span,a'))
            for (var j=0;j<bs.length;j++){ if((bs[j].textContent||'').trim()==='下次再说'){ bs[j].click(); return 'dismissed' } } } }
        return 'none' })()`)
      await sleep(400)
      await clickTab('成品及包装运输'); await sleep(1000)
      const r = await clickText('.rs-lib-btn', '从物料清单引用'); await sleep(1200)
      return r
    }

    // ════ 诊断:在**页面里**发同一个 BOM 列表请求,按前端同款逻辑分组,看到底几组 ════
    console.log('\n▶ 诊断:页面侧 BOM 数据与分组')
    await nav(`${BASE}/#/panelx/list/RD_SPEC_DOC`); await sleep(2200)
    const diag = await ev(`(async function(){
      var tk = localStorage.getItem('mes_token')
      var res = await fetch('/api/px/queryFormDataList', { method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+tk },
        body: JSON.stringify({ panelCode:'BOM', condition:{}, pageNo:1, pageSize:500 }) }).then(function(r){return r.json()})
      var masters = res?.data?.list || res?.data?.rows || res?.data || []
      var all = []
      if (Array.isArray(masters)) for (var i=0;i<masters.length;i++){
        var kids = masters[i]?.detail?.children || masters[i]?.detail?.items || []
        if (Array.isArray(kids)) all = all.concat(kids) }
      var by = {}; var order = []
      for (var j=0;j<all.length;j++){
        var k = all[j]; var code = String(k['父件编码']||'').trim(); if(!code) continue
        if (!by[code]) { by[code] = { code:code, child:0, self:0 }; order.push(code) }
        if (String(k['子件编码']||'').trim()) by[code].child++; else by[code].self++ }
      return { masters:masters.length, all:all.length, groups:order.length,
               codes: order.slice(0,8).map(function(c){ return c + '|child=' + by[c].child + '|self=' + by[c].self }),
               t382Keys: Object.keys(by).filter(function(c){ return c.indexOf('T382')>=0 }).map(function(c){ return JSON.stringify(c) + ' len=' + c.length }),
               sampleParentCodes: all.slice(0,3).map(function(k){ return JSON.stringify(k['父件编码']) + ' | 子件=' + JSON.stringify(k['子件编码']) }) } })()`)
    console.log('     ' + JSON.stringify(diag))

    // ════ A 点勾选框(对照) ════
    console.log('\n▶ A 点勾选框(对照)')
    await openDialog()
    const dump = await ev(`(function(){
      var dlgs=${dialogs}; var d=dlgs[dlgs.length-1]; if(!d) return null
      var trs=[].slice.call(d.querySelectorAll('.el-table__body-wrapper tbody tr'))
      var codes={}
      trs.forEach(function(tr){ var tds=[].slice.call(tr.children); var code=(tds[1]||{}).textContent||''; code=code.trim(); codes[code]=(codes[code]||0)+1 })
      return { tbodyTr: trs.length, elTableRow: d.querySelectorAll('.el-table__row').length,
               cls: trs.slice(0,3).map(function(tr){ return tr.className }) + ' | ' + trs.slice(-2).map(function(tr){ return tr.className }),
               codeCounts: codes,
               colgroup: [].slice.call(d.querySelectorAll('.el-table colgroup col')).map(function(c){ return c.style.width || c.getAttribute('width') }) } })()`)
    console.log('     弹窗表格结构:' + JSON.stringify(dump))
    const aClick = await clickCheckbox(PARENT)
    const aState = await pickState()
    console.log(`     点击=${aClick} 弹窗勾选态=${JSON.stringify(aState)}`)
    await clickImport(); await sleep(1200)
    const aRows = await matRows()
    console.log(`     导入后 ${(aRows || []).length} 行:${JSON.stringify((aRows || []).map((r) => r.slice(1, 3)))}`)
    if ((aRows || []).length === 1) ok('A 点勾选框 → 1 行(符合预期)')
    else bad(`A 点勾选框 → ${(aRows || []).length} 行`)

    // ════ B 点行体(用户报的那一下) ════
    console.log('\n▶ B 点行体(tr/td.click())')
    await openDialog()
    const bClick = await clickRowBody(PARENT)
    await sleep(600)
    const bState = await pickState()
    console.log(`     点击=${bClick} 弹窗勾选态=${JSON.stringify(bState)}`)
    const bShot = await shot('rowclick')
    await clickImport(); await sleep(1200)
    const bRows = await matRows()
    console.log(`     导入后 ${(bRows || []).length} 行:${JSON.stringify((bRows || []).map((r) => r.slice(1, 3)))}`)
    if ((bRows || []).length <= 1) ok(`B 点行体 → ${(bRows || []).length} 行(不产生重复)`)
    else bad(`B 点行体 → ${(bRows || []).length} 行 —— 复现了「一模一样的数据行」`)

    // ════ C 连点行体多次 + 再导入 ════
    console.log('\n▶ C 连点行体 5 次')
    await openDialog()
    for (let i = 0; i < 5; i++) { await clickRowBody(PARENT); await sleep(150) }
    const cState = await pickState()
    console.log(`     弹窗勾选态=${JSON.stringify(cState)}`)
    await clickImport(); await sleep(1200)
    const cRows = await matRows()
    console.log(`     导入后 ${(cRows || []).length} 行:${JSON.stringify((cRows || []).map((r) => r.slice(1, 3)))}`)
    if ((cRows || []).length <= 1) ok(`C 连点 5 次 → ${(cRows || []).length} 行`)
    else bad(`C 连点 5 次 → ${(cRows || []).length} 行`)
    console.log(`     截图:${bShot}`)

    void btn
  } finally {
    if (ws) try { ws.close() } catch { /* ignore */ }
    edge.kill()
  }
  console.log(failed ? `\n${failed} 项异常` : '\n未复现(全部符合预期)')
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('探针异常:', e.message); process.exit(1) })
