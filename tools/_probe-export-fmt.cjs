// _probe-export-fmt.cjs — 文书面板导出格式选择 + 打印/导出分离 验收:
//   ① 侧栏同时有「打印」与「导出」两个独立按钮
//   ② 点「导出」→ 弹「选择导出格式」(导出 PDF / 导出 Excel 两项)
//   ③ 选 Excel → 生成 .xlsx 下载(a[download] 点击拦截验证文件名与触达)
//   ④ 选 PDF → 提示 + 触发 window.print(拦截验证)
//   ⑤ 点「打印」直接触发 window.print(不经格式弹窗)
// 用法: node tools/_probe-export-fmt.cjs [BASE]
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const PORT = 9381
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'http://localhost:8090'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fails = []; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m) }
async function main() {
  const login = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login?.data?.token
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-ef-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1700,1400',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map(); const errs = []
    ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()) } catch { return }
      if (m.method === 'Runtime.consoleAPICalled' && m.params && ['error', 'log'].includes(m.params.type))
        errs.push(m.params.type + ': ' + (m.params.args || []).map((a) => String(a.value ?? a.description ?? '')).join(' ').slice(0, 200))
      if (m.method === 'Runtime.exceptionThrown')
        errs.push('EXC: ' + String((m.params.exceptionDetails || {}).text || '').slice(0, 200))
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (exp) => { const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      if (r.result && r.result.exceptionDetails) return '<<EVAL-ERR>>'
      return r.result && r.result.result ? r.result.result.value : undefined }
    const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3200); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await nav('about:blank')
    // 任一文书面板(产品信息表)
    await nav(`${BASE}/#/panelx/list/RD_PROD_INFO`)
    await sleep(2800)
    // ① 打印与导出两个独立按钮
    const btns = await ev(`[].slice.call(document.querySelectorAll('.as-side-btn')).map(function(b){return (b.textContent||'').trim()})`)
    ok((btns || []).includes('打印'), `①-1 有「打印」按钮(${JSON.stringify((btns || []).filter((x) => ['打印', '预览', '导出'].includes(x)))})`)
    ok((btns || []).includes('导出'), '①-2 有「导出」按钮(独立)')
    // ② 点导出 → 格式弹窗
    await ev(`(function(){var b=[].slice.call(document.querySelectorAll('.as-side-btn'));for(var i=0;i<b.length;i++){if((b[i].textContent||'').trim()==='导出'){b[i].click();return 1}}return 0})()`)
    await sleep(1000)
    const fmtDlg = await ev(`(function(){var dlgs=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.offsetParent});
      var d=dlgs[dlgs.length-1];if(!d)return 'no-dlg';
      return JSON.stringify({title:(d.querySelector('.el-dialog__title')||{}).textContent,items:[].slice.call(d.querySelectorAll('.efmt-item .efmt-name')).map(function(x){return (x.textContent||'').trim()})})})()`)
    const fd = JSON.parse(fmtDlg === 'no-dlg' ? '{}' : (fmtDlg || '{}'))
    ok(String(fd.title || '').includes('选择导出格式'), `②-1 格式选择弹窗(${fd.title})`)
    ok((fd.items || []).some((x) => x.includes('PDF')) && (fd.items || []).some((x) => x.includes('Excel')), `②-2 含 PDF/Excel 两项(${JSON.stringify(fd.items)})`)
    // ③ Excel:拦截 XLSX.writeFile 的下载(锚点点击)并捕获文件名
    await ev(`(function(){window.__dl=null;var oc=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){
      if(this.download){window.__dl={name:this.download};return}return oc.apply(this,arguments)};return 1})()`)
    await ev(`(function(){var dlgs=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.offsetParent});
      var d=dlgs[dlgs.length-1];var its=[].slice.call(d.querySelectorAll('.efmt-item'));
      for(var i=0;i<its.length;i++){if((its[i].textContent||'').indexOf('Excel')>=0){its[i].click();return 1}}return 0})()`)
    await sleep(2500)
    const dl = await ev('window.__dl ? window.__dl.name : null')
    ok(typeof dl === 'string' && dl.endsWith('.xlsx') && dl.includes('产品信息表'), `③ 导出 Excel 生成下载(${dl})`)
    // ④ PDF:直接生成 .pdf 下载(无打印对话框):拦截锚点下载,取 blob 验 %PDF 魔数;window.print 不被调
    await ev(`(function(){window.__printed=0;window.print=function(){window.__printed=1};
      window.__pdf=null;window.__blob=null;
      // jsPDF 4.x:URL.createObjectURL(blob)+anchor.dispatchEvent,revoke 极快 → 在 createObjectURL 截 Blob 本体
      var oco=URL.createObjectURL;URL.createObjectURL=function(b){try{if(b&&b.size>1000)window.__blob=b}catch(e){}return oco.apply(this,arguments)};
      var od=EventTarget.prototype.dispatchEvent;EventTarget.prototype.dispatchEvent=function(e){
        if(this&&this.download&&/\\.pdf$/.test(this.download||'')&&window.__blob){
          var nm=this.download;window.__blob.arrayBuffer().then(function(buf){
            var u=new Uint8Array(buf);var magic=String.fromCharCode.apply(null,u.slice(0,5));
            window.__pdf={name:nm,size:buf.byteLength,magic:magic}})}
        return od.apply(this,arguments)};
      return 1})()`)
    // 重开格式弹窗(③ 的 Excel 导出已把它关掉),再点 PDF 项
    await ev(`(function(){var b=[].slice.call(document.querySelectorAll('.as-side-btn'));for(var i=0;i<b.length;i++){if((b[i].textContent||'').trim()==='导出'){b[i].click();return 1}}return 0})()`)
    await sleep(800)
    await ev(`(function(){var dlgs=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.offsetParent});
      var d=dlgs[dlgs.length-1];var its=[].slice.call(d.querySelectorAll('.efmt-item'));
      for(var i=0;i<its.length;i++){if((its[i].textContent||'').indexOf('PDF')>=0){its[i].click();return 1}}return 0})()`)
    await sleep(1200)
    const diag = await ev(`(function(){var dlgs=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.offsetParent&&d.textContent.indexOf('选择导出格式')>=0});
      var msgs=[].slice.call(document.querySelectorAll('.el-message')).map(function(m){return (m.textContent||'').trim()});
      return JSON.stringify({fmtOpen:dlgs.length>0,msgs:msgs})})()`)
    console.log('点PDF后诊断:', diag)
    await sleep(1500)
    let pdf = null
    for (let w = 0; w < 14; w++) { pdf = await ev('window.__pdf'); if (pdf) break; await sleep(1000) }
    const printedPdf = await ev('window.__printed')
    ok(!!pdf && /\.pdf$/.test(pdf.name || ''), `④-1 直接下载 PDF 文件(${pdf && pdf.name})`)
    ok(!!pdf && pdf.magic === '%PDF-' && (pdf.size || 0) > 20000, `④-2 内容为有效 PDF(魔数=${pdf && pdf.magic}, ${(pdf && pdf.size / 1024 || 0).toFixed(0)}KB)`)
    ok(printedPdf === 0, `④-3 未调用打印对话框(printed=${printedPdf})`)
    console.log('pdf-export 日志:', errs.filter((x) => x.startsWith('log: [pdf')).join(' | ') || '(无)')
    const pdfErrs = errs.filter((x) => !x.startsWith('log: [pdf'))
    // ⑤ 打印按钮直接 print(不经弹窗)
    await ev('window.__printed=0')
    await ev(`(function(){var b=[].slice.call(document.querySelectorAll('.as-side-btn'));for(var i=0;i<b.length;i++){if((b[i].textContent||'').trim()==='打印'){b[i].click();return 1}}return 0})()`)
    await sleep(900)
    const printed2 = await ev('window.__printed')
    const fmtStill = await ev(`(function(){var dlgs=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.offsetParent&&d.textContent.indexOf('选择导出格式')>=0});return dlgs.length})()`)
    ok(printed2 === 1 && fmtStill === 0, `⑤ 打印按钮直接打印且不开格式弹窗(printed=${printed2}, 格式弹窗=${fmtStill})`)
    ok(pdfErrs.length === 0, `⑥ 无 console 错误(${pdfErrs.length ? pdfErrs[0] : ''})`)
  } catch (e) {
    console.error('PROBE ERROR', e); fails.push('probe error: ' + (e && e.message))
  } finally {
    try { edge.kill() } catch {}
    await sleep(1200); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
  console.log(fails.length ? `\n${fails.length} 项失败` : '\n全部通过')
  process.exit(fails.length ? 1 : 0)
}
main().catch((e) => { console.error('PROBE ERROR', e); process.exit(1) })
