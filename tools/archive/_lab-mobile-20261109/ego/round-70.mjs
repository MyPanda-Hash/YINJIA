const task = await taskSpace('lab-mobile-record-20261109')
const page = task.page('p1')
// 8090(jar 内 static)也验一遍:纸面「手机照片」列 + 标题右下角单号
await page.goto('http://127.0.0.1:8090/#/login', { timeout: 30000 })
await page.waitForTimeout(1500)
const hasLogin = await page.evaluate(() => !!document.querySelector('input[placeholder="请输入登录账号"]'))
if (hasLogin) {
  await page.click('css:.el-select >> nth=1')
  await page.waitForTimeout(900)
  const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown')]
    .filter((d) => d.offsetParent !== null).map((d) => [...d.querySelectorAll('li')].map((li) => (li.textContent || '').trim())))
  const idx = (opts[0] || []).findIndex((t) => t.includes('测试库')) + 1
  if (idx > 0) { await page.click(`css:.el-select-dropdown li:nth-child(${idx})`); await page.waitForTimeout(600) }
  await page.fill('css:input[placeholder="请输入登录账号"]', 'admin')
  await page.fill('css:input[placeholder="请输入登录密码"]', '123456')
  await page.click('loc=role:button[name="进入系统"]')
  await page.waitForTimeout(8000)
}
await page.goto('http://127.0.0.1:8090/#/panelx/list/RD_EQUIP_USE', { timeout: 30000 })
await page.waitForTimeout(10000)
const st = await page.evaluate(() => ({
  hash: location.hash,
  factory: JSON.parse(localStorage.getItem('mes_factory') || 'null'),
  pager: document.querySelector('.as-side-pager .page-no')?.textContent?.trim(),
  titleDocNo: document.querySelector('.rsp-title-docno')?.textContent?.trim() || '',
  hasPhoneCol: [...document.querySelectorAll('.rs-th')].some((e) => (e.textContent || '').trim() === '手机照片'),
  fileCells: document.querySelectorAll('.rs-file-cell').length,
  chips: [...document.querySelectorAll('.rs-file-cell .fac-chip')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
}))
console.log(JSON.stringify(st, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/lab-mobile-record-20261109/round-70-8090.png' })
