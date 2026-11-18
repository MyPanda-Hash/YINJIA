/**
 * round-05:提交退料(本机无打印代理 ⇒ window.print 打桩,只影响"出纸"这一步)→ 看退料单号与已退刷新。
 */
const task = await taskSpace('return-doc-20261118')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_RETURN/doc?id=823', { timeout: 30000 })
await page.waitForTimeout(2500)
await page.evaluate(() => { document.querySelectorAll('vite-error-overlay').forEach((el) => el.remove()) })

const before = await page.evaluate(() => ({
  kv: [...document.querySelectorAll('.mp-kv')].map((el) => el.innerText.replace(/\s+/g, ' ').trim()),
}))
console.log('== 提交前抬头 ==')
console.log(JSON.stringify(before, null, 2))

// 录两项:热缩袋 4 + 标签 2
const scanAndConfirm = async (code, qty) => {
  await page.fill('input[placeholder*="扫物料码"]', code)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1600)
  await page.fill('.mp-qty input', String(qty))
  await page.waitForTimeout(250)
  await page.click('.mp-qty button:first-of-type')
  await page.waitForTimeout(1200)
}
await scanAndConfirm('YJ-KBL-003', 4)
await scanAndConfirm('YJ-TBRW-001', 2)

// 打印打桩 + 提交
await page.evaluate(() => { window.print = () => { window.__yjPrintStubbed = true } })
await page.click('.mp-foot button:last-of-type')
await page.waitForTimeout(1200)
const box = await page.evaluate(() => (document.querySelector('.el-message-box') || {}).innerText || '')
console.log('== 提交确认框 ==')
console.log(JSON.stringify(box.replace(/\s+/g, ' ').trim(), null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/return-doc-20261118/round-05-confirm-box.png' })

await page.click('.el-message-box__btns button.el-button--primary')
await page.waitForTimeout(5000)

const after = await page.evaluate(() => ({
  hash: location.hash,
  ok: (document.querySelector('.mp-ok') || {}).innerText || '',
  err: (document.querySelector('.mp-err') || {}).innerText || '',
  kv: [...document.querySelectorAll('.mp-kv')].map((el) => el.innerText.replace(/\s+/g, ' ').trim()),
  rows: [...document.querySelectorAll('.mp-line')].map((el) => ({
    name: (el.querySelector('.mp-line-name') || {}).innerText || '',
    qty: [...el.querySelectorAll('.mp-q-row')].map((x) => x.innerText.replace(/\s+/g, ' ').trim()),
  })),
  foot: [...document.querySelectorAll('.mp-foot button')].map((b) => ({ text: (b.textContent || '').trim(), disabled: !!b.disabled })),
}))
console.log('== 提交后 ==')
console.log(JSON.stringify(after, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/return-doc-20261118/round-05-submitted.png' })
