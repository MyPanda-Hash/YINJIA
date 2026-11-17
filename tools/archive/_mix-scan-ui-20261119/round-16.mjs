// 两栏版面在 英/日 下的宽度检查(390 宽):前缀「Fuzzy search」「あいまい検索」会不会把输入框挤没,
// 以及是否横向溢出
const task = await taskSpace('mix-scan-fuzzybar-i18n-20261117')
const page = task.page('p1')

const STUB = `
  window.YjNative = { scan: function () {}, getBaseUrl: function () { return 'http://localhost:5173' } }
`
await page.cdp('Page.addScriptToEvaluateOnNewDocument', { source: STUB })

async function check(locale, shot) {
  await page.goto('http://localhost:5173/#/panelx/list/MOBILE_MIX_SCAN', { timeout: 60000 })
  await page.evaluate((l) => localStorage.setItem('mes_locale', l), locale)
  await page.reload()
  await page.waitForTimeout(5500)
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  } catch (e) { console.log('restore skip: ' + e.message) }
  await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
  await page.waitForTimeout(600)
  const info = await page.evaluate(() => {
    const bars = [...document.querySelectorAll('.mm-bar')].map((el) => {
      const kids = [...el.children].map((c) => {
        const r = c.getBoundingClientRect()
        return { text: (c.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24) || 'input', w: Math.round(r.width), right: Math.round(r.right) }
      })
      return {
        prepend: (el.querySelector('.el-input-group__prepend')?.textContent || '').trim(),
        inputW: Math.round(el.querySelector('input')?.getBoundingClientRect().width || 0),
        kids,
        rightOverflow: kids.some((k) => k.right > window.innerWidth - 2),
        singleRow: kids.length > 1 ? new Set(kids.map((k) => Math.round(k.right))).size > 0 : true,
      }
    })
    return { locale: localStorage.getItem('mes_locale'), viewportW: window.innerWidth, bars, docOverflowX: document.documentElement.scrollWidth > window.innerWidth }
  })
  await page.screenshot({ path: shot })
  return info
}

const en = await check('en', 'C:/Users/Lenovo/ego/mix-scan-ui-20261119/30-two-bars-en.png')
console.log('EN:', JSON.stringify(en, null, 2))
const ja = await check('ja', 'C:/Users/Lenovo/ego/mix-scan-ui-20261119/31-two-bars-ja.png')
console.log('JA:', JSON.stringify(ja, null, 2))

await page.evaluate(() => localStorage.setItem('mes_locale', 'zh-CN'))
await page.cdp('Emulation.clearDeviceMetricsOverride', {})
await task.finish({ keep: 'all' })
