// round-13: 量各格 top 偏移, 验证「内容掉到行下半部」
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 60000 })
await page.waitForTimeout(6000)
await page.evaluate(() => {
  const tr = [...document.querySelectorAll('tr')].find((n) => (n.innerText || '').includes('ZC-2026-11-0010'))
  if (tr) tr.click()
})
await page.waitForTimeout(3000)
// 收起左侧目录, 让纸面变宽
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('*')].find((x) => (x.innerText || '').trim() === '«' && x.clientWidth < 40)
  if (btn) btn.click()
})
await page.waitForTimeout(1200)
console.log(JSON.stringify(await page.evaluate(() => {
  const t = document.querySelector('.qr-grid')
  const rows = [...t.querySelectorAll('tbody tr')]
  return rows.slice(0, 4).map((tr, ri) => {
    const r = tr.getBoundingClientRect()
    return {
      ri, rowTop: Math.round(r.top), rowH: Math.round(r.height),
      cells: [...tr.children].map((td, ci) => {
        const b = td.getBoundingClientRect()
        const ta = td.querySelector('textarea')
        const tb = ta ? ta.getBoundingClientRect() : null
        const sel = td.querySelector('.el-select__wrapper')
        const sb = sel ? sel.getBoundingClientRect() : null
        return {
          ci,
          tdTop: Math.round(b.top - r.top),
          tdH: Math.round(b.height),
          va: getComputedStyle(td).verticalAlign,
          taTop: tb ? Math.round(tb.top - b.top) : null,
          taH: tb ? Math.round(tb.height) : null,
          selTop: sb ? Math.round(sb.top - b.top) : null,
        }
      }),
    }
  })
}), null, 1))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-13-wide.png' })
