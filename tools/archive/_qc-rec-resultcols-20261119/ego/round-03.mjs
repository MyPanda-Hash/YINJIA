// round-03:保存为草稿 → 刷新重取,确认 7 列 + 结果6/结果7 真落库了
const task = await taskSpace('qc-insp-rec-resultcols-20261119')
const page = task.page('p1')

const dump = async (tag) => {
  const st = await page.evaluate(() => ({
    stepperNum: document.querySelector('.qr-colstep-num')?.textContent?.trim() ?? null,
    headCells: [...document.querySelectorAll('.qr-table thead tr:nth-child(2) th')].map((el) => (el.textContent || '').trim()),
    values: [...document.querySelectorAll('.qr-table tbody tr:first-child td.c-res input')].map((i) => i.value),
    readonlyValues: [...document.querySelectorAll('.qr-table tbody tr:first-child td.c-res .qr-cell-text')].map((i) => (i.textContent || '').trim()),
    rowCount: document.querySelectorAll('.qr-table tbody tr').length,
    dirty: !!document.querySelector('.as-side-btn.is-primary'),
  }))
  console.log(tag + ' ' + JSON.stringify(st))
  return st
}
await dump('pre-save')

// 「保存为草稿」= 跳过必填校验的保存(本轮只为验列数与落库,不填必填项)
const btns = await page.evaluate(() => [...document.querySelectorAll('.as-side-btn')].map((b) => (b.textContent || '').trim()))
console.log('side buttons: ' + JSON.stringify(btns))
await page.click('.as-side-btn:has-text("保存为草稿")', { label: '保存为草稿' }).catch(async () => {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.as-side-btn')].find((x) => (x.textContent || '').trim() === '保存为草稿')
    if (b) b.click()
  })
})
await page.waitForTimeout(3000)

// 刷新重取(走服务端 detail 接口,不是本地状态)
await page.reload({ timeout: 40000 })
await page.waitForTimeout(4000)
await dump('after-reload')

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-insp-rec-resultcols-20261119/round-03.png' })
