/* round-23:8090 打包版复核(正式账套 YJ,只读查看,不保存) */
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/sample-insp-module-20261116/'
const task = await taskSpace(1)
const page = (await task.pages())[0]
await page.goto('http://127.0.0.1:8090/#/panelx/list/INSP_COMMISSION', { timeout: 90000 })
await page.waitForTimeout(5000)
const onLogin = await page.evaluate(() => !!document.querySelector('input[placeholder="请输入登录账号"]'))
if (onLogin) {
  await page.fill('input[placeholder="请输入登录账号"]', 'admin')
  await page.fill('input[placeholder="请输入登录密码"]', '123456')
  await page.click('button.login-submit')
  await page.waitForTimeout(6000)
  await page.goto('http://127.0.0.1:8090/#/panelx/list/INSP_COMMISSION', { timeout: 90000 })
  await page.waitForTimeout(6000)
}
const st = await page.evaluate(() => {
  const nav = (document.querySelector('.leftnav')?.innerText || '').split('\n').map((s) => s.trim()).filter(Boolean)
  const rows = [...document.querySelectorAll('.ic-grid tr')].slice(0, 3).map((tr) => ({
    th: (tr.querySelector('th')?.innerText || '').replace(/\s+/g, ' ').trim(),
    inputs: [...tr.querySelectorAll('input')].map((i) => i.placeholder || i.value),
  }))
  return { hash: location.hash, nav: nav.slice(0, 18), rows, docNo: (document.querySelector('.ic-meta-no')?.innerText || '').trim() }
})
console.log(JSON.stringify(st, null, 2))
await page.screenshot({ path: OUT + 'round-23-8090-screen.png' })
console.log('shot round-23-8090-screen.png')
