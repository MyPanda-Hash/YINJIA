const task = await taskSpace('shipinsp-wrap-20261123')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_ASM_INSP', { timeout: 40000 })
await page.waitForTimeout(4000)
const open = await page.evaluate(() => {
  const tr = [...document.querySelectorAll('tr')].find((t) => (t.innerText || '').includes('ZJ-2026-11-0010'))
  if (!tr) return 'not found'
  tr.click()
  return 'clicked'
})
console.log('OPEN:', open)
await page.waitForTimeout(3500)
// 点「＋新增检验项」(只在本页内存里加一行,不保存)
const added = await page.evaluate(() => {
  const el = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && /新增检验项/.test((e.textContent || '').trim()) && (e.textContent || '').trim().length < 12)
  if (!el) return 'no btn'
  el.click()
  return 'clicked'
})
console.log('ADD:', added)
await page.waitForTimeout(1500)
const before = await page.evaluate(() => document.querySelectorAll('.qr-grid tbody textarea').length)
console.log('textareas before typing:', before)
// 往第一行的检验项目 textarea 里注入 23 字长项目名(不保存)
const typed = await page.evaluate(() => {
  const tas = [...document.querySelectorAll('.qr-grid tbody td.c-item textarea')]
  if (!tas.length) return 'no textarea'
  const ta = tas[tas.length - 1]
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
  setter.call(ta, '*整体尺寸 （内PP棉、外包布、套网、打端盖）')
  ta.dispatchEvent(new Event('input', { bubbles: true }))
  return 'ok'
})
console.log('TYPED:', typed)
await page.waitForTimeout(1200)
const info = await page.evaluate(() => {
  const tas = [...document.querySelectorAll('.qr-grid tbody td.c-item textarea')]
  return {
    n: tas.length,
    rows: tas.map((ta) => {
      const r = ta.getBoundingClientRect()
      const td = ta.closest('td').getBoundingClientRect()
      return {
        value: ta.value, taH: Math.round(r.height), taW: Math.round(r.width),
        scrollH: ta.scrollHeight, clientH: ta.clientHeight,
        tdW: Math.round(td.width), tdH: Math.round(td.height),
        overflowX: ta.scrollWidth > ta.clientWidth,
        textAlign: getComputedStyle(ta).textAlign,
        whiteSpace: getComputedStyle(ta).whiteSpace,
        wrap: getComputedStyle(ta).wordBreak + ' / ' + getComputedStyle(ta).overflowWrap,
      }
    }),
  }
})
console.log(JSON.stringify(info, null, 2))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/vigna/ego/shipinsp-wrap-20261123/s6-asm-editable.png' })
