// round-16: 抓「确认提交审批」之后的提示语(为什么没发请求)——安装 MutationObserver 记录 ElMessage/DOM 提示
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
await page.waitForTimeout(800)
await page.reload({ timeout: 30000 })
await page.waitForTimeout(5500)
await page.evaluate(() => { [...document.querySelectorAll('.el-overlay .el-dialog__headerbtn')].forEach((b) => b.click()) })
await page.waitForTimeout(400)

// 观察者:记录所有出现过的 el-message / el-notification 文本 + fetch 调用
await page.evaluate(() => {
  window.__toasts = []
  window.__calls = []
  const push = (t) => { t = (t || '').replace(/\s+/g, ' ').trim(); if (t) window.__toasts.push(t) }
  const mo = new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) {
      if (!n || n.nodeType !== 1) continue
      if (n.matches && (n.matches('.el-message') || n.querySelector && n.querySelector('.el-message'))) push(n.textContent)
    }
  })
  mo.observe(document.body, { childList: true, subtree: true })
  const of = window.fetch
  window.fetch = function (u, o) { try { window.__calls.push({ u: String(u), body: o && o.body ? String(o.body).slice(0, 500) : '' }) } catch (e) { } return of.apply(this, arguments) }
  // 顺便把当前 cur 的关键字段抓出来(cur 在 Vue 实例里,取 DOM 上纸面显示值代替)
})
const pre = await page.evaluate(() => ({
  paper: (document.querySelector('.qr-sheet, .approval-layout') || document.body).innerText.replace(/\s+/g, ' ').slice(0, 500),
  side: [...document.querySelectorAll('.approval-side .as-side-btn')].filter((e) => e.offsetParent !== null).map((e) => (e.textContent || '').trim()),
}))
console.log('PRE=' + JSON.stringify(pre, null, 1))

await page.click('.approval-side .as-side-btn:has-text("提交审批")')
await page.waitForTimeout(1000)
await page.click('.el-message-box__btns button:has-text("确认提交审批")')
await page.waitForTimeout(900)
const immediate = await page.evaluate(() => ({ toasts: window.__toasts, calls: window.__calls, messages: [...document.querySelectorAll('.el-message')].map((e) => (e.textContent || '').trim()), docStatus: [...document.querySelectorAll('.doc-status')].map((e) => e.textContent.trim()) }))
console.log('IMMEDIATE=' + JSON.stringify(immediate, null, 1))
await page.screenshot({ path: OUT + '/round-16-after-confirm.png', fullPage: true })
await page.waitForTimeout(3500)
const later = await page.evaluate(() => ({ toasts: window.__toasts, calls: window.__calls.map((c) => c.u), docStatus: [...document.querySelectorAll('.doc-status')].map((e) => e.textContent.trim()) }))
console.log('LATER=' + JSON.stringify(later, null, 1))
console.log('ROUND16_DONE')
