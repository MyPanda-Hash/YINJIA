const task = await taskSpace('purinsplit-20261117')
const page = task.page('p1')

const cellText = (rowIndex) => page.evaluate((i) => {
  const tr = document.querySelector(`.el-dialog .pis .el-table__body-wrapper tr:nth-child(${i})`)
  const sels = [...tr.querySelectorAll('.el-select')].map((s) => (s.textContent || '').replace(/\s+/g, ' ').trim())
  const qty = tr.querySelector('.el-input-number input')?.value
  return { sels, qty }
}, rowIndex)

async function pick(rowIndex, whName) {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  await page.click(`.el-dialog .pis .el-table__body-wrapper tr:nth-child(${rowIndex}) td:nth-child(1) .el-select`, { label: `row${rowIndex} wh` })
  await page.waitForTimeout(700)
  const r = await page.evaluate(async (name) => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms))
    const boxes = [...document.querySelectorAll('.el-select-dropdown')].filter((d) => d.offsetParent)
    const items = boxes.length ? [...boxes[boxes.length - 1].querySelectorAll('.el-select-dropdown__item')] : []
    const hit = items.find((i) => (i.textContent || '').trim() === name)
    if (!hit) return 'missing:' + JSON.stringify(items.map((i) => (i.textContent || '').trim()).slice(0, 12))
    hit.click()
    await sleep(400)
    return 'ok'
  }, whName)
  await page.waitForTimeout(600)
  return r
}

console.log('row1 before=' + JSON.stringify(await cellText(1)))
console.log('row2 before=' + JSON.stringify(await cellText(2)))
console.log('pick1=' + await pick(1, '恒亿仓'))
console.log('row1 now=' + JSON.stringify(await cellText(1)))
console.log('pick2=' + await pick(2, '成品B仓'))
console.log('row2 now=' + JSON.stringify(await cellText(2)))

const state = await page.evaluate(() => {
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const dlg = [...document.querySelectorAll('.el-dialog')].filter(vis).pop()
  const btn = [...dlg.querySelectorAll('button')].find((b) => (b.textContent || '').includes('确定拆分'))
  return {
    sumText: (dlg.querySelector('.pis-sum')?.textContent || '').replace(/\s+/g, ' ').trim(),
    problem: (dlg.querySelector('.pis-problem')?.textContent || '').trim(),
    confirmDisabled: btn ? btn.disabled : null,
  }
})
console.log(JSON.stringify(state, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/purinsplit-20261117/s6-dialog-ready.png' })
