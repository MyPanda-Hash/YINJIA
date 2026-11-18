const task = await taskSpace('asm-bom-check-20261118')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/panelx/list/MIX_BOM', { timeout: 30000 })
await page.waitForTimeout(2500)
const info = await page.evaluate(() => ({
  scripts: [...document.querySelectorAll('script[src]')].map((s) => s.src.split('/').pop()).slice(0, 8),
  hasMixInDoc: !!document.querySelector('script[src*="index-CIp-Kyhp"]'),
}))
console.log(JSON.stringify(info, null, 1))
// 强制无缓存刷新:加时间戳参数走一次整页加载
await page.goto('http://127.0.0.1:8090/index.html?v=' + Date.now(), { timeout: 30000 })
await page.waitForTimeout(2000)
await page.goto('http://127.0.0.1:8090/#/panelx/list/MIX_BOM', { timeout: 30000 })
await page.waitForTimeout(3000)
const info2 = await page.evaluate(() => ({
  scripts: [...document.querySelectorAll('script[src]')].map((s) => s.src.split('/').pop()).slice(0, 8),
}))
console.log('AFTER', JSON.stringify(info2))
await page.evaluate(() => { const el = [...document.querySelectorAll('.nav-module')].find(e => (e.textContent||'').trim() === '物料及价格'); if (el) { el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); el.click(); } })
await page.waitForTimeout(1200)
const card = await page.evaluate(() => [...document.querySelectorAll('.fly-card .card-item')].map((e) => (e.textContent || '').trim()))
console.log('MENU', JSON.stringify(card))
await page.screenshot({ path: 'C:/Users/vigna/ego/asm-bom-check-20261118/04-menu-8090.png' })
