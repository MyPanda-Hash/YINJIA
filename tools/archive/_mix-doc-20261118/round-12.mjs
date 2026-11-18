/**
 * round-12:8090(正式库会话)切到测试账套登录,验证「部署产物 + 测试库」也能跑通列表页。
 * 仅只读:打开列表页截图,不点提交。
 */
const task = await taskSpace('mix-doc-20261118')
const page = task.page('p1')

await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
await page.goto('http://127.0.0.1:8090/#/login', { timeout: 30000 })
await page.waitForTimeout(3000)

const form = await page.evaluate(() => ({
  hash: location.hash,
  inputs: [...document.querySelectorAll('input')].map((i) => i.placeholder || i.type),
  selects: [...document.querySelectorAll('.el-select')].map((s) => s.innerText.replace(/\s+/g, ' ').trim()),
  buttons: [...document.querySelectorAll('button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 8),
}))
console.log('== 8090 登录页 ==')
console.log(JSON.stringify(form, null, 2))
