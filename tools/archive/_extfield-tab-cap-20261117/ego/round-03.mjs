// round-03: 打开「来料检验要求(系列)」面板 → 「字段管理」对话框 → 记录用量/提示/按钮状态
const task = await taskSpace('extfield-tab-cap-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REQ_SERIES', { timeout: 30000 })
await page.waitForTimeout(8000)

const land = await page.evaluate(() => ({
  hash: location.hash,
  title: (document.querySelector('h1,h2,.page-title,.panel-title')?.textContent || '').replace(/\s+/g, ' ').trim(),
  hasFieldMgrEntry: [...document.querySelectorAll('*')].some((el) => el.children.length === 0 && (el.textContent || '').trim() === '字段管理'),
  fieldMgrNodes: [...document.querySelectorAll('*')].filter((el) => (el.textContent || '').trim() === '字段管理').slice(0, 4).map((el) => el.className + '|' + el.tagName),
}))
console.log(JSON.stringify(land, null, 2))
console.log('side btns =', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.as-side-btn, .as-action, .act-btn')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 30))))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/extfield-tab-cap-20261117/round-03-panel.png' })

// 打开「字段管理」
const opened = await page.evaluate(() => {
  const el = [...document.querySelectorAll('*')].find((n) => n.children.length === 0 && (n.textContent || '').trim() === '字段管理')
  if (!el) return false
  el.click()
  return true
})
console.log('clicked 字段管理 =', opened)
await page.waitForTimeout(3500)

const dlg = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((el) => (el.textContent || '').includes('字段管理'))
  if (!d) return null
  const q = (s) => d.querySelector(s)
  return {
    title: (q('.el-dialog__title')?.textContent || '').trim(),
    summary: (q('.fm-summary')?.textContent || '').replace(/\s+/g, ' ').trim(),
    tabUsage: [...d.querySelectorAll('.fm-tabusage-item')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
    alerts: [...d.querySelectorAll('.el-alert__title')].map((el) => (el.textContent || '').trim()),
    tabSelect: (q('.el-select .el-select__selected-item, .el-select')?.textContent || '').replace(/\s+/g, ' ').trim(),
    addDisabled: (() => { const b = [...d.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '添加'); return b ? b.disabled : null })(),
    helpTexts: [...d.querySelectorAll('.fm-intro-main, .fm-intro-sub')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
    parentRow: [...d.querySelectorAll('.el-form-item')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 6),
  }
})
console.log('dialog =', JSON.stringify(dlg, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/extfield-tab-cap-20261117/round-03-dialog.png' })
console.log('done round-03')
