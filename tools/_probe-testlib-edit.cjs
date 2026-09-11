/**
 * _probe-testlib-edit.cjs — 检验项目标准库「两个面板各管各的库 + 旧格式条目照样能编辑」端到端验收。
 *
 * 守的口径(2026-09-11 反转共库决定后):
 *   · 规格书 RD_SPEC_DOC 用 spec.test;出货检验计划表 RD_INSP_PLAN 用 insp.plan —— **不共用**;
 *   · 两个弹窗都保留「勾选一条自定义条目 → 编辑 → 表单带入 → 保存修改」;
 *   · 内容统一用规范结构(v=2,core/panel/testItemLib.js),历史**旧格式**条目读取兼容、
 *     编辑保存时升级成 v2 —— 所以旧数据不存在"改不动"一说。
 *
 * 用法: node tools/_probe-testlib-edit.cjs [API] [FRONT]
 *       默认 API=http://localhost:8090(后端),FRONT=http://localhost:5173(前端 dev server)。
 *       本机跑法(不带参数): node tools/_probe-testlib-edit.cjs
 *
 * 依赖:tools/node_modules/ws;headless Edge;sqlcmd(清理用,必须 -f 65001 否则中文条件静默不生效)。
 * 副作用与清理:探针只写 2 条带「探针」标记的库条目 + 1 张 RD_INSP_PLAN 草稿单,结束时全部清掉。
 */
const { spawn, execFileSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')

const API = process.argv[2] || 'http://localhost:8090'
const FRONT = process.argv[3] || 'http://localhost:5173'
const PORT = 9419
const EDGE = process.env.EDGE_BIN || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PANEL = 'RD_INSP_PLAN'
// 探针标记:内容里带「探针」,清理 SQL 按 LIKE N'%探针%' 精确兜底
const TAG = '探针' + Date.now().toString(36)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fails = []
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m) }
const info = (m) => console.log('     · ' + m)
const j = (s) => { try { return JSON.parse(s) } catch { return null } }

// ── sqlcmd(清理与复核):-f 65001 是硬要求,否则含中文的 SQL 静默不生效 ──
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
      if (e.code !== 'ENOENT') throw e // sqlcmd 跑起来了但报错 → 直接暴露,别吞
    }
  }
  throw lastErr
}
/** 两个库的当前行数(spec.test / insp.plan;库里没有该 lib_code 时记 0) */
function libCounts() {
  const out = sqlRaw("SELECT lib_code + '=' + CAST(COUNT(*) AS nvarchar(10)) FROM yj_std_lib WHERE lib_code IN (N'spec.test', N'insp.plan') GROUP BY lib_code;")
  const m = { 'spec.test': 0, 'insp.plan': 0 }
  for (const line of out.split(/\r?\n/)) {
    const hit = /^(spec\.test|insp\.plan)=(\d+)$/.exec(line.trim())
    if (hit) m[hit[1]] = Number(hit[2])
  }
  return m
}

async function main() {
  // ════ 0. 登录 + 接口封装 + 基线 ════
  const login = await (await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login?.data?.token
  if (!token) { console.error('登录失败', login); process.exit(1) }
  const api = async (p, opts = {}) => (await fetch(`${API}${p}`, { ...opts, headers: {
    'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(opts.headers || {}) } })).json()
  const listLib = async (lib, all) => ((await api(`/api/stdlib/list?lib=${lib}${all ? '&all=1' : ''}`))?.data) || []
  const docNos = async () => (((await api('/api/px/queryFormDataList', { method: 'POST', body: JSON.stringify({
    panelCode: PANEL, condition: {}, pageNo: 1, pageSize: 200 }) }))?.data?.list) || []).map((r) => r['编号'])

  const before = libCounts()
  console.log(`TAG=${TAG}  API=${API}  FRONT=${FRONT}`)
  console.log(`探针前行数: spec.test=${before['spec.test']}  insp.plan=${before['insp.plan']}\n`)

  // ════ ① 接口层:两边各写一条**旧格式**条目(就是要证明"旧数据也能编辑") ════
  const specLegacy = { sub: TAG + '规格书子项', req: TAG + '规格书要求', method: '游标卡尺', basis: '银嘉标准' }
  const inspLegacy = {
    控制项目: TAG + '出货项目', 质量控制内容: '外观', 检测仪器: '目视',
    控制标准及要求: TAG + '原控制标准', 检验: 'IQC', 不合格应对措施: '隔离该批并复核量具',
    检测频率: '每批次', 取样方式: '生产量*1%', 检验内容: TAG + '检验内容', 控制方法: '常规抽检',
  }
  const addSpec = await api('/api/stdlib/add', { method: 'POST', body: JSON.stringify({ lib: 'spec.test', item: '尺寸', content: JSON.stringify(specLegacy) }) })
  ok(addSpec?.code === 200, `①spec.test 写入旧格式条目成功(item=尺寸,${JSON.stringify(addSpec).slice(0, 50)})`)
  const addInsp = await api('/api/stdlib/add', { method: 'POST', body: JSON.stringify({ lib: 'insp.plan', item: '必测项', content: JSON.stringify(inspLegacy) }) })
  ok(addInsp?.code === 200, `②insp.plan 写入旧格式条目成功(item=必测项,${JSON.stringify(addInsp).slice(0, 50)})`)

  const inspRow = (await listLib('insp.plan', 1)).filter((r) => String(r.content).includes(TAG + '出货项目')).pop()
  const specRow = (await listLib('spec.test', 1)).filter((r) => String(r.content).includes(TAG + '规格书子项')).pop()
  const inspJ0 = j(inspRow?.content) || {}
  const specJ0 = j(specRow?.content) || {}
  ok(!!inspRow && inspJ0['控制项目'] === inspLegacy['控制项目'] && inspJ0['控制标准及要求'] === inspLegacy['控制标准及要求'] && !inspJ0.v,
    `③insp.plan 条目原样返回(仍是 10 中文键旧格式,库端没提前转换;id=${inspRow?.id})`)
  ok(!!specRow && specJ0.sub === specLegacy.sub && !specJ0.v,
    `④spec.test 条目原样返回(仍是 {sub,req,method,basis} 旧格式;id=${specRow?.id})`)
  if (!inspRow || !specRow) { console.error('探针条目没写进去,后续无法继续'); process.exit(1) }

  // ════ ② 不共用(本轮反转的核心断言) ════
  const inspAll = await listLib('insp.plan', 1)
  const specAll = await listLib('spec.test', 1)
  ok(inspAll.length > 0 && !inspAll.some((r) => String(r.content).includes(TAG + '规格书子项')),
    `⑤规格书的条目不出现在 insp.plan 列表(该库 ${inspAll.length} 条,无规格书那条)`)
  ok(specAll.length > 0 && !specAll.some((r) => String(r.content).includes(TAG + '出货项目')),
    `⑥出货计划的条目不出现在 spec.test 列表(该库 ${specAll.length} 条,无出货计划那条)`)

  // ════ ③ 界面:打开面板 → 勾选旧格式条目 → 编辑 → 表单带入 → 保存修改 ════
  // RD_INSP_PLAN 是单据面板,只有当前单据处于「草稿/修改中」才可编辑(draftEditable),
  // 所以先建一张草稿单(等同界面「新增」内部那一步),再进面板。
  const beforeDocs = await docNos()
  const draft = await api('/api/px/callButton', { method: 'POST', body: JSON.stringify({ panelCode: PANEL, buttonName: '保存', formData: {}, buttonParam: {} }) })
  const draftNo = draft?.data?.['编号'] || draft?.data?.formNo || ''
  info(`新建草稿单用于进入编辑态:${draftNo || JSON.stringify(draft).slice(0, 120)}`)

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-tle-'))
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
    const clickText = (t) => ev(`(function(){
      var all=[].slice.call(document.querySelectorAll('button,span,div'));
      for(var i=0;i<all.length;i++){var e=all[i];
        if((e.textContent||'').trim()===${JSON.stringify(t)}&&e.offsetParent){e.click();return e.tagName+'.'+String(e.className).slice(0,30)}}
      return '' })()`)
    // 弹窗定位:按标题文本 + 可见(height>0,排除 v-show 关掉的残留 dialog)
    const DLG = `[].slice.call(document.querySelectorAll('.el-dialog')).filter(function(d){return d.textContent.indexOf('检验项目标准库')>=0 && d.getBoundingClientRect().height>0}).pop()`
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1760, height: 1400, deviceScaleFactor: 1, mobile: false })
    await nav(`${FRONT}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await nav('about:blank') // 必须整页重载一次,否则被弹回登录页
    await nav(`${FRONT}/#/panelx/list/${PANEL}`)
    await ev(`(function(){var s=document.querySelector('.wz-skip'); if(s){s.click(); return 1} return 0})()`)
    await sleep(900)

    // 编辑态:表区入口按钮只在 editable(草稿/修改中)时渲染
    let entry = await ev(`(function(){
      var btns=[].slice.call(document.querySelectorAll('.rs-lib-btn'))
      var hit=null
      for(var i=0;i<btns.length;i++){
        var tr=btns[i].closest('tr'); var txt=tr?tr.textContent:''
        if(txt.indexOf('必测项')>=0 && txt.indexOf('型式')<0){hit=btns[i];break}
      }
      if(!hit && btns.length) hit=btns[0]
      if(!hit) return JSON.stringify({n:btns.length,ok:false})
      var bar=hit.closest('tr')
      hit.click()
      return JSON.stringify({n:btns.length,ok:true,bar:(bar?bar.textContent:'').trim().slice(0,30)})
    })()`)
    if (!/"ok":true/.test(String(entry))) {
      // 兜底:直接点「新增」(等同人工操作)再试
      const clicked = await clickText('新增')
      info(`首次未找到入口按钮(${entry}),已点「新增」(${clicked}),重试`)
      await sleep(3200)
      entry = await ev(`(function(){
        var btns=[].slice.call(document.querySelectorAll('.rs-lib-btn'))
        if(!btns.length) return JSON.stringify({n:0,ok:false})
        btns[0].click(); return JSON.stringify({n:btns.length,ok:true,viaNew:true}) })()`)
    }
    ok(/"ok":true/.test(String(entry)), `⑦面板进入编辑态,必测项表区能点到「从标准库勾选」入口(${entry})`)

    for (let i = 0; i < 25; i++) { await sleep(400); if (await ev(`!!(${DLG})`)) break }
    const dlgStat = await ev(`(function(){
      var dlg=${DLG}; if(!dlg) return JSON.stringify({err:'NO_DIALOG'})
      var rows=[].slice.call(dlg.querySelectorAll('.el-table__row'))
      var idx=-1
      for(var i=0;i<rows.length;i++){ if(rows[i].textContent.indexOf(${JSON.stringify(TAG + '出货项目')})>=0){idx=i;break} }
      return JSON.stringify({dialog:true,rows:rows.length,idx:idx,first:rows.length?rows[0].textContent.trim().replace(/\\s+/g,' ').slice(0,50):''})
    })()`)
    const dlgJ = j(dlgStat) || {}
    ok(dlgJ.idx >= 0, `⑧弹窗里列出了 insp.plan 的探针旧格式条目(表格 ${dlgJ.rows} 行,命中第 ${dlgJ.idx} 行;首行="${dlgJ.first}")`)

    // 勾选该行(只勾这一条 → 「编辑」才可用)
    const checked = await ev(`(function(){
      var dlg=${DLG}; if(!dlg) return 'NO_DIALOG'
      var rows=[].slice.call(dlg.querySelectorAll('.el-table__row'))
      for(var i=0;i<rows.length;i++){
        if(rows[i].textContent.indexOf(${JSON.stringify(TAG + '出货项目')})>=0){
          var cb=rows[i].querySelector('.el-checkbox__inner')||rows[i].querySelector('.el-checkbox')
          if(!cb) return 'NO_CHECKBOX'
          cb.click(); return 'CLICKED'
        }
      }
      return 'NO_ROW' })()`)
    await sleep(700)
    const editBtn = await ev(`(function(){
      var dlg=${DLG}; if(!dlg) return JSON.stringify({err:'NO_DIALOG'})
      var f=dlg.querySelector('.el-dialog__footer'); if(!f) return JSON.stringify({err:'NO_FOOTER'})
      var btns=[].slice.call(f.querySelectorAll('button'))
      var b=null; for(var i=0;i<btns.length;i++){ if(btns[i].textContent.trim()==='编辑'){b=btns[i];break} }
      if(!b) return JSON.stringify({err:'NO_EDIT_BTN',btns:btns.map(function(x){return x.textContent.trim()})})
      return JSON.stringify({text:b.textContent.trim(),disabled:!!b.disabled||b.classList.contains('is-disabled')}) })()`)
    const edJ = j(editBtn) || {}
    ok(edJ.disabled === false && edJ.text === '编辑', `⑨勾选该条后弹窗「编辑」按钮可用(${checked} / ${editBtn})`)

    await ev(`(function(){
      var dlg=${DLG}; var f=dlg&&dlg.querySelector('.el-dialog__footer'); if(!f) return 'NO_FOOTER'
      var btns=[].slice.call(f.querySelectorAll('button'))
      for(var i=0;i<btns.length;i++){ if(btns[i].textContent.trim()==='编辑'){btns[i].click();return 'CLICKED'} }
      return 'NO_BTN' })()`)
    await sleep(900)

    const formStat = await ev(`(function(){
      var dlg=${DLG}; if(!dlg) return JSON.stringify({err:'NO_DIALOG'})
      var f=dlg.querySelector('.lib-custom-form'); if(!f) return JSON.stringify({err:'NO_FORM'})
      var ctl=[].slice.call(f.querySelectorAll('input,textarea')).map(function(e){return {tag:e.tagName,ph:e.placeholder||'',v:e.value}})
      var btn=[].slice.call(f.querySelectorAll('button')).map(function(b){return b.textContent.trim()})
      return JSON.stringify({ctl:ctl,btn:btn}) })()`)
    const fd = j(formStat) || {}
    const got = (fd.ctl || []).map((x) => x.v)
    const LABELS = ['控制项目', '质量控制内容', '检测仪器', '控制标准及要求', '检测频率', '检验内容', '控制方法']
    const WANT = [inspLegacy['控制项目'], inspLegacy['质量控制内容'], inspLegacy['检测仪器'],
      inspLegacy['控制标准及要求'], inspLegacy['检测频率'], inspLegacy['检验内容'], inspLegacy['控制方法']]
    info('表单带入值: ' + JSON.stringify(got))
    info('条目原值  : ' + JSON.stringify(WANT))
    for (let i = 0; i < LABELS.length; i++) {
      ok(got[i] === WANT[i], `⑩.${i + 1} 表单「${LABELS[i]}」带入一致(实际 "${got[i]}" / 条目 "${WANT[i]}")`)
    }
    ok((fd.btn || []).includes('保存修改'), `⑪编辑态下按钮变为「保存修改」(${JSON.stringify(fd.btn)})`)

    // 改一个字段(控制标准及要求,textarea)→ 保存修改
    const NEWREQ = TAG + '改后控制标准'
    const setVal = await ev(`(function(){
      var dlg=${DLG}; if(!dlg) return 'NO_DIALOG'
      var f=dlg.querySelector('.lib-custom-form'); if(!f) return 'NO_FORM'
      var ta=f.querySelector('textarea'); if(!ta) return 'NO_TEXTAREA'
      var setter=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set
      setter.call(ta, ${JSON.stringify(NEWREQ)})
      ta.dispatchEvent(new Event('input',{bubbles:true}))
      return ta.value })()`)
    await sleep(300)
    const saved = await ev(`(function(){
      var dlg=${DLG}; if(!dlg) return 'NO_DIALOG'
      var f=dlg.querySelector('.lib-custom-form'); if(!f) return 'NO_FORM'
      var btns=[].slice.call(f.querySelectorAll('button'))
      for(var i=0;i<btns.length;i++){ if(btns[i].textContent.trim()==='保存修改'){btns[i].click();return 'CLICKED'} }
      return 'NO_BTN:'+btns.map(function(b){return b.textContent.trim()}).join(',') })()`)
    await sleep(1800)
    info(`改字段(控制标准及要求 → "${NEWREQ}"): setVal=${setVal} 点保存修改=${saved}`)

    const afterRow = (await listLib('insp.plan', 1)).find((r) => r.id === inspRow.id) || {}
    const afterJ = j(afterRow.content) || {}
    ok(String(afterRow.content).includes('"v":2'),
      `⑫界面「保存修改」后回读该条目已是规范结构 v2(content=${String(afterRow.content).slice(0, 110)}…)`)
    ok(afterJ.req === NEWREQ, `⑬改动的字段已生效(库中 req="${afterJ.req}" / 期望 "${NEWREQ}")`)
    const KEPT = [['group', '必测项'], ['name', inspLegacy['控制项目']], ['quality', inspLegacy['质量控制内容']],
      ['instrument', inspLegacy['检测仪器']], ['inspect', 'IQC'], ['measure', inspLegacy['不合格应对措施']],
      ['freq', inspLegacy['检测频率']], ['sampling', inspLegacy['取样方式']],
      ['content', inspLegacy['检验内容']], ['method', inspLegacy['控制方法']]]
    const lost = KEPT.filter(([k, v]) => afterJ[k] !== v)
    ok(lost.length === 0, `⑭原来其它字段一个没丢(${lost.length === 0
      ? '表单上没有的 ' + KEPT.length + ' 个字段全部保留'
      : '丢失/不符:' + JSON.stringify(lost.map(([k]) => k + '=' + JSON.stringify(afterJ[k])))})`)
    ok(!(await listLib('spec.test', 1)).some((r) => String(r.content).includes(TAG + '出货项目')),
      '⑮改完仍不串库(升级成 v2 的条目依然只属于 insp.plan,规格书库看不到)')

    ws.close(); ws = null
  } finally {
    if (ws) { try { ws.close() } catch { /* noop */ } }
    if (edge) edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch { /* noop */ }
  }

  // ════ ④ 清理:先软删(接口),再物理删(SQL),最后复核行数 ════
  const rm1 = await api('/api/stdlib/remove', { method: 'POST', body: JSON.stringify({ id: inspRow.id }) })
  const rm2 = await api('/api/stdlib/remove', { method: 'POST', body: JSON.stringify({ id: specRow.id }) })
  ok(rm1?.code === 200 && rm2?.code === 200, `⑯两条探针条目已停用(软删 ${inspRow.id}/${specRow.id}:${rm1?.code}/${rm2?.code})`)

  const delOut = sqlRaw("DELETE FROM yj_std_lib WHERE content LIKE N'%探针%'; SELECT COUNT(*) AS left_n FROM yj_std_lib WHERE content LIKE N'%探针%';")
  const leftRow = delOut.split(/\r?\n/).map((s) => s.trim()).find((s) => /^\d+$/.test(s))
  ok(leftRow === '0', `⑰SQL 物理删除后「探针」残留 0 行(实际 ${leftRow})`)

  const after = libCounts()
  ok(after['spec.test'] === before['spec.test'] && after['insp.plan'] === before['insp.plan'],
    `⑱两库行数回到探针前(spec.test ${before['spec.test']} → ${after['spec.test']};insp.plan ${before['insp.plan']} → ${after['insp.plan']})`)

  // 草稿单清理(不参与断言:探针只为进入编辑态而建,删不掉也不该把结论判成失败)
  const newDocs = (await docNos()).filter((n) => !beforeDocs.includes(n))
  for (const no of newDocs) {
    const del = await api('/api/px/callButton', { method: 'POST', body: JSON.stringify({ panelCode: PANEL, buttonName: '删除', formData: { 编号: no }, buttonParam: {} }) })
    info(`清理探针草稿单 ${no}:${JSON.stringify(del).slice(0, 80)}`)
  }
  if (!newDocs.length) info(`未发现新增草稿单(占位单编号 ${draftNo || '(未知)'} 可能已随页面离开被撤回)`)

  console.log(fails.length
    ? `\n结果: ${fails.length} 项失败\n` + fails.map((f) => '  - ' + f).join('\n')
    : '\n结果: 全部通过')
  process.exit(fails.length ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
