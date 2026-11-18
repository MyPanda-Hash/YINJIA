const task = await taskSpace('pickrow-eval-20261117')
const page = task.page('p1')

// 关掉弹窗
await page.evaluate(() => {
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  document.querySelectorAll('.el-dialog__headerbtn').forEach((b) => { if (vis(b)) b.click() })
})
await page.waitForTimeout(1200)

// 换成 4 行的销售订单 LZW-20261111-01
const res = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  // 取消上一张的勾选
  const prev = [...document.querySelectorAll('.dsr-grid tr')].find((r) => (r.textContent || '').includes('LZW-20261112-01'))
  const pcb = prev?.querySelector('.el-checkbox')
  if (pcb && pcb.classList.contains('is-checked')) pcb.click()
  await sleep(400)
  // 搜索
  const inp = [...document.querySelectorAll('input')].find((i) => (i.placeholder || '').includes('模糊搜索'))
  if (!inp) return 'no-search'
  const setVal = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setVal.call(inp, 'LZW-20261111-01')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  ;[...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '查找')?.click()
  await sleep(4000)
  const tr = [...document.querySelectorAll('.dsr-grid tr')].find((r) => (r.textContent || '').includes('LZW-20261111-01'))
  if (!tr) return 'no-row'
  tr.click()
  await sleep(1200)
  const cb = tr.querySelector('.el-checkbox')
  if (cb && !cb.classList.contains('is-checked')) cb.click()
  await sleep(600)
  const groups = [...document.querySelectorAll('.tb-group')]
  const g = groups.find((el) => el.querySelector('.act-name')?.textContent.trim() === '生单')
  const caret = g?.querySelector('.tb-caret')
  if (!caret) return 'no-caret'
  caret.click()
  await sleep(900)
  const item = [...document.querySelectorAll('.tb-menu .ctx-item')].find((d) => (d.textContent || '').trim() === '批量生单')
  if (!item) return 'no-item'
  item.click()
  return 'ok'
})
console.log('res=' + res)
await page.waitForTimeout(9000)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

// 取消勾选第二行
await page.click('.el-dialog .el-table__body-wrapper tr.el-table__row:nth-child(2) .el-checkbox', { label: 'uncheck row 2' })
await page.waitForTimeout(900)

const state = await page.evaluate(() => {
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const dlg = [...document.querySelectorAll('.el-dialog')].filter(vis).pop()
  if (!dlg) return { dialog: null }
  return {
    title: (dlg.querySelector('.el-dialog__title')?.textContent || '').trim(),
    rows: [...dlg.querySelectorAll('.el-table__body-wrapper tr.el-table__row')].map((tr) => {
      const td = tr.querySelector('td.el-table__cell')
      const chk = tr.querySelector('.el-checkbox')
      const inputs = [...tr.querySelectorAll('.el-input-number input')]
      return {
        checked: !!chk?.classList.contains('is-checked'),
        cls: tr.className,
        bg: getComputedStyle(td).backgroundColor,
        color: getComputedStyle(tr.querySelector('td .cell')).color,
        qtyDisabled: inputs[0]?.disabled,
        qtyVal: inputs[0]?.value,
      }
    }),
  }
})
console.log(JSON.stringify(state, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/pickrow-eval-20261117/v19-generatelines-unchecked.png' })
