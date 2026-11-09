// 状态闸门验证:
//  ① 保存草稿后的单 → 设备名称只读(其它字段仍可改)
//  ② 审批通过(已审核)的单 → 整张只读(加一行/保存/拍照/附件删除全关)
const task = await taskSpace('lab-mobile-lock-20261109')
const page = task.page('p1')
const OUT = 'C:/Users/Lenovo/ego/lab-mobile-lock-20261109'
const base = 'http://localhost:5173'

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  } catch (e) { /* ignore */ }
}

await restoreWindow()
await page.goto(base + '/#/login', { timeout: 40000 })
await page.waitForTimeout(1200)
await page.evaluate(async () => {
  const r = await fetch('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  })
  const j = await r.json()
  localStorage.setItem('mes_token', j.data.token)
  localStorage.setItem('mes_user', JSON.stringify(j.data.user || {}))
  localStorage.setItem('mes_factory', JSON.stringify({ code: 'YJ', name: 'YINJIA-MES' }))
})

const status = async () => page.evaluate(() => ({
  docNo: (document.querySelector('.labm-doc')?.textContent || '').trim(),
  lock: (document.querySelector('.labm-lock')?.textContent || '').trim(),
  dis: [...document.querySelectorAll('.labm-field')].map((el) => ({
    label: (el.querySelector('label')?.textContent || '').replace(/\s+/g, ' ').trim(),
    disabled: !!el.querySelector('.is-disabled'),
  })).slice(0, 5),
  addBtnDisabled: !!document.querySelector('.labm-sec2 .el-button.is-disabled'),
  saveDisabled: !!document.querySelector('.labm-actions .el-button.is-disabled'),
  delRowDisabled: [...document.querySelectorAll('.labm-drow-head .el-button')].map((b) => b.classList.contains('is-disabled')),
  photoBtnDisabled: [...document.querySelectorAll('.labm-rowphoto .el-button')].map((b) => b.classList.contains('is-disabled')),
}))

// ① 打开「已审核」的单(EU-2026-11-0001 状态=审批中/已审核,先看列表里第一张非草稿)
await page.goto(base + '/#/panelx/list/MOBILE_LAB_EQUIP_USE', { timeout: 40000 })
await page.waitForTimeout(7000)
const lines = await page.evaluate(() => [...document.querySelectorAll('.labm-line')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()))
console.log('列表=' + JSON.stringify(lines))
const idx = lines.findIndex((t) => t.includes('已审核') || t.includes('审批中'))
if (idx >= 0) {
  await page.click(`css:.labm-line >> nth=${idx}`)
  await page.waitForTimeout(3000)
  console.log('非草稿单=' + JSON.stringify(await status(), null, 1))
  await restoreWindow()
  await page.screenshot({ path: `${OUT}/01-非草稿只读.png` })
}

// ② 新单:设备名称可编辑;保存草稿后设备名称变只读
await page.click('css:.labm-sec .el-button >> nth=0')   // 新增记录
await page.waitForTimeout(2000)
console.log('新单=' + JSON.stringify(await status(), null, 1))
await page.screenshot({ path: `${OUT}/02-新单可编辑.png` })
