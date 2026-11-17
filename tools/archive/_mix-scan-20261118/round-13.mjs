// round-13.mjs — 手机竖屏(390×844)看版面是否符合手机扫码规范
const task = await taskSpace('mix-scan-20261118')
const page = task.page('p1')
await page.cdp('Emulation.setDeviceMetricsOverride', {
  width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
})
await page.goto('http://127.0.0.1:8090/#/panelx/list/MOBILE_MIX_SCAN', { timeout: 40000 })
await page.waitForTimeout(1500)
await page.fill('.mm-scanbar input', '0@GD-2026-11-0015@1001')
await page.press('.mm-scanbar input', 'Enter')
await page.waitForTimeout(2500)
const state = await page.evaluate(() => ({
  width: window.innerWidth,
  title: document.querySelector('.mm-title')?.textContent?.trim(),
  rows: document.querySelectorAll('.mm-row').length,
  footBtnWidth: document.querySelector('.mm-foot-btn')?.getBoundingClientRect().width,
  overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
}))
console.log(JSON.stringify(state, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-20261118/r13-mobile.png' })
await page.cdp('Emulation.clearDeviceMetricsOverride', {})
