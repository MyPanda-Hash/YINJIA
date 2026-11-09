// Round6:8090 打包版验证检验徽标/提示/合格绿(Lead,2026-11-09)
const OUT = 'C:/Users/vigna/ego/wo-board-qc-lead-20261109'
const task = await taskSpace('wo-board-qc-lead-20261109')
const page = task.page('p1')
const BASE = 'http://127.0.0.1:8090/api'
async function apiLogin(factory) {
  const r = await fetch(BASE + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456', factory }) })
  const j = await r.json()
  return j?.data?.token
}
async function shot(name) {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) {}
  console.log('shot:', await page.screenshot({ path: OUT + '/' + name }))
}
const token = await apiLogin('YJ')
await page.evaluate((t) => { localStorage.setItem('mes_token', t) }, token)
await page.goto('http://127.0.0.1:8090/#/prod/plan/workOrderProgress', { timeout: 30000 })
await page.waitForTimeout(3000)
await page.reload({ timeout: 30000 })
await page.waitForTimeout(4500)
await page.evaluate(() => { localStorage.setItem('mes_locale', 'zh-CN') })
await page.reload({ timeout: 30000 })
await page.waitForTimeout(4500)
const board = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('.wpb-grid-row')]
  const idx = rows.findIndex((r) => txt(r).includes('GD-2026-11-0008'))
  const target = idx >= 0 ? rows[idx] : rows[0]
  return {
    origin: location.origin,
    rows: rows.length,
    stats: [...document.querySelectorAll('.wpb-stat')].map(txt),
    targetRow: target ? txt(target).slice(0, 460) : '',
    badges: target ? [...target.querySelectorAll('[class*="ins-"]')].map((b) => ({ cls: b.className, text: txt(b) })) : [],
    hint: target ? txt(target.querySelector('[class*="wpb-qc"]')) : '',
  }
})
console.log('8090_BOARD:', JSON.stringify(board, null, 2))
await shot('round-06-8090-board.png')
// 已完工:合格绿
await page.evaluate(() => {
  const sel = document.querySelectorAll('.wpb-toolbar .el-select')[0]
  const w = sel?.querySelector('.el-select__wrapper') || sel?.querySelector('.el-input__wrapper') || sel
  if (w) w.click()
})
await page.waitForTimeout(700)
await page.evaluate(() => {
  const it = [...document.querySelectorAll('.el-select-dropdown__item')].find((x) => (x.textContent || '').trim() === '已完工' && x.offsetParent !== null)
  if (it) it.click()
})
await page.waitForTimeout(2500)
const done = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('.wpb-grid-row')]
  const r0 = rows[0]
  const tag = r0 ? r0.querySelector('.wpb-status') : null
  const qc = r0 ? r0.querySelector('[class*="wpb-qc"]') : null
  return {
    rows: rows.length,
    statusTag: tag ? { cls: tag.className, color: getComputedStyle(tag).color, text: txt(tag) } : null,
    qcTag: qc ? { cls: qc.className, color: getComputedStyle(qc).color, text: txt(qc) } : null,
    firstRow: r0 ? txt(r0).slice(0, 320) : '',
  }
})
console.log('8090_DONE:', JSON.stringify(done, null, 2))
await shot('round-06-8090-done.png')
await task.finish({ keep: [] })
console.log('ROUND6_DONE')
