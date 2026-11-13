import fs from 'node:fs/promises'

const OUT = 'C:/Users/Lenovo/ego/purchase-in-source-20261111'
await fs.mkdir(OUT, { recursive: true })

const task = await taskSpace('purchase-in-source-20261111')
const page = task.page('p1')

async function shot(name) {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) { console.log('restore skip: ' + e.message) }
  await page.screenshot({ path: OUT + '/' + name })
  console.log('shot=' + name)
}

// 英文界面:提示文案与单据类型名都走显示层翻译
await page.goto('http://localhost:5173/#/panelx/list/PURCHASE_IN', { timeout: 40000 })
await page.reload()
await page.waitForTimeout(5000)
await page.click('.locale-switch', { label: '切换语言下拉' })
await page.waitForTimeout(1000)
const picked = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-dropdown-menu__item')].filter((e) => e.offsetParent !== null)
  const en = items.find((e) => /English/i.test(e.innerText || ''))
  if (en) { en.click(); return (en.innerText || '').trim() }
  return null
})
console.log('picked=' + picked)
await page.waitForTimeout(3500)
await page.reload()
await page.waitForTimeout(6000)
const en = await page.evaluate(() => ({
  docChip: (document.querySelector('.tools-right .doc-chip')?.innerText || '').replace(/\s+/g, ' ').trim(),
  chip: (() => {
    const c = document.querySelector('.tools-right .doc-source')
    return c ? { text: (c.innerText || '').replace(/\s+/g, ' ').trim(), title: c.getAttribute('title') } : null
  })(),
}))
console.log('en=' + JSON.stringify(en, null, 1))
await shot('r28-list-hint-en.png')

// 切回简体中文(不留副作用)
await page.click('.locale-switch', { label: '切换语言下拉' })
await page.waitForTimeout(900)
const back = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-dropdown-menu__item')].filter((e) => e.offsetParent !== null)
  const zh = items.find((e) => (e.innerText || '').trim() === '简体中文')
  if (zh) { zh.click(); return true }
  return false
})
console.log('backToZh=' + back)

// 证据拷进仓库归档目录
const ARCH = 'D:/YINJIA-main/tools/archive/_purchase-in-source-20261111'
await fs.mkdir(ARCH, { recursive: true })
for (const f of await fs.readdir(OUT)) {
  await fs.copyFile(OUT + '/' + f, ARCH + '/' + f)
}
console.log('archived=' + (await fs.readdir(ARCH)).length + ' files')
