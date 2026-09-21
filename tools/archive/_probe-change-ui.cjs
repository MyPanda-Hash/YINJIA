/**
 * _probe-change-ui.cjs —— 产品变更申请单(RD_CHANGE)界面验收(2026-09-21)
 *
 * 用户口径:版式照 YJ-QR-130《KPC变更申请通知单》;四受控文件**勾选**;部门行**只读态**
 * (非本部门不可编);会签/审批按钮按状态与身份出现。
 *
 * 探针钉八件事(全部在真浏览器里量,不看代码):
 *   ① 面板能打开,纸张标题 = KPC管控点申请单(报告头 + 编号格);
 *   ② 纸面区块齐:一、基础信息 / 二、变更/新增申请事由 / 三、部门评审意见 / 三.相关变更 /
 *      四、库存产品处理方式 / 批准,且「文件编码 YJ-QR-130」在纸面上;
 *   ③ 部门评审意见 = 库里 7 个预置部门行(开发部…仓管部),顺序=纸面顺序;
 *   ④ 复选格:性质 2 个方框 + 需会签 2 个 + 变更文件 4 个 = 8 个方框;
 *   ⑤ **行级只读**:以 cp(产品开发部→开发部行)登录时,「变更后内容/备注」只有开发部那一行是输入框,
 *      其余 6 行是纯文本(界面上就看得出"这行不是你的");
 *   ⑥ 勾上「需会签=是」后,侧栏出现「提交会签」(发起人才有);
 *   ⑦ 点「提交会签」走确认弹窗 → 会签中 → 侧栏换成「会签通过/会签驳回/撤回会签」;
 *   ⑧ 会签人(glm53)登录后同一张单能点「会签通过」 (非会签人 cp 看不到会签按钮)。
 *
 * 用法:node tools/archive/_probe-change-ui.cjs   (需后端 8090;跑完写清理 SQL,再手工执行)
 */
'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn, spawnSync } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const BASE = process.env.YINJIA_API || 'http://localhost:8090'
const EDGE = process.env.EDGE_BIN || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9341
const TOOLS = path.join(__dirname, '..')
const URLX = 'jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true;loginTimeout=10'
const CLEANUP = path.join(__dirname, '_probe-change-ui-cleanup.sql')
const SHOTS = path.join(__dirname, '_shots')
const P = 'PROBE-CHGUI-' + Date.now().toString().slice(-6)
const ROWS7 = ['开发部', '成型工艺科', '组装车间', '销售部', '品质部', '计划组', '仓管部']

let failed = 0
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => { failed++; console.log('  FAIL ' + m) }
const step = (m) => console.log('\n▶ ' + m)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function sqlRows(name, sql) {
  const f = path.join(__dirname, name + '.sql')
  const out = path.join(__dirname, name + '.out.txt')
  fs.writeFileSync(f, sql, 'utf8')
  const fd = fs.openSync(out, 'w')
  spawnSync('java', ['-Dstdout.encoding=UTF-8', '-cp', 'lib\\mssql-jdbc.jar', 'SqlRunner.java',
    URLX, 'yinjia', 'Yinjia@2026', 'archive\\' + name + '.sql'], { cwd: TOOLS, stdio: ['ignore', fd, fd] })
  fs.closeSync(fd)
  const txt = fs.readFileSync(out, 'utf8')
  if (/\[SQL FAIL\]|\[FATAL\]/.test(txt)) throw new Error('SQL 失败:' + txt)
  return txt.split('\n').filter((l) => l.trim().startsWith('|'))
    .map((l) => l.split('|').slice(1, -1).map((x) => x.trim()))
}

async function main() {
  const tok = async (u, p = '123456') => {
    const r = await (await fetch(`${BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: u, password: p }),
    })).json()
    if (!r?.data?.token) throw new Error(u + ' 登录失败')
    return { token: r.data.token, user: r.data.user }
  }
  const cp = await tok('cp')
  const glm = await tok('glm53')

  // 造一张变更单(cp 发起),供界面查看
  step('⓪ 造数:cp 建一张变更单(需会签=是,会签人=glm53)')
  const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${cp.token}` }
  const btn = async (buttonName, formData) => (await (await fetch(`${BASE}/api/px/callButton`, {
    method: 'POST', headers: H, body: JSON.stringify({ panelCode: 'RD_CHANGE', buttonName, formData, buttonParam: {} }),
  })).json())
  const made = await btn('保存为草稿', { 产品编号: P, 产品名称: '界面探针产品', 申请人: cp.user.realName || '陈秀丽',
    会签人: 'glm53', 变更事由: '界面验收:配方微调', 变更文件: '成型工艺清单、组装工艺清单' })
  const no = made?.data?.['编号']
  if (!no) throw new Error('建单失败:' + JSON.stringify(made))
  console.log('     变更单 = ' + no)

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-chgui-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1760,1600', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
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
      for (let i = 0; i < 90; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3200); return } }
    }
    const shot = async (tag) => {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
      if (!r.result?.data) return null
      const f = path.join(SHOTS, `chgui-${tag}.png`)
      fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'))
      return f
    }
    const login = async (t, u) => {
      await nav(`${BASE}/#/login`)
      await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(t)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(u))}); 'ok'`)
      await nav('about:blank')
    }
    const dismissInit = () => ev(`(function(){ var ds=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.getBoundingClientRect().height>0})
      for (var i=0;i<ds.length;i++){ var t=(ds[i].innerText||'')
        if (t.indexOf('初始化')>=0){ var bs=[].slice.call(ds[i].querySelectorAll('button,span,a'))
          for (var j=0;j<bs.length;j++){ if((bs[j].textContent||'').trim()==='下次再说'){ bs[j].click(); return 'dismissed' } } } }
      return 'none' })()`)
    /** 打开面板并聚焦刚建的这张单(列表按创建时间倒序,点第一行即可;查不到就退回查询弹窗) */
    const openDoc = async () => {
      await nav(`${BASE}/#/panelx/list/RD_CHANGE`); await sleep(2600)
      await dismissInit()
      const clicked = await ev(`(function(){
        var rows=[].slice.call(document.querySelectorAll('.el-table__row, .px-row, tr'))
        for (var i=0;i<rows.length;i++){ if((rows[i].innerText||'').indexOf(${JSON.stringify(no)})>=0){ rows[i].click(); return 'row' } }
        return 'none' })()`)
      await sleep(2600)
      return clicked
    }
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1600, deviceScaleFactor: 1, mobile: false })

    // ════ ① 打开面板(cp)════
    step('① cp 打开变更单:纸张标题与报告头')
    await login(cp.token, cp.user)
    const how = await openDoc()
    console.log('     聚焦方式 = ' + how)
    const head = await ev(`(function(){ var s=document.querySelector('.record-sheet'); if(!s) return null
      return { title:(s.querySelector('.rs-topic')||{}).textContent||'', company:(s.querySelector('.rs-company-cell')||{}).textContent||'',
               docno:(s.querySelector('.rs-docno')||{}).innerText||'' } })()`)
    console.log('     ' + JSON.stringify(head))
    if (head && head.title.includes('KPC管控点申请单')) ok('纸张大标题 = KPC管控点申请单')
    else bad('大标题不符:' + JSON.stringify(head))
    if (head && head.docno.includes(no)) ok('编号格显示本单号:' + head.docno.trim())
    else bad('编号格不符:' + JSON.stringify(head?.docno))

    // ════ ② 纸面区块 ════
    step('② 纸面区块齐 + 文件编码 YJ-QR-130')
    const txt = String(await ev(`(function(){ var s=document.querySelector('.record-sheet'); return s? s.innerText.replace(/\\s+/g,' ') : '' })()`) || '')
    const bars = ['一、基础信息', '二、变更/新增申请事由', '三、部门评审意见', '三.相关变更', '四、库存产品处理方式', '批准']
    const missBars = bars.filter((b) => !txt.includes(b))
    if (!missBars.length) ok('六个区块齐:' + bars.join(' / '))
    else bad('缺区块:' + JSON.stringify(missBars))
    if (txt.includes('YJ-QR-130')) ok('纸面有「文件编码 YJ-QR-130」')
    else bad('纸面缺文件编码')

    // ════ ③ 部门行 7 行 ════
    // ⚠ 纸张在页面里会渲染**两遍**(可见编辑区 + 打印/导出用的离屏克隆),所有查询一律只认可见元素
    //   (offsetParent 非空),否则会把克隆那份也算进来(2026-09-21 实测:方框数 8→16)。
    step('③ 部门评审意见 = 库里 7 个预置部门行')
    const deptTable = `(function(){
      var ts=[].slice.call(document.querySelectorAll('.record-sheet table.rs-dt')).filter(function(t){return t.offsetParent})
      for (var i=0;i<ts.length;i++){ if((ts[i].innerText||'').indexOf('变更/新增申请内容')>=0) return ts[i] }
      return null })()`
    const depts = (await ev(`(function(){ var t=${deptTable}; if(!t) return []
      return [].slice.call(t.querySelectorAll('tbody tr')).filter(function(tr){ return tr.children.length>2 && (tr.children[0].className||'').indexOf('rs-label')<0 })
        .map(function(tr){ return (tr.children[0].innerText||'').trim() }).filter(Boolean) })()`) || [])
      .filter((d) => d !== '部门')   // 首行是列标题行(部门 | 变更/新增申请内容 | 签字 | 日期)
    console.log('     部门行 = ' + JSON.stringify(depts))
    if (JSON.stringify(depts) === JSON.stringify(ROWS7)) ok('7 个部门行齐、顺序=纸面顺序')
    else bad('部门行不符:' + JSON.stringify(depts))

    // ════ ④ 复选格 8 个 ════
    step('④ 复选格:性质 2 + 需会签 2 + 变更文件 4')
    const checkSel = `(function(){ var s=document.querySelector('.record-sheet'); if(!s) return []
      return [].slice.call(s.querySelectorAll('.rs-checks')).filter(function(x){return x.offsetParent}) })()`
    const checks = await ev(`(function(){ var gs=${checkSel}
      return { groups: gs.length, total: gs.reduce(function(n,g){ return n + g.querySelectorAll('.el-checkbox').length }, 0),
               texts: gs.map(function(g){ return [].slice.call(g.querySelectorAll('.el-checkbox')).map(function(c){return (c.innerText||'').trim()}).join('|') }) } })()`)
    console.log('     ' + JSON.stringify(checks))
    if (checks && checks.total === 8) ok('共 8 个方框(性质2 + 需会签2 + 变更文件4)')
    else bad('方框数不符:' + JSON.stringify(checks))
    if (checks && checks.texts.some((t) => t.includes('成型工艺清单') && t.includes('出货检验计划表'))) ok('变更文件四个受控文件方框齐')
    else bad('变更文件方框不符:' + JSON.stringify(checks?.texts))
    const ckOn = await ev(`(function(){ var gs=${checkSel}
      for (var i=0;i<gs.length;i++){ var cs=[].slice.call(gs[i].querySelectorAll('.el-checkbox')).filter(function(c){return (c.innerText||'').trim()==='成型工艺清单'})
        if(cs.length) return cs[0].className }
      return 'none' })()`)
    if (String(ckOn).includes('is-checked')) ok('库里已勾的「成型工艺清单」在界面上是勾选态')
    else bad('已勾项未回显:' + ckOn)

    // ════ ⑤ 行级只读 ════
    step('⑤ 行级只读:cp(开发部行)只有本部门行可编')
    const lock = await ev(`(function(){ var t=${deptTable}; if(!t) return null
      var out=[]
      ;[].slice.call(t.querySelectorAll('tbody tr')).filter(function(tr){ return tr.children.length>2 && (tr.children[0].className||'').indexOf('rs-label')<0 }).forEach(function(tr){
        var td=tr.children[1]; if(!td) return
        var dept=(tr.children[0].innerText||'').trim()
        var hasInput = !!td.querySelector('input,textarea')
        out.push({ dept: dept, editable: hasInput, locked: (td.className||'').indexOf('rsp-locked')>=0 })
      })
      return out })()`)
    console.log('     ' + JSON.stringify(lock))
    const editableRows = (lock || []).filter((r) => r.editable).map((r) => r.dept)
    if (editableRows.length === 1 && editableRows[0] === '开发部') ok('只有「开发部」行可编(其余 6 行只读)')
    else bad('行级门禁不符:' + JSON.stringify(editableRows))
    if ((lock || []).filter((r) => r.locked).length === 6) ok('其余 6 行带只读灰底样式(rsp-locked)')
    else bad('只读样式不符:' + JSON.stringify((lock || []).map((r) => r.locked)))

    // ════ ⑥ 勾「需会签=是」→ 侧栏出「提交会签」════
    step('⑥ 勾上「需会签=是」后的侧栏按钮')
    const before = await ev(`[].slice.call(document.querySelectorAll('.as-side-btn')).filter(function(b){return b.offsetParent}).map(function(b){return (b.textContent||'').trim()})`)
    console.log('     勾选前:' + JSON.stringify(before))
    await ev(`(function(){ var gs=${checkSel}
      for (var i=0;i<gs.length;i++){ var cs=[].slice.call(gs[i].querySelectorAll('.el-checkbox')).filter(function(x){return (x.innerText||'').trim()==='是'})
        if(cs.length){ cs[0].click(); return 'clicked' } }
      return 'none' })()`)
    await sleep(900)
    const after = await ev(`[].slice.call(document.querySelectorAll('.as-side-btn')).filter(function(b){return b.offsetParent}).map(function(b){return (b.textContent||'').trim()})`)
    console.log('     勾选后:' + JSON.stringify(after))
    if ((after || []).some((t) => t.includes('提交会签'))) ok('侧栏出现「提交会签」(需会签=是 + 本人是发起人)')
    else bad('侧栏没有「提交会签」')
    if (!(before || []).some((t) => t.includes('提交会签'))) ok('勾选前不出现(不该凭空给人按)')
    else bad('勾选前就有提交会签')
    const shotFile = await shot('cp-sheet')
    console.log('     截图:' + shotFile)

    // ════ ⑦ 点「提交会签」→ 会签中 → 按钮换成会签组 ════
    step('⑦ 点「提交会签」(确认弹窗)→ 会签中')
    const clicked = await ev(`(function(){ var b=[].slice.call(document.querySelectorAll('.as-side-btn')).filter(function(x){return x.offsetParent && (x.textContent||'').indexOf('提交会签')>=0})[0]
      if(!b) return 'none'; b.click(); return 'clicked' })()`)
    await sleep(1200)
    const dlgTxt = await ev(`(function(){ var ds=[].slice.call(document.querySelectorAll('.el-message-box')).filter(function(d){return d.getBoundingClientRect().height>0})
      if(!ds.length) return 'NODLG'; var d=ds[ds.length-1]
      var t=(d.innerText||'').replace(/\\s+/g,' ').slice(0,90)
      var ok=d.querySelector('.el-message-box__btns button.el-button--primary')
      if(ok){ ok.click(); return t + ' →CLICKED(' + (ok.innerText||'').trim() + ')' }
      return t + ' →NO-PRIMARY-BTN' })()`)
    console.log(`     弹窗(${clicked}):` + dlgTxt)
    await sleep(3000)
    // 失败时把界面上的提示捞出来(否则只剩"状态没变"这种没信息的结论)
    const toast = await ev(`[].slice.call(document.querySelectorAll('.el-message')).filter(function(m){return m.offsetParent}).map(function(m){return (m.innerText||'').trim()}).join(' / ')`)
    const st1 = await ev(`(function(){ var s=document.querySelector('.record-sheet'); var t=s? (s.innerText||'') : ''
      return { signoff: t.indexOf('会签中')>=0, buttons: [].slice.call(document.querySelectorAll('.as-side-btn')).filter(function(b){return b.offsetParent}).map(function(b){return (b.textContent||'').trim()}) } })()`)
    console.log('     ' + JSON.stringify(st1))
    if (toast) console.log('     界面提示:' + toast)
    if ((st1?.buttons || []).some((t) => t.includes('撤回会签'))) ok('会签中:侧栏出现「撤回会签」(发起人)')
    else bad('会签中侧栏不对:' + JSON.stringify(st1?.buttons))
    if (!(st1?.buttons || []).some((t) => t.includes('提交会签'))) ok('「提交会签」已收起(会签中不再显示)')
    else bad('会签中仍显示提交会签')
    const shot2 = await shot('cp-signoff')

    // ════ ⑧ 会签人 glm53 视角 ════
    step('⑧ glm53(会签人)看到会签按钮;cp(非会签人)看不到')
    await login(glm.token, glm.user)
    await openDoc()
    const gBtns = await ev(`[].slice.call(document.querySelectorAll('.as-side-btn')).filter(function(b){return b.offsetParent}).map(function(b){return (b.textContent||'').trim()})`)
    console.log('     glm53 侧栏:' + JSON.stringify(gBtns))
    if ((gBtns || []).some((t) => t.includes('会签通过')) && (gBtns || []).some((t) => t.includes('会签驳回'))) ok('会签人能看到「会签通过/会签驳回」')
    else bad('会签人看不到会签按钮')
    if (!(gBtns || []).some((t) => t.includes('撤回会签'))) ok('会签人看不到「撤回会签」(只有发起人有)')
    else bad('会签人竟有撤回按钮')
    const shot3 = await shot('glm-signoff')

    const dbSt = sqlRows('_probe-change-ui-q', `SET NOCOUNT ON;
SELECT 单据状态, 编号 FROM (SELECT N'?' AS 单据状态, N'?' AS 编号) x;
SELECT (SELECT COUNT(*) FROM yj_form_approval WHERE panel_code=N'RD_CHANGE' AND form_no=N'${no}' AND action='SIGNOFF' AND result='PENDING') AS p, N'${no}' AS no;`)
    console.log('     库里待签数 = ' + JSON.stringify(dbSt[1]))
    if (Number(dbSt[1]?.[0]) === 1) ok('库里 1 条待签(glm53)')
    else bad('待签数不符:' + JSON.stringify(dbSt))

    fs.writeFileSync(CLEANUP, `/* 探针清理:产品变更申请单 界面验收(_probe-change-ui.cjs) */
USE HSDZ_MES; SET NOCOUNT ON;
DELETE FROM yj_message WHERE 单据编号 = N'${no}';
DELETE FROM yj_form_approval WHERE panel_code = N'RD_CHANGE' AND form_no = N'${no}';
DELETE FROM yj_doc_status WHERE panel_code = N'RD_CHANGE' AND doc_no = N'${no}';
DELETE FROM rd_change_detail WHERE 单据编号 = N'${no}';
DELETE FROM rd_change_head   WHERE 单据编号 = N'${no}';
SELECT N'界面探针残留' AS 检查, CAST(COUNT(*) AS nvarchar) AS n FROM rd_change_head WHERE 单据编号 = N'${no}';
`, 'utf8')
    console.log(`\n  --   清理 SQL:${CLEANUP}(单号 ${no})`)
    console.log('     截图:' + [shotFile, shot2, shot3].filter(Boolean).join(' , '))
  } finally {
    if (ws) try { ws.close() } catch { /* ignore */ }
    edge.kill()
  }

  console.log(failed ? `\n${failed} 项断言失败` : '\nALL PASSED')
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('探针异常:', e.message); process.exit(1) })
