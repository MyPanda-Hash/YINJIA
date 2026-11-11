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

async function clickToolbar(mainText) {
  const r = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('.tools .tb-main')].find((e) => (e.innerText || '').trim() === t)
    if (!el) return false
    el.click(); return true
  }, mainText)
  console.log('click ' + mainText + ' -> ' + r)
  await page.waitForTimeout(1500)
  return r
}

/** 展开某个工具栏分组的下拉(点它右边的 caret),返回可见菜单项文本 */
async function openDropdown(mainText) {
  const r = await page.evaluate((t) => {
    const groups = [...document.querySelectorAll('.tools .tb-group')]
    const g = groups.find((x) => (x.querySelector('.tb-main')?.innerText || '').trim() === t)
    const caret = g?.querySelector('.tb-caret')
    if (!caret) return false
    caret.click(); return true
  }, mainText)
  console.log('openDropdown ' + mainText + ' -> ' + r)
  await page.waitForTimeout(900)
  return await page.evaluate(() => [...document.querySelectorAll('.el-dropdown-menu__item')]
    .filter((e) => e.offsetParent !== null).map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim()))
}

async function clickMenuItem(text) {
  const r = await page.evaluate((t) => {
    const items = [...document.querySelectorAll('.el-dropdown-menu__item')].filter((e) => e.offsetParent !== null)
    const hit = items.find((e) => (e.innerText || '').replace(/\s+/g, ' ').trim() === t)
    if (!hit) return false
    hit.click(); return true
  }, text)
  console.log('clickMenuItem ' + text + ' -> ' + r)
  await page.waitForTimeout(1800)
  return r
}

async function confirmBox() {
  const box = await page.evaluate(() => {
    const b = document.querySelector('.el-message-box, .el-dialog')
    if (!b) return null
    return { text: (b.innerText || '').replace(/\s+/g, ' ').slice(0, 300),
      buttons: [...b.querySelectorAll('button')].map((x) => (x.innerText || '').trim()) }
  })
  console.log('box=' + JSON.stringify(box))
  if (!box) return false
  const ok = await page.evaluate(() => {
    const b = document.querySelector('.el-message-box, .el-dialog')
    const btns = [...b.querySelectorAll('button')]
    const hit = btns.find((x) => /确定|确认/.test(x.innerText || ''))
    if (hit) { hit.click(); return (hit.innerText || '').trim() }
    return null
  })
  console.log('confirm=' + ok)
  await page.waitForTimeout(2500)
  return !!ok
}

await page.goto('http://localhost:5173/#/panelx/form/QC_INSP?code=' + INSP, { timeout: 40000 })
await page.waitForTimeout(3500)

// 1) 修改 → 可编辑
await clickToolbar('修改')
await shot('r11-insp-edit.png')

// 2) 审批 → 提交审批
console.log('items=' + JSON.stringify(await openDropdown('审批')))
await clickMenuItem('提交审批')
await confirmBox()
await page.waitForTimeout(2500)

let st = await page.evaluate(() => (document.querySelector('.head .title')?.innerText || '').replace(/\s+/g, ' '))
console.log('statusAfterSubmit=' + st)
await shot('r12-insp-submitted.png')

// 3) 审批 → 审批通过
console.log('items2=' + JSON.stringify(await openDropdown('审批')))
const clickedApprove = await clickMenuItem('审批通过')
if (clickedApprove) {
  await confirmBox()
  await page.waitForTimeout(4000)
}
st = await page.evaluate(() => ({
  status: (document.querySelector('.head .title')?.innerText || '').replace(/\s+/g, ' '),
  body: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 200),
}))
console.log('final=' + JSON.stringify(st))
await shot('r13-insp-final.png')
