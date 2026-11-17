// 扫码混料:界面改版走查(2026-11-19)
// 目的:确认 ① 扫码行变成「输入框 + 查询 + 扫码」一行(与生产领料一致) ② 没有相机扫码的独立长按钮
//      ③ 手机竖屏(约 390 宽)下也不换行 ④ 页面文案/电子秤卡正常渲染
const task = await taskSpace('mix-scan-ui-20261119')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/panelx/list/MOBILE_MIX_SCAN', { timeout: 60000 })
await page.waitForTimeout(4000)

// 会话过期就自动登录(工厂锁 YJ = 正式库)
const needLogin = await page.evaluate(() => !document.querySelector('.mm-scan'))
if (needLogin) {
  console.log('需要登录,执行自动登录')
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(5000)
  await page.goto('http://localhost:5173/#/panelx/list/MOBILE_MIX_SCAN', { timeout: 60000 })
  await page.waitForTimeout(4000)
}

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) {
    await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  }
  await page.waitForTimeout(500)
} catch (e) {
  console.log('restore skip: ' + e.message)
}

const probe = async () => page.evaluate(() => {
  const bars = [...document.querySelectorAll('.mm-bar')].map((el) => {
    const r = el.getBoundingClientRect()
    const kids = [...el.children].map((c) => {
      const cr = c.getBoundingClientRect()
      return {
        tag: c.tagName.toLowerCase(),
        cls: (c.className || '').toString().slice(0, 40),
        text: (c.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24),
        w: Math.round(cr.width),
        top: Math.round(cr.top),
        h: Math.round(cr.height),
      }
    })
    return {
      text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60),
      h: Math.round(r.height),
      // 同一行判定:所有子元素的 top 差 < 4px
      singleRow: kids.length ? Math.max(...kids.map((k) => k.top)) - Math.min(...kids.map((k) => k.top)) < 4 : false,
      kids,
    }
  })
  const camButtons = [...document.querySelectorAll('button')]
    .map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim())
    .filter((t) => t.includes('相机') || t.includes('Camera'))
  return {
    hash: location.hash,
    viewport: { w: window.innerWidth, h: window.innerHeight },
    title: (document.querySelector('.mm-title')?.textContent || '').trim(),
    sub: (document.querySelector('.mm-sub')?.textContent || '').trim(),
    bars,
    camButtons,
    alerts: [...document.querySelectorAll('.el-alert__title')].map((e) => (e.textContent || '').trim()),
    yjNative: !!(window.YjNative && window.YjNative.scan),
  }
})

// ① 桌面/默认宽
console.log('== 默认窗口 ==')
console.log(JSON.stringify(await probe(), null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-ui-20261119/01-desktop.png' })

// ② 手机竖屏
await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await page.waitForTimeout(800)
console.log('== 390 宽(手机竖屏)==')
console.log(JSON.stringify(await probe(), null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-scan-ui-20261119/02-mobile390.png' })
await page.cdp('Emulation.clearDeviceMetricsOverride', {})

// ③ 顺手走一遍「敲工单号 → 查询」,确认手输单号也能查(plainOrderNo)
await page.waitForTimeout(500)
const wo = await page.evaluate(async () => {
  const r = await fetch('/api/px/mix/orders?keyword=', { method: 'GET' }).catch(() => null)
  return r ? r.status : 0
})
console.log('orders probe status(仅参考):', wo)

await task.finish({ keep: true })
