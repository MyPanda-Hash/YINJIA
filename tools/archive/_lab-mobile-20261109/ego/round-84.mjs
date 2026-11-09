const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
// 8090(jar 内 static)复验第三轮:折叠 + 大按钮 + 附件列表(无图片预览)+ 审批中禁删
await page.goto('http://127.0.0.1:8090/#/login', { timeout: 30000 })
await page.waitForTimeout(1500)
await page.evaluate(async () => {
  const res = await fetch('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })
  const j = await res.json()
  localStorage.setItem('mes_token', j.data.token)
  localStorage.setItem('mes_user', JSON.stringify(j.data.user || {}))
  localStorage.setItem('mes_factory', JSON.stringify({ code: 'YJ_TEST', name: 'YINJIA-MES·测试库' }))
})
await page.goto('http://127.0.0.1:8090/#/panelx/list/MOBILE_LAB_EQUIP_USE', { timeout: 30000 })
await page.reload({ timeout: 40000 })
await page.waitForTimeout(7000)
await page.click('.labm-line >> nth=0')
await page.waitForTimeout(3500)
const st = await page.evaluate(() => ({
  doc: document.querySelector('.labm-doc')?.textContent?.trim() || '',
  rows: document.querySelectorAll('.labm-drow').length,
  open: [...document.querySelectorAll('.labm-drow-body')].filter((e) => e.offsetParent !== null).length,
  bigBtnH: [...document.querySelectorAll('.labm-sec .el-button')].map((b) => Math.round(b.getBoundingClientRect().height)),
}))
console.log(JSON.stringify(st))
await page.click('css:.labm-drow-head >> nth=0')
await page.waitForTimeout(1000)
const exp = await page.evaluate(() => ({
  att: [...document.querySelectorAll('.labm-att')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  imgs: document.querySelectorAll('.labm-drow-body img').length,
}))
console.log('expanded=' + JSON.stringify(exp))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-84-8090.png' })
