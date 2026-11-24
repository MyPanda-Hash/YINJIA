// round-01:登录(测试账套)+ 进采购订单列表 + 点「生单 ▼」→「合单生单」→ 看选单窗是否出来
const task = await taskSpace('merge-pick-docs-20261124')
const page = task.page('p1')

const log = (...a) => console.log(...a)

await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 60000 })
await page.waitForTimeout(5000)

// 恢复窗口(截图前)
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { log('restore skip: ' + e.message) }

const state0 = await page.evaluate(() => ({
  hash: location.hash,
  hasLogin: !!document.querySelector('input[placeholder*="账号"]') || document.querySelectorAll('input').length > 0 && !!document.querySelector('.login-submit'),
  tbGroups: [...document.querySelectorAll('.tb-group .tb-main')].map((e) => (e.textContent || '').trim()),
  rows: document.querySelectorAll('.el-table__body tbody tr').length,
}))
log('STATE0', JSON.stringify(state0))

// 未登录 → 登录(优先测试账套)
const needLogin = await page.evaluate(() => !!document.querySelector('.login-submit'))
if (needLogin) {
  log('LOGIN: 需要登录')
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  await page.evaluate((code) => {
    window.__setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    const acc = ins.find((i) => (i.placeholder || '').includes('账号'))
    const pwd = ins.find((i) => (i.placeholder || '').includes('密码'))
    if (acc) window.__setVal(acc, 'admin')
    if (pwd) window.__setVal(pwd, '123456')
  })
  // 选登录工厂(测试库):打开 el-select → 点含「测试」的选项
  const picked = await page.evaluate(() => {
    const wrap = document.querySelector('.el-select__wrapper') || document.querySelector('.el-select')
    if (wrap) wrap.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return !!wrap
  })
  await page.waitForTimeout(800)
  const factoryPick = await page.evaluate(() => {
    const items = [...document.querySelectorAll('.el-select-dropdown__item')]
    const target = items.find((el) => (el.textContent || '').includes('测试'))
    if (!target) return { ok: false, all: items.map((e) => (e.textContent || '').trim()) }
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return { ok: true, text: (target.textContent || '').trim() }
  })
  log('FACTORY', JSON.stringify(factoryPick), 'opened=' + picked)
  await page.waitForTimeout(500)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
  await page.waitForTimeout(6000)
}

const state1 = await page.evaluate(() => ({
  hash: location.hash,
  tbGroups: [...document.querySelectorAll('.tb-group .tb-main')].map((e) => (e.textContent || '').trim()),
  railRows: document.querySelectorAll('.el-table__body tbody tr').length,
  panels: [...document.querySelectorAll('.panel-name,.doc-chip')].map((e) => (e.textContent || '').trim()).slice(0, 3),
}))
log('STATE1', JSON.stringify(state1))

// 若不在采购订单列表,回列表
await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 60000 })
await page.waitForTimeout(3500)

// 打开「生单」卡片的下拉
const openDrop = await page.evaluate(() => {
  const groups = [...document.querySelectorAll('.tb-group')]
  const g = groups.find((x) => (x.querySelector('.tb-main')?.textContent || '').trim() === '生单')
  if (!g) return { ok: false, groups: groups.map((x) => (x.querySelector('.tb-main')?.textContent || '').trim()) }
  const caret = g.querySelector('.tb-caret')
  if (!caret) return { ok: false, why: 'no caret' }
  caret.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return { ok: true }
})
log('DROP', JSON.stringify(openDrop))
await page.waitForTimeout(800)

const menu = await page.evaluate(() => [...document.querySelectorAll('.tb-menu .ctx-item')].map((e) => (e.textContent || '').trim()))
log('MENU', JSON.stringify(menu))

await page.screenshot({ path: 'C:/Users/Lenovo/ego/merge-pick-docs-20261124/round-01-menu.png' })
log('done round-01')
