// round-06: 关掉所有残留弹窗 → 重新打开「打印材料码」→ 用**可见的那个** dialog 定位 → 带入 → 量锁定
const fs = await import('node:fs/promises')
const task = await taskSpace('label-box-editable-20261113')
const page = task.page('p1')
await page.waitForTimeout(300)

// 关掉所有弹窗(避免命中隐藏副本)
await page.evaluate(() => {
  for (let i = 0; i < 6; i++) {
    const btns = [...document.querySelectorAll('.el-dialog__headerbtn')]
    if (!btns.length) break
    btns.forEach((b) => b.click())
  }
})
await page.waitForTimeout(1200)

// 重新打开
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

// 只认**可见**的对话框
const open = await page.evaluate(() => {
  const all = [...document.querySelectorAll('.el-dialog')].filter((d) => (d.textContent || '').includes('打印材料码'))
  const vis = all.filter((d) => d.getBoundingClientRect().width > 0 && d.getBoundingClientRect().height > 0)
  return { total: all.length, visible: vis.length, title: (vis[0]?.querySelector('.el-dialog__title')?.textContent || '').trim() }
})
console.log('DLG ' + JSON.stringify(open))

// 只认可见 dialog 里的表
const readMain = () => page.evaluate(() => {
  const vis = [...document.querySelectorAll('.el-dialog')]
    .filter((d) => (d.textContent || '').includes('打印材料码') && d.getBoundingClientRect().width > 0)
  const d = vis[vis.length - 1]
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
  return { rows, banner: (d.querySelector('.mlq-lock')?.textContent || '').replace(/\s+/g, ' ').trim() }
})
console.log('BEFORE ' + JSON.stringify(await readMain()))

// 展开「打印采购订单记录」并滚到按钮,用真实鼠标点
await page.evaluate(() => {
  const vis = [...document.querySelectorAll('.el-dialog')]
    .filter((d) => (d.textContent || '').includes('打印材料码') && d.getBoundingClientRect().width > 0)
  const d = vis[vis.length - 1]
  const head = [...d.querySelectorAll('.el-collapse-item__header')].find((h) => (h.textContent || '').includes('打印采购订单记录'))
  head?.click()
})
await page.waitForTimeout(1800)
const rect = await page.evaluate(() => {
  const vis = [...document.querySelectorAll('.el-dialog')]
    .filter((d) => (d.textContent || '').includes('打印材料码') && d.getBoundingClientRect().width > 0)
  const d = vis[vis.length - 1]
  const po = [...d.querySelectorAll('.el-collapse-item')].find((it) => (it.textContent || '').includes('打印采购订单记录'))
  const btns = po ? [...po.querySelectorAll('button')].filter((b) => (b.textContent || '').includes('按这次打印打码')) : []
  if (!btns.length) return { ok: false, n: 0 }
  const btn = btns[0]
  btn.scrollIntoView({ block: 'center' })
  const r = btn.getBoundingClientRect()
  const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
  return { ok: true, n: btns.length, r: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], hit: (hit?.textContent || '').trim().slice(0, 20), hitIsBtn: hit === btn || btn.contains(hit) }
})
console.log('BTN ' + JSON.stringify(rect))
if (rect.ok && rect.hitIsBtn) {
  await page.mouse.click(rect.r[0] + rect.r[2] / 2, rect.r[1] + rect.r[3] / 2)
} else if (rect.ok) {
  // 命中不是按钮(被遮挡):直接对元素派发完整事件序列
  await page.evaluate(() => {
    const vis = [...document.querySelectorAll('.el-dialog')]
      .filter((d) => (d.textContent || '').includes('打印材料码') && d.getBoundingClientRect().width > 0)
    const d = vis[vis.length - 1]
    const po = [...d.querySelectorAll('.el-collapse-item')].find((it) => (it.textContent || '').includes('打印采购订单记录'))
    const btn = [...po.querySelectorAll('button')].find((b) => (b.textContent || '').includes('按这次打印打码'))
    ;['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((t) => {
      btn.dispatchEvent(new (t.startsWith('pointer') ? PointerEvent : MouseEvent)(t, { bubbles: true, cancelable: true }))
    })
  })
}
await page.waitForTimeout(7000)
const afterLoad = await readMain()
console.log('AFTER_LOAD ' + JSON.stringify(afterLoad))
const msgs = await page.evaluate(() => [...document.querySelectorAll('.el-message__content')].map((e) => (e.textContent || '').trim()))
console.log('MSGS ' + JSON.stringify(msgs))

// 锁定态下填每箱数量
const typed = await page.evaluate(() => {
  const vis = [...document.querySelectorAll('.el-dialog')]
    .filter((d) => (d.textContent || '').includes('打印材料码') && d.getBoundingClientRect().width > 0)
  const d = vis[vis.length - 1]
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
})
await page.waitForTimeout(900)
const final = await page.evaluate(() => {
  const vis = [...document.querySelectorAll('.el-dialog')]
    .filter((d) => (d.textContent || '').includes('打印材料码') && d.getBoundingClientRect().width > 0)
  const d = vis[vis.length - 1]
  const heads = [...d.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').trim())
  const boxIdx = heads.findIndex((h) => h.includes('每箱数量'))
  const tr = d.querySelectorAll('.el-table__body tbody tr')[0]
  return {
    boxValue: tr?.querySelectorAll('td')[boxIdx]?.querySelector('input')?.value ?? null,
    hint: (d.querySelector('.mlq-box-hint')?.textContent || '').replace(/\s+/g, ' ').trim(),
    banner: (d.querySelector('.mlq-lock')?.textContent || '').replace(/\s+/g, ' ').trim(),
  }
})
console.log('TYPED ' + JSON.stringify(typed) + ' FINAL ' + JSON.stringify(final))
await fs.writeFile('C:/Users/Lenovo/ego/label-box-editable-20261113/round-06.json',
  JSON.stringify({ open, rect, afterLoad, msgs, typed, final }, null, 2), 'utf8')
