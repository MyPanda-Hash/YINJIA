// round-03 — 回归:登录失败时那条错误横幅还正常(图标能解析、位置在「服务器地址」行下面)
// 做法:CDP 屏蔽 /api/auth/login,再点「进入系统」⇒ 前端 catch 到网络错误,banner 出现。
// 同时收集 console 里的 Vue 警告(若有 "Failed to resolve component" 就是回退)。
const OUT = 'C:/Users/Lenovo/ego/mobile-login-default-20261117'
const task = await taskSpace('mobile login default server r3')
const fs = await import('node:fs/promises')
await fs.mkdir(OUT, { recursive: true })

const STUB = `
window.YjNative = {
  getBaseUrl: function () { return 'http://36.140.66.163:8090' },
  setBaseUrl: function (v) {}, scan: function () {}, toast: function () {},
  appVersion: function () { return '1.0.14'; }
};
`

const page = task.page('p1')
await page.goto('about:blank')
await page.cdp('Page.addScriptToEvaluateOnNewDocument', { source: STUB })
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await page.goto('http://localhost:5173/#/login', { timeout: 60000 })
await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear() } catch (e) {} })
await page.reload({ timeout: 60000 })
await page.waitForTimeout(2000)

await page.cdp('Network.enable', {})
await page.cdp('Network.setBlockedURLs', { urls: ['*auth/login*'] })

await page.fill('.login-form input[autocomplete="username"]', 'e2e_probe')
await page.fill('.login-form input[type="password"]', 'e2e_probe')
const sel = await page.evaluate(() => {
  const el = document.querySelector('.login-form .el-select')
  return el ? el.innerText.replace(/\s+/g, ' ').trim() : ''
})
console.log('factory select: ' + sel)
if (!sel || sel.includes('请选择')) {
  await page.click('.login-form .el-select')
  await page.waitForTimeout(400)
  await page.click('.el-select-dropdown__item')
  await page.waitForTimeout(300)
}
await page.click('.login-submit')
await page.waitForTimeout(2500)

const r = await page.evaluate(() => {
  const err = document.querySelector('.login-error')
  const row = document.querySelector('.origin-info')
  return {
    hasErrorBanner: !!err,
    errorText: err ? err.innerText.replace(/\s+/g, ' ').trim() : '',
    errorIcon: err ? !!err.querySelector('svg, .el-icon') : false,
    originRow: row ? row.innerText.replace(/\s+/g, ' ').trim().slice(0, 60) : '',
    order: (() => {
      if (!err || !row) return 'n/a'
      return (row.compareDocumentPosition(err) & Node.DOCUMENT_POSITION_FOLLOWING) ? '地址行在错误横幅之前' : '顺序异常'
    })(),
  }
})
console.log('ERROR-STATE ' + JSON.stringify(r, null, 2))
await page.screenshot({ path: OUT + '/round-03-login-error.png' })
await task.finish({ keep: 'all' })
