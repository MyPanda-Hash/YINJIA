// round-08.mjs — 报工记录:产品编码 参照查询(弹窗选产品 → 查询链路)
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/wo-board-freeze-20261108'
await fs.mkdir(OUT, { recursive: true })
const task = await taskSpace('wo-board-freeze-cols-20261108')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/WO_REPORT_LIST', { timeout: 40000 })
await page.waitForTimeout(6500)

// 打开「产品编码」参照弹窗(查询区只读输入 + 搜索按钮)
const opened = await page.evaluate(() => {
  const f = [...document.querySelectorAll('.udl-fields .field')].find((x) => (x.querySelector('label')?.innerText || '').trim() === '产品编码')
  if (!f) return 'no-field'
  const btn = [...f.querySelectorAll('button')][0]
  if (btn) { btn.click(); return 'click-search-btn' }
  const inp = f.querySelector('input')
  if (inp) { inp.click(); return 'click-input' }
  return 'no-clickable'
})
console.log('open 产品编码 ref: ' + opened)
await page.waitForTimeout(3000)

const dlg = await page.evaluate(() => {
  const ds = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
  if (!ds.length) return null
  const d = ds[ds.length - 1]
  return { title: (d.querySelector('.el-dialog__title') || {}).innerText || '',
           inputs: [...d.querySelectorAll('input')].map((i) => i.placeholder || '').slice(0, 4),
           body: (d.innerText || '').replace(/\s+/g, ' ').slice(0, 300) }
})
console.log('dialog: ' + JSON.stringify(dlg, null, 2))

// 在弹窗里搜 B-46-07
const searched = await page.evaluate(() => {
  const ds = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
  const d = ds[ds.length - 1]
  if (!d) return 'no-dialog'
  const inp = [...d.querySelectorAll('input')].find((i) => !i.readOnly) || d.querySelector('input')
  if (!inp) return 'no-input'
  inp.focus()
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(inp, 'B-46-07')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }))
  return 'searched'
})
console.log('search in dialog: ' + searched)
await page.waitForTimeout(3000)
const rows = await page.evaluate(() => {
  const ds = [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null)
  const d = ds[ds.length - 1]
  if (!d) return []
  return [...d.querySelectorAll('.el-table__body tbody tr')].slice(0, 4).map((tr) => (tr.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 120))
})
console.log('dialog rows: ' + JSON.stringify(rows, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: OUT + '/round-08-ref-popup.png' })
