// round-02:加一列检验项 + 把检测结果列加到 7 列 + 填 结果6/结果7,截图(未保存)
const task = await taskSpace('qc-insp-rec-resultcols-20261119')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_INSP_REC', { timeout: 40000 })
await page.waitForTimeout(3500)

const dump = async (tag) => {
  const st = await page.evaluate(() => ({
    stepperNum: document.querySelector('.qr-colstep-num')?.textContent?.trim() ?? null,
    headCells: [...document.querySelectorAll('.qr-table thead tr:nth-child(2) th')].map((el) => (el.textContent || '').trim()),
    resultInputs: document.querySelectorAll('.qr-table tbody tr td.c-res input').length,
    values: [...document.querySelectorAll('.qr-table tbody tr:first-child td.c-res input')].map((i) => i.value),
    rowCount: document.querySelectorAll('.qr-table tbody tr').length,
  }))
  console.log(tag + ' ' + JSON.stringify(st))
  return st
}
await dump('before')

// 1) 新增一个检验项行
await page.click('.qr-add', { label: '新增检验项行' })
await page.waitForTimeout(600)
await dump('after-addrow')

// 2) 检测结果列 5 → 7(点两次 ＋)
await page.click('.qr-colstep > span:nth-child(4)', { label: '增加检测结果列' })
await page.waitForTimeout(400)
await page.click('.qr-colstep > span:nth-child(4)', { label: '再加一列' })
await page.waitForTimeout(600)
await dump('after-addcol')

// 3) 填第一行的 结果6 / 结果7(真实 input 事件,v-model 要走通)
await page.evaluate(() => {
  const ins = [...document.querySelectorAll('.qr-table tbody tr:first-child td.c-res input')]
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  if (ins[5]) setVal(ins[5], '第6件:合格')
  if (ins[6]) setVal(ins[6], '第7件:合格')
})
await page.waitForTimeout(500)
await dump('after-fill')

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-resultcols-20261119/round-02.png' })
