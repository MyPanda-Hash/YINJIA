// round-04：草稿箱「继续编辑」后补全并「提交生成工单」→ 跳回列表定位新单（常规）
const entry = (await listTaskSpaces()).find((s) => s.name === 'wo-draft-20261113')
const t = await taskSpace(entry.id)
const page = (await t.pages())[0]
const errors = []
page.on?.('pageerror', (e) => errors.push(String(e)))
const sleep = (ms) => page.waitForTimeout(ms)
// 当前应停留在 ?draftId=9 的整页；等新实例起来后刷新一次再继续
await page.reload({ timeout: 30000 })
await sleep(4500)
console.log('hash=' + await page.evaluate(() => location.hash))
// 选客户(可选)：第二个 el-select → 选第一个有效客户；不选也能提交(客户可空)
const prefilled = await page.evaluate(() => {
  const out = {}
  for (const item of document.querySelectorAll('.wop-form .el-form-item')) {
    const label = (item.querySelector('.el-form-item__label') || {}).textContent?.trim() || ''
    const sel = item.querySelector('.el-select__selected-item') || item.querySelector('.el-select__placeholder')
    const inp = item.querySelector('input')
    out[label] = ((sel ? sel.textContent : (inp ? inp.value : '')) || '').trim()
  }
  return { head: (document.querySelector('.wop-head') || {}).textContent?.replace(/\s+/g, ' ').trim(), values: out }
})
console.log('回填=' + JSON.stringify(prefilled))
// 提交（工艺路线默认已带 GY-CB-STD；若不带则先选）
const routeVal = await page.evaluate(() => {
  const item = [...document.querySelectorAll('.wop-form .el-form-item')].find((x) => ((x.querySelector('.el-form-item__label') || {}).textContent || '').trim() === '工艺路线')
  return item ? ((item.querySelector('.el-select__selected-item') || {}).textContent || '').trim() : ''
})
console.log('路线显示=' + JSON.stringify(routeVal))
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.wop-page button')].find((b) => (b.textContent || '').trim() === '提交生成工单')
  btn?.click()
})
let toasts = []
for (let i = 0; i < 24; i++) {
  await sleep(400)
  toasts = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()).filter(Boolean))
  const hash = await page.evaluate(() => location.hash)
  if (toasts.some((x) => x.includes('GD-')) || hash.includes('workOrderList')) break
}
await sleep(3500)
const after = await page.evaluate(() => ({
  hash: location.hash,
  url: location.href,
  toasts: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()).filter(Boolean),
  draftBox: (() => {
    const b = [...document.querySelectorAll('.wol-btns button')].find((x) => (x.textContent || '').includes('草稿箱'))
    return b ? (b.textContent || '').replace(/\s+/g, ' ').trim() : ''
  })(),
  rows: [...document.querySelectorAll('.wol-table .el-table__body tr')].slice(0, 3).map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200)),
}))
console.log('提交后=' + JSON.stringify(after, null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-draft-20261113/r04-submitted.png' })
console.log('pageerrors=' + JSON.stringify(errors))
