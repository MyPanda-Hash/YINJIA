// round-18: 分章节责任人各自填不同人 → 保存 → 查库验证互不影响
const task = await taskSpace('qc-8fix-20261123')
const page = await task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/QC_BHC', { timeout: 60000 })
await page.waitForTimeout(6000)
await page.evaluate(() => {
  const tr = [...document.querySelectorAll('tr')].find((n) => (n.innerText || '').includes('BHC-2026-09-0001'))
  if (tr) tr.click()
})
await page.waitForTimeout(2500)
console.log('doc:', await page.evaluate(() => (document.querySelector('.as-title')?.innerText || '').trim()))
const set = await page.evaluate(() => {
  const inputs = [...document.querySelectorAll('.q-sign-input input')]
  const names = ['张三', '李四', '王五', '赵六', '钱七']
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  inputs.forEach((el, i) => setVal(el, names[i] || ('人' + i)))
  return { count: inputs.length, values: inputs.map((x) => x.value) }
})
console.log('set:', JSON.stringify(set))
await page.waitForTimeout(800)
const save = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.as-side-btn')].find((b) => (b.innerText || '').trim() === '保存')
  if (btn) { btn.click(); return true }
  return false
})
console.log('save:', save)
await page.waitForTimeout(4000)
console.log('msg:', await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((x) => (x.innerText || '').trim()).join(' | ')))
console.log('signLines:', await page.evaluate(() => [...document.querySelectorAll('.q-signline')].map((x) => (x.innerText || '').replace(/\s+/g, ' ').trim())))
await page.screenshot({ path: 'C:/Users/vigna/ego/qc-8fix-20261123/round-18-bhc-owners.png' })
