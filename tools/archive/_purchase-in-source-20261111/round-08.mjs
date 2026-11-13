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
await page.waitForTimeout(4000)

const before = await page.evaluate(() => ({
  hash: location.hash,
  toolbar: [...document.querySelectorAll('.tools .tb-main')].map((e) => (e.innerText || '').trim()),
  status: (document.querySelector('.head .title')?.innerText || '').replace(/\s+/g, ' '),
}))
console.log('before=' + JSON.stringify(before))
await shot('r08-insp-before.png')

// 点工具栏「审核」(主按钮)
const clicked = await page.evaluate(() => {
  const t = [...document.querySelectorAll('.tools .tb-main')].find((e) => (e.innerText || '').trim() === '审核')
  if (!t) return null
  t.click()
  return '审核'
})
console.log('clicked=' + clicked)
await page.waitForTimeout(1800)

const dlg = await page.evaluate(() => {
  const box = document.querySelector('.el-message-box')
  return box ? { text: (box.innerText || '').replace(/\s+/g, ' '),
    buttons: [...box.querySelectorAll('button')].map((b) => (b.innerText || '').trim()) } : null
})
console.log('dialog=' + JSON.stringify(dlg))
await shot('r09-insp-confirm.png')

if (dlg) {
  const ok = await page.evaluate(() => {
    const box = document.querySelector('.el-message-box')
    if (!box) return null
    const btns = [...box.querySelectorAll('button')]
    const b = btns.find((x) => /确定|确认/.test(x.innerText || ''))
    if (b) { b.click(); return (b.innerText || '').trim() }
    return null
  })
  console.log('confirm=' + ok)
  await page.waitForTimeout(6000)
  const after = await page.evaluate(() => ({
    hash: location.hash,
    status: (document.querySelector('.head .title')?.innerText || '').replace(/\s+/g, ' '),
    body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 300),
  }))
  console.log('after=' + JSON.stringify(after))
  await shot('r10-insp-after.png')
}
