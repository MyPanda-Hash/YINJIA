const task = await taskSpace('purin-multiwh-20261117')
const page = task.page('p1')

// 第 1 行点 ▾ 加一行
const step1 = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const dlg = [...document.querySelectorAll('.el-dialog')].filter(vis).pop()
  const carets = [...dlg.querySelectorAll('.pmw-caret')].filter(vis)
  carets[0]?.click()
  await sleep(700)
  const allocs = [...dlg.querySelectorAll('tr.pmw-alloc-row')].filter(vis)
  return { allocCount: allocs.length, firstAlloc: (allocs[0]?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) }
})
console.log('STEP1=' + JSON.stringify(step1))

// 第 1 个子行数量改成 20
const step2 = await page.evaluate(() => {
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const dlg = [...document.querySelectorAll('.el-dialog')].filter(vis).pop()
  const allocs = [...dlg.querySelectorAll('tr.pmw-alloc-row')].filter(vis)
  const input = allocs[0].querySelector('.el-input-number input')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(input, '20')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
  input.blur()
  return input.value
})
console.log('QTY1=' + step2)

// 再点一次 ▾ 加第二行,并选成品B仓、数量 10
const step3 = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const dlg = [...document.querySelectorAll('.el-dialog')].filter(vis).pop()
  const carets = [...dlg.querySelectorAll('.pmw-caret')].filter(vis)
  carets[0]?.click()
  await sleep(700)
  const allocs = [...dlg.querySelectorAll('tr.pmw-alloc-row')].filter(vis)
  return { allocCount: allocs.length, rows: allocs.map((a) => (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50)) }
})
console.log('STEP3=' + JSON.stringify(step3))

// 第二个子行:选仓库 成品B仓
await page.evaluate(() => {
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const dlg = [...document.querySelectorAll('.el-dialog')].filter(vis).pop()
  const allocs = [...dlg.querySelectorAll('tr.pmw-alloc-row')].filter(vis)
  const sel = allocs[1]?.querySelector('td:nth-child(8) .el-select') || allocs[1]?.querySelector('.el-select')
  sel?.click()
})
await page.waitForTimeout(700)
const picked = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const boxes = [...document.querySelectorAll('.el-select-dropdown')].filter((d) => d.offsetParent)
  const items = boxes.length ? [...boxes[boxes.length - 1].querySelectorAll('.el-select-dropdown__item')] : []
  const hit = items.find((i) => (i.textContent || '').trim() === '成品B仓')
  if (!hit) return 'missing:' + JSON.stringify(items.map((i) => (i.textContent || '').trim()).slice(0, 8))
  hit.click()
  await sleep(400)
  return 'ok'
})
console.log('PICK2=' + picked)

const step4 = await page.evaluate(() => {
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const dlg = [...document.querySelectorAll('.el-dialog')].filter(vis).pop()
  const allocs = [...dlg.querySelectorAll('tr.pmw-alloc-row')].filter(vis)
  const input = allocs[1]?.querySelector('.el-input-number input')
  if (input) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, '10')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    input.blur()
  }
  return { rows: allocs.map((a) => (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60)), qty2: input?.value }
})
console.log('STEP4=' + JSON.stringify(step4))

await page.waitForTimeout(600)
const state = await page.evaluate(() => {
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const dlg = [...document.querySelectorAll('.el-dialog')].filter(vis).pop()
  const foot = (dlg.querySelector('.pmw-foot')?.textContent || '').replace(/\s+/g, ' ').trim()
  const lines = [...dlg.querySelectorAll('.el-table__body-wrapper tr')].filter((tr) => !tr.classList.contains('pmw-alloc-row'))
    .map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80))
  const ok = [...dlg.querySelectorAll('.el-dialog__footer button')].find((b) => (b.textContent || '').trim() === '确定')
  return { foot, lines, disabled: ok?.disabled }
})
console.log(JSON.stringify(state, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/purin-multiwh-20261117/m3-filled.png' })
