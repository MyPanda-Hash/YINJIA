// round-04: 找「新增」按钮并建草稿(宽容匹配),确认纸面进入可编辑态
const dir = 'C:/Users/vigna/ego/insp-rev-20261117'
const task = await taskSpace('insp-rev-20261117')
const page = task.page('p1')

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) {
      await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    }
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 90000 })
await page.waitForTimeout(6000)

const info = await page.evaluate(() => ({
  buttons: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 40),
  bodyHead: (document.querySelector('.func-zone, .toolbar, .topbar')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200),
  listRows: document.querySelectorAll('.el-table__row').length,
}))
console.log(JSON.stringify(info, null, 2))

const hit = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').replace(/\s+/g, '') === '新增')
  if (!btn) return 'no-btn'
  btn.click()
  return 'clicked'
})
console.log('click=' + hit)
await page.waitForTimeout(7000)
await restoreWindow()

const after = await page.evaluate(() => {
  const sheet = document.querySelector('[data-ic-sheet]')
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    editable: !!sheet && sheet.className.includes('is-editing'),
    meta: txt(sheet?.querySelector('.ic-meta')),
    inputs: sheet ? sheet.querySelectorAll('input').length : -1,
    datePicker: !!sheet?.querySelector('.ic-date-pick'),
    msg: [...document.querySelectorAll('.el-message, .el-notification')].map((m) => txt(m)).join(' | '),
    chips: txt(document.querySelector('.doc-chip')),
  }
})
console.log(JSON.stringify(after, null, 2))
await page.screenshot({ path: dir + '/shots/round-04-after-add.png' })
