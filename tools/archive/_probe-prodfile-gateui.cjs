/**
 * _probe-prodfile-gateui.cjs —— 四受控文件「前端置灰门禁」验收(2026-09-21)
 *
 * 背景(全流程走查发现):服务端 ensureDevFileEditable 已经拦住非责任人,但**界面不置灰** ——
 * 非责任人打开别人负责的文件照样能改,填完点保存才被拒。本探针钉住修好后的口径:
 *   ① 判定接口 /px/rdDev/fileEdit 与保存门禁**同一真源**:责任人=true、非责任人=false(带责任人姓名)、
 *      管理员=true、**未分发**产品=false、**产品编号为空的历史单**=true(豁免)、非四文件面板=不适用;
 *   ② 界面差三分:同一张草稿,责任人 cp 可编、非责任人品质部 0 个可编辑控件 + 看得到「本文件责任人」提示、
 *      管理员可编(管理员豁免);
 *   ③ 历史单(无产品编号)不被误伤:非责任人打开仍可编。
 *
 * 用法:node tools/archive/_probe-prodfile-gateui.cjs   (需后端 8090;跑完写清理 SQL,再手工执行)
 */
'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn, spawnSync } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const BASE = process.env.YINJIA_API || 'http://localhost:8090'
const EDGE = process.env.EDGE_BIN || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9345
const TOOLS = path.join(__dirname, '..')
const URLX = 'jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false;trustServerCertificate=true;loginTimeout=10'
const CLEANUP = path.join(__dirname, '_probe-prodfile-gateui-cleanup.sql')
const SHOTS = path.join(__dirname, '_shots')
const TAG = Date.now().toString().slice(-6)
const PROD = 'T-PFG-' + TAG          // 已分发产品
const PROD_ND = 'T-PFG-ND-' + TAG    // 未分发产品(只建单据,不发责任人)

let failed = 0
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => { failed++; console.log('  FAIL ' + m) }
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
  // 品质部账号(既不是成型工艺清单责任人,也不是它的部门)
  const users = (await A.get('/api/sys/user/list'))?.data || []
  if (!users.some((u) => u.userName === 'probe_qc')) {
    const deptId = Number(one('_probe-pfg-dept', `SET NOCOUNT ON; SELECT CAST(id AS nvarchar(10)) FROM yj_dept WHERE dept_name = N'质量管理部';`))
    await A.post('/api/sys/user/save', { userName: 'probe_qc', realName: '品质-探针', password: '123456', deptId, roleId: 2, enabled: 1 })
  }
  const qc = await tok('probe_qc'); const Q = api(qc.token)

  // ════════ ⓪ 造数 ════════
  step('⓪ 造数:已分发产品(成型工艺清单责任人=cp)+ 未分发产品 + 历史单(无产品编号)')
  const pi0 = await C.btn('RD_PROD_INFO', '新增', {})
  const piNo = pi0?.data?.['编号']
  await C.btn('RD_PROD_INFO', '保存', { 编号: piNo, 产品编号: PROD, 产品名称: '门禁走查产品', 产品类别: '滤芯', 产品负责人: cp.user.realName || '陈秀丽' })
  await A.btn('RD_PROD_INFO', '审批通过', { 编号: piNo, 二级审批人: 'glm53', 审批意见: '转二级' })
  await G.btn('RD_PROD_INFO', '审批通过', { 编号: piNo, 审批意见: '同意' })
  await G.btn('RD_PROD_INFO', '分发责任人', { 编号: piNo, 分发责任人: { RD_MOLD_PROC: 'cp', RD_ASM_PROC: 'glm53', RD_SPEC_DOC: 'cp', RD_INSP_PLAN: 'glm53' } })
  // 责任人 cp 的草稿(可编门槛:草稿态才看得出置灰)
  const mp = await C.btn('RD_MOLD_PROC', '保存为草稿', { 产品编号: PROD, 产品名称: '门禁走查产品', detail: { items: [{ 表区: '配方表', 序号: '1', 物料名称: '门禁走查物料' }] } })
  const mpNo = mp?.data?.['编号']
  // 未分发产品的一张草稿 —— ⚠ 普通账号**建不了**(未分发禁编,连建单都拦),所以由管理员建,
  //   再拿普通账号问判定接口(这正是"未分发禁编"在两条路上的体现)
  const ndBlocked = await C.btn('RD_MOLD_PROC', '保存为草稿', { 产品编号: PROD_ND, 产品名称: '未分发产品' })
  const nd = await A.btn('RD_MOLD_PROC', '保存为草稿', { 产品编号: PROD_ND, 产品名称: '未分发产品' })
  const ndNo = nd?.data?.['编号']
  info('普通账号建未分发产品的单:' + (ndBlocked?.code !== 200 ? '被拒(' + ndBlocked.message + ')' : '竟成功'))
  // 历史单:不带产品编号(豁免口径)
  const his = await C.btn('RD_MOLD_PROC', '保存为草稿', { 产品名称: '历史单(无产品编号)' })
  const hisNo = his?.data?.['编号']
  info(`已分发草稿=${mpNo} 未分发草稿=${ndNo} 历史单=${hisNo}`)
  if (mpNo && ndNo && hisNo) ok('三张测试单就绪')
  else throw new Error('造数失败:' + JSON.stringify([pi0, mp, nd, his]))

  // ════════ ① 判定接口(与保存门禁同源)════════
  step('① 判定接口 /px/rdDev/fileEdit')
  const verdict = async (API, docNo) => (await API.get(`/api/px/rdDev/fileEdit?panelCode=RD_MOLD_PROC&docNo=${encodeURIComponent(docNo)}`))?.data
  const vOwner = await verdict(C, mpNo)
  const vOther = await verdict(Q, mpNo)
  const vAdmin = await verdict(A, mpNo)
  const vUndispatched = await verdict(Q, ndNo)
  const vHistory = await verdict(Q, hisNo)
  const vNotApplicable = (await Q.get(`/api/px/rdDev/fileEdit?panelCode=RD_CHANGE&docNo=${encodeURIComponent(mpNo)}`))?.data
  info('责任人视角 = ' + JSON.stringify(vOwner))
  info('非责任人视角 = ' + JSON.stringify(vOther))
  info('管理员视角 = ' + JSON.stringify(vAdmin))
  info('未分发 = ' + JSON.stringify(vUndispatched) + ' / 历史单 = ' + JSON.stringify(vHistory) + ' / 非四文件面板 = ' + JSON.stringify(vNotApplicable))
  if (vOwner?.canEdit === true) ok('责任人:canEdit=true')
  else bad('责任人判定不对:' + JSON.stringify(vOwner))
  if (vOther?.canEdit === false) ok('非责任人:canEdit=false')
  else bad('非责任人判定不对:' + JSON.stringify(vOther))
  if (String(vOther?.reason || '').length > 0 && String(vOther?.ownerName || '').length > 0)
    ok(`非责任人拿到原因与责任人姓名:「${vOther.reason}」/ 责任人=${vOther.ownerName}`)
  else bad('缺原因或责任人姓名:' + JSON.stringify(vOther))
  if (vAdmin?.canEdit === true) ok('管理员:canEdit=true(豁免)')
  else bad('管理员判定不对:' + JSON.stringify(vAdmin))
  if (vUndispatched?.canEdit === false) ok('未分发产品:canEdit=false(未分发禁编)')
  else bad('未分发判定不对:' + JSON.stringify(vUndispatched))
  if (vHistory?.canEdit === true) ok('产品编号为空的历史单:canEdit=true(豁免,不误伤旧单)')
  else bad('历史单被误伤:' + JSON.stringify(vHistory))
  if (vNotApplicable?.applicable === false || vNotApplicable?.canEdit === true) ok('非四文件面板:不适用/不拦')
  else bad('非四文件面板判定不对:' + JSON.stringify(vNotApplicable))

  // ════════ ② 界面差三分 ════════
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-pfg-'))
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
      const f = path.join(SHOTS, `pfg-${tag}.png`)
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
    const docNoNow = () => ev(`(function(){
      var r=document.querySelector('.record-sheet')||document.querySelector('.approval-sheet')||document.querySelector('.doc-sheet')
      var m=((r&&r.innerText)||'').match(/(MP-\\d{4}-\\d{2}-\\d{4})/); return m? m[1] : '' })()`)
    const DQ = `[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.textContent.indexOf('查询单据')>=0 && d.getBoundingClientRect().height>0}).pop()`
    const clickSide = (label) => ev(`(function(){
      var all=[].slice.call(document.querySelectorAll('.as-side-btn,.as-side-menu-item,.as-side-btn-row>.as-side-btn'));
      for(var i=0;i<all.length;i++){ var t=(all[i].textContent||'').trim();
        if(t===${JSON.stringify(label)} && all[i].offsetParent){ all[i].click(); return 1 } } return 0 })()`)
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
    /** 打开某单:先「查询单据」切单,再切到「成型工艺清单」页(修订记录页不出报告头,那页读不到单号) */
    const open = async (docNo, panel = 'RD_MOLD_PROC') => {
      await nav(`${BASE}/#/panelx/list/${panel}`); await sleep(2400)
      await dismissInit()
      let shown = await focusDoc(docNo)
      await clickTab('成型工艺清单'); await sleep(1500)
      shown = await docNoNow()
      const r = await ev(`(function(){ var body=(document.body.innerText||'')
        return { inputs: [].slice.call(document.querySelectorAll('.record-sheet input, .record-sheet textarea')).filter(function(i){return i.offsetParent}).length,
                 hint: /本文件责任人|责任人[：:]/.test(body),
                 hintText: (body.match(/本文件责任人[^\\n]{0,44}/)||[''])[0] } })()`)
      return { shown, ...r }
    }

    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1500, deviceScaleFactor: 1, mobile: false })

    step('② 界面差三分(同一张草稿:责任人 / 非责任人 / 管理员)')
    await login(cp.token, cp.user)
    const o = await open(mpNo)
    info(`责任人 cp: 单号=${o.shown} 可编辑控件=${o.inputs} 提示=${JSON.stringify(o.hintText)}`)
    await login(qc.token, qc.user)
    const q = await open(mpNo)
    info(`非责任人: 单号=${q.shown} 可编辑控件=${q.inputs} 提示=${JSON.stringify(q.hintText)}`)
    const shotQ = await shot('qc-blocked')
    await login(admin.token, admin.user)
    const ad = await open(mpNo)
    info(`管理员: 单号=${ad.shown} 可编辑控件=${ad.inputs}`)
    if (![o, q, ad].every((x) => x.shown === mpNo)) bad('有视角没打开到目标单:责任人=' + o.shown + ' 非责任人=' + q.shown + ' 管理员=' + ad.shown + ' 期望=' + mpNo)
    else {
      ok('三个视角都打开到同一张单 ' + mpNo)
      if (o.inputs > 0) ok(`责任人可编(${o.inputs} 个控件)`)
      else bad('责任人竟不可编')
      if (q.inputs === 0) ok('非责任人被置灰(0 个可编辑控件)')
      else bad(`非责任人仍可编(${q.inputs} 个控件)`)
      if (q.hint) ok('非责任人看得到职责提示:' + q.hintText)
      else bad('非责任人看不到「本文件责任人」提示')
      if (ad.inputs > 0) ok(`管理员豁免可编(${ad.inputs} 个控件)`)
      else bad('管理员被误锁')
    }

    step('③ 历史单(无产品编号)不被误伤')
    await login(qc.token, qc.user)
    const h = await open(hisNo)
    info(`历史单: 单号=${h.shown} 可编辑控件=${h.inputs}`)
    if (h.shown === hisNo && h.inputs > 0) ok('历史单非责任人也照常可编(豁免口径一致)')
    else bad('历史单被误锁:' + JSON.stringify(h))
    const shotH = await shot('history-open')
    info('截图:' + [shotQ, shotH].filter(Boolean).join(' , '))

    fs.writeFileSync(CLEANUP, `/* 探针清理:四文件前端置灰门禁验收(_probe-prodfile-gateui.cjs);按测试前缀 T-PFG% 圈定 */
USE HSDZ_MES; SET NOCOUNT ON;
DECLARE @pi TABLE (no nvarchar(200) PRIMARY KEY);
INSERT INTO @pi (no) SELECT 单据编号 FROM rd_prod_info_head WHERE 产品编号 LIKE N'T-PFG%';
DECLARE @files TABLE (no nvarchar(200) PRIMARY KEY);
INSERT INTO @files (no) SELECT 单据编号 FROM rd_mold_proc_head WHERE 产品编号 LIKE N'T-PFG%' OR (产品编号 IS NULL AND 产品名称 LIKE N'历史单%');
INSERT INTO @files (no) SELECT 单据编号 FROM rd_asm_proc_head  WHERE 产品编号 LIKE N'T-PFG%';
INSERT INTO @files (no) SELECT 单据编号 FROM rd_insp_plan_head WHERE 产品编号 LIKE N'T-PFG%';
INSERT INTO @files (no) SELECT 单据编号 FROM rd_spec_doc_head  WHERE 编号 LIKE N'T-PFG%';
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
DELETE FROM rd_dev_task WHERE 产品编号 LIKE N'T-PFG%';
-- 本探针按需创建的品质部测试账号(要留用做演示就注释掉这行;探针重跑会自动再建)
DELETE FROM yj_user WHERE username = N'probe_qc';
SELECT N'本次残留' AS 检查, CAST(COUNT(*) AS nvarchar) AS n FROM rd_mold_proc_head WHERE 产品编号 LIKE N'T-PFG%' OR (产品编号 IS NULL AND 产品名称 LIKE N'历史单%');
`, 'utf8')
    console.log(`\n  --   清理 SQL:${CLEANUP}(已分发单 ${mpNo} / 未分发 ${ndNo} / 历史单 ${hisNo})`)
  } finally {
    if (ws) try { ws.close() } catch { /* ignore */ }
    edge.kill()
  }
  console.log(failed ? `\n${failed} 项断言失败` : '\nALL PASSED')
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('走查异常:', e.message); process.exit(1) })
