// Round 4:看板视图筛选/搜索 + 列表宽度复核 + 最终截图(Lead 终验,2026-11-08)
const OUT = 'C:/Users/vigna/ego/wo-progress-board-lead-final-20261108'
const task = await taskSpace('wo-progress-board-lead-final-20261108')
const page = task.page('p1')

async function restoreWindow(p) {
  try {
    const w = await p.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await p.waitForTimeout(300)
  } catch (e) { console.log('restore skip: ' + e.message) }
}
async function shot(name) {
  await restoreWindow(page)
  console.log('shot:', await page.screenshot({ path: OUT + '/' + name }))
}
const pickSelect = async (index, label) => {
  await page.evaluate((i) => {
    const sel = document.querySelectorAll('.wpb-toolbar .el-select')[i]
    const w = sel?.querySelector('.el-select__wrapper') || sel?.querySelector('.el-input__wrapper') || sel
    if (w) w.click()
  }, index)
  await page.waitForTimeout(700)
  const ok = await page.evaluate((lab) => {
    const it = [...document.querySelectorAll('.el-select-dropdown__item')].find((x) => (x.textContent || '').trim() === lab && x.offsetParent !== null)
    if (it) { it.click(); return true }
    return false
  }, label)
  await page.waitForTimeout(2000)
  return ok
}
const setKeyword = async (kw) => {
  await page.evaluate((v) => {
    const input = document.querySelector('.wpb-kw input')
    if (!input) return
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(input, v)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }))
  }, kw)
  await page.waitForTimeout(2000)
}

// 刷新页面,确保看板视图(默认)且数据最新
await page.reload({ timeout: 30000 })
await page.waitForTimeout(4000)
let hash = await page.evaluate(() => location.hash)
if (String(hash).includes('/login')) {
  await page.evaluate(() => {
    const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
    const ins = [...document.querySelectorAll('input')]
    const u = ins.find((i) => (i.placeholder || '').includes('账号'))
    const p = ins.find((i) => (i.placeholder || '').includes('密码'))
    if (u) setVal(u, 'admin'); if (p) setVal(p, '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(4000)
  await page.reload({ timeout: 30000 })
  await page.waitForTimeout(4000)
}

// ① 看板视图:未完工 14 行
const board0 = await page.evaluate(() => ({
  viewBoardActive: !!document.querySelector('.wpb-grid-row'),
  rows: document.querySelectorAll('.wpb-grid-row').length,
  rings: [...document.querySelectorAll('.wpb-grid-row svg')].filter((s) => s.querySelector('circle')).length,
}))
console.log('BOARD_DEFAULT:', JSON.stringify(board0))
await shot('round-04-board-default.png')

// ② 筛选 已完工 → 看板行应全部是已完工/已结案,环形绿
const okDone = await pickSelect(0, '已完工')
const done = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.wpb-grid-row')]
  const statuses = [...new Set(rows.map((r) => (r.querySelector('.wpb-status')?.textContent || '').trim()))]
  const ringStates = [...new Set([...document.querySelectorAll('.wpb-grid-row .wpr')].map((x) => (x.className || '').includes('st-done') ? 'done' : (x.className || '').includes('st-doing') ? 'doing' : 'idle'))]
  return { rows: rows.length, statuses, ringStates, stats: [...document.querySelectorAll('.wpb-stat')].map((s) => (s.textContent || '').replace(/\s+/g, ' ').trim()) }
})
console.log('DONE_FILTER(pick=' + okDone + '):', JSON.stringify(done))
await shot('round-04-filter-done-board.png')

// ③ 切回未完工 + 关键字搜索
await pickSelect(0, '未完工')
await setKeyword('GD-2026-11-0008')
const search = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.wpb-grid-row')]
  return { rows: rows.length, first: rows.length ? (rows[0].textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200) : '' }
})
console.log('SEARCH:', JSON.stringify(search))
await shot('round-04-search.png')
await setKeyword('')

// ④ 列表视图:宽度复核(修复列宽后应无横向滚动)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-radio-button__inner')].find((x) => (x.textContent || '').includes('列表'))
  if (b) b.click()
})
await page.waitForTimeout(1600)
const listGeom = await page.evaluate(() => {
  const table = document.querySelector('.wpb-table')
  const bodyWrap = document.querySelector('.wpb-table .el-scrollbar__wrap') || document.querySelector('.wpb-table .el-table__body-wrapper')
  const ths = [...document.querySelectorAll('.wpb-table th')].map((th) => ({ t: (th.textContent || '').trim(), w: Math.round(th.getBoundingClientRect().width) }))
  const tds = [...document.querySelectorAll('.wpb-table .el-table__body tr:first-child td')].map((td) => ({ t: (td.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30), w: Math.round(td.getBoundingClientRect().width) }))
  const lastTd = tds[tds.length - 1]
  const lastTh = ths[ths.length - 1]
  return {
    rows: document.querySelectorAll('.wpb-table .el-table__body tr').length,
    table: table ? { client: table.clientWidth, scroll: table.scrollWidth } : null,
    bodyWrap: bodyWrap ? { client: bodyWrap.clientWidth, scroll: bodyWrap.scrollWidth } : null,
    ths, tds, lastTh, lastTd,
    thsSum: ths.reduce((a, b) => a + b.w, 0),
  }
})
console.log('LIST_GEOM:', JSON.stringify(listGeom, null, 2))
await shot('round-04-list-fixed.png')

// ⑤ 还原看板视图,留最终截图
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-radio-button__inner')].find((x) => (x.textContent || '').includes('看板'))
  if (b) b.click()
})
await page.waitForTimeout(1200)
await page.evaluate(() => { localStorage.setItem('mes_locale', 'zh-CN') })
await page.reload({ timeout: 30000 })
await page.waitForTimeout(4000)
await shot('round-04-final-board.png')
const finalState = await page.evaluate(() => ({
  hash: location.hash,
  view: document.querySelector('.wpb-grid-row') ? 'board' : (document.querySelector('.wpb-table') ? 'list' : 'unknown'),
  rows: document.querySelectorAll('.wpb-grid-row').length,
  rings: [...document.querySelectorAll('.wpb-grid-row svg')].filter((s) => s.querySelector('circle')).length,
  noHorizontalOverflow: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  locale: localStorage.getItem('mes_locale'),
}))
console.log('FINAL:', JSON.stringify(finalState, null, 2))
console.log('ROUND4_DONE')
