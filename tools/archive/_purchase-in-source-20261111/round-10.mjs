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

const INSP = 'IJ-2026-10-0064'
await page.goto('http://localhost:5173/#/panelx/form/QC_INSP?code=' + INSP, { timeout: 40000 })
await page.waitForTimeout(3500)
console.log('title=' + await page.evaluate(() => (document.querySelector('.head .title')?.innerText || '').replace(/\s+/g, ' ')))

// 审批分组 → caret → 审核
const opened = await page.evaluate(() => {
  const groups = [...document.querySelectorAll('.tools .tb-group')]
  const g = groups.find((x) => (x.querySelector('.tb-main')?.innerText || '').trim() === '审批')
  const caret = g?.querySelector('.tb-caret')
  if (!caret) return false
  caret.click(); return true
})
console.log('opened=' + opened)
await page.waitForTimeout(900)
const items = await page.evaluate(() => [...document.querySelectorAll('.el-dropdown-menu__item')]
  .filter((e) => e.offsetParent !== null).map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()))
console.log('items=' + JSON.stringify(items))

const clicked = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-dropdown-menu__item')].filter((e) => e.offsetParent !== null)
  const hit = items.find((e) => (e.innerText || '').replace(/\s+/g, ' ').trim() === '审核')
  if (!hit) return false
  hit.click(); return true
})
console.log('clicked审核=' + clicked)
await page.waitForTimeout(1800)

const box = await page.evaluate(() => {
  const b = document.querySelector('.el-message-box, .el-dialog')
  return b ? { text: (b.innerText || '').replace(/\s+/g, ' ').slice(0, 300),
    buttons: [...b.querySelectorAll('button')].map((x) => (x.innerText || '').trim()) } : null
})
console.log('box=' + JSON.stringify(box))
await shot('r14-insp-audit-confirm.png')

if (box) {
  const ok = await page.evaluate(() => {
    const b = document.querySelector('.el-message-box, .el-dialog')
    const btns = [...b.querySelectorAll('button')]
    const hit = btns.find((x) => /确定|确认/.test(x.innerText || ''))
    if (hit) { hit.click(); return (hit.innerText || '').trim() }
    return null
  })
  console.log('confirm=' + ok)
  await page.waitForTimeout(7000)
}
const final = await page.evaluate(() => ({
  title: (document.querySelector('.head .title')?.innerText || '').replace(/\s+/g, ' '),
  toast: [...document.querySelectorAll('.el-message')].map((e) => (e.innerText || '').trim()),
  body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 160),
}))
console.log('final=' + JSON.stringify(final))
await shot('r15-insp-audited.png')
