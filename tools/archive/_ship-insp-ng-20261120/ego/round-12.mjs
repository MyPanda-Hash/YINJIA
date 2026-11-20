const task = await taskSpace('qc-ng-20261120')
const page = task.page('p1')
const pickVerdict = async () => {
  // 点「检验结论」下拉(表尾第 1 个 el-select)
  await page.evaluate(() => {
    const sel = document.querySelector('.qr-foot-table .el-select')
    if (sel) sel.click()
  })
  await page.waitForTimeout(700)
  const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')].map((e) => (e.innerText || '').trim()))
  console.log('VERDICT OPTS', JSON.stringify(opts))
  await page.evaluate(() => {
    const opt = [...document.querySelectorAll('.el-select-dropdown__item')].find((e) => (e.innerText || '').trim() === '不合格')
    if (opt) opt.click()
  })
  await page.waitForTimeout(1000)
}
await pickVerdict()
const after = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  const band = document.querySelector('.qr-band')
  return {
    band: band ? txt(band) : '(no band)',
    ngLink: !!document.querySelector('.qr-band-ng'),
    foot: txt(document.querySelector('.qr-foot-table')),
  }
})
console.log('AFTER VERDICT', JSON.stringify(after, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-ng-20261120/s12-ng-button.png' })
// 点「去开不合格处理单」
await page.evaluate(() => {
  const el = document.querySelector('.qr-band-ng')
  if (el) el.click()
})
await page.waitForTimeout(9000)
const jumped = await page.evaluate(() => {
  const txt = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim()
  return {
    hash: location.hash,
    title: document.title,
    toasts: [...document.querySelectorAll('.el-message')].map((m) => txt(m)),
    sheetHead: txt(document.querySelector('.as-head, .qr-head-table, .approval-sheet'))?.slice(0, 400),
    body: txt(document.body).slice(0, 400),
  }
})
console.log('JUMPED', JSON.stringify(jumped, null, 2))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-ng-20261120/s12-jumped.png' })
