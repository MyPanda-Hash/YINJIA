const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
// ① 先把会话还回正式库(YJ):清会话 → 登录页 → 工厂选 YINJIA-MES → admin/123456
await page.evaluate(() => { try { localStorage.clear() } catch (e) {} })
await page.goto('http://localhost:5173/#/login', { timeout: 30000 })
await page.reload({ timeout: 40000 })
await page.waitForTimeout(4000)
await page.click('css:.el-select >> nth=1')
await page.waitForTimeout(900)
const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown')]
  .filter((d) => d.offsetParent !== null)
  .map((d) => [...d.querySelectorAll('li')].map((li) => (li.textContent || '').trim())))
const list = opts[0] || []
const idx = list.findIndex((t) => !t.includes('测试库')) + 1
console.log('factories=' + JSON.stringify(list) + ' pick=' + idx)
if (idx > 0) {
  await page.click(`css:.el-select-dropdown li:nth-child(${idx})`)
  await page.waitForTimeout(600)
}
await page.fill('css:input[placeholder="请输入登录账号"]', 'admin')
await page.fill('css:input[placeholder="请输入登录密码"]', '123456')
await page.waitForTimeout(300)
await page.click('loc=role:button[name="进入系统"]')
await page.waitForTimeout(7000)
const st = await page.evaluate(() => ({
  hash: location.hash,
  factory: JSON.parse(localStorage.getItem('mes_factory') || 'null'),
}))
console.log('restored=' + JSON.stringify(st))

// ② 顺带看第三张面板(加标水,21 个明细字段)手机页是否正常渲染
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_LAB_SPIKE_WATER', { timeout: 30000 })
await page.waitForTimeout(5000)
const sw = await page.evaluate(() => ({
  title: document.querySelector('.labm-title')?.textContent?.trim(),
  err: document.querySelector('.labm-err')?.textContent?.trim() || '',
  headerFields: [...document.querySelectorAll('.labm-card:nth-of-type(2) .labm-field > label')].length,
  secs: [...document.querySelectorAll('.labm-sec')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  lines: [...document.querySelectorAll('.labm-line')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  firstDetailLabels: [...document.querySelectorAll('.labm-drow .labm-field > label')].slice(0, 6).map((e) => e.textContent.trim()),
}))
console.log('spike=' + JSON.stringify(sw, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-51-spikewater.png' })
