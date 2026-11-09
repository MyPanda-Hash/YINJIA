// round-07b — 诊断:当前页面状态(是否登录/权限/待排产行数/按钮)
const task = await taskSpace('plandate-guard-20261109')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/prod/plan/scheduleBoard', { timeout: 30000 })
await page.waitForTimeout(6000)
const info = await page.evaluate(() => {
  const t = document.querySelectorAll('.el-table')
  const poolRows = t[0] ? t[0].querySelectorAll('.el-table__body-wrapper tbody tr').length : -1
  return {
    href: location.href,
    hash: location.hash,
    token: (localStorage.getItem('mes_token') || '').slice(0, 20),
    hasPasswordInput: !!document.querySelector('input[type="password"]'),
    buttons: [...document.querySelectorAll('button')].map((b) => ({ t: (b.textContent || '').replace(/\s+/g, ' ').trim(), d: b.disabled })),
    poolRows,
    bodyHead: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 400),
  }
})
console.log(JSON.stringify(info, null, 2))
