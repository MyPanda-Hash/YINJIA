/**
 * _probe-approval-grade.cjs — 立项申请表「项目定级」验收(2026-09-21)
 *
 * 用户口径:立项申请审核通过后,由审核人在系统里给项目定级,等级作为后续立项(实施计划)与
 * 进度流程的属性;等级选项全链路统一为 **一/二/三/四级**(新增第四级)。
 *
 * 探针钉六件事:
 *   ① 未通过审核(草稿)的单不能定级;
 *   ② 无审批权的账号(glm53)调「项目定级」被拒;
 *   ③ 审核人(admin)可定级 → rd_approval.项目等级 落库 + 留一条 GRADE/GRADED 留痕;
 *   ④ 已定级可再改(一级 → 三级),留痕累计两条(不覆盖历史);
 *   ⑤ 非法取值(五级)被拒 —— 选项就是 一/二/三/四级;
 *   ⑥ 下游属性:实施计划(RD_PLAN)按「文档编号」参照立项申请时,项目等级 → 项目定级 自动带回
 *      (面板配置里的 refMap 必须含这对映射),且 RD_PLAN.项目定级 字典含「一级」(四级统一)。
 *   ⑦ 界面:立项申请侧栏出现「项目定级」按钮,弹窗四个等级档。
 *
 * 用法:node tools/archive/_probe-approval-grade.cjs   (需后端 8090;跑完写清理 SQL,再手工执行)
 */
'use strict'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn } = require('node:child_process')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const BASE = process.env.YINJIA_API || 'http://localhost:8090'
const EDGE = process.env.EDGE_BIN || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PORT = 9338
const SHOTS = path.join(__dirname, '_shots')
const CLEANUP = path.join(__dirname, '_probe-approval-grade-cleanup.sql')
const DOCNO = 'PROBE-GRADE-' + Date.now().toString().slice(-5)

let failed = 0
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => { failed++; console.log('  FAIL ' + m) }
const step = (m) => console.log('\n▶ ' + m)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const tok = async (u) => {
    const r = await (await fetch(`${BASE}/api/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: u, password: '123456' }),
    })).json()
    if (!r?.data?.token) throw new Error(u + ' 登录失败')
    return { token: r.data.token, user: r.data.user }
  }
  const admin = await tok('admin')
  const glm = await tok('glm53')
  const api = (t) => {
    const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${t}` }
    return {
      btn: async (panelCode, buttonName, formData) => (await (await fetch(`${BASE}/api/px/callButton`, {
        method: 'POST', headers: H, body: JSON.stringify({ panelCode, buttonName, formData, buttonParam: {} }),
      })).json()),
      get: async (p) => (await (await fetch(BASE + p, { headers: H })).json()),
      post: async (p, body) => (await (await fetch(BASE + p, { method: 'POST', headers: H, body: JSON.stringify(body) })).json()),
    }
  }
  const A = api(admin.token)
  const G = api(glm.token)

  // ════ ① 草稿先试(应被拒) ════
  step('① 造一张立项申请(草稿态先试定级)')
  const draft = await A.btn('RD_APPROVAL', '保存为草稿', {})
  const no = draft?.data?.['编号']
  if (!no) throw new Error('建立项申请失败:' + JSON.stringify(draft))
  await A.btn('RD_APPROVAL', '保存为草稿', { 编号: no, 文档编号: DOCNO, 项目开发目标: '探针-项目定级验收' })
  const early = await A.btn('RD_APPROVAL', '项目定级', { 编号: no, 项目等级: '二级' })
  if (early?.code !== 200 && /已审核|已归档/.test(String(early?.message))) ok(`草稿态被拒:${early.message}`)
  else bad(`草稿态不该能定级,实际 code=${early?.code} msg=${early?.message}`)

  // 归档(管理员保存 = 直接归档)
  const saved = await A.btn('RD_APPROVAL', '保存', { 编号: no, 文档编号: DOCNO, 项目开发目标: '探针-项目定级验收' })
  console.log(`     保存后状态=${saved?.data?.['单据状态']}`)
  const st = await A.get(`/api/px/getFormDescriptor?panelCode=RD_APPROVAL&code=${encodeURIComponent(no)}`)
  const status = st?.data?.data?.['单据状态']
  if (status === '已归档' || status === '已审核') ok(`单据可定级态:${status}`)
  else bad(`单据状态不符:${status}`)

  // ════ ② 无审批权账号被拒 ════
  step('② 无审批权账号(glm53)调「项目定级」')
  const denied = await G.btn('RD_APPROVAL', '项目定级', { 编号: no, 项目等级: '二级' })
  if (denied?.code !== 200 && /权限/.test(String(denied?.message))) ok(`被拒:${denied.message}`)
  else bad(`无审批权账号不该能定级,实际 code=${denied?.code} msg=${denied?.message}`)

  // ════ ③ 审核人定级 → 落库 + 留痕 ════
  step('③ 审核人(admin)定级 二级')
  const g1 = await A.btn('RD_APPROVAL', '项目定级', { 编号: no, 项目等级: '二级', 审批意见: '按客户等级定为二级' })
  console.log('     ' + JSON.stringify(g1?.data))
  const r1 = await A.get(`/api/px/getFormDescriptor?panelCode=RD_APPROVAL&code=${encodeURIComponent(no)}`)
  const lv1 = r1?.data?.data?.['项目等级']
  if (lv1 === '二级') ok('rd_approval.项目等级 = 二级(已落库)')
  else bad(`等级未落库:${JSON.stringify(lv1)}`)
  const hist1 = (await A.post('/api/px/callButton', { panelCode: 'RD_APPROVAL', buttonName: '审批情况', formData: { 编号: no }, buttonParam: {} }))?.data?.list || []
  const grades1 = hist1.filter((x) => x.action === 'GRADE')
  if (grades1.length === 1 && String(grades1[0].opinion || '').includes('二级')) ok(`留痕 1 条:GRADE/${grades1[0].result}/${grades1[0].opinion}`)
  else bad(`留痕不符:${JSON.stringify(grades1)}`)

  // ════ ④ 改级(可再改,留痕累计) ════
  step('④ 改级:二级 → 三级')
  await A.btn('RD_APPROVAL', '项目定级', { 编号: no, 项目等级: '三级' })
  const r2 = await A.get(`/api/px/getFormDescriptor?panelCode=RD_APPROVAL&code=${encodeURIComponent(no)}`)
  if (r2?.data?.data?.['项目等级'] === '三级') ok('等级已改为 三级')
  else bad(`改级失败:${JSON.stringify(r2?.data?.data?.['项目等级'])}`)
  const hist2 = (await A.post('/api/px/callButton', { panelCode: 'RD_APPROVAL', buttonName: '审批情况', formData: { 编号: no }, buttonParam: {} }))?.data?.list || []
  const grades2 = hist2.filter((x) => x.action === 'GRADE')
  if (grades2.length === 2 && String(grades2[1].opinion || '').includes('→')) ok(`留痕累计 2 条,第二条含改名轨迹:${grades2[1].opinion}`)
  else bad(`改级留痕不符:${JSON.stringify(grades2.map((x) => x.opinion))}`)

  // ════ ⑤ 非法取值被拒 ════
  step('⑤ 非法取值(五级)被拒')
  const bad5 = await A.btn('RD_APPROVAL', '项目定级', { 编号: no, 项目等级: '五级' })
  if (bad5?.code !== 200 && /不合法/.test(String(bad5?.message))) ok(`被拒:${bad5.message}`)
  else bad(`五级不该被接受,实际 code=${bad5?.code} msg=${bad5?.message}`)

  // ════ ⑥ 下游属性:参照带回映射 + 下游字典含一级 ════
  step('⑥ 下游属性:实施计划按文档编号参照自动带回等级')
  const planCfg = await A.get('/api/px/getPanelConfig?panelCode=RD_PLAN')
  const headerFields = planCfg?.data?.dataSchema?.fields || []
  const refField = headerFields.find((f) => (f.dataName || f.code) === '文档编号')
  const map = refField?.refMap || []
  const hit = map.find((m) => m.from === '项目等级' && m.to === '项目定级')
  console.log(`     文档编号.refMap = ${JSON.stringify(map)}`)
  if (hit) ok('参照映射在:项目等级 → 项目定级(选中立项申请即把等级带进计划的 项目定级)')
  else bad(`缺少 项目等级→项目定级 映射:${JSON.stringify(map)}`)
  const lvField = headerFields.find((f) => (f.dataName || f.code) === '项目定级')
  const opts = lvField?.options || []
  console.log(`     RD_PLAN.项目定级 选项 = ${JSON.stringify(opts)}`)
  if (opts.includes('一级') && opts.includes('二级') && opts.includes('三级') && opts.includes('四级')) ok('下游字典 = 一/二/三/四级(四级统一)')
  else bad(`下游字典缺档:${JSON.stringify(opts)}`)
  const progCfg = await A.get('/api/px/getPanelConfig?panelCode=RD_PROGRESS')
  const progLv = ((progCfg?.data?.detail?.tabs || [])[0]?.fields || []).find((f) => f.dataName === '项目定级')
  if ((progLv?.options || []).includes('一级')) ok(`进度查询 项目定级 也含一级:${JSON.stringify(progLv?.options)}`)
  else bad(`进度查询字典未统一:${JSON.stringify(progLv?.options)}`)

  // ════ ⑦ 界面:侧栏按钮 + 弹窗四档 ════
  step('⑦ 界面:侧栏「项目定级」按钮 + 弹窗四档')
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-grade-'))
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
      for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3200); return } }
    }
    const shot = async (tag) => {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
      if (!r.result?.data) return null
      const f = path.join(SHOTS, `grade-${tag}.png`)
      fs.writeFileSync(f, Buffer.from(r.result.data, 'base64'))
      return f
    }
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1500, deviceScaleFactor: 1, mobile: false })
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_token', ${JSON.stringify(admin.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(admin.user))}); 'ok'`)
    await nav('about:blank')
    await nav(`${BASE}/#/panelx/list/RD_APPROVAL`); await sleep(2500)
    await ev(`(function(){ var ds=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.getBoundingClientRect().height>0})
      for (var i=0;i<ds.length;i++){ var t=(ds[i].innerText||'')
        if (t.indexOf('初始化')>=0){ var bs=[].slice.call(ds[i].querySelectorAll('button,span,a'))
          for (var j=0;j<bs.length;j++){ if((bs[j].textContent||'').trim()==='下次再说'){ bs[j].click(); return 'dismissed' } } } }
      return 'none' })()`)
    const btnInfo = await ev(`(function(){
      var all=[].slice.call(document.querySelectorAll('.as-side-btn')).filter(function(b){return b.offsetParent})
      var b=all.filter(function(x){ return (x.textContent||'').indexOf('项目定级')>=0 })[0]
      return b? { text:(b.textContent||'').trim(), disabled:b.classList.contains('disabled'), title:b.getAttribute('title')||'' } : null })()`)
    console.log('     侧栏按钮:' + JSON.stringify(btnInfo))
    if (btnInfo && btnInfo.text.indexOf('项目定级') >= 0) ok(`侧栏出现「项目定级」按钮(${btnInfo.text})${btnInfo.disabled ? ' —— 当前单不可定级(置灰)' : ' 且可点'}`)
    else bad('侧栏没有「项目定级」按钮')
    const opened = await ev(`(function(){
      var all=[].slice.call(document.querySelectorAll('.as-side-btn')).filter(function(b){return b.offsetParent})
      var b=all.filter(function(x){ return (x.textContent||'').indexOf('项目定级')>=0 })[0]
      if(!b) return 'NO_BTN'; b.click(); return 'CLICKED' })()`)
    await sleep(1000)
    const dlg = await ev(`(function(){
      var ds=[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.getBoundingClientRect().height>0})
      var d=ds[ds.length-1]; if(!d) return null
      return { title:(d.querySelector('.el-dialog__title')||{}).textContent||'',
               radios:[].slice.call(d.querySelectorAll('.el-radio-button')).map(function(x){return (x.textContent||'').trim()}),
               text:(d.innerText||'').replace(/\\s+/g,' ').slice(0,160) } })()`)
    console.log(`     弹窗(点击=${opened}):` + JSON.stringify(dlg))
    if (dlg && dlg.title.includes('项目定级') && ['一级', '二级', '三级', '四级'].every((x) => (dlg.radios || []).includes(x))) ok('弹窗四档齐全:一/二/三/四级')
    else bad(`弹窗档位不符:${JSON.stringify(dlg?.radios)}`)
    const shotFile = await shot('dialog')
    console.log(`     截图:${shotFile}`)
  } finally {
    if (ws) try { ws.close() } catch { /* ignore */ }
    edge.kill()
  }

  fs.writeFileSync(CLEANUP, `/* 探针清理:立项申请项目定级验收(_probe-approval-grade.cjs) */
USE HSDZ_MES; SET NOCOUNT ON;
DECLARE @docs TABLE (no nvarchar(120) PRIMARY KEY);
INSERT INTO @docs (no) SELECT 单据编号 FROM rd_approval WHERE 文档编号 = N'${DOCNO}';
DELETE FROM yj_message        WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM yj_form_approval  WHERE panel_code = N'RD_APPROVAL' AND form_no IN (SELECT no FROM @docs);
DELETE FROM yj_doc_modify_log WHERE panel_code = N'RD_APPROVAL' AND doc_no IN (SELECT no FROM @docs);
DELETE FROM yj_doc_status     WHERE panel_code = N'RD_APPROVAL' AND doc_no IN (SELECT no FROM @docs);
DELETE FROM rd_approval_detail WHERE 单据编号 IN (SELECT no FROM @docs);
DELETE FROM rd_approval        WHERE 单据编号 IN (SELECT no FROM @docs);
SELECT N'立项申请残留' AS 检查, CAST(COUNT(*) AS nvarchar) AS n FROM rd_approval WHERE 文档编号 = N'${DOCNO}';
`, 'utf8')
  console.log(`\n  --   清理 SQL:${CLEANUP}(单号 ${no} / 文档编号 ${DOCNO})`)
  console.log(failed ? `\n${failed} 项断言失败` : '\nALL PASSED')
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('探针异常:', e.message); process.exit(1) })
