// round-07: 在测试库的「阻垢系列」(14/20)加一组 父目录+两个子目录 → 原来会被「已达上限(x/20)」挡住
const task = await taskSpace('extfield-tab-cap-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REQ_SERIES', { timeout: 30000 })
await page.waitForTimeout(8000)

// 打开「自定义字段」
await page.evaluate(() => {
  const n = [...document.querySelectorAll('.qc-insp-sheet *')]
    .find((e) => e.children.length <= 1 && (e.textContent || '').replace(/\s+/g, ' ').trim().replace(/^[^\w\u4e00-\u9fa5]+/, '') === '自定义字段')
  if (n) n.click()
})
await page.waitForTimeout(3000)

const before = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((el) => (el.textContent || '').includes('字段管理'))
  return { summary: (d?.querySelector('.fm-summary')?.textContent || '').trim(), alerts: [...(d?.querySelectorAll('.el-alert__title') || [])].map((e) => e.textContent.trim()) }
})
console.log('before =', JSON.stringify(before))

// 父目录:el-select(allow-create)—— 输入名字后回车
const tag = String(Date.now()).slice(-4)
const parentName = '验证父' + tag
const c1 = '验证法' + tag
const c2 = '验证标' + tag
await page.evaluate((p) => {
  const d = [...document.querySelectorAll('.el-dialog')].find((el) => (el.textContent || '').includes('字段管理'))
  const sel = [...d.querySelectorAll('.el-form-item')].find((it) => (it.textContent || '').includes('父目录'))
  const inp = sel?.querySelector('input')
  if (!inp) return
  inp.click()
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(inp, p); inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }))
  inp.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }))
}, parentName)
await page.waitForTimeout(800)

// 子目录1 / 子目录2
await page.evaluate(({ a, b }) => {
  const d = [...document.querySelectorAll('.el-dialog')].find((el) => (el.textContent || '').includes('字段管理'))
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const items = [...d.querySelectorAll('.el-form-item')]
  const i1 = items.find((it) => (it.textContent || '').includes('子目录1'))?.querySelector('input')
  const i2 = items.find((it) => (it.textContent || '').includes('子目录2'))?.querySelector('input')
  if (i1) setVal(i1, a)
  if (i2) setVal(i2, b)
}, { a: c1, b: c2 })
await page.waitForTimeout(800)

const filled = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((el) => (el.textContent || '').includes('字段管理'))
  const btn = [...d.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '添加')
  return {
    parentRow: [...d.querySelectorAll('.el-form-item')].map((it) => (it.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 4),
    addDisabled: btn ? btn.disabled : null,
    alerts: [...d.querySelectorAll('.el-alert__title')].map((e) => e.textContent.trim()),
  }
})
console.log('filled =', JSON.stringify(filled, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/extfield-tab-cap-20261117/round-07-filled.png' })

// 点「添加」
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((el) => (el.textContent || '').includes('字段管理'))
  const btn = [...d.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === '添加')
  if (btn && !btn.disabled) btn.click()
})
await page.waitForTimeout(4000)

const after = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((el) => (el.textContent || '').includes('字段管理'))
  return {
    messages: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').replace(/\s+/g, ' ').trim()),
    summary: (d?.querySelector('.fm-summary')?.textContent || '').trim(),
    chips: [...(d?.querySelectorAll('.fm-tabusage-item') || [])].map((e) => e.textContent.replace(/\s+/g, ' ').trim()).slice(0, 3),
    alerts: [...(d?.querySelectorAll('.el-alert__title') || [])].map((e) => e.textContent.trim()),
    rows: [...(d?.querySelectorAll('.el-table__body tbody tr') || [])].slice(-4).map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').trim()).join(' | ')),
  }
})
console.log('after =', JSON.stringify(after, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/extfield-tab-cap-20261117/round-07-added.png' })
console.log('names =', JSON.stringify({ parentName, c1, c2 }))
console.log('done round-07')
