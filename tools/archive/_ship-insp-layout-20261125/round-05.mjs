// 第 5 轮:保存草稿(落库)→ 读回 DOM 值(含换行)→ 截图
const task = await taskSpace('qc-insp-fmt-20261125')
const page = task.page('p1')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal', width: 1920, height: 1200, left: 0, top: 0 } })
} catch (e) { console.log('resize skip: ' + e.message) }
await page.waitForTimeout(800)

const clickSide = async (label) => {
  const ok = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('.approval-side *, .tools *')]
      .filter((e) => (e.textContent || '').trim() === t && e.children.length === 0)
      .find((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
    if (!el) return false
    el.click()
    return true
  }, label)
  await page.waitForTimeout(2000)
  return ok
}

const readCells = async () => page.evaluate(() => {
  const rows = [...document.querySelectorAll('.qr-grid tbody tr')]
  return rows.map((tr) => [...tr.children].map((td) => {
    const ta = td.querySelector('textarea')
    return ta ? { ta: ta.value } : (td.textContent || '').replace(/\s+/g, ' ').trim()
  }))
})

console.log('before save: ' + JSON.stringify(await readCells()))
console.log('save draft: ' + (await clickSide('保存为草稿')))
await page.waitForTimeout(2500)
console.log('after save rows: ' + JSON.stringify(await readCells()))
const msg = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()))
console.log('messages: ' + JSON.stringify(msg))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-insp-fmt-20261125/round-05.png' })
