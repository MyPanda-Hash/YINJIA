// round-06:诊断报工记录页面为何未渲染查询区
const task = await taskSpace('wo-report-query-input-20261113')
const page = task.page('p1')
const st = await page.evaluate(() => ({
  hash: location.hash,
  url: location.href,
  body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 1200),
  hasPanelxList: !!document.querySelector('.panelx-list'),
  fieldsEls: document.querySelectorAll('.fields').length,
  udl: document.querySelectorAll('.fields.udl-fields').length,
  toast: [...document.querySelectorAll('.el-message, .el-message__content')].map((e) => (e.textContent || '').trim()).slice(0, 5),
  token: (localStorage.getItem('mes_token') || '').slice(0, 20),
}))
console.log('STATE ' + JSON.stringify(st, null, 2))
await page.waitForTimeout(3000)
const st2 = await page.evaluate(() => ({
  hash: location.hash,
  body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 1500),
  hasPanelxList: !!document.querySelector('.panelx-list'),
  fieldsEls: document.querySelectorAll('.fields').length,
  rows: document.querySelectorAll('.el-table__body tbody tr').length,
}))
console.log('STATE2 ' + JSON.stringify(st2, null, 2))
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_query-input-20261113/ego/round-06.png' })
console.log('DONE round-06')
