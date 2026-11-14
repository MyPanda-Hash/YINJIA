// round-01(每箱数量可填):正式库只读 —— 打开「打印材料码」→ 按打印记录带入 → 量两个输入框的 disabled
// 注意:全程不点「确定打印」,不写任何单据(带入只改界面状态)。
const fs = await import('node:fs/promises')
const task = await taskSpace('label-box-editable-20261113')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
await page.waitForTimeout(6000)
console.log('FACTORY ' + await page.evaluate(() => (document.querySelector('.factory-name')?.textContent || '').trim()))

// 选中截图那张单(YJ-20261110-04);找不到就退而用第一张已审核的
const picked = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.dsr-grid tbody tr')]
  const want = 'YJ-20261110-04'
  let target = rows.find((r) => (r.textContent || '').includes(want))
  if (!target) target = rows.find((r) => (r.querySelector('.dsr-tag')?.textContent || '').trim() === '已审核')
  if (!target) return { ok: false }
  target.click()
  const cells = [...target.querySelectorAll('td')].map((td) => (td.textContent || '').trim())
  return { ok: true, cells }
})
console.log('PICK ' + JSON.stringify(picked))
await page.waitForTimeout(2500)

// 打开「打印材料码」:生单组? 不 —— 它在「更多」组的下拉里(或侧栏)。用按钮文本通配找。
const opened = await page.evaluate(() => {
  const all = [...document.querySelectorAll('.tools .tb-group')]
  const more = all.find((g) => (g.querySelector('.tb-main')?.textContent || '').trim() === '更多')
  more?.querySelector('.tb-caret')?.click()
  return { groups: all.map((g) => (g.querySelector('.tb-main')?.textContent || '').trim()) }
})
await page.waitForTimeout(800)
const menu = await page.evaluate(() => [...document.querySelectorAll('.tools .tb-menu .ctx-item')].map((el) => (el.textContent || '').trim()))
console.log('MORE_MENU ' + JSON.stringify(menu))
await page.evaluate(() => {
  const it = [...document.querySelectorAll('.tools .tb-menu .ctx-item')].find((el) => (el.textContent || '').includes('打印材料码'))
  it?.click()
})
await page.waitForTimeout(6000)

const dlg = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('打印材料码'))
  if (!d) return { open: false, msgs: [...document.querySelectorAll('.el-message__content')].map((e) => (e.textContent || '').trim()) }
  return { open: true, title: (d.querySelector('.el-dialog__title')?.textContent || '').trim() }
})
console.log('DLG ' + JSON.stringify(dlg))

// 展开「打印采购订单记录」并点「按这次打印打码」
const expanded = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('打印材料码'))
  const head = [...d.querySelectorAll('.el-collapse-item__header')].find((h) => (h.textContent || '').includes('打印采购订单记录'))
  head?.click()
  return !!head
})
await page.waitForTimeout(1500)
const rowsInfo = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('打印材料码'))
  const items = [...d.querySelectorAll('.el-collapse-item')]
  const po = items.find((it) => (it.textContent || '').includes('打印采购订单记录'))
  const rows = po ? [...po.querySelectorAll('.el-table__body tbody tr')] : []
  return rows.map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').trim()))
})
console.log('PO_RECORDS ' + JSON.stringify(rowsInfo))
const clicked = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('打印材料码'))
  const items = [...d.querySelectorAll('.el-collapse-item')]
  const po = items.find((it) => (it.textContent || '').includes('打印采购订单记录'))
  const btn = po ? [...po.querySelectorAll('button')].find((b) => (b.textContent || '').includes('按这次打印打码')) : null
  btn?.click()
  return !!btn
})
console.log('CLICK_LOAD ' + clicked)
await page.waitForTimeout(5000)

// 量:本次打印数量 / 每箱数量 两个输入框的 disabled 与值
const inputs = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('打印材料码'))
  const heads = [...d.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').trim())
  const qtyIdx = heads.findIndex((h) => h.includes('本次打印数量'))
  const boxIdx = heads.findIndex((h) => h.includes('每箱数量'))
  const out = []
  for (const tr of [...d.querySelectorAll('.el-table__body tbody tr')]) {
    const tds = [...tr.querySelectorAll('td')]
    const qtyInp = tds[qtyIdx]?.querySelector('input')
    const boxInp = tds[boxIdx]?.querySelector('input')
    if (!qtyInp && !boxInp) continue
    out.push({
      qty: qtyInp ? qtyInp.value : null, qtyDisabled: qtyInp ? qtyInp.disabled : null,
      box: boxInp ? boxInp.value : null, boxDisabled: boxInp ? boxInp.disabled : null,
      boxPlaceholder: boxInp ? boxInp.placeholder : null,
    })
  }
  return { heads: heads.filter(Boolean), qtyIdx, boxIdx, rows: out, lockBanner: (d.querySelector('.mlq-lock')?.textContent || '').replace(/\s+/g, ' ').trim() }
})
console.log('INPUTS ' + JSON.stringify(inputs, null, 2))
await fs.writeFile('C:/Users/Lenovo/ego/label-box-editable-20261113/round-01.json', JSON.stringify(inputs, null, 2), 'utf8')

// 试着往第一行「每箱数量」里输入 100,确认能填进去
const typed = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('打印材料码'))
  const heads = [...d.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').trim())
  const boxIdx = heads.findIndex((h) => h.includes('每箱数量'))
  const tr = [...d.querySelectorAll('.el-table__body tbody tr')][0]
  const inp = tr?.querySelectorAll('td')[boxIdx]?.querySelector('input')
  if (!inp || inp.disabled) return { ok: false, disabled: inp?.disabled }
  inp.focus()
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(inp, '100')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
  inp.blur()
  return { ok: true, value: inp.value }
})
await page.waitForTimeout(800)
const after = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('打印材料码'))
  const heads = [...d.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').trim())
  const boxIdx = heads.findIndex((h) => h.includes('每箱数量'))
  const tr = [...d.querySelectorAll('.el-table__body tbody tr')][0]
  return { boxValue: tr?.querySelectorAll('td')[boxIdx]?.querySelector('input')?.value ?? null }
})
console.log('TYPED ' + JSON.stringify(typed) + ' AFTER ' + JSON.stringify(after))
await fs.writeFile('C:/Users/Lenovo/ego/label-box-editable-20261113/round-01-typed.json', JSON.stringify({ typed, after }, null, 2), 'utf8')
