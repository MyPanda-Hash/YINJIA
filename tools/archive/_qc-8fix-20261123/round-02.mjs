// round-02: 打开一张有检验项的出货检验（功能）草稿, 观察「添加批次」前后的表格结构
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p1')
const goto = async () => {
  await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP?docNo=ZC-2026-11-0006', { timeout: 60000 })
  await page.waitForTimeout(7000)
}
await goto()
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }

const dump = () => page.evaluate(() => {
  const t = document.querySelector('.qr-grid')
  if (!t) return { err: 'no .qr-grid', hash: location.hash }
  const rows = [...t.querySelectorAll('tr')]
  return {
    head: [...t.querySelectorAll('thead tr')].map((tr) => [...tr.children].map((th) => (th.innerText || '').replace(/\s+/g, ' ').trim())),
    rows: rows.filter((tr) => tr.closest('tbody')).map((tr, ri) => ({
      ri,
      h: Math.round(tr.getBoundingClientRect().height),
      cells: [...tr.children].map((td, ci) => ({
        ci,
        h: Math.round(td.getBoundingClientRect().height),
        text: (td.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 40),
        ta: [...td.querySelectorAll('textarea')].map((x) => x.value.slice(0, 30)),
        sel: [...td.querySelectorAll('.el-select')].map((x) => (x.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 20)),
      })),
    })),
    band: (document.querySelector('.qr-band')?.innerText || '').replace(/\s+/g, ' ').trim(),
  }
})
console.log('=== BEFORE ===')
console.log(JSON.stringify(await dump(), null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-02-before.png' })

// 点「＋ 添加批次」
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.qr-band-act')].find((x) => (x.innerText || '').includes('添加批次'))
  if (el) el.click()
})
await page.waitForTimeout(1500)
console.log('=== AFTER ADD BATCH ===')
console.log(JSON.stringify(await dump(), null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-02-after.png' })
