const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_LAB_EQUIP_USE', { timeout: 30000 })
await page.waitForTimeout(2500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

const before = await page.evaluate(() => ({
  factory: localStorage.getItem('mes_factory'),
  lines: [...document.querySelectorAll('.labm-line')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  total: document.querySelector('.labm-sec-num')?.textContent?.trim(),
}))
console.log('list=' + JSON.stringify(before, null, 2))

// 点第一条记录 → 表单应回填(设备名称/明细/照片)
await page.click('.labm-line >> nth=0')
await page.waitForTimeout(2000)
const opened = await page.evaluate(() => ({
  doc: document.querySelector('.labm-doc')?.textContent?.trim() || '',
  values: [...document.querySelectorAll('.labm-field')].map((f) => {
    const label = f.querySelector('label')?.textContent?.trim() || ''
    const input = f.querySelector('input')
    return label + '=' + (input ? input.value : '')
  }),
  photoSection: [...document.querySelectorAll('.labm-sec')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  photos: [...document.querySelectorAll('.labm-photo')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  on: [...document.querySelectorAll('.labm-line.on')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
}))
console.log('opened=' + JSON.stringify(opened, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-08.png' })
