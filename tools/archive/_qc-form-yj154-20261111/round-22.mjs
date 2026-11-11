// round-22:用 CDP 直取截图(绕过 page.screenshot 超时);验「未完成默认 + 可编辑矩阵」与「旧单只读」
const OUT = 'C:/Users/vigna/ego/lead-qc-yj154-20261111'
const fs = await import('node:fs/promises')
const task = await taskSpace('lead-qc-yj154-20261111')
const page = task.page('p1')

async function cdpShot(name) {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { left: 20, top: 20, width: 1680, height: 1000, windowState: 'normal' } })
    try { await page.cdp('Page.bringToFront', {}) } catch (e) { }
    await page.waitForTimeout(1000)
    const r = await page.cdp('Page.captureScreenshot', { format: 'png' })
    const b64 = r?.data || r?.result?.data
    if (!b64) { console.log('CDP_SHOT_NO_DATA ' + name + ' ' + JSON.stringify(r).slice(0, 200)); return }
    await fs.writeFile(`${OUT}/${name}.png`, Buffer.from(b64, 'base64'))
    console.log('CDP_SHOT ' + name)
  } catch (e) { console.log('CDP_SHOT_FAIL ' + name + ': ' + e.message) }
}

const probe = () => page.evaluate(() => {
  const q = (s) => document.querySelector(s)
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  const sheet = q('.qr-sheet')
  const rows = sheet ? [...sheet.querySelectorAll('.qr-grid tbody tr')] : []
  return {
    factory: txt(q('[class*="factory"]')),
    title: txt(q('.qr-title')),
    formNo: txt(q('.qr-formno')),
    headCells: sheet ? [...sheet.querySelectorAll('.qr-head-table tr')].map((tr) => [...tr.querySelectorAll('th,td')].map((c) => (c.textContent || '').replace(/\s+/g, ' ').trim())) : [],
    batchHeads: sheet ? [...sheet.querySelectorAll('.qr-grid thead .c-batchname input')].map((i) => i.value) : [],
    rowCount: rows.length,
    firstRow: rows[0] ? [...rows[0].querySelectorAll('td')].map((td) => (td.textContent || '').replace(/\s+/g, ' ').trim()).slice(0, 9) : null,
    foot: sheet ? [...sheet.querySelectorAll('.qr-foot-table tr')].map((tr) => [...tr.querySelectorAll('th,td')].map((c) => (c.textContent || '').replace(/\s+/g, ' ').trim())) : [],
    editable: !!sheet && sheet.classList.contains('is-editing'),
    tabs: [...document.querySelectorAll('.dsr-tabs .dsr-tab')].map((b) => ({ t: b.textContent.trim(), on: b.classList.contains('active') })),
  }
})

await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 30000 })
await page.waitForTimeout(6000)
console.log('OPEN=' + JSON.stringify(await probe()))
// 未完成 tab 第一张单
await page.evaluate(() => [...document.querySelectorAll('.dsr-tabs .dsr-tab')].find((x) => x.textContent.trim() === '未完成')?.click())
await page.waitForTimeout(2500)
await page.evaluate(() => document.querySelectorAll('.dsr-grid tbody tr')[0]?.click())
await page.waitForTimeout(3000)
console.log('DRAFT=' + JSON.stringify(await probe()))
// 加一个批次,让矩阵有看头
await page.evaluate(() => [...document.querySelectorAll('.qr-band-acts .qr-band-act')].find((x) => (x.textContent || '').includes('添加批次'))?.click())
await page.waitForTimeout(1500)
console.log('ADDED=' + JSON.stringify(await probe()))
await cdpShot('round-22-editable-matrix')

// 旧单(已审核)只读:切「已完成」第一张
await page.evaluate(() => [...document.querySelectorAll('.dsr-tabs .dsr-tab')].find((x) => x.textContent.trim() === '已完成')?.click())
await page.waitForTimeout(3000)
await page.evaluate(() => document.querySelectorAll('.dsr-grid tbody tr')[0]?.click())
await page.waitForTimeout(3000)
console.log('DONE_DOC=' + JSON.stringify(await probe()))
await cdpShot('round-22-legacy-readonly')
