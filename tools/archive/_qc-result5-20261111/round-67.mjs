const task = await taskSpace('qc-insp-rec-result5-20261111')
const page = task.page('p1')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('bounds: ' + e.message) }
await page.waitForTimeout(800)

/** 用一段 JS 源码表达式打开某个 el-select,再点选项 */
async function pick(openScript, optionText) {
  const r = await page.evaluate(openScript)
  if (r !== 'OPENED') return r
  await page.waitForTimeout(900)
  const picked = await page.evaluate((t) => {
    const opt = [...document.querySelectorAll('.el-select-dropdown__item')]
      .filter((o) => o.offsetParent !== null)
      .find((o) => (o.textContent || '').trim() === t)
    if (!opt) return 'NO-OPTION'
    opt.click()
    return 'PICKED:' + t
  }, optionText)
  await page.waitForTimeout(600)
  return picked
}

const OPEN_DISPOSAL = "(() => { const td = document.querySelectorAll('.qr-foot-table tr')[1]?.querySelector('td:last-child'); const s = td && td.querySelector('.el-select__wrapper'); if (!s) return 'NO-SELECT'; s.click(); return 'OPENED' })()"
const OPEN_VERDICT = "(() => { const td = document.querySelectorAll('.qr-foot-table tr')[0]?.querySelector('td:last-child'); const s = td && td.querySelector('.el-select__wrapper'); if (!s) return 'NO-SELECT'; s.click(); return 'OPENED' })()"
const openJudge = (i) => `(() => { const tr = document.querySelectorAll('.qc-rec-sheet table.qr-table tbody tr')[${i}]; const s = tr && tr.querySelector('td.c-judge .el-select__wrapper'); if (!s) return 'NO-SELECT'; s.click(); return 'OPENED' })()`

console.log('disposal=' + await pick(OPEN_DISPOSAL, '同意入库'))
console.log('verdict=' + await pick(OPEN_VERDICT, '合格'))
for (let i = 0; i < 3; i++) console.log('judge' + i + '=' + await pick(openJudge(i), '合格'))

await page.waitForTimeout(800)
const filled = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : null)
  return {
    foot: [...document.querySelectorAll('.qr-foot-table tr')].map((tr) => [...tr.children].map((c) => (txt(c) || '').slice(0, 16))),
    judge: [...document.querySelectorAll('.qc-rec-sheet table.qr-table tbody tr')].map((tr) => txt(tr.querySelector('td.c-judge')) || ''),
  }
})
console.log(JSON.stringify(filled, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-66-filled.png' })

await page.evaluate(() => {
  const b = [...document.querySelectorAll('.approval-side .as-side-btn')].find((x) => (x.textContent || '').replace(/\s+/g, '') === '保存')
  if (b) b.click()
})
const msgs = []
for (let i = 0; i < 16; i++) {
  await page.waitForTimeout(400)
  const m = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean))
  if (m.length) msgs.push(...m)
}
console.log('saveMsgs=' + JSON.stringify([...new Set(msgs)]))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-result5-20261111/round-66-saved.png' })
