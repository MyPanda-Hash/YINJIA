/**
 * _probe-approval-fix.cjs — 文书面板「审批权 / 归档 / 卡死单据出口」一轮修复的端到端验收(2026-09-11)。
 *
 * 守的口径(与 CONTEXT.md「文书归档面板(Archived Doc Panels)」一致):
 *   ① 审核/弃审补审批权:普通用户 403,admin 成功(校验排在状态/存在性校验之前);
 *   ② saved 标志真生效:「新增」后 saved='N'、「保存」后 saved='Y'(前端 isFreshAddedDoc 依赖);
 *   ③ 删除审批留痕:删除审批驳回/通过各写一条 yj_form_approval(DELETE_REJECT / DELETE_APPROVE);
 *   ④ 撤回删除申请/撤回修改申请:仅发起人本人或审批人(旁观者 403),状态回真实值并留痕;
 *   ⑤ ensureDocNoUnique 排除已作废:作废单不占号(同号可再建),在册单同号仍拒绝(负向对照);
 *   ⑥ 界面:删除申请中/修改申请中 出现撤回按钮并点得动;已归档且 shr 非空的单据出现「已审批」角标
 *      (判据 '已通过' 也认 —— 原来只认 '已审批' 永不命中);
 *   ⑦ 把库里实测卡死的 MP-2026-09-0005 / MP-2026-09-0007 撤回(仅当仍在删除申请中);
 *   ⑧ SQL 佐证 + 探针自己造的数据全部清干净(两个临时普通用户、探针单据软删后再物理清掉探针行)。
 *
 * 用法: node tools/_probe-approval-fix.cjs [API] [FRONT]
 *       默认 API=http://localhost:8090(后端),FRONT=http://localhost:5173(前端 dev server)。
 *
 * 依赖:tools/node_modules/ws;headless Edge;sqlcmd(必须 -f 65001,否则中文条件静默不生效)。
 * 不做的事:不碰 s_allno、不碰 yj_usage_log、不改任何非探针单据。
 */
const { spawn, execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const API = process.argv[2] || 'http://localhost:8090'
const FRONT = process.argv[3] || 'http://localhost:5173'
const PORT = 9431
const EDGE = process.env.EDGE_BIN || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PANEL = 'RD_FILTER_EFF'   // 文书归档面板(文档编号唯一 + 归档后申请修改闭环都有)
const TAG = Date.now().toString(36)
const TMP1 = 'zpa' + TAG        // 发起人(普通用户)
const TMP2 = 'zpb' + TAG        // 旁观者(普通用户,无任何审批权)
const TMPPW = 'Probe@12345'
const DOCNO = 'PROBE-' + TAG + '-X'  // 文档编号查重用的探针编号

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fails = []
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m) }
const info = (m) => console.log('     · ' + m)

// ── sqlcmd(SQL 佐证与清理):-f 65001 是硬要求,否则含中文的 SQL 静默不生效 ──
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
/** 单值查询(第一行第一列;sqlcmd 的表头/分隔线/受影响行数全部剔除) */
function sqlOne(q) {
  const out = sqlRaw(q)
  const lines = out.split(/\r?\n/).map((s) => s.trim())
    .filter((s) => s && !/^-+(\|-+)*$/.test(s) && !/^\(\d+\s/.test(s))
  return lines.length ? lines[0].split('|')[0].trim() : ''
}

async function main() {
  // ════ 0. 登录 + 接口封装 + 临时普通用户 + 基线 ════
  const login = async (userName, password) => (await (await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName, password }),
  })).json())
  const admin = await login('admin', '123456')
  const adminToken = admin?.data?.token
  if (!adminToken) { console.error('admin 登录失败', admin); process.exit(1) }
  const mkApi = (token) => async (p, opts = {}) => {
    const res = await fetch(`${API}${p}`, { ...opts, headers: {
      'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(opts.headers || {}) } })
    let body = null
    try { body = await res.json() } catch { /* 空响应体 */ }
    return { http: res.status, code: body?.code, msg: body?.message || body?.msg || '', data: body?.data }
  }
  const A = mkApi(adminToken)
  const callBtn = (api, panelCode, buttonName, formData = {}) => api('/api/px/callButton', {
    method: 'POST', body: JSON.stringify({ panelCode, buttonName, formData, buttonParam: {} }) })
  const rowsOf = async (panelCode) => (await A('/api/px/queryFormDataList', {
    method: 'POST', body: JSON.stringify({ panelCode, pageNo: 1, pageSize: 300 }) })).data?.list || []
  const rowOf = async (panelCode, no) => (await rowsOf(panelCode)).find((r) => String(r['编号']) === String(no))
  const statusOf = async (no) => (await rowOf(PANEL, no))?.['单据状态'] || '(不在列表)'
  const savedOf = async (no) => (await rowOf(PANEL, no))?.saved

  console.log(`TAG=${TAG}  API=${API}  FRONT=${FRONT}  面板=${PANEL}`)
  const beforeDocs = new Set((await rowsOf(PANEL)).map((r) => String(r['编号'])))
  info(`基线:${PANEL} 在册单据 ${beforeDocs.size} 张`)

  // 临时普通用户(role_id=2 普通用户 ⇒ is_admin='N';验证完 SQL 删掉)
  for (const u of [TMP1, TMP2]) {
    const r = await A('/api/sys/user/save', { method: 'POST', body: JSON.stringify({
      userName: u, password: TMPPW, realName: '探针临时用户' + u.slice(3, 6), roleId: 2, enabled: 1 }) })
    ok(r.code === 200, `0 临时普通用户已建:${u}(roleId=2,is_admin='N';${JSON.stringify(r.msg).slice(0, 40)})`)
  }
  const l1 = await login(TMP1, TMPPW)
  const l2 = await login(TMP2, TMPPW)
  const U1 = mkApi(l1?.data?.token)
  const U2 = mkApi(l2?.data?.token)
  ok(!!l1?.data?.token && !!l2?.data?.token && l1.data.user?.isAdmin === false,
    `0 两个临时用户登录成功且 isAdmin=false(${l1?.data?.user?.isAdmin}/${l2?.data?.user?.isAdmin})`)

  const made = []   // 探针新建的单据编号(清理用)
  /** 新建一张探针单(走「新增」= directAdd 空草稿路径),返回单号 */
  const newDoc = async () => {
    const r = await callBtn(A, PANEL, '新增', {})
    const no = r.data?.['编号'] || ''
    if (no) made.push(String(no))
    return no
  }

  // ════ ① 审核/弃审补审批权 ════
  const P1 = await newDoc()
  ok(!!P1, `①-0 探针单 ${P1} 已建(草稿)`)
  const u1Audit = await callBtn(U1, PANEL, '审核', { 编号: P1 })
  const u1Unaudit = await callBtn(U1, PANEL, '弃审', { 编号: P1 })
  ok(u1Audit.code === 403, `①-1 普通用户「审核」被拒(code=${u1Audit.code} http=${u1Audit.http} msg=${u1Audit.msg})`)
  ok(u1Unaudit.code === 403, `①-2 普通用户「弃审」被拒(code=${u1Unaudit.code} http=${u1Unaudit.http} msg=${u1Unaudit.msg})`)
  const u1Ghost = await callBtn(U1, PANEL, '审核', { 编号: 'NO-SUCH-DOC-ZZ' })
  ok(u1Ghost.code === 403, `①-3 校验排在状态/存在性之前(不存在单号也是 ${u1Ghost.code},不是 400/${u1Ghost.msg})`)
  const aAudit = await callBtn(A, PANEL, '审核', { 编号: P1 })
  ok(aAudit.code === 200 && aAudit.data?.['单据状态'] === '已审核',
    `①-4 admin「审核」成功(${aAudit.code} / ${aAudit.data?.['单据状态']})`)
  const aUnaudit = await callBtn(A, PANEL, '弃审', { 编号: P1 })
  ok(aUnaudit.code === 200 && aUnaudit.data?.['单据状态'] === '草稿',
    `①-5 admin「弃审」成功(${aUnaudit.code} / ${aUnaudit.data?.['单据状态']})`)
  info(`SQL 佐证 UNAUDIT 留痕:${sqlOne(`SELECT TOP 1 action+'/'+result+'/'+operator FROM yj_form_approval WHERE panel_code='${PANEL}' AND form_no='${P1}' ORDER BY id DESC;`)}`)

  // ════ ② saved 标志真生效 ════
  const P2 = await newDoc()
  const savedAfterNew = await savedOf(P2)
  ok(savedAfterNew === 'N', `②-1 「新增」后 saved='N'(实际 ${JSON.stringify(savedAfterNew)})`)
  const saveP2 = await callBtn(A, PANEL, '保存', { 编号: P2, detail: {} })
  const savedAfterSave = await savedOf(P2)
  ok(saveP2.code === 200 && savedAfterSave === 'Y',
    `②-2 「保存」后 saved='Y'(实际 ${JSON.stringify(savedAfterSave)},保存返回 ${saveP2.code}/${saveP2.data?.['单据状态']})`)
  const P2b = await newDoc()
  const draftSave = await callBtn(A, PANEL, '保存为草稿', { 编号: P2b, detail: {} })
  ok(draftSave.code === 200 && (await savedOf(P2b)) === 'N',
    `②-3 「保存为草稿」后 saved='N'(实际 ${JSON.stringify(await savedOf(P2b))})`)

  // ════ ③ 删除审批留痕(DELETE_REJECT / DELETE_APPROVE) ════
  const P3 = await newDoc()
  await callBtn(A, PANEL, '保存', { 编号: P3, detail: {} })          // admin 保存即归档
  ok((await statusOf(P3)) === '已归档', `③-0 探针单 ${P3} 保存即归档(状态 ${await statusOf(P3)})`)
  await callBtn(U1, PANEL, '删除', { 编号: P3 })                      // 普通用户 → 删除申请中
  ok((await statusOf(P3)) === '删除申请中', `③-1 普通用户申请删除 → 删除申请中(状态 ${await statusOf(P3)})`)
  const rejDel = await callBtn(A, PANEL, '删除审批驳回', { 编号: P3 })
  ok(rejDel.code === 200 && rejDel.data?.['单据状态'] === '已归档',
    `③-2 删除审批驳回返回回查的真实状态(${rejDel.code} / ${rejDel.data?.['单据状态']})`)
  const nRej = sqlOne(`SELECT COUNT(*) FROM yj_form_approval WHERE panel_code='${PANEL}' AND form_no='${P3}' AND action='DELETE_REJECT';`)
  ok(nRej === '1', `③-3 yj_form_approval 有 DELETE_REJECT 记录(实际 ${nRej} 条)`)
  await callBtn(U1, PANEL, '删除', { 编号: P3 })
  const appDel = await callBtn(A, PANEL, '删除审批通过', { 编号: P3 })
  ok(appDel.code === 200 && appDel.data?.['单据状态'] === '已作废',
    `③-4 删除审批通过 → 已作废(${appDel.code} / ${appDel.data?.['单据状态']})`)
  const nApp = sqlOne(`SELECT COUNT(*) FROM yj_form_approval WHERE panel_code='${PANEL}' AND form_no='${P3}' AND action='DELETE_APPROVE';`)
  ok(nApp === '1', `③-5 yj_form_approval 有 DELETE_APPROVE 记录(实际 ${nApp} 条)`)

  // ════ ④ 撤回删除申请:旁观者 403 / 发起人本人可撤 ════
  const P4 = await newDoc()
  await callBtn(A, PANEL, '保存', { 编号: P4, detail: {} })
  await callBtn(U1, PANEL, '删除', { 编号: P4 })
  ok((await statusOf(P4)) === '删除申请中', `④-0 ${P4} 进入删除申请中(delete_req_by=${TMP1})`)
  const u2Withdraw = await callBtn(U2, PANEL, '撤回删除申请', { 编号: P4 })
  ok(u2Withdraw.code === 403, `④-1 旁观者（非发起人非审批人）撤回被拒(code=${u2Withdraw.code} msg=${u2Withdraw.msg})`)
  const u1Withdraw = await callBtn(U1, PANEL, '撤回删除申请', { 编号: P4 })
  ok(u1Withdraw.code === 200 && u1Withdraw.data?.['单据状态'] === '已归档',
    `④-2 发起人本人撤回成功并回真实状态(${u1Withdraw.code} / ${u1Withdraw.data?.['单据状态']})`)
  const nWd = sqlOne(`SELECT COUNT(*) FROM yj_form_approval WHERE panel_code='${PANEL}' AND form_no='${P4}' AND action='DELETE_WITHDRAW' AND operator='${TMP1}';`)
  ok(nWd === '1', `④-3 DELETE_WITHDRAW 留痕(operator=${TMP1},实际 ${nWd} 条)`)
  const reWd = await callBtn(U1, PANEL, '撤回删除申请', { 编号: P4 })
  ok(reWd.code === 409, `④-4 已归档再撤回报状态错(code=${reWd.code} msg=${reWd.msg})`)

  // ════ ⑤ 文档编号查重排除已作废 ════
  const P5a = await newDoc()
  const P5b = await newDoc()
  const s1 = await callBtn(A, PANEL, '保存', { 编号: P5a, 文档编号: DOCNO, detail: {} })
  ok(s1.code === 200, `⑤-1 第一张单用文档编号 ${DOCNO} 保存成功(${s1.code})`)
  const s2 = await callBtn(A, PANEL, '保存', { 编号: P5b, 文档编号: DOCNO, detail: {} })
  ok(s2.code === 400 && /文档编号不允许重复/.test(s2.msg),
    `⑤-2 负向对照:在册单同号仍拒绝(${s2.code} msg=${s2.msg})`)
  await callBtn(A, PANEL, '删除', { 编号: P5a })
  ok((await statusOf(P5a)) === '(不在列表)', `⑤-3 第一张单已作废(列表不可见 ⇒ canceled='Y')`)
  const s3 = await callBtn(A, PANEL, '保存', { 编号: P5b, 文档编号: DOCNO, detail: {} })
  ok(s3.code === 200, `⑤-4 作废后同号再保存成功(修复点;${s3.code} / ${s3.data?.['单据状态']} msg=${s3.msg})`)

  // ════ ⑥ 界面(CDP):撤回按钮 + 「已审批」角标 ════
  const P6 = await newDoc()
  await callBtn(A, PANEL, '保存', { 编号: P6, detail: {} })
  await callBtn(U1, PANEL, '删除', { 编号: P6 })
  const P7 = await newDoc()
  await callBtn(A, PANEL, '保存', { 编号: P7, detail: {} })
  await callBtn(U1, PANEL, '申请修改', { 编号: P7 })
  ok((await statusOf(P7)) === '修改申请中', `⑥-0 ${P7} 进入修改申请中(modify_req_by=${TMP1})`)

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-apf-'))
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
      var all=[].slice.call(document.querySelectorAll('.as-side-btn,.as-side-menu-item'));
      for(var i=0;i<all.length;i++){ if((all[i].textContent||'').trim()===${JSON.stringify(label)} && all[i].offsetParent) return 1 }
      return 0 })()`)
    const clickSide = (label) => ev(`(function(){
      var all=[].slice.call(document.querySelectorAll('.as-side-btn,.as-side-menu-item,.as-side-btn-row>.as-side-btn'));
      for(var i=0;i<all.length;i++){ var t=(all[i].textContent||'').trim();
        if(t===${JSON.stringify(label)} && all[i].offsetParent){ all[i].click(); return 1 } }
      return 0 })()`)
    const curChip = () => ev(`(document.querySelector('.doc-chip')||{}).textContent || ''`)
    const curStatus = () => ev(`(document.querySelector('.doc-status')||{}).textContent || ''`)
    /** 传统单据布局(非文书面板)按 .doc-chip 显示的编号翻到目标单(先末页再逐张上一张,有界) */
    const gotoDocByChip = async (target, maxSteps = 20) => {
      await ev(`(function(){ var bs=[].slice.call(document.querySelectorAll('.tools-right .page-btn'));
        for(var i=0;i<bs.length;i++){ if(bs[i].getAttribute('title')==='末页'){ bs[i].click(); return 1 } } return 0 })()`)
      await sleep(700)
      for (let i = 0; i < maxSteps; i++) {
        const chip = (await curChip()).trim()
        if (chip.includes(target)) return chip
        const moved = await ev(`(function(){ var bs=[].slice.call(document.querySelectorAll('.tools-right .page-btn'));
          for(var i=0;i<bs.length;i++){ if(bs[i].getAttribute('title')==='上一张'){ bs[i].click(); return 1 } } return 0 })()`)
        if (!moved) return chip
        await sleep(600)
      }
      return (await curChip()).trim()
    }
    const DQ = `[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.textContent.indexOf('查询单据')>=0 && d.getBoundingClientRect().height>0}).pop()`
    /** 用「查询单据」把当前单据切到指定编号(前端真交互,不走内部状态) */
    const focusDoc = async (no) => {
      await clickSide('查询单据'); await sleep(700)
      await ev(`(function(){ var dlg=${DQ}; if(!dlg) return 'NO_DIALOG'
        var inp=dlg.querySelector('input'); if(!inp) return 'NO_INPUT'
        var setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set
        setter.call(inp, ${JSON.stringify(no)}); inp.dispatchEvent(new Event('input',{bubbles:true})); return 'SET' })()`)
      await sleep(400)
      const clicked = await ev(`(function(){ var dlg=${DQ}; if(!dlg) return 'NO_DIALOG'
        var btns=[].slice.call(dlg.querySelectorAll('button'))
        for(var i=0;i<btns.length;i++){ if(btns[i].textContent.trim()==='查询'){ btns[i].click(); return 'CLICKED' } }
        return 'NO_BTN' })()`)
      await sleep(2600)
      return clicked
    }

    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1400, deviceScaleFactor: 1, mobile: false })
    await nav(`${FRONT}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(adminToken)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(admin.data.user))}); 'ok'`)
    await nav('about:blank') // 必须整页重载一次,否则被弹回登录页

    // ⑥-1 删除申请中 → 界面出现「撤回删除申请」并能点动(审批人分支)
    await nav(`${FRONT}/#/panelx/list/${PANEL}`)
    await ev(`(function(){var s=document.querySelector('.wz-skip'); if(s){s.click(); return 1} return 0})()`)
    await sleep(600)
    info(`界面切到 ${P6}:${await focusDoc(P6)} 状态=${JSON.stringify((await curStatus()).trim())}`)
    ok((await curStatus()).trim() === '删除申请中', `⑥-1 界面状态 = 删除申请中(实际 ${JSON.stringify((await curStatus()).trim())})`)
    ok(await sideBtnVisible('撤回删除申请') === 1, '⑥-2 删除申请中 → 侧栏出现「撤回删除申请」')
    await clickSide('撤回删除申请'); await sleep(2600)
    ok((await curStatus()).trim() === '已归档', `⑥-3 界面点撤回删除申请 → 已归档(实际 ${JSON.stringify((await curStatus()).trim())})`)
    const nWd2 = sqlOne(`SELECT COUNT(*) FROM yj_form_approval WHERE panel_code='${PANEL}' AND form_no='${P6}' AND action='DELETE_WITHDRAW' AND operator='admin';`)
    ok(nWd2 === '1', `⑥-4 界面点的那张单(编号 ${P6})落了审批人(admin)撤回留痕(实际 ${nWd2} 条)`)

    // ⑥-2 修改申请中 → 界面出现「撤回修改申请」并能点动
    info(`界面切到 ${P7}:${await focusDoc(P7)} 状态=${JSON.stringify((await curStatus()).trim())}`)
    ok((await curStatus()).trim() === '修改申请中', `⑥-5 界面状态 = 修改申请中(实际 ${JSON.stringify((await curStatus()).trim())})`)
    ok(await sideBtnVisible('撤回修改申请') === 1, '⑥-6 修改申请中 → 侧栏出现「撤回修改申请」')
    await clickSide('撤回修改申请'); await sleep(2600)
    ok((await curStatus()).trim() === '已归档', `⑥-7 界面点撤回修改申请 → 已归档(实际 ${JSON.stringify((await curStatus()).trim())})`)
    const nWd3 = sqlOne(`SELECT COUNT(*) FROM yj_form_approval WHERE panel_code='${PANEL}' AND form_no='${P7}' AND action='MODIFY_WITHDRAW' AND operator='admin';`)
    ok(nWd3 === '1', `⑥-8 ${P7} 落了 MODIFY_WITHDRAW 留痕(实际 ${nWd3} 条)`)

    // ⑥-3 「已审批」角标:后端只产 '已通过',原单值判据 `=== '已审批'` 永不命中。
    // 注意:角标只长在传统单据布局(非 isApprovalDoc 的「表中」明细块)里,文书面板那套纸张布局没有它,
    // 所以这里用普通单据面板 PURCHASE_IN 的已审核单(PI-2026-09-0004,shr='admin' ⇒ 审批状态='已通过')验证。
    await nav(`${FRONT}/#/panelx/list/PURCHASE_IN`)
    await sleep(1200)
    const chip = await gotoDocByChip('PI-2026-09-0004')
    const stamp = await ev(`document.querySelectorAll('.approved-stamp').length`)
    info(`传统单据布局当前单据=${JSON.stringify(chip)} 角标数=${stamp}`)
    ok(chip.includes('PI-2026-09-0004') && stamp >= 1,
      `⑥-9 审批状态='已通过' 的单据出现「已审批」角标(判据两值都认;角标数 ${stamp})`)
    info('(注)该角标只长在传统单据布局里;文书面板(isApprovalDoc 纸张布局)不渲染 .approved-stamp,详见汇报「不确定项」')
    ws.close(); ws = null
  } finally {
    if (ws) { try { ws.close() } catch { /* noop */ } }
    if (edge) edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch { /* noop */ }
  }

  // ════ ⑦ 库里实测卡死的两张单:admin 撤回删除申请(仅当仍在删除申请中) ════
  for (const no of ['MP-2026-09-0005', 'MP-2026-09-0007']) {
    const before = sqlOne(`SELECT deleting + '|' + ISNULL(delete_req_by,'') + '|' + ISNULL(archived,'') FROM yj_doc_status WHERE panel_code='RD_MOLD_PROC' AND doc_no='${no}';`)
    const st = await (async () => (await A('/api/px/queryFormDataList', { method: 'POST', body: JSON.stringify({
      panelCode: 'RD_MOLD_PROC', pageNo: 1, pageSize: 300 }) })).data?.list?.find((r) => String(r['编号']) === no))()
    const beforeStatus = st?.['单据状态'] || '(不在列表)'
    if (beforeStatus !== '删除申请中') {
      ok(beforeStatus === '已归档',
        `⑦ ${no} 已不在删除申请中(当前 ${beforeStatus};deleting|req_by|archived=${before} —— 本轮已救回,跳过撤回)`)
      continue
    }
    const w = await callBtn(A, 'RD_MOLD_PROC', '撤回删除申请', { 编号: no })
    const after = sqlOne(`SELECT ISNULL(deleting,'') + '|' + ISNULL(archived,'') FROM yj_doc_status WHERE panel_code='RD_MOLD_PROC' AND doc_no='${no}';`)
    const afterStatus = (await (async () => (await A('/api/px/queryFormDataList', { method: 'POST', body: JSON.stringify({
      panelCode: 'RD_MOLD_PROC', pageNo: 1, pageSize: 300 }) })).data?.list?.find((r) => String(r['编号']) === no))())?.['单据状态'] || '(不在列表)'
    ok(w.code === 200 && afterStatus === '已归档',
      `⑦ ${no} 撤回删除申请:${beforeStatus}(deleting|req_by|archived=${before}) → ${afterStatus}(${w.code};deleting|archived=${after})`)
  }

  // ════ ⑧ SQL 佐证 + 清理 ════
  console.log('\n── SQL 佐证(yj_form_approval 本轮新增;action|result|operator)──')
  console.log(sqlRaw(`SELECT action + '|' + result + '|' + ISNULL(operator,'') + '|' + form_no FROM yj_form_approval WHERE panel_code='${PANEL}' AND form_no IN (${made.map((n) => `'${n}'`).join(',') || "''"}) ORDER BY id;`))
  console.log('── SQL 佐证(卡死单撤回后状态)──')
  console.log(sqlRaw(`SELECT doc_no + '|' + ISNULL(deleting,'') + '|' + ISNULL(archived,'') + '|' + ISNULL(modify_state,'') FROM yj_doc_status WHERE doc_no IN ('MP-2026-09-0005','MP-2026-09-0007') ORDER BY doc_no;`))
  console.log('── SQL 佐证(文档编号查重口径:作废单不计占用)──')
  console.log(sqlRaw(`SELECT 单据编号 + '|' + 文档编号 + '|' + CASE WHEN EXISTS (SELECT 1 FROM yj_doc_status s WHERE s.panel_code='${PANEL}' AND s.doc_no=CAST(t.单据编号 AS nvarchar(100)) AND s.canceled='Y') THEN 'canceled' ELSE 'live' END FROM rd_filter_eff_head t WHERE 文档编号 = N'${DOCNO}';`))

  // 软删所有探针单(走「删除」接口,不碰 s_allno)
  for (const no of made) {
    const r = await callBtn(A, PANEL, '删除', { 编号: no })
    info(`清理:探针单 ${no} 走「删除」→ ${r.code}/${r.data?.['单据状态'] || r.msg}`)
  }
  // 只清探针自己的行(单据号取自本轮 API 返回,且不在基线集合内)
  const mine = made.filter((n) => !beforeDocs.has(n))
  const inList = `'${mine.join("','")}'`
  const leftHead = mine.length
    ? sqlOne(`SELECT COUNT(*) FROM rd_filter_eff_head WHERE 单据编号 IN (${inList});`) : '0'
  ok(mine.length === made.length, `⑧-1 待清理探针单 ${mine.length} 张(全部为本轮新建,无基线单据混入)`)
  ok(leftHead === String(mine.length), `⑧-2 清理前探针头行 ${leftHead} 张 = 新建 ${mine.length} 张`)
  if (mine.length) {
    sqlRaw(`DELETE FROM yj_form_approval WHERE form_no IN (${inList});
            DELETE FROM yj_doc_status WHERE doc_no IN (${inList});
            DELETE FROM rd_filter_eff_detail WHERE 单据编号 IN (${inList});
            DELETE FROM rd_filter_eff_head WHERE 单据编号 IN (${inList});
            DELETE FROM yj_user WHERE username IN ('${TMP1}','${TMP2}');`)
  } else {
    sqlRaw(`DELETE FROM yj_user WHERE username IN ('${TMP1}','${TMP2}');`)
  }
  const left = sqlOne(`SELECT (SELECT COUNT(*) FROM rd_filter_eff_head WHERE 单据编号 IN (${inList}))
    + (SELECT COUNT(*) FROM rd_filter_eff_detail WHERE 单据编号 IN (${inList}))
    + (SELECT COUNT(*) FROM yj_doc_status WHERE doc_no IN (${inList}))
    + (SELECT COUNT(*) FROM yj_form_approval WHERE form_no IN (${inList}))
    + (SELECT COUNT(*) FROM yj_user WHERE username IN ('${TMP1}','${TMP2}'));`)
  ok(left === '0', `⑧-3 探针残留 0 行(单据/状态/留痕/临时用户合计,实际 ${left})`)
  const afterDocs = (await rowsOf(PANEL)).map((r) => String(r['编号']))
  ok(afterDocs.length === beforeDocs.size && afterDocs.every((n) => beforeDocs.has(n)),
    `⑧-4 ${PANEL} 在册单据回到基线(${beforeDocs.size} 张:${afterDocs.join(',')})`)
  info(`s_allno 未触碰(sqlcmd 只动了探针自己的行)`)

  console.log(fails.length
    ? `\n结果: ${fails.length} 项失败\n` + fails.map((f) => '  - ' + f).join('\n')
    : '\n结果: 全部通过')
  process.exit(fails.length ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
