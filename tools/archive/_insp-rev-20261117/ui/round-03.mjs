// round-03: 看当前纸头(编号/日期控件)、点「其他」手填 + 勾选类别,并截图
const dir = 'C:/Users/vigna/ego/insp-rev-20261117'
const task = await taskSpace('insp-rev-20261117')
const page = task.page('p1')

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) {
      await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    }
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
}

const head = await page.evaluate(() => {
  const sheet = document.querySelector('[data-ic-sheet]')
  if (!sheet) return { ok: false, why: 'no sheet' }
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const meta = sheet.querySelector('.ic-meta')
  return {
    ok: true,
    meta: txt(meta),
    metaInputs: [...meta.querySelectorAll('input')].map((i) => ({ value: i.value, ph: i.placeholder, cls: i.className })),
    hasDatePicker: !!sheet.querySelector('.ic-date-pick'),
    topbar: txt(document.querySelector('.topbar')).slice(0, 120),
  }
})
console.log(JSON.stringify(head, null, 2))

// 1) 制造商:点「其他」→ 横线变输入框 → 填「惠州市第三水厂」
const otherClicked = await page.evaluate(() => {
  const sheet = document.querySelector('[data-ic-sheet]')
  const rows = [...sheet.querySelectorAll('tbody > tr')]
  const tr = rows.find((r) => (r.textContent || '').includes('制造商/地址'))
  if (!tr) return 'no-row'
  const opts = [...tr.querySelectorAll('.ic-opt')]
  const other = opts.filter((o) => (o.textContent || '').trim() === '其他').pop()
  if (other) { other.click(); return 'clicked-other' }
  return 'no-other'
})
console.log('manufacturer other=' + otherClicked)
await page.waitForTimeout(700)

const typed = await page.evaluate(() => {
  const sheet = document.querySelector('[data-ic-sheet]')
  const rows = [...sheet.querySelectorAll('tbody > tr')]
  const tr = rows.find((r) => (r.textContent || '').includes('制造商/地址'))
  const inp = [...tr.querySelectorAll('input')].find((i) => i.placeholder && i.placeholder.includes('请填写名称'))
  if (!inp) return 'no-input'
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(inp, '惠州市第三水厂')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
  return 'typed'
})
console.log('manufacturer type=' + typed)

// 2) 委托单位勾「品质」;样品类别勾「滤芯」;报告类型勾「只要数据」
const picks = await page.evaluate(() => {
  const sheet = document.querySelector('[data-ic-sheet]')
  const rows = [...sheet.querySelectorAll('tbody > tr')]
  const out = []
  const clickOpt = (rowMatch, optText) => {
    const tr = rows.find((r) => (r.textContent || '').includes(rowMatch))
    if (!tr) return 'no-row:' + rowMatch
    const o = [...tr.querySelectorAll('.ic-opt')].find((x) => (x.textContent || '').trim().startsWith(optText))
    if (!o) return 'no-opt:' + optText
    o.click()
    return 'ok:' + optText
  }
  out.push(clickOpt('委托单位/单位地址', '品质'))
  out.push(clickOpt('样品型号/规格', '滤芯'))
  out.push(clickOpt('报告类型', '只要数据'))
  return out
})
console.log('picks=' + JSON.stringify(picks))
await page.waitForTimeout(1200)
await restoreWindow()

const after = await page.evaluate(() => {
  const sheet = document.querySelector('[data-ic-sheet]')
  const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const rows = [...sheet.querySelectorAll('tbody > tr')].slice(0, 8).map((tr) => txt(tr).slice(0, 160))
  return { rows, boxes: [...sheet.querySelectorAll('.ic-box')].map((b) => txt(b)).join('') }
})
console.log(JSON.stringify(after, null, 2))
await page.screenshot({ path: dir + '/shots/round-03-picks.png' })
