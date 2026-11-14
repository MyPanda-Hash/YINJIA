// round-08: 先把视口放大到 1440x900(这台机器 ego 窗口只有 960x256,弹窗下半截点不到),
// 再走一遍:打印 ▼ → 打印材料码 → 展开打印采购订单记录 → 按这次打印打码 → 量两个输入框的锁定。
const fs = await import('node:fs/promises')
const task = await taskSpace('label-box-editable-20261113')
const page = task.page('p1')

// 放大视口(只影响渲染,不改真实窗口)
try {
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  console.log('VIEWPORT_SET')
} catch (e) { console.log('viewport err ' + e.message) }
await page.waitForTimeout(1200)
console.log('INNER ' + JSON.stringify(await page.evaluate(() => [innerWidth, innerHeight])))

// 关掉残留弹窗并重新打开
await page.evaluate(() => {
  for (let i = 0; i < 6; i++) {
    const btns = [...document.querySelectorAll('.el-dialog__headerbtn')]
    if (!btns.length) break
    btns.forEach((b) => b.click())
  }
})
await page.waitForTimeout(1200)
await page.evaluate(() => {
  const g = [...document.querySelectorAll('.tools .tb-group')].find((x) => (x.querySelector('.tb-main')?.textContent || '').trim() === '打印')
  g?.querySelector('.tb-caret')?.click()
})
await page.waitForTimeout(800)
await page.evaluate(() => {
  const it = [...document.querySelectorAll('.tools .tb-menu .ctx-item')].find((el) => (el.textContent || '').includes('打印材料码'))
  it?.click()
})
await page.waitForTimeout(6000)

const pickVisible = `(() => {
  const all = [...document.querySelectorAll('.el-dialog')].filter((d) => (d.textContent || '').includes('打印材料码'))
  const vis = all.filter((d) => d.getBoundingClientRect().width > 0)
  return vis[vis.length - 1] || null
})()`
const readMain = () => page.evaluate((expr) => {
  // eslint-disable-next-line no-eval
  const d = eval(expr)
  if (!d) return null
  const heads = [...d.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').trim())
  const qtyIdx = heads.findIndex((h) => h.includes('本次打印数量'))
  const boxIdx = heads.findIndex((h) => h.includes('每箱数量'))
  const rows = [...d.querySelectorAll('.el-table__body tbody tr')].map((tr) => {
    const tds = [...tr.querySelectorAll('td')]
    const q = tds[qtyIdx]?.querySelector('input')
    const b = tds[boxIdx]?.querySelector('input')
    return q || b ? { qty: q?.value ?? null, qtyDisabled: q?.disabled ?? null, box: b?.value ?? null, boxDisabled: b?.disabled ?? null } : null
  }).filter(Boolean)
  return { rows, banner: (d.querySelector('.mlq-lock')?.textContent || '').replace(/\\s+/g, ' ').trim() }
}, pickVisible)
console.log('BEFORE ' + JSON.stringify(await readMain()))

// 展开「打印采购订单记录」
await page.evaluate((expr) => {
  // eslint-disable-next-line no-eval
  const d = eval(expr)
  const head = [...(d?.querySelectorAll('.el-collapse-item__header') || [])].find((h) => (h.textContent || '').includes('打印采购订单记录'))
  head?.click()
}, pickVisible)
await page.waitForTimeout(1800)

const btn = await page.evaluate((expr) => {
  // eslint-disable-next-line no-eval
  const d = eval(expr)
  const po = [...(d?.querySelectorAll('.el-collapse-item') || [])].find((it) => (it.textContent || '').includes('打印采购订单记录'))
  const b = po ? [...po.querySelectorAll('button')].find((x) => (x.textContent || '').includes('按这次打印打码')) : null
  if (!b) return { ok: false }
  b.scrollIntoView({ block: 'center' })
  const r = b.getBoundingClientRect()
  const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
  return { ok: true, r: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], hitIsBtn: hit === b || b.contains(hit), hit: (hit?.textContent || '').trim().slice(0, 20) }
}, pickVisible)
console.log('BTN ' + JSON.stringify(btn))
if (btn.ok) {
  await page.mouse.click(btn.r[0] + btn.r[2] / 2, btn.r[1] + btn.r[3] / 2)
}
await page.waitForTimeout(7000)
const afterLoad = await readMain()
const msgs = await page.evaluate(() => [...document.querySelectorAll('.el-message__content')].map((e) => (e.textContent || '').trim()))
console.log('AFTER_LOAD ' + JSON.stringify(afterLoad) + ' MSGS ' + JSON.stringify(msgs))

// 锁定态下填每箱数量
const typed = await page.evaluate((expr) => {
  // eslint-disable-next-line no-eval
  const d = eval(expr)
  const heads = [...d.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').trim())
  const boxIdx = heads.findIndex((h) => h.includes('每箱数量'))
  const tr = d.querySelectorAll('.el-table__body tbody tr')[0]
  const inp = tr?.querySelectorAll('td')[boxIdx]?.querySelector('input')
  if (!inp) return { ok: false, why: 'no input' }
  if (inp.disabled) return { ok: false, why: 'disabled' }
  inp.focus()
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(inp, '120')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
  inp.blur()
  return { ok: true, value: inp.value }
}, pickVisible)
await page.waitForTimeout(900)
const final = await readMain()
const hint = await page.evaluate((expr) => {
  // eslint-disable-next-line no-eval
  const d = eval(expr)
  return (d?.querySelector('.mlq-box-hint')?.textContent || '').replace(/\s+/g, ' ').trim()
}, pickVisible)
console.log('TYPED ' + JSON.stringify(typed) + ' FINAL ' + JSON.stringify(final) + ' HINT ' + hint)
await fs.writeFile('C:/Users/Lenovo/ego/label-box-editable-20261113/round-08.json',
  JSON.stringify({ btn, afterLoad, msgs, typed, final, hint }, null, 2), 'utf8')
