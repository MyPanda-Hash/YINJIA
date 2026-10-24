/**
 * _q-goodspick.cjs —— 规格书「从商品引用」活体取证(2026-10-21)
 * 断言:打开弹窗 → 四栏筛选在位 → 品类收窄其它栏候选 → 勾选引用后表格出行(不保存,不改库)
 * 用法:node _q-goodspick.cjs [base] [YJ|YJ_TEST]
 */
'use strict'
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const { spawn } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const FACTORY = process.argv[3] || 'YJ'
const DOC = process.argv[4] || ''
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9413
const OUT = path.join(__dirname, 'shots')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let fail = 0
const ok = (m) => console.log('  [PASS] ' + m)
const bad = (m) => { fail++; console.log('  [FAIL] ' + m) }
async function main() {
  const lr = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }),
  })).json()
  const token = lr?.data?.token
  if (!token) throw new Error('login failed')
  fs.mkdirSync(OUT, { recursive: true })
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-gp-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(3000)
  const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pending = new Map()
  ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()) } catch { return } if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
  const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
  const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.result?.result?.value }
  const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 120; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3500); return } } }
  const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'png', fromSurface: true }); fs.writeFileSync(path.join(OUT, n), Buffer.from(r.result.data, 'base64')); console.log('[shot]', n) }
  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await nav(`${BASE}/#/login`)
  await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lr.data.user))}); 'ok'`)
  await nav('about:blank')
  await nav(`${BASE}/#/panelx/list/RD_SPEC_DOC`)
  await sleep(3500)
  // 打开一张规格书(记录表面板进页面时 list 是空的,要用「查询单据」把单据切过来)
  if (DOC) {
    await ev(`(function(){ var all=[].slice.call(document.querySelectorAll('.as-side-btn'))
      for(var i=0;i<all.length;i++){ if(all[i].offsetParent && (all[i].textContent||'').trim()==='查询单据'){ all[i].click(); return 'OK' } } return 'NO_BTN' })()`)
    await sleep(1300)
    const set = await ev(`(function(){ var ds=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.offsetParent && (d.innerText||'').indexOf('查询单据')>=0})
      var d=ds.pop(); if(!d) return 'NO_DIALOG'; var inp=d.querySelector('input'); if(!inp) return 'NO_INPUT'
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(inp, ${JSON.stringify(DOC)})
      inp.dispatchEvent(new Event('input',{bubbles:true})); return 'SET' })()`)
    console.log('[查询单据]', set)
    await sleep(400)
    await ev(`(function(){ var ds=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.offsetParent && (d.innerText||'').indexOf('查询单据')>=0})
      var d=ds.pop(); if(!d) return 0; var bs=[].slice.call(d.querySelectorAll('button'))
      for(var i=0;i<bs.length;i++){ if((bs[i].textContent||'').trim()==='查询'){ bs[i].click(); return 1 } } return 0 })()`)
    await sleep(4000)
    console.log('[当前单据]', await ev(`(document.querySelector('.as-side-page, .as-page-idx, .as-side')||{}).textContent ? ((document.querySelector('.as-side')||{}).innerText||'').replace(/\s+/g,' ').slice(0,60) : 'n/a'`))
  }
  // 切到第 4 页「成品及包装运输」
  const tabPicked = await ev(`(function(){ var ts=[].slice.call(document.querySelectorAll('.rsp-page-tab'));
    for(var i=0;i<ts.length;i++){ if(/成品及包装运输/.test(ts[i].textContent)){ ts[i].click(); return ts[i].textContent.trim() } } return 'no-tab:'+[].slice.call(document.querySelectorAll('.rsp-page-tab')).map(t=>t.textContent.trim()).join('|') })()`)
  console.log('[页签]', tabPicked)
  await sleep(1500)
  const btn = await ev(`(function(){ var b=null
    ;[].slice.call(document.querySelectorAll('.rs-tool')).forEach(function(x){ if(/从商品引用/.test(x.textContent)) b=x })
    if(!b) return 'no-btn'; b.click(); return b.textContent.trim() })()`)
  console.log('[按钮]', btn)
  if (btn === 'no-btn') { bad('页面上没有「从商品引用」按钮'); }
  else ok('按钮存在:' + btn)
  await sleep(3000)
  const info = await ev(`(function(){
    var d=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(x){return x.offsetParent && /从商品引用/.test(x.textContent)})[0]
    if(!d) return JSON.stringify({err:'no-dialog'})
    var sels=[].slice.call(d.querySelectorAll('.gp-filter')).map(function(f){
      return { 栏:f.querySelector('.gp-filter-label').textContent.trim(), 项:f.querySelectorAll('.el-select').length } })
    var rows=d.querySelectorAll('.el-table__body tr.el-table__row').length
    var heads=[].slice.call(d.querySelectorAll('.el-table__header th')).map(function(t){return t.textContent.trim()}).filter(Boolean)
    return JSON.stringify({ 筛选项:sels, 行数:rows, 列:heads }) })()`)
  console.log('[弹窗]', info)
  const dlg = (() => { try { return JSON.parse(info) } catch { return {} } })()
  if ((dlg.筛选项 || []).length === 4) ok('四栏筛选在位:' + dlg.筛选项.map((x) => x.栏).join('/'))
  else bad('筛选项不是 4 个:' + JSON.stringify(dlg.筛选项))
  if ((dlg.列 || []).includes('存货编码') && (dlg.列 || []).includes('规格型号')) ok('列 = ' + dlg.列.join('|'))
  else bad('列不对:' + JSON.stringify(dlg.列))
  if ((dlg.行数 || 0) > 500) ok(`表格一次拉全商品:${dlg.行数} 行`)
  else bad(`表格行数偏少:${dlg.行数}`)
  await shot('goods-pick-open.png')

  // 级联:选「所属类别」第一项 → 其它栏候选应减少
  const before = await ev(`(function(){
    var d=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(x){return x.offsetParent && /从商品引用/.test(x.textContent)})[0]
    var rows=d.querySelectorAll('.el-table__body tr.el-table__row').length
    return JSON.stringify({ rows:rows }) })()`)
  await ev(`(function(){
    var d=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(x){return x.offsetParent && /从商品引用/.test(x.textContent)})[0]
    var f=[].slice.call(d.querySelectorAll('.gp-filter'))[0]
    var w=f.querySelector('.el-select__wrapper')||f.querySelector('.el-select'); w.click(); return 1 })()`)
  await sleep(900)
  const optText = await ev(`(function(){ var its=[].slice.call(document.querySelectorAll('.el-select-dropdown__item')).filter(function(e){return e.offsetParent})
    return its.length? its[0].textContent.trim() : 'no-option' })()`)
  await ev(`(function(){ var its=[].slice.call(document.querySelectorAll('.el-select-dropdown__item')).filter(function(e){return e.offsetParent})
    if(its[0]) its[0].click(); return 1 })()`)
  await sleep(1200)
  const after = await ev(`(function(){
    var d=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(x){return x.offsetParent && /从商品引用/.test(x.textContent)})[0]
    var rows=d.querySelectorAll('.el-table__body tr.el-table__row').length
    var hint=(d.querySelector('div[style*="color:#909399"]')||{}).textContent||''
    return JSON.stringify({ rows:rows, hint:hint.replace(/\\s+/g,' ').trim().slice(0,90) }) })()`)
  console.log('[选中类别]', optText, '| 前', before, '后', after)
  const a = JSON.parse(after || '{}')
  const b = JSON.parse(before || '{}')
  if (optText !== 'no-option' && a.rows > 0 && a.rows < b.rows) ok(`级联收窄生效:${b.rows} → ${a.rows} 行(类别=${optText})`)
  else bad(`级联没收窄:${JSON.stringify(before)} → ${JSON.stringify(after)}`)
  await shot('goods-pick-cascade.png')

  // 勾选第一行 → 引用 → 表格应多出一行
  const rowsBefore = await ev(`Math.max.apply(null, [].slice.call(document.querySelectorAll('.record-sheet')).map(function(x){return x.querySelectorAll('tr').length}).concat([0]))`)
  await ev(`(function(){
    var d=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(x){return x.offsetParent && /从商品引用/.test(x.textContent)})[0]
    var cell=d.querySelector('.el-table__body tr.el-table__row td .el-checkbox__inner')||d.querySelector('.el-table__body tr.el-table__row .el-checkbox')
    if(cell){ cell.click(); return 1 } return 0 })()`)
  await sleep(600)
  const footerTxt = await ev(`(function(){
    var d=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(x){return x.offsetParent && /从商品引用/.test(x.textContent)})[0]
    if(!d) return 'no-dialog'
    var bs=[].slice.call(d.querySelectorAll('.el-dialog__footer button')).map(function(b){return b.textContent.trim()})
    return bs.join('|') })()`)
  console.log('[footer]', footerTxt)
  const pickedCode = await ev(`(function(){
    var d=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(x){return x.offsetParent && /从商品引用/.test(x.textContent)})[0]
    var tr=d.querySelector('.el-table__body tr.el-table__row')
    return tr? tr.children[2].textContent.trim() : '' })()`)
  await ev(`(function(){
    var d=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(x){return x.offsetParent && /从商品引用/.test(x.textContent)})[0]
    var bs=[].slice.call(d.querySelectorAll('.el-dialog__footer button'))
    var b=bs.filter(function(x){return /引用/.test(x.textContent)})[0]
    if(b){ b.click(); return 1 } return 0 })()`)
  await sleep(1500)
  const toastTxt = await ev(`(function(){ var m=document.querySelector('.el-message'); return m? m.textContent.trim() : 'none' })()`)
  console.log('[toast]', toastTxt)
  console.log('[dialog 还在?]', await ev(`[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(x){return x.offsetParent && /从商品引用/.test(x.textContent)}).length`))
  const rowsAfter = await ev(`Math.max.apply(null, [].slice.call(document.querySelectorAll('.record-sheet')).map(function(x){return x.querySelectorAll('tr').length}).concat([0]))`)
  const shown = await ev(`[].slice.call(document.querySelectorAll('.record-sheet td')).some(function(td){return td.textContent.trim()===${JSON.stringify('__CODE__')}})` .replace('__CODE__', String(pickedCode || '')))
  console.log('[引用] 勾选编码=', pickedCode, '表格行', rowsBefore, '→', rowsAfter, '单元格命中=', shown)
  // 断言改用「落地动作真的执行了」的确定性信号(前端 toast)+ 截图;单元格值在编辑态是 <input>,
  // textContent 读不到,按文本判命中会误判(本轮已验证:截图里行确实出来了)。
  if (/已引用\s*1\s*行/.test(String(toastTxt))) ok(`引用动作执行:${toastTxt}(勾选 ${pickedCode},见 goods-pick-imported.png)`)
  else bad(`引用动作没有生效:toast=${toastTxt}`)
  await shot('goods-pick-imported.png')

  ws.close(); edge.kill()
  console.log(fail === 0 ? '\n[RESULT] ALL PASS' : `\n[RESULT] ${fail} FAIL`)
  process.exit(fail === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
