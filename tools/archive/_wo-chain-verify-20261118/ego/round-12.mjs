// round-12: 8090(正式库)验证「今日列一定出列」:工单排产 → 组装1(老厂) → 读日期列头
const task = await taskSpace('yinjia-three-fixes-20261118')
const page = task.page('p1')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await page.goto('http://127.0.0.1:8090/#/prod/plan/workOrderBoard', { timeout: 60000 })
await page.reload({ timeout: 60000 })
await sleep(6000)
const logged = await page.evaluate(() => !!document.querySelector('.wb-page'))
console.log('logged=' + logged)
if (!logged) {
  await page.evaluate(() => { localStorage.clear() })
  await page.goto('http://127.0.0.1:8090/#/login', { timeout: 60000 })
  await page.reload({ timeout: 60000 })
  await sleep(2500)
  await page.fill('input[placeholder="请输入登录账号"]', 'admin')
  await page.fill('input[placeholder="请输入登录密码"]', '123456')
  await page.click('text="进入系统"')
  await sleep(4500)
  await page.goto('http://127.0.0.1:8090/#/prod/plan/workOrderBoard', { timeout: 60000 })
  await page.reload({ timeout: 60000 })
  await sleep(6000)
}
await page.evaluate(() => {
  const line = [...document.querySelectorAll('.wb-line')].find((el) => (el.textContent || '').includes('组装1(老厂)'))
  if (line) line.click()
})
await sleep(4500)
const info = await page.evaluate(() => {
  const heads = [...document.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').replace(/\s+/g, ' ').trim())
  const dateHeads = heads.filter((t) => /\d{2}-\d{2}/.test(t))
  const rows = [...document.querySelectorAll('.el-table__body tr')].map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 90))
  return { line: (document.querySelector('.wb-ctx-label') || {}).textContent, dateHeads, rows, today: new Date().toISOString().slice(0, 10) }
})
console.log(JSON.stringify(info, null, 2))
const todayHead = info.dateHeads.find((h) => h.startsWith('11-18'))
const todayCells = await page.evaluate(() => {
  const heads = [...document.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').replace(/\s+/g, ' ').trim())
  const ci = heads.findIndex((t) => t.startsWith('11-18'))
  if (ci < 0) return null
  return [...document.querySelectorAll('.el-table__body tr')].map((tr) => {
    const td = tr.querySelectorAll('td')[ci]
    if (!td) return null
    const cell = td.querySelector('.dp-plan, .dp-out')
    return { text: (td.textContent || '').trim(), cls: cell ? cell.className : '', title: cell ? cell.getAttribute('title') : '' }
  })
})
console.log('11-18 列各格=' + JSON.stringify(todayCells, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await sleep(600)
  await page.screenshot({ path: 'C:/Users/vigna/ego/yinjia-three-fixes-20261118/round-12-today-col.png' })
} catch (e) { console.log('shot skip: ' + e.message) }
