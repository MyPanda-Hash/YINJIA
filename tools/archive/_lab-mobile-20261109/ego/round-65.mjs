const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_LAB_EQUIP_USE', { timeout: 30000 })
await page.reload({ timeout: 40000 })
await page.waitForTimeout(6000)
// 打开 EU-2026-11-0003
await page.click('.labm-line >> nth=0')
await page.waitForTimeout(3000)
// 加一行 + 填两格
await page.click('loc=role:button[name="加一行"]')
await page.waitForTimeout(600)
await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.labm-drow')]
  const row = rows[rows.length - 1]
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  for (const f of row.querySelectorAll('.labm-field')) {
    const label = f.querySelector('label')?.textContent?.trim() || ''
    const input = f.querySelector('input')
    if (!input) continue
    if (label.includes('测试项目')) setVal(input, '复现500-追加行')
    if (label.includes('使用人')) setVal(input, '王五')
  }
})
// 最后一行拍照
const btns = await page.evaluate(() => document.querySelectorAll('.labm-rowphoto .el-button').length)
await page.click(`css:.labm-rowphoto .el-button >> nth=${Math.max(0, btns - 1)}`)
await page.waitForTimeout(500)
await page.setInputFiles('css:input[type=file]', 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/test-photo.png')
await page.waitForTimeout(1200)
await page.click('loc=role:button[name="保存草稿"]')
await page.waitForTimeout(12000)
const st = await page.evaluate(() => ({
  doc: document.querySelector('.labm-doc')?.textContent?.trim() || '',
  err: document.querySelector('.labm-err')?.textContent?.trim() || '',
  rows: document.querySelectorAll('.labm-drow').length,
  perRow: [...document.querySelectorAll('.labm-rowphoto')].map((e) => ({ imgs: e.querySelectorAll('.labm-photo img').length, pending: e.querySelectorAll('.labm-photo.is-pending').length })),
  toast: [...document.querySelectorAll('.el-message')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
}))
console.log(JSON.stringify(st, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-65-repro.png' })
