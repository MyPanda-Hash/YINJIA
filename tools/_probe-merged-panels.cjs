/**
 * _probe-merged-panels.cjs — 成型配方 / 组装BOM表 并入工艺清单双页签 的端到端验收(2026-09-11)。
 *
 * 守的口径(与 CONTEXT.md「产品文件文书面板」2026-09-11 决策一致):
 *   ① 面板配置:RD_MOLD_PROC / RD_ASM_PROC 各 2 页签,标题正确;页 2 的字段/表格列都在 yj_field 里登记过
 *      (保存链 labelsToCols 只认登记过的键 —— 没登记 = 界面能填但落不了库);
 *   ② 界面:页签数=2、标题正确;页 1=工艺清单内容、页 2=配方/BOM 内容(用区块标题与列头佐证;互不串页);
 *   ③ 页 2 可编辑可保存:改头字段 + 加明细行 → 点侧栏「保存」→ **接口/ SQL 回读确认落库**;
 *   ④ RD_ASM_PROC 页 1 顶部有「产品编号」参照字段(点得开参照弹窗);
 *   ⑤ 菜单里不再有「成型配方」「组装BOM表」两个入口(导航区文本 + 链接 + 源码生效行);
 *   ⑥ 每个页签 printToPDF 页数 = 1(A4 / 8mm 页边距 / body.approval-printing,数 PDF 里的 /Type /Page);
 *   ⑦ 探针**自己新建**两张单来跑(不碰库里既有单据),跑完自己清干净
 *      (走「删除」软删 + 物理清探针自己的行;**不动 s_allno / yj_usage_log**)。
 *
 * 用法: node tools/_probe-merged-panels.cjs [API] [FRONT]
 *       默认 API=http://localhost:8090(后端),FRONT=http://localhost:5173(前端 dev server)。
 *
 * 依赖:tools/node_modules/ws;headless Edge;sqlcmd(必须 -f 65001,否则中文条件静默不生效)。
 */
const { spawn, execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const API = process.argv[2] || 'http://localhost:8090'
const FRONT = process.argv[3] || 'http://localhost:5173'
const PORT = 9433
const EDGE = process.env.EDGE_BIN || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const MOLD = 'RD_MOLD_PROC'
const ASM = 'RD_ASM_PROC'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fails = []
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m) }
const info = (m) => console.log('     · ' + m)

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
    } catch (e) {
      lastErr = e
      if (e.code !== 'ENOENT') throw e
    }
  }
  throw lastErr
}
function sqlOne(q) {
  const out = sqlRaw(q)
  const lines = out.split(/\r?\n/).map((s) => s.trim())
    .filter((s) => s && !/^-+(\|-+)*$/.test(s) && !/^\(\d+\s/.test(s))
  return lines.length ? lines[0].split('|')[0].trim() : ''
}

/** 数 PDF 里的 /Type /Page(不含 /Pages)—— 粗略但足够区分 1 页与 2 页 */
function pdfPageCount(buf) {
  const s = buf.toString('latin1')
  const m = s.match(/\/Type\s*\/Page[^s]/g)
  return m ? m.length : 0
}

async function main() {
  const login = async (userName, password) => (await (await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName, password }),
  })).json())
  const admin = await login('admin', '123456')
  const adminToken = admin?.data?.token
  if (!adminToken) { console.error('admin 登录失败', admin); process.exit(1) }
  const A = async (p, opts = {}) => {
    const res = await fetch(`${API}${p}`, { ...opts, headers: {
      'Content-Type': 'application/json', Authorization: 'Bearer ' + adminToken, ...(opts.headers || {}) } })
    let body = null
    try { body = await res.json() } catch { /* 空响应体 */ }
    return { http: res.status, code: body?.code, msg: body?.message || body?.msg || '', data: body?.data }
  }
  const panelCfg = async (pc) => (await A(`/api/px/getPanelConfig?panelCode=${pc}`)).data
  const listOf = async (pc) => (await A('/api/px/queryFormDataList', {
    method: 'POST', body: JSON.stringify({ panelCode: pc, pageNo: 1, pageSize: 300 }) })).data?.list || []
  const callBtn = (pc, buttonName, formData = {}) => A('/api/px/callButton', {
    method: 'POST', body: JSON.stringify({ panelCode: pc, buttonName, formData, buttonParam: {} }) })

  console.log(`API=${API}  FRONT=${FRONT}  面板=${MOLD} / ${ASM}`)

  // ════ ⓪ 后端面板配置(=前端 recordSheetConfigs 的同一份真源,页签/字段是否下发)════
  const cfgMold = await panelCfg(MOLD)
  const cfgAsm = await panelCfg(ASM)
  const hdrNames = (cfg) => (cfg?.dataSchema?.fields || []).map((f) => f.dataName)
  const detNames = (cfg) => (cfg?.detail?.tabs?.[0]?.fields || []).map((f) => f.dataName)
  ok(!!cfgMold?.dataSchema?.fields?.length && !!cfgAsm?.dataSchema?.fields?.length,
    `⓪-0 面板配置取回(${MOLD} header=${hdrNames(cfgMold).length} detail=${detNames(cfgMold).length};` +
    ` ${ASM} header=${hdrNames(cfgAsm).length} detail=${detNames(cfgAsm).length})`)
  for (const [pc, cfg, hdrNeed, detNeed] of [
    // 注意:「表区」在成型侧**不该**登记成一字段 —— 它是前端 filterKey 的内存标记,
    // 登记成 place='header' 会让 QueryService 生成 t.[表区],而 rd_mold_proc_head 没有这一列,整面板查询 500。
    [MOLD, cfgMold, ['配料要求', '产品编号', '产品名称', '产品管控类型', '外观要求', '生产车间'],
      ['序号', '物料种类', '物料编号', '物料名称', '实际添加比例', '单支物料含量', '设计添加量']],
    [ASM, cfgAsm, ['产品编号', '产品名称', '产品种类', '整体规格（外径）', '整体规格（长度）', '成品重量', '表区'],
      ['序号', '工序', '工序控制内容', '管控要求', '检查比例',
        '物料名', '物料编号', '物料规格', '外观要求', '用量', '更改内容', '更改原因', '更改时间', '责任人', '备注']],
  ]) {
    const h = hdrNames(cfg); const d = detNames(cfg)
    const missH = hdrNeed.filter((x) => !h.includes(x))
    const missD = detNeed.filter((x) => !d.includes(x))
    ok(!missH.length && !missD.length,
      `⓪-1 ${pc} 页 2 所需字段都已登记 yj_field(缺 header:${missH.join(',') || '无'};缺 detail:${missD.join(',') || '无'})`)
  }
  ok(hdrNames(cfgMold).includes('表区'),
    '⓪-1b 成型侧也登记了「表区」字段(配套 rd_mold_proc_head.表区 物理列;不登记会被 labelsToCols 丢掉,配方行下次打开就消失)')
  for (const [pc, cfg] of [[MOLD, cfgMold], [ASM, cfgAsm]]) {
    const f = (cfg?.dataSchema?.fields || []).find((x) => x.dataName === '产品编号')
    ok(f?.dataType === '参照' && f?.refPanel === 'RD_PROD_INFO' && f?.refField === '产品编号' && f?.displayField === '产品名称',
      `⓪-2 ${pc}.产品编号 参照产品信息表(type=${f?.dataType} ref_panel=${f?.refPanel} ref_field=${f?.refField} display=${f?.displayField})`)
  }

  // ════ ① 菜单里不再出现两个下线入口(源码真源 + 元数据仍保留)════
  const menuSrc = fs.readFileSync('C:/INCER/YINJIA-MES/frontend/src/business/menus.js', 'utf8')
  const activeLines = menuSrc.split(/\r?\n/).filter((l) => !l.trim().startsWith('//'))
  ok(!activeLines.some((l) => l.includes('RD_MOLD_FORMULA')) && !activeLines.some((l) => l.includes('RD_ASM_BOM')),
    '①-1 menus.js 生效行里没有 RD_MOLD_FORMULA / RD_ASM_BOM 入口')
  const oldCfg = await panelCfg('RD_MOLD_FORMULA')
  const oldAsmCfg = await panelCfg('RD_ASM_BOM')
  ok(!!oldCfg?.metadata?.panelName && !!oldAsmCfg?.metadata?.panelName,
    `①-2 两个下线面板的元数据行仍保留(可回滚:${oldCfg?.metadata?.panelName} / ${oldAsmCfg?.metadata?.panelName})`)

  // ════ ② 建两张探针草稿单(自己造数据,不碰库里既有单据)════
  const TAG = Date.now().toString(36)
  const moldNew = await callBtn(MOLD, '新增')
  const asmNew = await callBtn(ASM, '新增')
  const MOLD_DOC = moldNew.data?.['编号'] || ''
  const ASM_DOC = asmNew.data?.['编号'] || ''
  const made = [MOLD_DOC, ASM_DOC].filter(Boolean)
  ok(!!MOLD_DOC && moldNew.data?.['单据状态'] === '草稿', `②-0 ${MOLD} 建探针草稿单 ${MOLD_DOC}(${moldNew.code}/${moldNew.data?.['单据状态']})`)
  ok(!!ASM_DOC && asmNew.data?.['单据状态'] === '草稿', `②-0b ${ASM} 建探针草稿单 ${ASM_DOC}(${asmNew.code}/${asmNew.data?.['单据状态']})`)
  const MOLD_TEXT = `探针配料要求-${TAG}`
  const ASM_KIND = `探针产品种类-${TAG}`
  const ASM_PCODE = `探针产品-${TAG}`
  const MOLD_MAT = `P-MAT-${TAG}`
  const ASM_MAT = `P-ASM-${TAG}`

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-merge-'))
  let edge = null; let ws = null
  const pdfs = []
  try {
    edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--window-size=1760,1400', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
    await sleep(3000)
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()) } catch { return } if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (exp) => {
      const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      if (r.result && r.result.exceptionDetails) return '<<EVAL-ERR ' + r.result.exceptionDetails.text + '>>'
      return r.result && r.result.result ? r.result.result.value : undefined
    }
    const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3200); return } } }

    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1400, deviceScaleFactor: 1, mobile: false })
    await nav(`${FRONT}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(adminToken)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(admin.data.user))}); 'ok'`)
    await nav('about:blank') // 必须整页重载一次,否则被弹回登录页

    const DQ = `[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.textContent.indexOf('查询单据')>=0 && d.getBoundingClientRect().height>0}).pop()`
    const clickSide = (label) => ev(`(function(){
      var all=[].slice.call(document.querySelectorAll('.as-side-btn,.as-side-menu-item,.as-side-btn-row>.as-side-btn'));
      for(var i=0;i<all.length;i++){ var t=(all[i].textContent||'').trim();
        if(t===${JSON.stringify(label)} && all[i].offsetParent){ all[i].click(); return 1 } }
      return 0 })()`)
    /**
     * 当前单据号:文书布局(approval-layout)里**没有** .doc-chip(那是 report/传统布局的),
     * 所以从纸张正文抓编号文本 —— 纸张报告头第一行就是「公司名 + 单号」。
     */
    const docNoNow = () => ev(`(function(){
      var t=document.querySelector('.record-sheet')
      var txt=t ? (t.innerText||'') : ''
      var m=txt.match(/((?:MP|AP|MF|AB|PI)-\\d{4}-\\d{2}-\\d{4}|(?:MP|AP|MF|AB|PI)\\d{9,}|CP\\d+S)/)
      return m ? m[1] : '' })()`)
    const domSnap = () => ev(`(function(){
      var dlg=document.querySelector('.el-dialog');
      return { url: location.hash,
        paperHead: (function(){var t=document.querySelector('.record-sheet'); return t? (t.innerText||'').slice(0,50).replace(/\\s+/g,' ') : null})(),
        pageNo: [].slice.call(document.querySelectorAll('.page-no')).map(function(e){return e.textContent.trim()}),
        docStatus: [].slice.call(document.querySelectorAll('.doc-status')).map(function(e){return e.textContent.trim()}),
        sideBtnCount: document.querySelectorAll('.as-side-btn').length,
        dlgVisible: dlg ? dlg.getBoundingClientRect().height > 0 : null,
        tabs: document.querySelectorAll('.rsp-page-tab').length } })()`)
    const focusDoc = async (no) => {
      for (let attempt = 0; attempt < 2; attempt++) {
        await clickSide('查询单据'); await sleep(900)
        const q = await ev(`(function(){ var dlg=${DQ}; if(!dlg) return 'NO_DIALOG'
          var inp=dlg.querySelector('input'); if(!inp) return 'NO_INPUT'
          var setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set
          setter.call(inp, ${JSON.stringify(no)}); inp.dispatchEvent(new Event('input',{bubbles:true})); return 'SET' })()`)
        await sleep(400)
        const c = await ev(`(function(){ var dlg=${DQ}; if(!dlg) return 'NO_DIALOG'
          var btns=[].slice.call(dlg.querySelectorAll('button'))
          for(var i=0;i<btns.length;i++){ if(btns[i].textContent.trim()==='查询'){ btns[i].click(); return 'CLICKED' } }
          return 'NO_BTN' })()`)
        await sleep(3000)
        // 文书布局里没有 .doc-chip,「当前单据」只能从纸张正文读;纸张报告头第一行=公司名+单号。
        // 注意:成型侧的编号格是 .rs-docno 输入框,innerText 抓不到 —— 那种情况只能靠后续断言兜。
        const seen = await docNoNow()
        info(`[DEBUG] focusDoc(${no}) set=${q} click=${c} 页面可见单号=${JSON.stringify(seen)}`)
        if (seen === no) return seen
        info(`[DEBUG] 当前 DOM=${JSON.stringify(await domSnap())}`)
        await sleep(600)
      }
      return await docNoNow()
    }
    const tabs = () => ev(`[].slice.call(document.querySelectorAll('.rsp-page-tab')).map(function(t){return t.textContent.trim()})`)
    const clickTab = (title) => ev(`(function(){
      var ts=[].slice.call(document.querySelectorAll('.rsp-page-tab'));
      for(var i=0;i<ts.length;i++){ if(ts[i].textContent.trim()===${JSON.stringify(title)}){ ts[i].click(); return 1 } }
      return 0 })()`)
    /**
     * 打开「产品编号」参照弹窗 → 勾第一行 → 确定;返回选中行的产品编号。
     * 参照字段的显示值在 .rs-ref-text 里(不是 input),所以只能走真交互,不能像文本字段那样注入 value。
     */
    const pickFirstProduct = async () => {
      const opened = await ev(`(function(){
        var c=document.querySelector('.record-sheet .rs-ref-ctl'); if(!c) return 'NO_CTL'
        c.click(); return 'CLICKED' })()`)
      await sleep(2000)
      const rowNo = await ev(`(function(){
        var dlg=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.getBoundingClientRect().height>0 && (d.textContent||'').indexOf('参照选择')>=0}).pop()
        if(!dlg) return 'NO_DIALOG'
        var tbl=dlg.querySelector('.el-table')
        if(!tbl) return 'NO_TABLE'
        // 优先勾「未开发」的候选(避免把已有单据的产品挑进来影响开发状态标注)
        var rows=[].slice.call(tbl.querySelectorAll('tbody tr.el-table__row'))
        if(!rows.length) return 'NO_ROW'
        var target=rows[0]
        for(var i=0;i<rows.length;i++){ if((rows[i].innerText||'').indexOf('未开发')>=0){ target=rows[i]; break } }
        var cb=target.querySelector('.el-checkbox')
        if(cb) cb.click(); else target.click()
        var no=''
        var cells=[].slice.call(target.querySelectorAll('td'))
        if(cells.length>1) no=(cells[1].innerText||'').trim()
        return no })()`)
      await sleep(500)
      const confirmed = await ev(`(function(){
        var dlg=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.getBoundingClientRect().height>0 && (d.textContent||'').indexOf('参照选择')>=0}).pop()
        if(!dlg) return 'NO_DIALOG'
        var bs=[].slice.call(dlg.querySelectorAll('button'))
        for(var i=0;i<bs.length;i++){ var t=(bs[i].textContent||'').trim();
          if(t.indexOf('确定')===0){ bs[i].click(); return 'OK:' + t } }
        return 'NO_BTN:' + bs.map(function(b){return b.textContent.trim()}).join('/') })()`)
      await sleep(900)
      return { opened, rowNo, confirmed }
    }
    const visibleBars = () => ev(`[].slice.call(document.querySelectorAll('.record-sheet .rs-sectionbar, .record-sheet .rsp-page-title'))
      .filter(function(e){return e.offsetParent}).map(function(e){return (e.textContent||'').trim()})`)
    const visibleCols = () => ev(`[].slice.call(document.querySelectorAll('.record-sheet table.rs-dt'))
      .filter(function(t){return t.offsetParent}).map(function(t){
        return [].slice.call(t.querySelectorAll('tr.rs-grp th, tr.rs-grp2 th')).map(function(h){return (h.textContent||'').trim()}) })`)
    const docStatus = () => ev(`((document.querySelector('.doc-status')||{}).textContent||'').trim()`)
    /** 给「标签 → 同行值格」的输入框赋值;失败时回带该行的 DOM 骨架(便于定位是哪个分支没渲染) */
    const setInput = (labelText, value) => ev(`(function(){
      var root=document.querySelector('.record-sheet'); if(!root) return 'NO_ROOT'
      var all=[].slice.call(root.querySelectorAll('td.rs-label')).filter(function(t){return (t.textContent||'').trim()===${JSON.stringify(labelText)}})
      var vis=all.filter(function(t){return t.offsetParent})
      if(!all.length) return 'NO_LABEL'
      if(!vis.length) return 'NO_VISIBLE_LABEL(共 ' + all.length + ' 个,但都被页签隐藏)'
      var td=vis[0]
      var val=td.nextElementSibling
      while(val && val.tagName!=='TD') val=val.nextElementSibling
      if(!val) return 'NO_VALUE_TD'
      var inp=val.querySelector('input,textarea')
      if(!inp) return 'NO_INPUT:' + val.outerHTML.replace(/\\s+/g,' ').slice(0,220)
      var proto = inp.tagName==='TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto,'value').set.call(inp, ${JSON.stringify(value)})
      inp.dispatchEvent(new Event('input',{bubbles:true}))
      return 'OK' })()`)
    /** 在指定数据表(按列头关键字定位)里新增一行并按顺序填值 */
    const addAndFill = (colKeyword, vals) => ev(`(async function(){
      var root=document.querySelector('.record-sheet'); if(!root) return 'NO_ROOT'
      var wraps=[].slice.call(root.querySelectorAll('.rsp-dt-wrap')).filter(function(w){return w.offsetParent})
      var w=wraps.filter(function(x){ return (x.textContent||'').indexOf(${JSON.stringify(colKeyword)})>=0 })[0]
      if(!w) return 'NO_WRAP(' + wraps.length + ')'
      var add=[].slice.call(w.querySelectorAll('.rs-add')).filter(function(e){return e.offsetParent})[0]
      if(!add) return 'NO_ADD'
      var tblBefore=w.querySelector('table.rs-dt')
      var rowsBefore=tblBefore? tblBefore.querySelectorAll('tbody tr').length : -1
      add.click()
      await new Promise(function(r){ setTimeout(r, 900) })
      var tbl=w.querySelector('table.rs-dt')
      var all=[].slice.call(tbl.querySelectorAll('tbody tr'))
      var withInput=all.filter(function(tr){ return tr.querySelectorAll('input,textarea').length>0 })
      if(!withInput.length) return 'NO_ROW ' + JSON.stringify({ rowsBefore:rowsBefore, rowsAfter:all.length,
        cls: all.map(function(tr){return tr.className}) })
      var last=withInput[withInput.length-1]
      var ins=[].slice.call(last.querySelectorAll('input,textarea'))
      var vals=${JSON.stringify(vals)}
      for(var i=0;i<ins.length && i<vals.length;i++){ if(vals[i]===null) continue
        var el=ins[i]
        var proto = el.tagName==='TEXTAREA'?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype
        Object.getOwnPropertyDescriptor(proto,'value').set.call(el, vals[i])
        el.dispatchEvent(new Event('input',{bubbles:true})) }
      return 'FILLED(' + ins.length + ') ' + JSON.stringify({ rowsBefore:rowsBefore, rowsAfter:all.length }) })()`)
    const saveBtnState = () => ev(`(function(){
      var all=[].slice.call(document.querySelectorAll('.as-side-btn'));
      for(var i=0;i<all.length;i++){ if((all[i].textContent||'').trim()==='保存'){
        return { found:1, disabled: all[i].classList.contains('disabled') } } }
      return { found:0 } })()`)
    /**
     * 把单据推进「修改中」以便在管理员账号下做界面编辑。
     * 背景:管理员点「保存」= 保存即归档(ButtonService.markArchived),归档后整张纸只读
     * (所有输入框变成 <span class="rs-txt">,连注入 value 都做不到);而「保存为草稿」的 markSaved=false
     * 只是不置 saved 标记,**不阻止归档**,所以也留不住草稿。
     * 官方闭环:已归档 → 申请修改 → 管理员通过(修改审批通过)→ 修改中(可编辑,保存不再自动归档)。
     * 走这条真接口链路,既解决"页面可编辑",又顺带把「归档后申请修改」在这个新面板上验了一遍。
     */
    const enterModifyMode = async (panelCode, no) => {
      const req = await callBtn(panelCode, '申请修改', { 编号: no })
      const appr = await callBtn(panelCode, '修改审批通过', { 编号: no })
      return { req: `${req.code}/${req.msg || req.data?.['单据状态'] || ''}`, appr: `${appr.code}/${appr.data?.['单据状态'] || appr.msg}` }
    }
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
      const f = path.join(os.tmpdir(), `yj-merge-${tag}.pdf`)
      fs.writeFileSync(f, buf); pdfs.push(f)
      return { pages: pdfPageCount(buf), file: f, bytes: buf.length }
    }

    // ════ ③ 界面:RD_MOLD_PROC 两页签 + 页 2 编辑保存 ════
    // **只能在草稿态编辑**:管理员点「保存」= 保存即归档(markArchived),归档后整张纸进只读态
    //(所有输入框变成 <span class="rs-txt">,点不动也没法注入值)——所以用「新增」拿一张新的草稿单来跑界面编辑。
    // 必填(成型侧 产品编号/产品名称 required=1)先用接口垫上,否则界面「保存」会被必填校验拦住,整单都存不下去。
    const moldDraft = await callBtn(MOLD, '新增')
    const MOLD_UI_DOC = moldDraft.data?.['编号'] || ''
    if (MOLD_UI_DOC) made.push(MOLD_UI_DOC)
    ok(!!MOLD_UI_DOC && moldDraft.data?.['单据状态'] === '草稿', `③-0 取一张草稿单用于界面编辑(${MOLD_UI_DOC}/${moldDraft.data?.['单据状态']})`)
    const seed = await callBtn(MOLD, '保存为草稿', { 编号: MOLD_UI_DOC, 产品编号: 'T999', 产品名称: '探针产品(垫)' })
    const moldMod = await enterModifyMode(MOLD, MOLD_UI_DOC)
    ok(moldMod.appr.startsWith('200'), `③-0b 推入「修改中」以便界面编辑(申请修改 ${moldMod.req};修改审批通过 ${moldMod.appr};接口垫必填 ${seed.code})`)
    await nav(`${FRONT}/#/panelx/list/${MOLD}`)
    await sleep(1500)
    const chipMold = await focusDoc(MOLD_UI_DOC)
    const moldTabs = await tabs()
    ok(Array.isArray(moldTabs) && moldTabs.length === 2 && moldTabs[0] === '成型工艺清单' && moldTabs[1] === '成型配方',
      `③-1 ${MOLD} 页签数=2 且标题正确(实际 ${JSON.stringify(moldTabs)};当前单 ${JSON.stringify(chipMold)})`)
    const p1Bars = await visibleBars()
    ok(p1Bars.some((b) => b.includes('产品基本信息')) && p1Bars.some((b) => b.includes('工序')) && p1Bars.some((b) => b.includes('检验要求')),
      `③-2 页 1 = 工艺清单内容(可见区块 ${JSON.stringify(p1Bars)})`)
    ok(!p1Bars.some((b) => b.includes('配方表')) && !p1Bars.some((b) => b.includes('配料要求')),
      '③-3 页 1 不串入配方页的区块(配方表/配料要求都不在)')
    const mName = await setInput('产品名称', '探针产品名称')
    info(`页 1:产品名称改成「探针产品名称」→ ${mName}`)
    await clickTab('成型配方'); await sleep(700)
    const p2Bars = await visibleBars()
    const p2Cols = await visibleCols()
    ok(p2Bars.some((b) => b.includes('配方表')) && p2Bars.some((b) => b.includes('配料要求')),
      `③-4 页 2 = 配方内容(可见区块 ${JSON.stringify(p2Bars)})`)
    ok(!p2Bars.some((b) => b.includes('检验要求')) && !p2Bars.some((b) => b.includes('工序')),
      '③-5 页 2 不串入工艺清单页的区块(工序/检验要求都不在)')
    const p2ColsFlat = (p2Cols || []).flat().join('|')
    ok(/No\./.test(p2ColsFlat) && /物料种类/.test(p2ColsFlat) && /物料编号/.test(p2ColsFlat) && /物料名称/.test(p2ColsFlat)
      && /实际添加/.test(p2ColsFlat) && /单支/.test(p2ColsFlat) && /设计添加/.test(p2ColsFlat),
      `③-6 页 2 配方表 7 列齐全(实际 ${JSON.stringify(p2Cols)})`)
    const rHead = await setInput('配料要求', MOLD_TEXT)
    const rRow = await addAndFill('配方表', ['', '探针种类', MOLD_MAT, '探针物料名', '12.5', '3.25', '4.75'])
    info(`页 2:配料要求 ${rHead};新增配方行 ${rRow}`)
    ok(rHead === 'OK' && /^FILLED/.test(String(rRow)), `③-7 页 2 编辑动作都成功(头字段 ${rHead} / 明细 ${rRow})`)
    await sleep(400)
    const btnState = await saveBtnState()
    info(`保存按钮 ${JSON.stringify(btnState)}(disabled=false 说明前端已识别为"有改动可保存")`)
    ok(btnState?.found === 1 && btnState?.disabled === false, '③-8 改动后「保存」按钮可点(非 disabled)')
    await clickSide('保存'); await sleep(3600)
    const afterStatus = await docStatus()
    const afterNo = await docNoNow()
    info(`保存后:页面可见单号 ${JSON.stringify(afterNo)} 状态 ${JSON.stringify(afterStatus)}`)
    const moldHeadAfter = sqlOne(`SELECT ISNULL(配料要求,N'(null)') FROM rd_mold_proc_head WHERE 单据编号='${MOLD_UI_DOC}';`)
    ok(moldHeadAfter === MOLD_TEXT,
      `③-9 页 2 头字段落库:rd_mold_proc_head.配料要求 = ${JSON.stringify(moldHeadAfter)}(期望 ${JSON.stringify(MOLD_TEXT)})`)
    const moldLine = sqlOne(`SELECT COUNT(*) FROM rd_mold_proc_detail WHERE 单据编号='${MOLD_UI_DOC}' AND 表区=N'配方表' AND 物料编号=N'${MOLD_MAT}' AND ISNULL(asp_cancel,'N')<>'Y';`)
    ok(moldLine === '1', `③-10 页 2 明细行落库:rd_mold_proc_detail 配方表 1 行(实际 ${moldLine})`)
    console.log('── SQL 佐证(rd_mold_proc_detail 探针单)──\n' + sqlRaw(
      `SELECT 'LINE|' + ISNULL(表区,'') + '|' + ISNULL(序号,'') + '|' + ISNULL(物料种类,'') + '|' + ISNULL(物料编号,'') + '|' + ISNULL(物料名称,'') + '|' + ISNULL(实际添加比例,'') + '|' + ISNULL(单支物料含量,'') + '|' + ISNULL(设计添加量,'') + '|' + 单据编号 FROM rd_mold_proc_detail WHERE 单据编号='${MOLD_UI_DOC}' ORDER BY id;`))
    const moldDetailRaw = sqlRaw(`SELECT 'RAW|' + 单据编号 + '|表区=' + ISNULL(表区,'<null>') + '|序号=' + ISNULL(序号,'-') + '|种类=' + ISNULL(物料种类,'-') + '|编号=' + ISNULL(物料编号,'-') FROM rd_mold_proc_detail ORDER BY id;`)
    console.log('── 库里 rd_mold_proc_detail 全部行(不分单号)──\n' + moldDetailRaw)
    const apiRead = (await listOf(MOLD)).find((x) => String(x['编号']) === MOLD_UI_DOC)
    info(`接口回读:配料要求=${JSON.stringify(apiRead?.['配料要求'])} 明细行数=${(apiRead?.detail?.items || []).length}`)
    ok(apiRead?.['配料要求'] === MOLD_TEXT, '③-11 接口回读头字段一致(前端模型 ← 后端列)')

    // ════ ④ 界面:RD_ASM_PROC 两页签 + 产品编号参照 + 页 2 编辑保存 ════
    // 同上:界面编辑必须在**草稿态**,所以另起一张草稿单(已有的 AP 单可能已归档/卡在删除申请中)。
    const asmDraft = await callBtn(ASM, '新增')
    const ASM_UI_DOC = asmDraft.data?.['编号'] || ''
    if (ASM_UI_DOC) made.push(ASM_UI_DOC)
    ok(!!ASM_UI_DOC && asmDraft.data?.['单据状态'] === '草稿', `④-0 取一张草稿单用于界面编辑(${ASM_UI_DOC}/${asmDraft.data?.['单据状态']})`)
    await nav(`${FRONT}/#/panelx/list/${ASM}`)
    await sleep(1500)
    const chipAsm = await focusDoc(ASM_UI_DOC)
    info(`界面当前单 ${JSON.stringify(chipAsm)}`)
    const asmTabs = await tabs()
    ok(Array.isArray(asmTabs) && asmTabs.length === 2 && asmTabs[0] === '组装工艺清单' && asmTabs[1] === '组装BOM表',
      `④-1 ${ASM} 页签数=2 且标题正确(实际 ${JSON.stringify(asmTabs)})`)
    const asmP1 = await ev(`(function(){
      var root=document.querySelector('.record-sheet'); if(!root) return null
      var titles=[].slice.call(root.querySelectorAll('.rsp-plain-title')).filter(function(e){return e.offsetParent}).map(function(e){return e.textContent.trim()})
      var labels=[].slice.call(root.querySelectorAll('td.rs-label')).filter(function(e){return e.offsetParent}).map(function(e){return e.textContent.trim()})
      return { titles:titles, labels:labels } })()`)
    ok(asmP1?.titles?.[0] === '炭棒滤芯组装/包装段-关键工序控制清单',
      `④-2 页 1 标题条 = 关键工序控制清单(实际 ${JSON.stringify(asmP1?.titles)})`)
    ok((asmP1?.labels || []).includes('产品编号') && (asmP1?.labels || []).includes('产品名称'),
      `④-3 页 1 顶部有 产品编号/产品名称 基本信息区(实际 ${JSON.stringify(asmP1?.labels)})`)
    const refCtrlCount = await ev(`document.querySelectorAll('.record-sheet .rs-ref-ctl').length`)
    const refDebug = await ev(`(function(){
      var root=document.querySelector('.record-sheet')
      var tds=[].slice.call(root.querySelectorAll('td.rs-label')).filter(function(t){return (t.textContent||'').trim()==='产品编号'})
      var out=tds.map(function(td){
        var v=td.nextElementSibling
        return { label: (td.textContent||'').trim(), valTag: v?v.tagName:null, valCls: v?v.className:null,
          html: v? v.outerHTML.replace(/\\s+/g,' ').slice(0,260) : null } })
      // 同段 产品名称 做对照 + 页面上所有 refCtl 与它们的文字
      var nameTd=[].slice.call(root.querySelectorAll('td.rs-label')).filter(function(t){return (t.textContent||'').trim()==='产品名称'})[0]
      out.push({ label: '对照组-产品名称', valTag: nameTd?nameTd.nextElementSibling.tagName:null,
        html: nameTd? nameTd.nextElementSibling.outerHTML.replace(/\\s+/g,' ').slice(0,200) : null })
      out.push({ label: '页面上 .rs-ref-ctl 数量', valTag: null, valCls: null,
        html: [].slice.call(document.querySelectorAll('.record-sheet .rs-ref-ctl')).map(function(e){return (e.textContent||'').trim()}).join(' / ') })
      return JSON.stringify(out) })()`)
    ok(Number(refCtrlCount) >= 1, `④-4 页 1「产品编号」渲染为参照控件(找到 ${refCtrlCount} 个 .rs-ref-ctl;骨架 ${refDebug})`)
    await ev(`(function(){ var c=document.querySelector('.record-sheet .rs-ref-ctl'); if(c) c.click(); return 1 })()`)
    await sleep(1800)
    const refDlg = await ev(`(function(){
      var ds=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.getBoundingClientRect().height>0})
      return { titles: ds.map(function(d){return (d.querySelector('.el-dialog__title')||{}).textContent||''}),
               hasProductCol: ds.some(function(d){ return (d.textContent||'').indexOf('产品编号')>=0 }) } })()`)
    info(`参照弹窗 ${JSON.stringify(refDlg)}`)
    ok(refDlg?.hasProductCol, `④-5 参照弹窗打开并列出产品信息表列(${JSON.stringify(refDlg?.titles)})`)
    await ev(`(function(){ var ds=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.getBoundingClientRect().height>0});
      for(var i=0;i<ds.length;i++){ var b=ds[i].querySelector('.el-dialog__headerbtn'); if(b){ b.click(); return 1 } } return 0 })()`)
    await sleep(600)
    // 必填(产品编号/产品名称)先用接口垫上:否则界面「保存」被必填校验拦住,页 2 的编辑整单存不下去。
    // 「保存为草稿」不触发管理员保存即归档,单据仍留在草稿态(可编辑)。
    const asmSeed = await callBtn(ASM, '保存为草稿', { 编号: ASM_UI_DOC, 产品编号: 'T999', 产品名称: '探针产品(垫)' })
    const asmMod = await enterModifyMode(ASM, ASM_UI_DOC)
    ok(asmMod.appr.startsWith('200'), `④-0b 推入「修改中」以便界面编辑(申请修改 ${asmMod.req};修改审批通过 ${asmMod.appr};接口垫必填 ${asmSeed.code})`)
    await nav(`${FRONT}/#/panelx/list/${ASM}`); await sleep(1500); await focusDoc(ASM_UI_DOC)
    await clickTab('组装工艺清单'); await sleep(700)
    const rCodePick = await pickFirstProduct()
    const ASM_PCODE_REAL = rCodePick?.rowNo || ''
    info(`页 1:产品编号参照 ${JSON.stringify(rCodePick)}`)
    ok(/^OK/.test(String(rCodePick?.confirmed)), `④-5b 页 1 参照弹窗选中一行并回填(${JSON.stringify(rCodePick)})`)
    await clickTab('组装BOM表'); await sleep(800)
    const asmP2 = await ev(`(function(){
      var root=document.querySelector('.record-sheet'); if(!root) return null
      var titles=[].slice.call(root.querySelectorAll('.rsp-plain-title')).filter(function(e){return e.offsetParent}).map(function(e){return e.textContent.trim()})
      var bars=[].slice.call(root.querySelectorAll('.rs-sectionbar')).filter(function(e){return e.offsetParent}).map(function(e){return e.textContent.trim()})
      var cols=[].slice.call(root.querySelectorAll('table.rs-dt')).filter(function(t){return t.offsetParent}).map(function(t){
        return [].slice.call(t.querySelectorAll('tr.rs-grp th')).map(function(h){return h.textContent.trim()}) })
      return { titles:titles, bars:bars, cols:cols } })()`)
    ok((asmP2?.titles || []).length > 0 && (asmP2?.titles || []).every((t) => t === '组装BOM表'),
      `④-6 页 2 标题条 = 组装BOM表(实际 ${JSON.stringify(asmP2?.titles)})`)
    ok((asmP2?.bars || []).some((b) => b.includes('物料清单')) && (asmP2?.bars || []).some((b) => b.includes('修订记录')),
      `④-7 页 2 有 物料清单 + 修订记录 两张表(${JSON.stringify(asmP2?.bars)})`)
    const asmColsFlat = (asmP2?.cols || []).flat().join('|')
    ok(/物料名/.test(asmColsFlat) && /物料编号/.test(asmColsFlat) && /物料规格/.test(asmColsFlat) && /外观要求/.test(asmColsFlat) && /用量/.test(asmColsFlat)
      && /更改内容/.test(asmColsFlat) && /更改原因/.test(asmColsFlat) && /更改时间/.test(asmColsFlat) && /责任人/.test(asmColsFlat),
      `④-8 页 2 两表列齐全(${JSON.stringify(asmP2?.cols)})`)
    const asmSet = await setInput('产品种类', ASM_KIND)
    const asmRow = await addAndFill('物料清单', [ASM_MAT, 'P-ASM-001', '探针规格', '探针外观', '2'])
    info(`页 2:产品种类 ${asmSet};新增物料行 ${asmRow}`)
    await sleep(400)
    await clickSide('保存'); await sleep(3600)
    const asmAfterNo = await docNoNow()
    const asmHeadAfter = sqlOne(`SELECT ISNULL(产品种类,N'(null)')+'/'+ISNULL(产品编号,N'(null)') FROM rd_asm_proc_head WHERE 单据编号='${ASM_UI_DOC}';`)
    ok(asmHeadAfter === `${ASM_KIND}/${ASM_PCODE_REAL}`,
      `④-9 页 2 头字段落库:rd_asm_proc_head.产品种类/产品编号 = ${JSON.stringify(asmHeadAfter)}(页面单号 ${JSON.stringify(asmAfterNo)},期望 ${JSON.stringify(ASM_KIND + '/' + ASM_PCODE_REAL)})`)
    const asmLine = sqlOne(`SELECT COUNT(*) FROM rd_asm_proc_detail WHERE 单据编号='${ASM_UI_DOC}' AND 表区=N'物料清单' AND 物料编号=N'P-ASM-001' AND ISNULL(asp_cancel,'N')<>'Y';`)
    ok(asmLine === '1', `④-10 页 2 明细行落库:rd_asm_proc_detail 物料清单 1 行(实际 ${asmLine})`)
    console.log('── SQL 佐证(rd_asm_proc_detail 探针单)──\n' + sqlRaw(
      `SELECT 'LINE|' + ISNULL(表区,'') + '|' + ISNULL(物料名,'') + '|' + ISNULL(物料编号,'') + '|' + ISNULL(物料规格,'') + '|' + ISNULL(外观要求,'') + '|' + ISNULL(用量,'') + '|' + 单据编号 FROM rd_asm_proc_detail WHERE 单据编号='${ASM_UI_DOC}' ORDER BY id;`))

    // ════ ⑤ printToPDF:每个页签页数=1 ════
    const printCases = []
    await nav(`${FRONT}/#/panelx/list/${MOLD}`); await sleep(1500); await focusDoc(MOLD_DOC)
    for (const title of ['成型工艺清单', '成型配方']) {
      await clickTab(title); await sleep(900)
      printCases.push([MOLD, title, await printCurrentTab(`${MOLD}-${title}`)])
    }
    await nav(`${FRONT}/#/panelx/list/${ASM}`); await sleep(1500); await focusDoc(ASM_DOC)
    for (const title of ['组装工艺清单', '组装BOM表']) {
      await clickTab(title); await sleep(900)
      printCases.push([ASM, title, await printCurrentTab(`${ASM}-${title}`)])
    }
    console.log('── printToPDF 结果(A4 / 页边距 8mm / body.approval-printing)──')
    for (const [pc, title, r] of printCases) {
      console.log(`     · ${pc} / ${title}: pages=${r.pages} bytes=${r.bytes} file=${r.file}${r.err ? ' err=' + r.err : ''}`)
      ok(r.pages === 1, `⑤ 打印 ${pc}·${title} 页数=1(实际 ${r.pages})`)
    }

    // ════ ⑥ 菜单里不再出现两个下线入口(界面真渲染)════
    await nav(`${FRONT}/#/panelx/list/${MOLD}`); await sleep(3000)
    const navText = await ev(`(function(){
      var sel=['.el-menu','.el-sub-menu','.tabsbar','.portal-menu','aside','nav','.sidebar','.portal-side'];
      var out='';
      for(var i=0;i<sel.length;i++){ var es=document.querySelectorAll(sel[i]);
        for(var j=0;j<es.length;j++){ out += (es[j].innerText||'') + ' || ' } }
      return out })()`)
    const navHrefs = await ev(`[].slice.call(document.querySelectorAll('a[href]')).map(function(a){return a.getAttribute('href')}).join(',')`)
    const bodyText = await ev(`(document.body.innerText || '')`)
    info(`导航区文本长度 ${(navText || '').length};整页文本含「成型配方」=${String(bodyText).includes('成型配方')} 含「组装BOM表」=${String(bodyText).includes('组装BOM表')}`)
    console.log('── 页面文本开头(节选,含导航)──\n     ' + String(bodyText).replace(/\n+/g, ' | ').slice(0, 500))
    ok(!(navText || '').includes('成型配方') && !(navText || '').includes('组装BOM表'),
      '⑥-1 导航区里找不到「成型配方」「组装BOM表」入口')
    ok(!/RD_MOLD_FORMULA|RD_ASM_BOM/.test(navHrefs), '⑥-2 导航链接里没有两个下线面板的路径')
    ok(/研发管理/.test(String(bodyText)) && /成型工艺清单/.test(String(bodyText)),
      '⑥-3 对照:页面确实渲染了「研发管理 / 成型工艺清单」(证明 ⑥-1 不是"页面没加载"造成的假阴性)')

    ws.close(); ws = null
  } finally {
    if (ws) { try { ws.close() } catch { /* noop */ } }
    if (edge) edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch { /* noop */ }
  }

  // ════ ⑦ 探针自造数据清理 ════
  console.log('\n── ⑦ 探针数据清理 ──')
  const inList = made.length ? `'${made.join("','")}'` : "''"
  const beforeHead = sqlOne(`SELECT COUNT(*) FROM (
      SELECT 单据编号 FROM rd_mold_proc_head WHERE 单据编号 IN (${inList})
      UNION ALL SELECT 单据编号 FROM rd_asm_proc_head WHERE 单据编号 IN (${inList})) x;`)
  ok(beforeHead === String(made.length), `⑦-1 探针单在业务表里 ${beforeHead} 张 = 新建 ${made.length} 张`)
  for (const no of made) {
    const pc = no.startsWith('AP') ? ASM : MOLD
    const r = await callBtn(pc, '删除', { 编号: no })
    info(`清理:探针单 ${no} 走「删除」→ ${r.code}/${r.data?.['单据状态'] || r.msg}`)
  }
  // 逐条执行:一条 SQL 批次里任一语句报错会整批中止(实测踩过 yj_doc_modify_log 列名写错 →
  // 其余 DELETE 全部没跑,残留 5 行),所以拆成独立批次并逐条报错。
  // 🔴 范围**只按本轮记录到的探针单号**(精确 IN 列表) —— 绝不用前缀/范围条件:
  //    第一版曾用 `单据编号 LIKE 'MP-2026-09-%'` 收尾,把库里原有的 12 张 MP-2026-09-0001..0012
  //    一起删了(已从备份恢复,见 tools\_restore-mold-docs-from-backup.sql)。
  const cleanSteps = [
    ['yj_form_approval', `DELETE FROM yj_form_approval WHERE form_no IN (${inList})`],
    ['yj_doc_modify_log', `DELETE FROM yj_doc_modify_log WHERE doc_no IN (${inList})`],
    ['yj_doc_status', `DELETE FROM yj_doc_status WHERE doc_no IN (${inList})`],
    ['rd_mold_proc_detail', `DELETE FROM rd_mold_proc_detail WHERE 单据编号 IN (${inList})`],
    ['rd_mold_proc_head', `DELETE FROM rd_mold_proc_head WHERE 单据编号 IN (${inList})`],
    ['rd_asm_proc_detail', `DELETE FROM rd_asm_proc_detail WHERE 单据编号 IN (${inList})`],
    ['rd_asm_proc_head', `DELETE FROM rd_asm_proc_head WHERE 单据编号 IN (${inList})`],
    // 收尾:物理清业务行会留下孤儿状态行(业务行没了、状态行还在)——
    // 这正是 CONTEXT.md 记过的坑("历史清理脚本物理删头行导致孤儿状态行")。
    // 这两刀同样只作用于**本轮探针单号**(业务行已被上面删掉的那些)。
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
  ok(left === '0', `⑦-2 探针残留 0 行(头/明细/状态/留痕合计,实际 ${left})`)
  const afterMold = sqlOne(`SELECT COUNT(*) FROM rd_mold_proc_head WHERE ISNULL(asp_cancel,'N')<>'Y';`)
  const afterAsm = sqlOne(`SELECT COUNT(*) FROM rd_asm_proc_head WHERE ISNULL(asp_cancel,'N')<>'Y';`)
  info(`${MOLD} 存活头行 ${afterMold};${ASM} 存活头行 ${afterAsm}(都应回到建单前的数量)`)
  info('s_allno / yj_usage_log 未触碰(探针只动上面 7 条 DELETE,均在探针单号范围内)')
  const pdfDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-merge-pdf-'))
  for (const f of pdfs) { try { fs.copyFileSync(f, path.join(pdfDir, path.basename(f))) } catch { /* noop */ } }
  info(`打印 PDF 留档:${pdfDir}`)

  console.log(fails.length
    ? `\n结果: ${fails.length} 项失败\n` + fails.map((f) => '  - ' + f).join('\n')
    : '\n结果: 全部通过')
  process.exit(fails.length ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
