const task = await taskSpace('pickrow-eval-20261117')
const page = task.page('p1')
await page.keyboard.press('Escape')
await page.waitForTimeout(500)

const res = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const tr = [...document.querySelectorAll('.dsr-grid tr')].find((r) => (r.textContent || '').includes('LZW-20261112-01'))
  if (!tr) return 'no-row'
  const cb = tr.querySelector('.el-checkbox')
  if (cb && !cb.classList.contains('is-checked')) cb.click()
  await sleep(600)
  const groups = [...document.querySelectorAll('.tb-group')]
  const g = groups.find((el) => el.querySelector('.act-name')?.textContent.trim() === '生单')
  const caret = g?.querySelector('.tb-caret')
  if (!caret) return 'no-caret'
  caret.click()
  await sleep(900)
  const items = [...document.querySelectorAll('.tb-menu .ctx-item')].map((d) => (d.textContent || '').trim())
  const item = [...document.querySelectorAll('.tb-menu .ctx-item')].find((d) => (d.textContent || '').trim() === '批量生单')
  if (!item) return 'items=' + JSON.stringify(items)
  item.click()
  return 'clicked:' + item.textContent.trim()
})
console.log('res=' + res)
await page.waitForTimeout(9000)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }

const state = await page.evaluate(() => {
  const vis = (el) => !!(el.offsetParent || el.getClientRects().length)
  const dlg = [...document.querySelectorAll('.el-dialog')].filter(vis).pop()
  if (!dlg) return { dialog: null, msgs: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()) }
  return {
    title: (dlg.querySelector('.el-dialog__title')?.textContent || '').trim(),
    rows: [...dlg.querySelectorAll('.el-table__body-wrapper tr.el-table__row')].map((tr) => {
      const chk = tr.querySelector('.el-checkbox')
      const inputs = [...tr.querySelectorAll('.el-input-number input')]
      return {
        text: (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 36),
        checked: !!chk?.classList.contains('is-checked'),
        cls: tr.className,
        qtyDisabled: inputs[0]?.disabled,
        qtyVal: inputs[0]?.value,
      }
    }),
  }
})
console.log(JSON.stringify(state, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/pickrow-eval-20261117/v18-generatelines.png' })
