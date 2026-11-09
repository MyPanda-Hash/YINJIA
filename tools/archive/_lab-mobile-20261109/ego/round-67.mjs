const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')

// ① 确保测试库会话(整段流程放在同一次执行里,避免中途重新加载把会话踢回正式库)
async function toTestFactory() {
  const f = await page.evaluate(() => JSON.parse(localStorage.getItem('mes_factory') || 'null'))
  if (f && f.code === 'YJ_TEST') return 'already'
  await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
  await page.goto('http://localhost:5173/#/login', { timeout: 30000 })
  await page.reload({ timeout: 40000 })
  await page.waitForTimeout(4000)
  await page.click('css:.el-select >> nth=1')
  await page.waitForTimeout(900)
  const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown')]
    .filter((d) => d.offsetParent !== null)
    .map((d) => [...d.querySelectorAll('li')].map((li) => (li.textContent || '').trim())))
  const idx = (opts[0] || []).findIndex((t) => t.includes('测试库')) + 1
  if (idx > 0) { await page.click(`css:.el-select-dropdown li:nth-child(${idx})`); await page.waitForTimeout(600) }
  await page.fill('css:input[placeholder="请输入登录账号"]', 'admin')
  await page.fill('css:input[placeholder="请输入登录密码"]', '123456')
  await page.click('loc=role:button[name="进入系统"]')
  await page.waitForTimeout(7000)
  return 'switched'
}
console.log('factory=' + (await toTestFactory()))

// ② 打开既有单 EU-2026-11-0003 → 加一行 → 填两格 → 最后一行拍照 → 保存
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_LAB_EQUIP_USE', { timeout: 30000 })
await page.waitForTimeout(6000)
const list = await page.evaluate(() => [...document.querySelectorAll('.labm-line')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()))
console.log('list=' + JSON.stringify(list))
if (!list.length) { console.log('NO-LIST'); }
await page.click('.labm-line >> nth=0')
await page.waitForTimeout(3000)
await page.click('loc=role:button[name="加一行"]')
await page.waitForTimeout(600)
await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.labm-drow')]
  const row = rows[rows.length - 1]
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  for (const f of row.querySelectorAll('.labm-field')) {
    const label = f.querySelector('label')?.textContent?.trim() || ''
    const input = f.querySelector('input')
    if (!input) continue
    if (label.includes('测试项目')) setVal(input, '复现500-追加行')
    if (label.includes('使用人')) setVal(input, '王五')
  }
})
const btns = await page.evaluate(() => document.querySelectorAll('.labm-rowphoto .el-button').length)
await page.click(`css:.labm-rowphoto .el-button >> nth=${Math.max(0, btns - 1)}`)
await page.waitForTimeout(500)
await page.setInputFiles('css:input[type=file]', 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/test-photo.png')
await page.waitForTimeout(1500)
await page.click('loc=role:button[name="保存草稿"]')
await page.waitForTimeout(14000)
const st = await page.evaluate(() => ({
  doc: document.querySelector('.labm-doc')?.textContent?.trim() || '',
  err: document.querySelector('.labm-err')?.textContent?.trim() || '',
  rows: document.querySelectorAll('.labm-drow').length,
  perRow: [...document.querySelectorAll('.labm-rowphoto')].map((e) => ({ imgs: e.querySelectorAll('.labm-photo img').length, pending: e.querySelectorAll('.labm-photo.is-pending').length })),
  toast: [...document.querySelectorAll('.el-message')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
}))
console.log(JSON.stringify(st, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-67-repro.png' })
