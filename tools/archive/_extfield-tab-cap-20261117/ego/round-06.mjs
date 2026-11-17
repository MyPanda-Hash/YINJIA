// round-06: 精确定位「自定义字段」控件并点击 → 抓对话框状态
const task = await taskSpace('extfield-tab-cap-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REQ_SERIES', { timeout: 30000 })
await page.waitForTimeout(8000)

const cands = await page.evaluate(() => [...document.querySelectorAll('.qc-insp-sheet *, .portal-content *')]
  .filter((n) => n.children.length <= 1 && (n.textContent || '').replace(/\s+/g, ' ').trim().replace(/^[^\w\u4e00-\u9fa5]+/, '') === '自定义字段')
  .slice(0, 8)
  .map((n) => n.tagName + '.' + n.className + ' | parent=' + n.parentElement.className))
console.log('candidates =', JSON.stringify(cands, null, 2))

const clicked = await page.evaluate(() => {
  const n = [...document.querySelectorAll('.qc-insp-sheet *, .portal-content *')]
    .find((e) => e.children.length <= 1 && (e.textContent || '').replace(/\s+/g, ' ').trim().replace(/^[^\w\u4e00-\u9fa5]+/, '') === '自定义字段')
  if (!n) return null
  n.click()
  return n.tagName + '.' + n.className
})
console.log('clicked =', clicked)
await page.waitForTimeout(3500)

const dlg = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((el) => (el.textContent || '').includes('字段管理'))
  if (!d) return null
  const q = (s) => d.querySelector(s)
  return {
    title: (q('.el-dialog__title')?.textContent || '').trim(),
    intro: [...d.querySelectorAll('.fm-intro-main, .fm-intro-sub')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
    summary: (q('.fm-summary')?.textContent || '').replace(/\s+/g, ' ').trim(),
    tabUsage: [...d.querySelectorAll('.fm-tabusage-item')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
    alerts: [...d.querySelectorAll('.el-alert__title')].map((el) => (el.textContent || '').trim()),
    rows: [...d.querySelectorAll('.el-table__body tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').trim()).join(' | ')).slice(0, 4),
    empty: (q('.fm-empty')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
    addDisabled: (() => { const b = [...d.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '添加'); return b ? b.disabled : null })(),
    formRows: [...d.querySelectorAll('.el-form-item')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 8),
  }
})
console.log('dialog =', JSON.stringify(dlg, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/extfield-tab-cap-20261117/round-06-dialog.png' })
console.log('done round-06')
