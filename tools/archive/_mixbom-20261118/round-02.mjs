const task = await taskSpace('asm-bom-check-20261118')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/panelx/list/ASM_BOM?docNo=C-23-11_V0001', { timeout: 30000 })
await page.waitForTimeout(3500)
try { const w = await page.cdp('Browser.getWindowForTarget', {}); if (w?.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } }); await page.waitForTimeout(400) } catch (e) {}
const info = await page.evaluate(() => ({
  doc: document.body.innerText.match(/单据：\s*\S+/)?.[0] || '',
  nav: document.body.innerText.match(/第\s*\d+\/\d+\s*张/)?.[0] || '',
  rows: [...document.querySelectorAll('.el-table__body tbody tr')].map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').trim()).join(' | ')).filter((s) => s.replace(/\|/g, '').trim()).slice(0, 8),
  text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 700),
}))
console.log(JSON.stringify(info, null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/asm-bom-check-20261118/02-restored.png' })
