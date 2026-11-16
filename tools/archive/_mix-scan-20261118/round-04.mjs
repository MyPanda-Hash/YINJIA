// round-04.mjs — 逐项扫码:手输数量 86.172 + 扫物料码 YJ-TJHZ-001 → 提交本笔
const task = await taskSpace('mix-scan-20261118')
const page = task.page('p1')

// 手输数量(现场没有台车秤时的兜底):el-input-number 的内层 input
const setManual = async (v) => page.evaluate((value) => {
  const inp = document.querySelector('.mm-scale-manual input')
  if (!inp) return false
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, String(value))
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
  inp.dispatchEvent(new Event('blur', { bubbles: true }))
  return true
}, v)

console.log('setManual 86.172 =>', await setManual('86.172'))
await page.waitForTimeout(400)
await page.fill('.mm-scanbar input[placeholder^="扫描或输入物料码"]', 'YJ-TJHZ-001|TEST20261118')
await page.press('.mm-scanbar input[placeholder^="扫描或输入物料码"]', 'Enter')
await page.waitForTimeout(2500)

const afterFirst = await page.evaluate(() => ({
  ok: document.querySelector('.el-alert--success .el-alert__title')?.textContent?.trim() || '',
  warn: document.querySelector('.el-alert--warning .el-alert__title')?.textContent?.trim() || '',
  prog: document.querySelector('.mm-prog')?.textContent?.trim() || '',
  rows: [...document.querySelectorAll('.mm-row')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
  active: document.querySelector('.mm-row.active .mm-code')?.textContent?.trim() || '',
}))
console.log(JSON.stringify(afterFirst, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-20261118/r4-first.png' })
