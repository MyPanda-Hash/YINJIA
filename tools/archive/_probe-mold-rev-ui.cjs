/**
 * _probe-mold-rev-ui.cjs — 成型工艺清单「修订记录」页签的**界面**验收(2026-09-20)
 *
 * 为什么还要界面探针:接口探针(_probe-mold-rev-tab.cjs)只证明"行落库/读得回来",
 * 而这一轮真正会**在页面上露馅**的是三件事,只有渲染出来才看得见:
 *   ① 页签顺序与页题(修订记录在最前、页 1/页 2 顺延之后仍然各按各的版式渲染 —— 页归属改号最容易漏改);
 *   ② 修订记录页**不出报告头**、由居中大标题出「修订记录」(组装那页同款);
 *   ③ 重开既有单据时,修订记录行与配方行**各自按 [表区] 分块显示**(表区读不回来时两页都空白);
 *   ④ 与组装工艺清单的修订记录页**逐格一致**(列宽数组/页题),这是用户口径「一样」的可视证据。
 *
 * 依赖:tools/node_modules/ws、headless Edge(与本仓其它探针同款)。
 * 用法:node tools/archive/_probe-mold-rev-ui.cjs   (需后端 8090 + 已跑 migrate-mold-proc-revision.sql)
 * 产出:tools/archive/_shots/mold-rev-*.png(截图,供人工/视觉模型比对)
 */
'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const BASE = process.env.YINJIA_API || 'http://localhost:8090'
const FRONT = process.env.YINJIA_FRONT || 'http://localhost:8090'
const EDGE = process.env.EDGE_BIN || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9333
const SHOTS = path.join(__dirname, '_shots')

const MOLD = 'RD_MOLD_PROC'
const ASM = 'RD_ASM_PROC'
const REV_COLS = [60, 300, 200, 130, 120, 184]        // 修订记录页可见列宽(合计 994,k≈1.046 ⇒ 渲染 1040)
// 成型工艺清单页(页 1)11 列网格 —— 2026-09-20 起「炭棒尺寸」的外径/内径两块各自对半平分:
// B=C=90(外径 90|90)、D+E=F+G=155(内径 155|155);只挪块**内**列宽,
// 块宽 B:C=180 / D:G=310 / H:K=420 与行总宽 1040 一分未动(见 recordSheetConfigs.js 注释)。
const MOLD_P1 = [130, 90, 90, 85, 70, 78, 77, 100, 70, 125, 125]
const MOLD_P2 = [101, 60, 109, 85, 52, 52, 52, 146, 64, 64, 121, 77, 57]

let failed = 0
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => { failed++; console.log('  FAIL ' + m) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const eqArr = (a, b) => JSON.stringify(a) === JSON.stringify(b)
/** 等比缩放后的列宽做整数比较:设计像素 × k,允许 ±1px 舍入 */
const nearArr = (a, b, tol = 2) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= tol)

async function main() {
  // ── 造一张带两种表区行的单据(修订记录 ×2 + 配方表 ×1) ──
  const lr = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = lr?.data?.token
  if (!token) throw new Error('登录失败:' + JSON.stringify(lr))
  const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` }
  const btn = async (panelCode, buttonName, formData) => (await (await fetch(`${BASE}/api/px/callButton`, {
    method: 'POST', headers: H, body: JSON.stringify({ panelCode, buttonName, formData, buttonParam: {} }),
  })).json())

  const created = await btn(MOLD, '保存', {})
  const no = created?.data?.['编号']
  if (!no) throw new Error('建单失败:' + JSON.stringify(created))
  const items = [
    { 表区: '修订记录', 序号: '1', 更改内容: 'UI-PROBE-初版发布', 更改原因: '新规格立项', 更改时间: '2026-09-20', 责任人: '陈秀丽', 备注: '首个版本' },
    { 表区: '修订记录', 序号: '2', 更改内容: 'UI-PROBE-密度下限调整', 更改原因: '客户复测', 更改时间: '2026-09-20', 责任人: '冯敏', 备注: '' },
    { 表区: '配方表', 序号: '1', 物料种类: '活性炭', 物料编号: 'UI-PROBE-C-001', 物料名称: '椰壳活性炭', 实际添加比例: '60', 单支物料含量: '12.5', 设计添加量: '12' },
  ]
  const saved = await btn(MOLD, '保存', { 编号: no, 产品编号: 'UI-PROBE-P-001', 产品名称: '探针产品', detail: { items } })
  if (saved?.code !== 200) throw new Error('保存失败:' + JSON.stringify(saved))
  console.log(`  --   造数:${no}(修订记录 2 行 + 配方表 1 行)`)

  fs.mkdirSync(SHOTS, { recursive: true })
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-moldrev-'))
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
      const f = path.join(SHOTS, `mold-rev-${tag}.png`)
      fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'))
      return f
    }
    /** 按页面坐标裁一块截图(用于只看某一行的像素:整页截图是视口高,行常在折叠下看不见) */
    const shotClip = async (tag, x, y, width, height) => {
      const r = await send('Page.captureScreenshot', {
        format: 'png', captureBeyondViewport: true,
        clip: { x: Math.max(0, x), y: Math.max(0, y), width, height, scale: 1 },
      })
      if (!r.result?.data) return null
      const f = path.join(SHOTS, `mold-rev-${tag}.png`)
      fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'))
      return f
    }
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1500, deviceScaleFactor: 1, mobile: false })
    await nav(`${FRONT}/#/login`)
    await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lr.data.user))}); 'ok'`)
    await nav('about:blank')

    // ── DOM 抓取 ──
    const tabs = () => ev(`[].slice.call(document.querySelectorAll('.rsp-page-tab')).map(function(t){return t.textContent.trim()})`)
    const clickTab = (t) => ev(`(function(){ var ts=[].slice.call(document.querySelectorAll('.rsp-page-tab'));
      for(var i=0;i<ts.length;i++){ if(ts[i].textContent.trim()===${JSON.stringify(t)}){ ts[i].click(); return 1 } } return 0 })()`)
    /** 当前页可见数据表:列宽 + 行内容(编辑态读 input/textarea 的 value) */
    const snap = () => ev(`(function(){
      var root=document.querySelector('.record-sheet'); if(!root) return null
      var tabs=[].slice.call(document.querySelectorAll('.rsp-page-tab')).filter(function(t){return t.offsetParent});
      var title=null, ts=[].slice.call(root.querySelectorAll('.rsp-page-title')).filter(function(e){return e.offsetParent});
      if(ts.length) title=(ts[0].textContent||'').trim();
      var headVisible=[].slice.call(root.querySelectorAll('table.rs-head-t')).some(function(t){return t.offsetParent});
      var wraps=[].slice.call(root.querySelectorAll('.rsp-dt-wrap')).filter(function(w){return w.offsetParent});
      var out=wraps.map(function(w){
        var t=w.querySelector('table.rs-dt'); if(!t) return null
        var cg=t.querySelector('colgroup')
        var cols=cg?[].slice.call(cg.querySelectorAll('col')).map(function(c){return Math.round(parseFloat(c.style.width)||0)}).filter(function(x){return x>0}):[]
        var rows=[]
        ;[].slice.call(t.querySelectorAll('tbody tr')).forEach(function(tr){
          if(tr.querySelector('th')) return                                  // 表头行
          var cells=[].slice.call(tr.querySelectorAll('td'))
          var vals=cells.map(function(td){ var i=td.querySelector('input,textarea'); return i? i.value : (td.textContent||'').trim() })
          var joined=vals.join('').trim()
          if(!vals.length) return
          if(joined==='' || joined==='—' || joined==='-') return             // 空表占位行
          if(vals.some(function(v){return v.indexOf('字段编辑')>=0})) return   // 格式区条(bar 行)
          rows.push(vals) })
        return { cols:cols, total:cols.reduce(function(a,b){return a+b},0), rows:rows } }).filter(Boolean)
      var titleTables=[].slice.call(root.querySelectorAll('table')).filter(function(t){return t.offsetParent})
        .map(function(t){ var cg=t.querySelector('colgroup'); return cg? [].slice.call(cg.querySelectorAll('col')).map(function(c){return Math.round(parseFloat(c.style.width)||0)}).filter(function(x){return x>0}):[] })
      var txt=root.innerText||''
      var m=txt.match(/((?:MP|AP|MF|AB|PI)-\\d{4}-\\d{2}-\\d{4})/)
      return { tabs:tabs.map(function(x){return x.textContent.trim()}), pageTitle:title, headVisible:headVisible,
               tables:out, allCols:titleTables, docNo: m? m[1] : '' } })()`)
    const docNoNow = () => ev(`(function(){ var t=document.querySelector('.record-sheet'); var txt=t?(t.innerText||''):''
      var m=txt.match(/((?:MP|AP|MF|AB|PI)-\\d{4}-\\d{2}-\\d{4})/); return m? m[1] : '' })()`)
    const DQ = `[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.textContent.indexOf('查询单据')>=0 && d.getBoundingClientRect().height>0}).pop()`
    const clickSide = (label) => ev(`(function(){
      var all=[].slice.call(document.querySelectorAll('.as-side-btn,.as-side-menu-item,.as-side-btn-row>.as-side-btn'));
      for(var i=0;i<all.length;i++){ var t=(all[i].textContent||'').trim();
        if(t===${JSON.stringify(label)} && all[i].offsetParent){ all[i].click(); return 1 } } return 0 })()`)
    /** 让纸张显示指定单据(列表面板默认展示的不一定是探针那张) */
    const focusDoc = async (want) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (await docNoNow() === want) return want
        await clickSide('查询单据'); await sleep(900)
        await ev(`(function(){ var dlg=${DQ}; if(!dlg) return 'NO_DIALOG'
          var inp=dlg.querySelector('input'); if(!inp) return 'NO_INPUT'
          Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(inp, ${JSON.stringify(want)})
          inp.dispatchEvent(new Event('input',{bubbles:true})); return 'SET' })()`)
        await sleep(400)
        await ev(`(function(){ var dlg=${DQ}; if(!dlg) return 'NO_DIALOG'
          var bs=[].slice.call(dlg.querySelectorAll('button'))
          for(var i=0;i<bs.length;i++){ if(bs[i].textContent.trim()==='查询'){ bs[i].click(); return 'CLICKED' } } return 'NO_BTN' })()`)
        await sleep(2600)
      }
      return await docNoNow()
    }

    // ════ ① 成型工艺清单:三页签 + 修订记录页在最前 ════
    // 先停在「成型工艺清单」页读单据编号:修订记录页不出报告头,那张纸上看不到编号
    await nav(`${FRONT}/#/panelx/list/${MOLD}`); await sleep(2500)
    await clickTab('成型工艺清单'); await sleep(900)
    if (await docNoNow() !== no) { await focusDoc(no); await clickTab('成型工艺清单'); await sleep(900) }
    const shown = await docNoNow()
    if (shown === no) ok(`①-0 纸张显示的是探针单 ${no}`)
    else bad(`①-0 纸张显示的单据是 ${JSON.stringify(shown)},不是探针单 ${no}(后面断言不可信)`)
    await clickTab('修订记录'); await sleep(900)
    const s0 = await snap()
    const moldTabs = s0?.tabs || []
    eqArr(moldTabs, ['修订记录', '成型工艺清单', '成型配方'])
      ? ok(`① 页签 = ${JSON.stringify(moldTabs)}`)
      : bad(`① 页签应为 ['修订记录','成型工艺清单','成型配方'],实际 ${JSON.stringify(moldTabs)}`)

    // ════ ② 修订记录页:居中大标题 + 无报告头 + 与组装同列宽 ════
    if (s0?.pageTitle === '修订记录') ok('②-1 第 0 页出居中大标题「修订记录」')
    else bad(`②-1 第 0 页大标题应为「修订记录」,实际 ${JSON.stringify(s0?.pageTitle)}`)
    if (s0?.headVisible === false) ok('②-2 修订记录页不渲染报告头(与组装一致)')
    else bad('②-2 修订记录页不应有报告头')
    const revTable = (s0?.tables || [])[0]
    // 列宽按**占比**比:设计像素要乘 k = 网格宽 1040 ÷ 可见列合计 994 ≈ 1.0463 才是渲染像素
    const share = (arr) => (arr || []).map((w) => +(w / arr.reduce((a, b) => a + b, 0)).toFixed(3))
    if (revTable && nearArr(share(revTable.cols), share(REV_COLS), 0.005)) {
      ok(`②-3 修订记录表列宽占比 ≈ 设计占比(实际 px ${JSON.stringify(revTable.cols)} 合计 ${revTable.total})`)
    } else bad(`②-3 修订记录表列宽占比异常:${JSON.stringify(share(revTable && revTable.cols))} vs ${JSON.stringify(share(REV_COLS))}`)
    const shot1 = await shot('mold-tab0')

    // ════ ③ 重开单据后两种表区的行各自显示(表区读不回来的话这里就是空的) ════
    console.log('  --   修订记录表实际行:' + JSON.stringify(revTable?.rows))
    const flat = (revTable?.rows || []).flat().join('|')
    if (flat.includes('UI-PROBE-初版发布') && flat.includes('UI-PROBE-密度下限调整')) ok('③-1 修订记录 2 行在任何重开都读得回来(表区分块生效)')
    else bad(`③-1 修订记录行没渲染出来,实际单元格:${JSON.stringify(revTable?.rows)}`)
    const revRowCount = (revTable?.rows || []).filter((r) => r.join('').includes('UI-PROBE-初版发布') || r.join('').includes('UI-PROBE-密度下限调整')).length
    if (revRowCount === 2) ok('③-2 修订记录表恰好渲染出 2 行本次造的数据')
    else bad(`③-2 修订记录表命中探针内容的行数 = ${revRowCount},期望 2`)
    if (!flat.includes('UI-PROBE-C-001')) ok('③-2b 修订记录表没有串入配方行(表区过滤生效)')
    else bad('③-2b 修订记录表串入了配方行(表区过滤失效)')

    // 切到「成型配方」:配方行要看得见(同一张行表、另一表区)
    await clickTab('成型配方'); await sleep(1200)
    const s2 = await snap()
    const fTable = (s2?.tables || [])[0]
    const fFlat = (fTable?.rows || []).flat().join('|')
    if (fFlat.includes('UI-PROBE-C-001')) ok('③-3 成型配方页显示自己的配方行(未被修订记录挤掉)')
    else bad(`③-3 成型配方页没显示配方行,实际:${JSON.stringify(fTable?.rows)}`)
    const shot2 = await shot('mold-tab2')

    // 切到「成型工艺清单」:原两页版式未被改号改坏 + 炭棒尺寸外径/内径两块对半平分
    await clickTab('成型工艺清单'); await sleep(1200)
    const s1 = await snap()
    const grid11 = (s1?.allCols || []).find((c) => eqArr(c, MOLD_P1))
    if (grid11) ok(`③-4 成型工艺清单页 11 列网格 = ${JSON.stringify(MOLD_P1)}(外径/内径对半改版后)`)
    else bad(`③-4 成型工艺清单页列宽异常:${JSON.stringify(s1?.allCols)}`)
    // 逐格量「炭棒尺寸」这一行:外径 90|90、内径 155|155、内孔要求 420(行总长 1040 不变)
    // ⚠ 不能按单元格文字找值格:编辑态里值格是 el-input(textContent 为空),按文字只会命中**表头格**
    //   (表头 外径mm 跨 2 列=180、内径mm 跨 4 列=310)—— 实测踩过,故改为「表头行 → 下一行」定位值行。
    const widths = await ev(`(function(){
      var root=document.querySelector('.record-sheet'); if(!root) return null
      var anchor=null
      ;[].slice.call(root.querySelectorAll('td,th')).forEach(function(td){
        if(!anchor && (td.textContent||'').replace(/\\s+/g,'')==='炭棒尺寸') anchor=td })
      if(!anchor) return { err:'找不到「炭棒尺寸」锚点格' }
      var headRow=anchor.parentElement
      var header=[].slice.call(headRow.children).map(function(td){ return { t:(td.textContent||'').replace(/\\s+/g,''), span:td.colSpan||1, w:Math.round(td.getBoundingClientRect().width) } })
      var valueRow=headRow.nextElementSibling, value=[]
      while(valueRow && value.length<5){ value=[].slice.call(valueRow.children).map(function(td){ return { span:td.colSpan||1, w:Math.round(td.getBoundingClientRect().width) } }); if(value.length>=5) break; valueRow=valueRow.nextElementSibling }
      return { header:header, value:value, rowW:Math.round(headRow.getBoundingClientRect().width) } })()`)
    console.log('     炭棒尺寸行实测:' + JSON.stringify(widths))
    const v = widths?.value || []
    if (v.length >= 5 && v[0].w === v[1].w) ok(`③-7 外径块对半平分:外径mm ${v[0].w}px | 外径公差 ${v[1].w}px`)
    else bad(`③-7 外径块未对半:${JSON.stringify(v.slice(0, 2))}`)
    if (v.length >= 5 && v[2].w === v[3].w) ok(`③-8 内径块对半平分:内径mm ${v[2].w}px | 内径公差 ${v[3].w}px`)
    else bad(`③-8 内径块未对半:${JSON.stringify(v.slice(2, 4))}`)
    if (v.length >= 5 && v[4].w === 420) ok('③-9 内孔要求仍是 420px 整块(未被挤动)')
    else bad(`③-9 内孔要求宽度异常:${JSON.stringify(v[4])}`)
    if (widths?.rowW === 1040) ok('③-10 炭棒尺寸行总长仍是 1040px(整体行长度不变)')
    else bad(`③-10 炭棒尺寸行总长 = ${widths?.rowW},期望 1040`)
    // 这一行的**像素证据**:整页截图只有视口高,该行在折叠之下 ⇒ 按页面坐标单独裁一块(留 8px 余量)
    const rect = await ev(`(function(){
      var td=null
      ;[].slice.call(document.querySelectorAll('td,th')).forEach(function(c){ if(!td && (c.textContent||'').replace(/\\s+/g,'')==='炭棒尺寸') td=c })
      if(!td) return null
      var head=td.parentElement, val=head.nextElementSibling
      var r1=head.getBoundingClientRect(), r2=val?val.getBoundingClientRect():r1
      var x=Math.min(r1.left,r2.left)+window.scrollX, y=Math.min(r1.top,r2.top)+window.scrollY
      return { x:x-8, y:y-8, w:(Math.max(r1.right,r2.right)-Math.min(r1.left,r2.left))+16,
               h:(Math.max(r1.bottom,r2.bottom)-Math.min(r1.top,r2.top))+16 } })()`)
    const shotRow = rect ? await shotClip('size-row', rect.x, rect.y, rect.w, rect.h) : null
    console.log(`     炭棒尺寸行像素截图:${shotRow}`)
    if (s1?.headVisible) ok('③-5 成型工艺清单页仍渲染自己的报告头')
    else bad('③-5 成型工艺清单页报告头丢了')
    if ((s2?.allCols || []).some((c) => eqArr(c, MOLD_P2))) ok(`③-6 成型配方页仍是原 13 列网格`)
    else bad(`③-6 成型配方页列宽异常:${JSON.stringify(s2?.allCols)}`)
    const shot3 = await shot('mold-tab1')

    // ════ ④ 与组装工艺清单的修订记录页逐格一致 ════
    await nav(`${FRONT}/#/panelx/list/${ASM}`); await sleep(2500)
    await clickTab('修订记录'); await sleep(1000)
    const asm = await snap()
    const asmRev = (asm?.tables || [])[0]
    if (asm?.pageTitle === s0?.pageTitle) ok(`④-1 两面板修订记录页页题一致(${asm?.pageTitle})`)
    else bad(`④-1 页题不一致:成型 ${s0?.pageTitle} vs 组装 ${asm?.pageTitle}`)
    if (nearArr(asmRev?.cols || [], revTable?.cols || [], 1)) ok(`④-2 两面板修订记录页列宽逐格一致(${JSON.stringify(asmRev?.cols)})`)
    else bad(`④-2 列宽不一致:成型 ${JSON.stringify(revTable?.cols)} vs 组装 ${JSON.stringify(asmRev?.cols)}`)
    if (asm?.headVisible === false) ok('④-3 组装修订记录页同样不出报告头')
    else bad('④-3 组装修订记录页应无报告头')
    const shot4 = await shot('asm-tab0')

    console.log(`  --   截图:${[shot1, shot2, shot3, shot4].filter(Boolean).join(', ')}`)
  } finally {
    if (ws) try { ws.close() } catch { /* ignore */ }
    edge.kill()
    const del = await btn(MOLD, '删除', { 编号: no })
    console.log(`  --   清理:删除探针单 ${no}(code=${del?.code})`)
  }

  console.log(failed ? `\n${failed} 项断言失败` : '\nALL PASSED')
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('探针异常:', e.message); process.exit(1) })
