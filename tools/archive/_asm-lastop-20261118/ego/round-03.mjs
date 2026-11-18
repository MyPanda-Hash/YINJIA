// round-03:打开出货检验表观的「选生产工单」弹窗并读列表(只读,不点确定)
const OUT = 'C:/Users/vigna/ego/ship-insp-lastop-20261118'
const task = await taskSpace('ship-insp-lastop-20261118')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_ASM_INSP', { timeout: 60000 })
await page.waitForTimeout(6000)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) {
    await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  }
  await page.waitForTimeout(400)
} catch (e) {
  console.log('restore skip: ' + e.message)
}

const clicked = await page.evaluate(() => {
  const all = [...document.querySelectorAll('div, span, a, li, button')]
  const el = all.filter((n) => (n.textContent || '').trim() === '选生产工单').pop()
  if (!el) return false
  el.click()
  return true
})
console.log('clicked =', clicked)
await page.waitForTimeout(4500)

const dump = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => (d.textContent || '').includes('选生产工单'))
  if (!dlg) return { dialog: false, body: (document.body.innerText || '').slice(0, 200) }
  const rows = [...dlg.querySelectorAll('.el-table__body tr')].map((tr) =>
    [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()))
  return {
    dialog: true,
    title: (dlg.querySelector('.el-dialog__title') || {}).textContent?.trim(),
    tip: (dlg.querySelector('.wopick-tip') || {}).textContent?.trim(),
    gate: (dlg.querySelector('.wopick-gate') || {}).textContent?.trim(),
    heads: [...dlg.querySelectorAll('.el-table__header th')].map((th) => (th.textContent || '').trim()),
    total: (dlg.querySelector('.el-pagination__total') || {}).textContent?.trim(),
    rows: rows.slice(0, 10),
    greyRows: [...dlg.querySelectorAll('.el-table__body tr.wopick-blocked')].length,
  }
})
console.log('ASM dialog =', JSON.stringify(dump, null, 2))
await page.screenshot({ path: OUT + '/03-asm-picker.png' })

// 键盘 Esc 关掉弹窗,顺便确认「确定」按钮在未选中时禁用(不点)
const footer = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => (d.textContent || '').includes('选生产工单'))
  return [...(dlg ? dlg.querySelectorAll('button') : [])].map((b) => ({
    text: (b.textContent || '').trim(), disabled: b.disabled,
  }))
})
console.log('footer =', JSON.stringify(footer))
await task.finish({ keep: [] })
