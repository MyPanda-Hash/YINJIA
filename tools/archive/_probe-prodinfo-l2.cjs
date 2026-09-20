/**
 * _probe-prodinfo-l2.cjs — 产品信息表**两级审批 + 分发责任人 + 四文件门禁**验收探针(2026-09-20)
 *
 * 口径(grill 六问):
 *   ① 两级审批:一级=admin(冯总);一级通过时**选取**二级审核人(候选=全部启用账号)
 *   ② 二级通过 → **直接归档**(不新增中间态)
 *   ③ 归档后二级审核人「分发责任人」:四文件各自一个责任人(可不同人)→ rd_dev_task.负责人,可随时改
 *   ④ 四文件服务端硬门禁:未分发禁编;分发后只放该文件责任人 ∪ 管理员;四文件并行
 *   ⑤ 二级驳回 → 回草稿 + 通知制单人
 *   ⑥ cp 账号(陈秀丽)= 普通用户;二级审批权"被选中即授权"
 *
 * 用法:node tools/archive/_probe-prodinfo-l2.cjs   (需后端 8090;跑完写清理 SQL,再手工执行)
 */
'use strict'

const fs = require('node:fs')
const path = require('node:path')

const BASE = process.env.YINJIA_API || 'http://localhost:8090'
const CLEANUP_SQL = path.join(__dirname, '_probe-prodinfo-l2-cleanup.sql')
const CODE = 'PROBE-L2-' + Date.now().toString().slice(-6)
const CODE2 = CODE + '-RJ'
const NAME = '探针产品-两级审批'

let failed = 0
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => { failed++; console.log('  FAIL ' + m) }
const step = (m) => console.log('\n▶ ' + m)
const eq = (got, want, m) => (String(got) === String(want) ? ok(`${m} = ${got}`) : bad(`${m} 实际 ${JSON.stringify(got)},期望 ${JSON.stringify(want)}`))

async function login(userName, password = '123456') {
  const r = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName, password }),
  })).json()
  if (!r?.data?.token) throw new Error(`${userName} 登录失败:` + JSON.stringify(r))
  return r.data.token
}

/** 登录并返回 {token, user}(界面段要往 localStorage 种 user) */
async function loginFull(userName, password = '123456') {
  const r = await (await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName, password }),
  })).json()
  if (!r?.data?.token) throw new Error(`${userName} 登录失败:` + JSON.stringify(r))
  return { token: r.data.token, user: r.data.user }
}

function apiFor(token) {
  const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}` }
  return {
    btn: async (panelCode, buttonName, formData) => (await (await fetch(`${BASE}/api/px/callButton`, {
      method: 'POST', headers: H, body: JSON.stringify({ panelCode, buttonName, formData, buttonParam: {} }),
    })).json()),
    get: async (p) => (await (await fetch(BASE + p, { headers: H })).json()),
    savePanel: async (panelCode, formData) => (await (await fetch(`${BASE}/api/px/callButton`, {
      method: 'POST', headers: H, body: JSON.stringify({ panelCode, buttonName: '保存', formData, buttonParam: {} }),
    })).json()),
  }
}

async function main() {
  const adminT = await login('admin')
  const cpT = await login('cp')
  process.stdout.write('')
  const admin = apiFor(adminT)
  const cp = apiFor(cpT)
  const glm = apiFor(await login('glm53'))
  ok('三个账号可登录:admin / cp(陈秀丽) / glm53(彭于晏)')

  let noL2 = null, noRj = null, noUI = null
  const authAdmin = await loginFull('admin')

  // ════ ① 一级提交 → 审批中(node=1) ════
  step('① 提交审批(一级)')
  const c1 = await admin.btn('RD_PROD_INFO', '保存为草稿', {})
  noL2 = c1?.data?.['编号']
  await admin.btn('RD_PROD_INFO', '保存为草稿', { 编号: noL2, 产品编号: CODE, 产品名称: NAME, 产品类别: '普通炭棒', 产品负责人: '陈秀丽' })
  const sub = await admin.btn('RD_PROD_INFO', '提交审批', { 编号: noL2, 审批意见: '请二级签核' })
  eq(sub?.data?.['单据状态'], '审批中', '提交后状态')
  const st1 = await admin.get(`/api/px/getFormDescriptor?panelCode=RD_PROD_INFO&code=${encodeURIComponent(noL2)}`)
  // ⚠ getFormDescriptor 是双层嵌套:body.data.data=头字段、body.data.detailData=明细(见 CONTEXT)
  eq(st1?.data?.data?.['单据状态'], '审批中', 'getFormDescriptor 状态')

  // 未选二级审核人 → 一级通过应被拒
  step('①b 一级通过必须选二级审核人(不选应被拒)')
  const noL2Pick = await admin.btn('RD_PROD_INFO', '审批通过', { 编号: noL2, 审批意见: '' })
  if (noL2Pick?.code !== 200 && /二级/.test(String(noL2Pick?.message))) ok(`不选二级审核人被拒:${noL2Pick.message}`)
  else bad(`一级通过未选二级审核人应被拒,实际 ${JSON.stringify(noL2Pick?.message || noL2Pick?.code)}`)

  // ════ ② 一级通过 + 选择二级审核人 → 待二级审批(未归档) ════
  step('② 一级通过并选取二级审核人 cp')
  const ap1 = await admin.btn('RD_PROD_INFO', '审批通过', { 编号: noL2, 二级审批人: 'cp', 审批意见: '一级通过' })
  console.log('     ' + JSON.stringify(ap1?.data))
  eq(ap1?.data?.['单据状态'], '待二级审批', '一级通过后状态')
  const head1 = await admin.get(`/api/px/getFormDescriptor?panelCode=RD_PROD_INFO&code=${encodeURIComponent(noL2)}`)
  eq(head1?.data?.data?.['审核人（二级审批人）'], '陈秀丽', '纸面「审核人(二级审批人)」回写')

  // ════ ③ 二级通过 → 归档 ════
  step('③ 二级审核人(cp)审批通过 → 归档')
  const ap2 = await cp.btn('RD_PROD_INFO', '审批通过', { 编号: noL2, 审批意见: '二级签核' })
  console.log('     ' + JSON.stringify(ap2?.data))
  eq(ap2?.data?.['单据状态'], '已归档', '二级通过后状态')
  // 非二级审核人不能替二级审批(另造一单验证)
  const c1b = await admin.btn('RD_PROD_INFO', '保存为草稿', {})
  const noL2b = c1b?.data?.['编号']
  await admin.btn('RD_PROD_INFO', '保存为草稿', { 编号: noL2b, 产品编号: CODE + '-B', 产品名称: NAME + 'B', 产品类别: '普通炭棒' })
  await admin.btn('RD_PROD_INFO', '提交审批', { 编号: noL2b })
  await admin.btn('RD_PROD_INFO', '审批通过', { 编号: noL2b, 二级审批人: 'cp' })
  const steal = await glm.btn('RD_PROD_INFO', '审批通过', { 编号: noL2b, 审批意见: '越权尝试' })
  if (steal?.code !== 200) ok(`非二级审核人代批被拒:${steal.message}`)
  else bad('非二级审核人竟然可以代批二级节点')
  const rj = await admin.btn('RD_PROD_INFO', '审批驳回', { 编号: noL2b, 审批意见: '资料不全,退回重填' })
  eq(rj?.data?.['单据状态'], '草稿', '二级驳回后状态回到')

  // ════ ④ 分发责任人(四文件各指定) ════
  step('④ 二级审核人分发责任人:四个文件各自指定')
  const before = await cp.btn('RD_PROD_INFO', '分发责任人', { 编号: noL2 })
  console.log('     未传分工时:' + JSON.stringify(before?.data))
  eq(before?.data?.['already'], false, '首次分发 already')
  const disp = await cp.btn('RD_PROD_INFO', '分发责任人', {
    编号: noL2,
    分发责任人: { RD_MOLD_PROC: 'cp', RD_ASM_PROC: 'cp', RD_SPEC_DOC: 'glm53', RD_INSP_PLAN: 'cp' },
  })
  console.log('     ' + JSON.stringify(disp?.data))
  const board = await admin.get('/api/px/rdDev/board')
  const row = (board?.data || []).find((r) => r['产品编号'] === CODE)
  if (row) ok('开发矩阵出现该产品') ; else bad('矩阵里没有该产品')
  const assigns = await admin.get(`/api/px/rdDev/assignState?docNo=${encodeURIComponent(noL2)}`)
  console.log('     分工明细:' + JSON.stringify(assigns?.data))
  const byPanel = assigns?.data?.assigns || {}
  eq(byPanel.RD_MOLD_PROC, 'cp', '成型工艺清单责任人')
  eq(byPanel.RD_SPEC_DOC, 'glm53', '规格书责任人')

  // ════ ⑤ 四文件门禁 ════
  step('⑤ 门禁:未分发禁编 / 分发后只放各自责任人')
  // 5a 未分发产品:新建后带产品编号保存 → 拒
  const undisp = await admin.btn('RD_MOLD_PROC', '保存为草稿', {})
  const undispNo = undisp?.data?.['编号']
  const g1 = await cp.savePanel('RD_MOLD_PROC', { 编号: undispNo, 产品编号: PROBE_UNDISP(), 产品名称: '未分发产品单' })
  if (g1?.code !== 200 && /分发/.test(String(g1?.message))) ok(`未分发产品保存被拒:${g1.message}`)
  else bad(`未分发产品不该能保存,实际 code=${g1?.code} msg=${g1?.message}`)
  // 5b 已分发:成型工艺清单责任人是 cp → cp 可存,glm53 不可存
  const m1 = await cp.btn('RD_MOLD_PROC', '保存为草稿', {})
  const moldNo = m1?.data?.['编号']
  const okSave = await cp.savePanel('RD_MOLD_PROC', { 编号: moldNo, 产品编号: CODE, 产品名称: NAME, 产品管控类型: '普通' })
  if (okSave?.code === 200) ok('成型工艺清单责任人(cp)可保存该产品的单')
  else bad(`责任人保存被拒:${okSave?.message}`)
  const denySave = await glm.savePanel('RD_MOLD_PROC', { 编号: moldNo, 产品编号: CODE, 产品名称: NAME })
  if (denySave?.code !== 200 && /责任人/.test(String(denySave?.message))) ok(`非责任人(glm53)保存被拒:${denySave.message}`)
  else bad(`非责任人竟然能存,实际 code=${denySave?.code} msg=${denySave?.message}`)
  // 5c 规格书责任人 glm53:草稿态可保存;cp(非责任人)另测(见 ⑥,那时四文件都换成了 glm53)
  const s1 = await glm.btn('RD_SPEC_DOC', '保存为草稿', {})
  const specNo = s1?.data?.['编号']
  const SPEC_BODY = { 规格书种类: '飞利浦沐浴阻垢滤芯', 名称: '探针规格书', 客户名称: '探针客户' }
  const specSave = await glm.savePanel('RD_SPEC_DOC', { 编号: specNo, ...SPEC_BODY })
  if (specSave?.code === 200) ok('规格书责任人(glm53)可保存')
  else bad(`规格书责任人保存被拒:${specSave?.message}`)

  // ════ ⑥ 改责任人(分发后可随时改) ════
  step('⑥ 分发后改责任人')
  const re = await cp.btn('RD_PROD_INFO', '分发责任人', {
    编号: noL2, 分发责任人: { RD_MOLD_PROC: 'glm53', RD_ASM_PROC: 'glm53', RD_SPEC_DOC: 'glm53', RD_INSP_PLAN: 'glm53' },
  })
  const a2 = await admin.get(`/api/px/rdDev/assignState?docNo=${encodeURIComponent(noL2)}`)
  eq(a2?.data?.assigns?.RD_MOLD_PROC, 'glm53', '改后成型责任人')
  eq(re?.data?.already, true, '二次分发 already')
  // 换人后:新责任人(glm53)建单可存,老责任人(cp)被门禁挡住
  const m2 = await glm.btn('RD_MOLD_PROC', '保存为草稿', {})
  const moldNo2 = m2?.data?.['编号']
  const flip = await glm.savePanel('RD_MOLD_PROC', { 编号: moldNo2, 产品编号: CODE, 产品名称: NAME })
  if (flip?.code === 200) ok('换人后新责任人(glm53)立即可编辑')
  else bad(`换人后新责任人仍被拒:${flip?.message}`)
  const i1 = await cp.btn('RD_INSP_PLAN', '保存为草稿', {})
  const inspNo = i1?.data?.['编号']
  const inspDeny = await cp.savePanel('RD_INSP_PLAN', { 编号: inspNo, 产品编号: CODE, 客户名: '探针客户' })
  if (inspDeny?.code !== 200 && /责任人/.test(String(inspDeny?.message))) ok(`换人后老责任人(cp)被门禁挡住:${inspDeny.message}`)
  else bad(`老责任人换掉后仍能存:${inspDeny?.code} ${inspDeny?.message}`)

  // ════ ⑦ 按钮状态 ════
  step('⑦ 侧边栏按钮状态(canAssign)')
  const bsAdmin = await admin.get(`/api/px/rdDev/buttonState?docNo=${encodeURIComponent(noL2)}`)
  const bsGlm = await glm.get(`/api/px/rdDev/buttonState?docNo=${encodeURIComponent(noL2)}`)
  console.log('     admin:' + JSON.stringify(bsAdmin?.data) + ' glm53:' + JSON.stringify(bsGlm?.data))
  if (bsAdmin?.data?.canAssign === true && bsGlm?.data?.canAssign === false) ok('canAssign:二级审核人/管理员 true,其他人 false')
  else bad('canAssign 判定不符')

  // ════ ⑧ 界面:两个新弹窗(headless Edge) ════
  step('⑧ 界面:一级通过弹「选取二级审核人」、已分发单弹「改责任人」')
  // 先造一张停在「审批中」(一级节点)的单给界面段用
  const cUI = await admin.btn('RD_PROD_INFO', '保存为草稿', {})
  noUI = cUI?.data?.['编号']
  await admin.btn('RD_PROD_INFO', '保存为草稿', { 编号: noUI, 产品编号: CODE + '-UI', 产品名称: NAME + 'UI', 产品类别: '普通炭棒', 产品负责人: '陈秀丽' })
  await admin.btn('RD_PROD_INFO', '提交审批', { 编号: noUI })
  const uiRes = await uiCheck(authAdmin.token, authAdmin.user, { archivedNo: noL2, pendingNo: noUI })
  if (uiRes) ok('界面断言通过(见上方 ok 行与截图)')

  console.log(failed ? `\n${failed} 项断言失败` : '\nALL PASSED')
  return { noL2, noL2b, noRj, moldNo, specNo, noUI }
}

/** 浏览器段:两个新弹窗的可视验证(截图存 tools/archive/_shots/) */
async function uiCheck(token, user, { archivedNo, pendingNo }) {
  const { spawn } = require('node:child_process')
  const os = require('node:os')
  const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
  const EDGE = process.env.EDGE_BIN || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  const PORT = 9335
  const SHOTS = path.join(__dirname, '_shots')
  fs.mkdirSync(SHOTS, { recursive: true })
  await new Promise((r) => setTimeout(r, 500))
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-l2-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--window-size=1760,1500', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  let ws = null
  try {
    await new Promise((r) => setTimeout(r, 3000))
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
      for (let i = 0; i < 80; i++) { await new Promise((r) => setTimeout(r, 200)); if (await ev('document.readyState') === 'complete') { await new Promise((r) => setTimeout(r, 3200)); return } }
    }
    const shot = async (tag) => {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
      if (!r.result?.data) return null
      const f = path.join(SHOTS, `l2-${tag}.png`)
      fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'))
      return f
    }
    const clickSide = (label) => ev(`(function(){
      var all=[].slice.call(document.querySelectorAll('.as-side-btn'));
      for(var i=0;i<all.length;i++){ if((all[i].textContent||'').trim()===${JSON.stringify(label)} && all[i].offsetParent){ all[i].click(); return 1 } }
      return 0 })()`)
    /** 点侧栏下拉里的菜单项(审批通过/审批驳回等在「修改组 ▾」里) */
    const clickMenuItem = (label) => ev(`(function(){
      var all=[].slice.call(document.querySelectorAll('.as-side-menu-item'));
      for(var i=0;i<all.length;i++){ if((all[i].textContent||'').trim()===${JSON.stringify(label)} && all[i].offsetParent){ all[i].click(); return 1 } }
      return 0 })()`)
    const focusDoc = async (want) => {
      for (let a = 0; a < 3; a++) {
        await clickSide('查询单据'); await new Promise((r) => setTimeout(r, 900))
        await ev(`(function(){ var dlg=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.textContent.indexOf('查询单据')>=0 && d.getBoundingClientRect().height>0}).pop();
          if(!dlg) return 'NO_DIALOG'; var inp=dlg.querySelector('input'); if(!inp) return 'NO_INPUT';
          Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(inp, ${JSON.stringify(want)});
          inp.dispatchEvent(new Event('input',{bubbles:true})); return 'SET' })()`)
        await new Promise((r) => setTimeout(r, 400))
        await ev(`(function(){ var dlg=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.textContent.indexOf('查询单据')>=0 && d.getBoundingClientRect().height>0}).pop();
          if(!dlg) return 'NO_DIALOG'; var bs=[].slice.call(dlg.querySelectorAll('button'));
          for(var i=0;i<bs.length;i++){ if(bs[i].textContent.trim()==='查询'){ bs[i].click(); return 'CLICKED' } } return 'NO_BTN' })()`)
        await new Promise((r) => setTimeout(r, 2400))
        const seen = await ev(`(function(){var t=document.querySelector('.record-sheet');var m=t?(t.innerText||'').match(/PI-\\d{4}-\\d{2}-\\d{4}/):null;return m?m[0]:''})()`)
        if (seen === want) return true
      }
      return false
    }
    const dialogInfo = () => ev(`(function(){
      var dlgs=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.getBoundingClientRect().height>0})
      var d=dlgs[dlgs.length-1]; if(!d) return null
      return { title:(d.querySelector('.el-dialog__title')||{}).textContent||'', selects:d.querySelectorAll('.el-select').length,
               inputs:d.querySelectorAll('input,textarea').length, text:(d.innerText||'').replace(/\\s+/g,' ').slice(0,200) } })()`)

    /** 关掉首次启动的「MES 初始化配置」引导弹窗(headless 每次都是新 profile,会盖住截图) */
    const dismissOnboarding = () => ev(`(function(){
      var dlgs=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.getBoundingClientRect().height>0})
      for (var i=0;i<dlgs.length;i++){
        var t=(dlgs[i].innerText||'')
        if (t.indexOf('初始化')>=0 || t.indexOf('下次再说')>=0){
          var bs=[].slice.call(dlgs[i].querySelectorAll('button,span,a'))
          for (var j=0;j<bs.length;j++){ if((bs[j].textContent||'').trim()==='下次再说'){ bs[j].click(); return 'dismissed' } }
        } }
      return 'none' })()`)

    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1500, deviceScaleFactor: 1, mobile: false })
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))}); 'ok'`)
    await nav('about:blank')

    // ⑧-1 一级节点:侧栏「修改组 ▼」里点「审批通过」→ 应弹「选取二级审核人」
    await nav(`${BASE}/#/panelx/list/RD_PROD_INFO`); await new Promise((r) => setTimeout(r, 2500))
    console.log('     引导弹窗:' + await dismissOnboarding())
    const f1 = await focusDoc(pendingNo)
    ok(`⑧-0 焦点单 = ${pendingNo}(${f1 ? '已定位' : '定位失败'})`)
    // 文书面板的审批动作在「申请修改 ▾」下拉里(不是常驻按钮);页面上有**两个** ▾(删除组/修改组),
    // 必须点「申请修改」那一行里的那个 —— 点错会开成删除菜单(实测踩过)
    const opened = await ev(`(function(){
      var rows=[].slice.call(document.querySelectorAll('.as-side-btn-row'));
      for(var i=0;i<rows.length;i++){
        if((rows[i].textContent||'').indexOf('申请修改')>=0 && rows[i].offsetParent){
          var c=rows[i].querySelector('.as-side-caret'); if(c){ c.click(); return 1 } } }
      return 0 })()`)
    await new Promise((r) => setTimeout(r, 600))
    const menu = await ev(`[].slice.call(document.querySelectorAll('.as-side-menu-item')).filter(function(e){return e.offsetParent}).map(function(e){return e.textContent.trim()})`)
    console.log(`     下拉(已展开=${opened}):` + JSON.stringify(menu))
    if ((menu || []).includes('审批通过')) ok('二级/一级审批入口在「修改组 ▾」下拉里可见(状态=审批中)')
    else bad(`下拉里没有「审批通过」:${JSON.stringify(menu)}`)
    await clickMenuItem('审批通过')
    await new Promise((r) => setTimeout(r, 1200))
    const d1 = await dialogInfo()
    console.log('     弹窗①:' + JSON.stringify(d1))
    if (d1 && d1.title.includes('二级审核人') && d1.selects >= 1) ok('一级「审批通过」弹出「选取二级审核人」弹窗(含人员下拉)')
    else bad(`一级审批通过弹窗异常:${JSON.stringify(d1)}`)
    const shot1 = await shot('pick-l2')
    await ev(`(function(){ var bs=[].slice.call(document.querySelectorAll('.el-dialog button')); for(var i=0;i<bs.length;i++){ if(bs[i].textContent.trim()==='取消'){ bs[i].click(); return 1 } } return 0 })()`
    )

    // ⑧-2 已归档已分发:点「改责任人」应弹四行分工弹窗
    const f2 = await focusDoc(archivedNo)
    ok(`⑧-2 焦点单 = ${archivedNo}(${f2 ? '已定位' : '定位失败'})`)
    const clicked = await clickSide('改责任人')
    await new Promise((r) => setTimeout(r, 1200))
    const d2 = await dialogInfo()
    console.log('     弹窗②:' + JSON.stringify(d2))
    if (clicked && d2 && d2.title.includes('分发责任人') && d2.selects >= 4) ok('已分发单弹「分发责任人」弹窗(四个文件各一个下拉,表头带回产品编号)')
    else bad(`分发责任人弹窗异常:clicked=${clicked} ${JSON.stringify(d2)}`)
    console.log(`     截图:${[shot1, await shot('assign')].filter(Boolean).join(', ')}`)
    return true
  } finally {
    if (ws) try { ws.close() } catch { /* ignore */ }
    edge.kill()
  }
}

/** 未分发产品用编号(避免与真实产品撞) */
function PROBE_UNDISP() { return CODE + '-UNDISP' }

main().then((ctx) => {
  const sql = `/* 探针清理:产品信息表两级审批验收(_probe-prodinfo-l2.cjs),可重复执行 */
USE HSDZ_MES; SET NOCOUNT ON;
DECLARE @docs TABLE (no nvarchar(120) PRIMARY KEY);
INSERT INTO @docs (no) SELECT 单据编号 FROM rd_prod_info_head WHERE 产品编号 LIKE N'PROBE-L2-%';
DELETE FROM rd_dev_task        WHERE 产品编号 LIKE N'PROBE-L2-%';
DELETE FROM yj_message         WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM yj_form_approval   WHERE panel_code IN (N'RD_PROD_INFO') AND form_no IN (SELECT no FROM @docs);
DELETE FROM yj_doc_status      WHERE panel_code = N'RD_PROD_INFO' AND doc_no IN (SELECT no FROM @docs);
DELETE FROM rd_prod_info_detail WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM rd_prod_info_head   WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM rd_mold_proc_detail WHERE 单据编号 IN (SELECT 单据编号 FROM rd_mold_proc_head WHERE 产品编号 LIKE N'PROBE-L2-%');
DELETE FROM rd_mold_proc_head   WHERE 产品编号 LIKE N'PROBE-L2-%';
DELETE FROM rd_spec_doc_detail  WHERE 单据编号 IN (SELECT 单据编号 FROM rd_spec_doc_head WHERE 编号 LIKE N'PROBE-L2-%');
DELETE FROM rd_spec_doc_head    WHERE 编号 LIKE N'PROBE-L2-%';
SELECT N'rd_dev_task 残留' AS 检查, CAST(COUNT(*) AS nvarchar) AS n FROM rd_dev_task WHERE 产品编号 LIKE N'PROBE-L2-%'
UNION ALL SELECT N'产品信息表残留', CAST(COUNT(*) AS nvarchar) FROM rd_prod_info_head WHERE 产品编号 LIKE N'PROBE-L2-%';
`
  fs.writeFileSync(CLEANUP_SQL, sql, 'utf8')
  console.log(`\n  --   清理 SQL:${CLEANUP_SQL}(单号 ${ctx?.noL2} 等)`)
  process.exit(failed ? 1 : 0)
}).catch((e) => { console.error('探针异常:', e.message); process.exit(1) })
