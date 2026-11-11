// round-03:已完成页签翻到第 2 页(验证服务端过滤跨页)/ 点行切单 / 英文界面下页签译名
const OUT = 'C:/Users/vigna/ego/oqc-rail-tabs-20261110'
const task = await taskSpace('oqc-rail-tabs-20261110')
const page = task.page('p1')

async function shot(name) {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
  await page.screenshot({ path: `${OUT}/${name}.png` })
}

const probe = () => page.evaluate(() => {
  const q = (s) => document.querySelector(s)
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  const rail = q('.doc-select-rail')
  const rows = rail ? [...rail.querySelectorAll('.dsr-grid tbody tr')] : []
  return {
    hash: location.hash,
    tabs: [...document.querySelectorAll('.dsr-tabs .dsr-tab')].map((b) => ({ text: b.textContent.trim(), active: b.classList.contains('active') })),
    count: txt(q('.dsr-count')),
    pager: txt(q('.drp')),
    rowCount: rows.length,
    tagCounts: (rail ? [...rail.querySelectorAll('.dsr-grid tbody .dsr-tag')] : []).reduce((a, el) => { const k = el.textContent.trim(); a[k] = (a[k] || 0) + 1; return a }, {}),
    firstRow: rows[0] ? [...rows[0].querySelectorAll('td')].map((td) => td.textContent.replace(/\s+/g, ' ').trim()) : null,
    currentDoc: txt(q('.doc-chip')),
    errToasts: [...document.querySelectorAll('.el-message--error')].map((e) => e.textContent.trim()),
  }
})

await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 30000 })
await page.waitForTimeout(4000)

// 1) 已完成 → 下一页
await page.evaluate(() => [...document.querySelectorAll('.dsr-tabs .dsr-tab')].find((x) => x.textContent.trim() === '已完成')?.click())
await page.waitForTimeout(2500)
const p1 = await probe()
const clicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.drp .drp-btn')].find((x) => x.textContent.trim() === '▶')
  if (!b) return false
  b.click()
  return true
})
await page.waitForTimeout(2800)
console.log('DONE_P1=' + JSON.stringify(p1))
console.log('DONE_P2=' + JSON.stringify({ clicked, ...(await probe()) }))
await shot('round-03-done-page2')

// 2) 未完成 → 点第 3 行切单(验证左栏点行仍能切右侧单据)
await page.evaluate(() => [...document.querySelectorAll('.dsr-tabs .dsr-tab')].find((x) => x.textContent.trim() === '未完成')?.click())
await page.waitForTimeout(2500)
const todoList = await page.evaluate(() => [...document.querySelectorAll('.dsr-grid tbody tr')].map((tr) => tr.querySelector('td')?.textContent.trim()).slice(0, 5))
await page.evaluate(() => { const tr = document.querySelectorAll('.dsr-grid tbody tr')[2]; if (tr) tr.click() })
await page.waitForTimeout(2000)
console.log('TODO_ROWCLICK=' + JSON.stringify({ todoList, ...(await probe()) }))
await shot('round-03-todo-rowclick')

// 3) 英文界面:页签是否走 tt() 出了英文
await page.evaluate(() => localStorage.setItem('mes_locale', 'en'))
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 30000 })
await page.waitForTimeout(5000)
console.log('EN=' + JSON.stringify(await probe()))
await shot('round-03-en-tabs')

// 4) 还原简中
await page.evaluate(() => localStorage.setItem('mes_locale', 'zh-CN'))
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 30000 })
await page.waitForTimeout(4000)
console.log('RESTORED=' + JSON.stringify(await probe()))
