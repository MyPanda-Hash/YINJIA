/**
 * _probe-qcdocs-twolevel-ui.cjs — 质量单据两级审批 **界面** 走查(2026-10-04)
 *
 * 后端口径由 _probe-qcdocs-twolevel.mjs(8 张 × 21 项)覆盖,本探针只看"用户在界面上看到什么":
 *   ① 草稿/审批中各节点侧栏按钮的**文案与显隐**(草稿无「审核」直审入口;待二级审批出
 *      「批准通过 / 批准驳回」而不是「审批通过」,且只对超级管理员可见);
 *   ② 纸面底部「编制 / 审核 / 批准」三格 = **纯文本**(只读),不是输入框;
 *   ③ 三格的**值来自审批流**(提交人 / 一级审核人 / 超级管理员)。
 *
 * 跑在测试账套(YJ_TEST → HSDZ_MES_TEST):正式库只录真实业务。
 * 用法:先起 8090 + 5173,再 node tools/archive/_probe-qcdocs-twolevel-ui.cjs [面板码...]
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const FRONT = 'http://localhost:5173'
const API = 'http://localhost:8090/api'
const PORT = 9353
const OUT = path.join(__dirname, '_shots')
const CANDS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
]
const EDGE = CANDS.find((p) => fs.existsSync(p))
/** 面板 → 纸面底部「编制」格绑的列(须与后端 ButtonService.QC_DOC_PREPARER 一致) */
const PREP = {
  QC_TC_IN: '编制人', QC_LYB: '编制人', QC_SCY: '编制人', QC_BHG: '填写人',
  QC_BHC: '责任人', QC_BHZ: '责任人', QC_JJF: '检测人', QC_SCP: '责任人',
}
const ALL = Object.keys(PREP)
const argv = process.argv.slice(2).filter((a) => ALL.includes(a))
const LIST = argv.length ? argv : ['QC_TC_IN', 'QC_BHC', 'QC_LYB', 'QC_JJF']

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const chk = (cond, m) => { if (cond) { pass++ } else { fail++; console.log(`  [FAIL] ${m}`) } }

async function login(user, pwd) {
  const j = await (await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: user, password: pwd, factory: 'YJ_TEST' }),
  })).json()
  if (!(j.code === 0 || j.code === 200)) throw new Error(user + ' 登录失败')
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
  const okc = (j) => j.code === 0 || j.code === 200

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'rd-qcui-'))
  const edge = spawn(EDGE, [
    '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1600,1200', 'about:blank',
  ], { stdio: 'ignore' })
  const created = []
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
    ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
    const send = (method, params) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
    const ev = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
      return r.result && r.result.result ? r.result.result.value : undefined
    }
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1200, deviceScaleFactor: 2, mobile: false })
    await send('Page.navigate', { url: `${FRONT}/#/login` }); await sleep(2000)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(adminS.token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(adminS.user))});
localStorage.setItem('mes_factory', JSON.stringify({code:'YJ_TEST', name:'YINJIA-MES·测试库'}));
localStorage.setItem('mes_login_date','2026-10-04'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(600)

    for (const P of LIST) {
      const mk = await cb(adminS, P, '新增流程', {})
      if (!okc(mk)) { chk(false, `${P} 建单失败 ${JSON.stringify(mk).slice(0, 140)}`); continue }
      const no = String(mk.data['编号']); created.push([P, no])
      await cb(adminS, P, '提交审批', { 编号: no })
      const r1 = await cb(cpS, P, '审批通过', { 编号: no, 审批意见: '一级:同意' })
      if (!okc(r1)) { chk(false, `${P} 一级通过失败 ${JSON.stringify(r1).slice(0, 160)}`); continue }
      console.log(`\n═══ ${P} ${no}(编制格=${PREP[P]},当前 待二级审批)═══`)

      await send('Page.navigate', { url: `${FRONT}/#/panelx/list/${P}` }); await sleep(4000)
      await ev(`(() => { const s=document.querySelector('.wz-skip'); if (s) s.click(); return 1 })()`)
      let rows = 0
      for (let i = 0; i < 20 && !rows; i++) { await sleep(900); rows = await ev(`document.querySelectorAll('.el-table__row').length`) || 0 }
      await ev(`(() => { const r=[...document.querySelectorAll('.el-table__row')].find(x=>x.innerText.includes(${JSON.stringify(no)})); if(r) r.click(); return 1 })()`)
      let signs = 0
      for (let i = 0; i < 20 && !signs; i++) { await sleep(800); signs = await ev(`document.querySelectorAll('.q-signrow .q-signitem').length`) || 0 }
      await sleep(600)
      const info = await ev(`(() => {
        const signItems = [...document.querySelectorAll('.q-signrow .q-signitem')].map(e => ({
          label: ((e.querySelector('.q-signitem-label')||{}).textContent||'').replace(/[：:]/g,''),
          input: !!e.querySelector('input'),
          val: ((e.querySelector('.q-signitem-val')||{}).textContent||'').trim(),
        }))
        return { side: [...document.querySelectorAll('.as-side-btns .as-side-btn')].map(e => e.textContent.trim()),
                 signItems, signInputs: document.querySelectorAll('.q-signrow input').length,
                 status: (document.querySelector('.doc-status')||{}).textContent || '',
                 errs: [...document.querySelectorAll('.el-message--error')].map(e => e.textContent.trim()) }
      })()`)
      const byLabel = Object.fromEntries(info.signItems.map((x) => [x.label, x.val]))
      chk(info.side.includes('提交审批'), `${P} ① 侧栏有「提交审批」`)
      chk(!info.side.includes('审核'), `${P} ① 侧栏无「审核」直审入口(实际:${info.side.join('/')})`)
      chk(info.side.includes('批准通过') && info.side.includes('批准驳回'), `${P} ① 待二级审批出「批准通过/批准驳回」`)
      chk(!info.side.includes('审批通过'), `${P} ① 二级节点不再出现「审批通过」`)
      chk(info.status.includes('待二级审批'), `${P} ① 列表状态=待二级审批(实际 "${info.status}")`)
      chk(info.signInputs === 0 && info.signItems.length === 3, `${P} ② 落款三格为纯文本(输入框 ${info.signInputs} 个 / 格数 ${info.signItems.length})`)
      chk(byLabel['审核'] === '陈秀丽', `${P} ③ 「审核」格 = 一级审核人 陈秀丽(实际 "${byLabel['审核']}")`)
      chk(!byLabel['批准'], `${P} ③ 「批准」格仍空(实际 "${byLabel['批准']}")`)
      chk(!info.errs.length, `${P} 无前端报错(${info.errs.join('|')})`)
      const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true })
      const f = path.join(OUT, `qcdocs-${P}-${no}.png`)
      if (shot.result && shot.result.data) fs.writeFileSync(f, Buffer.from(shot.result.data, 'base64'))

      // 超级管理员点「批准通过」→ 已审核 + 批准格落名,审核格保持一级审核人
      await ev(`(() => { const b=[...document.querySelectorAll('.as-side-btns .as-side-btn')].find(e=>e.textContent.trim()==='批准通过'); if(b) b.click(); return 1 })()`)
      await sleep(1200)
      await ev(`(() => { const ta=document.querySelector('.el-message-box__input textarea, .el-message-box__input input');
        if (ta) { ta.value='批准:同意'; ta.dispatchEvent(new Event('input',{bubbles:true})) }
        const b=[...document.querySelectorAll('.el-message-box__btns .el-button--primary')].pop(); if(b) b.click(); return 1 })()`)
      await sleep(3200)
      const after = await ev(`(() => {
        const signItems = [...document.querySelectorAll('.q-signrow .q-signitem')].map(e => ({
          label: ((e.querySelector('.q-signitem-label')||{}).textContent||'').replace(/[：:]/g,''),
          val: ((e.querySelector('.q-signitem-val')||{}).textContent||'').trim() }))
        return { status: (document.querySelector('.doc-status')||{}).textContent || '',
                 byLabel: Object.fromEntries(signItems.map(x=>[x.label,x.val])),
                 errs: [...document.querySelectorAll('.el-message--error')].map(e => e.textContent.trim()) }
      })()`)
      chk(after.status.includes('已审核'), `${P} ④ 批准后界面状态=已审核(实际 "${after.status}")`)
      chk(after.byLabel['批准'] === '系统管理员', `${P} ④ 「批准」格 = 超级管理员(实际 "${after.byLabel['批准']}")`)
      chk(after.byLabel['审核'] === '陈秀丽', `${P} ④ 「审核」格保持一级审核人(实际 "${after.byLabel['审核']}")`)
      console.log(`   └ 9 + 3 项断言 · shot → ${path.basename(f)}`)
    }
    ws.close()
  } finally {
    edge.kill()
    for (const [P, no] of created) {
      const list = await (await fetch(API + '/px/queryFormDataList', {
        method: 'POST', headers: H(adminS),
        body: JSON.stringify({ panelCode: P, condition: { 单据编号: no }, pageNo: 1, pageSize: 5 }),
      })).json()
      const st = String(((list.data?.list || []).find((r) => String(r['编号']) === no) || {})['单据状态'] || '')
      if (st === '待二级审批' || st === '审批中') await cb(adminS, P, '审批驳回', { 编号: no, 审批意见: '探针清理' })
      else if (st === '已审核') await cb(adminS, P, '弃审', { 编号: no, 审批意见: '探针清理' })
      const del = await cb(adminS, P, '删除', { 编号: no })
      console.log(`[清理] ${P} ${no}(${st})→ ${okc(del) ? '已作废' : JSON.stringify(del).slice(0, 120)}`)
    }
  }
  console.log(`\n═══ UI 走查:${pass} PASS / ${fail} FAIL ═══`)
  process.exit(fail ? 1 : 0)
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
