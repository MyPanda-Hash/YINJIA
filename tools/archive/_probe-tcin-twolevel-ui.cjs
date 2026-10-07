/**
 * _probe-tcin-twolevel-ui.cjs — 特采单两级审批 **界面** 走查(2026-10-04)
 *
 * 验的是"用户能看到什么"(后端口径由 _probe-tcin-twolevel.mjs 的 41 项断言覆盖):
 *   ① 草稿态侧栏:只有「提交审批」,没有「审核」直审入口;
 *   ② 待二级审批态(超级管理员登录):侧栏出「批准通过 / 批准驳回」(不是「审批通过」);
 *   ③ 纸面底部「编制 / 审核 / 批准」三格 = **纯文本**(只读),不是输入框;
 *   ④ 特采理由行的「申请人」名格同口径只读(它绑的就是 编制人);
 *   ⑤ 编制/审核/批准三格的值来自审批流(柴善银 / 陈秀丽 / —)。
 *
 * 跑在测试账套(YJ_TEST → HSDZ_MES_TEST):正式库只录真实业务。
 * 用法:先起 8090 + 5173,再 node tools/archive/_probe-tcin-twolevel-ui.cjs
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PORT = 9351
const OUT = path.join(__dirname, '_shots')
const CANDS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
]
const EDGE = CANDS.find((p) => fs.existsSync(p))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const chk = (cond, m) => { if (cond) { pass++; console.log(`  [PASS] ${m}`) } else { fail++; console.log(`  [FAIL] ${m}`) } }

async function login(user, pwd) {
  const j = await (await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: user, password: pwd, factory: 'YJ_TEST' }),
  })).json()
  if (!(j.code === 0 || j.code === 200)) throw new Error(user + ' 登录失败 ' + JSON.stringify(j).slice(0, 160))
  return j.data
}
async function main() {
  if (!EDGE) throw new Error('找不到 Edge/Chrome')
  fs.mkdirSync(OUT, { recursive: true })
  const adminS = await login('admin', '123456')
  const cpS = await login('cp', '123456')
  const H = (s) => ({ 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + s.token })
  const cb = async (s, panel, button, fd) => await (await fetch(API + '/px/callButton', {
    method: 'POST', headers: H(s), body: JSON.stringify({ panelCode: panel, buttonName: button, formData: fd || {}, buttonParam: {} }),
  })).json()

  // ── 造一张「待二级审批」的特采单(测试账套) ──
  const mk = await cb(adminS, 'QC_TC_IN', '新增流程', { 单据日期: '2026-10-03', 产品名称: '两级审批界面走查' })
  const no = String(mk.data['编号'])
  await cb(adminS, 'QC_TC_IN', '提交审批', { 编号: no })
  const r1 = await cb(cpS, 'QC_TC_IN', '审批通过', { 编号: no, 审批意见: '一级:同意' })
  if (!(r1.code === 0 || r1.code === 200)) throw new Error('一级通过失败: ' + JSON.stringify(r1).slice(0, 200))
  console.log(`[前置] 测试账套单据 ${no} 已置为待二级审批(一级审核人=cp)`)

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'rd-tcin-ui-'))
  const edge = spawn(EDGE, [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1600,1200', 'about:blank',
  ], { stdio: 'ignore' })
  try {
    let target = null
    for (let i = 0; i < 40 && !target; i++) {
      await sleep(300)
      try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page') } catch { }
    }
    if (!target) throw new Error('CDP 未就绪')
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let id = 0
    const pend = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
    const send = (method, params) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
    const ev = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
      if (r.result && r.result.exceptionDetails) console.error('  [js] ' + JSON.stringify(r.result.exceptionDetails).slice(0, 200))
      return r.result && r.result.result ? r.result.result.value : undefined
    }

    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1200, deviceScaleFactor: 2, mobile: false })
    await send('Page.navigate', { url: `${FRONT}/#/login` })
    await sleep(2000)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(adminS.token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(adminS.user))});
localStorage.setItem('mes_factory', JSON.stringify({code:'YJ_TEST', name:'YINJIA-MES·测试库'}));
localStorage.setItem('mes_login_date','2026-10-03'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(600)
    await send('Page.navigate', { url: `${FRONT}/#/panelx/list/QC_TC_IN` })
    await sleep(4500)
    await ev(`(() => { const s=document.querySelector('.wz-skip'); if (s) s.click(); return 1 })()`)
    // 等列表真出数据(实测加载慢时 4s 只有 0 行 —— 轮询到有行为止,别用固定 sleep 赌)
    let rowCount = 0
    for (let i = 0; i < 20 && !rowCount; i++) {
      await sleep(900)
      rowCount = await ev(`document.querySelectorAll('.el-table__row').length`) || 0
    }
    console.log(`[界面] 列表行数 = ${rowCount}`)
    // 点中目标单据(按单据编号找行)
    const picked = await ev(`(() => {
      const rows = [...document.querySelectorAll('.el-table__row')]
      const hit = rows.find(r => r.innerText.includes(${JSON.stringify(no)}))
      if (!hit) return 'no-row:' + rows.length
      hit.click(); return 'ok'
    })()`)
    console.log(`[界面] 选中 ${no}: ${picked}`)
    // 等纸面渲染出底部落款三格为止
    let signCount = 0
    for (let i = 0; i < 20 && !signCount; i++) {
      await sleep(800)
      signCount = await ev(`document.querySelectorAll('.q-signrow .q-signitem').length`) || 0
    }
    console.log(`[界面] 底部落款格数 = ${signCount}`)
    await sleep(600)

    const info = await ev(`(() => {
      const side = [...document.querySelectorAll('.as-side-btns .as-side-btn')].map(e => e.textContent.trim())
      const signItems = [...document.querySelectorAll('.q-signrow .q-signitem')].map(e => ({
        label: (e.querySelector('.q-signitem-label')||{}).textContent || '',
        input: !!e.querySelector('input'),
        val: (e.querySelector('.q-signitem-val')||{}).textContent || '',
      }))
      const signInputs = document.querySelectorAll('.q-signrow input').length
      // 特采理由行的「申请人」签名格(绑 编制人)
      const applicant = [...document.querySelectorAll('.q-signline')].map(e => ({
        label: (e.querySelector('.q-sign-label')||{}).textContent || '',
        input: !!e.querySelector('input'),
        val: (e.querySelector('.q-sign-val')||{}).textContent || '',
      })).filter(x => x.label.includes('申请人'))
      const errs = [...document.querySelectorAll('.el-message--error')].map(e => e.textContent.trim())
      return { side, signItems, signInputs, applicant, errs,
               status: (document.querySelector('.doc-status')||{}).textContent || '' }
    })()`)
    console.log(JSON.stringify(info, null, 1))

    chk(info.side.includes('提交审批'), `① 侧栏有「提交审批」`)
    chk(!info.side.includes('审核'), `① 侧栏**无**「审核」直审入口(实际:${info.side.join(' / ')})`)
    chk(info.side.includes('批准通过') && info.side.includes('批准驳回'),
      `② 待二级审批态超级管理员看到「批准通过 / 批准驳回」`)
    chk(!info.side.includes('审批通过'), `② 二级节点不再显示「审批通过」`)
    chk(info.signInputs === 0, `③ 编制/审核/批准三格无输入框(实测 ${info.signInputs} 个)`)
    chk(info.signItems.length === 3, `③ 底部落款仍是三格:${info.signItems.map(x => x.label).join('')}`)
    const byLabel = Object.fromEntries(info.signItems.map(x => [x.label.replace(/[：:]/g, ''), x.val.trim()]))
    chk(byLabel['审核'] === '陈秀丽', `⑤ 「审核」格 = 一级审核人 陈秀丽(实际 "${byLabel['审核']}")`)
    chk(!byLabel['批准'], `⑤ 「批准」格仍空(等超级管理员批;实际 "${byLabel['批准']}")`)
    chk(info.applicant.length === 1 && info.applicant[0].input === false, `④ 特采理由行「申请人」格只读`)
    chk(!info.errs.length, `无前端报错(${info.errs.join('|') || '无'})`)

    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true })
    const f = path.join(OUT, `tcin-twolevel-${no}.png`)
    if (shot.result && shot.result.data) fs.writeFileSync(f, Buffer.from(shot.result.data, 'base64'))
    console.log('shot → ' + f)

    // ── 再走一遍:超级管理员点「批准通过」→ 界面显示「已审核」+ 批准格落名 ──
    const clicked = await ev(`(() => {
      const b = [...document.querySelectorAll('.as-side-btns .as-side-btn')].find(e => e.textContent.trim() === '批准通过')
      if (!b) return 'no-btn'
      b.click(); return 'ok'
    })()`)
    console.log(`[界面] 点「批准通过」: ${clicked}`)
    await sleep(1200)
    // 确认框:填意见后确认
    const confirmed = await ev(`(() => {
      const btn = [...document.querySelectorAll('.el-message-box__btns .el-button--primary')].pop()
      const ta = document.querySelector('.el-message-box__input textarea, .el-message-box__input input')
      if (ta) { ta.value = '批准:让步接收'; ta.dispatchEvent(new Event('input', { bubbles: true })) }
      if (btn) { btn.click(); return 'ok' }
      return 'no-dialog'
    })()`)
    console.log(`[界面] 批准确认框: ${confirmed}`)
    await sleep(3200)
    const after = await ev(`(() => {
      const signItems = [...document.querySelectorAll('.q-signrow .q-signitem')].map(e => ({
        label: ((e.querySelector('.q-signitem-label')||{}).textContent||'').replace(/[：:]/g,''),
        val: ((e.querySelector('.q-signitem-val')||{}).textContent||'').trim(),
      }))
      const byLabel = Object.fromEntries(signItems.map(x => [x.label, x.val]))
      return { status: (document.querySelector('.doc-status')||{}).textContent || '',
               byLabel,
               side: [...document.querySelectorAll('.as-side-btns .as-side-btn')].map(e => e.textContent.trim()),
               errs: [...document.querySelectorAll('.el-message--error')].map(e => e.textContent.trim()) }
    })()`)
    console.log(JSON.stringify(after, null, 1))
    chk(after.status.includes('已审核'), `⑥ 批准后界面状态=已审核(实际 "${after.status}")`)
    chk(after.byLabel['批准'] === '系统管理员', `⑥ 「批准」格 = 超级管理员(实际 "${after.byLabel['批准']}")`)
    chk(after.byLabel['编制'] === '系统管理员' && after.byLabel['审核'] === '陈秀丽',
      `⑥ 编制/审核两格保持:${after.byLabel['编制']} / ${after.byLabel['审核']}`)
    const shot2 = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true })
    const f2 = path.join(OUT, `tcin-twolevel-approved-${no}.png`)
    if (shot2.result && shot2.result.data) fs.writeFileSync(f2, Buffer.from(shot2.result.data, 'base64'))
    console.log('shot → ' + f2)

    ws.close()
    // 清理:探针单作废。待二级审批的单不能直接弃审(仅已审核可弃审)——
    // 先由超级管理员「批准驳回」退回草稿,再删除;已审核的则先弃审。
    const cur = await (await fetch(API + '/px/queryFormDataList', {
      method: 'POST', headers: H(adminS),
      body: JSON.stringify({ panelCode: 'QC_TC_IN', condition: { 单据编号: no }, pageNo: 1, pageSize: 5 }),
    })).json()
    const row = (cur.data?.list || []).find((r) => String(r['编号']) === no)
    const st = String(row?.['单据状态'] || '')
    if (st === '待二级审批' || st === '审批中') await cb(adminS, 'QC_TC_IN', '审批驳回', { 编号: no, 审批意见: '探针清理' })
    else if (st === '已审核') await cb(adminS, 'QC_TC_IN', '弃审', { 编号: no, 审批意见: '探针清理' })
    const del = await cb(adminS, 'QC_TC_IN', '删除', { 编号: no })
    console.log(`[清理] ${no}(状态 ${st})→ 删除:${del.code === 0 || del.code === 200 ? '已作废' : JSON.stringify(del).slice(0, 120)}`)
  } finally { edge.kill() }
  console.log(`\n═══ UI 走查:${pass} PASS / ${fail} FAIL ═══`)
  process.exit(fail ? 1 : 0)
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
