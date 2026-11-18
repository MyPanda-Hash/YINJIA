/**
 * round-01:同时核 8090(打包版)与 5173(源码版)上的**退料明细页能不能扫码**。
 * 只读:只做"扫物料码解锁",不提交(不产生退料单)。
 */
const results = []

for (const base of ['http://127.0.0.1:8090', 'http://localhost:5173']) {
  const spaceName = base.includes('8090') ? 'return-scan-8090-20261118' : 'return-scan-5173-20261118'
  const task = await taskSpace(spaceName)
  const page = task.page('p1')
  await page.goto(base + '/#/panelx/list/MOBILE_RETURN/doc?id=823', { timeout: 30000 })
  await page.waitForTimeout(4000)
  await page.evaluate(() => { document.querySelectorAll('vite-error-overlay').forEach((el) => el.remove()) })

  const before = await page.evaluate(() => ({
    hash: location.hash,
    chunk: [...document.querySelectorAll('script[src]')].map((s) => s.src).filter((s) => /index-/.test(s)).slice(-1)[0] || '',
    title: (document.querySelector('.mp-title') || {}).innerText || '',
    state: (document.querySelector('.mp-state') || {}).innerText || '',
    scanInput: !!document.querySelector('input[placeholder*="扫物料码"]'),
    scanPlaceholder: (document.querySelector('input[placeholder*="扫物料码"]') || {}).placeholder || '',
    overlay: !!document.querySelector('vite-error-overlay'),
    hasLogin: !!document.querySelector('input[placeholder*="账号"]'),
  }))

  // 真扫一次:输入本单物料码 + 回车
  let scanned = null
  if (before.scanInput) {
    await page.fill('input[placeholder*="扫物料码"]', 'YJ-XWR-016|20261118003')
    await page.keyboard.press('Enter')
    await page.waitForTimeout(2200)
    scanned = await page.evaluate(() => ({
      err: (document.querySelector('.mp-err') || {}).innerText || '',
      unlocked: (document.querySelector('.mp-mat') || {}).innerText || '',
      qty: (document.querySelector('.mp-qty input') || {}).value || '',
      confirmDisabled: (() => {
        const b = [...document.querySelectorAll('.mp-qty button')].find((x) => (x.textContent || '').includes('确认'))
        return b ? !!b.disabled : null
      })(),
    }))
    // 收掉解锁态,不留临时状态
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('.mp-qty button')].find((x) => (x.textContent || '').includes('取消'))
      if (b) b.click()
    })
    await page.waitForTimeout(400)
  }

  const shot = 'C:/Users/Lenovo/ego/return-scan-check-20261118/' + (base.includes('8090') ? 'scan-8090.png' : 'scan-5173.png')
  await page.screenshot({ path: shot })
  results.push({ base, before, scanned, shot })
}

console.log(JSON.stringify(results, null, 2))
