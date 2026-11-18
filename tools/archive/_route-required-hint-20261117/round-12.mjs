const task = await taskSpace('route-required-hint-20261117')
const page = task.page('p1')

// 关掉必填弹窗
await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-message-box')].find((b) => b.offsetParent !== null)
  const btns = box ? [...box.querySelectorAll('button')] : []
  if (btns.length) btns[btns.length - 1].click()
})
await page.waitForTimeout(1200)

// 点第 1 行「工序编码」格 → 起一行 + 弹工序参照
await page.evaluate(() => {
  const tr = document.querySelector('.el-table__body-wrapper tbody tr')
  const td = tr?.querySelectorAll('td')?.[0]
  if (td) td.click()
})
await page.waitForTimeout(3000)
const pick = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  if (!d) return null
  const tr = d.querySelector('.el-table__body-wrapper tbody tr')
  return {
    title: (d.querySelector('.el-dialog__title')?.textContent || '').trim(),
    rowCount: d.querySelectorAll('.el-table__body-wrapper tbody tr').length,
    firstRow: tr ? [...tr.querySelectorAll('td')].slice(0, 4).map((td) => (td.innerText || '').trim()) : [],
    btns: [...d.querySelectorAll('button')].map((b) => (b.textContent || '').trim()).filter(Boolean).slice(-4),
  }
})
console.log('picker:', JSON.stringify(pick))

// 点行即勾选(2026-11-13 口径),再点「确定」
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const tr = d?.querySelector('.el-table__body-wrapper tbody tr')
  if (tr) tr.click()
})
await page.waitForTimeout(1000)
await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetParent !== null)
  const b = [...d.querySelectorAll('button')].find((x) => /确定|确 定/.test(x.textContent || ''))
  if (b) b.click()
})
await page.waitForTimeout(3500)
console.log('rowsAfterPick:', JSON.stringify(await page.evaluate(() =>
  [...document.querySelectorAll('.el-table__body-wrapper tbody tr')].slice(0, 4).map((tr) => [...tr.querySelectorAll('td')].slice(0, 6).map((td) => (td.innerText || '').trim())))))
await page.screenshot({ path: 'C:/Users/vigna/ego/route-required-hint-20261117/round-12-row-added.png' })
