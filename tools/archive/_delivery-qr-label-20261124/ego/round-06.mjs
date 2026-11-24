/**
 * round-06 — 收尾(重试):作废测试库那张验证用打印记录 + 会话登回正式库 YJ
 *   round-05 在 `task.finish({keep:[]})` 之后的新标签页上跑,页面还在 about:blank ⇒ fetch/goto 全部落空。
 *   这一轮先 goto 到应用、把状态打出来,再按状态决定"先登录还是直接作废"。
 */
const OUT = 'D:/YINJIA-main/_scratch/ego-delivery-qr-20261124'
const task = await taskSpace('delivery-qr-20261124')
const page = task.page('p1')
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip: ' + e.message) }

await page.goto('http://localhost:5173/', { timeout: 60000 })
await page.waitForTimeout(5000)
const s0 = await page.evaluate(() => ({
  hash: location.hash,
  token: !!localStorage.getItem('mes_token'),
  factory: localStorage.getItem('mes_factory'),
  hasAccountInput: [...document.querySelectorAll('input')].some((i) => (i.placeholder || '').includes('账号')),
}))
console.log('起始状态 = ' + JSON.stringify(s0))

if (s0.token) {
  // 已登录(可能是测试库 YJ_TEST)⇒ 先作废验证记录,再决定是否切回正式库
  const rr = await page.evaluate(async () => {
    const tok = localStorage.getItem('mes_token')
    const r = await fetch('/api/px/puPrint/void', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
      body: JSON.stringify({ docNo: 'MP-2026-11-0004' }),
    })
    return { status: r.status, body: (await r.text()).slice(0, 200) }
  })
  console.log('① 作废 MP-2026-11-0004 = ' + JSON.stringify(rr))
}

// ② 切回正式库 YJ(只有在不是 YJ 时才做)
const needRelogin = !s0.token || !String(s0.factory || '').includes('"YJ"')
console.log('需要重新登录正式库 = ' + needRelogin)
if (needRelogin) {
  if (s0.token) {
    await page.evaluate(() => {
      localStorage.removeItem('mes_token'); localStorage.removeItem('mes_user'); localStorage.removeItem('mes_factory')
    })
    await page.goto('http://localhost:5173/#/login', { timeout: 60000 })
    await page.reload()
  }
  // 等登录表单真的渲染出来(最多 20s)
  let ready = false
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(1000)
    ready = await page.evaluate(() => [...document.querySelectorAll('input')].some((x) => (x.placeholder || '').includes('账号')))
    if (ready) break
  }
  console.log('登录表单就绪 = ' + ready)
  const relogin = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins0 = [...document.querySelectorAll('input')]
    const accIn = ins0.find((i) => (i.placeholder || '').includes('账号'))
    const pwdIn = ins0.find((i) => (i.placeholder || '').includes('密码'))
    // 工厂下拉:表单里那个 el-select(文案里带"请选择登录工厂/工厂"或用 factory 表单域)
    const formItems = [...document.querySelectorAll('.el-form-item')]
    const facItem = formItems.find((f) => (f.textContent || '').includes('工厂'))
    const sel = facItem ? facItem.querySelector('.el-select') : null
    let picked = null
    if (sel) {
      sel.click()
      await sleep(900)
      const opts = [...document.querySelectorAll('.el-select-dropdown__item')]
      const t = opts.find((o) => (o.textContent || '').trim() === 'YINJIA-MES')
      if (t) { t.click(); picked = t.textContent.trim() }
      await sleep(400)
    }
    setVal(accIn, 'admin')
    setVal(pwdIn, '123456')
    await sleep(300)
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    btn?.click()
    return { hasAcc: !!accIn, hasPwd: !!pwdIn, facSelect: !!sel, picked, clicked: !!btn }
  })
  console.log('② 重新登录动作 = ' + JSON.stringify(relogin))
  await page.waitForTimeout(7000)
}

const s1 = await page.evaluate(() => ({
  hash: location.hash,
  token: !!localStorage.getItem('mes_token'),
  factory: localStorage.getItem('mes_factory'),
  title: document.title,
}))
console.log('收尾状态 = ' + JSON.stringify(s1))
await page.screenshot({ path: OUT + '/round-06-restored.png' })
await task.finish({ keep: ['p1'] })
