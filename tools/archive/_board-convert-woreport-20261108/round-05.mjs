// round-05.mjs — 报工记录(WO_REPORT_LIST)新字段界面取证:列表列 + 查询条件
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/wo-board-freeze-20261108'
await fs.mkdir(OUT, { recursive: true })
const task = await taskSpace('wo-board-freeze-cols-20261108')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/WO_REPORT_LIST', { timeout: 40000 })
await page.waitForTimeout(6000)

const info = await page.evaluate(() => {
  const qLabels = [...document.querySelectorAll('.udl-fields .field label')].map((l) => (l.innerText || '').trim())
  const heads = [...document.querySelectorAll('.el-table__header th')].map((t) => (t.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
  const rows = [...document.querySelectorAll('.el-table__body tbody tr')]
  const first = rows[0] ? [...rows[0].querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim()).slice(0, 16) : []
  return { qLabels, heads, rowCount: rows.length, first }
})
console.log(JSON.stringify(info, null, 2))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: OUT + '/round-05-wo-report-list.png' })

// 追加:点「查询」按钮前,先把「产品规格」文本条件填 60*45(文本类型是 el-input)再查询,验证 UI 过滤链路
const fill = await page.evaluate(() => {
  const fields = [...document.querySelectorAll('.udl-fields .field')]
  const f = fields.find((x) => (x.querySelector('label')?.innerText || '').trim() === '产品规格')
  if (!f) return 'no-field'
  const inp = f.querySelector('input')
  if (!inp) return 'no-input'
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(inp, '60*45')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
  return 'filled'
})
console.log('fill 产品规格: ' + fill)
await page.waitForTimeout(600)
const clicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').replace(/\s+/g, '') === '查询')
  if (!b) return false
  b.click()
  return true
})
console.log('click 查询: ' + clicked)
await page.waitForTimeout(3500)
const after = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.el-table__body tbody tr')]
  return {
    rowCount: rows.length,
    first: rows[0] ? [...rows[0].querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim()).slice(0, 16) : [],
  }
})
console.log('after query: ' + JSON.stringify(after))
await page.screenshot({ path: OUT + '/round-05-query-filled.png' })
