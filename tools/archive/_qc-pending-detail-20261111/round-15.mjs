/* round-15.mjs — 服务端闸门举证:不勾「显示全部状态」时,查询 检验状态=正在检验中 必须查不出 */
const task = await taskSpace('qc-pending-detail-20261111')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC_DETAIL', { timeout: 60000 })
await page.waitForTimeout(6000)

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
console.log('起点(未勾选) ->', JSON.stringify(await readTotal()))

// 打开查询弹窗
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.toolbar-query-btn')].find((x) => (x.innerText || '').includes('查询'))
  if (b) b.click()
})
await page.waitForTimeout(1500)

// 填「检验状态」= 正在检验中
const filled = await page.evaluate(() => {
  const dlg = document.querySelector('.el-dialog')
  if (!dlg) return 'no-dialog'
  const labels = [...dlg.querySelectorAll('label')]
  const lab = labels.find((el) => (el.textContent || '').trim() === '检验状态')
  if (!lab) return 'no-label:' + labels.map((l) => (l.textContent || '').trim()).slice(0, 20).join('|')
  let box = lab.parentElement
  let input = null
  for (let i = 0; i < 4 && box && !input; i++) {
    input = box.querySelector('input')
    if (!input) box = box.parentElement
  }
  if (!input) return 'no-input'
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  setVal(input, '正在检验中')
  return 'filled'
})
console.log('填检验状态 ->', filled)
await page.waitForTimeout(400)

// 弹窗里点「查询」提交
const submitted = await page.evaluate(() => {
  const dlg = document.querySelector('.el-dialog')
  if (!dlg) return 'no-dialog'
  const btns = [...dlg.querySelectorAll('button')].filter((b) => (b.textContent || '').trim() === '查询')
  if (btns.length) { btns[btns.length - 1].click(); return 'clicked:' + btns.length }
  const all = [...dlg.querySelectorAll('button')].map((b) => (b.textContent || '').trim())
  return 'no-btn:' + all.join('|')
})
console.log('提交 ->', submitted)
await page.waitForTimeout(4000)
console.log('未勾选 + 查询正在检验中 ->', JSON.stringify(await readTotal()))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-pending-detail-20261111/round-15-gate-query.png' })

// 勾上「显示全部状态」→ 同一个条件应查得出来
await page.evaluate(() => {
  const cb = document.querySelector('.gated-toggle input[type=checkbox]') || document.querySelector('.gated-toggle')
  if (cb) cb.click()
})
await page.waitForTimeout(4000)
console.log('勾选后 + 同一查询条件 ->', JSON.stringify(await readTotal()))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-pending-detail-20261111/round-15-gate-all.png' })
