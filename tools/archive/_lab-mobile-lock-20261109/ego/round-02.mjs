// 审批通过后的单 → 整张只读(在**测试库**做:先把 EU-2026-11-0001 审批通过,再点开看)
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

await page.goto(base + '/#/login', { timeout: 40000 })
await page.waitForTimeout(1200)
// 登测试库
const login = await page.evaluate(async () => {
  const r = await fetch('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
  })
  const j = await r.json()
  if (!j?.data?.token) return { err: j }
  localStorage.setItem('mes_token', j.data.token)
  localStorage.setItem('mes_user', JSON.stringify(j.data.user || {}))
  localStorage.setItem('mes_factory', JSON.stringify({ code: 'YJ_TEST', name: 'YINJIA-MES·测试库' }))
  return { ok: true }
})
console.log('login=' + JSON.stringify(login))

await page.goto(base + '/#/panelx/list/MOBILE_LAB_EQUIP_USE', { timeout: 40000 })
await page.reload({ timeout: 60000 })
await page.waitForTimeout(8000)
const lines = await page.evaluate(() => [...document.querySelectorAll('.labm-line')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()))
console.log('列表=' + JSON.stringify(lines))
const target = lines.find((t) => t.includes('审批中')) || lines[0]
const no = (target || '').match(/EU-\d{4}-\d{2}-\d{4}/)?.[0] || ''
console.log('目标单=' + no)

// 审批通过(测试库;两级审批:先「审批通过」)
const appr = await page.evaluate(async (docNo) => {
  const token = localStorage.getItem('mes_token')
  const res = await fetch('/api/px/callButton', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ panelCode: 'RD_EQUIP_USE', buttonName: '审批通过', formData: { 编号: docNo, 审批意见: '锁定验证' } }),
  })
  const j = await res.json()
  return { code: j?.code, message: j?.message, data: j?.data }
}, no)
console.log('审批通过=' + JSON.stringify(appr))

// 重新打开列表 + 点开这张单
await page.reload({ timeout: 60000 })
await page.waitForTimeout(7000)
const lines2 = await page.evaluate(() => [...document.querySelectorAll('.labm-line')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()))
console.log('审批后列表=' + JSON.stringify(lines2))
const idx = lines2.findIndex((t) => t.includes(no))
await page.click(`css:.labm-line >> nth=${idx}`)
await page.waitForTimeout(3000)
const st = await page.evaluate(() => ({
  docNo: (document.querySelector('.labm-doc')?.textContent || '').trim(),
  lock: (document.querySelector('.labm-lock')?.textContent || '').replace(/\s+/g, ' ').trim(),
  fields: [...document.querySelectorAll('.labm-field')].map((el) => ({
    label: (el.querySelector('label')?.textContent || '').replace(/\s+/g, ' ').trim(),
    disabled: !!el.querySelector('.is-disabled'),
  })).slice(0, 6),
  addDisabled: !!document.querySelector('.labm-sec2 .el-button.is-disabled'),
  saveDisabled: !!document.querySelector('.labm-actions .el-button--primary.is-disabled'),
  photoDisabled: [...document.querySelectorAll('.labm-rowphoto .el-button')].map((b) => b.classList.contains('is-disabled')),
}))
console.log('只读态=' + JSON.stringify(st, null, 1))
await restoreWindow()
await page.screenshot({ path: `${OUT}/03-审批通过只读.png` })
