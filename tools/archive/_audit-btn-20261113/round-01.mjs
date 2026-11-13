// round-01: 正式库(YJ)只看不改 —— 采购订单工具栏是否多出独立的「审核」按钮,
// 以及「审批 ▼」下拉里是否已不再重复出现「审核」。
const task = await taskSpace('audit-btn-20261113')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
await page.waitForTimeout(4000)

// 登录态兜底(会话过期会停在登录页)
const needLogin = await page.evaluate(() => !!document.querySelector('input[placeholder*="账号"]'))
if (needLogin) {
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
  await page.waitForTimeout(6000)
  await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
  await page.waitForTimeout(4000)
}

const info = await page.evaluate(() => {
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  const groups = [...document.querySelectorAll('.tools .tb-group')].map((g) => ({
    main: text(g.querySelector('.tb-main')),
    disabled: (g.querySelector('.tb-main')?.className || '').includes('disabled'),
    hasCaret: !!g.querySelector('.tb-caret'),
    title: g.querySelector('.tb-main')?.getAttribute('title') || '',
  }))
  return {
    hash: location.hash,
    loginPage: !!document.querySelector('input[placeholder*="账号"]'),
    toolbarGroups: groups,
    docNo: text(document.querySelector('.doc-chip')),
    docStatus: text(document.querySelector('.doc-status')),
    rowCount: document.querySelectorAll('.rail-row, .doc-rail .row').length,
  }
})
console.log(JSON.stringify(info, null, 2))

// 「审批 ▼」下拉内容(点开即读,不执行任何动作)
const caretIdx = info.toolbarGroups.findIndex((g) => g.main === '审批')
if (caretIdx >= 0) {
  const carets = await page.evaluate(() => [...document.querySelectorAll('.tools .tb-group')].map((g) => !!(g.querySelector('.tb-caret'))))
  const handles = await page.evaluate(() => [...document.querySelectorAll('.tools .tb-group .tb-caret')].length)
  if (handles) {
    await page.evaluate((i) => {
      const carets = [...document.querySelectorAll('.tools .tb-group .tb-caret')]
      // i 是 tb-group 的序号;含 caret 的组与它一一对应(只有 actions>1 才有 caret)
      const groups = [...document.querySelectorAll('.tools .tb-group')]
      const el = groups[i]?.querySelector('.tb-caret')
      if (el) el.click()
    }, caretIdx)
    await page.waitForTimeout(600)
    const menu = await page.evaluate(() => [...document.querySelectorAll('.tools .tb-menu .ctx-item')]
      .map((el) => ({ text: (el.textContent || '').trim(), disabled: (el.className || '').includes('disabled') })))
    console.log('审批下拉: ' + JSON.stringify(menu))
    await page.screenshot({ path: 'C:/Users/Lenovo/ego/audit-btn-20261113/round-01-approval-dropdown.png' })
    // 收起
    await page.evaluate((i) => {
      const groups = [...document.querySelectorAll('.tools .tb-group')]
      groups[i]?.querySelector('.tb-caret')?.click()
    }, caretIdx)
  }
}

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(500)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: 'C:/Users/Lenovo/ego/audit-btn-20261113/round-01-toolbar.png' })
console.log('space=' + task.spaceId)
