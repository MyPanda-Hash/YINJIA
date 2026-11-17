// round-17:8090 打包版验收提示语完整显示 + 查询仍可用
const task = await taskSpace('wo-report-query-input-20261113')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/panelx/list/WO_REPORT_LIST', { timeout: 90000 })
await page.waitForTimeout(8000)

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
    const ph = getComputedStyle(inp, '::placeholder')
    const usable = inp.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0)
    const textW = measure(inp.placeholder, `${ph.fontSize} ${ph.fontFamily}`)
    rows.push({
      label: (f.querySelector('label')?.textContent || '').trim(),
      placeholder: inp.placeholder,
      usable: Math.round(usable),
      textWidth: Math.round(textW),
      fits: textW <= usable - 2,
      fontSize: ph.fontSize,
    })
  }
  return { rows, banner: (document.body.innerText || '').includes('页面脚本异常') }
})
console.log('PLACEHOLDER ' + JSON.stringify(out, null, 2))
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_query-input-20261113/ego/round-17-8090-placeholder.png' })

// 查询仍可用:输入 A-48 回车
const input = await page.evaluate(() => {
  const f = [...document.querySelectorAll('.fields.udl-fields .field')].find((x) => (x.querySelector('label')?.textContent || '').trim() === '产品编码')
  const i = f?.querySelector('input')
  if (i) i.setAttribute('data-qi', 'product-code')
  return !!i
})
if (input) {
  await page.click('[data-qi="product-code"]')
  await page.waitForTimeout(300)
  await page.fill('[data-qi="product-code"]', 'A-48')
  await page.waitForTimeout(1600)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(4500)
  const after = await page.evaluate(() => ({
    input: document.querySelector('[data-qi="product-code"]')?.value,
    rows: document.querySelectorAll('.el-table__body tbody tr').length,
    total: (document.querySelector('.report-count')?.textContent || '').trim(),
  }))
  console.log('SEARCH ' + JSON.stringify(after))
  await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_query-input-20261113/ego/round-17-8090-search.png' })
}
console.log('DONE round-17')
