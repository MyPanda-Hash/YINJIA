/**
 * round-13:8090(打包产物)用**测试账套**登录 → 打开扫码混料列表页并截图
 * (证明部署产物里就是新版两页结构与文案)。
 */
const task = await taskSpace('mix-doc-20261118')
const page = task.page('p1')

// 账号密码(登录页)
await page.fill('input[placeholder*="登录账号"]', 'admin')
await page.fill('input[placeholder*="登录密码"]', '123456')
// 登录工厂:第二个下拉(el-select)选「YINJIA-MES·测试库」
await page.click('.el-select >> nth=1')
await page.waitForTimeout(600)
await page.click('.el-select-dropdown__item:has-text("测试库")')
await page.waitForTimeout(400)
await page.click('text=进入系统')
await page.waitForTimeout(5000)

const session = await page.evaluate(() => ({
  hash: location.hash,
  factory: localStorage.getItem('mes_factory'),
  token: (localStorage.getItem('mes_token') || '').slice(0, 20),
}))
console.log('== 登录结果 ==')
console.log(JSON.stringify(session, null, 2))

await page.goto('http://127.0.0.1:8090/#/panelx/list/MOBILE_MIX_SCAN', { timeout: 30000 })
await page.waitForTimeout(4000)
const list = await page.evaluate(() => ({
  hash: location.hash,
  title: document.title,
  sub: (document.querySelector('.mm-sub') || {}).innerText || '',
  groups: [...document.querySelectorAll('.mm-grp-head')].map((el) => el.innerText.replace(/\s+/g, ' ').trim()),
  pendingCard: (document.querySelector('.mm-doc') || {}).innerText || '',
  err: (document.querySelector('.mm-err') || {}).innerText || '',
}))
console.log('== 8090 列表页(测试账套) ==')
console.log(JSON.stringify(list, null, 2))

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/mix-doc-20261118/round-13-8090-list.png' })
