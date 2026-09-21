/**
 * _probe-prodfile-ui.cjs —— 「产品文件」各面板界面走查(2026-09-21)
 *
 * 前半段建一条真实数据链(产品信息表 → 两级审核 → 分发责任人 → 四文件归档),
 * 后半段**逐个面板在浏览器里打开看**:纸张/列表渲染对不对、页签全不全、侧栏按钮对不对、
 * 非责任人打开别人负责的文件时界面怎么表现(记录现状)。
 * 每张面板留一张截图(存 _shots/pfui-*.png)。
 *
 * 用法:node tools/archive/_probe-prodfile-ui.cjs   (需后端 8090;跑完写清理 SQL,再手工执行)
 */
'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn, spawnSync } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const BASE = process.env.YINJIA_API || 'http://localhost:8090'
const EDGE = process.env.EDGE_BIN || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9343
const TOOLS = path.join(__dirname, '..')
const URLX = 'jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true;loginTimeout=10'
const CLEANUP = path.join(__dirname, '_probe-prodfile-ui-cleanup.sql')
const SHOTS = path.join(__dirname, '_shots')
const TAG = Date.now().toString().slice(-6)
const PROD = 'T-PFU-' + TAG
const PRODNAME = '界面走查产品' + TAG

let failed = 0
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => { failed++; console.log('  FAIL ' + m) }
/** 走查发现的**未修缺口**:不算失败(否则探针永远红),但要在输出里显眼可见、可被 grep */
const gap = (m) => console.log('  GAP  ' + m)
const step = (m) => console.log('\n▶ ' + m)
const info = (m) => console.log('     ' + m)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function sqlRows(name, text) {
  const f = path.join(__dirname, name + '.sql')
  const out = path.join(__dirname, name + '.out.txt')
  fs.writeFileSync(f, text, 'utf8')
  const fd = fs.openSync(out, 'w')
  spawnSync('java', ['-Dstdout.encoding=UTF-8', '-cp', 'lib\\mssql-jdbc.jar', 'SqlRunner.java',
    URLX, 'yinjia', 'Yinjia@2026', 'archive\\' + name + '.sql'], { cwd: TOOLS, stdio: ['ignore', fd, fd] })
  fs.closeSync(fd)
  const txt = fs.readFileSync(out, 'utf8')
  if (/\[SQL FAIL\]|\[FATAL\]/.test(txt)) throw new Error('SQL 失败:\n' + txt)
  return txt.split('\n').filter((l) => l.trim().startsWith('|'))
    .map((l) => l.split('|').slice(1, -1).map((x) => x.trim()))
}
const one = (n, t) => (sqlRows(n, t)[0] || [''])[0]

async function main() {
  const tok = async (u, p = '123456') => {
    const r = await (await fetch(`${BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: u, password: p }),
    })).json()
    if (!r?.data?.token) throw new Error(u + ' 登录失败')
    return { token: r.data.token, user: r.data.user }
  }
  const api = (t) => {
    const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${t}` }
    return {
      btn: async (panelCode, buttonName, formData) => (await (await fetch(`${BASE}/api/px/callButton`, {
        method: 'POST', headers: H, body: JSON.stringify({ panelCode, buttonName, formData, buttonParam: {} }),
      })).json()),
      get: async (p) => (await (await fetch(BASE + p, { headers: H })).json()),
      post: async (p, b) => (await (await fetch(BASE + p, { method: 'POST', headers: H, body: JSON.stringify(b) })).json()),
    }
  }
  const admin = await tok('admin'); const A = api(admin.token)
  const cp = await tok('cp'); const C = api(cp.token)
  const glm = await tok('glm53'); const G = api(glm.token)
  // 品质部账号(非四文件责任人) —— 由 e2e 走查补的测试数据;不在就现建一个
  const users = (await A.get('/api/sys/user/list'))?.data || []
  let qc = users.find((u) => u.userName === 'probe_qc')
  if (!qc) {
    const deptId = Number(one('_probe-pfui-dept', `SET NOCOUNT ON; SELECT CAST(id AS nvarchar(10)) FROM yj_dept WHERE dept_name = N'质量管理部';`))
    await A.post('/api/sys/user/save', { userName: 'probe_qc', realName: '品质-探针', password: '123456', deptId, roleId: 2, enabled: 1 })
  }
  const qcTok = await tok('probe_qc'); const Q = api(qcTok.token)

  // ════════ 造一条真实数据链 ════════
  step('⓪ 造数:产品信息表 → 两级审核 → 分发责任人 → 四文件归档')
  const pi0 = await C.btn('RD_PROD_INFO', '新增', {})
  const piNo = pi0?.data?.['编号']
  await C.btn('RD_PROD_INFO', '保存', { 编号: piNo, 产品编号: PROD, 产品名称: PRODNAME, 产品类别: '滤芯', 产品负责人: cp.user.realName || '陈秀丽' })
  await A.btn('RD_PROD_INFO', '审批通过', { 编号: piNo, 二级审批人: 'glm53', 审批意见: '转二级' })
  await G.btn('RD_PROD_INFO', '审批通过', { 编号: piNo, 审批意见: '同意' })
  await G.btn('RD_PROD_INFO', '分发责任人', { 编号: piNo, 分发责任人: { RD_MOLD_PROC: 'cp', RD_ASM_PROC: 'glm53', RD_SPEC_DOC: 'cp', RD_INSP_PLAN: 'glm53' } })
  const mp = await C.btn('RD_MOLD_PROC', '保存', { 产品编号: PROD, 产品名称: PRODNAME, detail: { items: [{ 表区: '配方表', 序号: '1', 物料种类: '粉料', 物料名称: '界面走查粉料', 实际添加比例: '0.6' }] } })
  const mpNo = mp?.data?.['编号']
  await A.btn('RD_MOLD_PROC', '审批通过', { 编号: mpNo, 审批意见: '同意归档' })
  // 再留一张**草稿态**的成型工艺清单(同产品、责任人 cp):用它验证"非责任人打开别人负责的文件"时界面怎么表现
  const mpDraft = await C.btn('RD_MOLD_PROC', '保存为草稿', {
    产品编号: PROD, 产品名称: PRODNAME, detail: { items: [{ 表区: '配方表', 序号: '2', 物料种类: '胶粉', 物料名称: '草稿态物料' }] },
  })
  const mpDraftNo = mpDraft?.data?.['编号']
  info(`产品信息表 = ${piNo}  成型工艺清单 = ${mpNo}(已归档)  草稿态 = ${mpDraftNo}(${mpDraft?.data?.['单据状态']})`)
  if (piNo && mpNo && mpDraftNo) ok('数据链就绪')
  else throw new Error('造数失败:' + JSON.stringify([pi0, mp, mpDraft]))

  // ════════ 浏览器 ════════
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-pfui-'))
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
      for (let i = 0; i < 90; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3000); return } }
    }
    const shot = async (tag) => {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
      if (!r.result?.data) return null
      const f = path.join(SHOTS, `pfui-${tag}.png`)
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
    /** 纸张上现在显示的单号(报告头那格;修订记录页不出报告头,故取不到时由调用方先切页) */
    const docNoNow = () => ev(`(function(){
      var r=document.querySelector('.record-sheet')||document.querySelector('.approval-sheet')||document.querySelector('.doc-sheet')
      var m=((r&&r.innerText)||'').match(/((?:MP|AP|SD|IP|PI|CHG|T-PFU)-[\\w-]+)/); return m? m[1] : '' })()`)
    const DQ = `[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.textContent.indexOf('查询单据')>=0 && d.getBoundingClientRect().height>0}).pop()`
    const clickSide = (label) => ev(`(function(){
      var all=[].slice.call(document.querySelectorAll('.as-side-btn,.as-side-menu-item,.as-side-btn-row>.as-side-btn'));
      for(var i=0;i<all.length;i++){ var t=(all[i].textContent||'').trim();
        if(t===${JSON.stringify(label)} && all[i].offsetParent){ all[i].click(); return 1 } } return 0 })()`)
    /** 用面板自带的「查询单据」弹窗把纸张切到指定单(列表默认展示的不一定是探针那张 —— 经验来自 _probe-mold-rev-ui.cjs)
     *  ⚠ 直接改 input.value 不会触发 Vue 的 v-model,必须用原生 setter + input 事件 */
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
    const clickTab = (label) => ev(`(function(){
      var ts=[].slice.call(document.querySelectorAll('.rsp-page-tab')).filter(function(t){return t.offsetParent && (t.innerText||'').trim()===${JSON.stringify(label)}})
      if(!ts.length) return 'no-tab'; ts[0].click(); return 'tab' })()`)

    /** 打开面板;给了 docNo 就用「查询单据」切到那一张,并回报纸张上实际显示的单号(断言前先核对) */
    const openPanel = async (panelCode, docNo, expect = [], tabName = '') => {
      await nav(`${BASE}/#/panelx/list/${panelCode}`); await sleep(2400)
      await dismissInit()
      let shown = ''
      if (docNo) {
        shown = await focusDoc(docNo)
        await sleep(1200)
      }
      let tabbed = ''
      if (tabName) { tabbed = await clickTab(tabName); await sleep(1400) }
      // ⚠ 单号要在**切页之后**再读:修订记录页不出报告头,那页上读不到编号(先读会一直空)
      if (docNo) shown = await docNoNow()
      // 断言用的"可见文字":innerText **不含**输入框里的值与 placeholder(可编辑纸张的标题就是 placeholder)
      const res = await ev(`(function(){ var body=(document.body.innerText||'')
        var ph=[].slice.call(document.querySelectorAll('input,textarea')).map(function(i){return (i.placeholder||'')+' '+(i.value||'')}).join(' | ')
        var paper=document.querySelector('.record-sheet')||document.querySelector('.approval-sheet')||document.querySelector('.doc-sheet')
        var hay=body+' || '+ph
        var ex=${JSON.stringify(expect)}
        return { hit: ex.length===0 ? true : ex.every(function(s){ return hay.indexOf(s)>=0 }),
                 paper: (paper? (paper.innerText||'') : '').replace(/\\s+/g,' ').slice(0,260),
                 inputs: [].slice.call(document.querySelectorAll('.record-sheet input, .record-sheet textarea')).filter(function(i){return i.offsetParent}).length } })()`)
      const toasts = await ev(`[].slice.call(document.querySelectorAll('.el-message')).filter(function(m){return m.offsetParent}).map(function(m){return (m.innerText||'').trim()}).join(' / ')`)
      const tabs = await ev(`[].slice.call(document.querySelectorAll('.rsp-page-tab')).filter(function(t){return t.offsetParent}).map(function(t){return (t.innerText||'').trim()})`)
      const btns = await ev(`[].slice.call(document.querySelectorAll('.as-side-btn')).filter(function(b){return b.offsetParent}).map(function(b){return (b.textContent||'').trim()})`)
      return { hit: res?.hit, paper: res?.paper || '', inputs: res?.inputs, toasts: toasts || '', tabs, btns, shown, focused: `shown=${shown || '(空)'}${tabbed ? '/' + tabbed : ''}` }
    }

    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1500, deviceScaleFactor: 1, mobile: false })

    // ════════ ① 面板体检:产品文件组 8 张 ════════
    step('① 逐张面板打开看(产品文件组 + 变更单)')
    await login(cp.token, cp.user)
    const panels = [
      ['RD_PROD_INFO', piNo, ['产品信息表']],
      ['RD_MOLD_PROC', mpNo, ['成型工艺清单']],
      ['RD_ASM_PROC', null, ['组装工艺清单']],
      // 纸面大标题与面板名不同(面板叫 出货检验计划表,纸上印「出货检验项目控制计划」)——按纸面断言
      ['RD_SPEC_DOC', null, ['规格书']],
      ['RD_INSP_PLAN', null, ['出货检验项目控制计划']],
      ['RD_PROD_DOCLIST', null, ['产品文件列表']],
      ['RD_SAMPLE_NO', null, ['样品编号']],
      // 变更单纸面标题 = KPC管控点申请单(YJ-QR-130)
      ['RD_CHANGE', null, ['KPC管控点申请单']],
    ]
    for (const [panel, docNo, expect] of panels) {
      const r = await openPanel(panel, docNo, expect)
      const f = await shot(panel.toLowerCase())
      info(`${panel}: 聚焦=${r.focused} 页签=${JSON.stringify(r.tabs)} 侧栏=${JSON.stringify(r.btns.slice(0, 8))}${r.toasts ? ' 提示=' + r.toasts : ''}`)
      if (r.hit && !r.toasts) ok(`${panel} 渲染正常(${f ? path.basename(f) : '无截图'})`)
      else bad(`${panel} 渲染异常:hit=${r.hit} 提示=${r.toasts} 纸面片段=${r.paper.slice(0, 140)}`)
    }

    // ════════ ② 产品信息表:归档后侧栏与状态 ════════
    step('② 产品信息表(已归档)界面:状态 + 分发按钮')
    const pi = await openPanel('RD_PROD_INFO', piNo, ['已归档'])
    info('侧栏 = ' + JSON.stringify(pi.btns))
    if (pi.hit) ok('单据状态显示已归档')
    else bad('状态没显示已归档(纸面片段=' + pi.paper.slice(0, 100) + ')')
    if (pi.btns.some((b) => b.includes('改责任人') || b.includes('分发责任人'))) ok('侧栏有分发/改责任人入口')
    else bad('侧栏缺分发责任人入口')

    // ════════ ③ 成型工艺清单:页签与内容(责任人视角,拿草稿那张看才看得到可编辑)════════
    step('③ 成型工艺清单(责任人 cp)打开草稿那张:页签齐 + 内容渲染 + 可编')
    const m = await openPanel('RD_MOLD_PROC', mpDraftNo, ['草稿态物料'], '成型配方')
    info(`页签 = ${JSON.stringify(m.tabs)} 聚焦=${m.focused} 可编辑控件 = ${m.inputs} 侧栏 = ${JSON.stringify(m.btns.slice(0, 6))}`)
    if (m.tabs.length >= 3) ok('三个页签齐:修订记录 / 成型工艺清单 / 成型配方')
    else bad('页签缺失:' + JSON.stringify(m.tabs))
    // ⚠ 先核对纸张上真是这张单,否则后面的内容断言不可信(经验:_probe-mold-rev-ui.cjs)
    if (m.shown === mpDraftNo) ok(`纸张显示的就是草稿那张 ${mpDraftNo}`)
    else bad(`纸张显示的是 ${JSON.stringify(m.shown)},不是草稿单 ${mpDraftNo} —— 后面断言不可信`)
    if (m.hit) ok('成型配方页里能看到自己刚填的「草稿态物料」')
    else bad('配方页内容没渲染(纸面片段=' + m.paper.slice(0, 120) + ')')
    if (m.inputs > 0) ok(`责任人看到的是可编辑纸张(${m.inputs} 个可编辑控件)`)
    else bad('责任人打开自己的草稿竟是只读')

    // ════════ ④ 非责任人打开同一张草稿(差分:同一张单、同一页,对比 ③)════════
    step('④ 品质部账号(非该文件责任人)打开同一张草稿:界面是否置灰')
    await login(qcTok.token, qcTok.user)
    const q = await openPanel('RD_MOLD_PROC', mpDraftNo, [], '成型配方')
    info(`聚焦=${q.focused}; 侧栏 = ${JSON.stringify(q.btns.slice(0, 6))}; 可编辑控件 = ${q.inputs}`)
    if (q.shown !== mpDraftNo) bad(`纸张显示的是 ${JSON.stringify(q.shown)},不是草稿单 —— 只读断言不可信`)
    else if (q.inputs === 0) ok(`界面已把别人的文件置为只读(0 个可编辑控件;责任人 cp 同一张单是 ${m.inputs} 个 —— 差分成立)`)
    else gap(`界面**没有**按责任人置灰:非责任人打开别人负责的文件,界面仍给 ${q.inputs} 个可编辑控件`
      + `(与责任人 cp 的 ${m.inputs} 个一样),要改完点保存才被服务端拒 —— 与「变更单部门行」的置灰口径不一致,待定是否补前端门禁`)
    const blocked = await Q.btn('RD_MOLD_PROC', '保存', { 编号: mpDraftNo, 产品编号: PROD, 产品名称: PRODNAME })
    if (blocked?.code !== 200) ok('服务端兜底拦住非责任人:' + blocked.message)
    else bad('非责任人竟能保存:' + JSON.stringify(blocked?.data))
    const f4 = await shot('qc-view-mold-proc')
    info('截图:' + f4)

    fs.writeFileSync(CLEANUP, `/* 探针清理:产品文件界面走查(_probe-prodfile-ui.cjs);按测试产品前缀 T-PFU-% 圈定 */
USE HSDZ_MES; SET NOCOUNT ON;
DECLARE @pi TABLE (no nvarchar(200) PRIMARY KEY);
INSERT INTO @pi (no) SELECT 单据编号 FROM rd_prod_info_head WHERE 产品编号 LIKE N'T-PFU-%';
DECLARE @files TABLE (no nvarchar(200) PRIMARY KEY);
INSERT INTO @files (no) SELECT 单据编号 FROM rd_mold_proc_head WHERE 产品编号 LIKE N'T-PFU-%';
INSERT INTO @files (no) SELECT 单据编号 FROM rd_asm_proc_head  WHERE 产品编号 LIKE N'T-PFU-%';
INSERT INTO @files (no) SELECT 单据编号 FROM rd_insp_plan_head WHERE 产品编号 LIKE N'T-PFU-%';
INSERT INTO @files (no) SELECT 单据编号 FROM rd_spec_doc_head  WHERE 编号 LIKE N'T-PFU-%';
DELETE FROM yj_message WHERE 单据编号 IN (SELECT no FROM @pi) OR 单据编号 IN (SELECT no FROM @files);
DELETE FROM yj_form_approval WHERE form_no IN (SELECT no FROM @pi) OR form_no IN (SELECT no FROM @files);
DELETE FROM yj_doc_status WHERE doc_no IN (SELECT no FROM @pi) OR doc_no IN (SELECT no FROM @files);
DELETE FROM rd_mold_proc_detail WHERE 单据编号 IN (SELECT no FROM @files);
DELETE FROM rd_asm_proc_detail  WHERE 单据编号 IN (SELECT no FROM @files);
DELETE FROM rd_insp_plan_detail WHERE 单据编号 IN (SELECT no FROM @files);
DELETE FROM rd_spec_doc_detail  WHERE 单据编号 IN (SELECT no FROM @files);
DELETE FROM rd_mold_proc_head WHERE 单据编号 IN (SELECT no FROM @files);
DELETE FROM rd_asm_proc_head  WHERE 单据编号 IN (SELECT no FROM @files);
DELETE FROM rd_insp_plan_head WHERE 单据编号 IN (SELECT no FROM @files);
DELETE FROM rd_spec_doc_head  WHERE 单据编号 IN (SELECT no FROM @files);
DELETE FROM rd_prod_info_detail WHERE 单据编号 IN (SELECT no FROM @pi);
DELETE FROM rd_prod_info_head   WHERE 单据编号 IN (SELECT no FROM @pi);
DELETE FROM rd_dev_task WHERE 产品编号 LIKE N'T-PFU-%';
SELECT N'本次残留' AS 检查, CAST(COUNT(*) AS nvarchar) AS n FROM rd_prod_info_head WHERE 产品编号 LIKE N'T-PFU-%';
`, 'utf8')
    console.log(`\n  --   清理 SQL:${CLEANUP}(测试产品 ${PROD})`)
  } finally {
    if (ws) try { ws.close() } catch { /* ignore */ }
    edge.kill()
  }
  console.log(failed ? `\n${failed} 项断言失败` : '\nALL PASSED')
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('走查异常:', e.message); process.exit(1) })
