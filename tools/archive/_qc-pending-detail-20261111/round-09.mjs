/* round-09.mjs — 用查询条过滤出「已完成检验」的那条记录,验行内「取消完成」 */
const task = await taskSpace('qc-pending-detail-20261111')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC_DETAIL', { timeout: 30000 })
await page.waitForTimeout(4000)

// 1) 结构:查询条的字段标签与输入框对应关系
const shape = await page.evaluate(() => {
  const labels = [...document.querySelectorAll('.report-query label, .query-bar label, .fields label')]
    .map((el) => (el.textContent || '').trim())
  const inputs = [...document.querySelectorAll('.report-query input, .query-bar input, .fields input')].length
  return { labels: labels.slice(0, 40), inputs }
})
console.log('query bar shape ->', JSON.stringify(shape))

// 2) 在「检验数据记录单号」那一格填 JYSJ-2026-09-0032 并查询
const filled = await page.evaluate((target) => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const labels = [...document.querySelectorAll('label')]
  const lab = labels.find((el) => (el.textContent || '').trim() === '检验数据记录单号')
  if (!lab) return 'no-label'
  let box = lab.parentElement
  let input = null
  for (let i = 0; i < 4 && box && !input; i++) {
    input = box.querySelector('input')
    if (!input) box = box.parentElement
  }
  if (!input) return 'no-input'
  setVal(input, target)
  return 'filled'
}, 'JYSJ-2026-09-0032')
console.log('fill ->', filled)
await page.waitForTimeout(400)

// 3) 点「查询」
const q = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button, .el-button')].find((el) => (el.textContent || '').trim() === '查询')
  if (!b) return 'no-btn'
  b.click()
  return 'clicked'
})
console.log('query ->', q)
await page.waitForTimeout(3500)

const after = await page.evaluate(() => {
  const bodyRows = [...document.querySelectorAll('.el-table__body-wrapper tbody tr')]
  const txt = (document.querySelector('.report-body') || document.body).innerText.replace(/\s+/g, ' ')
  const m = txt.match(/共\s*(\d+)\s*条/)
  const reopen = [...document.querySelectorAll('.doc-no-link')].map((el) => ({ t: (el.innerText || '').trim(), title: el.title }))
  return {
    total: m ? m[1] : null,
    rowCount: bodyRows.length,
    firstRow: bodyRows[0] ? [...bodyRows[0].querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim()) : [],
    reopenLinks: reopen.filter((x) => x.t === '取消完成'),
  }
})
console.log('after query ->', JSON.stringify(after, null, 2))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-pending-detail-20261111/round-09-filtered.png' })
