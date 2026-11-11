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

// 1) 采购入库单:提示在(最终形态)
await page.goto('http://localhost:5173/#/panelx/list/PURCHASE_IN', { timeout: 40000 })
await page.reload()
await page.waitForTimeout(6000)
const pi = await page.evaluate(() => ({
  docChip: (document.querySelector('.tools-right .doc-chip')?.innerText || '').replace(/\s+/g, ' ').trim(),
  labels: [...document.querySelectorAll('.udl-fields .field label')].map((e) => (e.innerText || '').trim()),
  chip: (() => {
    const c = document.querySelector('.tools-right .doc-source')
    return c ? (c.innerText || '').replace(/\s+/g, ' ').trim() : null
  })(),
}))
console.log('PURCHASE_IN=' + JSON.stringify(pi))
await shot('r29-list-final.png')

// 2) 别的面板(ASM_BOM:来源是可见字段)不该出现同样提示
await page.goto('http://localhost:5173/#/panelx/list/ASM_BOM', { timeout: 40000 })
await page.waitForTimeout(6000)
const asm = await page.evaluate(() => ({
  hash: location.hash,
  docChip: (document.querySelector('.tools-right .doc-chip')?.innerText || '').replace(/\s+/g, ' ').trim(),
  chipCount: document.querySelectorAll('.tools-right .doc-source').length,
  chip: (() => {
    const c = document.querySelector('.tools-right .doc-source')
    return c ? (c.innerText || '').replace(/\s+/g, ' ').trim() : null
  })(),
}))
console.log('ASM_BOM=' + JSON.stringify(asm))
await shot('r30-asm-no-chip.png')

// 证据同步进仓库
const ARCH = 'D:/YINJIA-main/tools/archive/_purchase-in-source-20261111'
for (const f of await fs.readdir(OUT)) await fs.copyFile(OUT + '/' + f, ARCH + '/' + f)
console.log('archived=ok')
