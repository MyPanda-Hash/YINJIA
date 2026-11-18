const task = await taskSpace('route-required-hint-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/ROUTE', { timeout: 40000 })
await page.waitForTimeout(7000)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

const readState = () => page.evaluate(() => ({
  doc: (document.querySelector('.doc-chip')?.textContent || '').trim(),
  pageNo: (document.querySelector('.page-no')?.textContent || '').trim(),
  rows: [...document.querySelectorAll('.el-table__body-wrapper tbody tr')].slice(0, 3).map((tr) => [...tr.querySelectorAll('td')].slice(0, 6).map((td) => (td.innerText || '').trim())),
}))

let st = await readState()
console.log('page1:', JSON.stringify(st))
for (let i = 0; i < 10 && !st.doc.includes('GY-2026-11-0002'); i++) {
  const ok = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.page-btn')].find((x) => (x.textContent || '').includes('▶'))
    if (!b) return false
    b.click()
    return true
  })
  if (!ok) break
  await page.waitForTimeout(3500)
  st = await readState()
  console.log(`nav${i}:`, JSON.stringify({ doc: st.doc, pageNo: st.pageNo }))
}

console.log('target:', JSON.stringify(st))
if (!st.doc.includes('GY-2026-11-0002')) {
  console.log('NOT_FOUND — 后面不再点保存')
} else {
  const clicked = await page.evaluate(() => {
    const s = [...document.querySelectorAll('.tools .act-name')].find((x) => (x.textContent || '').trim() === '保存')
    if (s) { s.click(); return true } return false
  })
  console.log('saveClicked:', clicked)
  await page.waitForTimeout(2500)
  console.log(JSON.stringify(await page.evaluate(() => ({
    dialogTitle: (document.querySelector('.el-message-box__title')?.textContent || '').trim(),
    dialogItems: [...document.querySelectorAll('.el-message-box__message li')].map((li) => (li.textContent || '').trim()),
    headBlink: [...document.querySelectorAll('.fields .field.field-blink')].map((f) => f.dataset.code),
    cellBlinkTexts: [...document.querySelectorAll('.cell-blink')].map((td) => (td.innerText || '').trim()),
    rowMissing: [...document.querySelectorAll('.el-table__row.row-missing-hint')].map((tr) => [...tr.querySelectorAll('td')].slice(0, 6).map((td) => (td.innerText || '').trim())),
  })), null, 2))
  await page.screenshot({ path: 'C:/Users/vigna/ego/route-required-hint-20261117/round-15-popup.png' })
  // 关弹窗,截未遮挡的高亮现场
  await page.evaluate(() => {
    const box = [...document.querySelectorAll('.el-message-box')].find((b) => b.offsetParent !== null)
    const btns = box ? [...box.querySelectorAll('button')] : []
    if (btns.length) btns[btns.length - 1].click()
  })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'C:/Users/vigna/ego/route-required-hint-20261117/round-16-highlight.png' })
}
