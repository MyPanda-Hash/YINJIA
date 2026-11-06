const task = await taskSpace('qc-insp-req-hint-20261106')
const page = task.page('p1')

await page.goto('http://127.0.0.1:8090/#/panelx/list/QC_INSP_REC?docNo=JYSJ-2026-11-0001', { timeout: 45000 })
await page.waitForTimeout(4000)
await page.reload({ timeout: 45000 })
await page.waitForTimeout(10000)

const out = await page.evaluate(() => {
  const signRow = [...document.querySelectorAll('table tr')].find((r) => (r.innerText || '').includes('检验人'))
  const span = signRow && signRow.querySelector('.qr-sign')
  return {
    hash: location.hash,
    signText: span ? (span.innerText || '').trim() : null,
    signTitle: span ? span.getAttribute('title') : null,
    signRowText: signRow ? (signRow.innerText || '').replace(/\s+/g, ' ').trim() : null,
    bodyHasHint: (document.body.innerText || '').includes('新增时按登录人生成'),
    mat: (document.querySelectorAll('.qr-value-code .qr-ref-text')[0]?.innerText || '').trim(),
  }
})
console.log(JSON.stringify(out, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-inspector-hint-20261106/round-05.png' })
