// round-03: 正式库只读 —— 先取证(文字),再试小范围截图(整页截图在这个大列表上超时)。
const task = await taskSpace('audit-btn-20261113')
const page = task.page('p1')
if (!String(await page.url()).includes('/panelx/list/PU_ORDER')) {
  await page.goto('http://localhost:5173/#/panelx/list/PU_ORDER', { timeout: 40000 })
  await page.waitForTimeout(4000)
}
try { await page.cdp('Page.bringToFront') } catch (e) { console.log('front skip: ' + e.message) }
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  console.log('window ' + JSON.stringify(w))
  if (w && w.windowId) {
    await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    const b = await task.cdp('Browser.getWindowBounds', { windowId: w.windowId })
    console.log('bounds ' + JSON.stringify(b))
  }
} catch (e) { console.log('bounds skip: ' + e.message) }
await page.waitForTimeout(800)

const state = await page.evaluate(() => {
  const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim()
  return {
    hash: location.hash,
    doc: text(document.querySelector('.doc-chip')),
    status: text(document.querySelector('.doc-status')),
    toolbar: [...document.querySelectorAll('.tools .tb-group')].map((g) => ({
      main: text(g.querySelector('.tb-main')),
      disabled: (g.querySelector('.tb-main')?.className || '').includes('disabled'),
      caret: !!g.querySelector('.tb-caret'),
    })),
  }
})
console.log('STATE ' + JSON.stringify(state, null, 2))

// ① 点「审核」:当前单已审核 ⇒ 只应弹一条"状态不对"的提示,不弹确认框
await page.evaluate(() => {
  const groups = [...document.querySelectorAll('.tools .tb-group')]
  const g = groups.find((x) => (x.querySelector('.tb-main')?.textContent || '').trim() === '审核')
  g?.querySelector('.tb-main')?.click()
})
await page.waitForTimeout(1500)
const tip = await page.evaluate(() => [...document.querySelectorAll('.el-message__content')].map((el) => (el.textContent || '').trim()))
const dialog = await page.evaluate(() => !!document.querySelector('.el-message-box'))
console.log('AUDIT_CLICK tip=' + JSON.stringify(tip) + ' dialog=' + dialog)
try { await page.screenshot({ path: 'C:/Users/Lenovo/ego/audit-btn-20261113/round-03-tip.png', clip: { x: 0, y: 0, width: 900, height: 200 } }) } catch (e) { console.log('shot skip: ' + e.message) }

// ② 打开「审批 ▼」:下拉里不再有「审核」
await page.evaluate(() => {
  const groups = [...document.querySelectorAll('.tools .tb-group')]
  const g = groups.find((x) => (x.querySelector('.tb-main')?.textContent || '').trim() === '审批')
  g?.querySelector('.tb-caret')?.click()
})
await page.waitForTimeout(700)
const menu = await page.evaluate(() => [...document.querySelectorAll('.tools .tb-menu .ctx-item')]
  .map((el) => ({ text: (el.textContent || '').trim(), disabled: (el.className || '').includes('disabled') })))
console.log('APPROVAL_MENU ' + JSON.stringify(menu))
try { await page.screenshot({ path: 'C:/Users/Lenovo/ego/audit-btn-20261113/round-03-menu.png', clip: { x: 0, y: 0, width: 1200, height: 320 } }) } catch (e) { console.log('shot2 skip: ' + e.message) }
