const task = await taskSpace('mixbom-20261118')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MIX_BOM', { timeout: 30000 })
await page.waitForTimeout(2500)
// 展开「数据建模」→「物料及价格」
const open = await page.evaluate(() => {
  const walk = (el) => {
    const t = (el.textContent || '').trim()
    if (t === '数据建模' || t === '物料及价格') { el.click(); return t }
    for (const c of el.children) { const r = walk(c); if (r) return r }
    return ''
  }
  const navItems = [...document.querySelectorAll('.left-nav *')]
  const dm = navItems.find((e) => (e.textContent || '').trim() === '数据建模')
  if (dm) dm.click()
  return dm ? 'dm-clicked' : 'no-dm'
})
await page.waitForTimeout(1200)
const open2 = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.left-nav *')]
  const bmat = items.find((e) => (e.textContent || '').trim() === '物料及价格')
  if (bmat) { bmat.click(); return 'bmat-clicked' }
  return 'no-bmat'
})
await page.waitForTimeout(1200)
const menu = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.left-nav *')].map((e) => (e.textContent || '').trim()).filter(Boolean)
  return { has: items.includes('混料物料清单'), tail: items.slice(-30) }
})
console.log('OPEN', open, open2)
console.log(JSON.stringify(menu, null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/mixbom-20261118/08-menu.png' })
