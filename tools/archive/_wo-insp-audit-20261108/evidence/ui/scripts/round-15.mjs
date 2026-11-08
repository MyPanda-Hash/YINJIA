// round-15: 诊断 —— 为什么在 YJ_TEST 会话下点「确认提交审批」后测试库无写入/状态不变
const OUT = 'C:/Users/vigna/ego/wo-insp-audit-20261108'
const task = await taskSpace('wo-insp-audit-20261108')
const page = task.page('p1')
const lr = await fetch('http://127.0.0.1:8090/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})
const lj = await lr.json()
const token = lj.data.token, user = lj.data.user

await page.goto('http://localhost:5173/', { timeout: 30000 })
await page.waitForTimeout(2000)
await page.evaluate(({ token, user }) => {
  localStorage.setItem('mes_token', token)
  localStorage.setItem('mes_factory', JSON.stringify({ code: 'YJ_TEST', name: 'YINJIA-MES·测试库' }))
  localStorage.setItem('mes_user', JSON.stringify(user))
}, { token, user })
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP?docNo=ZC-2026-10-0126', { timeout: 30000 })
await page.waitForTimeout(1000)
await page.reload({ timeout: 30000 })
await page.waitForTimeout(5500)
await page.evaluate(() => { [...document.querySelectorAll('.el-overlay .el-dialog__headerbtn')].forEach((b) => b.click()) })
await page.waitForTimeout(500)

// 安装 fetch / XHR 记录器
await page.evaluate(() => {
  window.__calls = []
  const of = window.fetch
  window.fetch = async function (u, o) {
    const rec = { u: String(u), body: o && o.body ? String(o.body).slice(0, 400) : '', status: null, resp: null }
    window.__calls.push(rec)
    try {
      const r = await of.apply(this, arguments)
      rec.status = r.status
      try { rec.resp = (await r.clone().text()).slice(0, 500) } catch (e) { }
      return r
    } catch (e) { rec.error = String(e); throw e }
  }
})
const before = await page.evaluate(() => ({ docChip: [...document.querySelectorAll('.doc-chip')].map((e) => (e.textContent || '').trim()), docStatus: [...document.querySelectorAll('.doc-status')].map((e) => (e.textContent || '').trim()) }))
console.log('BEFORE=' + JSON.stringify(before))
await page.click('.approval-side .as-side-btn:has-text("提交审批")')
await page.waitForTimeout(1200)
await page.click('.el-message-box__btns button:has-text("确认提交审批")')
await page.waitForTimeout(4000)
const after = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    docChip: [...document.querySelectorAll('.doc-chip')].map(txt),
    docStatus: [...document.querySelectorAll('.doc-status')].map(txt),
    messages: [...document.querySelectorAll('.el-message')].map(txt),
    msgBoxTitle: txt(document.querySelector('.el-message-box__title')),
    calls: window.__calls || [],
  }
})
console.log('AFTER=' + JSON.stringify(after, null, 1))
await page.screenshot({ path: OUT + '/round-15-after-submit.png', fullPage: true })
console.log('ROUND15_DONE')
