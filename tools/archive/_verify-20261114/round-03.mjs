// round-03 — A2: 黄格填值(3#外径 12.3 / 5#跌落 50cm / 7#挤压 31) → 保存 → 刷新重开核对
const OUT = 'C:/Users/vigna/ego/verify-20261114'
const fs = await import('node:fs/promises')
const task = await taskSpace('verify-20261114')
const page = (await task.pages())[0]

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) {}
}

const before = await page.evaluate(() => ({
  hash: location.hash,
  factory: (document.querySelector('.factory-name')?.textContent || '').trim(),
  sideBtns: [...document.querySelectorAll('.as-side-btn')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  headText: (document.querySelector('.fi-head')?.textContent || '').replace(/\s+/g, ' ').trim(),
}))
console.log('BEFORE=' + JSON.stringify(before))

// —— 填 3 个黄格 ——
const filled = await page.evaluate(() => {
  function setVal(el, v) {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    el.dispatchEvent(new Event('blur', { bubbles: true }))
  }
  const rows = [...document.querySelectorAll('.sample-row')]
  const cell = (ri, ci) => rows[ri].querySelectorAll('td')[ci]
  const out = {}
  // 3#外径 = 第3个样品行(index2) 第3列(index2)
  const c1 = cell(2, 2).querySelector('input')
  setVal(c1, '12.3'); out['3#外径'] = c1.value
  // 5#跌落 = 第5行(index4) 第7列(index6)
  const c2 = cell(4, 6).querySelector('input')
  setVal(c2, '50cm'); out['5#跌落'] = c2.value
  // 7#挤压 = 第7行(index6) 第8列(index7)
  const c3 = cell(6, 7).querySelector('input')
  setVal(c3, '31'); out['7#挤压'] = c3.value
  return out
})
console.log('FILLED=' + JSON.stringify(filled))
await page.waitForTimeout(1200)
await restoreWindow()
await page.screenshot({ path: OUT + '/round-03-filled.png' })

// —— 保存 ——
const saveClicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.as-side-btn')].find((e) => (e.textContent || '').replace(/\s+/g, ' ').trim() === '保存')
  if (b) b.click()
  return !!b
})
console.log('SAVE_CLICKED=' + saveClicked)
await page.waitForTimeout(5000)
const afterSave = await page.evaluate(() => ({
  hash: location.hash,
  msgs: [...document.querySelectorAll('.el-message, .el-notification')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  fiHead: (document.querySelector('.fi-head')?.textContent || '').replace(/\s+/g, ' ').trim(),
  dialogTxt: [...document.querySelectorAll('.el-dialog')].filter((d) => d.offsetParent !== null).map((d) => (d.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200)),
  bodyHasDocNo: (document.body.innerText || '').match(/[A-Z]{2,4}-\d{4}-\d{2}-\d{3,4}/g),
}))
console.log('AFTER_SAVE=' + JSON.stringify(afterSave))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-03-saved.png' })

// —— 刷新列表 → 打开最新单 → 核对值仍在 ——
await page.reload({ timeout: 60000 })
await page.waitForTimeout(6000)
const listInfo = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.el-table__body-wrapper tbody tr')]
  const first = rows[0]
  return {
    rowCount: rows.length,
    firstRowText: first ? (first.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200) : '',
    headers: [...document.querySelectorAll('.el-table__header-wrapper th')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 20),
  }
})
console.log('LIST=' + JSON.stringify(listInfo))
const dbl = await page.evaluate(() => {
  const first = document.querySelector('.el-table__body-wrapper tbody tr')
  if (!first) return false
  const ev = new MouseEvent('dblclick', { bubbles: true, cancelable: true, view: window })
  first.dispatchEvent(ev)
  const ev2 = new MouseEvent('click', { bubbles: true, cancelable: true, view: window })
  first.dispatchEvent(ev2)
  return true
})
console.log('DBLCLICK=' + dbl)
await page.waitForTimeout(6000)
const reopened = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.sample-row')]
  const cell = (ri, ci) => rows[ri] ? rows[ri].querySelectorAll('td')[ci] : null
  const val = (ri, ci) => {
    const td = cell(ri, ci)
    if (!td) return null
    const i = td.querySelector('input,textarea')
    return i ? i.value : (td.textContent || '').replace(/\s+/g, ' ').trim()
  }
  const heads = [...document.querySelectorAll('.fi-head input')].map((i) => i.value)
  return {
    hash: location.hash,
    sheet: !!document.querySelector('.fi-grid'),
    editable: !!document.querySelector('.sample-row input, .sample-row textarea'),
    stdHead: (document.querySelector('.fi-head')?.textContent || '').replace(/\s+/g, ' ').trim(),
    headInputs: heads,
    v3outer: val(2, 2),
    v5drop: val(4, 6),
    v7press: val(6, 7),
    gzY: document.querySelectorAll('.sample-row td.gz-y').length,
  }
})
console.log('REOPENED=' + JSON.stringify(reopened))
await restoreWindow()
await page.screenshot({ path: OUT + '/round-03-reopened.png' })
await fs.writeFile(OUT + '/a2-round.json', JSON.stringify({ before, filled, afterSave, listInfo, reopened }, null, 1), 'utf8')
console.log('DONE round-03')
