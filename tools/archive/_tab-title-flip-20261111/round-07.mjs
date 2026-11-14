const task = await taskSpace('tab-title-flip-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/dashboard', { timeout: 60000 })
await page.evaluate(() => location.reload())
await page.waitForTimeout(7000)

const read = () => {
  const tabs = [...document.querySelectorAll('.tabsbar .tab')].map((el) => (el.querySelector('span')?.textContent || '').replace(/\s+/g, ' ').trim())
  const act = [...document.querySelectorAll('.tabsbar .tab')].findIndex((el) => el.classList.contains('active'))
  const head = (document.querySelector('.portal-content')?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 90)
  return { hash: location.hash, tabs, act, head, viteErr: !!document.querySelector('vite-error-overlay') }
}

// 1) 我的桌面 → 点「项目申请」快捷入口（/panelx/form/RD_APPROVAL）
const clicked = await page.evaluate(() => {
  const cand = [...document.querySelectorAll('*')].filter((el) => el.children.length === 0 && (el.textContent || '').trim() === '项目申请')
  const el = cand[0]
  if (!el) return false
  let t = el
  for (let i = 0; i < 4 && t; i++) { t = t.parentElement }
  ;(el.closest('button, a, .card, [class*=quick]') || el).click()
  return true
})
console.log('clicked=' + clicked)
await page.waitForTimeout(7000)
const form = await page.evaluate(read)
console.log('FORM ' + JSON.stringify(form))

// 2) 切到采购订单列表页签，再切回表单页签
await page.evaluate(() => { location.hash = '#/panelx/list/PU_ORDER' })
await page.waitForTimeout(4000)
const away = await page.evaluate(read)
console.log('AWAY ' + JSON.stringify(away))
const formTabName = form.tabs[form.act]
await page.evaluate((nm) => {
  const el = [...document.querySelectorAll('.tabsbar .tab')].find((t) => (t.querySelector('span')?.textContent || '').trim() === nm)
  if (el) el.click()
}, formTabName)
await page.waitForTimeout(4500)
const back = await page.evaluate(read)
console.log('BACK ' + JSON.stringify(back))
console.log(back.tabs[back.act] === formTabName ? `PASS 表单页签名保持(${formTabName})` : `FAIL 表单页签名被改成 ${back.tabs[back.act]}（原 ${formTabName}）`)
console.log('TABS ' + JSON.stringify(back.tabs) + ' 重名=' + JSON.stringify(back.tabs.filter((t, i) => back.tabs.indexOf(t) !== i)))
console.log('VITE_ERROR_OVERLAY=' + back.viteErr)

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/tab-title-flip-20261111/round-07.png' })
