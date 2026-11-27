const task = await taskSpace('qc-ngflow-20261128')
const page = task.page('p1')
// 填测试账套密码并确认切换
await page.fill('.el-dialog input[type="password"]', '123456')
await page.waitForTimeout(400)
const clicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll('.el-dialog button')]
    .find((x) => (x.textContent || '').includes('切换并重新登录'))
  if (b) { b.click(); return true }
  return false
})
console.log('CLICK-SWITCH', clicked)
await page.waitForTimeout(6000)
const st = await page.evaluate(() => ({
  hash: location.hash,
  factory: (document.querySelector('span[aria-label*="YINJIA"]') || {}).textContent || '',
  hasLoginForm: !!document.querySelector('input[placeholder*="账号"]'),
  body: document.body.innerText.slice(0, 160),
}))
console.log('AFTER-SWITCH', JSON.stringify(st, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/qc-ngflow-20261128/round-08-switched.png' })
