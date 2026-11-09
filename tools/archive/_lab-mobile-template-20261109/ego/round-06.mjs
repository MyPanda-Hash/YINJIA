// 「测试日期」在手机上必须是日期选择器(不是纯文本)
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
await page.click('css:.labm-field .el-select >> nth=0')
await page.waitForTimeout(1100)
const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')].map((e) => (e.textContent || '').trim()))
const i = opts.findIndex((t) => t.includes('除汞'))
await page.click(`css:.el-select-dropdown__item >> nth=${i}`)
await page.waitForTimeout(2200)
// 展开第 1 行
const open = await page.evaluate(() => !!(document.querySelector('.labm-drow-body')?.offsetParent))
if (!open) { await page.click('css:.labm-drow-head >> nth=0'); await page.waitForTimeout(1000) }

const s = await page.evaluate(() => {
  const row = document.querySelector('.labm-drow-body')
  const fields = [...(row?.querySelectorAll('.labm-field') || [])]
  return fields.slice(0, 4).map((el) => ({
    label: (el.querySelector('label')?.textContent || '').trim(),
    hasDatePicker: !!el.querySelector('.el-date-editor'),
    inputType: el.querySelector('input')?.placeholder || '',
  }))
})
console.log('前4个字段=' + JSON.stringify(s, null, 1))
await page.evaluate(() => { document.querySelector('.labm-sec2')?.scrollIntoView({ block: 'start' }) })
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/07-测试日期.png` })

// 点一下日期框,确认弹出日期面板
try {
  await page.click('css:.labm-drow-body .el-date-editor input >> nth=0', { timeout: 4000 })
  await page.waitForTimeout(1200)
  const panel = await page.evaluate(() => !!document.querySelector('.el-picker-panel'))
  console.log('点日期框后弹出日期面板 = ' + panel)
  await page.screenshot({ path: `${OUT}/08-日期面板.png` })
} catch (e) { console.log('open date skip: ' + e.message) }
