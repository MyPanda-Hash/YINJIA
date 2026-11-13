// round-28.mjs —— 8090(测试库)采购订单:单价/仓库不再显示「必填」
const task = await taskSpace('role-field-view-20261113')
const page = task.page('p1')

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip') }

const hasLoginForm = () => page.evaluate(() => !!document.querySelector('input[placeholder="请输入登录账号"]'))
await page.goto('http://127.0.0.1:8090/#/login', { timeout: 60000 })
await page.waitForTimeout(2500)
if (!(await hasLoginForm())) {
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.goto('http://127.0.0.1:8090/?r=' + Date.now() + '#/login', { timeout: 60000 })
  await page.waitForTimeout(3000)
}
await page.waitForSelector('input[placeholder="请输入登录账号"]', { state: 'visible', timeout: 20000 })
// 工厂 = 测试库
await page.evaluate(() => {
  const f = [...document.querySelectorAll('.el-select__wrapper')].find((w) => (w.textContent || '').includes('YINJIA-MES'))
  if (f) f.click()
})
await page.waitForTimeout(700)
await page.evaluate(() => {
  const t = [...document.querySelectorAll('.el-select-dropdown__item')].find((i) => (i.textContent || '').includes('测试库'))
  if (t) t.click()
})
await page.waitForTimeout(600)
await page.fill('input[placeholder="请输入登录账号"]', 'admin')
await page.fill('input[placeholder="请输入登录密码"]', '123456')
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').includes('进入系统'))
  if (b) b.click()
})
await page.waitForTimeout(6500)

await page.goto('http://127.0.0.1:8090/#/panelx/list/PU_ORDER', { timeout: 60000 })
await page.waitForTimeout(8000)
console.log('hash=' + (await page.evaluate(() => location.hash)))

// 打开 表格调整(系统整体),看单价/仓库 是否还带「必填」标签
await page.evaluate(() => {
  const more = [...document.querySelectorAll('.tb-main .act-name')].find((s) => (s.textContent || '').trim() === '更多')
  more?.closest('.tb-group')?.querySelector('.tb-caret')?.click()
})
await page.waitForTimeout(800)
await page.evaluate(() => {
  const it = [...document.querySelectorAll('.ctx-item')].find((e) => (e.textContent || '').trim() === '表格调整')
  if (it) it.click()
})
await page.waitForTimeout(1800)

const info = await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.textContent || '').includes('表格调整'))
  if (!box) return null
  // 先切到「系统整体」看基线口径
  const sys = [...box.querySelectorAll('.col-pref-scope .el-radio-button')].find((e) => (e.textContent || '').trim() === '系统整体')
  if (sys) sys.click()
  return { switched: !!sys }
})
await page.waitForTimeout(1200)

const rows = await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.textContent || '').includes('表格调整'))
  const want = ['单价', '仓库', '数量', '物料编码', '含税单价']
  return [...box.querySelectorAll('.col-pref-row')]
    .map((r) => ({
      label: (r.querySelector('.cp-label')?.textContent || '').replace(/\s+/g, ' ').trim(),
      checked: !!r.querySelector('.el-checkbox.is-checked'),
    }))
    .filter((x) => want.some((w) => x.label.startsWith(w)))
})
console.log('表格调整里的这些行 = ' + JSON.stringify(rows, null, 1))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/role-field-view-20261113/round-28-pu-order-not-required.png' })

await page.evaluate(() => {
  const box = [...document.querySelectorAll('.el-dialog')].find((d) => d.offsetParent !== null && (d.textContent || '').includes('表格调整'))
  box?.querySelector('.el-dialog__headerbtn')?.click()
})
