// round-10:加一行 → 打开「检查频率」下拉,取证候选条目
const task = await taskSpace('insp-plan-bottom-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/RD_INSP_PLAN', { timeout: 60000 })
await page.waitForTimeout(5000)
// 打开刚建的草稿?先看当前是否有行;没有就加一行
let info = await page.evaluate(() => {
  const dt = document.querySelector('table.rs-dt')
  return { rows: dt ? dt.querySelectorAll('tbody tr').length : 0 }
})
if (!info.rows) {
  await page.evaluate(() => {
    const add = [...document.querySelectorAll('.rs-add, .as-side-btn')].find((e) => (e.textContent || '').includes('新增数据记录行'))
    if (add) add.click()
  })
  await page.waitForTimeout(1500)
  info = await page.evaluate(() => {
    const dt = document.querySelector('table.rs-dt')
    return { rows: dt ? dt.querySelectorAll('tbody tr').length : 0 }
  })
}
console.log('rows:', JSON.stringify(info))
// 点明细行里的「检查频率」下拉
const clicked = await page.evaluate(() => {
  const td = [...document.querySelectorAll('table.rs-dt tbody td')].find((c) => c.querySelector('.el-select'))
  if (!td) return false
  const wrap = td.querySelector('.el-select__wrapper') || td.querySelector('.el-select')
  wrap.click()
  return true
})
console.log('freq select clicked:', clicked)
await page.waitForTimeout(1200)
console.log(JSON.stringify(await page.evaluate(() => {
  const pools = [...document.querySelectorAll('.el-select-dropdown')].filter((p) => p.offsetParent !== null || p.getBoundingClientRect().height > 0)
  return {
    optionTexts: pools.map((p) => [...p.querySelectorAll('.el-select-dropdown__item')].map((e) => (e.textContent || '').trim())),
    allVisibleDropItems: [...document.querySelectorAll('.el-select-dropdown__item')].filter((e) => e.getBoundingClientRect().height > 0).map((e) => (e.textContent || '').trim()),
  }
}), null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/insp-plan-bottom-20261117/round-10.png' })
