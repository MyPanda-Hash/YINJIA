// 探针:round-13 的 D 步之后页面变成"正在加载系统",查当前状态 + 单独重做「栏② 模糊查」
const task = await taskSpace('mix-scan-fuzzybar-20261117')
const page = task.page('p1')

const state = await page.evaluate(() => ({
  hash: location.hash,
  hasLogin: !!document.querySelector('.login-wrap, .login-box, form'),
  bodyText: (document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 200),
  token: !!localStorage.getItem('mes_token'),
  factory: localStorage.getItem('mes_factory'),
}))
console.log('当前状态:', JSON.stringify(state, null, 2))

// 重新进页面再做一次栏②
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_MIX_SCAN', { timeout: 60000 })
await page.reload()
await page.waitForTimeout(5000)
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await page.waitForTimeout(600)

const barsNow = await page.evaluate(() => [...document.querySelectorAll('.mm-bar')].map((el, i) => ({
  i,
  prepend: (el.querySelector('.el-input-group__prepend')?.textContent || '').trim(),
  buttons: [...el.querySelectorAll('button')].map((b) => (b.textContent || '').trim()),
  placeholder: el.querySelector('input')?.placeholder || '',
})))
console.log('两栏:', JSON.stringify(barsNow, null, 2))

// 填栏②(索引 1)并点它的「查询」
await page.evaluate(() => {
  const bar = document.querySelectorAll('.mm-bar')[1]
  const inp = bar.querySelector('input')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(inp, '0015')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
})
await page.waitForTimeout(300)
const before = await page.evaluate(() => ({
  inputs: [...document.querySelectorAll('.mm-bar input')].map((i) => i.value),
}))
console.log('填写后:', JSON.stringify(before))

await page.evaluate(() => {
  const bar = document.querySelectorAll('.mm-bar')[1]
  const btn = [...bar.querySelectorAll('button')][0]
  if (btn) btn.click()
})
await page.waitForTimeout(4000)
const out = await page.evaluate(() => ({
  hash: location.hash,
  loading: !!document.querySelector('.el-loading-mask, .app-loading'),
  bodyText: (document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 160),
  alerts: [...document.querySelectorAll('.el-alert__title')].map((e) => (e.textContent || '').trim()),
  candRows: [...document.querySelectorAll('.mm-cand-row')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  barCount: document.querySelectorAll('.mm-bar').length,
}))
console.log('栏② 查询后:', JSON.stringify(out, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-ui-20261119/26-probe-bar2.png' })

await page.cdp('Emulation.clearDeviceMetricsOverride', {})
await task.finish({ keep: 'all' })
