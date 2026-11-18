const task = await taskSpace(17)
const page = task.page('p1')
await page.fill('input[type="password"], input[placeholder*="密码"]', '123456')
await page.waitForTimeout(300)
await page.click('button:has-text("切换并重新登录")')
await page.waitForTimeout(8000)
const state = await page.evaluate(() => {
  const txt = (el) => (el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : '')
  return {
    hash: location.hash,
    factory: txt(document.querySelector('.factory-name')),
    body: txt(document.body).slice(0, 260),
  }
})
console.log(JSON.stringify(state, null, 2))
await page.screenshot({ path: 'D:/workspace/yinjia/tools/archive/_mixpick-mixbom-20261118/ego/round-09-switched.png' })
