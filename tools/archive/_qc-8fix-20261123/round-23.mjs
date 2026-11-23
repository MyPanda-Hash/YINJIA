// round-23: 新后端下保存 QC_BHC 草稿(载荷含派生 提交时间)不报错
const task = await taskSpace('qc-8fix-20261123')
const page = await task.newPage()
await page.goto('http://localhost:5173/#/panelx/list/QC_BHC', { timeout: 60000 })
await page.waitForTimeout(7000)
await page.evaluate(() => {
  const tr = [...document.querySelectorAll('tr')].find((n) => (n.innerText || '').includes('BHC-2026-09-0001'))
  if (tr) tr.click()
})
await page.waitForTimeout(2500)
console.log('editable save btn:', await page.evaluate(() => [...document.querySelectorAll('.as-side-btn')].map((b) => (b.innerText || '').trim()).includes('保存')))
// 在问题描述里写一段可回收的测试文字
const setDesc = await page.evaluate(() => {
  const area = document.querySelector('.as-row.q-section textarea')
  if (!area) return 'no textarea'
  const s = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
  s.call(area, '【保存链路验证-可忽略】')
  area.dispatchEvent(new Event('input', { bubbles: true }))
  return 'ok'
})
console.log('set desc:', setDesc)
await page.waitForTimeout(600)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.as-side-btn')].find((b) => (b.innerText || '').trim() === '保存')
  if (btn) btn.click()
})
await page.waitForTimeout(4000)
console.log('msg:', await page.evaluate(() => [...document.querySelectorAll('.el-message')].map((x) => (x.innerText || '').trim()).join(' | ')))
