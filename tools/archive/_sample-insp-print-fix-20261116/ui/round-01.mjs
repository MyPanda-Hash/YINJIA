/* round-01:5173 源码版 —— 新增草稿 → 导出→打印预览(应改走原生打印) */
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/sample-insp-print-fix-20261116/'
const task = await taskSpace('sample-insp-print-fix-20261116')
const page = (await task.pages())[0]
console.log('space=' + task.spaceId + ' page=' + page.label)
await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 90000 })
await page.waitForTimeout(6000)
const onLogin = await page.evaluate(() => !!document.querySelector('input[placeholder="请输入登录账号"]'))
if (onLogin) {
  // 登录工厂选测试库
  await page.click('.el-select--large .el-select__wrapper')
  await page.waitForTimeout(800)
  await page.evaluate(() => {
    const hit = [...document.querySelectorAll('.el-select-dropdown__item')].find((e) => (e.textContent || '').includes('测试'))
    if (hit) hit.click()
  })
  await page.waitForTimeout(600)
  await page.fill('input[placeholder="请输入登录账号"]', 'admin')
  await page.fill('input[placeholder="请输入登录密码"]', '123456')
  await page.click('button.login-submit')
  await page.waitForTimeout(6000)
  await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 90000 })
  await page.waitForTimeout(6000)
}
let st = await page.evaluate(() => ({ docNo: (document.querySelector('.ic-meta-no')?.innerText || '').trim(), inputs: document.querySelectorAll('.ic-sheet input').length }))
console.log('state:', JSON.stringify(st))
if (!st.inputs) {
  await page.evaluate(() => { const b = [...document.querySelectorAll('.as-side-btn')].find((x) => (x.textContent || '').trim() === '新增'); b && b.click() })
  await page.waitForTimeout(4500)
  st = await page.evaluate(() => ({ docNo: (document.querySelector('.ic-meta-no')?.innerText || '').trim(), inputs: document.querySelectorAll('.ic-sheet input').length }))
  console.log('after 新增:', JSON.stringify(st))
}
// 拦截 window.print,防止弹预览挡住后续取证
await page.evaluate(() => { window.__printCalled = 0; window.print = () => { window.__printCalled++ } })
// 打开导出 → 打印预览
await page.evaluate(() => { const b = [...document.querySelectorAll('.as-side-btn')].find((x) => (x.textContent || '').trim() === '导出'); b && b.click() })
await page.waitForTimeout(1200)
const pre = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.el-dialog')].find((x) => x.offsetWidth)
  if (!d) return { err: 'no dialog' }
  const hit = [...d.querySelectorAll('*')].find((e) => (e.textContent || '').trim() === '打印预览' && !e.children.length)
  if (!hit) return { err: 'no 打印预览' }
  hit.click(); return { ok: true }
})
console.log('click 打印预览:', JSON.stringify(pre))
await page.waitForTimeout(3500)
const after = await page.evaluate(() => ({
  printCalled: window.__printCalled,
  host: !!document.getElementById('yj-print-host'),
  bodyClass: document.body.classList.contains('approval-printing'),
  pageStyle: !!document.getElementById('ic-print-page'),
  printZoom: document.documentElement.style.getPropertyValue('--print-zoom'),
  docNo: (document.querySelector('.ic-meta-no')?.innerText || '').trim(),
}))
console.log('after 打印预览:', JSON.stringify(after))
