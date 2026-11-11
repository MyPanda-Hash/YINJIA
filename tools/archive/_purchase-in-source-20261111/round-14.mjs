import fs from 'node:fs/promises'

const OUT = 'C:/Users/Lenovo/ego/purchase-in-source-20261111'
const task = await taskSpace('purchase-in-source-20261111')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/panelx/list/PURCHASE_IN', { timeout: 40000 })
await page.waitForTimeout(3000)
await page.click('.locale-switch', { label: '切换语言下拉' })
await page.waitForTimeout(1000)
const langs = await page.evaluate(() => [...document.querySelectorAll('.el-dropdown-menu__item')]
  .filter((e) => e.offsetParent !== null).map((e) => (e.innerText || '').trim()))
console.log('langs=' + JSON.stringify(langs))
const ok = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-dropdown-menu__item')].filter((e) => e.offsetParent !== null)
  const zh = items.find((e) => (e.innerText || '').trim() === '简体中文')
  if (zh) { zh.click(); return true }
  return false
})
console.log('backToZh=' + ok)
await page.waitForTimeout(2500)
console.log('title=' + await page.evaluate(() => (document.querySelector('.head .title')?.innerText || '').replace(/\s+/g, ' ') + ' | ' + (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 80)))

// 把跑过的脚本拷进仓库归档目录(证据可复跑)
const ARCH = 'D:/YINJIA-main/tools/archive/_purchase-in-source-20261111'
await fs.mkdir(ARCH, { recursive: true })
const files = await fs.readdir(OUT)
for (const f of files) {
  await fs.copyFile(OUT + '/' + f, ARCH + '/' + f)
}
console.log('archived=' + (await fs.readdir(ARCH)).join(','))
