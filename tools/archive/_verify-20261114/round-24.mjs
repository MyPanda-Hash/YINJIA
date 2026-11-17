// round-24 — B1 点击路径:左导航 品质管理 → 制程品质 → 巡线检验 → 进页面
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

const nav = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const ln = document.querySelector('.leftnav')
  return {
    leftnav: !!ln,
    collapsed: ln ? ln.classList.contains('collapsed') : null,
    groups: [...document.querySelectorAll('.leftnav .nav-group')].map((e) => txt(e)),
    bodyHasPatrol: txt(document.body).includes('巡线检验'),
  }
})
console.log('NAV=' + JSON.stringify(nav))

const g = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const grp = [...document.querySelectorAll('.leftnav .nav-group')].find((e) => txt(e).includes('品质管理'))
  if (!grp) return { ok: false }
  grp.click()
  return { ok: true, t: txt(grp) }
})
console.log('CLICK_GROUP=' + JSON.stringify(g))
await page.waitForTimeout(1200)
const modules = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  return { modules: [...document.querySelectorAll('.leftnav .nav-module')].map((e) => txt(e)), groups: [...document.querySelectorAll('.leftnav .nav-group')].map((e) => txt(e)) }
})
console.log('MODULES=' + JSON.stringify(modules))

const m = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  const mod = [...document.querySelectorAll('.leftnav .nav-module')].find((e) => txt(e).includes('制程品质'))
  if (!mod) return { ok: false }
  mod.click()
  return { ok: true, t: txt(mod) }
})
console.log('CLICK_MODULE=' + JSON.stringify(m))
await page.waitForTimeout(1500)
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
await page.screenshot({ path: OUT + '/round-24-menu-card.png' })

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
await page.waitForTimeout(6000)
const landed = await page.evaluate(() => {
  const txt = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '')
  return {
    hash: location.hash,
    kickedToLogin: !!document.querySelector('input[placeholder*="账号"]'),
    hasSheetOrList: !!document.querySelector('.lp-sheet, .as-side-btn, .el-table'),
    sideBtns: [...document.querySelectorAll('.as-side-btn')].map((e) => txt(e)),
  }
})
console.log('LANDED=' + JSON.stringify(landed))
await normalWin()
await page.screenshot({ path: OUT + '/round-24-patrol-entered.png' })
await fs.writeFile(OUT + '/b1-click.json', JSON.stringify({ nav, g, modules, m, card, go, landed }, null, 1), 'utf8')
console.log('DONE round-24')
