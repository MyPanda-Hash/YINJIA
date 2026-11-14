// round-02: 走对入口(打印 ▼ → 打印材料码) → 展开「打印采购订单记录」→ 按这次打印打码
// → 量 本次打印数量 / 每箱数量 的 disabled,并试着往每箱数量里输入。
// 全程不点「确定打印」(不写库)。
const fs = await import('node:fs/promises')
const task = await taskSpace('label-box-editable-20261113')
const page = task.page('p1')
await page.waitForTimeout(300)
// 关掉可能残留的弹窗
await page.evaluate(() => { for (let i = 0; i < 3; i++) document.querySelector('.el-dialog__headerbtn')?.click() })
await page.waitForTimeout(600)

await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
await page.waitForTimeout(6000)
const picked = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.dsr-grid tbody tr')]
  const want = 'YJ-20261110-04'
  const target = rows.find((r) => (r.textContent || '').includes(want))
    || rows.find((r) => (r.querySelector('.dsr-tag')?.textContent || '').trim() === '已审核')
  if (!target) return { ok: false }
  target.click()
  return { ok: true, cells: [...target.querySelectorAll('td')].map((td) => (td.textContent || '').trim()) }
})
console.log('PICK ' + JSON.stringify(picked))
await page.waitForTimeout(2500)

// 打印 ▼ → 打印材料码
const printMenu = await page.evaluate(() => {
  const g = [...document.querySelectorAll('.tools .tb-group')]
    .find((x) => (x.querySelector('.tb-main')?.textContent || '').trim() === '打印')
  g?.querySelector('.tb-caret')?.click()
  return !!g
})
await page.waitForTimeout(800)
const items = await page.evaluate(() => [...document.querySelectorAll('.tools .tb-menu .ctx-item')].map((el) => (el.textContent || '').trim()))
console.log('PRINT_MENU ' + JSON.stringify(items) + ' opened=' + printMenu)
await page.evaluate(() => {
  const it = [...document.querySelectorAll('.tools .tb-menu .ctx-item')].find((el) => (el.textContent || '').includes('打印材料码'))
  it?.click()
})
await page.waitForTimeout(6000)

const dlg = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('打印材料码'))
  return d ? { open: true, title: (d.querySelector('.el-dialog__title')?.textContent || '').trim(), rows: d.querySelectorAll('.el-table__body tbody tr').length } : { open: false }
})
console.log('DLG ' + JSON.stringify(dlg))

// 展开「打印采购订单记录」
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('打印材料码'))
  const head = [...(d?.querySelectorAll('.el-collapse-item__header') || [])].find((h) => (h.textContent || '').includes('打印采购订单记录'))
  head?.click()
})
await page.waitForTimeout(2000)
const recs = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('打印材料码'))
  const po = [...(d?.querySelectorAll('.el-collapse-item') || [])].find((it) => (it.textContent || '').includes('打印采购订单记录'))
  return po ? [...po.querySelectorAll('.el-table__body tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').trim())) : []
})
console.log('PO_RECORDS ' + JSON.stringify(recs))

const clicked = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('打印材料码'))
  const po = [...(d?.querySelectorAll('.el-collapse-item') || [])].find((it) => (it.textContent || '').includes('打印采购订单记录'))
  const btn = po ? [...po.querySelectorAll('button')].find((b) => (b.textContent || '').includes('按这次打印打码')) : null
  btn?.click()
  return !!btn
})
console.log('CLICK_LOAD ' + clicked)
await page.waitForTimeout(5000)

const state = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('打印材料码'))
  const heads = [...(d?.querySelectorAll('.el-table__header th') || [])].map((th) => (th.textContent || '').trim())
  const qtyIdx = heads.findIndex((h) => h.includes('本次打印数量'))
  const boxIdx = heads.findIndex((h) => h.includes('每箱数量'))
  const rows = []
  for (const tr of [...(d?.querySelectorAll('.el-table__body tbody tr') || [])]) {
    const tds = [...tr.querySelectorAll('td')]
    const q = tds[qtyIdx]?.querySelector('input')
    const b = tds[boxIdx]?.querySelector('input')
    if (!q && !b) continue
    rows.push({ qty: q?.value ?? null, qtyDisabled: q?.disabled ?? null, box: b?.value ?? null, boxDisabled: b?.disabled ?? null })
  }
  return { heads: heads.filter(Boolean), qtyIdx, boxIdx, rows, banner: (d?.querySelector('.mlq-lock')?.textContent || '').replace(/\s+/g, ' ').trim() }
})
console.log('STATE ' + JSON.stringify(state, null, 2))

// 往第一行「每箱数量」输入 100
const typed = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('打印材料码'))
  const heads = [...(d?.querySelectorAll('.el-table__header th') || [])].map((th) => (th.textContent || '').trim())
  const boxIdx = heads.findIndex((h) => h.includes('每箱数量'))
  const tr = [...(d?.querySelectorAll('.el-table__body tbody tr') || [])][0]
  const inp = tr?.querySelectorAll('td')[boxIdx]?.querySelector('input')
  if (!inp) return { ok: false, why: 'no input' }
  if (inp.disabled) return { ok: false, why: 'disabled' }
  inp.focus()
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(inp, '100')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
  inp.blur()
  return { ok: true, value: inp.value }
})
await page.waitForTimeout(900)
const after = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => (x.textContent || '').includes('打印材料码'))
  const heads = [...(d?.querySelectorAll('.el-table__header th') || [])].map((th) => (th.textContent || '').trim())
  const boxIdx = heads.findIndex((h) => h.includes('每箱数量'))
  const tr = [...(d?.querySelectorAll('.el-table__body tbody tr') || [])][0]
  const b = tr?.querySelectorAll('td')[boxIdx]?.querySelector('input')
  return { boxValue: b?.value ?? null, hint: (d?.querySelector('.mlq-box-hint')?.textContent || '').replace(/\s+/g, ' ').trim() }
})
console.log('TYPED ' + JSON.stringify(typed) + ' AFTER ' + JSON.stringify(after))
await fs.writeFile('C:/Users/Lenovo/ego/label-box-editable-20261113/round-02.json',
  JSON.stringify({ recs, state, typed, after }, null, 2), 'utf8')
