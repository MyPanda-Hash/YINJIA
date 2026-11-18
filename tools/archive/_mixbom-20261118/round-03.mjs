const task = await taskSpace('asm-bom-check-20261118')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/panelx/list/MIX_BOM?docNo=MIX-2026-11-0001', { timeout: 30000 })
await page.waitForTimeout(3500)
try { const w = await page.cdp('Browser.getWindowForTarget', {}); if (w?.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } }); await page.waitForTimeout(400) } catch (e) {}
const info = await page.evaluate(() => ({
  doc: document.body.innerText.match(/单据：\s*\S+/)?.[0] || '',
  rows: [...document.querySelectorAll('.el-table__body tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').trim()).join(' | ')).filter((s) => s.replace(/\|/g, '').trim()).slice(0, 6),
  menu: (() => { const el = [...document.querySelectorAll('.nav-module')].find(e => (e.textContent||'').trim() === '物料及价格'); if (el) { el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })); el.click() } return 'clicked' })(),
}))
console.log(JSON.stringify(info, null, 1))
await page.waitForTimeout(1200)
const card = await page.evaluate(() => [...document.querySelectorAll('.fly-card .card-item')].map((e) => (e.textContent || '').trim()))
console.log('MENU', JSON.stringify(card))
await page.screenshot({ path: 'C:/Users/vigna/ego/asm-bom-check-20261118/03-8090-mix.png' })
