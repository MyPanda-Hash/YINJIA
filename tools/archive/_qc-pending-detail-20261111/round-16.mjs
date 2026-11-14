/* round-16.mjs — 干净复跑:整页刷新后 ①默认只有已完成检验 ②不勾选查「正在检验中」= 0 条 ③勾选后同条件有数据 */
const task = await taskSpace('qc-pending-detail-20261111')
const page = task.page('p1')

await page.reload({ timeout: 60000 })
await page.waitForTimeout(7000)

const readTotal = () => page.evaluate(() => {
  const txt = (document.body.innerText || '').replace(/\s+/g, ' ')
  const m = txt.match(/共\s*(\d+)\s*条/)
  const bodyRows = [...document.querySelectorAll('.el-table__body-wrapper tbody tr')]
  return {
    total: m ? Number(m[1]) : null,
    rows: bodyRows.length,
    statuses: [...new Set(bodyRows.map((tr) => {
      const td = tr.querySelectorAll('td')[5]
      return td ? (td.innerText || '').trim() : ''
    }))],
    gatedChecked: !!document.querySelector('.gated-toggle.is-checked'),
  }
})

console.log('① 刷新后默认态 ->', JSON.stringify(await readTotal()))

// 查询弹窗:检验状态 = 正在检验中
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.toolbar-query-btn')].find((x) => (x.innerText || '').includes('查询'))
  if (b) b.click()
})
await page.waitForTimeout(1500)
const filled = await page.evaluate(() => {
  const dlg = document.querySelector('.el-dialog')
  if (!dlg) return 'no-dialog'
  const lab = [...dlg.querySelectorAll('label')].find((el) => (el.textContent || '').trim() === '检验状态')
  if (!lab) return 'no-label'
  let box = lab.parentElement
  let input = null
  for (let i = 0; i < 4 && box && !input; i++) { input = box.querySelector('input'); if (!input) box = box.parentElement }
  if (!input) return 'no-input'
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  s.call(input, '正在检验中')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
  return 'filled'
})
await page.waitForTimeout(300)
const submitted = await page.evaluate(() => {
  const dlg = document.querySelector('.el-dialog')
  const btns = [...dlg.querySelectorAll('button')].filter((b) => (b.textContent || '').trim() === '查询')
  if (!btns.length) return 'no-btn'
  btns[btns.length - 1].click()
  return 'clicked'
})
await page.waitForTimeout(4000)
console.log('② 未勾选 + 查询 检验状态=正在检验中 ->', JSON.stringify(await readTotal()), filled, submitted)
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-pending-detail-20261111/round-16-gate-0-rows.png' })

// 勾选「显示全部状态」→ 同条件应出 105 条
await page.evaluate(() => {
  const cb = document.querySelector('.gated-toggle input[type=checkbox]') || document.querySelector('.gated-toggle')
  if (cb) cb.click()
})
await page.waitForTimeout(4000)
console.log('③ 勾选后 + 同一查询条件 ->', JSON.stringify(await readTotal()))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-pending-detail-20261111/round-16-gate-all.png' })
