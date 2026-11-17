// round-21: 8090 打包版复核「联系人=送样人」下拉(只读,不保存)
const dir = 'C:/Users/vigna/ego/insp-rev-20261117'
const task = await taskSpace('insp-rev-20261117')
const page = task.page('p1')
const T = (ms) => page.waitForTimeout(ms)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) {
    await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal', width: 1680, height: 1000 } })
  }
  await T(400)
} catch (e) { console.log('resize skip: ' + e.message) }

await page.goto('http://127.0.0.1:8090/#/panelx/list/INSP_COMMISSION', { timeout: 90000 })
await T(7000)

const info = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const sheet = document.querySelector('[data-ic-sheet]')
  const tr = [...sheet.querySelectorAll('tbody > tr')].find((r) => /联系人/.test(txt(r)))
  return {
    factory: txt(document.querySelector('.topbar')).slice(0, 50),
    hasSelect: !!tr?.querySelector('.el-select'),
    contact: txt(tr?.querySelector('.el-select') || tr),
    editable: sheet.className.includes('is-editing'),
  }
})
console.log('info=' + JSON.stringify(info))

await page.evaluate(() => {
  const sheet = document.querySelector('[data-ic-sheet]')
  const tr = [...sheet.querySelectorAll('tbody > tr')].find((r) => /联系人/.test((r.textContent || '')))
  tr?.querySelector('.el-select__wrapper')?.click()
})
await T(1200)
const opts = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-select-dropdown__item')].map((li) => (li.textContent || '').trim())
  return { total: items.length, head: items.slice(0, 5) }
})
console.log('options=' + JSON.stringify(opts))
await page.screenshot({ path: dir + '/shots/round-21-8090-contact.png' })
