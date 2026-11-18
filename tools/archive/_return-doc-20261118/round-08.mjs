/**
 * round-08:诊断上一次提交点击后的页面状态(是否已提交成功、有没有残留弹窗/错误)。
 */
const task = await taskSpace('return-doc-20261118')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_RETURN/doc?id=823', { timeout: 30000 })
await page.waitForTimeout(2500)
await page.evaluate(() => { document.querySelectorAll('vite-error-overlay').forEach((el) => el.remove()) })

const st = await page.evaluate(() => ({
  ok: (document.querySelector('.mp-ok') || {}).innerText || '',
  err: (document.querySelector('.mp-err') || {}).innerText || '',
  kv: [...document.querySelectorAll('.mp-kv')].map((el) => el.innerText.replace(/\s+/g, ' ').trim()),
  rows: [...document.querySelectorAll('.mp-line')].map((el) => ({
    name: (el.querySelector('.mp-line-name') || {}).innerText || '',
    qty: [...el.querySelectorAll('.mp-q-row')].map((x) => x.innerText.replace(/\s+/g, ' ').trim()),
  })),
  foot: [...document.querySelectorAll('.mp-foot button')].map((b) => ({ text: (b.textContent || '').trim(), disabled: !!b.disabled })),
  msgBox: !!document.querySelector('.el-message-box'),
}))
console.log(JSON.stringify(st, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/return-doc-20261118/round-08-state.png' })
