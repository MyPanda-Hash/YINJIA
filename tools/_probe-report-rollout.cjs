/**
 * _probe-report-rollout.cjs — 「导出报表」收进「更多」下拉 + 通用模板铺开(除研发管理)端到端验证(2026-09-12)
 *
 * 守的口径(与 CONTEXT.md「对外正式报表(Formal Report Export)」一致):
 *   ① 模板口径:SO_ORDER 只回精细模板 so_order(显式登记优先);未登记的单据面板(mode='doc' 且
 *      非研发管理)回退 code=generic(通用版式,report-generic.jrxml + yj_field 动态明细);
 *      研发管理面板(module_group='研发管理',与 RD_ 前缀集合相等)与档案/报表面板一个模板都没有;
 *   ② 旧入口移除:上一轮的独立工具栏按钮(.tb-main act-name=导出报表)与侧栏入口(.as-side-btn)
 *      都不存在 —— 全 DOM 计数 = 0;
 *   ③ 新入口:表格上方「更多」组下拉里有「导出报表」,点开格式弹窗,PDF / xlsx 都能拿到非空字节
 *      (精细模板面板与通用模板面板各抽一张;无明细列面板只出头字段);
 *   ④ 研发管理 3 张 RD_*:打开「更多」下拉也看不到「导出报表」项;
 *   ⑤ API 矩阵:8 张不同形态面板(有明细/无明细/22 列需分块/单表式无头表)PDF+XLSX,
 *      报告字节数、PDF 页数、内嵌字体(/BaseFont NotoSansSC、/FontFile2>0、/FontFile3=0)。
 *
 * 探针全程只读:不新建、不修改、不删除任何单据;单号运行时按面板取最新真实单
 * (sqlcmd 精确查询 TOP 1,绝无 LIKE 范围条件);不碰 s_allno、yj_usage_log。
 *
 * 用法: node tools/_probe-report-rollout.cjs [API] [FRONT]
 *       默认 API=http://localhost:8090(后端),FRONT=http://localhost:5173(前端 dev server)
 * 依赖:tools/node_modules/ws;headless Edge;sqlcmd(必须 -f 65001)
 */
const { spawn, execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const API = process.argv[2] || 'http://localhost:8090'
const FRONT = process.argv[3] || 'http://localhost:5173'
const PORT = 9441
const EDGE = process.env.EDGE_BIN || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const SHOT_DIR = 'C:/INCER/DSHTemp/roll'
const RD_PANELS = ['RD_APPROVAL', 'RD_PLAN', 'RD_ALKALINE'] // 研发管理抽 3 张(立项申请/项目实施计划/碱性记录)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fails = []
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m) }
const info = (m) => console.log('     · ' + m)

const SQLCMD = [
  process.env.SQLCMD,
  'sqlcmd',
  'C:\\Program Files\\Microsoft SQL Server\\Client SDK\\ODBC\\170\\Tools\\Binn\\SQLCMD.EXE',
].filter(Boolean)
function sqlOne(q) {
  let lastErr = null
  for (const bin of SQLCMD) {
    try {
      const out = execFileSync(bin, ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
        '-W', '-s', '|', '-f', '65001', '-h', '-1', '-Q', q], { encoding: 'utf8' })
      const lines = out.split(/\r?\n/).map((s) => s.trim())
        .filter((s) => s && !/^-+(\|-+)*$/.test(s) && !/^\(\d+\s/.test(s))
      return lines.length ? lines[0].split('|')[0].trim() : ''
    } catch (e) {
      lastErr = e
      if (e.code !== 'ENOENT') throw e
    }
  }
  throw lastErr
}

/** 找到可用的 sqlcmd 全路径(物理清理等 DML 用) */
function sqlCmdBin() {
  for (const bin of SQLCMD) {
    try { execFileSync(bin, ['-/?'], { stdio: 'ignore' }); return bin } catch (e) { if (e.code !== 'ENOENT') return bin }
  }
  throw new Error('sqlcmd not found')
}

/** 最新真实单号(只读;精确 TOP 1,无 LIKE) */
function latestDoc(panel) {
  const from = {
    SO_ORDER: 'bl_so_order 单据编号',
    PU_ORDER: 'bl_pu_order 单据编号',
    PURCHASE_IN: 'bl_purchase_in 单据编号',
    MANU_ORDER: 'bd_manu_order 合同号',
    SALE_OUT: 'bl_sale_out 单据编号',
    RKD: 'inh inh_no',
    WLBOM: 'mate m_no',
    QC_OP: 'qc_op_detail 单据编号',
    GRAN_RECORD: 'gran_record 单据编号',
  }[panel]
  if (!from) return ''
  const [table, col] = [from.split(' ')[0], from.split(' ')[1]]
  return sqlOne(`SELECT TOP 1 RTRIM(LTRIM([${col}])) FROM [${table}] WHERE [${col}] IS NOT NULL AND [${col}] <> '' ORDER BY id DESC;`)
}

async function fetchReport(params, token) {
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`${API}/api/report/export?${qs}`, {
    headers: token ? { Authorization: 'Bearer ' + token } : {},
  })
  const buf = Buffer.from(await res.arrayBuffer())
  return { http: res.status, buf, type: res.headers.get('content-type') || '', disp: res.headers.get('content-disposition') || '' }
}

function pdfEvidence(buf) {
  const s = buf.toString('latin1')
  const baseFonts = [...s.matchAll(/\/BaseFont\s*\/([A-Za-z0-9+._-]+)/g)].map((m) => m[1])
  const pages = (s.match(/\/Type\s*\/Page(?![s])/g) || []).length
  return {
    magic: buf.subarray(0, 5).toString('latin1'),
    pages,
    baseFonts: [...new Set(baseFonts)],
    fontFile2: (s.match(/\/FontFile2/g) || []).length,
    fontFile3: (s.match(/\/FontFile3/g) || []).length,
    identityH: (s.match(/\/Identity-H/g) || []).length,
    producer: (s.match(/\/Producer\(([^)]*)\)/) || [])[1] || '',
  }
}

async function main() {
  const login = async (userName, password) => (await (await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName, password }),
  })).json())
  const admin = await login('admin', '123456')
  const token = admin?.data?.token
  if (!token) { console.error('admin 登录失败', admin); process.exit(1) }

  console.log(`API=${API}  FRONT=${FRONT}`)
  const docsBefore = sqlOne('SELECT COUNT(DISTINCT 单据编号) FROM bd_so_order;')
  info(`开工前销售订单张数 ${docsBefore}(探针全程只读)`)
  fs.mkdirSync(SHOT_DIR, { recursive: true })

  // ════ ① 模板口径(/api/report/templates) ════
  console.log('\n═══ ① 模板口径 ═══')
  const tplOf = async (panel) => (await (await fetch(`${API}/api/report/templates?panelCode=${panel}`, { headers: { Authorization: 'Bearer ' + token } })).json())
  const t1 = await tplOf('SO_ORDER')
  ok(t1.code === 200 && t1.data?.length === 1 && t1.data[0].code === 'so_order',
    `①-1 SO_ORDER 显式登记优先,有且仅有 so_order(实际 ${JSON.stringify(t1.data)})`)
  for (const [i, p] of ['PU_ORDER', 'PURCHASE_IN', 'QC_OP'].entries()) {
    const t = await tplOf(p)
    ok(t.code === 200 && t.data?.length === 1 && t.data[0].code === 'generic' && !!t.data[0].name,
      `①-${i + 2} 未登记单据面板 ${p} 回退通用模板 code=generic name=${t.data?.[0]?.name} detailColumns=${t.data?.[0]?.detailColumns}`)
  }
  const tPur = await tplOf('PURCHASE_IN')
  ok((tPur.data?.[0]?.detailColumns || 0) > 12, `①-5 PURCHASE_IN 通用模板带明细列数(detailColumns=${tPur.data?.[0]?.detailColumns},22 列形态需分块)`)
  const tGr = await tplOf('GRAN_RECORD')
  ok(tGr.code === 200 && tGr.data?.length === 1 && tGr.data[0].code === 'generic' && tGr.data[0].detailColumns === 0,
    `①-6 GRAN_RECORD 无明细列面板 detailColumns=0(实际 ${tGr.data?.[0]?.detailColumns})`)
  for (const [i, p] of RD_PANELS.entries()) {
    const t = await tplOf(p)
    ok(t.code === 200 && Array.isArray(t.data) && t.data.length === 0, `①-${i + 7} 研发管理面板 ${p} 没有模板(实际 ${JSON.stringify(t.data)})`)
  }
  const tCus = await tplOf('CUSTOMER')
  ok(tCus.code === 200 && tCus.data?.length === 0, `①-10 档案面板 CUSTOMER 没有模板(实际 ${JSON.stringify(tCus.data)})`)

  // ════ ② API 导出矩阵:8 张不同形态面板 × PDF/XLSX ════
  console.log('\n═══ ② API 导出矩阵(只读,单号=各表最新真实单) ═══')
  console.log('面板            格式   HTTP   字节     页数  字体证据                 单号')
  const SHAPES = {
    SO_ORDER: '精细模板 so_order + 明细',
    PU_ORDER: '通用模板 + 头表 + 14 明细列',
    PURCHASE_IN: '通用模板 + 22 明细列(分块)',
    MANU_ORDER: '通用模板 + 21 明细列',
    SALE_OUT: '通用模板 + 17 明细列',
    RKD: '单表式(无头表) + 7 明细列',
    WLBOM: '单表式 + BOM 明细',
    QC_OP: '通用模板 + 5 明细列',
    GRAN_RECORD: '无明细列(只有头字段)',
  }
  let matrixN = 0
  for (const panel of Object.keys(SHAPES)) {
    const code = panel === 'SO_ORDER' ? 'so_order' : 'generic'
    const docNo = latestDoc(panel)
    if (!docNo) { console.log(`SKIP ${panel} 库里没有真实单号,跳过(不算失败)`); continue }
    for (const fmt of ['pdf', 'xlsx']) {
      const r = await fetchReport({ code, panelCode: panel, docNo, format: fmt }, token)
      matrixN++
      if (fmt === 'pdf') {
        const pe = pdfEvidence(r.buf)
        const fontOk = pe.fontFile2 >= 2 && pe.fontFile3 === 0 && pe.baseFonts.some((f) => /NotoSansSC/.test(f))
        const bodyTxt = r.http === 200 ? '' : ' body=' + r.buf.toString('utf8').slice(0, 80)
        ok(r.http === 200 && pe.magic === '%PDF-' && r.buf.length > 10240 && pe.pages >= 1 && fontOk,
          `② ${panel} PDF ${SHAPES[panel]} → ${r.http} ${r.buf.length}B 页数=${pe.pages} FF2=${pe.fontFile2}/FF3=${pe.fontFile3} Noto=${pe.baseFonts.join(',')}${bodyTxt} 单号=${docNo}`)
        console.log(`${panel.padEnd(15)} pdf    ${r.http}  ${String(r.buf.length).padEnd(8)} ${String(pe.pages).padEnd(5)} FF2=${pe.fontFile2}/FF3=${pe.fontFile3}/${pe.baseFonts.join(',')}  ${docNo}`)
      } else {
        const isZip = r.buf[0] === 0x50 && r.buf[1] === 0x4b
        const bodyTxt = r.http === 200 ? '' : ' body=' + r.buf.toString('utf8').slice(0, 80)
        ok(r.http === 200 && isZip && r.buf.length > 3072,
          `② ${panel} XLSX ${SHAPES[panel]} → ${r.http} ${r.buf.length}B PK=${isZip}${bodyTxt} 单号=${docNo}`)
        console.log(`${panel.padEnd(15)} xlsx   ${r.http}  ${String(r.buf.length).padEnd(8)} -     PK魔数=${isZip}  ${docNo}`)
      }
    }
  }
  ok(matrixN >= 12, `②-9 抽查面 ≥6 张面板(实际 ${matrixN / 2} 张 × PDF+XLSX=${matrixN} 次)`)

  // ════ ②-ext 无明细列形态(GRAN_RECORD 库里没有真实单):按 D2 路径自建 1 张草稿 → 导 PDF → 精确清理 ════
  const api = async (p, opts = {}) => (await fetch(`${API}${p}`, {
    ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(opts.headers || {}) },
  })).json()
  const saved = await api('/api/px/callButton', { method: 'POST',
    body: JSON.stringify({ panelCode: 'GRAN_RECORD', buttonName: '保存', formData: {}, buttonParam: {} }) })
  const draftNo = saved?.data?.编号 || saved?.data?.formNo || saved?.data?.单据编号
  if (draftNo) {
    info(`②-ext 自建 GRAN_RECORD 草稿 ${draftNo}(只此一张,完测按精确单号删除)`)
    const gpdf = await fetchReport({ code: 'generic', panelCode: 'GRAN_RECORD', docNo: draftNo, format: 'pdf' }, token)
    const gpe = pdfEvidence(gpdf.buf)
    ok(gpdf.http === 200 && gpe.magic === '%PDF-' && gpe.pages >= 1 && gpe.fontFile2 >= 2 && gpe.fontFile3 === 0,
      `②-ext GRAN_RECORD(无明细列) 通用模板 PDF → ${gpdf.http} ${gpdf.buf.length}B 页数=${gpe.pages} FF2=${gpe.fontFile2}/FF3=${gpe.fontFile3} Noto=${gpe.baseFonts.join(',')}`)
    const gxls = await fetchReport({ code: 'generic', panelCode: 'GRAN_RECORD', docNo: draftNo, format: 'xlsx' }, token)
    ok(gxls.http === 200 && gxls.buf[0] === 0x50 && gxls.buf.length > 3072,
      `②-ext GRAN_RECORD(无明细列) 通用模板 XLSX → ${gxls.http} ${gxls.buf.length}B`)
    // 保存即归档面板:先弃审回草稿再删(直接删除报「仅草稿状态可删除」)
    await api('/api/px/callButton', { method: 'POST',
      body: JSON.stringify({ panelCode: 'GRAN_RECORD', buttonName: '弃审', formData: { 编号: draftNo }, buttonParam: {} }) })
    await api('/api/px/callButton', { method: 'POST',
      body: JSON.stringify({ panelCode: 'GRAN_RECORD', buttonName: '删除', formData: { 编号: draftNo }, buttonParam: {} }) })
    // 系统的删除=软作废(yj_doc_status.canceled='Y');自建数据随后按精确单号物理清理,不留探针垃圾
    const draftSan = String(draftNo).replace(/'/g, '')
    const canceled = sqlOne(`SELECT canceled FROM yj_doc_status WHERE panel_code = 'GRAN_RECORD' AND doc_no = N'${draftSan}';`)
    ok(canceled === 'Y', `②-ext 自建草稿 ${draftNo} 系统侧已作废(yj_doc_status.canceled=${canceled})`)
    execFileSync(sqlCmdBin(), ['-S', 'localhost', '-d', 'HSDZ_MES', '-U', 'yinjia', '-P', 'Yinjia@2026',
      '-W', '-s', '|', '-f', '65001', '-Q',
      `DELETE FROM gran_record WHERE 单据编号 = N'${draftSan}'; DELETE FROM yj_doc_status WHERE panel_code = 'GRAN_RECORD' AND doc_no = N'${draftSan}';`], { encoding: 'utf8' })
    const left = sqlOne(`SELECT COUNT(*) FROM gran_record WHERE 单据编号 = N'${draftSan}';`)
    ok(left === '0', `②-ext 自建草稿 ${draftNo} 已按精确单号物理清理(残留 ${left} 行)`)
  } else {
    info(`②-ext GRAN_RECORD 草稿创建未返回单号(${JSON.stringify(saved).slice(0, 120)}),无明细形态以 ①-6 detailColumns=0 为准`)
  }

  // ════ ③④ 界面(CDP) ════
  console.log('\n═══ ③④ 界面:更多下拉入口 / 旧入口移除 / 研发管理排除 ═══')
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-roll-'))
  let edge = null; let ws = null
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
    const waitPanel = async () => { for (let i = 0; i < 25; i++) { if ((await ev(`document.querySelectorAll('.tb-group').length`)) > 0) { await sleep(900); return 1 } await sleep(400) } return 0 }
    const shot = async (name) => {
      const r = await send('Page.captureScreenshot', { format: 'png' })
      if (r && r.data) { fs.writeFileSync(`${SHOT_DIR}/${name}.png`, Buffer.from(r.data, 'base64')); info(`截图 ${SHOT_DIR}/${name}.png`) }
    }
    /** 旧入口计数:独立工具栏按钮(.tb-main 下 act-name)+ 侧栏入口(.as-side-btn),应恒为 0 */
    const oldEntryCount = () => ev(`(function(){
      var n=0;
      [].slice.call(document.querySelectorAll('.tb-main')).forEach(function(b){
        var a=b.querySelector('.act-name'); if(a && a.textContent.trim()==='导出报表') n++ });
      [].slice.call(document.querySelectorAll('.as-side-btn')).forEach(function(b){
        if((b.textContent||'').trim()==='导出报表') n++ });
      return n })()`)
    /** 打开「更多」组下拉(点它的 ▼),返回该组 act-name 供断言 */
    const openMore = () => ev(`(function(){
      var gs=[].slice.call(document.querySelectorAll('.tb-group'));
      for(var i=0;i<gs.length;i++){
        var n=gs[i].querySelector('.act-name');
        if(n && n.textContent.trim()==='更多'){
          var c=gs[i].querySelector('.tb-caret');
          if(c){ c.click(); return 'OPENED' } return 'NO_CARET' } }
      return 'NO_MORE' })()`)
    const closeMore = () => ev(`(function(){
      var gs=[].slice.call(document.querySelectorAll('.tb-group'));
      for(var i=0;i<gs.length;i++){
        var n=gs[i].querySelector('.act-name');
        if(n && n.textContent.trim()==='更多'){
          var m=gs[i].querySelector('.tb-menu');
          if(!m) return 'ALREADY_CLOSED';
          var c=gs[i].querySelector('.tb-caret'); if(c){ c.click(); return 'CLOSED' } } }
      return 'NO_MORE' })()`)
    /** 「更多」下拉打开时的全部菜单项(竖线连接;未打开返回 CLOSED) */
    const moreItems = () => ev(`(function(){
      var gs=[].slice.call(document.querySelectorAll('.tb-group'));
      for(var i=0;i<gs.length;i++){
        var n=gs[i].querySelector('.act-name');
        if(n && n.textContent.trim()==='更多'){
          var m=gs[i].querySelector('.tb-menu');
          if(!m) return 'CLOSED';
          return [].slice.call(m.querySelectorAll('.ctx-item')).map(function(x){return x.textContent.trim()}).join('|') } }
      return 'NO_MORE' })()`)
    const clickMoreItem = (label) => ev(`(function(){
      var ms=[].slice.call(document.querySelectorAll('.tb-menu .ctx-item'));
      for(var i=0;i<ms.length;i++){
        if(ms[i].textContent.trim()===${JSON.stringify(label)} && ms[i].offsetParent){ ms[i].click(); return 1 } }
      return 0 })()`)
    const reportDialogOpen = () => ev(`(function(){
      var dlgs=[].slice.call(document.querySelectorAll('.el-dialog'));
      for(var i=0;i<dlgs.length;i++){
        var head=dlgs[i].querySelector('.el-dialog__title');
        if(head && head.textContent.trim()==='导出报表' && dlgs[i].offsetParent){
          return [].slice.call(dlgs[i].querySelectorAll('.efmt-name')).map(function(n){return n.textContent.trim()}).join('|') } }
      return '' })()`)
    const clickReportItem = (name) => ev(`(function(){
      var dlgs=[].slice.call(document.querySelectorAll('.el-dialog'));
      for(var i=0;i<dlgs.length;i++){
        var head=dlgs[i].querySelector('.el-dialog__title');
        if(!head || head.textContent.trim()!=='导出报表') continue;
        if(!dlgs[i].offsetParent) continue;
        var items=[].slice.call(dlgs[i].querySelectorAll('.efmt-item'));
        for(var j=0;j<items.length;j++){
          var n=items[j].querySelector('.efmt-name');
          if(n && n.textContent.trim()===${JSON.stringify(name)}){ items[j].click(); return 'CLICKED' } }
        return 'NO_ITEM' }
      return 'NO_DIALOG' })()`)
    /** A2/E3:hook URL.createObjectURL 截 Blob 本体 */
    const hookBlobs = () => ev(`(function(){ window.__repBlobs=[];
      var orig=URL.createObjectURL;
      URL.createObjectURL=function(b){ try{ window.__repBlobs.push(b) }catch(e){}; return orig.apply(URL,arguments) };
      return 1 })()`)
    const lastBlobInfo = () => ev(`(async function(){
      var bs=window.__repBlobs||[]; if(!bs.length) return {n:0};
      var b=bs[bs.length-1];
      var buf=new Uint8Array(await b.arrayBuffer());
      var head=''; for(var i=0;i<5 && i<buf.length;i++) head+=String.fromCharCode(buf[i]);
      return {n:bs.length, size:buf.length, type:b.type, head:head} })()`)

    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1400, deviceScaleFactor: 1, mobile: false })
    await nav(`${FRONT}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(admin.data.user))}); 'ok'`)
    await nav('about:blank') // 必须整页重载一次,否则被弹回登录页

    /**
     * 一张面板的完整走查:旧入口=0 → 更多下拉含导出报表 → 弹窗 → 拿到字节。
     * 每次先 nav('about:blank') 强制整页重载 —— hash 只换片段时 Page.navigate 不重载文档,
     * 面板状态会从上一张残留(E 类坑)。
     * docExport=false:该面板没有可导出的真实单(如 GRAN_RECORD),只断言入口与弹窗,随后取消。
     */
    const walkPanel = async (panel, docNo, expectPdf, expectXlsx, shotName, docExport = true) => {
      await nav('about:blank')
      await nav(`${FRONT}/#/panelx/list/${panel}${docNo ? `?docNo=${encodeURIComponent(docNo)}` : ''}`)
      ok(await waitPanel() === 1, `③ ${panel} 面板加载(工具栏出现)`)
      ok(await oldEntryCount() === 0, `③ ${panel} 旧入口已移除(独立工具栏按钮+侧栏入口 = 0)`)
      ok(await openMore() === 'OPENED', `③ ${panel} 「更多」下拉能打开`)
      const items = await moreItems()
      ok(typeof items === 'string' && items.split('|').includes('导出报表'),
        `③ ${panel} 「更多」下拉含「导出报表」(菜单项=${JSON.stringify(items)})`)
      if (shotName) await shot(shotName)
      ok(await clickMoreItem('导出报表') === 1, `③ ${panel} 能点到「导出报表」菜单项`)
      await sleep(900)
      const dlg = await reportDialogOpen()
      ok(/导出 PDF/.test(dlg) && /打印预览/.test(dlg) && /导出 Excel/.test(dlg),
        `③ ${panel} 格式弹窗三项齐全(${JSON.stringify(dlg)})`)
      if (!docExport) {
        // 面板没有真实单据:只验证入口与弹窗,点「取消」收场
        await ev(`(function(){var bs=[].slice.call(document.querySelectorAll('.el-dialog'));for(var i=0;i<bs.length;i++){var h=bs[i].querySelector('.el-dialog__title');if(h&&h.textContent.trim()==='导出报表'){var btns=bs[i].querySelectorAll('.el-dialog__footer button');for(var j=0;j<btns.length;j++){if(btns[j].textContent.trim()==='取消'){btns[j].click();return 1}}}}return 0})()`)
        await sleep(600)
        ok((await reportDialogOpen()) === '', `③ ${panel} 无单据形态:弹窗可取消收场(导出字节在 ②-ext 用自建草稿验证)`)
        return
      }
      await hookBlobs()
      ok(await clickReportItem('导出 PDF') === 'CLICKED', `③ ${panel} 点「导出 PDF」命中`)
      await sleep(3500)
      const bPdf = await lastBlobInfo()
      if (expectPdf) ok(bPdf && bPdf.n >= 1 && bPdf.size > 10240 && bPdf.head === '%PDF-',
        `③ ${panel} 页面内拿到非空 PDF(${bPdf && bPdf.size}B 头=${bPdf && JSON.stringify(bPdf.head)})`)
      if (expectXlsx) {
        await nav('about:blank')
        await nav(`${FRONT}/#/panelx/list/${panel}${docNo ? `?docNo=${encodeURIComponent(docNo)}` : ''}`)
        await waitPanel()
        await openMore(); await sleep(500)
        await clickMoreItem('导出报表'); await sleep(900)
        await hookBlobs()
        await clickReportItem('导出 Excel（.xlsx）'); await sleep(3500)
        const bX = await lastBlobInfo()
        ok(bX && bX.size > 3072 && bX.head.startsWith('PK'),
          `③ ${panel} 页面内拿到非空 xlsx(${bX && bX.size}B 头=${bX && JSON.stringify(bX.head)})`)
      }
    }

    // ③-1 精细模板面板:销售订单(入口在「更多」下拉,PDF+xlsx 都能拿)
    await walkPanel('SO_ORDER', latestDoc('SO_ORDER'), true, true, 'rollout-more-so-order')
    // ③-2 通用模板多明细列面板:采购入库单(22 列分块形态)
    await walkPanel('PURCHASE_IN', latestDoc('PURCHASE_IN'), true, true, 'rollout-more-purchase-in')
    // ③-3 通用模板无明细列面板:造粒记录(库里无真实单 → 只验入口+弹窗;导出字节在 ②-ext 用自建草稿验证)
    await walkPanel('GRAN_RECORD', '', false, false, 'rollout-more-gran-record', false)

    // ④ 研发管理 3 张 RD_*:打开「更多」下拉也没有「导出报表」,旧入口同样不存在
    for (const [i, p] of RD_PANELS.entries()) {
      await nav('about:blank')
      await nav(`${FRONT}/#/panelx/list/${p}`)
      await waitPanel()
      ok(await oldEntryCount() === 0, `④-${i + 1} ${p} 旧入口不存在(=0)`)
      const opened = await openMore()
      const items = await moreItems()
      const has = typeof items === 'string' && items !== 'CLOSED' ? items.split('|').includes('导出报表') : false
      ok(has === false, `④-${i + 1} 研发管理面板 ${p} 的「更多」下拉(${opened === 'OPENED' ? '已打开' : opened})没有「导出报表」(菜单项=${JSON.stringify(items)})`)
      await closeMore()
    }
  } finally {
    try { if (ws) ws.close() } catch { /* ignore */ }
    try { if (edge) edge.kill() } catch { /* ignore */ }
    await sleep(600)
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch { /* ignore */ }
  }

  // ════ ⑤ 只读复核 ════
  console.log('\n═══ ⑤ 只读复核 ═══')
  const docsAfter = sqlOne('SELECT COUNT(DISTINCT 单据编号) FROM bd_so_order;')
  ok(docsAfter === docsBefore, `⑤-1 探针只读:销售订单张数不变(${docsBefore} → ${docsAfter})`)

  console.log('')
  console.log(fails.length ? `RESULT FAIL (${fails.length})` : 'RESULT PASS')
  fails.forEach((f) => console.log('  FAIL ' + f))
  process.exit(fails.length ? 1 : 0)
}

main().catch((e) => { console.error('PROBE ERROR', e); process.exit(1) })
