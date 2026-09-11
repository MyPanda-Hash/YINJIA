// 验收:立项申请/项目实施计划「新增」后,
//   · 立项申请:申请立项人 = 当前登录用户姓名
//   · 实施计划:负责人     = 当前登录用户姓名
//   两格都只读(元数据 editable=0),且 editable=0 不妨碍值落库。
// 用法: node tools/_probe-applicant.cjs [BASE] [期望姓名]   默认 http://localhost:8090 / 系统管理员
//
// 前置:RD_APPROVAL/RD_PLAN 需各有一张「新增」入口可点(文书面板:侧栏 新增 → directAdd 建空白草稿)。
// 注意:列表接口是 POST /api/px/queryFormDataList,单张走 GET /api/px/getFormDescriptor;
//      写完 localStorage 必须整页重载(先 about:blank),否则路由守卫按游客态弹回登录页。
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const PORT = 9398
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'http://localhost:8090'
const EXPECT = process.argv[3] || '系统管理员'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fails = []; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m) }

function todayStr() {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

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
  const noOf = (row) => row['编号'] || row['单据编号'] || ''
  const cleanup = []

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-ap-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1700,1400',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    const logs = []
    ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()) } catch { return }
      if (m.method === 'Runtime.consoleAPICalled' && m.params && m.params.type === 'log') {
        logs.push((m.params.args || []).map((a) => (a.value === undefined ? a.description : String(a.value))).join(' '))
      }
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (exp) => { const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      if (r.result && r.result.exceptionDetails) return '<<EVAL-ERR ' + r.result.exceptionDetails.text + '>>'
      return r.result && r.result.result ? r.result.result.value : undefined }
    const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3200); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await nav('about:blank') // 整页重载:store 只在 app 挂载时读一次 localStorage

    /** 当前单据编号格是否为空(手填输入框空 / 参照格 is-empty)= 停在刚建的空白草稿上 */
    const onBlankDraft = `(function(){
      var i=document.querySelector('.as-docno-input input');
      if(i) return i.value==='';
      return !!document.querySelector('.as-ref-text.is-empty') })()`
    const addDraft = async (panel) => {
      await nav(`${BASE}/#/panelx/list/${panel}`)
      await sleep(900)
      const clicked = await ev(`(function(){
        var all=[].slice.call(document.querySelectorAll('.as-side-btn,button,li,span'));
        for(var i=0;i<all.length;i++){var t=(all[i].textContent||'').trim();
          if(t==='新增'&&all[i].offsetParent){all[i].click();return all[i].tagName+'.'+all[i].className}}
        return '' })()`)
      const before = new Set((await listRows(panel)).map(noOf))
      for (let i = 0; i < 30; i++) {
        await sleep(500)
        if (await ev(onBlankDraft)) break
      }
      const blank = await ev(onBlankDraft)
      const fresh = (await listRows(panel)).map(noOf).filter((n) => n && !before.has(n))
      return { clicked, blank, no: fresh[0] || '' }
    }
    /** 读单据签名格:标签 → {text, hasInput}(可编辑格的值在 input.value,只读格在 innerText) */
    const readSign = (label) => ev(`(function(){
      var ps=document.querySelectorAll('.as-sign-pair');
      for(var i=0;i<ps.length;i++){
        var c=ps[i].querySelector('.as-sign-cell'), v=ps[i].querySelector('.as-sign-val');
        if(c && (c.textContent||'').trim()===${JSON.stringify(label)}){
          var inp=v?v.querySelector('input'):null;
          return JSON.stringify({found:true,text:inp?String(inp.value||''):(v?(v.innerText||'').trim():''),hasInput:!!inp})}}
      return JSON.stringify({found:false}) })()`)
    const parse = (s) => { try { return JSON.parse(s) } catch { return { found: false } } }

    // ---- ① 立项申请 ----
    const a1 = await addDraft('RD_APPROVAL')
    console.log('   RD_APPROVAL 新增: 点击=' + a1.clicked + ' 空白草稿=' + a1.blank + ' 新单号=' + a1.no)
    ok(a1.blank === true, '   RD_APPROVAL 点「新增」后停在空白草稿上')
    if (a1.no) cleanup.push(['RD_APPROVAL', a1.no])
    const a = parse(await readSign('申请立项人'))
    console.log('   RD_APPROVAL 申请立项人格:', JSON.stringify(a))
    ok(a.found, '①RD_APPROVAL 有「申请立项人」签名格')
    ok(a.text === EXPECT, `②申请立项人=当前用户姓名(期望 "${EXPECT}",实际 "${a.text}")`)
    ok(a.hasInput === false, `③该格只读锁定(hasInput=${a.hasInput})`)
    const ad = parse(await readSign('申请立项日期'))
    ok(ad.text === todayStr(), `④申请立项日期默认今天(期望 "${todayStr()}",实际 "${ad.text}")`)

    // ---- ② 项目实施计划 ----
    const p1 = await addDraft('RD_PLAN')
    console.log('   RD_PLAN 新增: 点击=' + p1.clicked + ' 空白草稿=' + p1.blank + ' 新单号=' + p1.no)
    ok(p1.blank === true, '   RD_PLAN 点「新增」后停在空白草稿上')
    if (p1.no) cleanup.push(['RD_PLAN', p1.no])
    const p = parse(await readSign('负责人'))
    console.log('   RD_PLAN 负责人格:', JSON.stringify(p))
    ok(p.found, '⑤RD_PLAN 有「负责人」签名格')
    ok(p.text === EXPECT, `⑥负责人=当前用户姓名(期望 "${EXPECT}",实际 "${p.text}")`)
    ok(p.hasInput === false, `⑦该格只读锁定(hasInput=${p.hasInput})`)
    const pa = parse(await readSign('申请立项人'))
    ok(pa.found === false, `⑧RD_PLAN 不该有「申请立项人」格(实际 found=${pa.found})`)

    // ---- ③ 落库(editable=0 不挡写入):落库回读用 SQL 直查(接口不下发该字段),故此处只断言接口保存成功 ----
    const probeNo = 'ZZ-APPLICANT-PROBE'
    const saved = await api('/api/px/callButton', { method: 'POST', body: JSON.stringify({
      panelCode: 'RD_APPROVAL', buttonName: '保存', buttonParam: {},
      formData: { 文档编号: probeNo, 申请立项人: EXPECT, 项目名称: '探针-申请人默认值', 申请立项日期: todayStr(), 文件管理人: '陈秀丽' } }) })
    const savedNo = (saved?.data || {})['编号'] || ''
    ok(!!savedNo, `⑨接口新增单据成功(单号 "${savedNo}",返回 ${JSON.stringify(saved).slice(0, 120)})`)
    if (savedNo) cleanup.push(['RD_APPROVAL', savedNo])

    // ---- ④ 清理探针建的单 ----
    for (const [panel, no] of cleanup) {
      await api('/api/px/callButton', { method: 'POST', body: JSON.stringify({
        panelCode: panel, buttonName: '删除', buttonParam: {}, formData: { 编号: no } }) })
    }
    await sleep(1500)
    for (const [panel, no] of cleanup) {
      const still = (await listRows(panel)).map(noOf).includes(no)
      console.log(`   清理 ${panel}/${no}: ${still ? '仍在列表(需手工清)' : '已删除'}`)
    }

    console.log(fails.length ? `\n结果: ${fails.length} 项失败` : '\n结果: 全部通过')
    console.log('本次建单(已尝试删除): ' + (cleanup.map((x) => x.join('/')).join(', ') || '(无)'))
    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {} }
  process.exit(fails.length ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
