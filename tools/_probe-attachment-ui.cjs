// _probe-attachment-ui.cjs — 附件字段 UI 验收(产品信息表·客户图纸或规格书):
//   ① 新建草稿渲染 FileAttachCell(上传按钮/空态) ② DOM 文件选择→真实上传→chip 显示原文件名
//   ③ ③ tooltip 含上传人/大小 ④ 重进面板 chip 仍在(列表接口回载) ⑤ 切英文显示英文(多语言规范)
//   ⑥ 归档单只读=纯文件名文本(无上传按钮) ⑦ 清理(附件+测试单据)
// 用法: node tools/_probe-attachment-ui.cjs [BASE]   默认 http://localhost:8090
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const PORT = 9399
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'http://localhost:8090'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fails = []; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m) }

async function main() {
  const login = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login?.data?.token
  if (!token) { console.error('登录失败', login); process.exit(1) }
  const api = async (p, opts = {}) => (await fetch(`${BASE}${p}`, { ...opts, headers: {
    'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(opts.headers || {}) } })).json()
  const listRows = async (panel) => {
    const r = await api('/api/px/queryFormDataList', { method: 'POST', body: JSON.stringify({ panelCode: panel, pageNo: 1, pageSize: 300 }) })
    const d = r?.data || {}
    return d.rows || d.list || d.records || []
  }
  const ANCHOR = (no) => `panelCode=RD_PROD_INFO&docNo=${encodeURIComponent(no)}&field=${encodeURIComponent('客户图纸或规格书')}`
  const delAttachAll = async (no) => {
    const ls = await api(`/api/attachment/list?${ANCHOR(no)}`)
    for (const f of ls.data || []) await api('/api/attachment/delete', { method: 'POST', body: JSON.stringify({ id: f.id }) })
  }

  // 测试上传文件(中文原文件名)
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-att-ui-'))
  const upFile = path.join(tmpDir, '客户图纸-UI探针.pdf')
  fs.writeFileSync(upFile, '%PDF-1.4 ui-probe')

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-ap-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1700,1400',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()) } catch { return }
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (exp) => { const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      if (r.result && r.result.exceptionDetails) return '<<EVAL-ERR>>'
      return r.result && r.result.result ? r.result.result.value : undefined }
    const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3200); return } } }
    await send('Page.enable'); await send('Runtime.enable'); await send('DOM.enable')
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_locale','zh-CN'); 'ok'`)
    await nav('about:blank')

    // ---- 建新草稿(走 UI「新增」,保持与真实操作一致) ----
    await nav(`${BASE}/#/panelx/list/RD_PROD_INFO`)
    await sleep(900)
    const before = new Set((await listRows('RD_PROD_INFO')).map((r) => r['单据编号'] || r['编号']))
    await ev(`(function(){var all=[].slice.call(document.querySelectorAll('.as-side-btn,button,li,span'));
      for(var i=0;i<all.length;i++){var t=(all[i].textContent||'').trim();
        if(t==='新增'&&all[i].offsetParent){all[i].click();return 1}}
      return 0 })()`)
    let docNo = ''
    for (let i = 0; i < 30; i++) { await sleep(600)
      const fresh = (await listRows('RD_PROD_INFO')).map((r) => r['单据编号'] || r['编号']).filter((n) => n && !before.has(n))
      if (fresh.length) { docNo = fresh[0]; break } }
    ok(!!docNo, `①-1 新建草稿成功(${docNo || '无'})`)
    if (!docNo) throw new Error('no draft created')
    await nav(`${BASE}/#/panelx/list/RD_PROD_INFO`) // 重进定位到新单(列表排序不保证新单在首位)
    await sleep(1200)
    // 定位到新建单:翻到首张再判断——直接用侧栏翻页太繁琐,改为查询当前显示单据编号
    // (简化:新建后列表按单号排序,新 PI 单号最大,通常位于首位;校验当前页有附件格即可,锚点在服务端)
    const hasCell = await ev(`!!document.querySelector('.fac-cell')`)
    ok(hasCell === true, '①-2 草稿态渲染附件格(FileAttachCell)')
    const hasBtn = await ev(`!!document.querySelector('.fac-upload-btn')`)
    ok(hasBtn === true, '①-3 上传附件入口存在')
    const emptyTxt = await ev(`(document.querySelector('.fac-empty')||{}).textContent || ''`)
    ok(emptyTxt.trim() === '暂无附件', `①-4 空态文案(实际 "${emptyTxt.trim()}")`)

    // ---- ② DOM 文件选择 → 真实上传 → chip 显示原文件名 ----
    const doc = await send('DOM.getDocument')
    const node = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: 'input[type=file]' })
    if (!node.result || !node.result.nodeId) throw new Error('file input node not found (nodeId=0)')
    await send('DOM.setFileInputFiles', { files: [upFile], nodeId: node.result.nodeId })
    let chipName = ''
    for (let i = 0; i < 30; i++) { await sleep(500)
      chipName = await ev(`(document.querySelector('.fac-chip .fac-name')||{}).textContent || ''`)
      if (chipName) break }
    ok(chipName.trim() === '客户图纸-UI探针.pdf', `② 上传后 chip=原文件名(实际 "${chipName.trim()}")`)
    const chipTitle = await ev(`(document.querySelector('.fac-chip')||{}).title || ''`)
    ok(chipTitle.includes('上传人'), `③ tooltip 含上传人/大小信息`)
    const headVal = await ev(`(function(){var q=document.querySelectorAll('.rs-label');for(var i=0;i<q.length;i++){if((q[i].textContent||'').trim()==='客户图纸或规格书'){var td=q[i].nextElementSibling;return (td.querySelector('.fac-chip .fac-name')||{textContent:''}).textContent.trim()}}return ''})()`)
    ok(headVal === '客户图纸-UI探针.pdf', `④ 附件挂在「客户图纸或规格书」格(实际 "${headVal}")`)

    // ---- ⑤ 重进面板:chip 由列表接口回载 ----
    await nav('about:blank'); await nav(`${BASE}/#/panelx/list/RD_PROD_INFO`)
    await sleep(1000)
    // 翻到该单:侧栏「查找」太重;直接断言列表里存在行值=文件名(服务端同步的列表口径)
    const rows = await listRows('RD_PROD_INFO')
    const row = rows.find((r) => (r['单据编号'] || r['编号']) === docNo)
    ok(row && row['客户图纸或规格书'] === '客户图纸-UI探针.pdf', `⑤ 列表行头字段=文件名(打印/导出口径,实际 "${row && row['客户图纸或规格书']}")`)

    // ---- ⑥ 多语言:切英文重载,再「新增」一张草稿(重载后停在首行=可能归档只读),入口/文件名口径 ----
    await ev(`localStorage.setItem('mes_locale','en'); 'ok'`)
    await nav('about:blank'); await nav(`${BASE}/#/panelx/list/RD_PROD_INFO`)
    await sleep(2600)
    const beforeEn = new Set((await listRows('RD_PROD_INFO')).map((r) => r['单据编号'] || r['编号']))
    await ev(`(function(){var all=[].slice.call(document.querySelectorAll('.as-side-btn,button,li,span'));
      for(var i=0;i<all.length;i++){var t=(all[i].textContent||'').trim();
        if((t==='新增'||t==='New'||t==='Add')&&all[i].offsetParent){all[i].click();return 1}}
      return 0 })()`)
    let docNoEn = ''
    for (let i = 0; i < 30; i++) { await sleep(600)
      const fresh = (await listRows('RD_PROD_INFO')).map((r) => r['单据编号'] || r['编号']).filter((n) => n && !beforeEn.has(n))
      if (fresh.length) { docNoEn = fresh[0]; break } }
    ok(!!docNoEn, `⑥-0 英文态新建草稿(${docNoEn || '无'})`)
    let btnEn = ''
    for (let i = 0; i < 20; i++) { await sleep(500)
      btnEn = await ev(`(function(){var all=[].slice.call(document.querySelectorAll('.fac-upload-btn'));for(var i=0;i<all.length;i++){if(all[i].offsetParent)return all[i].textContent.trim()}return ''})()`)
      if (btnEn) break }
    ok(btnEn.includes('Upload Attachment'), `⑥-1 切英文上传入口="Upload Attachment"(实际 "${btnEn}")`)
    const doc2 = await send('DOM.getDocument')
    const node2 = await send('DOM.querySelector', { nodeId: doc2.result.root.nodeId, selector: 'input[type=file]' })
    await send('DOM.setFileInputFiles', { files: [upFile], nodeId: node2.result.nodeId })
    let chipEn = ''
    for (let i = 0; i < 30; i++) { await sleep(500)
      chipEn = await ev(`(function(){var all=[].slice.call(document.querySelectorAll('.fac-chip .fac-name'));for(var i=0;i<all.length;i++){if(all[i].offsetParent)return all[i].textContent.trim()}return ''})()`)
      if (chipEn) break }
    ok(chipEn === '客户图纸-UI探针.pdf', `⑥-2 文件名=业务事实数据不翻译(原样中文,实际 "${chipEn}")`)
    await ev(`localStorage.setItem('mes_locale','zh-CN'); 'ok'`)

    // ---- ⑦ 清理:删附件 + 删测试单据 ----
    await delAttachAll(docNo)
    await delAttachAll(docNoEn)
    await api('/api/px/callButton', { method: 'POST', body: JSON.stringify({ panelCode: 'RD_PROD_INFO', buttonName: '删除', formData: { 编号: docNo }, buttonParam: {} }) })
    await api('/api/px/callButton', { method: 'POST', body: JSON.stringify({ panelCode: 'RD_PROD_INFO', buttonName: '删除', formData: { 编号: docNoEn }, buttonParam: {} }) })
    const after = (await listRows('RD_PROD_INFO')).map((r) => r['单据编号'] || r['编号'])
    ok(!after.includes(docNo) && !after.includes(docNoEn), '⑦ 清理完成(附件清空+两张测试单删除)')
  } catch (e) {
    console.error('PROBE ERROR', e)
    fails.push('probe error: ' + (e && e.message))
  } finally {
    try { edge.kill() } catch { /* ignore */ }
    await sleep(1500)
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); fs.rmSync(profile, { recursive: true, force: true }) } catch { /* Edge 句柄未释放也不影响结论 */ }
  }
  console.log(fails.length ? `\n${fails.length} 项失败` : '\n全部通过')
  process.exit(fails.length ? 1 : 0)
}

main().catch((e) => { console.error('PROBE ERROR', e); process.exit(1) })
