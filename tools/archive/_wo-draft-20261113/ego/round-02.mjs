// round-02：整页填一半 →「保存草稿」→ 草稿号/URL/提示
const entry = (await listTaskSpaces()).find((s) => s.name === 'wo-draft-20261113')
const t = await taskSpace(entry.id)
const page = (await t.pages())[0]
const errors = []
page.on?.('pageerror', (e) => errors.push(String(e)))
const sleep = (ms) => page.waitForTimeout(ms)
console.log('当前 hash=' + await page.evaluate(() => location.hash))

// 选主物料 A-32-01（精确，不带 **TB）
await page.evaluate(() => {
  const item = [...document.querySelectorAll('.wop-form .el-form-item')].find((x) => ((x.querySelector('.el-form-item__label') || {}).textContent || '').trim() === '产品编码')
  const inp = item?.querySelector('input')
  inp.focus()
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, 'A-32-01')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
})
await sleep(2200)
const picked = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.el-select-dropdown__item')]
    .filter((x) => x.getBoundingClientRect().height > 0)
    .find((x) => (x.textContent || '').trim().startsWith('A-32-01 — '))
  if (!el) return false
  el.click()
  return true
})
console.log('选主物料=' + picked)
await sleep(2200)
// 订单数量 10
await page.evaluate(() => {
  const item = [...document.querySelectorAll('.wop-form .el-form-item')].find((x) => ((x.querySelector('.el-form-item__label') || {}).textContent || '').trim() === '订单数量')
  const inp = item?.querySelector('input')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, '10')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
  inp.dispatchEvent(new Event('blur', { bubbles: true }))
})
await sleep(800)
const before = await page.evaluate(() => {
  const out = {}
  for (const item of document.querySelectorAll('.wop-form .el-form-item')) {
    const label = (item.querySelector('.el-form-item__label') || {}).textContent?.trim() || ''
    const sel = item.querySelector('.el-select__selected-item') || item.querySelector('.el-select__placeholder')
    const inp = item.querySelector('input')
    out[label] = ((sel ? sel.textContent : (inp ? inp.value : '')) || '').trim()
  }
  return out
})
console.log('填后=' + JSON.stringify(before))

// 保存草稿
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.wop-page button')].find((b) => (b.textContent || '').trim() === '保存草稿')
  btn?.click()
})
let toasts = []
for (let i = 0; i < 16; i++) {
  await sleep(300)
  toasts = await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()).filter(Boolean))
  if (toasts.length) break
}
await sleep(1200)
const after = await page.evaluate(() => ({
  hash: location.hash,
  url: location.href,
  head: (document.querySelector('.wop-head') || {}).textContent?.replace(/\s+/g, ' ').trim(),
  draftNo: (document.querySelector('.wop-meta-item') || {}).textContent || '',
  toasts: [...document.querySelectorAll('.el-message')].map((m) => (m.textContent || '').trim()).filter(Boolean),
}))
console.log('保存草稿后=' + JSON.stringify(after))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-draft-20261113/r02-draft-saved.png' })
console.log('pageerrors=' + JSON.stringify(errors))
