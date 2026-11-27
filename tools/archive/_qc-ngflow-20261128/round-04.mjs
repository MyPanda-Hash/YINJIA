const task = await taskSpace('qc-ngflow-20261128')
const page = task.page('p1')

async function ensureMenuOpen() {
  const opened = await page.evaluate(() => !!document.querySelector('.el-dropdown-menu__item'))
  if (!opened) {
    await page.click('span[aria-label="YINJIA-MES"]', { label: '打开工厂切换' })
    await page.waitForTimeout(1500)
  }
}

await page.goto('http://127.0.0.1:8090/#/dashboard', { timeout: 60000 })
await page.waitForTimeout(2500)
await ensureMenuOpen()
// 切到测试库
const clicked = await page.evaluate(() => {
  const it = [...document.querySelectorAll('.el-dropdown-menu__item')]
    .find((el) => (el.textContent || '').includes('测试库'))
  if (it) { it.click(); return true }
  return false
})
console.log('CLICK-TEST-LEDGER', clicked)
await page.waitForTimeout(4000)
const state = await page.evaluate(() => ({
  hash: location.hash,
  hasLoginForm: !!document.querySelector('input[placeholder*="账号"]'),
  factory: (document.querySelector('span[aria-label*="YINJIA"]') || {}).textContent || '',
  body: document.body.innerText.slice(0, 200),
}))
console.log('STATE', JSON.stringify(state, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-ngflow-20261128/round-04-testledger.png' })
