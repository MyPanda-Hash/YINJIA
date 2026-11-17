const task = await taskSpace('purinsplit-20261117')
const page = task.page('p1')

// 确保弹窗打开(上一个脚本按 Esc 关掉了)
const opened = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const dlgOpen = [...document.querySelectorAll('.el-dialog')].filter(vis).some((d) => (d.querySelector('.el-dialog__title')?.textContent || '').includes('拆分仓库'))
  if (dlgOpen) return 'already'
  const icons = [...document.querySelectorAll('.detail .split')].filter(vis)
  if (!icons.length) return 'no-icon'
  icons[0].click()
  await sleep(2500)
  return 'opened'
})
console.log('dialog=' + opened)

async function pick(rowIndex, whName) {
  await page.click(`.el-dialog .pis .el-table__body-wrapper tr:nth-child(${rowIndex}) td:nth-child(1) .el-select`, { label: `row${rowIndex} wh` })
  await page.waitForTimeout(650)
  return page.evaluate(async (name) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    const boxes = [...document.querySelectorAll('.el-select-dropdown')].filter((d) => d.offsetParent)
    const items = boxes.length ? [...boxes[boxes.length - 1].querySelectorAll('.el-select-dropdown__item')] : []
    const hit = items.find((i) => (i.textContent || '').trim() === name)
    if (!hit) return 'missing'
    hit.click()
    await sleep(350)
    return 'ok'
  }, whName)
}

async function setQty(rowIndex, value) {
  return page.evaluate(({ rowIndex, value }) => {
    const tr = document.querySelector(`.el-dialog .pis .el-table__body-wrapper tr:nth-child(${rowIndex})`)
    const input = tr.querySelector('.el-input-number input')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, String(value))
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
    input.blur()
    return input.value
  }, { rowIndex, value })
}

console.log('q1=' + await setQty(1, 4000) + ' p1=' + await pick(1, '恒亿仓'))
console.log('p2=' + await pick(2, '成品B仓') + ' q2=' + await setQty(2, 2200))
await page.waitForTimeout(600)

const ready = await page.evaluate(() => {
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const dlg = [...document.querySelectorAll('.el-dialog')].filter(vis).pop()
  const btn = [...dlg.querySelectorAll('button')].find((b) => (b.textContent || '').includes('确定拆分'))
  return {
    sum: (dlg.querySelector('.pis-sum')?.textContent || '').replace(/\s+/g, ' ').trim(),
    problem: (dlg.querySelector('.pis-problem')?.textContent || '').trim(),
    disabled: btn?.disabled,
  }
})
console.log(JSON.stringify(ready))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/purinsplit-20261117/s9-ready.png' })

if (!ready.disabled) {
  await page.click('.el-dialog button:has-text("确定拆分")', { label: 'confirm split' })
  await page.waitForTimeout(8000)
}

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

const after = await page.evaluate(() => {
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const rows = [...document.querySelectorAll('.detail .el-table__body-wrapper tr.el-table__row')].filter(vis)
  return {
    msgs: [...document.querySelectorAll('.el-message')].filter(vis).map((m) => (m.textContent || '').trim()),
    rowCount: rows.length,
    rows: rows.map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80)),
  }
})
console.log(JSON.stringify(after, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/purinsplit-20261117/s10-after-split.png' })
