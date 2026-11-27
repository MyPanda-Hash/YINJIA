const task = await taskSpace('qc-ngflow-20261128')
const page = task.page('p1')
await page.goto('http://127.0.0.1:8090/#/dashboard', { timeout: 60000 })
await page.waitForTimeout(2000)
await page.click('span[aria-label="YINJIA-MES"]', { label: '打开工厂切换' })
await page.waitForTimeout(1200)

const box = await page.evaluate(() => {
  const it = [...document.querySelectorAll('.el-dropdown-menu__item')]
    .find((el) => (el.textContent || '').includes('测试库'))
  if (!it) return null
  it.scrollIntoView({ block: 'center' })
  const r = it.getBoundingClientRect()
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, text: (it.textContent || '').trim() }
})
console.log('ITEM-BOX', JSON.stringify(box))
if (box) {
  await page.mouse.click(box.x, box.y, { label: '选测试库' })
  await page.waitForTimeout(5000)
}
const state = await page.evaluate(() => ({
  hash: location.hash,
  factory: (document.querySelector('span[aria-label*="YINJIA"]') || {}).textContent || '',
  hasLoginForm: !!document.querySelector('input[placeholder*="账号"]'),
}))
console.log('STATE2', JSON.stringify(state))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-ngflow-20261128/round-05-testledger.png' })
