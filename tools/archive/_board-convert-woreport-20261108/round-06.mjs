// round-06.mjs — 报工记录:查询条件 UI 端到端(产品规格 文本模糊 / 产品编码 参照)
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/wo-board-freeze-20261108'
await fs.mkdir(OUT, { recursive: true })
const task = await taskSpace('wo-board-freeze-cols-20261108')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/WO_REPORT_LIST', { timeout: 40000 })
await page.waitForTimeout(6000)

// 装 fetch 钩子,记录查询请求体
await page.evaluate(() => {
  if (window.__yjFetchHook) return
  window.__yjFetchHook = true
  window.__yjCalls = []
  const orig = window.fetch
  window.fetch = function (url, opts) {
    try {
      const u = String(url)
      if (u.includes('queryFormDataList')) {
        window.__yjCalls.push({ url: u, body: opts && opts.body ? String(opts.body) : '' })
      }
    } catch (e) { /* ignore */ }
    return orig.apply(this, arguments)
  }
})

const fields = await page.evaluate(() => {
  return [...document.querySelectorAll('.udl-fields .field')].map((f) => {
    const label = (f.querySelector('label')?.innerText || '').trim()
    const tag = f.querySelector('input') ? 'input' : (f.querySelector('.el-select') ? 'select' : 'other')
    const readonly = f.querySelector('input')?.readOnly === true
    return { label, tag, readonly }
  })
})
console.log('query fields: ' + JSON.stringify(fields))

// 填「产品规格」= 60*45(文本)
const filled = await page.evaluate(() => {
  const f = [...document.querySelectorAll('.udl-fields .field')].find((x) => (x.querySelector('label')?.innerText || '').trim() === '产品规格')
  if (!f) return 'no-field'
  const inp = f.querySelector('input')
  if (!inp) return 'no-input'
  inp.focus()
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(inp, '60*45')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
  return { value: inp.value }
})
console.log('fill 产品规格: ' + JSON.stringify(filled))
await page.waitForTimeout(500)

// 点工具栏「查询」按钮
const btnInfo = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')].map((b) => (b.innerText || '').replace(/\s+/g, '').trim())
  return btns.filter((t) => t.includes('查询')).slice(0, 6)
})
console.log('buttons with 查询: ' + JSON.stringify(btnInfo))
const clicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').replace(/\s+/g, '') === '查询')
  if (!b) return false
  b.click()
  return true
})
console.log('click 查询: ' + clicked)
await page.waitForTimeout(4000)

const after = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.el-table__body tbody tr')]
  const total = (document.querySelector('.el-pagination__total') || {}).innerText || ''
  return {
    rowCount: rows.length,
    pagination: total,
    calls: (window.__yjCalls || []).slice(-3),
    first: rows[0] ? [...rows[0].querySelectorAll('td')].map((td) => (td.innerText || '').replace(/\s+/g, ' ').trim()).slice(0, 12) : [],
  }
})
console.log('after query: ' + JSON.stringify(after, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: OUT + '/round-06-query-result.png' })
