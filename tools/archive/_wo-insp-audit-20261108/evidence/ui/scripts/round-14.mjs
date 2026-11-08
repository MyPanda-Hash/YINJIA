// round-14: **测试库(YJ_TEST)** 界面取证 —— QC_PROC_INSP/ZC-2026-10-0126
// 提交审批 → 一级审批通过 → 二级批准通过 → 弃审,逐步 fullPage 截图。
// 防串库:进页面后**主动把 localStorage 登录态换成 YJ_TEST token**,且每次业务点击前校验 claims.factory==='YJ_TEST'。
const OUT = 'C:/Users/vigna/ego/wo-insp-audit-20261108'
const task = await taskSpace('wo-insp-audit-20261108')
const page = task.page('p1')
const BASE = 'http://localhost:5173'

// ① 用 Node 侧登录拿 YJ_TEST token(与后端 /api/auth/login 同一口径)
const lr = await fetch('http://127.0.0.1:8090/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})
const lj = await lr.json()
if (!lj?.data?.token) throw new Error('YJ_TEST 登录失败: ' + JSON.stringify(lj).slice(0, 300))
const token = lj.data.token
const user = lj.data.user

async function normalWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) { console.log('window skip: ' + e.message) }
}
/** 每次业务点击前调用:确认当前标签页 token 是 YJ_TEST(防 Lead 在我操作期间又切成正式库) */
async function assertTestDb(tag) {
  const d = await page.evaluate(() => {
    const tok = localStorage.getItem('mes_token') || ''
    let factory = null
    try { const p = tok.split('.')[1]; factory = JSON.parse(decodeURIComponent(escape(atob(p.replace(/-/g, '+').replace(/_/g, '/'))))).factory } catch (e) { factory = 'decode-error' }
    return { factory, mesFactory: localStorage.getItem('mes_factory') }
  })
  if (d.factory !== 'YJ_TEST') throw new Error(`[串库防护] ${tag}: 当前 token factory=${d.factory},不是 YJ_TEST —— 中止,不做任何点击`)
  console.log('[guard] ' + tag + ' factory=YJ_TEST ✓')
}
const state = async (tag) => {
  const d = await page.evaluate(() => {
    const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
    return {
      docStatus: [...document.querySelectorAll('.doc-status')].filter((e) => e.offsetParent !== null).map(txt),
      sideApproval: [...document.querySelectorAll('.approval-side .as-side-btn')]
        .filter((el) => el.offsetParent !== null).map((el) => ({ text: txt(el), disabled: el.classList.contains('disabled') }))
        .filter((x) => ['提交审批', '审批通过', '批准通过', '审批驳回', '批准驳回', '弃审', '审批情况'].includes(x.text)),
      msgBoxTitle: txt(document.querySelector('.el-message-box__title')),
      msgBoxBtns: [...document.querySelectorAll('.el-message-box__btns button')].map(txt),
    }
  })
  console.log('--- ' + tag + ' ---\n' + JSON.stringify(d, null, 1))
  return d
}
const shot = async (n) => { await normalWindow(); await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300); await page.screenshot({ path: OUT + '/' + n + '.png', fullPage: true }); console.log('[shot] ' + n) }

// ② 打开任意页 → 覆盖 localStorage 为 YJ_TEST 会话 → reload
await page.goto(BASE + '/', { timeout: 30000 })
await page.waitForTimeout(2500)
await page.evaluate(({ token, user }) => {
  localStorage.setItem('mes_token', token)
  localStorage.setItem('mes_factory', JSON.stringify({ code: 'YJ_TEST', name: 'YINJIA-MES·测试库' }))
  localStorage.setItem('mes_user', JSON.stringify(user))
}, { token, user })
await page.goto(BASE + '/#/panelx/list/QC_PROC_INSP?docNo=ZC-2026-10-0126', { timeout: 30000 })
await page.waitForTimeout(1500)
await page.reload({ timeout: 30000 })
await page.waitForTimeout(5500)
if (!(await page.evaluate(() => (document.body.innerText || '').includes('ZC-2026-10-0126')))) {
  await page.goto(BASE + '/#/panelx/list/QC_PROC_INSP?docNo=ZC-2026-10-0126', { timeout: 30000 })
  await page.waitForTimeout(4000)
}
await page.evaluate(() => { [...document.querySelectorAll('.el-overlay .el-dialog__headerbtn')].forEach((b) => b.click()) })
await page.waitForTimeout(500)
await assertTestDb('开局')
const s0 = await state('① 初态(测试库,应为 草稿)')
await shot('round-14-01-draft-testdb')

// ③ 提交审批
await assertTestDb('点提交审批前')
await page.click('.approval-side .as-side-btn:has-text("提交审批")')
await page.waitForTimeout(1200)
await state('② 提交审批确认框')
await shot('round-14-02-submit-dialog')
await page.click('.el-message-box__btns button:has-text("确认提交审批")')
await page.waitForTimeout(3300)
const s2 = await state('③ 提交后(应为 审批中)')
await shot('round-14-03-in-approval')

// ④ 一级审批通过
await assertTestDb('点一级审批通过前')
await page.click('.approval-side .as-side-btn.primary:has-text("审批通过")')
await page.waitForTimeout(1200)
await state('④ 一级审批确认框')
await shot('round-14-04-approve1-dialog')
await page.click('.el-message-box__btns button:has-text("确认审批通过")')
await page.waitForTimeout(3300)
const s4 = await state('⑤ 一级通过后(应为 待二级审批)')
await shot('round-14-05-wait-l2')

// ⑤ 二级批准通过(确认框按钮文案仍是「确认审批通过」)
await assertTestDb('点二级批准通过前')
await page.click('.approval-side .as-side-btn.primary:has-text("批准通过")')
await page.waitForTimeout(1200)
await state('⑥ 二级批准确认框')
await shot('round-14-06-approve2-dialog')
await page.click('.el-message-box__btns button:has-text("确认审批通过")')
await page.waitForTimeout(3300)
const s6 = await state('⑦ 批准后(应为 已审核)')
await shot('round-14-07-audited')

// ⑥ 弃审(反审核)
await assertTestDb('点弃审前')
await page.click('.approval-side .as-side-btn:has-text("弃审")')
await page.waitForTimeout(1200)
await state('⑧ 弃审确认框')
await shot('round-14-08-unaudit-dialog')
await page.click('.el-message-box__btns button:has-text("确定")')
await page.waitForTimeout(3300)
const s8 = await state('⑨ 弃审后(应为 草稿)')
await shot('round-14-09-back-to-draft')

const st = (x) => (x.docStatus || []).join(',')
const flow = { 初态: st(s0), 提交后: st(s2), 一级通过后: st(s4), 批准后: st(s6), 弃审后: st(s8) }
console.log('FLOW=' + JSON.stringify(flow))
console.log(st(s2) === '审批中' && st(s4) === '待二级审批' && st(s6) === '已审核' && st(s8) === '草稿' ? 'FLOW_RESULT=PASS' : 'FLOW_RESULT=FAIL')
console.log('ROUND14_DONE')
