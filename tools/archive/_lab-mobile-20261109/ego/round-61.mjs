const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')

// ① 手机端打开既有单 EU-2026-11-0003(应有 1 行,行上有手机照片列/本行照片区)
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_LAB_EQUIP_USE', { timeout: 30000 })
await page.waitForTimeout(4500)
const list = await page.evaluate(() => [...document.querySelectorAll('.labm-line')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()))
console.log('list=' + JSON.stringify(list))
await page.click('.labm-line >> nth=0')
await page.waitForTimeout(3000)
const opened = await page.evaluate(() => ({
  doc: document.querySelector('.labm-doc')?.textContent?.trim() || '',
  rows: document.querySelectorAll('.labm-drow').length,
  rowPhotoHeads: [...document.querySelectorAll('.labm-rowphoto-title')].map((e) => e.textContent.trim()),
  rowPhotos: [...document.querySelectorAll('.labm-rowphoto .labm-photo img')].length,
  rowPhotoEmpty: [...document.querySelectorAll('.labm-rowphoto-empty')].map((e) => e.textContent.trim()),
  fieldLabels: [...document.querySelectorAll('.labm-drow .labm-field > label')].map((e) => e.textContent.trim()),
}))
console.log('opened=' + JSON.stringify(opened, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-61-opened.png' })
