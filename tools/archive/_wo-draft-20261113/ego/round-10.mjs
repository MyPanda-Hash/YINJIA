// round-10：调试新增页产品远程搜 + 完成 新建→删除 流程
const entry = (await listTaskSpaces()).find((s) => s.name === 'wo-draft-20261113')
const t = await taskSpace(entry.id)
const page = (await t.pages())[0]
const errors = []
page.on?.('pageerror', (e) => errors.push(String(e)))
const sleep = (ms) => page.waitForTimeout(ms)
console.log('hash=' + await page.evaluate(() => location.hash))
const st0 = await page.evaluate(() => {
  const out = {}
  for (const item of document.querySelectorAll('.wop-form .el-form-item')) {
    const label = (item.querySelector('.el-form-item__label') || {}).textContent?.trim() || ''
    const sel = item.querySelector('.el-select__selected-item') || item.querySelector('.el-select__placeholder')
    const inp = item.querySelector('input')
    out[label] = ((sel ? sel.textContent : (inp ? inp.value : '')) || '').trim()
  }
  return { labels: Object.keys(out), values: out, toasts: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()).filter(Boolean) }
})
console.log('当前表单=' + JSON.stringify(st0))
// 重新输入产品关键字并列出候选（含隐藏状态）
await page.evaluate(() => {
  const item = [...document.querySelectorAll('.wop-form .el-form-item')].find((x) => ((x.querySelector('.el-form-item__label') || {}).textContent || '').trim() === '产品编码')
  const inp = item?.querySelector('input')
  inp.focus()
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, 'A-32-01')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
})
await sleep(2800)
const cand = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')].map((x) => ({
  text: (x.textContent || '').trim(),
  h: x.getBoundingClientRect().height,
  parentDisplay: getComputedStyle(x.closest('.el-select-dropdown') || x).display,
})).slice(0, 8))
console.log('候选=' + JSON.stringify(cand, null, 1))
const picked = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.el-select-dropdown__item')]
    .filter((x) => x.getBoundingClientRect().height > 0)
    .find((x) => (x.textContent || '').trim().startsWith('A-32-01 — '))
  if (!el) return false
  el.click()
  return true
})
console.log('pick=' + picked)
await sleep(2000)
console.log('选后=' + JSON.stringify(await page.evaluate(() => {
  const out = {}
  for (const item of document.querySelectorAll('.wop-form .el-form-item')) {
    const label = (item.querySelector('.el-form-item__label') || {}).textContent?.trim() || ''
    const inp = item.querySelector('input')
    out[label] = inp ? inp.value : ''
  }
  return out
})))
// 生产数量 7
await page.evaluate(() => {
  const item = [...document.querySelectorAll('.wop-form .el-form-item')].find((x) => ((x.querySelector('.el-form-item__label') || {}).textContent || '').trim() === '生产数量')
  const inp = item?.querySelector('input')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, '7')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
  inp.dispatchEvent(new Event('blur', { bubbles: true }))
})
await sleep(800)
// 提交
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.wop-page button')].find((b) => (b.textContent || '').trim() === '提交生成工单')
  btn?.click()
})
let toasts = []
for (let i = 0; i < 30; i++) {
  await sleep(400)
  toasts = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()).filter(Boolean))
  const hash = await page.evaluate(() => location.hash)
  if (toasts.some((x) => x.includes('GD-')) || hash.includes('workOrderList')) break
}
await sleep(3500)
const afterCreate = await page.evaluate(() => ({
  hash: location.hash,
  toasts: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()).filter(Boolean),
  rows: [...document.querySelectorAll('.wol-table .el-table__body tr')].slice(0, 2).map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 220)),
}))
console.log('提交后=' + JSON.stringify(afterCreate, null, 1))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-draft-20261113/r10-created.png' })
console.log('pageerrors=' + JSON.stringify(errors))
