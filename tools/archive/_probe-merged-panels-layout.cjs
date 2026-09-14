/**
 * _probe-merged-panels-layout.cjs —— 「两页各用原版式」的端到端验收(2026-09-11 返工)。
 *
 * 背景:上一轮把「成型配方」并入「成型工艺清单」、「组装BOM表」并入「组装工艺清单」时,
 * 把两个面板的 cfg.grid **统一成 11 列/1040**,并把页 2 区块跨列重排 ⇒ 两页原本不同的
 * 列数与列宽被改坏(用户反馈「结构都乱了,完全设计坏了」)。
 * 本轮恢复:两页**各用各的原始 grid**(引擎新增 pages[i].grid / pages[i].headMode)。
 *
 * 本探针断言的正是「版式有没有被改坏」——
 *   ① 页签数/标题;
 *   ② **页 1 / 页 2 实际渲染的列宽数组 ≡ 合并前(e20bd9a~1)该面板原始 grid,逐项相等**;
 *   ③ 页 2 的区块顺序/形态 ≡ 合并前原样(成型配方=grid 两行式;组装BOM表=报告头+4列+表);
 *   ④ 页 1 / 页 2 内容互不串页;
 *   ⑤ 页 2 能编辑并保存落库(接口 + SQL 回读);
 *   ⑥ 每个页签 printToPDF 页数 = 1(A4 / 8mm 页边距 / body.approval-printing);
 *   ⑦ 探针自建数据自行清理(**精确单号 IN 列表,绝不用 LIKE 范围条件**)。
 *
 * 用法: node tools/_probe-merged-panels-layout.cjs [API] [FRONT]
 *       默认 API=http://localhost:8090,FRONT=http://localhost:5173
 * 依赖: tools/node_modules/ws;headless Edge;sqlcmd(中文条件必须 -f 65001)。
 */
const { spawn, execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const API = process.argv[2] || 'http://localhost:8090'
const FRONT = process.argv[3] || 'http://localhost:5173'
const PORT = 9445
const EDGE = process.env.EDGE_BIN || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const ROOT = path.resolve(__dirname, '..')
const MOLD = 'RD_MOLD_PROC'
const ASM = 'RD_ASM_PROC'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fails = []
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m) }
const info = (m) => console.log('     · ' + m)

// ── 合并前(e20bd9a~1)四个面板的原始据 —— 期望值的唯一来源,不手抄 ──
const PRE_REF = 'e20bd9a~1'
function loadConfig(src) {
  return new Function(
    src
      .replace(/^import \{ SPEC_TEST_LIB \}.*$/m, 'const SPEC_TEST_LIB = []')
      .replace('export const recordSheetConfigs =', 'const recordSheetConfigs =') +
      '\nreturn recordSheetConfigs'
  )()
}
const preSrc = execFileSync('git', ['show', `${PRE_REF}:frontend/src/core/views/recordSheetConfigs.js`], {
  cwd: ROOT, maxBuffer: 16 * 1024 * 1024,
}).toString('utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
const pre = loadConfig(preSrc)
const EXP_MOLD_P1 = pre.RD_MOLD_PROC.grid
const EXP_MOLD_P2 = pre.RD_MOLD_FORMULA.grid
const EXP_ASM_P1 = pre.RD_ASM_PROC.dataTables[0].cols.map((c) => c.w)
const EXP_ASM_P2 = pre.RD_ASM_BOM.grid
const EXP_FORMULA_ROWS = pre.RD_MOLD_FORMULA.sections[0].rows.length
const EXP_FORMULA_LABELS = pre.RD_MOLD_FORMULA.sections[0].rows[0].grid.map((c) => c.label)

const SQLCMD = [
  process.env.SQLCMD,
  'sqlcmd',
  'C:\\Program Files\\Microsoft SQL Server\\Client SDK\\ODBC\\170\\Tools\\Binn\\SQLCMD.EXE',
].filter(Boolean)
function sqlRaw(q) {
  let lastErr = null
  for (const bin of SQLCMD) {
    try {
      return execFileSync(bin, ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
        '-W', '-s', '|', '-f', '65001', '-Q', q], { encoding: 'utf8' })
    } catch (e) { lastErr = e; if (e.code !== 'ENOENT') throw e }
  }
  throw lastErr
}
function sqlOne(q) {
  const out = sqlRaw(q)
  const lines = out.split(/\r?\n/).map((s) => s.trim())
    .filter((s) => s && !/^-+(\|-+)*$/.test(s) && !/^\(\d+\s/.test(s))
  return lines.length ? lines[0].split('|')[0].trim() : ''
}
function pdfPageCount(buf) {
  const m = buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g)
  return m ? m.length : 0
}

const MOLD_TEXT = '探针:配料要求(版式返工验收)'
const ASM_KIND = '探针产品种类'
const MOLD_MAT = 'P-MOLD-LAYOUT-001'
const ASM_MAT = 'P-ASM-LAYOUT-001'

async function main() {
  const made = []
  const login = await (await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = login?.data?.token
  if (!token) { console.error('admin 登录失败', login); process.exit(1) }
  const A = async (p, opts = {}) => {
    const res = await fetch(`${API}${p}`, {
      ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(opts.headers || {}) },
    })
    let body = null
    try { body = await res.json() } catch { /* 空响应体 */ }
    return { http: res.status, code: body?.code, msg: body?.message || body?.msg || '', data: body?.data }
  }
  const listOf = async (pc) => (await A('/api/px/queryFormDataList', {
    method: 'POST', body: JSON.stringify({ panelCode: pc, pageNo: 1, pageSize: 300 }),
  })).data?.list || []
  const callBtn = (pc, buttonName, formData = {}) => A('/api/px/callButton', {
    method: 'POST', body: JSON.stringify({ panelCode: pc, buttonName, formData, buttonParam: {} }),
  })

  console.log(`API=${API}  FRONT=${FRONT}`)
  console.log(`期望值来源:git ${PRE_REF}:frontend/src/core/views/recordSheetConfigs.js`)
  console.log('  成型工艺清单 页1 grid :', JSON.stringify(EXP_MOLD_P1))
  console.log('  成型配方     页2 grid :', JSON.stringify(EXP_MOLD_P2))
  console.log('  组装工艺清单 页1 列宽 :', JSON.stringify(EXP_ASM_P1))
  console.log('  组装BOM表    页2 grid :', JSON.stringify(EXP_ASM_P2))

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-layout-'))
  let edge = null
  let ws = null
  const pdfs = []
  try {
    edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--window-size=1760,1400', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
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

    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1400, deviceScaleFactor: 1, mobile: false })
    await nav(`${FRONT}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await nav('about:blank') // 必须整页重载一次,否则被弹回登录页

    // ── DOM 抓取工具 ──
    const tabs = () => ev(`[].slice.call(document.querySelectorAll('.rsp-page-tab')).map(function(t){return t.textContent.trim()})`)
    const clickTab = (title) => ev(`(function(){
      var ts=[].slice.call(document.querySelectorAll('.rsp-page-tab'));
      for(var i=0;i<ts.length;i++){ if(ts[i].textContent.trim()===${JSON.stringify(title)}){ ts[i].click(); return 1 } }
      return 0 })()`)
    /** 取「页面上所有可见 table」的列宽(px,整数)+ 结构概要,顺序即 DOM 顺序 */
    const tableSnap = () => ev(`(function(){
      var root=document.querySelector('.record-sheet'); if(!root) return null
      return [].slice.call(root.querySelectorAll('table')).filter(function(t){return t.offsetParent}).map(function(t){
        var cg=t.querySelector('colgroup')
        var cols=cg? [].slice.call(cg.querySelectorAll('col')).map(function(c){ return Math.round(parseFloat(c.style.width)||0) }) : []
        cols=cols.filter(function(w){ return w>0 })   // 去掉编辑态 0 宽操作列
        return { cls:t.className, tableW:Math.round(t.getBoundingClientRect().width),
          cols:cols, total:cols.reduce(function(a,b){return a+b},0) } }) })()`)
    const visibleBars = () => ev(`(function(){
      var root=document.querySelector('.record-sheet'); if(!root) return null
      return [].slice.call(root.querySelectorAll('.rs-sectionbar, .rsp-page-title'))
        .filter(function(e){return e.offsetParent}).map(function(e){return (e.textContent||'').trim()}) })()`)
    const plainTitles = () => ev(`(function(){
      var root=document.querySelector('.record-sheet'); if(!root) return null
      return [].slice.call(root.querySelectorAll('.rsp-plain-title'))
        .filter(function(e){return e.offsetParent}).map(function(e){return (e.textContent||'').trim()}) })()`)
    const visibleLabels = () => ev(`(function(){
      var root=document.querySelector('.record-sheet'); if(!root) return null
      return [].slice.call(root.querySelectorAll('td.rs-label'))
        .filter(function(e){return e.offsetParent}).map(function(e){return (e.textContent||'').trim()}) })()`)
    const docNoNow = () => ev(`(function(){
      var t=document.querySelector('.record-sheet'); var txt=t?(t.innerText||''):''
      var m=txt.match(/((?:MP|AP|MF|AB|PI)-\\d{4}-\\d{2}-\\d{4}|(?:MP|AP|MF|AB|PI)\\d{9,})/)
      return m? m[1] : '' })()`)
    const DQ = `[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.textContent.indexOf('查询单据')>=0 && d.getBoundingClientRect().height>0}).pop()`
    const clickSide = (label) => ev(`(function(){
      var all=[].slice.call(document.querySelectorAll('.as-side-btn,.as-side-menu-item,.as-side-btn-row>.as-side-btn'));
      for(var i=0;i<all.length;i++){ var t=(all[i].textContent||'').trim();
        if(t===${JSON.stringify(label)} && all[i].offsetParent){ all[i].click(); return 1 } }
      return 0 })()`)
    const hasSheet = () => ev(`[].slice.call(document.querySelectorAll('.record-sheet')).some(function(e){return e.offsetParent})`)
    const focusDoc = async (no) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        await clickSide('查询单据'); await sleep(900)
        await ev(`(function(){ var dlg=${DQ}; if(!dlg) return 'NO_DIALOG'
          var inp=dlg.querySelector('input'); if(!inp) return 'NO_INPUT'
          Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(inp, ${JSON.stringify(no)})
          inp.dispatchEvent(new Event('input',{bubbles:true})); return 'SET' })()`)
        await sleep(400)
        await ev(`(function(){ var dlg=${DQ}; if(!dlg) return 'NO_DIALOG'
          var bs=[].slice.call(dlg.querySelectorAll('button'))
          for(var i=0;i<bs.length;i++){ if(bs[i].textContent.trim()==='查询'){ bs[i].click(); return 'CLICKED' } }
          return 'NO_BTN' })()`)
        await sleep(2600)
        const seen = await docNoNow()
        if (seen === no) return seen
        await sleep(500)
      }
      return await docNoNow()
    }
    /** 给「标签 → 同行值格」的输入框赋值 */
    const setInput = (labelText, value) => ev(`(function(){
      var root=document.querySelector('.record-sheet'); if(!root) return 'NO_ROOT'
      var all=[].slice.call(root.querySelectorAll('td.rs-label')).filter(function(t){return (t.textContent||'').trim()===${JSON.stringify(labelText)}})
      var vis=all.filter(function(t){return t.offsetParent})
      if(!all.length) return 'NO_LABEL'
      if(!vis.length) return 'NO_VISIBLE_LABEL(共'+all.length+'个,都被页签隐藏)'
      var td=vis[0], val=td.nextElementSibling
      while(val && val.tagName!=='TD') val=val.nextElementSibling
      if(!val) return 'NO_VALUE_TD'
      var inp=val.querySelector('input,textarea')
      if(!inp) return 'NO_INPUT'
      var proto = inp.tagName==='TEXTAREA'? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto,'value').set.call(inp, ${JSON.stringify(value)})
      inp.dispatchEvent(new Event('input',{bubbles:true}))
      return 'OK' })()`)
    const addAndFill = (colKeyword, vals) => ev(`(async function(){
      var root=document.querySelector('.record-sheet'); if(!root) return 'NO_ROOT'
      var wraps=[].slice.call(root.querySelectorAll('.rsp-dt-wrap')).filter(function(w){return w.offsetParent})
      var w=wraps.filter(function(x){ return (x.textContent||'').indexOf(${JSON.stringify(colKeyword)})>=0 })[0]
      if(!w) return 'NO_WRAP('+wraps.length+')'
      var add=[].slice.call(w.querySelectorAll('.rs-add')).filter(function(e){return e.offsetParent})[0]
      if(!add) return 'NO_ADD'
      var tbl0=w.querySelector('table.rs-dt')
      var before=tbl0? tbl0.querySelectorAll('tbody tr').length : -1
      add.click()
      await new Promise(function(r){ setTimeout(r, 900) })
      var tbl=w.querySelector('table.rs-dt')
      var rows=[].slice.call(tbl.querySelectorAll('tbody tr')).filter(function(tr){ return tr.querySelectorAll('input,textarea').length>0 })
      if(!rows.length) return 'NO_ROW'
      var last=rows[rows.length-1]
      var ins=[].slice.call(last.querySelectorAll('input,textarea'))
      var vs=${JSON.stringify(vals)}
      for(var i=0;i<ins.length && i<vs.length;i++){ if(vs[i]===null) continue
        var el=ins[i]
        var proto = el.tagName==='TEXTAREA'? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
        Object.getOwnPropertyDescriptor(proto,'value').set.call(el, vs[i])
        el.dispatchEvent(new Event('input',{bubbles:true})) }
      return 'FILLED('+ins.length+') '+JSON.stringify({before:before, after:[].slice.call(tbl.querySelectorAll('tbody tr')).length}) })()`)
    const printCurrentTab = async (tag) => {
      await ev(`document.body.classList.add('approval-printing'); 'ok'`)
      await sleep(500)
      const r = await send('Page.printToPDF', {
        landscape: false, printBackground: true, paperWidth: 8.27, paperHeight: 11.69,
        marginTop: 0.31, marginBottom: 0.31, marginLeft: 0.31, marginRight: 0.31, preferCSSPageSize: false,
      })
      await ev(`document.body.classList.remove('approval-printing'); 'ok'`)
      if (!r.result?.data) return { pages: -1, err: JSON.stringify(r.error || r.result || {}) }
      const buf = Buffer.from(r.result.data, 'base64')
      const f = path.join(os.tmpdir(), `yj-layout-${tag}.pdf`)
      fs.writeFileSync(f, buf); pdfs.push(f)
      return { pages: pdfPageCount(buf), file: f, bytes: buf.length }
    }
    const eqArr = (a, b) => JSON.stringify(a) === JSON.stringify(b)

    // ════════════════════════════════════════════════════════════
    // ① 成型面板:页签 + 页1/页2 列宽 ≡ 原样
    // ════════════════════════════════════════════════════════════
    await nav(`${FRONT}/#/panelx/list/${MOLD}`); await sleep(2500)
    ok(await hasSheet(), '①-0 成型面板文书纸张已渲染(.record-sheet 可见)')
    const moldTabs = await tabs()
    ok(eqArr(moldTabs, ['成型工艺清单', '成型配方']), `①-1 ${MOLD} 页签数=2 且标题正确(实际 ${JSON.stringify(moldTabs)})`)

    const moldP1 = await tableSnap()
    const moldP1Bars = await visibleBars()
    const moldP1Head = await ev(`(function(){
      var t=document.querySelector('.record-sheet table.rs-head-t')
      return t? (t.innerText||'').replace(/\\s+/g,' ').slice(0,60) : null })()`)
    info(`成型页1 报告头内容 ${JSON.stringify(moldP1Head)}`)
    ok(/银嘉/.test(String(moldP1Head)) && /表单管理人/.test(String(moldP1Head)),
      `①-2b 成型页1 有自己的报告头(实际 ${JSON.stringify(moldP1Head)})`)
    ok(String(moldP1Head).includes(String(pre.RD_MOLD_PROC.staticTitle)),
      `①-2c 成型页1 报告头大标题 ≡ 原文 staticTitle「${pre.RD_MOLD_PROC.staticTitle}」`)
    console.log('── 成型 页1 实际列宽(按 DOM 表顺序)──')
    ;(moldP1 || []).forEach((t) => console.log(`     [${t.cls}] width=${t.tableW} cols=${JSON.stringify(t.cols)} total=${t.total}`))
    ok((moldP1 || []).length >= 4, `①-2 成型页1 渲染出 ${(moldP1 || []).length} 张表(报告头+产品基本信息+工序+检验要求)`)
    // 报告头/条件区/各区块 = 同一套 11 列网格
    ok(eqArr(moldP1[0].cols, EXP_MOLD_P1), `①-3 成型页1 报告头列宽 ≡ 原文 11 列 ${JSON.stringify(EXP_MOLD_P1)}(实际 ${JSON.stringify(moldP1[0].cols)})`)
    ok(moldP1.every((t) => eqArr(t.cols, EXP_MOLD_P1)),
      `①-4 成型页1 全部 ${moldP1.length} 张表列宽都 ≡ 原文 11 列(竖线全页对齐)`)
    ok(eqArr(moldP1Bars, ['产品基本信息', '工序', '检验要求']),
      `①-5 成型页1 区块顺序 ≡ 原文(产品基本信息/工序/检验要求)(实际 ${JSON.stringify(moldP1Bars)})`)
    const moldP1Labels = await visibleLabels()
    ok(eqArr(moldP1Labels.slice(0, 6), ['产品编号', '产品名称', '炭棒规格', '产品管控类型', '外观要求', '生产车间']),
      `①-6 成型页1「产品基本信息」标签行 ≡ 原文 6 格(实际 ${JSON.stringify(moldP1Labels.slice(0, 6))})`)
    // 页 1 的行内三格炭棒规格(回归:e20bd9a 前 692d946 的把 80/80/80 改回等宽)
    const moldP1SpecRow = await ev(`(function(){
      var root=document.querySelector('.record-sheet')
      var tds=[].slice.call(root.querySelectorAll('td')).filter(function(t){return t.offsetParent})
      var out=[]
      tds.forEach(function(td,i){ var r=td.getBoundingClientRect()
        if(r.width>0 && r.width<120 && out.length<6) out.push(Math.round(r.width)) })
      return out })()`)
    info(`成型页1 窄格宽度采样 ${JSON.stringify(moldP1SpecRow)}`)

    await clickTab('成型配方'); await sleep(900)
    const moldP2 = await tableSnap()
    const moldP2Bars = await visibleBars()
    const moldP2Labels = await visibleLabels()
    console.log('── 成型 页2 实际列宽(按 DOM 表顺序)──')
    ;(moldP2 || []).forEach((t) => console.log(`     [${t.cls}] width=${t.tableW} cols=${JSON.stringify(t.cols)} total=${t.total}`))
    ok(eqArr(moldP2[0].cols, EXP_MOLD_P2),
      `①-7 **成型页2 列宽 ≡ 原文 13 列** ${JSON.stringify(EXP_MOLD_P2)}(实际 ${JSON.stringify(moldP2[0].cols)})`)
    ok(moldP2.every((t) => eqArr(t.cols, EXP_MOLD_P2)),
      `①-8 成型页2 全部 ${moldP2.length} 张表列宽 ≡ 原文 13 列`)
    ok(moldP2[0].total === 1040, `①-9 成型页2 总宽 = 原文 1040(实际 ${moldP2[0].total})`)
    ok(eqArr(moldP2Bars, ['产品基本信息', '配方表✎ 字段编辑', '配料要求']),
      `①-10 成型页2 区块顺序 ≡ 原文(产品基本信息/配方表/配料要求)(实际 ${JSON.stringify(moldP2Bars)})`)
    ok(eqArr(moldP2Labels.slice(0, EXP_FORMULA_LABELS.length), EXP_FORMULA_LABELS),
      `①-11 成型页2「产品基本信息」标签行 ≡ 原文 ${JSON.stringify(EXP_FORMULA_LABELS)}(实际 ${JSON.stringify(moldP2Labels.slice(0, EXP_FORMULA_LABELS.length))})`)
    // 原样形态:grid 两行式(label 行 + value 行),不是合并时的 pairs/补行形态
    // 定位「产品基本信息」那张 section 表(不是报告头表),只数它自己的行
    const moldP2FirstTableRows = await ev(`(function(){
      var root=document.querySelector('.record-sheet')
      var ts=[].slice.call(root.querySelectorAll('table.rs-t')).filter(function(x){return x.offsetParent && !x.className.includes('rs-head-t')})
      var t=ts.filter(function(x){ return (x.innerText||'').indexOf('产品基本信息')>=0 })[0]
      return t? [].slice.call(t.querySelectorAll('tbody tr')).map(function(tr){
        return [].slice.call(tr.children).map(function(td){ return (td.textContent||'').trim().slice(0,10) }) }) : null })()`)
    console.log('── 成型页2 「产品基本信息」表逐行 ──')
    ;(moldP2FirstTableRows || []).forEach((r, i) => console.log(`     row${i}: ${JSON.stringify(r)}`))
    ok((moldP2FirstTableRows || []).length === EXP_FORMULA_ROWS + 1,
      `①-12 成型页2「产品基本信息」= 原文 ${EXP_FORMULA_ROWS} 行 + 区块条 1 行(实际 ${(moldP2FirstTableRows || []).length} 行)`)
    const moldP2Head = await ev(`(function(){
      var t=document.querySelector('.record-sheet table.rs-head-t')
      return t? (t.innerText||'').replace(/\\s+/g,' ').slice(0,60) : null })()`)
    info(`成型页2 报告头内容 ${JSON.stringify(moldP2Head)}`)
    ok(/银嘉/.test(String(moldP2Head)) && /密级/.test(String(moldP2Head)),
      `①-12b 成型页2 有自己的报告头(报告头只在声明 showHead 的页出现;实际 ${JSON.stringify(moldP2Head)})`)
    // 标题 ≡ 原文该面板自己的 staticTitle(成型配方=炭棒配方管控清单),不是工艺清单的标题
    ok(String(moldP2Head).includes(String(pre.RD_MOLD_FORMULA.staticTitle)),
      `①-12c 成型页2 报告头大标题 ≡ 原文 staticTitle「${pre.RD_MOLD_FORMULA.staticTitle}」(实际 ${JSON.stringify(moldP2Head)})`)
    ok(!String(moldP2Head).includes(String(pre.RD_MOLD_PROC.staticTitle)),
      `①-12d 成型页2 不显示页1 的标题「${pre.RD_MOLD_PROC.staticTitle}」`)
    // 配方表 7 列(13 格跨度合并后仍是 7 个表头);编辑态多一列 0 宽操作列,按宽度过滤
    const moldP2Cols = await ev(`(function(){
      var root=document.querySelector('.record-sheet')
      var ts=[].slice.call(root.querySelectorAll('table.rs-dt')).filter(function(t){return t.offsetParent})
      var t=ts.filter(function(x){ return (x.textContent||'').indexOf('物料种类')>=0 })[0]
      return t? [].slice.call(t.querySelectorAll('tr.rs-grp th')).filter(function(h){return h.offsetParent && h.getBoundingClientRect().width>0}).map(function(h){return (h.textContent||'').trim()}) : null })()`)
    ok(eqArr(moldP2Cols, ['No.', '物料种类', '物料编号', '物料名称', '实际添加\n比例%', '单支\n物料含量g', '设计添加\n量']),
      `①-13 成型页2 配方表 = 原文 7 列表头(实际 ${JSON.stringify(moldP2Cols)})`)

    // 串页检查:页 1 区块不出现在页 2,反之亦然(v-show 实现,offsetParent 为 null)
    const moldP2HasP1 = (moldP2Bars || []).some((b) => b.includes('检验要求') || b === '工序')
    ok(!moldP2HasP1, '①-14 成型页2 不串入页1 的区块(工序/检验要求都不在)')
    await clickTab('成型工艺清单'); await sleep(700)
    const moldP1Bars2 = await visibleBars()
    ok(!(moldP1Bars2 || []).some((b) => b.includes('配方表') || b.includes('配料要求')),
      `①-15 成型页1 不串入页2 的区块(实际 ${JSON.stringify(moldP1Bars2)})`)

    // ════════════════════════════════════════════════════════════
    // ② 组装面板:页1 plain 原列宽 / 页2 report 原版式
    // ════════════════════════════════════════════════════════════
    await nav(`${FRONT}/#/panelx/list/${ASM}`); await sleep(2500)
    const asmTabs = await tabs()
    ok(eqArr(asmTabs, ['组装工艺清单', '组装BOM表']), `②-1 ${ASM} 页签数=2 且标题正确(实际 ${JSON.stringify(asmTabs)})`)

    const asmP1 = await tableSnap()
    const asmP1Titles = await plainTitles()
    console.log('── 组装 页1 实际列宽 ──')
    ;(asmP1 || []).forEach((t) => console.log(`     [${t.cls}] width=${t.tableW} cols=${JSON.stringify(t.cols)} total=${t.total}`))
    ok(eqArr(asmP1Titles, ['炭棒滤芯组装/包装段-关键工序控制清单']),
      `②-2 组装页1 = plain 标题条(实际 ${JSON.stringify(asmP1Titles)})`)
    ok(eqArr(asmP1[0].cols, EXP_ASM_P1),
      `②-3 **组装页1 工序清单列宽 ≡ 原文 ${JSON.stringify(EXP_ASM_P1)}**(实际 ${JSON.stringify(asmP1[0].cols)})`)
    ok(asmP1[0].total === EXP_ASM_P1.reduce((a, b) => a + b, 0),
      `②-4 组装页1 表宽 = 原文 ${EXP_ASM_P1.reduce((a, b) => a + b, 0)}(实际 ${asmP1[0].total})`)
    const asmP1HeadTable = (asmP1 || []).some((t) => t.cls && t.cls.includes('rs-head-t'))
    ok(!asmP1HeadTable, '②-5 组装页1 没有报告头表(plain 版式即为原样)')

    await clickTab('组装BOM表'); await sleep(900)
    const asmP2 = await tableSnap()
    const asmP2Bars = await visibleBars()
    const asmP2Labels = await visibleLabels()
    const asmP2PlainTitles = await plainTitles()
    console.log('── 组装 页2 实际列宽 ──')
    ;(asmP2 || []).forEach((t) => console.log(`     [${t.cls}] width=${t.tableW} cols=${JSON.stringify(t.cols)} total=${t.total}`))
    ok((asmP2 || []).some((t) => t.cls && t.cls.includes('rs-head-t')),
      `②-6 **组装页2 渲染出报告头表(report 版式)**(实际类名 ${JSON.stringify((asmP2 || []).map((t) => t.cls))})`)
    const asmP2HeadNo = await ev(`(function(){
      var t=document.querySelector('.record-sheet table.rs-head-t')
      return t? (t.innerText||'').replace(/\\s+/g,' ').slice(0,70) : null })()`)
    info(`组装页2 报告头内容 ${JSON.stringify(asmP2HeadNo)}`)
    ok(String(asmP2HeadNo).includes(String(pre.RD_ASM_BOM.staticTitle)),
      `②-6c 组装页2 报告头大标题 ≡ 原文 staticTitle「${pre.RD_ASM_BOM.staticTitle}」(实际 ${JSON.stringify(asmP2HeadNo)})`)
    ok(asmP2[0].cols && asmP2[0].cols.length === 4 && asmP2[0].cls.includes('rs-head-t'),
      `②-6b 组装页2 报告头表自身用的是 4 列网格 ${JSON.stringify(asmP2[0].cols)}`)
    ok((asmP2PlainTitles || []).length === 0,
      `②-7 组装页2 不再显示 plain 标题条(实际 ${JSON.stringify(asmP2PlainTitles)})`)
    ok(eqArr(asmP2[0].cols, EXP_ASM_P2),
      `②-8 **组装页2 列宽 ≡ 原文 4 列 ${JSON.stringify(EXP_ASM_P2)}**(实际 ${JSON.stringify(asmP2[0].cols)})`)
    ok(eqArr(asmP2Bars, ['一、产品基本信息', '二、炭棒滤芯组装/包装物料清单📦 从物料清单引用', '修订记录']),
      `②-9 组装页2 区块顺序 ≡ 原文(一、产品基本信息/二、物料清单/修订记录)(实际 ${JSON.stringify(asmP2Bars)})`)
    ok(eqArr(asmP2Labels, ['产品编号', '产品名称', '产品种类', '成品重量', '整体规格（外径）', '整体规格（长度）']),
      `②-10 组装页2「一、产品基本信息」标签 ≡ 原文 6 格(实际 ${JSON.stringify(asmP2Labels)})`)
    // page-1 的 plain 工序清单不得串到页 2(页 1 的表头是 工序/工序控制内容/管控要求/检查比例)
    const asmP2ProcHead = await ev(`(function(){
      var root=document.querySelector('.record-sheet')
      return [].slice.call(root.querySelectorAll('table.rs-dt')).filter(function(t){return t.offsetParent})
        .some(function(t){ return (t.innerText||'').indexOf('工序控制内容')>=0 }) })()`)
    ok(!asmP2ProcHead, '②-11 组装页2 不串入页1 的工序清单')
    const asmP2Cols = await ev(`(function(){
      var root=document.querySelector('.record-sheet')
      var ts=[].slice.call(root.querySelectorAll('table.rs-dt')).filter(function(t){return t.offsetParent})
      // 编辑态多一列 0 宽操作列(<th class="rs-th-op">),不是业务列 —— 按 offsetWidth>0 过滤
      return ts.map(function(t){ return [].slice.call(t.querySelectorAll('tr.rs-grp th,tr.rs-grp2 th'))
        .filter(function(h){return h.offsetParent && h.getBoundingClientRect().width>0})
        .map(function(h){return (h.textContent||'').trim()}) }) })()`)
    ok(eqArr(asmP2Cols[0], ['物料名', '物料编号', '物料规格', '外观要求', '用量']),
      `②-12 组装页2 物料清单 5 列 ≡ 原文(实际 ${JSON.stringify(asmP2Cols[0])})`)
    ok(eqArr(asmP2Cols[1], ['序号', '更改内容', '更改原因', '更改时间', '责任人', '备注']),
      `②-13 组装页2 修订记录 6 列 ≡ 原文(实际 ${JSON.stringify(asmP2Cols[1])})`)

    // ════════════════════════════════════════════════════════════
    // ③ 页 2 可编辑并保存落库(真接口链路)
    // ════════════════════════════════════════════════════════════
    const enterModifyMode = async (panelCode, no) => {
      const req = await callBtn(panelCode, '申请修改', { 编号: no })
      const appr = await callBtn(panelCode, '修改审批通过', { 编号: no })
      return { req: `${req.code}/${req.msg || req.data?.['单据状态'] || ''}`, appr: `${appr.code}/${appr.data?.['单据状态'] || appr.msg}` }
    }
    const asmDraft = await callBtn(ASM, '新增')
    const ASM_UI_DOC = asmDraft.data?.['编号'] || ''
    if (ASM_UI_DOC) made.push(ASM_UI_DOC)
    ok(!!ASM_UI_DOC, `③-0 取一张草稿单用于界面编辑(${ASM_UI_DOC}/${asmDraft.data?.['单据状态']})`)
    const asmSeed = await callBtn(ASM, '保存为草稿', { 编号: ASM_UI_DOC, 产品编号: 'T999', 产品名称: '探针产品(垫)' })
    const asmMod = await enterModifyMode(ASM, ASM_UI_DOC)
    ok(asmMod.appr.startsWith('200'), `③-0b 推入「修改中」以便界面编辑(申请修改 ${asmMod.req};修改审批通过 ${asmMod.appr};接口垫必填 ${asmSeed.code})`)
    await nav(`${FRONT}/#/panelx/list/${ASM}`); await sleep(1500); await focusDoc(ASM_UI_DOC)
    await clickTab('组装BOM表'); await sleep(900)
    // 页 2 的列宽在**编辑态**下也应保持原样(数据表会多一列 0 宽操作列,已过滤)
    const asmP2Edit = await tableSnap()
    ok(eqArr(asmP2Edit[0].cols, EXP_ASM_P2),
      `③-1 组装页2 **编辑态**列宽仍 ≡ 原文 4 列(实际 ${JSON.stringify(asmP2Edit[0].cols)})`)
    const asmSet = await setInput('产品种类', ASM_KIND)
    const asmRow = await addAndFill('物料清单', [ASM_MAT, 'P-ASM-L001', '探针规格', '探针外观', '2'])
    info(`页2:产品种类=${asmSet};新增物料行=${asmRow}`)
    ok(asmSet === 'OK' && /^FILLED/.test(String(asmRow)), `③-2 页2 头字段与明细行都可编辑(头 ${asmSet} / 明细 ${asmRow})`)
    await sleep(400)
    await clickSide('保存'); await sleep(3600)
    const asmHeadAfter = sqlOne(`SELECT ISNULL(产品种类,N'(null)') FROM rd_asm_proc_head WHERE 单据编号='${ASM_UI_DOC}';`)
    ok(asmHeadAfter === ASM_KIND, `③-3 页2 头字段落库:rd_asm_proc_head.产品种类 = ${JSON.stringify(asmHeadAfter)}(期望 ${JSON.stringify(ASM_KIND)})`)
    const asmLine = sqlOne(`SELECT COUNT(*) FROM rd_asm_proc_detail WHERE 单据编号='${ASM_UI_DOC}' AND 表区=N'物料清单' AND 物料编号=N'P-ASM-L001' AND ISNULL(asp_cancel,'N')<>'Y';`)
    ok(asmLine === '1', `③-4 页2 明细行落库:rd_asm_proc_detail 物料清单 1 行(实际 ${asmLine})`)
    const apiRead = (await listOf(ASM)).find((x) => String(x['编号']) === ASM_UI_DOC)
    ok(apiRead?.['产品种类'] === ASM_KIND, `③-5 接口回读一致(产品种类=${JSON.stringify(apiRead?.['产品种类'])})`)
    console.log('── SQL 佐证(探针单 rd_asm_proc_detail)──\n' + sqlRaw(
      `SELECT 'LINE|' + ISNULL(表区,'') + '|' + ISNULL(物料名,'') + '|' + ISNULL(物料编号,'') + '|' + ISNULL(物料规格,'') + '|' + ISNULL(外观要求,'') + '|' + ISNULL(用量,'') + '|' + 单据编号 FROM rd_asm_proc_detail WHERE 单据编号='${ASM_UI_DOC}' ORDER BY id;`))

    // 成型页 2(配方表)也验一遍可编辑落库 —— 它换了 13 列网格,跨度分配是重点
    const moldDraft = await callBtn(MOLD, '新增')
    const MOLD_UI_DOC = moldDraft.data?.['编号'] || ''
    if (MOLD_UI_DOC) made.push(MOLD_UI_DOC)
    ok(!!MOLD_UI_DOC, `③-6 取一张成型草稿单(${MOLD_UI_DOC})`)
    await callBtn(MOLD, '保存为草稿', { 编号: MOLD_UI_DOC, 产品编号: 'T999', 产品名称: '探针产品(垫)' })
    const moldMod = await enterModifyMode(MOLD, MOLD_UI_DOC)
    ok(moldMod.appr.startsWith('200'), `③-6b 成型单推入「修改中」(${moldMod.appr})`)
    await nav(`${FRONT}/#/panelx/list/${MOLD}`); await sleep(1500); await focusDoc(MOLD_UI_DOC)
    await clickTab('成型配方'); await sleep(900)
    const moldP2Edit = await tableSnap()
    ok(eqArr(moldP2Edit[0].cols, EXP_MOLD_P2),
      `③-7 成型页2 **编辑态**列宽仍 ≡ 原文 13 列(实际 ${JSON.stringify(moldP2Edit[0].cols)})`)
    const rHead = await setInput('配料要求', MOLD_TEXT)
    const rRow = await addAndFill('配方表', ['', '探针种类', MOLD_MAT, '探针物料名', '12.5', '3.25', '4.75'])
    info(`页2:配料要求=${rHead};新增配方行=${rRow}`)
    ok(rHead === 'OK' && /^FILLED/.test(String(rRow)), `③-8 成型页2 头字段与配方行都可编辑(头 ${rHead} / 明细 ${rRow})`)
    await sleep(400)
    await clickSide('保存'); await sleep(3600)
    const moldHeadAfter = sqlOne(`SELECT ISNULL(配料要求,N'(null)') FROM rd_mold_proc_head WHERE 单据编号='${MOLD_UI_DOC}';`)
    ok(moldHeadAfter === MOLD_TEXT, `③-9 成型页2 头字段落库:rd_mold_proc_head.配料要求 = ${JSON.stringify(moldHeadAfter)}`)
    const moldLine = sqlOne(`SELECT COUNT(*) FROM rd_mold_proc_detail WHERE 单据编号='${MOLD_UI_DOC}' AND 表区=N'配方表' AND 物料编号=N'${MOLD_MAT}' AND ISNULL(asp_cancel,'N')<>'Y';`)
    ok(moldLine === '1', `③-10 成型页2 配方行落库(实际 ${moldLine})`)

    // ════════════════════════════════════════════════════════════
    // ④ 每个页签 printToPDF 页数 = 1
    // ════════════════════════════════════════════════════════════
    const printCases = []
    await nav(`${FRONT}/#/panelx/list/${MOLD}`); await sleep(1500); await focusDoc(MOLD_UI_DOC)
    for (const title of ['成型工艺清单', '成型配方']) {
      await clickTab(title); await sleep(900)
      printCases.push([MOLD, title, await printCurrentTab(`${MOLD}-${title.replace(/[^\u4e00-\u9fa5]/g, '')}`)])
    }
    await nav(`${FRONT}/#/panelx/list/${ASM}`); await sleep(1500); await focusDoc(ASM_UI_DOC)
    for (const title of ['组装工艺清单', '组装BOM表']) {
      await clickTab(title); await sleep(900)
      printCases.push([ASM, title, await printCurrentTab(`${ASM}-${title.replace(/[^\u4e00-\u9fa5]/g, '')}`)])
    }
    console.log('── printToPDF 结果(A4 / 页边距 8mm / body.approval-printing)──')
    for (const [pc, title, r] of printCases) {
      console.log(`     · ${pc} / ${title}: pages=${r.pages} bytes=${r.bytes} file=${r.file}${r.err ? ' err=' + r.err : ''}`)
      ok(r.pages === 1, `④ 打印 ${pc}·${title} 页数=1(实际 ${r.pages})`)
    }

    ws.close(); ws = null
  } finally {
    if (ws) { try { ws.close() } catch { /* noop */ } }
    if (edge) edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch { /* noop */ }
  }

  // ════════════════════════════════════════════════════════════════
  // ⑤ 探针自建数据清理
  //    🔴 只按本轮记录到的**精确单号 IN 列表**——绝不用 LIKE/前缀范围条件
  //    (上一轮用 LIKE 'MP-2026-09-%' 收尾,误删了库里原有 12 张真实单据)
  // ════════════════════════════════════════════════════════════════
  console.log('\n── ⑤ 探针数据清理 ──')
  const inList = made.length ? `'${made.join("','")}'` : "''"
  const beforeHead = sqlOne(`SELECT COUNT(*) FROM (
      SELECT 单据编号 FROM rd_mold_proc_head WHERE 单据编号 IN (${inList})
      UNION ALL SELECT 单据编号 FROM rd_asm_proc_head WHERE 单据编号 IN (${inList})) x;`)
  ok(beforeHead === String(made.length), `⑤-1 探针单在业务表里 ${beforeHead} 张 = 新建 ${made.length} 张`)
  for (const no of made) {
    const pc = no.startsWith('AP') ? ASM : MOLD
    const r = await callBtn(pc, '删除', { 编号: no })
    info(`清理:${no} 走「删除」→ ${r.code}/${r.data?.['单据状态'] || r.msg}`)
  }
  const cleanSteps = [
    ['yj_form_approval', `DELETE FROM yj_form_approval WHERE form_no IN (${inList})`],
    ['yj_doc_modify_log', `DELETE FROM yj_doc_modify_log WHERE doc_no IN (${inList})`],
    ['yj_doc_status', `DELETE FROM yj_doc_status WHERE doc_no IN (${inList})`],
    ['rd_mold_proc_detail', `DELETE FROM rd_mold_proc_detail WHERE 单据编号 IN (${inList})`],
    ['rd_mold_proc_head', `DELETE FROM rd_mold_proc_head WHERE 单据编号 IN (${inList})`],
    ['rd_asm_proc_detail', `DELETE FROM rd_asm_proc_detail WHERE 单据编号 IN (${inList})`],
    ['rd_asm_proc_head', `DELETE FROM rd_asm_proc_head WHERE 单据编号 IN (${inList})`],
    ['yj_doc_status(孤儿)', `DELETE FROM yj_doc_status WHERE doc_no IN (${inList})`],
  ]
  for (const [tbl, sql] of cleanSteps) {
    try { sqlRaw(sql) } catch (e) { info(`清理 ${tbl} 失败:${String(e.message || e).slice(0, 160)}`) }
  }
  const left = sqlOne(`SELECT (SELECT COUNT(*) FROM rd_mold_proc_head WHERE 单据编号 IN (${inList}))
      + (SELECT COUNT(*) FROM rd_mold_proc_detail WHERE 单据编号 IN (${inList}))
      + (SELECT COUNT(*) FROM rd_asm_proc_head WHERE 单据编号 IN (${inList}))
      + (SELECT COUNT(*) FROM rd_asm_proc_detail WHERE 单据编号 IN (${inList}))
      + (SELECT COUNT(*) FROM yj_doc_status WHERE doc_no IN (${inList}))
      + (SELECT COUNT(*) FROM yj_form_approval WHERE form_no IN (${inList}));`)
  ok(left === '0', `⑤-2 探针残留 0 行(头/明细/状态/留痕合计,实际 ${left})`)
  const afterMold = sqlOne(`SELECT COUNT(*) FROM rd_mold_proc_head WHERE ISNULL(asp_cancel,'N')<>'Y';`)
  const afterAsm = sqlOne(`SELECT COUNT(*) FROM rd_asm_proc_head WHERE ISNULL(asp_cancel,'N')<>'Y';`)
  info(`${MOLD} 存活头行 ${afterMold};${ASM} 存活头行 ${afterAsm}`)
  info('s_allno / yj_usage_log 未触碰;*_bak_20260911 备份表未触碰')

  console.log(fails.length
    ? `\n结果: ${fails.length} 项失败\n` + fails.map((f) => '  - ' + f).join('\n')
    : '\n结果: 全部通过')
  process.exit(fails.length ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
