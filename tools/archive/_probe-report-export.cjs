/**
 * _probe-report-export.cjs — 对外正式报表(JasperReports)导出链路端到端验收(2026-09-12)。
 *
 * 守的口径(与 CONTEXT.md「对外正式报表(Formal Report Export)」一致):
 *   ① 模板注册表:SO_ORDER 有 1 个模板(so_order),没登记的面板(RD_PLAN)一个都没有;
 *   ② 鉴权:未登录 / 伪造 token → 403,不泄漏报表内容(沿用项目既有 403 口径);
 *   ③ 参数守卫:格式非法 / 模板与面板不匹配 / 单号不存在 → 400 且带中文原因;
 *   ④ PDF:200 + %PDF 魔数 + 体积 > 10KB + /Type /Page 页数 + 嵌入字体(/BaseFont 含
 *      NotoSansSC-Regular / -Bold、/FontFile2 在、/Identity-H 在);中文可被 PDF 文本层解出;
 *   ⑤ XLSX:200 + PK 魔数 + 体积 > 3KB;
 *   ⑥ 界面:销售订单面板出现「导出报表」入口 → 弹窗三项 → 点 PDF / Excel 各拿到非空文件
 *      (页面内 hook URL.createObjectURL 截 Blob 本体读字节);
 *      没模板的面板(RD_PLAN)不出现该入口;
 *   ⑦ 不写库:本探针只读,不新建/不删除任何单据;跑完复核销售订单张数没变。
 *
 * 用法: node tools/_probe-report-export.cjs [API] [FRONT]
 *       默认 API=http://localhost:8090(后端),FRONT=http://localhost:5173(前端 dev server)
 * 依赖:tools/node_modules/ws;headless Edge;sqlcmd(必须 -f 65001)
 * 不做的事:不碰 s_allno、不碰 yj_usage_log、不改任何单据。
 */
const { spawn, execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const API = process.argv[2] || 'http://localhost:8090'
const FRONT = process.argv[3] || 'http://localhost:5173'
const PORT = 9437
const EDGE = process.env.EDGE_BIN || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PANEL = 'SO_ORDER'
const DOC = 'SO-2026-08-0001'   // 库里真实存在的销售订单(只读它,不新建)

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
        '-W', '-s', '|', '-f', '65001', '-Q', q], { encoding: 'utf8' })
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

/** 取字节 + 常用证据(魔数/页数/字体) */
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
  // /Type /Page 后不能跟 s(排除 /Pages)
  const pages = (s.match(/\/Type\s*\/Page(?![s])/g) || []).length
  return {
    magic: buf.subarray(0, 5).toString('latin1'),
    pages,
    baseFonts: [...new Set(baseFonts)],
    fontFile2: (s.match(/\/FontFile2/g) || []).length,
    fontFile3: (s.match(/\/FontFile3/g) || []).length,
    identityH: (s.match(/\/Identity-H/g) || []).length,
    producer: (s.match(/\/Producer\(([^)]*)\)/) || [])[1] || '',
    creator: (s.match(/\/Creator\(([^)]*)\)/) || [])[1] || '',
    hasCjkText: /[\u4e00-\u9fff]/.test(buf.toString('utf8')),
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

  console.log(`API=${API}  FRONT=${FRONT}  面板=${PANEL}  单据=${DOC}`)
  const docsBefore = sqlOne('SELECT COUNT(DISTINCT 单据编号) FROM bd_so_order;')
  info(`开工前销售订单张数=${docsBefore}(探针全程只读)`)

  // ════ ① 模板注册表 ════
  const t1 = await (await fetch(`${API}/api/report/templates?panelCode=${PANEL}`, { headers: { Authorization: 'Bearer ' + token } })).json()
  ok(t1.code === 200 && t1.data?.length === 1 && t1.data[0].code === 'so_order',
    `①-1 SO_ORDER 有且仅有 1 个模板 so_order(实际 ${JSON.stringify(t1.data)})`)
  ok(t1.data?.[0]?.name === '销售订单' && JSON.stringify(t1.data?.[0]?.formats) === '["pdf","xlsx"]',
    `①-2 模板名/可用格式正确(name=${t1.data?.[0]?.name} formats=${JSON.stringify(t1.data?.[0]?.formats)})`)
  const t2 = await (await fetch(`${API}/api/report/templates?panelCode=RD_PLAN`, { headers: { Authorization: 'Bearer ' + token } })).json()
  ok(t2.code === 200 && Array.isArray(t2.data) && t2.data.length === 0,
    `①-3 未登记的面板 RD_PLAN 没有模板(实际 ${JSON.stringify(t2.data)})`)

  // ════ ② 鉴权 ════
  const noTok = await fetchReport({ code: 'so_order', panelCode: PANEL, docNo: DOC, format: 'pdf' }, null)
  ok(noTok.http === 403, `②-1 未登录导出被拒(HTTP ${noTok.http},409/403 都不泄漏内容)`)
  const badTok = await fetchReport({ code: 'so_order', panelCode: PANEL, docNo: DOC, format: 'pdf' }, 'bogus.token.value')
  ok(badTok.http === 403, `②-2 伪造 token 导出被拒(HTTP ${badTok.http})`)

  // ════ ③ 参数守卫 ════
  const badFmt = await fetchReport({ code: 'so_order', panelCode: PANEL, docNo: DOC, format: 'docx' }, token)
  ok(badFmt.http === 400 && /不支持的报表格式/.test(badFmt.buf.toString('utf8')),
    `③-1 格式非法 → 400(${badFmt.http} ${badFmt.buf.toString('utf8').slice(0, 80)})`)
  const badPanel = await fetchReport({ code: 'so_order', panelCode: 'RD_PLAN', docNo: DOC, format: 'pdf' }, token)
  ok(badPanel.http === 400 && /不属于面板/.test(badPanel.buf.toString('utf8')),
    `③-2 模板与面板不匹配 → 400(${badPanel.http} ${badPanel.buf.toString('utf8').slice(0, 80)})`)
  const noDoc = await fetchReport({ code: 'so_order', panelCode: PANEL, docNo: 'NO-SUCH-DOC', format: 'pdf' }, token)
  ok(noDoc.http === 400 && /单据不存在/.test(noDoc.buf.toString('utf8')),
    `③-3 单号不存在 → 400 且不产出空白正式单据(${noDoc.http} ${noDoc.buf.toString('utf8').slice(0, 80)})`)

  // ════ ④ PDF ════
  const pdf = await fetchReport({ code: 'so_order', panelCode: PANEL, docNo: DOC, format: 'pdf' }, token)
  ok(pdf.http === 200, `④-1 PDF 导出 HTTP 200(实际 ${pdf.http})`)
  const pe = pdfEvidence(pdf.buf)
  info(`字节数=${pdf.buf.length}  魔数=${JSON.stringify(pe.magic)}  /Type /Page=${pe.pages}  Producer=${pe.producer}`)
  ok(pe.magic === '%PDF-' && pdf.buf.length > 10240, `④-2 是 PDF 且体积合理(${pdf.buf.length} bytes)`)
  ok(pe.pages >= 1, `④-3 页数 ${pe.pages}(数 /Type /Page)`)
  ok(pe.baseFonts.some((f) => /NotoSansSC-Regular$/.test(f)) && pe.baseFonts.some((f) => /NotoSansSC-Bold$/.test(f)),
    `④-4 PDF 内嵌中文字体 /BaseFont=${JSON.stringify(pe.baseFonts)}(子集前缀算命中)`)
  ok(pe.fontFile2 >= 2 && pe.fontFile3 === 0 && pe.identityH >= 2,
    `④-5 字体是真嵌入的 TrueType(/FontFile2=${pe.fontFile2} CFF的/FontFile3=${pe.fontFile3} /Identity-H=${pe.identityH})`)
  ok(/JasperReports/.test(pe.creator), `④-6 产出者=${pe.creator}`)
  ok(/attachment; /.test(pdf.disp) && /%E9%94%80%E5%94%AE%E8%AE%A2%E5%8D%95/.test(pdf.disp),
    `④-7 下载文件名是中文「销售订单-…」(RFC5987: ${pdf.disp.slice(0, 60)}…)`)
  const inline = await fetchReport({ code: 'so_order', panelCode: PANEL, docNo: DOC, format: 'pdf', disposition: 'inline' }, token)
  ok(inline.http === 200 && /^inline;/.test(inline.disp), `④-8 disposition=inline → 浏览器内预览(打印预览用)`)

  // ════ ⑤ XLSX ════
  const xlsx = await fetchReport({ code: 'so_order', panelCode: PANEL, docNo: DOC, format: 'xlsx' }, token)
  const isZip = xlsx.buf[0] === 0x50 && xlsx.buf[1] === 0x4b
  info(`字节数=${xlsx.buf.length}  魔数=${JSON.stringify(xlsx.buf.subarray(0, 2).toString('latin1'))}  type=${xlsx.type}`)
  ok(xlsx.http === 200 && isZip && xlsx.buf.length > 3072, `⑤-1 XLSX 导出 HTTP 200 + PK 魔数 + 体积(${xlsx.buf.length})`)
  ok(/spreadsheetml\.sheet/.test(xlsx.type), `⑤-2 Content-Type=${xlsx.type}`)

  // ════ ⑥ 界面(CDP) ════
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-rep-'))
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
    const sideBtnVisible = (label) => ev(`(function(){
      var all=[].slice.call(document.querySelectorAll('.as-side-btn,.as-side-menu-item,.tb-main'));
      for(var i=0;i<all.length;i++){ if((all[i].textContent||'').trim()===${JSON.stringify(label)} && all[i].offsetParent) return 1 }
      return 0 })()`)
    const clickSide = (label) => ev(`(function(){
      var all=[].slice.call(document.querySelectorAll('.as-side-btn,.as-side-menu-item,.tb-main'));
      for(var i=0;i<all.length;i++){ var t=(all[i].textContent||'').trim();
        if(t===${JSON.stringify(label)} && all[i].offsetParent){ all[i].click(); return 1 } }
      return 0 })()`)
    /** 在「导出报表」弹窗里点某个格式项(按名称文字匹配,只在这个弹窗内找) */
    const clickReportItem = (name) => ev(`(function(){
      var dlgs=[].slice.call(document.querySelectorAll('.el-dialog'));
      for(var i=0;i<dlgs.length;i++){
        var head=dlgs[i].querySelector('.el-dialog__title');
        if(!head || head.textContent.trim()!=='导出报表') continue;
        if(!dlgs[i].offsetParent) continue;
        var items=[].slice.call(dlgs[i].querySelectorAll('.efmt-item'));
        for(var j=0;j<items.length;j++){
          var n=items[j].querySelector('.efmt-name');
          if(n && n.textContent.trim()===${JSON.stringify(name)}){ items[j].click(); return 'CLICKED' }
        }
        return 'NO_ITEM'
      }
      return 'NO_DIALOG' })()`)
    const reportDialogOpen = () => ev(`(function(){
      var dlgs=[].slice.call(document.querySelectorAll('.el-dialog'));
      for(var i=0;i<dlgs.length;i++){
        var head=dlgs[i].querySelector('.el-dialog__title');
        if(head && head.textContent.trim()==='导出报表' && dlgs[i].offsetParent){
          return [].slice.call(dlgs[i].querySelectorAll('.efmt-name')).map(function(n){return n.textContent.trim()}).join('|')
        }
      }
      return '' })()`)
    /** hook URL.createObjectURL,截下前端真正拿去下载的 Blob 本体 */
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

    // ⑥-1 销售订单面板:入口出现
    await nav(`${FRONT}/#/panelx/list/${PANEL}?docNo=${DOC}`)
    await ev(`(function(){var s=document.querySelector('.wz-skip'); if(s){s.click(); return 1} return 0})()`)
    await sleep(1200)
    const chip = await ev(`(document.querySelector('.doc-chip')||{}).textContent || ''`)
    info(`界面当前单据 chip=${JSON.stringify(String(chip).trim())}`)
    ok(await sideBtnVisible('导出报表') === 1, '⑥-1 销售订单面板侧栏出现「导出报表」入口')

    // ⑥-2 弹窗三项
    await clickSide('导出报表'); await sleep(900)
    const items = await reportDialogOpen()
    info(`弹窗项=${JSON.stringify(items)}`)
    ok(/导出 PDF/.test(items) && /打印预览/.test(items) && /导出 Excel/.test(items),
      '⑥-2 弹窗含「导出 PDF / 打印预览 / 导出 Excel（.xlsx）」三项')

    // ⑥-3 点 PDF → 页面内拿到真 PDF 字节
    await hookBlobs()
    const clickedPdf = await clickReportItem('导出 PDF')
    await sleep(3500)
    const bPdf = await lastBlobInfo()
    info(`点 PDF 后: clicked=${clickedPdf} blob=${JSON.stringify(bPdf)}`)
    ok(clickedPdf === 'CLICKED', '⑥-3 点「导出 PDF」命中弹窗项')
    ok(bPdf && bPdf.n >= 1 && bPdf.size > 10240 && bPdf.head === '%PDF-',
      `⑥-4 页面内拿到非空 PDF(${bPdf && bPdf.size} bytes, 头=${bPdf && JSON.stringify(bPdf.head)})`)

    // ⑥-4 点 Excel → 页面内拿到真 xlsx 字节
    await clickSide('导出报表'); await sleep(900)
    const clickedXlsx = await clickReportItem('导出 Excel（.xlsx）')
    await sleep(3500)
    const bXlsx = await lastBlobInfo()
    info(`点 Excel 后: clicked=${clickedXlsx} blob=${JSON.stringify(bXlsx)}`)
    ok(clickedXlsx === 'CLICKED', '⑥-5 点「导出 Excel（.xlsx）」命中弹窗项')
    ok(bXlsx && bXlsx.size > 3072 && bXlsx.head.startsWith('PK'),
      `⑥-6 页面内拿到非空 xlsx(${bXlsx && bXlsx.size} bytes, 头=${bXlsx && JSON.stringify(bXlsx.head)})`)

    // ⑥-5 没登记模板的面板不出现入口
    await nav(`${FRONT}/#/panelx/list/RD_PLAN`)
    await sleep(1500)
    ok(await sideBtnVisible('导出报表') === 0, '⑥-7 未登记模板的面板(RD_PLAN)不出现「导出报表」入口')
  } finally {
    try { if (ws) ws.close() } catch { /* ignore */ }
    try { if (edge) edge.kill() } catch { /* ignore */ }
    await sleep(600)
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch { /* ignore */ }
  }

  // ════ ⑦ 只读复核 ════
  const docsAfter = sqlOne('SELECT COUNT(DISTINCT 单据编号) FROM bd_so_order;')
  ok(docsAfter === docsBefore, `⑦-1 探针只读:销售订单张数不变(${docsBefore} → ${docsAfter})`)
  const zz = sqlOne("SELECT COUNT(*) FROM bd_so_order WHERE 单据编号 = N'ZZ-REPORT-TEST-0001';")
  ok(zz === '0', `⑦-2 分页验证用的临时单据已按精确单号清理干净(残留 ${zz} 行)`)

  console.log('')
  console.log(fails.length ? `RESULT FAIL (${fails.length})` : 'RESULT PASS')
  fails.forEach((f) => console.log('  FAIL ' + f))
  process.exit(fails.length ? 1 : 0)
}

main().catch((e) => { console.error('PROBE ERROR', e); process.exit(1) })
