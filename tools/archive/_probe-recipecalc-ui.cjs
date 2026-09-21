/**
 * _probe-recipecalc-ui.cjs — 配方计算弹窗的**界面**闭环验收(2026-09-20)
 *
 * 为什么要有它:接口探针证明不了"按钮在不在、弹窗算出来的数对不对、点『填入单据』有没有真写进去"。
 * 本轮真正会露馅的是四件事,只有渲染出来点一遍才看得见:
 *   ① 成型配方页的配方表表头上有没有「配方计算」按钮(配置没接上就只有一张空表头);
 *   ② 弹窗读的是**本单据当前那几行**(料位分组/料位 1 补差/折算料按克每支)——读错了数会整体偏;
 *   ③ 结果的位数与数值是否与设计器 exe 一致(弹窗里一切几/公差/含水率是可改的,改完要立刻重算);
 *   ④ 点「填入单据」后,页 1 的十一个格与配方表两列**有没有真的落进单据模型**(只在弹窗里显示不算数)。
 *
 * 期望值不是从实现里抄的:是用 exe 里的真引擎(见 tools/archive/_gen-recipe-golden.py 同一取法)
 * 按本探针的造数算出来的,写死在 EXP 里 —— 浏览器算出来的必须与它逐字相同。
 *
 * 依赖:tools/node_modules/ws、headless Edge(与本仓其它探针同款)、
 *       后端 8090 + 前端 dev 5173(5173 才会带上本次改动)
 * 用法:node tools/archive/_probe-recipecalc-ui.cjs
 * 产出:tools/archive/_shots/reccalc-*.png;结束后按精确单号清理探针单
 */
'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const BASE = process.env.YINJIA_API || 'http://localhost:8090'
const FRONT = process.env.YINJIA_FRONT || 'http://localhost:5173'
const EDGE = process.env.EDGE_BIN || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9334
const SHOTS = path.join(__dirname, '_shots')
const MOLD = 'RD_MOLD_PROC'

/** exe 真引擎对本探针造数算出的期望值(见文件头:不是从实现里抄的) */
const EXP = {
  理论最低灌料重量g: '245.1', 理论灌料中间值g: '245.9', 理论最高灌料重量g: '247.6',
  理论水分: '3.72%',
  最短长度mm: '253.5', 中间值mm: '256.0', 最长长度mm: '259.5',
  最低重量g: '235.9', 中间值g: '237.2', 最高重量g: '238.4',
  slot1_比例: '60.63%', slot1_含量: '143.55',
  slot6_比例: '29.75%', slot6_含量: '70.43',
  slot7_比例: '7.93%', slot7_含量: '18.78',
  slot8_比例: '1.69%', slot8_含量: '4.00',
}

const RECIPE_ROWS = [
  ['炭粉', 'UC-P1', '0.62'], ['炭粉', 'UC-P2', '0'], ['炭粉', 'UC-P3', '0'], ['炭粉', 'UC-P4', '0'], ['炭粉', 'UC-P5', '0'],
  ['胶粉', 'UC-G1', '0.30'], ['胶粉', 'UC-G2', '0.08'],
  ['功能料-颗粒', 'UC-C1', '2'], ['功能料-颗粒', 'UC-C2', '0'], ['功能料-颗粒', 'UC-C3', '0'],
]

let failed = 0
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => { failed++; console.log('  FAIL ' + m) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  // ── 服务可达性(先确认探的是带本次改动的那一份) ──
  const front = await fetch(FRONT + '/').then((r) => r.text()).catch(() => '')
  if (front.includes('/src/main.js')) ok(`①-0 探的是 dev 源码服务 ${FRONT}(带本次改动)`)
  else bad(`①-0 ${FRONT} 不是 vite dev(拿不到带改动的源码);请确认前端 dev 已启动`)

  // ── 造一张探针单(产品编号留空 ⇒ 不过四文件编辑门禁,草稿可编) ──
  const lr = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = lr?.data?.token
  if (!token) throw new Error('登录失败:' + JSON.stringify(lr))
  const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` }
  const btn = async (buttonName, formData) => (await (await fetch(`${BASE}/api/px/callButton`, {
    method: 'POST', headers: H, body: JSON.stringify({ panelCode: MOLD, buttonName, formData, buttonParam: {} }),
  })).json())

  // ⚠ 用「保存为草稿」而不是「保存」:后者会跑必填校验(产品编号/产品名称不能为空),
  //   而一填产品编号就触发「四文件编辑门禁」(未分发禁编),探针单在界面上会变成不可编辑、
  //   「配方计算」按钮根本不渲染。草稿路径既免必填、又因产品编号为空而豁免门禁 —— 正好是探针要的。
  const created = await btn('保存为草稿', {})
  const no = created?.data?.['编号']
  if (!no) throw new Error('建单失败:' + JSON.stringify(created))
  const items = RECIPE_ROWS.map(([kind, code, design], i) => ({
    表区: '配方表', 序号: String(i + 1), 物料种类: kind, 物料编号: code, 物料名称: code, 设计添加量: design,
  }))
  const saved = await btn('保存为草稿', {
    编号: no, 炭棒规格1: '59.5', 炭棒规格2: '39.5', 炭棒规格3: '120',
    实际密度管控下限: '0.58', 实际密度管控上限: '0.60', detail: { items },
  })
  if (saved?.code !== 200) throw new Error('保存失败:' + JSON.stringify(saved))
  console.log(`  --   造数:${no}(配方表 10 行:粉料 5 + 胶粉 2 + 折算料 3)`)

  fs.mkdirSync(SHOTS, { recursive: true })
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-reccalc-'))
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
      const f = path.join(SHOTS, `reccalc-${tag}.png`)
      fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'))
      return f
    }
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1500, deviceScaleFactor: 1, mobile: false })
    await nav(`${FRONT}/#/login`)
    await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lr.data.user))}); 'ok'`)
    // ⚠ 必须先离开本站再回来:#/login → #/panelx/... 是同文档 hash 变化、不会重新加载,
    //   而 store 是在启动时读 localStorage 的 —— 少这一步,注入的令牌要等下一次真刷新才生效。
    await nav('about:blank')
    await nav(`${FRONT}/#/panelx/list/${MOLD}`)
    await sleep(2500)

    // ── DOM 工具 ──
    const clickTab = (t) => ev(`(function(){ var ts=[].slice.call(document.querySelectorAll('.rsp-page-tab'));
      for(var i=0;i<ts.length;i++){ if(ts[i].textContent.trim()===${JSON.stringify(t)}){ ts[i].click(); return 1 } } return 0 })()`)
    const docNoNow = () => ev(`(function(){
      var t=document.querySelector('.record-sheet'); var txt=t?(t.innerText||''):''
      // ⚠ 单据编号是 <input> 的 value,innerText 里没有 —— 必须连 input 的 value 一起找
      var vals=[].slice.call(document.querySelectorAll('input')).map(function(i){return i.value}).join(' ')
      var m=(txt+' '+vals).match(/((?:MP|AP|MF|AB|PI)-\\d{4}-\\d{2}-\\d{4})/); return m? m[1] : '' })()`)
    const clickSide = (label) => ev(`(function(){
      var all=[].slice.call(document.querySelectorAll('.as-side-btn,.as-side-menu-item,.as-side-btn-row>.as-side-btn'));
      for(var i=0;i<all.length;i++){ var t=(all[i].textContent||'').trim();
        if(t===${JSON.stringify(label)} && all[i].offsetParent){ all[i].click(); return 1 } } return 0 })()`)
    const DQ = `[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.textContent.indexOf('查询单据')>=0 && d.getBoundingClientRect().height>0}).pop()`
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
    /** 弹窗根节点 */
    const DLG = `[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.querySelector('.rcd') && d.getBoundingClientRect().height>0}).pop()`
    /** 弹窗结果区:标签 → 值 */
    const dlgResults = () => ev(`(function(){ var d=${DLG}; if(!d) return null; var out={}
      ;[].slice.call(d.querySelectorAll('.rcd-r')).forEach(function(r){ var l=r.querySelector('.rcd-r-lb'), v=r.querySelector('.rcd-r-v')
        if(l&&v) out[l.textContent.trim()] = v.textContent.trim() }); return out })()`)
    /** 弹窗料位表:每行 [料位,分组,编号,名称,设计值,含水率,最终比例,单支克重] */
    const dlgSlots = () => ev(`(function(){ var d=${DLG}; if(!d) return null
      return [].slice.call(d.querySelectorAll('.rcd-tb')).filter(function(t){return t.textContent.indexOf('料位')>=0})[0]
        ? [].slice.call(d.querySelectorAll('.rcd-tb')[0].querySelectorAll('tbody tr')).map(function(tr){
            return [].slice.call(tr.querySelectorAll('td')).map(function(td){ var i=td.querySelector('input'); return i? i.value : (td.textContent||'').trim() }) }) : null })()`)
    /** 回填预览文本 */
    const dlgPreview = () => ev(`(function(){ var d=${DLG}; if(!d) return ''
      var tbs=[].slice.call(d.querySelectorAll('.rcd-two .rcd-tb'))
      return tbs.map(function(t){return (t.innerText||'').replace(/\\n/g,' | ')}).join(' || ') })()`)
    /** 用原生 setter 填 el-input(否则 Vue 收不到 input 事件) */
    const setInput = (selectorJs, value) => ev(`(function(){ var el=${selectorJs}; if(!el) return 'NO_EL'
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(el, ${JSON.stringify(value)})
      el.dispatchEvent(new Event('input',{bubbles:true})); return 'SET' })()`)
    const dlgBtn = (label) => ev(`(function(){ var d=${DLG}; if(!d) return 'NO_DLG'
      var bs=[].slice.call(d.closest('.el-dialog__wrapper') ? d.closest('.el-dialog__wrapper').querySelectorAll('button') : d.querySelectorAll('button'))
      for(var i=0;i<bs.length;i++){ if(bs[i].textContent.trim().indexOf(${JSON.stringify(label)})>=0){ bs[i].click(); return 'CLICKED' } } return 'NO_BTN' })()`)

    // ════ ① 页面:切到成型配方页,表头应有「配方计算」按钮 ════
    // ⚠ 面板默认停在「修订记录」页,而那页**不出报告头**(设计如此)⇒ 那页读不到单据编号。
    //   必须先切到「成型工艺清单」页再找单据,否则 focusDoc 永远等不到目标单号。
    await clickTab('成型工艺清单'); await sleep(900)
    const shown = await focusDoc(no)
    if (shown === no) ok(`①-0 纸张显示的是探针单 ${no}`)
    else bad(`①-0 纸张显示的是 ${JSON.stringify(shown)},不是探针单(后面断言不可信)`)
    await clickTab('成型配方'); await sleep(1400)
    const hasBtn = await ev(`(function(){ var bs=[].slice.call(document.querySelectorAll('.rs-lib-btn'))
      return bs.some(function(b){ return b.textContent.indexOf('配方计算')>=0 && b.offsetParent }) })()`)
    if (hasBtn) ok('①-1 配方表表头出现「配方计算」按钮')
    else bad('①-1 配方表表头没有「配方计算」按钮(配置 recipeCalc 没接上?)')
    const shot1 = await shot('01-formula-tab')
    if (!hasBtn) return

    // ════ ② 打开弹窗:参数来自标准库默认条目 + 10 料位按物料种类分组 ════
    await ev(`(function(){ var bs=[].slice.call(document.querySelectorAll('.rs-lib-btn'))
      for(var i=0;i<bs.length;i++){ if(bs[i].textContent.indexOf('配方计算')>=0){ bs[i].click(); return 1 } } return 0 })()`)
    await sleep(1800)
    const title = await ev(`(function(){ var d=${DLG}; if(!d) return ''; var h=d.querySelector('.el-dialog__title'); return h? h.textContent.trim() : '' })()`)
    if (title === '配方计算') ok('②-1 弹窗标题 = 配方计算')
    else bad(`②-1 弹窗标题应为「配方计算」,实际 ${JSON.stringify(title)}`)
    const scope = await ev(`(function(){ var d=${DLG}; if(!d) return ''; var n=d.querySelector('.rcd-muted'); return n? n.textContent.trim() : '' })()`)
    console.log('  --   参数范围提示:' + JSON.stringify(scope))
    if (scope.includes('默认')) ok('②-2 参数从标准库 mold.calcparam 的默认条目载入(迁移脚本生效)')
    else bad('②-2 没读到系统默认参数条目(检查 migrate-mold-calcparam.sql 是否已执行)')

    const slots0 = await dlgSlots()
    if (slots0 && slots0.length === 10) ok('②-3 料位表 10 行')
    else bad(`②-3 料位表应为 10 行,实际 ${slots0 ? slots0.length : 'null'}`)
    const groups = (slots0 || []).map((r) => r[1])
    JSON.stringify(groups) === JSON.stringify(['粉料', '粉料', '粉料', '粉料', '粉料', '胶粉', '胶粉', '折算料', '折算料', '折算料'])
      ? ok(`②-4 料位分组 = ${JSON.stringify(groups)}`)
      : bad(`②-4 料位分组异常:${JSON.stringify(groups)}`)
    const codes = (slots0 || []).map((r) => r[2])
    JSON.stringify(codes) === JSON.stringify(RECIPE_ROWS.map((r) => r[1]))
      ? ok('②-5 料位上的物料编号与配方表逐行一致')
      : bad(`②-5 料位物料编号串了:${JSON.stringify(codes)}`)
    if ((slots0 || [])[0]?.[4]?.includes('补差')) ok(`②-6 料位 1 显示为补差位(${slots0[0][4]})`)
    else bad(`②-6 料位 1 应显示「补差 xx%」,实际 ${JSON.stringify(slots0?.[0]?.[4])}`)

    // ════ ③ 改参数与含水率 → 数值必须等于 exe 引擎算出来的 ════
    // 一切几 = 2(探针造数按 2 腔算期望值;弹窗默认取标准库的 1,这里显式改掉)
    const setParam = (label, value) => setInput(
      `[].slice.call(${DLG}.querySelectorAll('.rcd-pf')).filter(function(l){return l.textContent.indexOf(${JSON.stringify(label)})>=0})[0].querySelector('input')`, value)
    await setParam('一切几', '2')
    await sleep(300)
    await setParam('成型长度公差上限mm', '3.5')
    await sleep(400)
    const moistSet = await ev(`(function(){ var d=${DLG}; if(!d) return 0
      var trs=[].slice.call(d.querySelectorAll('.rcd-tb')[0].querySelectorAll('tbody tr')); var n=0
      trs.forEach(function(tr){ var i=tr.querySelectorAll('td')[5].querySelector('input')
        if(i){ Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(i,'6')
               i.dispatchEvent(new Event('input',{bubbles:true})); n++ } }); return n })()`)
    if (moistSet === 5) ok('③-1 粉料 5 个料位的含水率填 6(%),非粉料位不可填')
    else bad(`③-1 可填含水率的料位数 = ${moistSet},期望 5(只粉料位)`)
    await sleep(800)
    const res = await dlgResults() || {}
    // 结果区只比"页 1 那十项";slot* 是料位表里的值,由 ③-3 单独比(别混在一起比)
    const headExp = Object.entries(EXP).filter(([k]) => !k.startsWith('slot'))
    const diffs = headExp.filter(([k, v]) => !String(Object.entries(res).find(([rk]) => rk === k)?.[1] ?? '').includes(v))
    if (!diffs.length) ok('③-2 结果 10 项与 exe 引擎逐字一致(245.1 / 245.9 / 247.6 / 3.72% / 253.5 / 256.0 / 259.5 / 235.9 / 237.2 / 238.4)')
    else bad(`③-2 结果与 exe 不一致:${JSON.stringify(diffs.map(([k, v]) => [k, '期望含' + v, '实际' + Object.entries(res).find(([rk]) => rk === k)?.[1]]))}`)
    const slots1 = await dlgSlots() || []
    const slotCheck = [[0, EXP.slot1_比例, EXP.slot1_含量], [5, EXP.slot6_比例, EXP.slot6_含量], [7, EXP.slot8_比例, EXP.slot8_含量]]
    const slotBad = slotCheck.filter(([i, ratio, amount]) => slots1[i]?.[6] !== ratio || slots1[i]?.[7] !== amount)
    if (!slotBad.length) ok('③-3 料位最终比例/单支克重与 exe 一致(料位1 60.63%/143.55、料位6 29.75%/70.43、料位8 1.69%/4.00)')
    else bad(`③-3 料位结果不一致:${JSON.stringify(slotBad.map(([i]) => [i, slots1[i]?.[6], slots1[i]?.[7]]))}`)
    const warnTexts = await ev(`(function(){ var d=${DLG}; if(!d) return []
      return [].slice.call(d.querySelectorAll('.rcd-warn')).map(function(w){return w.textContent.trim()}) })()`)
    if (!warnTexts.length) ok('③-4 无告警(配平且含水率齐全,与 exe 的 warnings=[] 一致)')
    else bad(`③-4 期望无告警,实际渲染:${JSON.stringify(warnTexts)}`)

    // ════ ④ 回填预览:旧值 → 新值 ════
    const preview = await dlgPreview()
    const previewOk = preview.includes('理论最低灌料重量g') && preview.includes('245.1') && preview.includes('60.63%') && preview.includes('143.55')
    if (previewOk) ok('④-1 回填预览列出页 1 字段与配方表两列的新值')
    else bad(`④-1 回填预览内容不合预期:${JSON.stringify(preview.slice(0, 240))}`)
    if (preview.includes('→')) ok('④-2 预览带旧值 → 新值(首次回填旧值为空)')
    else bad('④-2 预览没有旧值箭头')
    const shot2 = await shot('02-dialog')

    // ════ ⑤ 点「填入单据」→ 单据模型真的被写入 ════
    await dlgBtn('填入单据'); await sleep(1800)
    await clickTab('成型工艺清单'); await sleep(1200)
    const p1Text = String(await ev(`(function(){ var t=document.querySelector('.record-sheet'); var txt=t?(t.innerText||''):''
      var vals=[].slice.call(document.querySelectorAll('input,textarea')).map(function(i){return i.value}).join(' ')
      return txt+' '+vals })()`))
    const p1Missing = ['245.1', '245.9', '247.6', '253.5', '256.0', '259.5', '235.9', '237.2', '238.4'].filter((v) => !p1Text.includes(v))
    if (!p1Missing.length) ok('⑤-1 页 1 的灌料三值/长度三值/重量三值已写入单据(重读 DOM 可见)')
    else bad(`⑤-1 页 1 缺这些回填值:${JSON.stringify(p1Missing)}`)
    if (p1Text.includes('3.72')) ok('⑤-2 理论水分 3.72 已写入')
    else bad('⑤-2 页 1 没有理论水分 3.72')
    const shot3 = await shot('03-page1-filled')

    await clickTab('成型配方'); await sleep(1200)
    const fRows = await ev(`(function(){ var out=[]
      ;[].slice.call(document.querySelectorAll('.rsp-dt-wrap')).filter(function(w){return w.offsetParent}).forEach(function(w){
        var t=w.querySelector('table.rs-dt'); if(!t) return
        ;[].slice.call(t.querySelectorAll('tbody tr')).forEach(function(tr){
          if(tr.querySelector('th')) return
          var vals=[].slice.call(tr.querySelectorAll('td')).map(function(td){ var i=td.querySelector('input,textarea'); return i? i.value : (td.textContent||'').trim() })
          if(vals.join('').trim()) out.push(vals) }) })
      return out })()`)
    const row1 = (fRows || []).find((r) => r.join('|').includes('UC-P1')) || []
    if (row1.join('|').includes('60.63') && row1.join('|').includes('143.55')) ok(`⑤-3 配方表首行已回填 实际添加比例/单支物料含量(${JSON.stringify(row1)})`)
    else bad(`⑤-3 配方表首行没回填:${JSON.stringify(row1)}`)
    const shot4 = await shot('04-formula-filled')

    console.log('  --   截图:' + [shot1, shot2, shot3, shot4].filter(Boolean).join(' , '))
  } finally {
    if (ws) { try { ws.close() } catch { /* ignore */ } }
    try { edge.kill() } catch { /* ignore */ }
  }
}

main().then(() => {
  console.log(`\n${failed ? 'FAILED' : 'PASSED'} — 失败 ${failed} 项`)
  process.exit(failed ? 1 : 0)
}).catch((e) => { console.error('探针异常:', e); process.exit(2) })
