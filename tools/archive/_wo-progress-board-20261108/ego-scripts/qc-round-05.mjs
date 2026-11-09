// 第4轮 Round4:测试库看板 合格绿 / 不合格红(测试库造数) + 审核结果可见
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

const token = await apiLogin('YJ_TEST')
await page.evaluate((t) => { localStorage.setItem('mes_token', t) }, token)
await page.goto('http://localhost:5173/#/prod/plan/workOrderProgress', { timeout: 30000 })
await page.waitForTimeout(2500)
await page.reload({ timeout: 30000 })
await page.waitForTimeout(4500)
// 已完工视图(测试库唯一完工行 GD-2026-10-0001)
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

const state = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const rows = [...document.querySelectorAll('.wpb-grid-row')]
  const r0 = rows[0]
  const tag = r0 ? r0.querySelector('.wpb-status') : null
  const cs = tag ? getComputedStyle(tag) : null
  const qcTag = r0 ? r0.querySelector('[class*="wpb-qc"]') : null
  const qcCs = qcTag ? getComputedStyle(qcTag) : null
  const badges = r0 ? [...r0.querySelectorAll('[class*="ins-"]')].map((b) => ({ cls: b.className, text: txt(b), color: getComputedStyle(b).color, bg: getComputedStyle(b).backgroundColor })) : []
  return {
    rows: rows.length,
    firstRowText: r0 ? txt(r0).slice(0, 460) : '',
    statusTag: tag ? { cls: tag.className, text: txt(tag), color: cs.color, bg: cs.backgroundColor } : null,
    qcTag: qcTag ? { cls: qcTag.className, text: txt(qcTag), color: qcCs.color, bg: qcCs.backgroundColor } : null,
    badges,
    stats: [...document.querySelectorAll('.wpb-stat')].map(txt),
    name: document.body.innerText.includes('测试库'),
  }
})
console.log('FIXTURE_STATE:', JSON.stringify(state, null, 2))
await shot('round-05-red.png')
console.log('ROUND4_DONE')
