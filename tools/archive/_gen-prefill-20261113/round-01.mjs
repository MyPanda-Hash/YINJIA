// round-01(#1 不要滚动):正式库只读 —— 打开「批量生单」对话框,量内层滚动条是否消失。
const fs = await import('node:fs/promises')
const task = await taskSpace('gen-noscroll-prefill-20261113')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
await page.waitForTimeout(6000)

// 左栏勾一张「已审核」的订单(批量生单要靠勾选)
const picked = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.dsr-grid tbody tr')]
  for (const r of rows) {
    const tag = (r.querySelector('.dsr-tag')?.textContent || '').trim()
    if (tag !== '已审核') continue
    const box = r.querySelector('.dsr-check input[type="checkbox"], .dsr-check .el-checkbox')
    box?.click()
    return { ok: true, cells: [...r.querySelectorAll('td')].map((td) => (td.textContent || '').trim()).slice(1, 5) }
  }
  return { ok: false }
})
console.log('RAIL_PICK ' + JSON.stringify(picked))
await page.waitForTimeout(1200)

// 打开「生单 ▼」下拉,点「批量生单」
await page.evaluate(() => {
  const groups = [...document.querySelectorAll('.tools .tb-group')]
  const g = groups.find((x) => (x.querySelector('.tb-main')?.textContent || '').trim() === '生单')
  g?.querySelector('.tb-caret')?.click()
})
await page.waitForTimeout(700)
const items = await page.evaluate(() => [...document.querySelectorAll('.tools .tb-menu .ctx-item')].map((el) => (el.textContent || '').trim()))
console.log('GEN_MENU ' + JSON.stringify(items))
const clicked = await page.evaluate(() => {
  const it = [...document.querySelectorAll('.tools .tb-menu .ctx-item')].find((el) => (el.textContent || '').includes('批量生单'))
  it?.click()
  return !!it
})
console.log('CLICK_BATCH ' + clicked)
await page.waitForTimeout(6000)

const metrics = await page.evaluate(() => {
  const dlg = [...document.querySelectorAll('.el-dialog')].find((d) => (d.textContent || '').includes('生单 →'))
  if (!dlg) return { open: false }
  const body = dlg.querySelector('.el-dialog__body')
  const wrap = dlg.querySelector('.gl')
  const tables = [...dlg.querySelectorAll('.el-table')]
  const scrollers = []
  for (const el of [dlg, body, wrap, ...tables]) {
    if (!el) continue
    const cs = getComputedStyle(el)
    const scrollable = el.scrollHeight - el.clientHeight > 4
    if (scrollable) scrollers.push({
      cls: (el.className || '').toString().slice(0, 60),
      scrollH: el.scrollHeight, clientH: el.clientHeight,
      overflowY: cs.overflowY,
    })
  }
  // 表格内层滚动(el-table__body-wrapper 限高时才出)
  const bodyWrappers = [...dlg.querySelectorAll('.el-table__body-wrapper')].map((el) => ({
    scrollH: el.scrollHeight, clientH: el.clientHeight, inner: el.scrollHeight - el.clientHeight > 4,
    overflowY: getComputedStyle(el).overflowY,
  }))
  return {
    open: true,
    title: (dlg.querySelector('.el-dialog__title')?.textContent || '').trim(),
    dialogHeight: dlg.clientHeight,
    viewportH: innerHeight,
    rows: dlg.querySelectorAll('.el-table__body tbody tr').length,
    docCards: dlg.querySelectorAll('.gl-doc').length,
    scrollers,
    bodyWrappers,
    hasMaxHeight: [...dlg.querySelectorAll('.el-table')].map((t) => getComputedStyle(t.querySelector('.el-table__body-wrapper') || t).maxHeight),
  }
})
console.log('METRICS ' + JSON.stringify(metrics, null, 2))
await fs.writeFile('C:/Users/Lenovo/ego/gen-noscroll-prefill-20261113/round-01.json', JSON.stringify({ picked, items, metrics }, null, 2), 'utf8')
