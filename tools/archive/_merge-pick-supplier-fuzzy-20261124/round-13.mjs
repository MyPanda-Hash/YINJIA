// round-13:① 关键字模糊搜索(供应商片段/物料片段都能命中)② 勾一张后列表只剩同一供应商
const task = await taskSpace('merge-supplier-fuzzy-20261124')
const page = task.page('p1')
const log = (...a) => console.log(...a)

const snap = () => page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim() === '选择采购订单')
  if (!d) return { ok: false }
  const rows = [...d.querySelectorAll('.el-table__body tbody tr')].map((tr) => {
    const tds = [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())
    return { no: tds[2], supplier: tds[4], items: tds[5], picked: !!tr.querySelector('.el-checkbox__input.is-checked') }
  })
  return {
    ok: true,
    count: rows.length,
    suppliers: [...new Set(rows.map((r) => r.supplier))],
    rows: rows.slice(0, 6),
    picked: (d.querySelector('.mpd-picked')?.textContent || '').replace(/\s+/g, ' ').trim(),
    chips: [...d.querySelectorAll('.mpd-chip, .mpd-tip')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
    headers: [...d.querySelectorAll('.el-table__header th')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
  }
})
const setInput = async (placeholder, value) => page.evaluate(({ p, v }) => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const box = [...d.querySelectorAll('.mpd-bar input')].find((i) => (i.placeholder || '') === p)
  if (!box) return { ok: false, ins: [...d.querySelectorAll('.mpd-bar input')].map((i) => i.placeholder) }
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(box, v)
  box.dispatchEvent(new Event('input', { bubbles: true }))
  box.dispatchEvent(new Event('change', { bubbles: true }))
  return { ok: true }
}, { p: placeholder, v: value })
const clickQuery = () => page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  ;[...d.querySelectorAll('.mpd-bar button')].find((b) => (b.textContent || '').includes('查询'))?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})

await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 60000 })
await page.waitForTimeout(6000)
await page.evaluate(() => {
  const g = [...document.querySelectorAll('.tb-group')].find((x) => (x.querySelector('.tb-main')?.textContent || '').trim() === '生单')
  if (g && !document.querySelector('.tb-menu')) g.querySelector('.tb-caret')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(900)
await page.evaluate(() => {
  ;[...document.querySelectorAll('.tb-menu .ctx-item')].find((e) => (e.textContent || '').trim() === '合单生单')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(4500)
log('BASE', JSON.stringify(await snap(), null, 1))

// ① 模糊搜索:关键字 = 供应商片段「双喜」(单号里没有这两个字)
log('SET_KW', JSON.stringify(await setInput('关键字：单号/供应商/物料', '双喜')))
await page.waitForTimeout(200)
await clickQuery()
await page.waitForTimeout(2500)
log('KW_SUPPLIER', JSON.stringify(await snap(), null, 1))

// ① 模糊搜索:关键字 = 物料片段「端盖」
await setInput('关键字：单号/供应商/物料', '端盖')
await page.waitForTimeout(200)
await clickQuery()
await page.waitForTimeout(2500)
log('KW_ITEM', JSON.stringify(await snap(), null, 1))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/merge-supplier-fuzzy-20261124/round-13-kw-item.png' })

// ② 清掉关键字 → 勾第一行 → 列表应只剩同一供应商
await setInput('关键字：单号/供应商/物料', '')
await page.waitForTimeout(200)
await clickQuery()
await page.waitForTimeout(2500)
const firstBefore = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim() === '选择采购订单')
  const tr = d.querySelector('.el-table__body tbody tr')
  const tds = [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim())
  tr.querySelector('td:nth-child(3)')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return { no: tds[2], supplier: tds[4] }
})
await page.waitForTimeout(3000)
const afterPick = await snap()
log('PICK_FIRST', JSON.stringify(firstBefore), JSON.stringify(afterPick, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/merge-supplier-fuzzy-20261124/round-13-only-supplier.png' })

// 收尾:取消
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim() === '选择采购订单')
  ;[...d.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').includes('取消'))?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(1000)
log('CLOSED', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).length)))
await task.finish({ keep: [] })
log('done round-13')
