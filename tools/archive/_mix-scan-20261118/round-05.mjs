// round-05.mjs — 第二项扫码 → 整单保存并打印(验收时把 window.print 打成空操作,避免弹系统打印对话框)
const task = await taskSpace('mix-scan-20261118')
const page = task.page('p1')

// 验收脚本不真出纸:打印层的 window.print() 会弹系统对话框并冻结页面
await page.evaluate(() => { window.print = () => console.info('[verify] window.print suppressed') })

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

await setManual('21.042')
await page.waitForTimeout(300)
await page.fill('.mm-scanbar input[placeholder^="扫描或输入物料码"]', 'YJ-YKRS-005|TEST20261118')
await page.press('.mm-scanbar input[placeholder^="扫描或输入物料码"]', 'Enter')
await page.waitForTimeout(2000)
const beforeSave = await page.evaluate(() => ({
  prog: document.querySelector('.mm-prog')?.textContent?.trim() || '',
  foot: document.querySelector('.mm-foot')?.textContent?.replace(/\s+/g, ' ').trim() || '',
}))
console.log('before save:', JSON.stringify(beforeSave))

await page.click('.mm-foot-btn', { label: '整单保存并打印' })
await page.waitForTimeout(4000)

const afterSave = await page.evaluate(() => ({
  toast: [...document.querySelectorAll('.el-message__content')].map((e) => e.textContent.trim()),
  ok: [...document.querySelectorAll('.el-alert--success .el-alert__title')].map((e) => e.textContent.trim()),
  warn: document.querySelector('.el-alert--warning .el-alert__title')?.textContent?.trim() || '',
  printMsg: document.querySelector('.mm-print-msg .el-alert__title')?.textContent?.trim() || '',
  docs: [...document.querySelectorAll('.mm-doc')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
  prog: document.querySelector('.mm-prog')?.textContent?.trim() || '',
  rows: [...document.querySelectorAll('.mm-row')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim()),
}))
console.log(JSON.stringify(afterSave, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-20261118/r5-saved.png' })
