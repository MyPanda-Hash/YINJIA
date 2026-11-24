// round-14:模糊搜索三连证 —— 供应商片段「双喜」/ 单号片段「20261114」/ 物料片段「端盖」各自的行数与命中列
const task = await taskSpace('merge-supplier-fuzzy-20261124b')
const page = task.page('p1')
const log = (...a) => console.log(...a)

const rowsOf = () => page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim() === '选择采购订单')
  if (!d) return { ok: false }
  const rows = [...d.querySelectorAll('.el-table__body tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()))
  return { ok: true, count: rows.length, rows: rows.slice(0, 8).map((r) => ({ no: r[2], supplier: r[4], items: r[5] })) }
})
const setKw = (v) => page.evaluate((val) => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const box = [...d.querySelectorAll('.mpd-bar input')].find((i) => (i.placeholder || '').startsWith('关键字'))
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(box, val)
  box.dispatchEvent(new Event('input', { bubbles: true }))
  box.dispatchEvent(new Event('change', { bubbles: true }))
  return box.placeholder
}, v)
const query = () => page.evaluate(() => {
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
log('NO_KW', JSON.stringify(await rowsOf()))

for (const kw of ['双喜', '20261114', '端盖']) {
  log('PH', await setKw(kw))
  await page.waitForTimeout(200)
  await query()
  await page.waitForTimeout(2200)
  log('KW=' + kw, JSON.stringify(await rowsOf()))
}

await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.querySelector('.el-dialog__title')?.textContent || '').trim() === '选择采购订单')
  ;[...d.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').includes('取消'))?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(800)
log('CLOSED', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).length)))
await task.finish({ keep: [] })
log('done round-14')
