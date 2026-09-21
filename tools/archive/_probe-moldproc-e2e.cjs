'use strict'
/**
 * _probe-moldproc-e2e.cjs — 成型工艺清单「配方计算」**真人上手**端到端探针
 *
 * 目的:像工艺员一样从零走一遍,回答"功能和计算到底实现没有":
 *   新增单 → 逐格填(产品基本信息/工序/配方表) → 🧮 配方计算 → 填入单据 → 保存 → 关掉重开核对 → 清理
 *
 * 三层断言:
 *   A 功能在不在   —— 按钮/弹窗/料位/烧结尺寸带出/回填预览/填入后纸面变化/保存与重开
 *   B 算得对不对   —— 弹窗③结果 + 纸面各格 与**引擎口径期望值**逐位一致
 *                     (期望值由 tools/archive/_calc-e2e-expect.mjs 用 recipeEngine 算出;
 *                      引擎已由 85 条 exe 黄金向量逐位钉住 ⇒ 等价于 exe 的口径)
 *   C 映射对不对   —— 结果 → 纸面字段的落点(灌料3/水分/长度3/重量3/检验4/密度2/配方表2列)
 *
 * 用法:node _probe-moldproc-e2e.cjs [http://localhost:5173]   (默认 8090 打包产物)
 * 证据:tools/archive/_shots/e2e-*.png;清理:探针自建的产品信息+成型单按精确单号物理删除,残留 0
 *
 * 踩过的坑(写探针前必读,否则会误判成产品 bug):
 *   1) 面板默认停在「修订记录」页,而**那页不出报告头** ⇒ 不切页读不到单据编号(v1 就被这条坑了);
 *   2) 一张 `.record-sheet` 里装着全部三页的行,隐藏页的行**仍在 DOM 里** ⇒ 一切查询必须按
 *      `tr.offsetParent` 过滤可见行,否则值填进了隐藏页(v1 的 12 格就填丢了);
 *   3) 页1 的产品基本信息/灌料三值/检验各块是**标签行 + 值行两行式**,不是"标签右邻格";
 *   4) 配方表「物料种类」必须填**档案口径**的词(炭粉/胶粉/功能料-粉末/功能料-颗粒),
 *      填「粉料」「折算料」会被静默降级成粉料分组(只弹窗里一行告警) —— 见 CONTEXT.md 待办;
 *   5) el-select 的 input 是 readonly 且无 placeholder ⇒ 只能点 wrapper 再点下拉项。
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn, execFileSync } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const BASE = process.argv[2] || 'http://localhost:8090'
const FRONT = BASE
const MOLD = 'RD_MOLD_PROC'
const PROD_PANEL = 'RD_PROD_INFO'
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9341
const SHOTS = path.join(__dirname, '_shots')
const SQL = (q) => {
  try {
    return execFileSync('sqlcmd', ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
      '-I', '-f', '65001', '-W', '-h', '-1', '-Q', 'SET NOCOUNT ON; ' + q], { encoding: 'utf8' })
  } catch (e) { return '<<SQL-ERR ' + (e.stdout || e.message) + '>>' }
}

/* ── 探针输入(与 _calc-e2e-expect.mjs 完全一致)──────────────────────────── */
const PROD_CODE = 'ZZ-E2E-368'
const PROD_NAME = '探针炭棒E2E'
const RECIPE_ROWS = [
  { 物料种类: '炭粉', 物料编号: 'YJ-XH-001', 物料名称: '鑫恒（80-250）', 设计添加量: '0.62' },
  { 物料种类: '胶粉', 物料编号: 'YJ-ZX-003', 物料名称: 'M2-D胶粉', 设计添加量: '0.30' },
  { 物料种类: '胶粉', 物料编号: 'YJ-SLD-009', 物料名称: '4012T1胶粉', 设计添加量: '0.08' },
  { 物料种类: '功能料-颗粒', 物料编号: 'HP-12', 物料名称: 'HP-12', 设计添加量: '2' },
]
/** 引擎口径期望(exe 等价,来自 _calc-e2e-expect.mjs;一切几=2、含水率档案带出 6%)*/
const EXP_HEAD = {
  '理论最低灌料重量g': '244.1', '理论灌料中间值g': '245.9', '理论最高灌料重量g': '247.6',
  '理论水分': '3.72',
  '最短长度mm': '253.5', '中间值mm': '256.0', '最长长度mm': '258.5',
  '最低重量g': '235.0', '中间值g': '236.7', '最高重量g': '238.4',
}
const EXP_ROWS = [
  { code: 'YJ-XH-001', ratio: '60.63%', amount: '143.55' },
  { code: 'YJ-ZX-003', ratio: '29.75%', amount: '70.43' },
  { code: 'YJ-SLD-009', ratio: '7.93%', amount: '18.78' },
  { code: 'HP-12', ratio: '1.69%', amount: '4.00' },
]
const EXP_SINTER = { 外径: '59.5', 外径公差: '±0.5', 内径: '39.5', 内径公差: '±0.5' }  // 车间1 + 60*40
const EXP_DENSITY = { 下限: '0.58', 上限: '0.60' }

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
  if (!token) throw new Error('登录失败:' + JSON.stringify(lr))
  const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` }
  const callBtn = async (panel, buttonName, formData) => (await (await fetch(`${BASE}/api/px/callButton`, {
    method: 'POST', headers: H, body: JSON.stringify({ panelCode: panel, buttonName, formData, buttonParam: {} }),
  })).json())

  // ── 准备:先建一张探针产品信息(真实流程里工艺员也得先有产品,参照弹窗才选得到)──
  const prodCreated = await callBtn(PROD_PANEL, '保存为草稿', {
    产品编号: PROD_CODE, 产品名称: PROD_NAME, 产品形态: '圆柱', 产品管控等级: 'B', 炭棒外径: '59.5', 炭棒内径: '39.5',
  })
  const prodNo = prodCreated?.data?.['编号']
  if (!prodNo) throw new Error('探针产品信息建失败:' + JSON.stringify(prodCreated))
  console.log(`  --   造数:产品信息 ${prodNo}(${PROD_CODE} / ${PROD_NAME})`)

  fs.mkdirSync(SHOTS, { recursive: true })
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-molde2e-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1760,1600', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  let ws = null
  let docNo = ''
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
      const f = path.join(SHOTS, `e2e-${tag}.png`)
      fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'))
      return f
    }
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1600, deviceScaleFactor: 1, mobile: false })
    await nav(`${FRONT}/#/login`)
    await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lr.data.user))}); 'ok'`)
    await nav('about:blank')                                   // hash 变化不重载,必须先离开
    await nav(`${FRONT}/#/panelx/list/${MOLD}`)
    await sleep(2500)

    /* ═══════════ DOM 工具(全部按「可见行」过滤;见文件头踩坑 2)═══════════ */
    const KIT = `
      window.__vis = function(){ return [].slice.call(document.querySelectorAll('.record-sheet tr')).filter(function(t){return t.offsetParent}) };
      window.__trsWith = function(txt){ return window.__vis().filter(function(t){ return (t.innerText||'').indexOf(txt)>=0 }) };
      window.__ctls = function(tr){ var out=[]
        ;[].slice.call(tr.children).forEach(function(td, i){
          var el = td.querySelector('.rs-ref-ctl') || td.querySelector('.el-select__wrapper') || td.querySelector('textarea') || td.querySelector('input:not([type=hidden])')
          if (el) out.push({ i:i, kind: el.classList.contains('rs-ref-ctl') ? 'ref' : (el.classList.contains('el-select__wrapper') ? 'select' : (el.tagName==='TEXTAREA' ? 'area' : 'input')), el:el }) })
        return out };
      window.__read = function(c){ if(!c) return null; var el=c.el
        if (c.kind==='ref'){ var t=el.querySelector('.rs-ref-text'); return t ? t.textContent.trim() : '' }
        if (c.kind==='select'){ return (el.innerText||'').replace(/\\s+/g,' ').trim() }
        return el.value };
      window.__V = function(el, v){
        var proto = el.tagName==='TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
        Object.getOwnPropertyDescriptor(proto,'value').set.call(el, v)
        el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); return 'SET' };
      // ⚠ 标签格必须按 **td 文本全等** 找,不能按「行内含子串」——
      //   否则「中间值g」会命中灌料块的「理论灌料中间值g」行(实测踩过)。
      window.__labelTd = function(label){ var tds=[].slice.call(document.querySelectorAll('.record-sheet td')).filter(function(td){
        return td.offsetParent && (td.innerText||'').trim()===label }); return tds.length ? tds[0] : null };
      // 标签格 → 它的控件组:同行右邻(标签|值) 或 下一行的值行(标签行+值行两行式)
      window.__group = function(label){ var td=window.__labelTd(label); if(!td) return null
        var tr=td.parentElement
        if (window.__ctls(tr).length===0){ var nx=tr.nextElementSibling
          while(nx && !nx.offsetParent) nx=nx.nextElementSibling
          return nx ? { kind:'next', ctls: window.__ctls(nx) } : null }
        var idx=[].indexOf.call(tr.children, td)
        return { kind:'same', ctls: window.__ctls(tr).filter(function(c){ return c.i>idx }) } };
      window.__pair = function(label){ var g=window.__group(label); return g && g.ctls.length ? g.ctls[0] : null };
      window.__valRow = function(label){ var g=window.__group(label); return g ? g.ctls : null };
      window.__setPair = function(label, v){ var c=window.__pair(label); if(!c) return 'NO_PAIR'; if(c.kind!=='input'&&c.kind!=='area') return 'NOT_TEXT:'+c.kind; return window.__V(c.el, v) };
      window.__getPair = function(label){ return window.__read(window.__pair(label)) };
      window.__setVal = function(label, i, v){ var cs=window.__valRow(label); if(!cs) return 'NO_VALROW'; if(!cs[i]) return 'NO_IDX('+cs.length+')'; return window.__V(cs[i].el, v) };
      window.__getVal = function(label, i){ var cs=window.__valRow(label); if(!cs||!cs[i]) return null; return window.__read(cs[i]) };
      // 保存后单据会**自动归档转只读**(设计如此:见 PanelxList 修改态注释)⇒ 值渲染成纯文本、没有控件。
      // 读值要两种形态都支持:有控件读控件,没控件读值行第 i 个格的文本。
      window.__rowOf = function(label){ var td=window.__labelTd(label); if(!td) return { tr:null, idx:0 }
        var tr=td.parentElement, idx=[].indexOf.call(tr.children, td)
        // 同行配对:标签右邻格若是"值样"(含数字/±/%)就用它;否则说明这是标签行,值在下一行
        var sib=tr.children[idx+1]
        if (sib){ var t=(sib.innerText||'').trim(); if (/[0-9±]/.test(t)) return { tr:tr, idx:idx+1 } }
        var nx=tr.nextElementSibling; while(nx && !nx.offsetParent) nx=nx.nextElementSibling
        return { tr:nx, idx:0 } };
      window.__getAny = function(label, i){ var g=window.__group(label); if(g && g.ctls.length) return window.__read(g.ctls[i])
        var r=window.__rowOf(label); if(!r.tr) return null
        var td=r.tr.children[(r.idx||0)+(i||0)]; return td ? (td.innerText||'').trim() : null };
      window.__getAnyPair = function(label){ return window.__getAny(label, 0) };
      // 编号格:文档类面板=输入框,单据类面板=只读文本 ⇒ 两种都读
      window.__docNoCell = function(){ var td=document.querySelector('.record-sheet td.rs-docno'); if(!td) return { text:'NO_CELL', input:null, hasInput:false }
        var i=td.querySelector('input')
        return { text:(td.innerText||'').replace(/编号：/,'').trim(), input: i? i.value : null, hasInput: !!i } };
      window.__docNo = function(){ var c=window.__docNoCell(); var cand=[c.input, c.text].filter(function(x){ return x && x!=='NO_CELL' })
        for (var k=0;k<cand.length;k++){ var m=String(cand[k]).match(/(MP|CP|PI|GY|MF|AB)-?\\d{4}-?\\d{2}-?\\d{4}/); if(m) return m[0] }
        return '' };
      window.__docNoRaw = function(){ var c=window.__docNoCell(); return c.text + (c.hasInput? ('(input='+c.input+')') : '(只读文本)') };
      window.__clickVisible = function(sel, text){ var all=[].slice.call(document.querySelectorAll(sel))
        for(var i=0;i<all.length;i++){ if(all[i].offsetParent && (!text || (all[i].textContent||'').trim()===text)){ all[i].click(); return 'CLICKED' } } return 'NO_EL' };
      window.__clickContains = function(sel, text){ var all=[].slice.call(document.querySelectorAll(sel))
        for(var i=0;i<all.length;i++){ if(all[i].offsetParent && (all[i].textContent||'').indexOf(text)>=0){ all[i].click(); return 'CLICKED' } } return 'NO_EL' };
      // ⚠ 下拉项要按「真的看得见」过滤:el-select 的 popper 关闭后 DOM 仍在,
      //   只按 offsetParent 会把上一次遗留的隐藏项也算进来(点它会落空甚至关掉弹窗/下拉)。
      window.__visItems = function(){ return [].slice.call(document.querySelectorAll('.el-select-dropdown__item')).filter(function(o){
        var r=o.getBoundingClientRect(); if(!(r.height>0 && r.width>0)) return false
        if (getComputedStyle(o).display==='none' || getComputedStyle(o).visibility==='hidden') return false
        var p=o.closest('.el-popper'); if (p && p.getAttribute('aria-hidden')==='true') return false
        if (p && getComputedStyle(p).display==='none') return false
        return true }) };
      window.__pickOption = function(text){ var all=window.__visItems()
        if(!all.length) return 'NO_DROPDOWN'
        for(var i=0;i<all.length;i++){ if((all[i].textContent||'').trim()===text){ all[i].click(); return 'PICKED:'+text } }
        all[0].click(); return 'PICKED_FIRST:'+(all[0].textContent||'').trim() };
      window.__pickOptionLike = function(text){ var all=window.__visItems()
        if(!all.length) return 'NO_DROPDOWN'
        for(var i=0;i<all.length;i++){ if((all[i].textContent||'').indexOf(text)>=0){ all[i].click(); return 'PICKED:'+(all[i].textContent||'').trim() } }
        return 'NO_MATCH:'+text };
      window.__options = function(){ return window.__visItems().map(function(o){return (o.textContent||'').trim()}) };
      window.__dlg = function(){ var ds=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.offsetParent && d.querySelector('.rcd')}); return ds.length? ds[ds.length-1] : null };
      window.__dlgRows = function(){ var d=window.__dlg(); if(!d) return null; var o={}
        ;[].slice.call(d.querySelectorAll('.rcd-r')).forEach(function(r){ var l=r.querySelector('.rcd-r-lb'), v=r.querySelector('.rcd-r-v'); if(l&&v) o[l.textContent.trim()]=v.textContent.trim() }); return o };
      window.__dlgSlots = function(){ var d=window.__dlg(); if(!d) return null
        var tb=[].slice.call(d.querySelectorAll('.rcd-tb')).filter(function(t){return (t.innerText||'').indexOf('料位')>=0})[0]; if(!tb) return null
        return [].slice.call(tb.querySelectorAll('tbody tr')).map(function(tr){
          return [].slice.call(tr.querySelectorAll('td')).map(function(td){ var i=td.querySelector('input'); return i ? i.value : (td.innerText||'').trim() }) }) };
      window.__dlgParam = function(label, v){ var d=window.__dlg(); if(!d) return 'NO_DLG'
        var ps=[].slice.call(d.querySelectorAll('.rcd-pf')).filter(function(l){ return (l.innerText||'').indexOf(label)>=0 })
        if(!ps.length) return 'NO_PARAM'; var inp=ps[0].querySelector('input'); if(!inp) return 'NO_INPUT'
        return v===undefined ? inp.value : window.__V(inp, v) };
      window.__dlgSel = function(label, text){ var d=window.__dlg(); if(!d) return 'NO_DLG'
        var ps=[].slice.call(d.querySelectorAll('.rcd-pf')).filter(function(l){ return (l.innerText||'').indexOf(label)>=0 })
        if(!ps.length) return 'NO_PARAM'
        var w=ps[0].querySelector('.el-select__wrapper'); if(!w) return 'NO_SELECT'
        w.click(); return 'OPENED' };
      window.__dlgPreview = function(){ var d=window.__dlg(); if(!d) return ''
        return [].slice.call(d.querySelectorAll('.rcd-two .rcd-tb')).map(function(t){ return (t.innerText||'').replace(/\\n/g,' | ') }).join(' || ') };
      window.__dlgBtn = function(label){ var d=window.__dlg(); if(!d) return 'NO_DLG'
        var w=d.closest('.el-dialog__wrapper')||d
        var bs=[].slice.call(w.querySelectorAll('button'))
        for(var i=0;i<bs.length;i++){ if((bs[i].textContent||'').trim().indexOf(label)>=0 && !bs[i].disabled){ bs[i].click(); return 'CLICKED' } } return 'NO_BTN' };
      window.__gridAdd = function(barText){ var bs=[].slice.call(document.querySelectorAll('.rs-add'))
        var bars=[].slice.call(document.querySelectorAll('.rs-sectionbar'))
        for(var i=0;i<bs.length;i++){ if(!bs[i].offsetParent) continue
          var bar=''
          for(var j=0;j<bars.length;j++){ if(!bars[j].offsetParent) continue
            if(bars[j].compareDocumentPosition(bs[i]) & Node.DOCUMENT_POSITION_FOLLOWING){ if((bars[j].textContent||'').trim()) bar=bars[j].textContent.trim() } }
          if(bar.indexOf(barText)>=0){ bs[i].click(); return 'CLICKED' } }
        return 'NO_ADD_BTN' };
      window.__gridRows = function(){ var hdr=[].slice.call(document.querySelectorAll('.record-sheet tr')).filter(function(tr){
          return tr.offsetParent && (tr.innerText||'').indexOf('物料种类')>=0 && tr.querySelector('th') })[0]
        if(!hdr) return []
        var out=[], n=hdr.nextElementSibling
        while(n && !n.querySelector('th')){ if(n.offsetParent && !n.querySelector('td.rs-empty') && (n.children[0] ? (n.children[0].innerText||'').trim() !== '合计' : false)) out.push(n); n=n.nextElementSibling }
        return out.map(function(tr){ return [].slice.call(tr.children).map(function(td){ var i=td.querySelector('input'); return i ? i.value : (td.innerText||'').trim() }) }) };
      window.__gridSet = function(rowIdx, colIdx, v){ var hdr=[].slice.call(document.querySelectorAll('.record-sheet tr')).filter(function(tr){
          return tr.offsetParent && (tr.innerText||'').indexOf('物料种类')>=0 && tr.querySelector('th') })[0]
        if(!hdr) return 'NO_HDR'
        var rows=[], n=hdr.nextElementSibling
        while(n && !n.querySelector('th')){ if(n.offsetParent && !n.querySelector('td.rs-empty')) rows.push(n); n=n.nextElementSibling }
        if(!rows[rowIdx]) return 'NO_ROW('+rows.length+')'
        var td=rows[rowIdx].children[colIdx]; if(!td) return 'NO_COL'
        var i=td.querySelector('input'); if(!i) return 'NO_INPUT'
        return window.__V(i, v) };
      'KIT-OK'`
    const kit = await ev(KIT)
    if (kit !== 'KIT-OK') throw new Error('注入 DOM 工具失败:' + kit)

    const clickTab = (t) => ev(`window.__clickVisible('.rsp-page-tab', ${JSON.stringify(t)})`)
    // ⚠ 别用定长 sleep 等异步数据:dev(未压缩)比打包产物慢得多,固定 800ms 时下拉/档案还没回来,
    //   会被误判成"下拉是空的/含水率没带出"。一律轮询到条件成立(或超时)再断言。
    const waitFor = async (expr, ms = 12000, every = 400) => {
      const t0 = Date.now(); let v
      while (Date.now() - t0 < ms) { v = await ev(expr); if (v) return v; await sleep(every) }
      return v
    }
    const clickSide = (t) => ev(`(function(){ var all=[].slice.call(document.querySelectorAll('.as-side-btn'));
      for(var i=0;i<all.length;i++){ if(all[i].offsetParent && (all[i].textContent||'').trim()===${JSON.stringify(t)}){ all[i].click(); return 'CLICKED' } } return 'NO_BTN' })()`)
    // ⚠ ElMessage 是 position:fixed ⇒ offsetParent 恒为 null,不能用它过滤(否则永远读不到提示,假绿)
    const msgText = () => ev(`(function(){ var m=[].slice.call(document.querySelectorAll('.el-message,.el-message-box'))
      .filter(function(x){ var r=x.getBoundingClientRect(); return r.height>0 && r.width>0 })
      return m.map(function(x){return (x.innerText||'').replace(/\\n/g,' ').trim()}).join(' ‖ ') })()`)

    /* ═══════════ ① 建单 ═══════════ */
    const tabs = await ev(`[].slice.call(document.querySelectorAll('.rsp-page-tab')).map(function(t){return t.textContent.trim()})`)
    if (JSON.stringify(tabs) === JSON.stringify(['修订记录', '成型工艺清单', '成型配方'])) ok(`①-1 三个页签 = ${tabs.join('/')}`)
    else bad(`①-1 页签异常:${JSON.stringify(tabs)}`)
    const addRes = await clickSide('新增')
    await sleep(2400)
    const addMsg = await msgText()
    const toastNo = (String(addMsg).match(/(MP|CP|PI|GY|MF|AB)-?\d{4}-?\d{2}-?\d{4}/) || [])[0] || ''
    await clickTab('成型工艺清单'); await sleep(1200)
    const uiNoAtAdd = await ev('window.__docNo()')
    const cellAtAdd = await ev('window.__docNoRaw()')
    if (addRes === 'CLICKED' && (toastNo || uiNoAtAdd)) ok(`①-2 新增成单(提示:「${String(addMsg).slice(0, 60)}」)`)
    else bad(`①-2 新增异常:click=${addRes} 提示=${JSON.stringify(addMsg)} 编号格=${JSON.stringify(cellAtAdd)}`)
    if (uiNoAtAdd) ok(`①-2b 新增后纸张右上「编号：」格显示 ${uiNoAtAdd}`)
    else bad(`①-2b 新增后纸张「编号：」格为空(${JSON.stringify(cellAtAdd)}) —— 库端已建单(提示里有号)但界面不显示`)
    docNo = toastNo || uiNoAtAdd || ''
    const ctlCount = await ev(`(function(){ var cs=window.__valRow('炭棒编号'); return cs? cs.length : 0 })()`)
    if (ctlCount > 0) ok(`①-3 单据处于可编辑状态(产品基本信息值行有 ${ctlCount} 个控件)`)
    else bad('①-3 单据只读(门禁/状态不对):产品基本信息值行没有可编辑控件')

    /* ═══════════ ② 产品基本信息(两行式)═══════════ */
    await ev(`(function(){ var cs=window.__valRow('炭棒编号'); if(!cs || !cs[0]) return 'NO_CTL'
      if(cs[0].kind!=='ref') return 'NOT_REF:'+cs[0].kind; cs[0].el.click(); return 'OPENED' })()`)
    await sleep(1800)
    const refInfo = await ev(`(function(){ var ds=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.offsetParent && d.querySelector('.el-table')})
      var d=ds[ds.length-1]; if(!d) return 'NO_DIALOG'
      var rows=[].slice.call(d.querySelectorAll('.el-table__body tbody tr'))
      var heads=[].slice.call(d.querySelectorAll('.el-table__header th')).map(function(t){return (t.innerText||'').trim()}).filter(Boolean)
      return JSON.stringify({ heads:heads, n:rows.length, first: rows.length? (rows[0].innerText||'').replace(/\\s+/g,' ').trim() : '', hasTarget: rows.some(function(r){ return (r.innerText||'').indexOf(${JSON.stringify(PROD_CODE)})>=0 }) }) })()`)
    console.log('  --   产品参照弹窗:' + refInfo)
    const refPick = await ev(`(function(){ var ds=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.offsetParent && d.querySelector('.el-table')})
      var d=ds[ds.length-1]; if(!d) return 'NO_DIALOG'
      var rows=[].slice.call(d.querySelectorAll('.el-table__body tbody tr'))
      var hit=rows.filter(function(r){ return (r.innerText||'').indexOf(${JSON.stringify(PROD_CODE)})>=0 })[0] || rows[0]
      if(!hit) return 'NO_ROW'
      var cb=hit.querySelector('.el-checkbox__inner') || hit.querySelector('.el-checkbox') || hit.querySelector('input[type=checkbox]')
      if(cb){ cb.click(); return 'CHECKED' }
      hit.click(); return 'ROWCLICK' })()`)
    await sleep(500)
    const refOk = await ev(`(function(){ var d=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(x){return x.offsetParent && x.querySelector('.el-table')}).pop()
      if(!d) return 'NO_DIALOG'
      var bs=[].slice.call(d.querySelectorAll('button')).filter(function(b){ return !b.disabled && /确\\s*定|确认|选\\s*择/.test(b.textContent||'') })
      if(!bs.length){ var f=d.querySelector('.el-dialog__footer .el-button--primary'); if(f){ f.click(); return 'FOOTER' } return 'NO_BTN' }
      bs[bs.length-1].click(); return 'CONFIRMED' })()`)
    await sleep(1500)
    const refBack = await ev(`window.__getVal('炭棒编号', 0)`)
    if (refOk !== 'NO_BTN' && String(refBack).indexOf(PROD_CODE) >= 0) ok(`②-1 参照选产品 → 炭棒编号带回 ${refBack}(pick=${refPick})`)
    else bad(`②-1 参照没带回:pick=${refPick} confirm=${refOk} 值=${JSON.stringify(refBack)} 弹窗=${refInfo}`)
    const nameBack = await ev(`window.__getVal('炭棒编号', 1)`)
    if (String(nameBack).indexOf(PROD_NAME) >= 0) ok(`②-2 产品名称自动带出 = ${nameBack}(refMap)`)
    else bad(`②-2 产品名称没带出:${JSON.stringify(nameBack)}`)
    for (const [i, v] of [['0', '59.5'], ['1', '39.5'], ['2', '120']]) {
      const r = await ev(`window.__setVal('炭棒编号', ${i} + 2, ${JSON.stringify(v)})`)
      if (r !== 'SET') bad(`②-3 炭棒规格${Number(i) + 1} 填值失败:${r}`)
    }
    const specOk = JSON.stringify(await ev(`[0,1,2].map(function(i){ return window.__getVal('炭棒编号', i+2) })`)) === JSON.stringify(['59.5', '39.5', '120'])
    if (specOk) ok('②-3 炭棒规格三格 = 59.5 / 39.5 / 120')
    else bad(`②-3 炭棒规格三格异常:${JSON.stringify(await ev(`[0,1,2].map(function(i){ return window.__getVal('炭棒编号', i+2) })`))}`)
    // 产品管控类型 / 产品形态 = 下拉(值行第 5、6 格)
    for (const [idx, label] of [[5, '产品管控类型'], [6, '产品形态']]) {
      const opened = await ev(`(function(){ var cs=window.__valRow('炭棒编号'); if(!cs||!cs[${idx}]) return 'NO_IDX'
        if(cs[${idx}].kind!=='select') return 'NOT_SELECT:'+cs[${idx}].kind
        cs[${idx}].el.click(); return 'OPENED' })()`)
      await sleep(600)
      const picked = await ev(`window.__pickOption('__ANY__')`)
      const val = await ev(`window.__getVal('炭棒编号', ${idx})`)
      if (opened === 'OPENED' && String(picked).indexOf('PICKED') === 0 && val) ok(`②-4 ${label} 下拉可选 → ${val}`)
      else bad(`②-4 ${label} 下拉异常:open=${opened} pick=${picked} 值=${JSON.stringify(val)}`)
    }
    // 生产车间 = 参照(值行第 7 格)
    const wsOpen = await ev(`(function(){ var cs=window.__valRow('炭棒编号'); if(!cs||!cs[7]) return 'NO_IDX'
      if(cs[7].kind!=='ref') return 'NOT_REF:'+cs[7].kind; cs[7].el.click(); return 'OPENED' })()`)
    await sleep(1600)
    const wsPick = await ev(`(function(){ var d=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(x){return x.offsetParent && x.querySelector('.el-table')}).pop()
      if(!d) return 'NO_DIALOG'
      var rows=[].slice.call(d.querySelectorAll('.el-table__body tbody tr')); if(!rows.length) return 'NO_ROW'
      var hit=rows.filter(function(r){ return (r.innerText||'').indexOf('生产')>=0 })[0] || rows[0]
      var cb=hit.querySelector('.el-checkbox__inner'); if(cb) cb.click(); else hit.click(); return 'PICKED' })()`)
    await sleep(500)
    await ev(`(function(){ var d=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(x){return x.offsetParent && x.querySelector('.el-table')}).pop()
      if(!d) return 0; var f=d.querySelector('.el-dialog__footer .el-button--primary'); if(f){f.click();return 1}
      var bs=[].slice.call(d.querySelectorAll('button')).filter(function(b){return !b.disabled && /确\\s*定|确认/.test(b.textContent||'')}); if(bs.length){bs[bs.length-1].click();return 2} return 0 })()`)
    await sleep(1200)
    const wsVal = await ev(`window.__getVal('炭棒编号', 7)`)
    if (wsOpen === 'OPENED' && wsVal && String(wsVal).indexOf('点击选择') < 0) ok(`②-5 生产车间参照可选 → ${wsVal}`)
    else bad(`②-5 生产车间参照异常:open=${wsOpen} pick=${wsPick} 值=${JSON.stringify(wsVal)}`)
    await shot('01-basic-info')

    /* ═══════════ ③ 工序 ═══════════ */
    for (const [label, v] of [['配料要求', '探针:炭粉+胶粉按比例干混 20min'], ['灌料要求', '探针:灌料后刮平,不得有空腔']]) {
      const r = await ev(`window.__setPair(${JSON.stringify(label)}, ${JSON.stringify(v)})`)
      if (r === 'SET') ok(`③-1 ${label} 填值 ok`)
      else bad(`③-1 ${label} 填值失败:${r}`)
    }
    for (const label of ['烧结炉参数', '烧结时间/调速器参数', '冷却参数设置']) {
      const opened = await ev(`(function(){ var c=window.__pair(${JSON.stringify(label)}); if(!c) return 'NO_PAIR'
        if(c.kind!=='select') return 'NOT_SELECT:'+c.kind; c.el.click(); return 'OPENED' })()`)
      await sleep(700)
      const opts = await ev('window.__options()')
      const picked = await ev(`window.__pickOption('__ANY__')`)
      const val = await ev(`window.__getPair(${JSON.stringify(label)})`)
      if (opened === 'OPENED' && Array.isArray(opts) && opts.length && String(picked).indexOf('PICKED') === 0)
        ok(`③-2 ${label} 标准库下拉 ${opts.length} 项,选得 ${val}`)
      else bad(`③-2 ${label} 下拉异常:open=${opened} 选项=${JSON.stringify(opts)} pick=${picked}`)
    }
    // 压降是否测试(整行一格,无标签格 ⇒ 按 placeholder 找)
    const dropOpened = await ev(`(function(){ var trs=window.__vis().filter(function(t){ return (t.innerText||'').indexOf('是否测试')>=0 })
      if(!trs.length) return 'NO_LABEL'
      var w=trs[0].querySelector('.el-select__wrapper'); if(!w) return 'NO_SELECT'; w.click(); return 'OPENED' })()`)
    await sleep(600)
    const dropPicked = await ev(`window.__pickOption('√')`)
    const dropVal = await ev(`(function(){ var trs=window.__vis().filter(function(t){ return (t.innerText||'').indexOf('是否测试')>=0 })
      return trs.length ? (trs[0].querySelector('.el-select__wrapper')||{}).innerText : null })()`)
    if (dropOpened === 'OPENED' && String(dropPicked).indexOf('PICKED') === 0) ok(`③-3 压降是否测试 选得 ${JSON.stringify(String(dropVal).trim())}`)
    else bad(`③-3 压降是否测试 异常:open=${dropOpened} pick=${dropPicked} 格=${JSON.stringify(dropVal)}`)

    /* ═══════════ ③b 检验要求:密度管控要求(配方计算的密度来源)═══════════
       ⚠ 工艺依赖:配方计算要 密度下限/上限 —— 要么直接填 实际密度管控下限/上限,
         要么填「密度管控要求」文本(如 0.58~0.60)由弹窗解析。两者都空时弹窗 ③ 只出
         blockReason 不给结果(设计如此,不是 bug),e2e 里必须先填一格。 */
    const densFill = await ev(`window.__setVal('管控要求', 0, '0.58~0.60')`)
    if (densFill === 'SET') ok('③-4 密度管控要求 = 0.58~0.60(配方计算的密度来源)')
    else bad(`③-4 密度管控要求 填值失败:${densFill}`)

    /* ═══════════ ④ 配方表(成型配方页)═══════════ */
    await clickTab('成型配方'); await sleep(1400)
    const btnOk = await ev(`(function(){ var bs=[].slice.call(document.querySelectorAll('.rs-lib-btn')); return bs.some(function(b){ return b.offsetParent && b.textContent.indexOf('配方计算')>=0 }) })()`)
    if (btnOk) ok('④-1 配方表表头出现「🧮 配方计算」')
    else bad('④-1 没有「配方计算」按钮')
    for (let i = 0; i < RECIPE_ROWS.length; i++) {
      const r = await ev(`window.__gridAdd('配方表')`)
      if (i === 0 && r === 'NO_ADD_BTN') bad('④-2 找不到「＋ 新增数据记录行」')
      await sleep(400)
    }
    const rowCount = await ev(`window.__gridRows().length`)
    if (rowCount === RECIPE_ROWS.length) ok(`④-2 配方表加到 ${rowCount} 行`)
    else bad(`④-2 配方表行数 = ${rowCount},期望 ${RECIPE_ROWS.length}`)
    // 列序:0=序号 1=物料种类 2=物料编号 3=物料名称 4=实际添加比例 5=单支物料含量 6=设计添加量
    let fillFail = ''
    for (let r = 0; r < RECIPE_ROWS.length; r++) {
      const row = RECIPE_ROWS[r]
      for (const [col, key] of [[1, '物料种类'], [2, '物料编号'], [3, '物料名称'], [6, '设计添加量']]) {
        const res = await ev(`window.__gridSet(${r}, ${col}, ${JSON.stringify(row[key])})`)
        if (res !== 'SET') fillFail += ` r${r}c${col}=${res}`
      }
      await sleep(150)
    }
    const grid = await ev('window.__gridRows()')
    const gridOk = Array.isArray(grid) && grid.length === RECIPE_ROWS.length &&
      grid.every((g, i) => g[1] === RECIPE_ROWS[i].物料种类 && g[2] === RECIPE_ROWS[i].物料编号 && g[6] === RECIPE_ROWS[i].设计添加量)
    if (gridOk) ok(`④-3 四行配方填好(${grid.map((g) => g[2]).join(' / ')})`)
    else bad(`④-3 配方行内容异常:${JSON.stringify(grid)} 填值失败:${fillFail || '无'}`)
    await shot('02-recipe-rows')

    /* ═══════════ ⑤ 打开弹窗:参数 / 料位 / 含水率 ═══════════ */
    await ev(`(function(){ var bs=[].slice.call(document.querySelectorAll('.rs-lib-btn'))
      for(var i=0;i<bs.length;i++){ if(bs[i].offsetParent && bs[i].textContent.indexOf('配方计算')>=0){ bs[i].click(); return 1 } } return 0 })()`)
    await waitFor(`window.__dlg() ? 'OPEN' : ''`, 10000)
    await waitFor(`(function(){ var s=window.__dlgSlots(); return s && s.length ? 'ROWS' : '' })()`, 10000)
    const title = await ev(`(function(){ var d=window.__dlg(); if(!d) return ''
      var h=d.querySelector('.el-dialog__title'); return h ? h.textContent.trim() : '' })()`)
    if (title === '配方计算') ok('⑤-1 弹窗标题 = 配方计算')
    else bad(`⑤-1 弹窗标题 = ${JSON.stringify(title)}`)
    const scope = await ev(`(function(){ var d=window.__dlg(); if(!d) return ''
      return [].slice.call(d.querySelectorAll('.rcd-muted')).map(function(n){return n.textContent.trim()}).join(' ‖ ') })()`)
    // 参数确实按标准库默认条目载入(默认 cavities=1 / conversion_ratio=0.5) —— 比断言提示语文本更硬
    const pCav = await ev(`window.__dlgParam('一切几')`)
    const pConv = await ev(`window.__dlgParam('折算比')`)
    if (pCav === '1' && pConv === '0.5') ok(`⑤-1b 参数按标准库 mold.calcparam 默认条目载入(一切几=${pCav} 折算系数=${pConv};${String(scope).slice(0, 30)}…)`)
    else bad(`⑤-1b 参数默认值异常:一切几=${JSON.stringify(pCav)} 折算系数=${JSON.stringify(pConv)}(期望 1 / 0.5)提示=${JSON.stringify(scope)}`)
    const slots0 = await ev('window.__dlgSlots()')
    if (Array.isArray(slots0) && slots0.length === 10) ok('⑤-2 料位表 10 行')
    else bad(`⑤-2 料位表行数 = ${Array.isArray(slots0) ? slots0.length : 'null'}`)
    const groups = (slots0 || []).map((r) => r[1])
    const expGroups = ['粉料', '粉料', '粉料', '粉料', '粉料', '胶粉', '胶粉', '折算料', '折算料', '折算料']
    if (JSON.stringify(groups) === JSON.stringify(expGroups)) ok('⑤-2b 料位分组 = 粉料1~5 / 胶粉6~7 / 折算料8~10')
    else bad(`⑤-2b 料位分组异常:${JSON.stringify(groups)}`)
    const codes = (slots0 || []).map((r) => r[2])
    if (codes[0] === 'YJ-XH-001' && codes[5] === 'YJ-ZX-003' && codes[6] === 'YJ-SLD-009' && codes[7] === 'HP-12')
      ok(`⑤-3 料位物料编号与配方表一致(1=水合炭粉 6=M2-D 7=4012T1 8=HP-12)`)
    else bad(`⑤-3 料位编号串了:${JSON.stringify(codes)}`)
    if (String((slots0 || [])[0]?.[4] || '').includes('补差')) ok(`⑤-3b 料位 1 = 补差位(${slots0[0][4]})`)
    else bad(`⑤-3b 料位 1 应显示补差:${JSON.stringify((slots0 || [])[0]?.[4])}`)
    // 含水率从物料档案带出是异步的 ⇒ 轮询等它到位(dev 慢)
    const moisture1 = await waitFor(`(function(){ var s=window.__dlgSlots(); return (s && s[0] && s[0][5]) ? s[0][5] : '' })()`, 12000)
    if (moisture1 === '6') ok('⑤-4 料位 1 含水率由物料档案自动带出 = 6')
    else bad(`⑤-4 料位 1 含水率 = ${JSON.stringify(moisture1)},期望 6(档案 bs_inv.水分含量=0.06)`)
    const archTag = await ev(`(function(){ var d=window.__dlg(); if(!d) return 0
      return [].slice.call(d.querySelectorAll('.rcd-src')).filter(function(s){ var r=s.getBoundingClientRect(); return r.width>0 }).length })()`)
    if (archTag > 0) ok(`⑤-4b 带出格有「档案」来源标记(${archTag} 处)`)
    else bad('⑤-4b 没有「档案」来源标记')
    // 一切几 = 2(探针期望值按 2 腔算)
    const setCav = await ev(`window.__dlgParam('一切几', '2')`)
    await sleep(600)
    if (setCav === 'SET') ok('⑤-5 工艺参数可改(一切几 = 2)')
    else bad(`⑤-5 参数改不动:${setCav}`)

    /* ═══════════ ⑥ 烧结尺寸(模具)═══════════ */
    const wsOpen2 = await ev(`window.__dlgSel('车间')`)
    const wsOpts = await waitFor(`(function(){ var o=window.__options(); return o.length ? o : '' })()`, 10000)
    const wsPick2 = await ev(`window.__pickOption('1')`)
    await sleep(600)
    const mdOpen = await ev(`window.__dlgSel('型号')`)
    const mdOpts = await waitFor(`(function(){ var o=window.__options(); return o.length ? o : '' })()`, 10000)
    const mdPick = await ev(`window.__pickOptionLike('60*40')`)
    // 带出尺寸随后端/尺寸表回填是异步的
    const sinterSummary = await waitFor(`(function(){ var d=window.__dlg(); if(!d) return ''
      var ps=[].slice.call(d.querySelectorAll('.rcd-pf')).filter(function(l){ return (l.innerText||'').indexOf('带出尺寸')>=0 })
      var t = ps.length ? (ps[0].innerText||'').replace(/\\s+/g,' ').trim() : ''
      return t.indexOf('59.5')>=0 ? t : '' })()`, 10000)
    if (Array.isArray(wsOpts) && wsOpts.length >= 4) ok(`⑥-1 车间下拉 ${wsOpts.length} 项(${wsOpts.slice(0, 5).join('/')})`)
    else bad(`⑥-1 车间下拉异常:${JSON.stringify(wsOpts)} open=${wsOpen2} pick=${wsPick2}`)
    if (Array.isArray(mdOpts) && mdOpts.some((o) => o.indexOf('60*40') >= 0)) ok(`⑥-2 型号下拉 ${mdOpts.length} 项,含 60*40`)
    else bad(`⑥-2 型号下拉异常:${JSON.stringify((mdOpts || []).slice(0, 8))} open=${mdOpen} pick=${mdPick}`)
    const sumOk = ['59.5', '39.5'].every((v) => String(sinterSummary).includes(v))
    if (sumOk) ok(`⑥-3 带出尺寸 = ${sinterSummary}`)
    else bad(`⑥-3 带出尺寸异常:${JSON.stringify(sinterSummary)}`)

    /* ═══════════ ⑦ 计算结果(与 exe 口径逐位比)═══════════ */
    const rowsRes = await ev('window.__dlgRows()')
    const checks7 = [
      ['理论最低灌料重量g', EXP_HEAD['理论最低灌料重量g']],
      ['理论灌料中间值g', EXP_HEAD['理论灌料中间值g']],
      ['理论最高灌料重量g', EXP_HEAD['理论最高灌料重量g']],
      ['理论水分', EXP_HEAD['理论水分']],
      ['最短长度mm', EXP_HEAD['最短长度mm']],
      ['中间值mm', EXP_HEAD['中间值mm']],
      ['最长长度mm', EXP_HEAD['最长长度mm']],
      ['最低重量g', EXP_HEAD['最低重量g']],
      ['中间值g', EXP_HEAD['中间值g']],
      ['最高重量g', EXP_HEAD['最高重量g']],
    ]
    // ③ 结果区的值可能带单位(如 理论水分 显示 3.72%)⇒ 比较时按数值归一,纸面落格仍按原口径断言
    const norm = (s) => String(s == null ? '' : s).replace(/[%\s]/g, '')
    const mism = checks7.filter(([k, v]) => norm(rowsRes?.[k]) !== norm(v))
    if (rowsRes && !mism.length) ok(`⑦-1 弹窗③结果 10 项与 exe 口径逐位一致(灌料 ${rowsRes['理论最低灌料重量g']}/${rowsRes['理论灌料中间值g']}/${rowsRes['理论最高灌料重量g']},水分 ${rowsRes['理论水分']},长度 ${rowsRes['最短长度mm']}/${rowsRes['中间值mm']}/${rowsRes['最长长度mm']},重量 ${rowsRes['最低重量g']}/${rowsRes['中间值g']}/${rowsRes['最高重量g']})`)
    else bad(`⑦-1 结果不符:${JSON.stringify(mism.map(([k]) => k + '=' + (rowsRes?.[k] ?? 'null') + '(期望见 _calc-e2e-expect.mjs)'))}`)
    const slotRatio1 = await ev(`(function(){ var s=window.__dlgSlots(); return s ? [s[0][6], s[0][7], s[5][6], s[5][7], s[7][6], s[7][7]] : null })()`)
    console.log('  --   料位行(位1/6/8 比例,克重):' + JSON.stringify(slotRatio1))
    // ⚠ 弹窗③会算「实际水分」,但**纸面没有对应字段**(设计待定,见本轮结论)—— 这里只登记它的值
    console.log('  --   弹窗③另有「实际水分」=' + JSON.stringify(rowsRes?.['实际水分'] ?? null) + '(纸面无落格)')
    const w = await ev(`(function(){ var d=window.__dlg(); if(!d) return []
      return [].slice.call(d.querySelectorAll('.rcd-warn')).map(function(x){return x.textContent.trim()}) })()`)
    const badWarn = (w || []).filter((x) => /水分未采集|认不出|已按百分数解释/.test(x))
    if (!badWarn.length) ok('⑦-2 无「水分未采集/种类认不出/按百分数解释」类告警')
    else bad(`⑦-2 出现不该有的告警:${JSON.stringify(badWarn)}`)

    /* ═══════════ ⑧ 回填预览 + 填入单据 ═══════════ */
    const preview = await ev('window.__dlgPreview()')
    const prevOk = Object.keys(EXP_HEAD).every((k) => String(preview).includes(k)) &&
      EXP_ROWS.slice(0, 4).every((r) => String(preview).includes(r.ratio))
    if (prevOk) ok('⑧-1 回填预览列出页1 各格 + 配方表两列(改前 → 改后)')
    else bad(`⑧-1 回填预览缺内容:${String(preview).slice(0, 200)}`)
    await shot('03-calc-dialog')
    const filled = await ev(`window.__dlgBtn('填入单据')`)
    await sleep(1800)
    const dlgGone = await ev(`window.__dlg() ? 'STILL_OPEN' : 'CLOSED'`)
    if (filled === 'CLICKED' && dlgGone === 'CLOSED') ok('⑧-2 点「填入单据」后弹窗关闭')
    else bad(`⑧-2 填入单据异常:btn=${filled} dlg=${dlgGone}`)
    // 纸面:页1 十格
    await clickTab('成型工艺清单'); await sleep(1500)
    const paper = {}
    for (const k of Object.keys(EXP_HEAD)) {
      const lblMap = { '理论最低灌料重量g': ['理论最低灌料重量g', 0], '理论灌料中间值g': ['理论灌料中间值g', 1], '理论最高灌料重量g': ['理论灌料中间值g', 2], '理论水分': ['理论水分', null], '最短长度mm': ['最短长度mm', null], '中间值mm': ['中间值mm', null], '最长长度mm': ['最长长度mm', null], '最低重量g': ['最低重量g', null], '中间值g': ['中间值g', null], '最高重量g': ['最高重量g', null] }
      const [label, idx] = lblMap[k]
      paper[k] = idx === null ? await ev(`window.__getAnyPair(${JSON.stringify(label)})`) : await ev(`window.__getAny(${JSON.stringify(label)}, ${idx})`)
    }
    const miss8 = Object.keys(EXP_HEAD).filter((k) => String(paper[k] ?? '') !== EXP_HEAD[k])
    if (!miss8.length) ok(`⑧-3 页1 十格 = 期望(灌料 ${paper['理论最低灌料重量g']}/${paper['理论灌料中间值g']}/${paper['理论最高灌料重量g']},水分 ${paper['理论水分']},长度 ${paper['最短长度mm']}/${paper['中间值mm']}/${paper['最长长度mm']},重量 ${paper['最低重量g']}/${paper['中间值g']}/${paper['最高重量g']})`)
    else bad(`⑧-3 页1 落格不符:${JSON.stringify(miss8.map((k) => k + '=' + (paper[k] ?? 'null') + ' 期望 ' + EXP_HEAD[k]))}`)
    const inspect = await ev(`[0,1,2,3].map(function(i){ return window.__getVal('炭棒外径mm', i) })`)
    const dens = await ev(`[1,2].map(function(i){ return window.__getVal('实际密度管控下限', i) })`)
    const inspOk = JSON.stringify(inspect) === JSON.stringify([EXP_SINTER.外径, EXP_SINTER.外径公差, EXP_SINTER.内径, EXP_SINTER.内径公差])
    const densOk = JSON.stringify(dens) === JSON.stringify([EXP_DENSITY.下限, EXP_DENSITY.上限])
    if (inspOk) ok(`⑧-4 检验要求 炭棒尺寸四格 = ${inspect.join(' / ')}(来自烧结尺寸表 车间1+60*40)`)
    else bad(`⑧-4 炭棒尺寸四格异常:${JSON.stringify(inspect)}`)
    if (densOk) ok(`⑧-4b 密度管控上下限 = ${dens.join(' / ')}`)
    else bad(`⑧-4b 密度管控异常:${JSON.stringify(dens)}`)
    await clickTab('成型配方'); await sleep(1400)
    const grid3 = await ev('window.__gridRows()')
    const grid3Ok = Array.isArray(grid3) && grid3.length === RECIPE_ROWS.length &&
      EXP_ROWS.every((e, i) => grid3[i] && grid3[i][2] === e.code && grid3[i][4] === e.ratio && grid3[i][5] === e.amount)
    if (grid3Ok) ok(`⑧-5 填入单据后配方表两列已写入(${grid3.map((g) => g[2] + ' ' + g[4] + '/' + g[5] + 'g').join(' | ')})`)
    else bad(`⑧-5 配方表两列没写进去:${JSON.stringify(grid3)}`)
    await clickTab('成型工艺清单'); await sleep(1000)
    await shot('04-filled')

    /* ═══════════ ⑨ 保存 + 重开核对 ═══════════ */
    const saveRes = await clickSide('保存')
    await sleep(900)
    let saveMsg = await msgText()
    if (/确认|确定/.test(String(saveMsg))) { await ev(`window.__clickVisible('.el-message-box__btns .el-button--primary')`); await sleep(2500); saveMsg += ' ‖ ' + await msgText() }
    await sleep(1600)
    saveMsg += ' ‖ ' + await msgText()
    const saveBad = /不能为空|失败|错误|异常/.test(String(saveMsg))
    if (saveRes === 'CLICKED' && !saveBad) ok(`⑨-1 保存提交成功(提示:${String(saveMsg).replace(/\s+/g, ' ').slice(0, 90) || '无'}…)`)
    else bad(`⑨-1 保存异常:${saveRes} 提示=${JSON.stringify(saveMsg)}`)
    // 界面上的单据编号:新增时为空(库端已有号)→ 保存后应可读;读不到则用库内最新号兜底并记一条缺陷
    await clickTab('成型工艺清单'); await sleep(1200)   // ⚠ 保存会重载,重载后回到「修订记录」页,那页不出报告头 ⇒ 必须先切页
    const uiNo = await ev('window.__docNo()')
    const rawNo = await ev('window.__docNoRaw()')
    if (uiNo) ok(`⑨-1b 保存后界面单据编号可见 = ${uiNo}`)
    else bad(`⑨-1b 保存后界面单据编号仍为空(库端已建单;.rs-docno-input 值=${JSON.stringify(rawNo)})`)
    if (!docNo) {
      docNo = String(SQL("SELECT TOP 1 单据编号 FROM rd_mold_proc_head ORDER BY id DESC")).trim()
      console.log(`  --   ⚠ 界面读不到单号,用库内最新号兜底继续核对持久化:${docNo}`)
    }
    if (uiNo) docNo = uiNo
    /* ── 独立核对:直接查库(不依赖界面能否显示/重开) ── */
    const dbHead = String(SQL(`SELECT ISNULL(理论最低灌料重量g,'')+'|'+ISNULL(理论灌料中间值g,'')+'|'+ISNULL(理论最高灌料重量g,'')+'|'+ISNULL(理论水分,'')+'|'+ISNULL(最短长度mm,'')+'|'+ISNULL(中间值mm,'')+'|'+ISNULL(最长长度mm,'')+'|'+ISNULL(最低重量g,'')+'|'+ISNULL(中间值g,'')+'|'+ISNULL(最高重量g,'')+'|'+ISNULL(实际密度管控下限,'')+'|'+ISNULL(实际密度管控上限,'')+'|'+ISNULL(外径mm,'') FROM rd_mold_proc_head WHERE 单据编号='${docNo}'`)).trim()
    const dbWant = ['理论最低灌料重量g', '理论灌料中间值g', '理论最高灌料重量g', '理论水分', '最短长度mm', '中间值mm', '最长长度mm', '最低重量g', '中间值g', '最高重量g'].map((k) => EXP_HEAD[k]).concat([EXP_DENSITY.下限, EXP_DENSITY.上限, EXP_SINTER.外径]).join('|')
    if (dbHead === dbWant) ok(`⑨-1c 库内表头 13 格与期望逐位一致(${docNo})`)
    else bad(`⑨-1c 库内表头不符:\n        实际 ${dbHead}\n        期望 ${dbWant}`)
    const dbRows = String(SQL(`SELECT ISNULL(物料编号,'')+' '+ISNULL(实际添加比例,'')+' '+ISNULL(单支物料含量,'') FROM rd_mold_proc_detail WHERE 单据编号='${docNo}' AND 表区=N'配方表' ORDER BY id`)).trim().split(/\r?\n/).map((x) => x.trim()).filter(Boolean)
    const dbRowsWant = EXP_ROWS.map((r) => `${r.code} ${r.ratio} ${r.amount}`)
    if (JSON.stringify(dbRows) === JSON.stringify(dbRowsWant)) ok(`⑨-1d 库内配方表 4 行两列落库(${dbRows.join(' | ')})`)
    else bad(`⑨-1d 库内配方表不符:\n        实际 ${JSON.stringify(dbRows)}\n        期望 ${JSON.stringify(dbRowsWant)}`)
    // 重开
    await clickTab('成型工艺清单'); await sleep(800)
    const reopened = await ev(`(function(){ var t=window.__clickVisible('.as-side-btn', '查询单据'); return t })()`)
    await sleep(1200)
    const q = await ev(`(function(){ var ds=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.offsetParent && (d.innerText||'').indexOf('查询单据')>=0})
      var d=ds.pop(); if(!d) return 'NO_DIALOG'
      var inp=d.querySelector('input'); if(!inp) return 'NO_INPUT'
      window.__qph = [].slice.call(d.querySelectorAll('input')).map(function(i){return i.placeholder||'-'})
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(inp, ${JSON.stringify(docNo)})
      inp.dispatchEvent(new Event('input',{bubbles:true})); return 'SET' })()`)
    console.log('  --   查询单据弹窗输入框:' + JSON.stringify(await ev('window.__qph')))
    await sleep(500)
    await ev(`(function(){ var ds=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.offsetParent && (d.innerText||'').indexOf('查询单据')>=0})
      var d=ds.pop(); if(!d) return 0; var bs=[].slice.call(d.querySelectorAll('button'))
      for(var i=0;i<bs.length;i++){ if((bs[i].textContent||'').trim()==='查询'){ bs[i].click(); return 1 } } return 0 })()`)
    await sleep(3000)
    const shownNo = await waitFor(`window.__docNo() === ${JSON.stringify(docNo)} ? 'OK' : ''`, 12000)
    if (shownNo === 'OK') ok(`⑨-2 重开单据 ${docNo} 成功(纸张编号格显示出来了)`)
    else bad(`⑨-2 重开失败:显示 ${JSON.stringify(await ev('window.__docNo()'))} 期望 ${docNo}(查询=${q})`)
    // 单据数据也是异步载入的,等灌料值出现再断言;保存后已归档转只读 ⇒ 用 __getAny 读文本
    await clickTab('成型工艺清单'); await sleep(1200)
    await waitFor(`window.__getAnyPair('理论最低灌料重量g') || ''`, 12000)
    const paper2 = {}
    for (const k of Object.keys(EXP_HEAD)) {
      const lblMap = { '理论最低灌料重量g': ['理论最低灌料重量g', 0], '理论灌料中间值g': ['理论灌料中间值g', 1], '理论最高灌料重量g': ['理论灌料中间值g', 2], '理论水分': ['理论水分', null], '最短长度mm': ['最短长度mm', null], '中间值mm': ['中间值mm', null], '最长长度mm': ['最长长度mm', null], '最低重量g': ['最低重量g', null], '中间值g': ['中间值g', null], '最高重量g': ['最高重量g', null] }
      const [label, idx] = lblMap[k]
      paper2[k] = idx === null ? await ev(`window.__getAnyPair(${JSON.stringify(label)})`) : await ev(`window.__getAny(${JSON.stringify(label)}, ${idx})`)
    }
    const miss9 = Object.keys(EXP_HEAD).filter((k) => String(paper2[k] ?? '') !== EXP_HEAD[k])
    if (!miss9.length) ok('⑨-3 保存并重开后页1 十格值原样还在(已落库;归档只读态读的是纸面文本)')
    else bad(`⑨-3 重开后掉值:${JSON.stringify(miss9.map((k) => k + '=' + (paper2[k] ?? 'null') + ' 期望 ' + EXP_HEAD[k]))}`)
    await clickTab('成型配方'); await sleep(1500)
    const grid2 = await waitFor(`(function(){ var g=window.__gridRows(); return (g && g.length) ? g : '' })()`, 10000)
    const grid2Ok = Array.isArray(grid2) && grid2.length === RECIPE_ROWS.length &&
      EXP_ROWS.every((e, i) => grid2[i] && grid2[i][2] === e.code && grid2[i][4] === e.ratio && grid2[i][5] === e.amount)
    if (grid2Ok) ok(`⑨-4 配方表 4 行两列落库(${grid2.map((g) => g[2] + ' ' + g[4] + '/' + g[5] + 'g').join(' | ')})`)
    else bad(`⑨-4 配方表落库不符:${JSON.stringify(grid2)}`)
    await shot('05-reopened')
  } finally {
    try { if (ws) ws.close() } catch { }
    try { edge.kill() } catch { }
    /* ── 清理:探针建的两张单按精确单号物理删除,残留 0 ── */
    if (docNo) {
      SQL(`DELETE FROM rd_mold_proc_detail WHERE 单据编号='${docNo}'; DELETE FROM rd_mold_proc_head WHERE 单据编号='${docNo}';`)
      console.log(`  --   清理成型单 ${docNo}`)
    }
    if (prodNo) {
      SQL(`DELETE FROM rd_prod_info_detail WHERE 单据编号='${prodNo}'; DELETE FROM rd_prod_info_head WHERE 单据编号='${prodNo}';`)
      console.log(`  --   清理产品信息 ${prodNo}`)
    }
    const left1 = String(SQL(`SELECT COUNT(*) FROM rd_mold_proc_head WHERE 单据编号 LIKE 'MP-2026-09-%' AND 产品编号=''`)).trim()
    console.log(`  --   残留检查:本探针单 ${docNo || '(未建)'} / 产品 ${prodNo || '(未建)'};同形空白草稿 ${left1} 张(历史遗留,非本次)`)
  }
  console.log(failed ? `\n✗ ${failed} 项未通过` : '\n✓ 端到端全绿')
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('探针异常:' + (e && e.stack || e)); process.exit(1) })
