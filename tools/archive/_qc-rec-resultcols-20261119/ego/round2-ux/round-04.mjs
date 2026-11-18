// round-04:有值的中间列被 × 掉 → 确认弹窗 + 右侧左移(不保存,刷新丢弃)
const task = await taskSpace('qc-insp-rec-resultcols-ux-20261119')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC', { timeout: 40000 })
await page.waitForTimeout(4500)

const dump = async (tag) => {
  const st = await page.evaluate(() => ({
    n: document.querySelectorAll('.qr-table thead tr:nth-child(2) th').length,
    values: [...document.querySelectorAll('.qr-table tbody tr:first-child td.c-res input')].map((i) => i.value),
    rows: document.querySelectorAll('.qr-table tbody tr').length,
    dialog: document.querySelector('.el-message-box') ? (document.querySelector('.el-message-box__message')?.textContent || '').trim() : null,
  }))
  console.log(tag + ' ' + JSON.stringify(st))
  return st
}

// 加一行检验项 + 加两列(5→7),再填 结果1/2/3
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.qr-addbar .qr-add')].find((x) => (x.textContent || '').includes('新增检验项'))
  if (b) b.click()
})
await page.waitForTimeout(700)
await page.click('.c-result .qr-addcol', { label: '表头新增列' })
await page.waitForTimeout(400)
await page.click('.c-result .qr-addcol', { label: '表头再加一列' })
await page.waitForTimeout(600)
await page.evaluate(() => {
  const ins = [...document.querySelectorAll('.qr-table tbody tr:first-child td.c-res input')]
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  if (ins[0]) setVal(ins[0], '第1件')
  if (ins[1]) setVal(ins[1], '第2件')
  if (ins[2]) setVal(ins[2], '第3件')
})
await page.waitForTimeout(600)
await dump('before-del')

// 删第 2 列(有值 → 应弹确认)
await page.evaluate(() => { const b = document.querySelectorAll('.c-res-del')[1]; if (b) b.click() })
await page.waitForTimeout(1000)
await dump('dialog-open')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(300)
} catch (e) { /* skip */ }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-resultcols-ux-20261119/round-04-del-confirm.png' })

await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-message-box__btns button')].find((x) => (x.textContent || '').trim() === '确定')
  if (b) b.click()
})
await page.waitForTimeout(900)
await dump('after-del')
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-resultcols-ux-20261119/round-04-after-del.png' })

// 丢弃
await page.reload({ timeout: 40000 })
await page.waitForTimeout(4000)
await dump('after-reload')
