// round-36:换行验收(30 个全角字)——量 textarea 高度是否从 1 行长高到 2 行;再取消关闭
const task = await taskSpace('lead-qc-yj154-20261111')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/panelx/list/QC_PROC_INSP', { timeout: 30000 })
await page.waitForTimeout(6500)
await page.evaluate(() => [...document.querySelectorAll('.dsr-tabs .dsr-tab')].find((x) => x.textContent.trim() === '未完成')?.click())
await page.waitForTimeout(2500)
await page.evaluate(() => document.querySelectorAll('.dsr-grid tbody tr')[0]?.click())
await page.waitForTimeout(2800)
await page.evaluate(() => document.querySelector('.qr-label .qr-opt-mgr')?.click())
await page.waitForTimeout(1500)

const TEXT = '处理意见处理意见处理意见处理意见处理意见处理意见处理意见处理意见处理意见处理意见'   // 30 个全角字
const setAndMeasure = () => page.evaluate((text) => {
  const rows = [...document.querySelectorAll('.el-dialog .qr-opt-row')]
  const row = rows[rows.length - 1]
  const ta = row?.querySelector('textarea')
  if (!ta) return { ok: false }
  ta.focus()
  const s = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
  s.call(ta, text)
  ta.dispatchEvent(new Event('input', { bubbles: true }))
  ta.dispatchEvent(new Event('change', { bubbles: true }))
  const cs = getComputedStyle(ta)
  return {
    len: ta.value.length,
    h: ta.clientHeight, sh: ta.scrollHeight,
    wordBreak: cs.wordBreak, whiteSpace: cs.whiteSpace,
    rows: rows.length,
  }
}, TEXT)
const addIfNeeded = await page.evaluate(() => {
  if (document.querySelectorAll('.el-dialog .qr-opt-row').length < 5) { document.querySelector('.el-dialog .qr-opt-add')?.click(); return true }
  return false
})
await page.waitForTimeout(900)
let m = await setAndMeasure()
if (m.len === 0) { await page.waitForTimeout(800); m = await setAndMeasure() }
await page.waitForTimeout(900)
// 再读一次(等 autosize 重算)
const final = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.el-dialog .qr-opt-row')]
  const ta = rows[rows.length - 1]?.querySelector('textarea')
  return { len: ta.value.length, h: ta.clientHeight, sh: ta.scrollHeight, firstLine: ta.value.slice(0, 5) }
})
console.log('WRAP=' + JSON.stringify({ addIfNeeded, m, final, wrapped: final.h > 30 }))
await page.keyboard.press('Escape')
await page.waitForTimeout(1500)
console.log('CLOSED=' + JSON.stringify({ open: await page.evaluate(() => [...document.querySelectorAll('.el-dialog')].some((d) => d.offsetParent !== null && d.getBoundingClientRect().width > 0 && getComputedStyle(d).display !== 'none')) }))
