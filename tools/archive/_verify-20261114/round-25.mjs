// round-25 — B1 悬停「品质管理」打开浮层卡片 → 找「制程品质」列 → 点「巡线检验」
const OUT = 'C:/Users/vigna/ego/verify-20261114'
const fs = await import('node:fs/promises')
const task = await taskSpace('verify-20261114')
const page = (await task.pages())[0]
async function normalWin() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) {}
}
await page.goto('http://localhost:5173/#/dashboard', { timeout: 40000 })
await page.waitForTimeout(6000)

const hover = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const grp = [...document.querySelectorAll('.leftnav .nav-group')].find((e) => txt(e).includes('品质管理'))
  if (!grp) return { ok: false }
  grp.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false, cancelable: true, view: window }))
  return { ok: true }
})
console.log('HOVER=' + JSON.stringify(hover))
await page.waitForTimeout(2000)
const card = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const fc = [...document.querySelectorAll('.fly-card')].find((e) => e.offsetParent !== null)
  return {
    card: !!fc,
    groups: fc ? [...fc.querySelectorAll('.card-group-title')].map((e) => txt(e)) : [],
    items: fc ? [...fc.querySelectorAll('.card-item')].map((e) => txt(e)) : [],
  }
})
console.log('CARD=' + JSON.stringify(card, null, 1))
await normalWin()
await page.screenshot({ path: OUT + '/round-25-menu-card.png' })

const go = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const fc = [...document.querySelectorAll('.fly-card')].find((e) => e.offsetParent !== null)
  if (!fc) return { ok: false, why: 'no card' }
  const item = [...fc.querySelectorAll('.card-item')].find((e) => txt(e).includes('巡线检验'))
  if (!item) return { ok: false, why: 'no item' }
  item.click()
  return { ok: true }
})
console.log('CLICK_ITEM=' + JSON.stringify(go))
await page.waitForTimeout(7000)
const landed = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  return {
    hash: location.hash,
    kickedToLogin: !!document.querySelector('input[placeholder*="账号"]'),
    sideBtns: [...document.querySelectorAll('.as-side-btn')].map((e) => txt(e)),
    tabs: [...document.querySelectorAll('.tabs-bar .tab, .tab-item')].map((e) => txt(e)).slice(0, 8),
  }
})
console.log('LANDED=' + JSON.stringify(landed))
await normalWin()
await page.screenshot({ path: OUT + '/round-25-patrol-entered.png' })
await fs.writeFile(OUT + '/b1-click.json', JSON.stringify({ hover, card, go, landed }, null, 1), 'utf8')
console.log('DONE round-25')
