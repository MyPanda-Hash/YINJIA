// 2026-11-13 round-02:手机端弹窗复验 —— 提示条实时显示 + 弹窗三数 + 「改为」生效 + 桌面宽度比例
const task = await taskSpace('mob-report-cap-20261113')
const page = task.page('p1')
const BASE = 'http://localhost:5173'
const OUT = 'C:/Users/vigna/ego/mob-report-cap-20261113/'
async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) { console.log('restore skip: ' + e.message) }
}
const VISIBLE = `(() => { const d = document.querySelector('.mp-cap-dlg'); if (!d) return false; const r = d.getBoundingClientRect(); return r.width > 0 && r.height > 0; })()`
async function setQty(v) {
  await page.evaluate((val) => {
    const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
    const inp = document.querySelector('.mp-qty input')
    if (inp) { inp.focus(); setVal(inp, String(val)); inp.blur() }
  }, v)
  await page.waitForTimeout(500)
}
try { await page.cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }) } catch (e) { console.log('emu skip: ' + e.message) }
await page.goto(BASE + '/#/panelx/list/MOBILE_REPORT', { timeout: 40000 })
await page.waitForTimeout(6000)
await restoreWindow()
if (!(await page.evaluate(() => !!document.querySelector('.mp')))) { console.log('需要登录'); }
await page.evaluate(() => {
  const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })) }
  const inp = document.querySelector('.mp-card input')
  if (inp) setVal(inp, 'GD-2026-11-0012')
})
await page.waitForTimeout(300)
await page.evaluate(() => { const b = [...document.querySelectorAll('.mp-row .el-button')].find((x) => (x.textContent || '').includes('查询')); if (b) b.click() })
await page.waitForTimeout(4500)
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.mp-op')].find((x) => (x.querySelector('.mp-op-name') || {}).textContent?.trim() === '装箱')
  if (el) el.click()
})
await page.waitForTimeout(600)
// ① 填 200:提交按钮下方应立刻出现「本次最多可报 100」
await setQty(200)
console.log('hint=' + JSON.stringify(await page.evaluate(() => (document.querySelector('.mp-warn') || {}).textContent?.trim() || '')))
await page.screenshot({ path: OUT + 'round-11-mobile-hint.png' })
// ② 提交 → 弹窗
await page.evaluate(() => { const b = [...document.querySelectorAll('.mp-submit .el-button')].find((x) => (x.textContent || '').includes('提交报工')); if (b) b.click() })
await page.waitForTimeout(1500)
console.log('dialog=' + JSON.stringify(await page.evaluate((vis) => {
  const d = document.querySelector('.mp-cap-dlg')
  const r = d ? d.getBoundingClientRect() : { width: 0 }
  return {
    visible: eval(vis),
    title: (d?.querySelector('.el-dialog__title') || {}).textContent?.trim() || '',
    max: (d?.querySelector('.mp-cap-max') || {}).textContent?.trim() || '',
    bodyWidth: Math.round(r.width), iw: innerWidth,
  }
  // eslint-disable-next-line no-eval
}, VISIBLE)))
await page.screenshot({ path: OUT + 'round-12-mobile-dialog.png' })
// ③ 改为 100
await page.evaluate(() => { const b = [...document.querySelectorAll('.mp-cap-dlg .mp-cap-actions .el-button')].find((x) => (x.textContent || '').includes('改为')); if (b) b.click() })
await page.waitForTimeout(900)
console.log('afterApply=' + JSON.stringify(await page.evaluate((vis) => ({
  visible: eval(vis),
  qty: (document.querySelector('.mp-qty input') || {}).value || '',
  hint: (document.querySelector('.mp-warn') || {}).textContent?.trim() || '',
}), VISIBLE)))
await page.screenshot({ path: OUT + 'round-13-mobile-applied.png' })
// ④ 桌面宽度(同一组件):再填 200 提交,看弹窗宽度上限 420
try { await page.cdp('Emulation.clearDeviceMetricsOverride', {}) } catch (e) { console.log('clear skip: ' + e.message) }
await page.waitForTimeout(800)
await restoreWindow()
await setQty(200)
await page.evaluate(() => { const b = [...document.querySelectorAll('.mp-submit .el-button')].find((x) => (x.textContent || '').includes('提交报工')); if (b) b.click() })
await page.waitForTimeout(1300)
console.log('wide=' + JSON.stringify(await page.evaluate((vis) => {
  const d = document.querySelector('.mp-cap-dlg')
  const r = d ? d.getBoundingClientRect() : { width: 0 }
  return { visible: eval(vis), bodyWidth: Math.round(r.width), iw: innerWidth }
  // eslint-disable-next-line no-eval
}, VISIBLE)))
await page.screenshot({ path: OUT + 'round-14-wide-dialog.png' })
await page.evaluate(() => { const b = [...document.querySelectorAll('.mp-cap-dlg .mp-cap-actions .el-button')].find((x) => (x.textContent || '').includes('知道了')); if (b) b.click() })
await page.waitForTimeout(500)
console.log('DONE')
