// round-14.mjs — 手机竖屏复检(修完「台车电子秤」换行 + 扫码框被按钮挤窄):扫工单 → 看版面
const task = await taskSpace('mix-scan-20261118')
const page = task.page('p1')
await page.cdp('Emulation.setDeviceMetricsOverride', {
  width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
})
await page.goto('http://127.0.0.1:8090/?v=' + Date.now() + '#/panelx/list/MOBILE_MIX_SCAN', { timeout: 40000 })
await page.waitForTimeout(2500)
await page.fill('.mm-scanbar input[placeholder="扫描或输入工单二维码"]', '0@GD-2026-11-0015@1001')
await page.press('.mm-scanbar input[placeholder="扫描或输入工单二维码"]', 'Enter')
await page.waitForTimeout(2500)
const state = await page.evaluate(() => {
  const scan = document.querySelector('.mm-scanbar input[placeholder^="扫描或输入物料码"]')
  return {
    width: window.innerWidth,
    rows: document.querySelectorAll('.mm-row').length,
    scaleLabel: document.querySelector('.mm-scale-label')?.textContent?.trim(),
    scaleLabelLines: document.querySelector('.mm-scale-label')?.getBoundingClientRect().height,
    materialInputWidth: scan ? Math.round(scan.getBoundingClientRect().width) : 0,
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
  }
})
console.log(JSON.stringify(state, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-20261118/r14-mobile-fixed.png' })
await page.cdp('Emulation.clearDeviceMetricsOverride', {})
