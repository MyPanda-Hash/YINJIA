// Round2:8090 打包版单级审批入口验证(Lead,2026-11-09)
const OUT = 'C:/Users/vigna/ego/insp-single-level-20261109'
const task = await taskSpace('insp-single-level-20261109')
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
await page.evaluate((t) => { localStorage.setItem('mes_token', t); localStorage.setItem('mes_locale', 'zh-CN') }, token)
await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_FIRST_INSP', { timeout: 30000 })
await page.waitForTimeout(3000)
await page.reload({ timeout: 30000 })
await page.waitForTimeout(4500)
const st = await page.evaluate(() => {
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const side = [...document.querySelectorAll('.as-side-btn')].map((b) => txt(b))
  return {
    origin: location.origin, hash: location.hash,
    sideButtons: side,
    hasSubmit: side.some((t) => t.includes('提交审批')),
    hasApprove: side.some((t) => t === '审批通过'),
    hasL2Approve: side.some((t) => t.includes('一级') || t.includes('批准通过') || t.includes('二级')),
    status: txt(document.querySelector('.as-status, [class*="status"]')),
  }
})
console.log('8090_SINGLE_LEVEL:', JSON.stringify(st, null, 2))
await shot('round-06-8090-first-insp.png')
await task.finish({ keep: [] })
console.log('ROUND2_DONE')
