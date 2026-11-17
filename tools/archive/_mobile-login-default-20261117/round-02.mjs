// round-02 — 英语下这一行是否也翻译;以及**网页版**(非壳内)不该出现这一行(回归)
const OUT = 'C:/Users/Lenovo/ego/mobile-login-default-20261117'
const task = await taskSpace('mobile login default server round 2')
const fs = await import('node:fs/promises')
await fs.mkdir(OUT, { recursive: true })

const STUB = `
window.YjNative = {
  getBaseUrl: function () { return 'http://36.140.66.163:8090' },
  setBaseUrl: function (v) { window.__yjSet = v },
  scan: function () {}, toast: function () {}, appVersion: function () { return '1.0.14'; }
};
`

// A. 壳内 + 英语
const p1 = task.page('p1')
await p1.goto('about:blank')
await p1.cdp('Page.addScriptToEvaluateOnNewDocument', { source: STUB })
await p1.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await p1.goto('http://localhost:5173/#/login', { timeout: 60000 })
await p1.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('mes_locale', 'en') } catch (e) {} })
await p1.reload({ timeout: 60000 })
await p1.waitForTimeout(2500)
const en = await p1.evaluate(() => {
  const row = document.querySelector('.origin-info')
  return {
    originRow: row ? row.innerText.replace(/\s+/g, ' ').trim() : '(无)',
    cjkLeft: row ? /[\u4e00-\u9fa5]/.test(row.innerText) : null,
    submit: (document.querySelector('.login-submit') || {}).innerText || '',
  }
})
console.log('EN-SHELL ' + JSON.stringify(en))
await p1.screenshot({ path: OUT + '/round-02-shell-login-en.png' })

// B. 网页版(没有 YjNative / 不是 file://)⇒ 不该出现「服务器地址」行
const p2 = await task.newPage()
await p2.goto('http://localhost:5173/#/login', { timeout: 60000 })
await p2.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('mes_locale', 'zh-CN') } catch (e) {} })
await p2.reload({ timeout: 60000 })
await p2.waitForTimeout(2000)
const web = await p2.evaluate(() => ({
  hasYjNative: !!window.YjNative,
  originRow: !!document.querySelector('.origin-info'),
  status: (document.querySelector('.footer-status') || {}).innerText || '',
}))
console.log('WEB ' + JSON.stringify(web))
await p2.screenshot({ path: OUT + '/round-02-web-login-1280.png' })

await task.finish({ keep: 'all' })
