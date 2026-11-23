// round-10: 在可编辑新单上 新增2项 → 添加批次 → 填值, 取证「内容跑到下面」
const task = await taskSpace('qc-8fix-20261123')
const page = task.page('p2')
const band = () => page.evaluate(() => (document.querySelector('.qr-band')?.innerText || '').replace(/\s+/g, ' ').trim())
console.log('band:', await band())
const act = async (text) => {
  const ok = await page.evaluate((text) => {
    const el = [...document.querySelectorAll('.qr-band-act')].find((x) => (x.innerText || '').includes(text))
    if (el) { el.click(); return true }
    return false
  }, text)
  console.log('act', text, ok)
  await page.waitForTimeout(1200)
}
await act('新增检验项')
await act('新增检验项')
console.log('band after items:', await band())
await act('添加批次')
console.log('band after batch:', await band())

const dump = () => page.evaluate(() => {
  const t = document.querySelector('.qr-grid')
  if (!t) return { err: 'no grid' }
  return {
    head: [...t.querySelectorAll('thead tr')].map((tr) => [...tr.children].map((th) => (th.innerText || '').replace(/\s+/g, ' ').trim())),
    rows: [...t.querySelectorAll('tbody tr')].map((tr, ri) => ({
      ri,
      cells: [...tr.children].map((td, ci) => ({
        ci,
        text: (td.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 22),
        ta: [...td.querySelectorAll('textarea')].map((x) => x.value),
        sel: [...td.querySelectorAll('.el-select')].map((x) => (x.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 12)),
      })),
    })),
  }
})
console.log('=== GRID BEFORE TYPING ===')
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
await page.waitForTimeout(1600)
console.log('=== GRID AFTER TYPING ===')
console.log(JSON.stringify(await dump(), null, 1))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) {}
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-10-typing.png' })
