/**
 * _probe-matpick.cjs — 规格书「成品及包装运输」页 · 关键物料列表「从物料清单引用」验收(2026-09-20)
 *
 * 用户口径:①规格书第 4 页的关键物料列表要能像组装BOM表那样「从物料清单引用」;
 *          ②并优化该功能 —— 可选导入**父件 / 父件及所含子件 / 仅子件**(默认父件)。
 *
 * 本探针钉四件事(全部走真渲染,不看代码):
 *   ① 按钮**真的出现了** —— 这张表故意没有 bar 行,原先 materialPick 配了也渲染不出来(本轮修的就是它);
 *   ② 弹窗有导入范围三档,默认「父件」;
 *   ③ 三档导入行数正确:父件 1 行 / 父件及子件 30 行 / 仅子件 29 行(库:父件 T382 除重金属炭棒滤芯 有 29 个子件);
 *   ④ 「仅子件」档下无子件的父件(M-005 上端盖)勾选框置灰 —— 修「勾了没子件的父件→导入 0 行还报成功」;
 *   ⑤ 回归:组装BOM表页(有 bar 行的老用法)按钮仍在表格 bar 上、弹窗同样有三档。
 *
 * 用法:node tools/archive/_probe-matpick.cjs   (需后端 8090;跑完写清理 SQL,再手工执行)
 */
'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const BASE = process.env.YINJIA_API || 'http://localhost:8090'
const EDGE = process.env.EDGE_BIN || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9336
const SHOTS = path.join(__dirname, '_shots')
const CLEANUP = path.join(__dirname, '_probe-matpick-cleanup.sql')
const TAG = 'MATPICK-' + Date.now().toString().slice(-5)
const PARENT = 'T382'            // 库里唯一有子件的父件(T382 除重金属炭棒滤芯 / 29 个子件)
const NOCHILD = 'M-005'          // 无子件的父件(上端盖)

let failed = 0
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => { failed++; console.log('  FAIL ' + m) }
const step = (m) => console.log('\n▶ ' + m)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const lr = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = lr?.data?.token
  if (!token) throw new Error('登录失败')
  const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` }
  const btn = async (panelCode, buttonName, formData) => (await (await fetch(`${BASE}/api/px/callButton`, {
    method: 'POST', headers: H, body: JSON.stringify({ panelCode, buttonName, formData, buttonParam: {} }),
  })).json())

  // 三张草稿规格书:一个档位一张(避免去重把第二次导入全跳过)
  // ⚠ 必须带「规格书种类」:规格书面板列表按种类分页签,种类为空的草稿在列表里找不到(实测定位失败)
  const KIND = '飞利浦沐浴阻垢滤芯'
  const docs = {}
  for (const scope of ['parent', 'both', 'child']) {
    const c = await btn('RD_SPEC_DOC', '保存为草稿', {})
    docs[scope] = c?.data?.['编号']
    if (!docs[scope]) throw new Error('建规格书草稿失败:' + JSON.stringify(c))
    await btn('RD_SPEC_DOC', '保存为草稿', { 编号: docs[scope], 规格书种类: KIND, 名称: TAG + '-' + scope, 客户名称: '探针客户' })
  }
  // 回归用:一张草稿组装工艺清单(归档单不可编辑 ⇒ 库按钮本就不渲染,要拿草稿看按钮)
  const asmDraft = (await btn('RD_ASM_PROC', '保存为草稿', {}))?.data?.['编号']
  const asmFull = await btn('RD_ASM_PROC', '保存为草稿', { 编号: asmDraft, 产品编号: TAG, 产品名称: TAG + '产品' })
  void asmFull
  ok(`三张草稿规格书:parent=${docs.parent} both=${docs.both} child=${docs.child};组装草稿=${asmDraft}`)

  fs.mkdirSync(SHOTS, { recursive: true })
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-matpick-'))
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
      const f = path.join(SHOTS, `matpick-${tag}.png`)
      fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'))
      return f
    }
    const clickText = (sel, text) => ev(`(function(){
      var all=[].slice.call(document.querySelectorAll(${JSON.stringify(sel)}));
      for(var i=0;i<all.length;i++){ if((all[i].textContent||'').trim().indexOf(${JSON.stringify(text)})>=0 && all[i].offsetParent){ all[i].click(); return 1 } }
      return 0 })()`)
    const clickTab = (t) => ev(`(function(){ var ts=[].slice.call(document.querySelectorAll('.rsp-page-tab'));
      for(var i=0;i<ts.length;i++){ if(ts[i].textContent.trim()===${JSON.stringify(t)}){ ts[i].click(); return 1 } } return 0 })()`)
    const dismissOnboarding = () => ev(`(function(){
      var dlgs=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.getBoundingClientRect().height>0})
      for (var i=0;i<dlgs.length;i++){ var t=(dlgs[i].innerText||'')
        if (t.indexOf('初始化')>=0 || t.indexOf('下次再说')>=0){
          var bs=[].slice.call(dlgs[i].querySelectorAll('button,span,a'))
          for (var j=0;j<bs.length;j++){ if((bs[j].textContent||'').trim()==='下次再说'){ bs[j].click(); return 'dismissed' } } } }
      return 'none' })()`)
    const clickSide = (label) => ev(`(function(){
      var all=[].slice.call(document.querySelectorAll('.as-side-btn'));
      for(var i=0;i<all.length;i++){ if((all[i].textContent||'').trim()===${JSON.stringify(label)} && all[i].offsetParent){ all[i].click(); return 1 } }
      return 0 })()`)
    const focusDoc = async (want) => {
      for (let a = 0; a < 3; a++) {
        await clickSide('查询单据'); await sleep(900)
        await ev(`(function(){ var dlg=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.textContent.indexOf('查询单据')>=0 && d.getBoundingClientRect().height>0}).pop();
          if(!dlg) return 'NO_DIALOG'; var inp=dlg.querySelector('input'); if(!inp) return 'NO_INPUT';
          Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(inp, ${JSON.stringify(want)});
          inp.dispatchEvent(new Event('input',{bubbles:true})); return 'SET' })()`)
        await sleep(400)
        await ev(`(function(){ var dlg=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.textContent.indexOf('查询单据')>=0 && d.getBoundingClientRect().height>0}).pop();
          if(!dlg) return 'NO_DIALOG'; var bs=[].slice.call(dlg.querySelectorAll('button'));
          for(var i=0;i<bs.length;i++){ if(bs[i].textContent.trim()==='查询'){ bs[i].click(); return 'CLICKED' } } return 'NO_BTN' })()`)
        await sleep(2400)
        const seen = await ev(`(function(){var t=document.querySelector('.record-sheet');var m=t?(t.innerText||'').match(/((?:SD|AP|MP|MF|AB|PI)-\\d{4}-\\d{2}-\\d{4})/):null;return m?m[1]:''})()`)
        if (seen === want) return true
      }
      return false
    }
    /** 关键物料列表这张表(第 4 页)的可见数据行 */
    const matRows = () => ev(`(function(){
      var root=document.querySelector('.record-sheet'); if(!root) return null
      var wraps=[].slice.call(root.querySelectorAll('.rsp-dt-wrap')).filter(function(w){return w.offsetParent})
      var out=null
      wraps.forEach(function(w){ if((w.textContent||'').indexOf('物料编码')>=0){
        var t=w.querySelector('table.rs-dt'); if(!t) return
        out=[]; [].slice.call(t.querySelectorAll('tbody tr')).forEach(function(tr){
          if(tr.querySelector('th')) return
          var vals=[].slice.call(tr.querySelectorAll('td')).map(function(td){ var i=td.querySelector('input,textarea'); return i? i.value : (td.textContent||'').trim() })
          var j=vals.join('').trim(); if(!j || j==='—') return; if(j.indexOf('字段编辑')>=0) return
          out.push(vals) }) } })
      return out })()`)
    /** 物料清单引用弹窗信息:标题 / 三档单选 / 当前选中档 / 首父件行的子件数与勾选可用性 */
    const pickDialog = () => ev(`(function(){
      var dlgs=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.getBoundingClientRect().height>0})
      var d=dlgs[dlgs.length-1]; if(!d) return null
      var title=(d.querySelector('.el-dialog__title')||{}).textContent||''
      var radios=[].slice.call(d.querySelectorAll('.el-radio-button')).map(function(b){ return { t:(b.textContent||'').trim(), on:b.classList.contains('is-active') } })
      var rows=[].slice.call(d.querySelectorAll('.el-table__body-wrapper tbody tr')).map(function(tr){
        var cb=tr.querySelector('.el-checkbox')
        return { t:(tr.textContent||'').replace(/\\s+/g,' ').trim().slice(0,60), disabled: !!(cb && cb.classList.contains('is-disabled')) } })
      return { title:title, radios:radios, rows:rows, text:(d.innerText||'').replace(/\\s+/g,' ').slice(0,260) } })()`)
    /** 在弹窗里勾选某父件行 */
    const checkParent = (code) => ev(`(function(){
      var dlgs=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.getBoundingClientRect().height>0})
      var d=dlgs[dlgs.length-1]; if(!d) return 'NO_DIALOG'
      var trs=[].slice.call(d.querySelectorAll('.el-table__body-wrapper tbody tr'))
      for(var i=0;i<trs.length;i++){
        if((trs[i].textContent||'').indexOf(${JSON.stringify(code)})>=0){
          var c=trs[i].querySelector('.el-checkbox'); if(!c) return 'NO_CB'
          if(c.classList.contains('is-disabled')) return 'DISABLED'
          c.click(); return 'CHECKED' } }
      return 'NO_ROW' })()`)
    const setScope = (label) => ev(`(function(){
      var dlgs=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.getBoundingClientRect().height>0})
      var d=dlgs[dlgs.length-1]; if(!d) return 'NO_DIALOG'
      var bs=[].slice.call(d.querySelectorAll('.el-radio-button'))
      for(var i=0;i<bs.length;i++){ if((bs[i].textContent||'').trim()===${JSON.stringify(label)}){ bs[i].click(); return 'SET' } }
      return 'NO_RADIO' })()`)
    const clickImport = () => ev(`(function(){
      var dlgs=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.getBoundingClientRect().height>0})
      var d=dlgs[dlgs.length-1]; if(!d) return 'NO_DIALOG'
      var bs=[].slice.call(d.querySelectorAll('button'))
      for(var i=0;i<bs.length;i++){ if((bs[i].textContent||'').trim().indexOf('导入')===0){ bs[i].click(); return 'CLICKED' } }
      return 'NO_BTN' })()`)

    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1500, deviceScaleFactor: 1, mobile: false })
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lr.data.user))}); 'ok'`)
    await nav('about:blank')

    // ════ ① 规格书第 4 页:按钮出现了吗 ════
    step('① 规格书「成品及包装运输」页:关键物料列表的「从物料清单引用」按钮')
    await nav(`${BASE}/#/panelx/list/RD_SPEC_DOC`); await sleep(2500)
    await dismissOnboarding()
    const focused = await focusDoc(docs.parent)
    ok(`焦点单 = ${docs.parent}(${focused ? '已定位' : '定位失败'})`)
    await clickTab('成品及包装运输'); await sleep(1200)
    const btnInfo = await ev(`(function(){
      var bs=[].slice.call(document.querySelectorAll('.rs-lib-btn')).filter(function(b){return b.offsetParent})
      var bar=(document.querySelectorAll('.rs-sectionbar')||[])[0]
      return { btns: bs.map(function(b){return (b.textContent||'').trim()}), bars: [].slice.call(document.querySelectorAll('.rs-sectionbar')).filter(function(e){return e.offsetParent}).map(function(e){return (e.textContent||'').trim().slice(0,40)}) } })()`)
    console.log('     页面上的库按钮:' + JSON.stringify(btnInfo?.btns))
    console.log('     可见章节条:' + JSON.stringify(btnInfo?.bars))
    if ((btnInfo?.btns || []).some((t) => t.includes('从物料清单引用'))) ok('✅ 关键物料列表的「从物料清单引用」按钮已出现(原先这张表没有 bar 行 ⇒ 永远渲染不出来)')
    else bad('按钮没出现 —— 规格书第 4 页仍然点不到该功能')
    const shotSheet = await shot('spec-page4')

    // ════ ② 弹窗与三档 ════
    step('② 弹窗:导入范围三档 + 默认档')
    await clickText('.rs-lib-btn', '从物料清单引用'); await sleep(1200)
    const d0 = await pickDialog()
    console.log('     弹窗:' + JSON.stringify({ title: d0?.title, radios: d0?.radios }))
    if (d0 && d0.title.includes('从物料清单引用')) ok('弹窗标题 = 从物料清单引用')
    else bad(`弹窗没开或标题不对:${JSON.stringify(d0?.title)}`)
    const rLabels = (d0?.radios || []).map((r) => r.t)
    if (['父件', '父件及所含子件', '仅子件'].every((x) => rLabels.includes(x))) ok(`三档齐全:${JSON.stringify(rLabels)}`)
    else bad(`档位不全:${JSON.stringify(rLabels)}`)
    const active = (d0?.radios || []).find((r) => r.on)?.t
    if (active === '父件') ok('默认档 = 父件(用户口径)')
    else bad(`默认档应为父件,实际 ${active}`)
    const shotDlg = await shot('dialog-parent')

    // ════ ③ 三档导入行数 ════
    step('③ 三档导入行数(库:父件 T382 有 29 个子件 ⇒ 父件 1 / 父件及子件 30 / 仅子件 29)')
    const EXP = { parent: 1, both: 30, child: 29 }
    const got = {}
    for (const scope of ['parent', 'both', 'child']) {
      const tabName = { parent: '父件', both: '父件及所含子件', child: '仅子件' }[scope]
      if (scope !== 'parent') {
        // 换单:重开面板 → 定位该档草图 → 切到第 4 页
        await nav(`${BASE}/#/panelx/list/RD_SPEC_DOC`); await sleep(2200)
        await dismissOnboarding()
        await focusDoc(docs[scope])
        await clickTab('成品及包装运输'); await sleep(1000)
        await clickText('.rs-lib-btn', '从物料清单引用'); await sleep(1200)
        await setScope(tabName); await sleep(500)
      }
      const r = await checkParent(PARENT)
      if (r !== 'CHECKED') bad(`[${tabName}] 勾选 ${PARENT} 失败:${r}`)
      const dNow = await pickDialog()
      if (scope === 'child') {
        const m5 = (dNow?.rows || []).find((x) => x.t.includes(NOCHILD))
        if (m5?.disabled) ok(`[仅子件] 无子件的父件 ${NOCHILD} 勾选框已置灰(不再"导入 0 行还报成功")`)
        else bad(`[仅子件] ${NOCHILD} 应置灰,实际 ${JSON.stringify(m5)}`)
      }
      await clickImport(); await sleep(1200)
      const rows = await matRows()
      got[scope] = (rows || []).length
      console.log(`     [${tabName}] 导入后物料表行数 = ${got[scope]}`)
      if (got[scope] === EXP[scope]) ok(`[${tabName}] 行数 = ${EXP[scope]}`)
      else bad(`[${tabName}] 行数 = ${got[scope]},期望 ${EXP[scope]}:${JSON.stringify((rows || []).slice(0, 2))}`)
      if (scope === 'both') {
        const first = (rows || [])[0] || []
        if (first.join('|').includes(PARENT)) ok(`[父件及所含子件] 首行 = 父件 ${first.join(' | ')}`)
        else bad(`[父件及所含子件] 首行应是父件行:${JSON.stringify(first)}`)
      }
      if (scope === 'child') {
        const first = (rows || [])[0] || []
        const joined = first.join('|')
        if (!joined.includes(PARENT) && /M-\d+/.test(joined)) ok(`[仅子件] 首行是子件:${first.join(' | ')}`)
        else bad(`[仅子件] 首行应是子件行:${JSON.stringify(first)}`)
      }
      if (scope === 'parent') {
        const first = (rows || [])[0] || []
        if (first.join('|').includes(PARENT)) ok(`[父件] 首行 = ${first.join(' | ')}(父件自己一行,规格取它自己在清单里的那行)`)
        else bad(`[父件] 首行不符:${JSON.stringify(first)}`)
      }
    }

    // ════ ④ 落库往返:父件那单存一下,重开还在(表区=物料清单) ════
    // ⚠ 不假设"纸张显示的一定是我 focus 的那张单"(规格书列表按种类分页签,对话框查询可能一无所获)
    //   ⇒ 先把**页面上真正显示的单号**读出来,存它、验它,并把单号并入清理清单。
    step('④ 保存后重开:导入的行要落库(rd_spec_doc_detail 表区=物料清单)')
    // ⚠ 规格书面板打开时给的是一张**全新空白草稿(没有单号)** —— 先导入、再保存,
    //   然后读「保存后才出现的单号」再核库(实测:保存前读单号读到空,拿空号查库当然是 0 行)
    await nav(`${BASE}/#/panelx/list/RD_SPEC_DOC`); await sleep(2200)
    await dismissOnboarding()
    const f4 = await focusDoc(docs.parent)
    await clickTab('成品及包装运输'); await sleep(900)
    await clickText('.rs-lib-btn', '从物料清单引用'); await sleep(1200)
    // 档位显式切到「父件」(同一次 SPA 会话里 ③ 的最后一档还留着;不假设默认值)
    await setScope('父件'); await sleep(400)
    const chk = await checkParent(PARENT)
    const imp = await clickImport(); await sleep(1200)
    const beforeSave = (await matRows() || []).length
    console.log(`     焦点=${docs.parent}(${f4 ? 'ok' : '未确认'}) 导入(${chk}/${imp})后页面上 ${beforeSave} 行;点「保存为草稿」…`)
    if (beforeSave !== 1) bad(`保存前页面上应有 1 行,实际 ${beforeSave}`)
    const clickedSave = await clickSide('保存为草稿')
    await sleep(2800)
    // 单号不从纸面读(规格书封面「编  号」格在编辑期间可能为空,另有会话正在改这块的绑定):
    // 改为**从列表 API 取最近几张 SD 单,逐张查明细里有没有刚才那行** —— 谁有就是它落库了。
    const list = await (await fetch(`${BASE}/api/px/queryFormDataList`, {
      method: 'POST', headers: H, body: JSON.stringify({ panelCode: 'RD_SPEC_DOC', condition: {}, pageNo: 1, pageSize: 6 }),
    })).json()
    const recent = (list?.data?.list || []).map((m) => m['单据编号']).filter(Boolean)
    console.log(`     保存(clicked=${clickedSave})后最近 ${recent.length} 张单:${JSON.stringify(recent)}`)
    let hit = null
    for (const no of recent) {
      const d = await (await fetch(`${BASE}/api/px/getFormDescriptor?panelCode=RD_SPEC_DOC&code=${encodeURIComponent(no)}`, { headers: H })).json()
      const its = (d?.data?.detailData?.items || []).filter((r) => (r['表区'] || '') === '物料清单')
      if (its.length) { hit = { no, its }; break }
    }
    if (hit) {
      ok(`落库往返正确:${hit.no} 落 ${hit.its.length} 行(表区=物料清单,编码 ${JSON.stringify(hit.its.map((r) => r['物料编码']))})`)
      docs.saved = hit.no
      if (String(hit.its[0]['物料编码'] || '') === PARENT && hit.its.length === 1) ok(`落库内容 = 父件 ${PARENT} 一行(与导入档位一致)`)
      else bad(`落库内容不符:${JSON.stringify(hit.its).slice(0, 160)}`)
    } else {
      bad(`落库往返不符:最近 ${recent.length} 张单里都没有 表区=物料清单 的行`)
    }

    // ════ ⑤ 回归:组装BOM表页(表自己有 bar 的老用法) ════
    step('⑤ 回归:组装工艺清单 · 组装BOM表页的按钮仍在表格 bar 上(用草稿单,归档单不可编辑本就不渲染)')
    await nav(`${BASE}/#/panelx/list/RD_ASM_PROC`); await sleep(2500)
    await dismissOnboarding()
    const asmFocused = await focusDoc(asmDraft)
    // 必须切到「组装BOM表」那一页:materialPick 表在页 2,默认页(修订记录)上没有它
    await clickTab('组装BOM表'); await sleep(1000)
    const asmBtn = await ev(`(function(){
      var bs=[].slice.call(document.querySelectorAll('.rs-lib-btn')).filter(function(b){return b.offsetParent})
      var d=document.querySelector('.record-sheet')
      var m=d?(d.innerText||'').match(/((?:SD|AP|MP)-\\d{4}-\\d{2}-\\d{4})/):null
      return { btns: bs.map(function(b){return (b.textContent||'').trim()}), doc: m?m[1]:'',
               tabs: [].slice.call(document.querySelectorAll('.rsp-page-tab')).filter(function(t){return t.offsetParent}).map(function(t){return t.textContent.trim()}) } })()`)
    console.log(`     焦点目标=${asmDraft}(${asmFocused ? 'ok' : '失败'}) 页面单=${asmBtn?.doc} 页签=${JSON.stringify(asmBtn?.tabs)} 库按钮=${JSON.stringify(asmBtn?.btns)}`)
    if ((asmBtn?.btns || []).some((t) => t.includes('从物料清单引用'))) ok('组装BOM表页按钮仍在(老用法未受影响)')
    else bad('组装BOM表页按钮丢了')
    const shotAsm = await shot('asm-bom')
    console.log(`     截图:${shotAsm}`)
  } finally {
    if (ws) try { ws.close() } catch { /* ignore */ }
    edge.kill()
    fs.writeFileSync(CLEANUP, `/* 探针清理:物料清单引用验收(_probe-matpick.cjs) */
USE HSDZ_MES; SET NOCOUNT ON;
DECLARE @docs TABLE (no nvarchar(120) PRIMARY KEY);
INSERT INTO @docs (no) SELECT 单据编号 FROM rd_spec_doc_head WHERE 单据编号 IN (${Object.values(docs).map((d) => `N'${d}'`).join(',')});
DELETE FROM yj_message         WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM yj_form_approval   WHERE panel_code = N'RD_SPEC_DOC' AND form_no IN (SELECT no FROM @docs);
DELETE FROM yj_doc_modify_log  WHERE panel_code = N'RD_SPEC_DOC' AND doc_no IN (SELECT no FROM @docs);
DELETE FROM yj_doc_status      WHERE panel_code = N'RD_SPEC_DOC' AND doc_no IN (SELECT no FROM @docs);
DELETE FROM rd_spec_doc_detail WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM rd_spec_doc_head   WHERE 单据编号 IN (SELECT no FROM @docs);
SELECT N'规格书残留' AS 检查, CAST(COUNT(*) AS nvarchar) AS n FROM rd_spec_doc_head WHERE 单据编号 IN (${Object.values(docs).map((d) => `N'${d}'`).join(',')});
`, 'utf8')
    console.log(`\n  --   清理 SQL:${CLEANUP}(单号 ${Object.values(docs).join(' / ')})`)
  }
  console.log(failed ? `\n${failed} 项断言失败` : '\nALL PASSED')
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('探针异常:', e.message); process.exit(1) })
