// 「删除行」弹窗防误触:点删除 → 弹确认;取消不删;确认才删
const task = await taskSpace('lab-mobile-template-20261109')
const page = task.page('p1')
const OUT = 'C:/Users/Lenovo/ego/lab-mobile-template-20261109'
const base = 'http://localhost:5173'

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { /* ignore */ }

await page.goto(base + '/#/panelx/list/MOBILE_LAB_SPIKE_WATER', { timeout: 40000 })
await page.waitForTimeout(7000)
// 选测试项目,让明细有内容好看出"第几行 + 摘要"
await page.click('css:.labm-field .el-select >> nth=0')
await page.waitForTimeout(1000)
const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')].map((e) => (e.textContent || '').trim()))
await page.click(`css:.el-select-dropdown__item >> nth=${opts.findIndex((t) => t.includes('除汞'))}`)
await page.waitForTimeout(1800)

// 加一行,凑成两行(删第一行时才看得出是"第 1 行")
await page.click('css:.labm-sec2 .el-button')
await page.waitForTimeout(1000)
const before = await page.evaluate(() => document.querySelectorAll('.labm-drow').length)
console.log('删除前行数=' + before)

// 点第 1 行的「删除行」→ 应弹确认框
await page.click('css:.labm-drow-head .el-button >> nth=0')
await page.waitForTimeout(1200)
const dlg = await page.evaluate(() => {
  const box = document.querySelector('.el-message-box')
  return {
    shown: !!box,
    title: (box?.querySelector('.el-message-box__title')?.textContent || '').trim(),
    msg: (box?.querySelector('.el-message-box__message')?.textContent || '').replace(/\s+/g, ' ').trim(),
    btns: [...(box?.querySelectorAll('.el-message-box__btns button') || [])].map((b) => (b.textContent || '').trim()),
  }
})
console.log('弹窗=' + JSON.stringify(dlg))
await page.screenshot({ path: `${OUT}/09-删除行弹窗.png` })

// ① 取消:行数不变
await page.click('css:.el-message-box__btns button >> nth=0')
await page.waitForTimeout(900)
const afterCancel = await page.evaluate(() => document.querySelectorAll('.labm-drow').length)
console.log('取消后行数=' + afterCancel + '(应等于' + before + ')')

// ② 再点一次 → 确认删除:行数 -1
await page.click('css:.labm-drow-head .el-button >> nth=0')
await page.waitForTimeout(1000)
const btns = await page.evaluate(() => [...document.querySelectorAll('.el-message-box__btns button')].map((b) => (b.textContent || '').trim()))
const okIdx = btns.findIndex((t) => t.includes('删除'))
console.log('按钮=' + JSON.stringify(btns) + ' 确认按钮 idx=' + okIdx)
await page.click(`css:.el-message-box__btns button >> nth=${okIdx}`)
await page.waitForTimeout(1000)
const afterOk = await page.evaluate(() => document.querySelectorAll('.labm-drow').length)
console.log('确认后行数=' + afterOk + '(应为 ' + (before - 1) + ')')
await page.screenshot({ path: `${OUT}/10-删除后.png` })
