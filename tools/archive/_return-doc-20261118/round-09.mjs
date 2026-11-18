/**
 * round-09:重试"退一项并提交",这次把每一步的状态打出来(上次提交点击时 ego 报了协议错)。
 */
const task = await taskSpace('return-doc-20261118')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_RETURN/doc?id=823', { timeout: 30000 })
await page.waitForTimeout(2500)
await page.evaluate(() => { document.querySelectorAll('vite-error-overlay').forEach((el) => el.remove()) })

await page.fill('input[placeholder*="扫物料码"]', 'YJ-XWR-016|20261118003')
await page.keyboard.press('Enter')
await page.waitForTimeout(1800)
await page.fill('.mp-qty input', '1')
await page.waitForTimeout(300)
await page.click('.mp-qty button:first-of-type')
await page.waitForTimeout(1200)
console.log('① 已确认一项:', JSON.stringify(await page.evaluate(() => ({
  ok: (document.querySelector('.mp-ok') || {}).innerText || '',
  foot: [...document.querySelectorAll('.mp-foot button')].map((b) => ({ t: (b.textContent || '').trim(), d: !!b.disabled })),
}))))

await page.evaluate(() => { window.print = () => { window.__yjPrintStubbed = true } })
console.log('② 打印已打桩,点提交 …')
try {
  await page.click('.mp-foot button:last-of-type', { timeout: 8000 })
} catch (e) {
  console.log('   点提交失败:', e.message)
}
await page.waitForTimeout(1500)
const info = await page.info()
console.log('③ 点击后 page.info:', JSON.stringify({ url: info.url, dialog: info.dialog || null }))
console.log('   弹窗存在:', await page.evaluate(() => !!document.querySelector('.el-message-box')),
  '| 文本:', await page.evaluate(() => ((document.querySelector('.el-message-box') || {}).innerText || '').replace(/\s+/g, ' ').trim()))

// 若有原生对话框,先处理掉
if (info.dialog) await page.acceptDialog()
try {
  await page.click('.el-message-box__btns button.el-button--primary', { timeout: 8000 })
  console.log('④ 已点「确定退料」')
} catch (e) {
  console.log('   点确定失败:', e.message)
}
await page.waitForTimeout(5000)

const after = await page.evaluate(() => ({
  ok: (document.querySelector('.mp-ok') || {}).innerText || '',
  err: (document.querySelector('.mp-err') || {}).innerText || '',
  kv: [...document.querySelectorAll('.mp-kv')].map((el) => el.innerText.replace(/\s+/g, ' ').trim()),
  rows: [...document.querySelectorAll('.mp-line')].map((el) => ({
    name: (el.querySelector('.mp-line-name') || {}).innerText || '',
    qty: [...el.querySelectorAll('.mp-q-row')].map((x) => x.innerText.replace(/\s+/g, ' ').trim()),
  })),
  foot: [...document.querySelectorAll('.mp-foot button')].map((b) => ({ text: (b.textContent || '').trim(), disabled: !!b.disabled })),
}))
console.log('⑤ 提交后:')
console.log(JSON.stringify(after, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/return-doc-20261118/round-09-submitted.png' })
