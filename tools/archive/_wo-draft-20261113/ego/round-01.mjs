// 方案 A 界面验收 round-01：生产工单页 →「新增」整页编制渲染检查
const task = await taskSpace('wo-draft-20261113')
const page = (await task.pages())[0] ?? (await task.newPage())
const errors = []
page.on?.('pageerror', (e) => errors.push(String(e)))
const sleep = (ms) => page.waitForTimeout(ms)

await page.goto('http://127.0.0.1:8091/#/login', { timeout: 30000 })
await sleep(1500)
let logged = !(await page.url()).includes('/login')
if (!logged) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    const u = ins.find((i) => (i.placeholder || '').includes('账号'))
    const p = ins.find((i) => (i.placeholder || '').includes('密码'))
    if (u) setVal(u, 'admin')
    if (p) setVal(p, '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    btn?.click()
  })
  await sleep(3000)
  logged = !(await page.url()).includes('/login')
}
console.log('logged=' + logged)
await page.goto('http://127.0.0.1:8091/#/prod/plan/workOrderList', { timeout: 30000 })
await sleep(4500)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { console.log('restore skip: ' + e.message) }
const listInfo = await page.evaluate(() => ({
  buttons: [...document.querySelectorAll('.wol-btns button')].map((b) => (b.textContent || '').replace(/\s+/g, ' ').trim()),
  draftBox: [...document.querySelectorAll('.wol-btns button')].some((b) => (b.textContent || '').includes('草稿箱')),
  rows: document.querySelectorAll('.wol-table .el-table__body tr').length,
}))
console.log('生产工单页=' + JSON.stringify(listInfo))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-draft-20261113/r01-list.png' })

// 点「新增」→ 整页
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.wol-btns button')].find((b) => (b.textContent || '').trim() === '新增')
  btn?.click()
})
await sleep(3500)
const pg = await page.evaluate(() => {
  const root = document.querySelector('.wop-page')
  if (!root) return { ok: false, hash: location.hash, body: (document.querySelector('#app')?.textContent || '').slice(0, 120) }
  return {
    ok: true,
    hash: location.hash,
    title: (root.querySelector('.wop-title') || {}).textContent || '',
    tabs: [...root.querySelectorAll('.wop-tabs .el-tabs__item')].map((x) => (x.textContent || '').trim()),
    labels: [...root.querySelectorAll('.wop-form .el-form-item__label')].map((x) => (x.textContent || '').trim()),
    footer: [...root.querySelectorAll('.wop-footer button, .wop-actions button, button')].map((b) => (b.textContent || '').trim()).filter((t) => ['保存草稿', '提交生成工单', '返回列表'].includes(t)),
    routeText: (() => {
      const item = [...root.querySelectorAll('.wop-form .el-form-item')].find((x) => ((x.querySelector('.el-form-item__label') || {}).textContent || '').trim() === '工艺路线')
      return item ? ((item.querySelector('.el-select__selected-item') || {}).textContent || '').trim() : ''
    })(),
  }
})
console.log('整页编制=' + JSON.stringify(pg))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-draft-20261113/r01-create-page.png', fullPage: false })
console.log('pageerrors=' + JSON.stringify(errors))
