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

// 列表页:整页重载(前端有 cfgCache,旧页面会拿旧字段表)
await page.goto('http://localhost:5173/#/panelx/list/PURCHASE_IN', { timeout: 40000 })
await page.reload()
await page.waitForTimeout(6000)

const list = await page.evaluate(() => ({
  hash: location.hash,
  labels: [...document.querySelectorAll('.udl-fields .field label')].map((e) => (e.innerText || '').trim()),
  docChip: (document.querySelector('.tools-right .doc-chip')?.innerText || '').replace(/\s+/g, ' ').trim(),
  chip: (() => {
    const c = document.querySelector('.tools-right .doc-source')
    return c ? { text: (c.innerText || '').replace(/\s+/g, ' ').trim(), title: c.getAttribute('title'), cls: c.className } : null
  })(),
}))
console.log('list=' + JSON.stringify(list, null, 1))
await shot('r25-list-hint.png')

// 点提示 → 来源单据
if (list.chip) {
  await page.click('.tools-right .doc-source', { label: '点击来源提示' })
  await page.waitForTimeout(6000)
  const jumped = await page.evaluate(() => ({
    hash: location.hash,
    title: (document.querySelector('.head .title')?.innerText || '').replace(/\s+/g, ' '),
    tabTitles: [...document.querySelectorAll('.el-tabs__item, .tab-item')].map((e) => (e.innerText || '').trim()).slice(0, 6),
  }))
  console.log('jumped=' + JSON.stringify(jumped))
  await shot('r26-jump-source.png')
}
