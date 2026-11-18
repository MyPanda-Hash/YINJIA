// round-19: 回读已保存草稿的联系人(送样人)显示 + 选项清单里是否含当前登录人
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

await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 90000 })
await T(7000)

const shown = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const sheet = document.querySelector('[data-ic-sheet]')
  const tr = [...sheet.querySelectorAll('tbody > tr')].find((r) => /联系人/.test(txt(r)))
  const sel = tr?.querySelector('.el-select')
  return {
    docNo: [...sheet.querySelectorAll('.ic-meta input')].map((i) => i.value),
    selectText: txt(sel),
    hasSelect: !!sel,
  }
})
console.log('shown=' + JSON.stringify(shown))

await page.evaluate(() => {
  const sheet = document.querySelector('[data-ic-sheet]')
  const tr = [...sheet.querySelectorAll('tbody > tr')].find((r) => /联系人/.test((r.textContent || '')))
  tr?.querySelector('.el-select__wrapper')?.click()
})
await T(1200)
const hasAdmin = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-select-dropdown__item')].map((li) => (li.textContent || '').trim())
  return { total: items.length, hasSysAdmin: items.includes('系统管理员'), head: items.slice(0, 5) }
})
console.log('options=' + JSON.stringify(hasAdmin))
await page.screenshot({ path: dir + '/shots/round-19-contact-readback.png' })
