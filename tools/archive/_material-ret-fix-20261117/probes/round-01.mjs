const task = await taskSpace('material-ret-fix-20261117')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MATERIAL_RET', { timeout: 40000 })
await page.waitForTimeout(3500)

// 未登录则用 admin/123456 登录
const atLogin = await page.evaluate(() => !!document.querySelector('input[placeholder*="账号"]'))
if (atLogin) {
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
  await page.waitForTimeout(4000)
  await page.goto('http://localhost:5173/#/panelx/list/MATERIAL_RET', { timeout: 40000 })
  await page.waitForTimeout(3500)
}

const out = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token')
  const call = async (url, body) => {
    const r = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: body ? JSON.stringify(body) : undefined,
    })
    const t = await r.text()
    return { status: r.status, body: t.length > 900 ? t.slice(0, 900) : t }
  }
  const res = {}
  res.hash = location.hash
  res.materialRet = await call('/api/px/queryFormDataList', { panelCode: 'MATERIAL_RET', condition: {}, pageNo: 1, pageSize: 20 })
  res.bodyText = (document.body.innerText || '').slice(0, 1500)
  return res
})
console.log(JSON.stringify(out, null, 2))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/material-ret-fix-20261117/round-01.png' })
