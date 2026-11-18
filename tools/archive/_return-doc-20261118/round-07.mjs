/**
 * round-07:再退一项(加工切无纺布 1 张),验证**提交后的提示不会丢**(load 会清提示条,
 * 提交时把"成功 + 打印结果"接住再写回)以及已退/可退刷新。
 */
const task = await taskSpace('return-doc-20261118')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_RETURN/doc?id=823', { timeout: 30000 })
await page.waitForTimeout(2500)
await page.evaluate(() => { document.querySelectorAll('vite-error-overlay').forEach((el) => el.remove()) })

// 扫 → 改成 1 → 确认
await page.fill('input[placeholder*="扫物料码"]', 'YJ-XWR-016|20261118003')
await page.keyboard.press('Enter')
await page.waitForTimeout(1600)
await page.fill('.mp-qty input', '1')
await page.waitForTimeout(250)
await page.click('.mp-qty button:first-of-type')
await page.waitForTimeout(1200)
const beforeSubmit = await page.evaluate(() => ({
  ok: (document.querySelector('.mp-ok') || {}).innerText || '',
  progress: [...document.querySelectorAll('.mp-kv')].map((el) => el.innerText.replace(/\s+/g, ' ').trim()).find((t) => t.startsWith('本次退料')) || '',
  foot: [...document.querySelectorAll('.mp-foot button')].map((b) => ({ text: (b.textContent || '').trim(), disabled: !!b.disabled })),
}))
console.log('== 提交前 ==')
console.log(JSON.stringify(beforeSubmit, null, 2))

await page.evaluate(() => { window.print = () => { window.__yjPrintStubbed = true } })
await page.click('.mp-foot button:last-of-type')
await page.waitForTimeout(1000)
await page.click('.el-message-box__btns button.el-button--primary')
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
console.log('== 提交后 ==')
console.log(JSON.stringify(after, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/return-doc-20261118/round-07-submitted.png' })
