const task = await taskSpace('asm-bom-check-20261118')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/index.html?v=' + Date.now(), { timeout: 30000 })
await page.waitForTimeout(1200)
await page.goto('http://127.0.0.1:8090/#/panelx/list/MIX_BOM?docNo=MIX-2026-11-0002', { timeout: 30000 })
await page.waitForTimeout(3500)
try { const w = await page.cdp('Browser.getWindowForTarget', {}); if (w?.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } }); await page.waitForTimeout(400) } catch (e) {}
const info = await page.evaluate(() => ({
  doc: document.body.innerText.match(/单据：\s*\S+/)?.[0] || '',
  prod: (() => { const ins = [...document.querySelectorAll('input')]; const i = ins.find(x => x.value === 'B-92-25' || x.value === 'B-92-25-tb'); return i ? i.value : '' })(),
  text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 500),
}))
console.log(JSON.stringify(info, null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/asm-bom-check-20261118/10-strip-tb.png' })
