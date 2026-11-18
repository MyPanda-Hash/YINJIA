// round-08: 本表 19/20(只剩 1 个位置)—— 父目录要 2 位 ⇒ 应给出「只剩 1 个位置」提示并禁用「添加」
const task = await taskSpace('extfield-tab-cap-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REQ_SERIES', { timeout: 30000 })
await page.waitForTimeout(8000)
await page.evaluate(() => {
  const n = [...document.querySelectorAll('.qc-insp-sheet *')]
    .find((e) => e.children.length <= 1 && (e.textContent || '').replace(/\s+/g, ' ').trim().replace(/^[^\w\u4e00-\u9fa5]+/, '') === '自定义字段')
  if (n) n.click()
})
await page.waitForTimeout(3500)
const st = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((el) => (el.textContent || '').includes('字段管理'))
  if (!d) return null
  const btn = [...d.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '添加')
  return {
    summary: (d.querySelector('.fm-summary')?.textContent || '').trim(),
    chip: (d.querySelector('.fm-tabusage-item')?.textContent || '').trim(),
    alerts: [...d.querySelectorAll('.el-alert__title')].map((e) => e.textContent.replace(/\s+/g, ' ').trim()),
    addDisabled: btn ? btn.disabled : null,
  }
})
console.log('19/20 状态 =', JSON.stringify(st, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/extfield-tab-cap-20261117/round-08-pairshort.png' })
console.log('done round-08')
