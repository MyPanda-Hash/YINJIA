// round-01 — 手机端(壳内)登录页:服务器地址默认 = 服务器 IP:端口
// 做法:用 CDP addScriptToEvaluateOnNewDocument 在页面脚本之前注入 window.YjNative 桩,
// 模拟 APK 壳内(MainActivity.getBase() 现在默认返回 http://36.140.66.163:8090)。
// 视口按手机设(390x844),截图取证。
const OUT = 'C:/Users/Lenovo/ego/mobile-login-default-20261117'
const fs = await import('node:fs/promises')
await fs.mkdir(OUT, { recursive: true })

const task = await taskSpace('mobile login default server')
const page = task.page('p1')
await page.goto('about:blank')

// 模拟手搓壳:桥在,且 getBaseUrl() 返回默认服务器地址(2026-11-17 后的行为)
const STUB = `
window.YjNative = {
  getBaseUrl: function () { return 'http://36.140.66.163:8090' },
  setBaseUrl: function (v) { window.__yjSet = v },
  scan: function () { window.__yjScan = 1 },
  toast: function () {},
  appVersion: function () { return '1.0.14'; }
};
`
await page.cdp('Page.addScriptToEvaluateOnNewDocument', { source: STUB })
await page.cdp('Emulation.setDeviceMetricsOverride', {
  width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
})

await page.goto('http://localhost:5173/#/login', { timeout: 60000 })
await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear() } catch (e) {} })
await page.reload({ timeout: 60000 })
await page.waitForTimeout(2500)

const info = await page.evaluate(() => {
  const row = document.querySelector('.origin-info')
  const txt = row ? row.innerText.replace(/\s+/g, ' ').trim() : '(无 .origin-info 行)'
  return {
    url: location.href,
    hasYjNative: !!window.YjNative,
    originRow: txt,
    oldHintGone: !document.querySelector('.origin-hint'),
    status: (document.querySelector('.footer-status') || {}).innerText || '',
    factories: [...document.querySelectorAll('.el-select__selected-item, .el-select__placeholder')]
      .map((e) => (e.innerText || '').trim()).filter(Boolean).slice(0, 3),
  }
})
console.log(JSON.stringify(info, null, 2))

await page.screenshot({ path: OUT + '/round-01-shell-login-390x844.png' })
console.log('shot: ' + OUT + '/round-01-shell-login-390x844.png')

await task.finish({ keep: true })
