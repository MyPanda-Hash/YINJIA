const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')

// 第 2 行:用原生 setter 填两个文本格(测试项目 / 使用人)
const filled = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.labm-drow')]
  const row = rows[1]
  if (!row) return 'no-row2'
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const done = []
  for (const f of row.querySelectorAll('.labm-field')) {
    const label = f.querySelector('label')?.textContent?.trim() || ''
    const input = f.querySelector('input')
    if (!input) continue
    if (label.includes('测试项目')) { setVal(input, '追加行-手机端拍照'); done.push(label) }
    if (label.includes('使用人')) { setVal(input, '李四'); done.push(label) }
  }
  return done
})
console.log('filled=' + JSON.stringify(filled))

// 第 2 行「拍照/选图」(每行一个,#2 = nth=1)
await page.click('css:.labm-rowphoto .el-button >> nth=1')
await page.waitForTimeout(600)
await page.setInputFiles('css:input[type=file]', 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/test-photo.png')
await page.waitForTimeout(1500)
const staged = await page.evaluate(() => ({
  rows: document.querySelectorAll('.labm-drow').length,
  pendingPerRow: [...document.querySelectorAll('.labm-rowphoto')].map((e) => e.querySelectorAll('.labm-photo.is-pending').length),
  photosPerRow: [...document.querySelectorAll('.labm-rowphoto')].map((e) => e.querySelectorAll('.labm-photo img').length),
}))
console.log('staged=' + JSON.stringify(staged))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-62-staged.png' })

await page.click('loc=role:button[name="保存草稿"]')
await page.waitForTimeout(12000)
const saved = await page.evaluate(() => ({
  doc: document.querySelector('.labm-doc')?.textContent?.trim() || '',
  err: document.querySelector('.labm-err')?.textContent?.trim() || '',
  rows: document.querySelectorAll('.labm-drow').length,
  perRow: [...document.querySelectorAll('.labm-rowphoto')].map((e) => ({
    imgs: e.querySelectorAll('.labm-photo img').length,
    pending: e.querySelectorAll('.labm-photo.is-pending').length,
  })),
  lines: [...document.querySelectorAll('.labm-line')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
}))
console.log('saved=' + JSON.stringify(saved, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-63-saved.png' })
