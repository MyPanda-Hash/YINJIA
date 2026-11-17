// round-16:验证查询区提示语完整显示(5173 源码版):测量 placeholder 文字宽度 vs 输入框可用宽度
const task = await taskSpace('wo-report-query-input-20261113')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/WO_REPORT_LIST', { timeout: 90000 })
await page.waitForTimeout(7000)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }

const out = await page.evaluate(() => {
  const measure = (text, font) => {
    const c = document.createElement('canvas')
    const ctx = c.getContext('2d')
    ctx.font = font
    return ctx.measureText(text).width
  }
  const fields = [...document.querySelectorAll('.fields.udl-fields .field')]
  const rows = []
  for (const f of fields) {
    const ac = f.querySelector('.el-autocomplete')
    if (!ac) continue
    const inp = ac.querySelector('input')
    if (!inp) continue
    const cs = getComputedStyle(inp)
    const phStyle = getComputedStyle(inp, '::placeholder')
    const padL = parseFloat(cs.paddingLeft) || 0
    const padR = parseFloat(cs.paddingRight) || 0
    const usable = inp.clientWidth - padL - padR
    const textW = measure(inp.placeholder, `${phStyle.fontSize} ${phStyle.fontFamily}`)
    rows.push({
      label: (f.querySelector('label')?.textContent || '').trim(),
      placeholder: inp.placeholder,
      inputWidth: inp.clientWidth,
      usable: Math.round(usable),
      textWidth: Math.round(textW),
      fits: textW <= usable - 2,
      phFontSize: phStyle.fontSize,
      clearanceBtn: !!f.querySelector('button'),
    })
  }
  return { rows, viewport: { w: window.innerWidth } }
})
console.log('PLACEHOLDER ' + JSON.stringify(out, null, 2))
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_query-input-20261113/ego/round-16-placeholder-5173.png' })
console.log('DONE round-16')
