// round-02:①5173(源码版)刷新后看「打印缓存」里失败单是否显示失败原因
//          ②8090(打包版 = 重建后的 jar static)登录 YJ_TEST 后同样看一遍,确认换包生效
const task = await taskSpace('other-pick-print-20261118')
const page = task.page('p1')

async function restoreWindow(p) {
  try {
    const w = await p.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) {
      await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    }
    await p.waitForTimeout(400)
  } catch (e) {
    console.log('restore skip: ' + e.message)
  }
}

const readState = () => {
  const txt = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    hash: location.hash,
    recent: [...document.querySelectorAll('.ps-recent')].map(txt),
    cache: [...document.querySelectorAll('.ps-cache')].map(txt),
    why: [...document.querySelectorAll('.ps-line-why')].map(txt),
    cacheWhy: [...document.querySelectorAll('.ps-meta-warn')].map(txt),
  }
}

// ① 5173
await page.goto('http://localhost:5173/#/sys/printStation', { timeout: 60000 })
await page.waitForTimeout(4500)
await restoreWindow(page)
console.log('--- 5173')
console.log(JSON.stringify(await page.evaluate(readState), null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/other-pick-print-20261118/print-station-5173.png', fullPage: true })

// ② 8090(新 jar 里的前端)
const page2 = await task.newPage()
await page2.goto('http://127.0.0.1:8090/#/login', { timeout: 60000 })
await page2.waitForTimeout(2500)
await page2.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const ins = [...document.querySelectorAll('input')]
  const acc = ins.find((i) => (i.placeholder || '').includes('账号'))
  const pwd = ins.find((i) => (i.placeholder || '').includes('密码'))
  if (acc) setVal(acc, 'admin')
  if (pwd) setVal(pwd, '123456')
  const sel = document.querySelector('.el-select')
  if (sel) sel.click()
})
await page2.waitForTimeout(900)
console.log('8090 factory option: ' + (await page2.evaluate(() => {
  const items = [...document.querySelectorAll('.el-select-dropdown__item')]
  const target = items.find((i) => (i.textContent || '').includes('测试'))
  if (target) { target.click(); return (target.textContent || '').trim() }
  return 'options=' + items.map((i) => (i.textContent || '').trim()).join('/')
})))
await page2.waitForTimeout(500)
await page2.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => /进入系统|登录/.test(b.textContent || ''))
  if (btn) btn.click()
})
await page2.waitForTimeout(4500)
await page2.goto('http://127.0.0.1:8090/#/sys/printStation', { timeout: 60000 })
await page2.waitForTimeout(5000)
await restoreWindow(page2)
console.log('--- 8090')
console.log(JSON.stringify(await page2.evaluate(readState), null, 2))
await page2.screenshot({ path: 'C:/Users/Lenovo/ego/other-pick-print-20261118/print-station-8090.png', fullPage: true })
console.log('done')
