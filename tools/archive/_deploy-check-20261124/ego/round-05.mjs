// round-05: 生产 8090 验证「巡线表一填二」——新建空白草稿输入编号,看型号是否同步;不保存
const task = await taskSpace('deploy-smoke-20261124')
const page = task.page('p1')
const BASE = 'http://36.140.66.163:8090/'

await page.goto(BASE + '#/panelx/list/QC_LINE_PATROL', { timeout: 30000 })
await page.waitForTimeout(5000)

// 已加载的懒加载 chunk(证明前端是新包)
const chunks = await page.evaluate(() =>
  performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /QcLinePatrol|QcProcInsp/.test(n)))
console.log('CHUNKS ' + JSON.stringify(chunks))

// 点「新增」开空白草稿
const opened = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')]
  const b = btns.find((x) => /新增|新建/.test((x.textContent || '').trim()))
  if (!b) return 'no-new-button:' + btns.map((x) => (x.textContent || '').trim()).filter(Boolean).slice(0, 8).join(',')
  b.click()
  return 'clicked'
})
console.log('NEW ' + opened)
await page.waitForTimeout(4000)

// 打印纸面输入控件(找编号/型号)
const inputs = await page.evaluate(() =>
  [...document.querySelectorAll('input, textarea')].map((i, idx) => ({
    idx,
    ph: i.placeholder || '',
    val: i.value || '',
    cls: (i.className || '').slice(0, 60),
  })).slice(0, 24))
console.log('INPUTS ' + JSON.stringify(inputs))
