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

async function readChip() {
  return await page.evaluate(() => {
    const c = document.querySelector('.tools-right .doc-source')
    const chip = (document.querySelector('.tools-right .doc-chip')?.innerText || '').replace(/\s+/g, ' ').trim()
    if (!c) return { chip, hint: null }
    const st = getComputedStyle(c)
    return {
      chip,
      hint: (c.innerText || '').replace(/\s+/g, ' ').trim(),
      title: c.getAttribute('title'),
      cursor: st.cursor,
      hasClickHandler: c.onclick !== null,
    }
  })
}

await page.goto('http://localhost:5173/#/panelx/list/PURCHASE_IN', { timeout: 40000 })
await page.reload()
await page.waitForTimeout(6500)

// 当前(第 1 行 = PI-2026-11-0001,有来源链路)
console.log('有来源=' + JSON.stringify(await readChip()))

// 点第 3 行(CGRK-20261014-03407:ERP 形态历史单,没有上游单据)看兜底文案
const clicked = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.el-table__body tbody tr')]
  const row = rows.find((tr) => (tr.innerText || '').includes('CGRK-20261014-03407'))
  if (!row) return false
  row.click()
  return true
})
console.log('clickedRow=' + clicked)
await page.waitForTimeout(4000)
console.log('无来源=' + JSON.stringify(await readChip()))
await shot('r31-list-no-upstream.png')

// 提示不可点:点一下应当没有任何跳转
const before = await page.evaluate(() => location.hash)
await page.evaluate(() => {
  const c = document.querySelector('.tools-right .doc-source')
  if (c) c.click()
})
await page.waitForTimeout(2500)
const after = await page.evaluate(() => location.hash)
console.log('hashBefore=' + before + ' hashAfter=' + after + ' same=' + (before === after))

// 回到有来源的那张,留一张最终态截图
await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.el-table__body tbody tr')]
  const row = rows.find((tr) => (tr.innerText || '').includes('PI-2026-11-0001'))
  if (row) row.click()
})
await page.waitForTimeout(4000)
console.log('final=' + JSON.stringify(await readChip()))
await shot('r32-list-with-source.png')

// 证据拷进仓库(仅脚本会入库,png 被 .gitignore 拦)
const ARCH = 'D:/YINJIA-main/tools/archive/_purchase-in-source-20261111'
for (const f of await fs.readdir(OUT)) await fs.copyFile(OUT + '/' + f, ARCH + '/' + f)
console.log('archived=ok')
