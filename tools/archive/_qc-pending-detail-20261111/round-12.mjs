/* round-12.mjs — ① 点单号跳转验一遍(来料检验单/检验数据记录)② 待检验目录无「修改」按钮 */
const task = await taskSpace('qc-pending-detail-20261111')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC_DETAIL', { timeout: 30000 })
await page.waitForTimeout(4500)

// 找一个有「来料检验单号」的行(单元格里是 .doc-no-link)
const target = await page.evaluate(() => {
  const links = [...document.querySelectorAll('.el-table__body-wrapper .doc-no-link')]
  const insp = links.find((el) => /^IJ-/.test((el.innerText || '').trim()))
  const rec = links.find((el) => /^JYSJ-/.test((el.innerText || '').trim()))
  return { insp: insp ? insp.innerText.trim() : '', rec: rec ? rec.innerText.trim() : '', linkCount: links.length }
})
console.log('targets ->', JSON.stringify(target))

if (target.insp) {
  await page.evaluate((no) => {
    const el = [...document.querySelectorAll('.el-table__body-wrapper .doc-no-link')].find((x) => (x.innerText || '').trim() === no)
    if (el) el.click()
  }, target.insp)
  await page.waitForTimeout(4500)
  const jumped = await page.evaluate(() => ({
    hash: location.hash,
    title: document.title,
    bodyHead: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 260),
  }))
  console.log('after clicking ' + target.insp + ' ->', JSON.stringify(jumped, null, 2))
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { }
  await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-pending-detail-20261111/round-12-jump.png' })
}

// 待检验目录:标题/无「修改」按钮/完成检验按钮仍在
await page.goto('http://localhost:5173/#/panelx/list/QC_CATALOG', { timeout: 30000 })
await page.waitForTimeout(4500)
const cat = await page.evaluate(() => {
  const title = ((document.querySelector('.cs-title') || {}).innerText || '').trim()
  const bodyRows = [...document.querySelectorAll('.cs-table tbody tr')]
  const statuses = [...new Set([...document.querySelectorAll('.cs-status-tag')].map((el) => (el.innerText || '').trim()))]
  const acts = [...new Set([...document.querySelectorAll('.cs-act')].map((el) => (el.innerText || '').trim()))]
  const note = ((document.querySelector('.cs-note') || {}).innerText || '').replace(/\s+/g, ' ')
  return { title, rowCount: bodyRows.length, statuses, acts, note }
})
console.log('catalog ->', JSON.stringify(cat, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-pending-detail-20261111/round-12-catalog.png' })
