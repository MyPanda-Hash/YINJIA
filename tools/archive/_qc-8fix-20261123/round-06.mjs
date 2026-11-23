// round-06: 选中新单 ZC-2026-11-0010 → 新增检验项 ×2 → 添加批次 → 填值
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 60000 })
await page.waitForTimeout(6000)
const sel = await page.evaluate(() => {
  const nodes = [...document.querySelectorAll('.el-table__row, .drp-row, tr')]
  const hit = nodes.find((n) => (n.innerText || '').includes('ZC-2026-11-0010'))
  if (!hit) return 'not found'
  hit.click()
  return (hit.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80)
})
console.log('selected:', sel)
await page.waitForTimeout(3500)
const band = () => page.evaluate(() => (document.querySelector('.qr-band')?.innerText || '').replace(/\s+/g, ' ').trim())
console.log('band:', await band())
const act = async (text) => {
  const ok = await page.evaluate((text) => {
    const el = [...document.querySelectorAll('.qr-band-act')].find((x) => (x.innerText || '').includes(text))
    if (el) { el.click(); return true }
    return false
  }, text)
  console.log('act', text, ok)
  await page.waitForTimeout(1300)
}
await act('新增检验项')
await act('新增检验项')
await act('添加批次')

const dump = () => page.evaluate(() => {
  const t = document.querySelector('.qr-grid')
  if (!t) return { err: 'no grid' }
  return {
    head: [...t.querySelectorAll('thead tr')].map((tr) => [...tr.children].map((th) => (th.innerText || '').replace(/\s+/g, ' ').trim())),
    rows: [...t.querySelectorAll('tbody tr')].map((tr, ri) => ({
      ri,
      cells: [...tr.children].map((td, ci) => ({
        ci,
        text: (td.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 24),
        ta: [...td.querySelectorAll('textarea')].map((x) => x.value),
        sel: [...td.querySelectorAll('.el-select')].map((x) => (x.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 14)),
      })),
    })),
  }
})
console.log('=== GRID ===')
console.log(JSON.stringify(await dump(), null, 1))
const typed = await page.evaluate(() => {
  const setVal = (el, v) => {
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    const s = Object.getOwnPropertyDescriptor(proto, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const out = []
  const t = document.querySelector('.qr-grid')
  ;[...t.querySelectorAll('tbody tr')].forEach((tr, ri) => {
    ;[...tr.querySelectorAll('textarea')].forEach((ta, ti) => {
      const v = 'R' + ri + 'C' + ti
      setVal(ta, v)
      out.push({ ri, ti, v })
    })
  })
  return out
})
console.log('typed:', JSON.stringify(typed))
await page.waitForTimeout(1500)
console.log('=== GRID AFTER TYPING ===')
console.log(JSON.stringify(await dump(), null, 1))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-06-typing.png' })
